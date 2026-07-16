#!/bin/bash
# specky-metrics-dashboard.sh — Generate metrics dashboard reminder
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 8
# Paper: arXiv:2507.09089 — AI productivity paradox

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?
[ "${SPECKY_CONTEXT_ACTIVE:-0}" = "1" ] || exit 0

LATEST="$SPECKY_FEATURE_DIR"

# Check if analysis is done but metrics not generated
if [ -f "$LATEST/ANALYSIS.md" ] && [ ! -f "$LATEST/specky-metrics-dashboard.html" ]; then
  echo "📊 ANALYSIS.md complete but no metrics dashboard generated."
  echo "   Run sdd_metrics to generate the HTML dashboard with:"
  echo "   - Cognitive debt score"
  echo "   - Requirement coverage heatmap"
  echo "   - Test traceability matrix"
  echo "   - Pipeline phase timing"
fi

exit 0
