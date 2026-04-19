#!/bin/bash
# cognitive-debt-alert.sh — Alert when LGTM-without-modification rate is high
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 8
# Paper: arXiv:2603.22106 — cognitive surrender measurement

set -euo pipefail

STATE=$(find . -name ".sdd-state.json" -maxdepth 2 2>/dev/null | head -1)
[ -z "$STATE" ] || [ ! -f "$STATE" ] && exit 0

# Check if gate history exists in state
if command -v jq &>/dev/null && [ -f "$STATE" ]; then
  GATES=$(jq -r '.gate_history // [] | length' "$STATE" 2>/dev/null || echo "0")
  LGTM_NO_MOD=$(jq -r '[.gate_history // [] | .[] | select(.modified == false)] | length' "$STATE" 2>/dev/null || echo "0")
  
  if [ "$GATES" -gt 0 ]; then
    RATE=$((LGTM_NO_MOD * 100 / GATES))
    if [ "$RATE" -gt 70 ]; then
      echo "🧠 Cognitive Debt Alert"
      echo "   LGTM-without-modification rate: ${RATE}% ($LGTM_NO_MOD/$GATES gates)"
      echo "   >70% suggests rubber-stamping. Review gates are being approved without changes."
      echo "   Run sdd_metrics for the full cognitive debt dashboard."
    fi
  fi
fi

exit 0
