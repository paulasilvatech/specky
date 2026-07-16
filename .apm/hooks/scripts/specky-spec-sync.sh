#!/bin/bash
# specky-spec-sync.sh — Detect spec-code drift
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 6
# Paper: arXiv:2602.20478 — anti-context-collapse
#
# Claude Code settings.json:
#   "hooks": { "PostToolUse": ["bash .claude/hooks/specky-spec-sync.sh"] }

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?
[ "${SPECKY_CONTEXT_ACTIVE:-0}" = "1" ] || exit 0

DRIFT=0
dir="$SPECKY_FEATURE_DIR"
[ -f "$dir/SPECIFICATION.md" ] || exit 0
REQS=$(grep -oE 'REQ-[A-Z]+-[0-9]+' "$dir/SPECIFICATION.md" 2>/dev/null | sort -u)
for req in $REQS; do
  if ! grep -rq "$req" src/ tests/ test/ __tests__/ 2>/dev/null; then
    echo "⚠️  DRIFT: $req (${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}) — not found in code or tests"
    DRIFT=1
  fi
done

[ "$DRIFT" -eq 1 ] && echo "📋 Run sdd_check_sync for details. If intentional, run sdd_amend."
exit 0
