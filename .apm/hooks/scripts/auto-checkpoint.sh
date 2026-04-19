#!/bin/bash
# auto-checkpoint.sh — Suggest checkpoint when spec artifacts are written
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 0,3,4,5
# Paper: arXiv:2602.20478 — artifact preservation

set -euo pipefail

# Check if a spec artifact was recently modified (last 60 seconds)
RECENT=$(find .specs -name "*.md" -newer /tmp/.sdd-last-checkpoint 2>/dev/null | head -5 || true)
[ -d .specs ] || exit 0

if [ -n "$RECENT" ]; then
  echo "💾 Spec artifacts modified:"
  echo "$RECENT"
  echo "   Consider running sdd_checkpoint to save a snapshot."
  touch /tmp/.sdd-last-checkpoint
fi

exit 0
