#!/bin/bash
# specky-auto-checkpoint.sh — Suggest checkpoint when spec artifacts are written
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 0,3,4,5
# Paper: arXiv:2602.20478 — artifact preservation

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?
[ "${SPECKY_CONTEXT_ACTIVE:-0}" = "1" ] || exit 0
[ "${SPECKY_CHECKPOINTS_REQUIRED:-0}" = "1" ] || exit 0

MARKER="/tmp/.sdd-last-checkpoint-${SPECKY_CONTRACT_FINGERPRINT}"
[ -f "$MARKER" ] || touch -t 197001010000 "$MARKER"
RECENT=$(find "$SPECKY_FEATURE_DIR" -name "*.md" -newer "$MARKER" 2>/dev/null | head -5 || true)

if [ -n "$RECENT" ]; then
  echo "💾 Spec artifacts modified:"
  echo "$RECENT"
  echo "   Consider running sdd_checkpoint to save a snapshot."
  touch "$MARKER"
fi

exit 0
