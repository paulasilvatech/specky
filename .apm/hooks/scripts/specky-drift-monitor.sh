#!/bin/bash
# specky-drift-monitor.sh — Monitor CONSTITUTION.md drift from spec artifacts
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 8
# Paper: arXiv:2602.20478, arXiv:2603.22106

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?
[ "${SPECKY_CONTEXT_ACTIVE:-0}" = "1" ] || exit 0

LATEST="$SPECKY_FEATURE_DIR"
CONST="$LATEST/CONSTITUTION.md"
SPEC="$LATEST/SPECIFICATION.md"
[ -f "$CONST" ] && [ -f "$SPEC" ] || exit 0

echo "🧭 Drift Monitor: ${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME} ($SPECKY_CONTRACT_ID)"

# Simple drift: compare key terms in constitution vs spec (POSIX ERE for portability)
CONST_TERMS=$(grep -oE '[A-Z][a-z]+([[:space:]][A-Z][a-z]+)+' "$CONST" 2>/dev/null | sort -u | wc -l)
SPEC_TERMS=$(grep -oE '[A-Z][a-z]+([[:space:]][A-Z][a-z]+)+' "$SPEC" 2>/dev/null | sort -u | wc -l)

# Check if constitution scope terms appear in spec
CONST_SCOPE=$(grep -iE '(in scope|out of scope|must|shall not)' "$CONST" 2>/dev/null | wc -l)
SPEC_COVERAGE=$(grep -iE '(in scope|out of scope|must|shall not)' "$SPEC" 2>/dev/null | wc -l)

if [ "$CONST_SCOPE" -gt 0 ] && [ "$SPEC_COVERAGE" -eq 0 ]; then
  echo "⚠️  Constitution has scope constraints but SPECIFICATION.md may not reference them."
  echo "   Run sdd_check_sync for detailed analysis."
fi

echo "📊 Constitution: $CONST_TERMS key terms, $CONST_SCOPE scope constraints."
echo "   Run sdd_check_sync for intent drift score."
exit 0
