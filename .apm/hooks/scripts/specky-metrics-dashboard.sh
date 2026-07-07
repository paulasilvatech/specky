#!/bin/bash
# metrics-dashboard.sh — Generate metrics dashboard reminder
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 8
# Paper: arXiv:2507.09089 — AI productivity paradox

set -euo pipefail

LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && exit 0

# Check if analysis is done but metrics not generated
if [ -f "$LATEST/ANALYSIS.md" ] && [ ! -f "$LATEST/metrics-dashboard.html" ]; then
  echo "📊 ANALYSIS.md complete but no metrics dashboard generated."
  echo "   Run sdd_metrics to generate the HTML dashboard with:"
  echo "   - Cognitive debt score"
  echo "   - Requirement coverage heatmap"
  echo "   - Test traceability matrix"
  echo "   - Pipeline phase timing"
fi

exit 0
