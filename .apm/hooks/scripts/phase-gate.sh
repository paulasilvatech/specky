#!/bin/bash
# phase-gate.sh — Validate output artifact was created after tool execution
# Type: BLOCKING (exit 2) | Trigger: PostToolUse | Artifact-writing tools
# Ensures phase artifacts exist and meet minimum quality after creation

set -euo pipefail

TOOL="${SDD_TOOL_NAME:-unknown}"
LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
FAILS=0

[ -z "$LATEST" ] && exit 0

FEATURE=$(basename "$LATEST")
echo "🚦 Phase Gate — $FEATURE — after $TOOL"

check_created() {
  local file="$1" label="$2"
  if [ ! -f "$LATEST/$file" ]; then
    echo "🚫 $label was NOT created in $LATEST"
    FAILS=$((FAILS+1))
  else
    local lines
    lines=$(wc -l < "$LATEST/$file" | tr -d ' ')
    echo "  ✅ $label created ($lines lines)"
  fi
}

check_has_content() {
  local file="$1" pattern="$2" label="$3" min="${4:-1}"
  if [ -f "$LATEST/$file" ]; then
    local count
    count=$(grep -cE "$pattern" "$LATEST/$file" 2>/dev/null || echo "0")
    if [ "$count" -lt "$min" ]; then
      echo "  ⚠️  $label: found $count (minimum $min)"
    else
      echo "  ✅ $label: $count found"
    fi
  fi
}

case "$TOOL" in
  sdd_init)
    check_created "CONSTITUTION.md" "CONSTITUTION.md"
    check_created ".sdd-state.json" ".sdd-state.json"
    ;;
  sdd_write_spec|sdd_turnkey_spec|sdd_figma_to_spec)
    check_created "SPECIFICATION.md" "SPECIFICATION.md"
    check_has_content "SPECIFICATION.md" "REQ-[A-Z]+-[0-9]+" "REQ-IDs" 3
    check_has_content "SPECIFICATION.md" "(shall|should|When .* shall|While .* shall|Where .* shall|If .* then)" "EARS patterns" 3
    ;;
  sdd_write_design)
    check_created "DESIGN.md" "DESIGN.md"
    check_has_content "DESIGN.md" "##" "Sections" 3
    ;;
  sdd_write_tasks)
    check_created "TASKS.md" "TASKS.md"
    check_has_content "TASKS.md" "REQ-[A-Z]+-[0-9]+" "REQ-ID traceability" 1
    check_has_content "TASKS.md" "TASK-[0-9]+" "Task IDs" 3
    ;;
  sdd_verify_tests|sdd_verify_tasks)
    check_created "VERIFICATION.md" "VERIFICATION.md"
    check_has_content "VERIFICATION.md" "pass_rate" "Pass rate metric" 1
    ;;
  sdd_run_analysis)
    check_created "ANALYSIS.md" "ANALYSIS.md"
    check_has_content "ANALYSIS.md" "gate_decision" "Gate decision" 1
    ;;
  sdd_cross_analyze)
    check_created "CROSS_ANALYSIS.md" "CROSS_ANALYSIS.md"
    ;;
  sdd_compliance_check)
    check_created "COMPLIANCE.md" "COMPLIANCE.md"
    ;;
  sdd_checklist)
    check_created "CHECKLIST.md" "CHECKLIST.md"
    ;;
  *)
    echo "  ✅ No output artifact check for $TOOL"
    ;;
esac

if [ "$FAILS" -gt 0 ]; then
  echo ""
  echo "❌ Phase gate FAILED ($FAILS artifacts missing). Tool $TOOL did not produce expected output."
  exit 2
fi

echo "✅ Phase gate passed for $TOOL"
exit 0
