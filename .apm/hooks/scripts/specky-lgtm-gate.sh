#!/bin/bash
# lgtm-gate.sh — Prompt human review at LGTM checkpoints (Phases 3, 4, 5)
# Type: Advisory (exit 0) | Trigger: PostToolUse | sdd_write_spec, sdd_write_design, sdd_write_tasks
# Summarizes artifact and prompts for LGTM before phase advancement

set -euo pipefail

TOOL="${SDD_TOOL_NAME:-unknown}"
LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)

[ -z "$LATEST" ] && exit 0

FEATURE=$(basename "$LATEST")

print_summary() {
  local file="$1" label="$2"
  if [ -f "$LATEST/$file" ]; then
    local lines sections reqs
    lines=$(wc -l < "$LATEST/$file" | tr -d ' ')
    sections=$(grep -c '^## ' "$LATEST/$file" 2>/dev/null || echo "0")
    reqs=$(grep -coE 'REQ-[A-Z]+-[0-9]+' "$LATEST/$file" 2>/dev/null || echo "0")
    echo ""
    echo "📊 $label Summary ($LATEST/$file):"
    echo "   Lines: $lines | Sections: $sections | REQ refs: $reqs"
  fi
}

case "$TOOL" in
  sdd_write_spec|sdd_turnkey_spec|sdd_figma_to_spec)
    print_summary "SPECIFICATION.md" "SPECIFICATION.md"
    echo ""
    echo "⏸  LGTM GATE — Phase 3 (Specify)"
    echo "   Review SPECIFICATION.md above. Are the requirements correct?"
    echo "   Reply 'LGTM' to proceed to Phase 4 (Design)."
    echo "   Reply with feedback to revise."
    ;;
  sdd_write_design)
    print_summary "DESIGN.md" "DESIGN.md"
    echo ""
    echo "⏸  LGTM GATE — Phase 4 (Design)"
    echo "   Review DESIGN.md above. Is the architecture sound?"
    echo "   Reply 'LGTM' to proceed to Phase 5 (Tasks)."
    echo "   Reply with feedback to revise."
    ;;
  sdd_write_tasks)
    print_summary "TASKS.md" "TASKS.md"
    echo ""
    echo "⏸  LGTM GATE — Phase 5 (Tasks)"
    echo "   Review TASKS.md above. Is the task breakdown complete?"
    echo "   Reply 'LGTM' to proceed to Phase 6 (Implement)."
    echo "   Reply with feedback to revise."
    ;;
  *)
    exit 0
    ;;
esac

# Always exit 0 — advisory gate, does not block
exit 0
