#!/bin/bash
# task-tracer.sh — Detect tasks missing REQ-* traceability
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 5
# Paper: arXiv:2602.00180 — SDD traceability

set -euo pipefail

LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && exit 0
TASKS="$LATEST/TASKS.md"
[ -f "$TASKS" ] || exit 0

echo "🔗 Task Traceability Check: $TASKS"

# Find task lines (POSIX ERE for macOS/Linux portability)
TASK_LINES=$(grep -cE '^\|[[:space:]]*T-[0-9]+' "$TASKS" 2>/dev/null || echo "0")
TRACED_LINES=$(grep -cE 'REQ-[A-Z]+-[0-9]+' "$TASKS" 2>/dev/null || echo "0")

UNTRACED=$((TASK_LINES - TRACED_LINES))
if [ "$UNTRACED" -gt 0 ]; then
  echo "⚠️  $UNTRACED tasks may be missing REQ-* traceability."
  echo "   Every task must trace to at least one requirement."
  grep -E '^\|[[:space:]]*T-[0-9]+' "$TASKS" | grep -vE 'REQ-' | head -5
fi

echo "📊 $TASK_LINES tasks, $TRACED_LINES with REQ-* traceability."
exit 0
