#!/bin/bash
# ears-validator.sh — Validate EARS pattern compliance
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 2,3
# Paper: arXiv:2601.03878 — EARS quality
#
# Advisory hook: missing EARS pattern types WARN but exit 0 — exit 1 is
# reserved for real failures (SPECIFICATION.md missing or unreadable).
# Body is POSIX-sh compatible (runs under dash/sh as well as bash), so
# plain `set -eu` instead of bash-only `set -o pipefail`.

set -eu

LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && exit 0
SPEC="$LATEST/SPECIFICATION.md"

if [ ! -f "$SPEC" ] || [ ! -r "$SPEC" ]; then
  echo "❌ EARS Validation: $SPEC is missing or unreadable."
  echo "   sdd_write_spec should have produced it — re-run the Specify phase."
  exit 1
fi

echo "🔍 EARS Validation: $SPEC"

# Count one EARS pattern (POSIX ERE for macOS/Linux portability).
# grep -c prints the count but exits 1 when the count is 0; the old
# `|| echo "0"` appended a SECOND "0" line to the captured value, which
# broke the arithmetic below (and the whole hook, under set -e) for any
# spec missing even one pattern type. Capture the count and swallow the
# exit status instead.
count_pattern() {
  _count=$(grep -cE "$1" "$SPEC" 2>/dev/null) || _count="${_count:-0}"
  printf '%s' "${_count:-0}"
}

UBIQ=$(count_pattern 'The system shall')
EVENT=$(count_pattern 'When .*, the system shall')
STATE=$(count_pattern 'While .*, the system shall')
OPTION=$(count_pattern 'Where .*, the system shall')
UNWANTED=$(count_pattern 'If .*, then the system shall')
COMPLEX=$(count_pattern 'While .*, when .*, the system shall')

TOTAL=$((UBIQ + EVENT + STATE + OPTION + UNWANTED + COMPLEX))
REQS=$(count_pattern 'REQ-[A-Z]+-[0-9]+')

# Per-pattern coverage report
PRESENT=0
MISSING=""
report_pattern() {
  # $1 = padded label, $2 = count, $3 = pattern name for the warning line
  echo "  $1 $2"
  if [ "$2" -gt 0 ]; then
    PRESENT=$((PRESENT + 1))
  else
    MISSING="$MISSING $3"
  fi
}

report_pattern "Ubiquitous:  " "$UBIQ" "ubiquitous"
report_pattern "Event-driven:" "$EVENT" "event-driven"
report_pattern "State-driven:" "$STATE" "state-driven"
report_pattern "Optional:    " "$OPTION" "optional"
report_pattern "Unwanted:    " "$UNWANTED" "unwanted-behavior"
report_pattern "Complex:     " "$COMPLEX" "complex"
echo "  ─────────────"
echo "  Pattern coverage: $PRESENT/6 EARS pattern types present"
echo "  EARS total:   $TOTAL / $REQS requirements"

if [ -n "$MISSING" ]; then
  echo "⚠️  Pattern types with zero requirements:$MISSING"
  echo "   Not every spec needs all 6 EARS patterns — advisory only."
fi

if [ "$TOTAL" -lt "$REQS" ]; then
  echo "⚠️  $((REQS - TOTAL)) requirements may not follow EARS notation."
  echo "   Run sdd_validate_ears for detailed analysis."
fi

exit 0
