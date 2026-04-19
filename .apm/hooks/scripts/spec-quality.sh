#!/bin/bash
# spec-quality.sh — Validate specification quality after sdd_write_spec
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 3
# Paper: arXiv:2601.03878 — EARS quality

set -euo pipefail

LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && exit 0
SPEC="$LATEST/SPECIFICATION.md"
[ -f "$SPEC" ] || exit 0

echo "📋 Spec Quality Check: $SPEC"

# Count requirements (POSIX ERE for macOS/Linux portability)
REQ_COUNT=$(grep -cE 'REQ-[A-Z]+-[0-9]+' "$SPEC" 2>/dev/null || echo "0")
if [ "$REQ_COUNT" -lt 5 ]; then
  echo "⚠️  Only $REQ_COUNT requirements found (minimum 5)."
fi

# Check REQ-ID format consistency
BAD_IDS=$(grep -oE 'REQ-[a-z]' "$SPEC" 2>/dev/null || true)
if [ -n "$BAD_IDS" ]; then
  echo "⚠️  REQ-IDs should be uppercase: REQ-AUTH-01, not REQ-auth-01"
fi

# Check acceptance criteria presence
AC_COUNT=$(grep -ci 'acceptance\|acceptance signal\|acceptance criteria' "$SPEC" 2>/dev/null || echo "0")
if [ "$AC_COUNT" -lt "$REQ_COUNT" ]; then
  echo "⚠️  Some requirements may be missing acceptance criteria ($AC_COUNT AC for $REQ_COUNT reqs)."
fi

# Check EARS patterns
EARS_COUNT=$(grep -cE '(The system shall|When .* the system shall|While .* the system shall|Where .* the system shall|If .* then the system shall)' "$SPEC" 2>/dev/null || echo "0")
if [ "$EARS_COUNT" -lt "$REQ_COUNT" ]; then
  echo "⚠️  $((REQ_COUNT - EARS_COUNT)) requirements may not follow EARS notation."
fi

echo "📊 $REQ_COUNT requirements, $AC_COUNT acceptance criteria, $EARS_COUNT EARS patterns."
exit 0
