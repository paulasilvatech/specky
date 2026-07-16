#!/bin/bash
# specky-lgtm-gate.sh — Prompt human review at LGTM checkpoints (Phases 3, 4, 5)
# Type: Advisory (exit 0) | Trigger: PostToolUse | sdd_write_spec, sdd_write_design, sdd_write_tasks
# Summarizes artifact and prompts for LGTM before phase advancement

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?
[ "${SPECKY_CONTEXT_ACTIVE:-0}" = "1" ] || exit 0

TOOL="${SDD_TOOL_NAME:-unknown}"
LATEST="$SPECKY_FEATURE_DIR"

FEATURE="${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"

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
    echo "⏸  LGTM REVIEW — Specify ($SPECKY_CONTRACT_ID)"
    echo "   Review SPECIFICATION.md above. Are the requirements correct?"
    echo "   If workspace policy requires LGTM, pass lgtm:true to sdd_advance_phase."
    echo "   Reply with feedback to revise."
    ;;
  sdd_write_design)
    print_summary "DESIGN.md" "DESIGN.md"
    echo ""
    echo "⏸  LGTM REVIEW — Design ($SPECKY_CONTRACT_ID)"
    echo "   Review DESIGN.md above. Is the architecture sound?"
    echo "   If workspace policy requires LGTM, pass lgtm:true to sdd_advance_phase."
    echo "   Reply with feedback to revise."
    ;;
  sdd_write_tasks)
    print_summary "TASKS.md" "TASKS.md"
    echo ""
    echo "⏸  LGTM REVIEW — Tasks ($SPECKY_CONTRACT_ID)"
    echo "   Review TASKS.md above. Is the task breakdown complete?"
    echo "   If workspace policy requires LGTM, pass lgtm:true to sdd_advance_phase."
    echo "   Reply with feedback to revise."
    ;;
  *)
    exit 0
    ;;
esac

# Always exit 0 — advisory gate, does not block
exit 0
