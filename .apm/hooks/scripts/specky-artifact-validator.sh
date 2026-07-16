#!/bin/bash
# specky-artifact-validator.sh — Validate prerequisite .md artifacts before tool execution
# Type: BLOCKING (exit 2) | Trigger: PreToolUse | All phases
# Ensures required artifacts exist before a phase tool runs

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/specky-contract-context.bash"

TOOL="${SDD_TOOL_NAME:-unknown}"
FAILS=0

if [ "$TOOL" = "sdd_init" ]; then
  echo "✅ Artifact Validator — sdd_init has no existing feature prerequisites"
  exit 0
fi
specky_require_feature_context || exit $?
LATEST="$SPECKY_FEATURE_DIR"

FEATURE="${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"
echo "📄 Artifact Validator — $FEATURE — before $TOOL"

check_exists() {
  local file="$1" label="$2" fix="$3"
  if [ ! -f "$LATEST/$file" ]; then
    echo "🚫 Missing $label ($LATEST/$file)"
    echo "   Fix: $fix"
    FAILS=$((FAILS+1))
  else
    echo "  ✅ $label"
  fi
}

check_content() {
  local file="$1" pattern="$2" label="$3"
  if [ -f "$LATEST/$file" ]; then
    if ! grep -qE "$pattern" "$LATEST/$file" 2>/dev/null; then
      echo "  ⚠️  $label — content check failed"
    fi
  fi
}

case "$TOOL" in
  sdd_init)
    echo "  ✅ No prerequisites for sdd_init"
    ;;
  sdd_discover|sdd_research|sdd_import_transcript)
    check_exists "CONSTITUTION.md" "CONSTITUTION.md" "Run @specky-sdd-init or /specky-greenfield"
    ;;
  sdd_clarify|sdd_validate_ears)
    check_exists "CONSTITUTION.md" "CONSTITUTION.md" "Run @specky-sdd-init"
    ;;
  sdd_write_spec|sdd_turnkey_spec|sdd_figma_to_spec)
    check_exists "CONSTITUTION.md" "CONSTITUTION.md" "Run @specky-sdd-init"
    ;;
  sdd_write_design|sdd_generate_all_diagrams|sdd_generate_diagram|sdd_figma_diagram)
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run @specky-spec-engineer or /specky-specify"
    check_content "SPECIFICATION.md" "REQ-[A-Z]+-[0-9]+" "EARS requirements with REQ-IDs"
    ;;
  sdd_write_tasks|sdd_checklist)
    check_exists "DESIGN.md" "DESIGN.md" "Run @specky-design-architect or /specky-design"
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run /specky-specify first"
    ;;
  sdd_implement|sdd_generate_tests|sdd_generate_pbt)
    check_exists "TASKS.md" "TASKS.md" "Run @specky-task-planner or /specky-tasks"
    check_exists "DESIGN.md" "DESIGN.md" "Run /specky-design first"
    ;;
  sdd_verify_tests|sdd_verify_tasks|sdd_check_sync)
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run /specky-specify"
    check_exists "TASKS.md" "TASKS.md" "Run /specky-tasks"
    ;;
  sdd_run_analysis|sdd_cross_analyze)
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run /specky-specify"
    check_exists "DESIGN.md" "DESIGN.md" "Run /specky-design"
    check_exists "TASKS.md" "TASKS.md" "Run /specky-tasks"
    ;;
  sdd_compliance_check)
    if ! specky_has_capability "compliance"; then
      echo "🚫 Compliance capability is not enabled by $SPECKY_CONTRACT_ID"
      FAILS=$((FAILS+1))
    fi
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run /specky-specify"
    check_exists "DESIGN.md" "DESIGN.md" "Run /specky-design"
    ;;
  sdd_create_pr|sdd_export_work_items)
    check_exists "ANALYSIS.md" "ANALYSIS.md" "Run @specky-quality-reviewer"
    check_exists "VERIFICATION.md" "VERIFICATION.md" "Run @specky-test-verifier"
    ;;
  sdd_generate_all_docs|sdd_generate_docs|sdd_generate_api_docs|sdd_generate_runbook|sdd_generate_onboarding)
    check_exists "SPECIFICATION.md" "SPECIFICATION.md" "Run /specky-specify"
    check_exists "DESIGN.md" "DESIGN.md" "Run /specky-design"
    ;;
  *)
    echo "  ✅ No artifact prerequisites for $TOOL"
    ;;
esac

if [ "$FAILS" -gt 0 ]; then
  echo ""
  echo "❌ Artifact validation FAILED ($FAILS missing). Cannot run $TOOL."
  exit 2
fi

echo "✅ Artifacts validated for $TOOL"
exit 0
