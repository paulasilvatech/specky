#!/bin/bash
# drift-monitor.sh — Monitor CONSTITUTION.md drift from spec artifacts
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 8
# Paper: arXiv:2602.20478, arXiv:2603.22106

set -euo pipefail

LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && exit 0
CONST="$LATEST/CONSTITUTION.md"
SPEC="$LATEST/SPECIFICATION.md"
[ -f "$CONST" ] && [ -f "$SPEC" ] || exit 0

echo "🧭 Drift Monitor: $(basename "$LATEST")"

# Simple drift: compare key terms in constitution vs spec (POSIX ERE for portability)
CONST_TERMS=$(grep -oE '[A-Z][a-z]+([[:space:]][A-Z][a-z]+)+' "$CONST" 2>/dev/null | sort -u | wc -l)
SPEC_TERMS=$(grep -oE '[A-Z][a-z]+([[:space:]][A-Z][a-z]+)+' "$SPEC" 2>/dev/null | sort -u | wc -l)

# Check if constitution scope terms appear in spec
CONST_SCOPE=$(grep -iE '(in scope|out of scope|must|shall not)' "$CONST" 2>/dev/null | wc -l)
SPEC_COVERAGE=$(grep -iE '(in scope|out of scope|must|shall not)' "$SPEC" 2>/dev/null | wc -l)

if [ "$CONST_SCOPE" -gt 0 ] && [ "$SPEC_COVERAGE" -eq 0 ]; then
  echo "⚠️  Constitution has scope constraints but SPECIFICATION.md may not reference them."
  echo "   Run sdd_detect_drift for detailed analysis."
fi

echo "📊 Constitution: $CONST_TERMS key terms, $CONST_SCOPE scope constraints."
echo "   Run sdd_detect_drift for intent drift score."
exit 0
