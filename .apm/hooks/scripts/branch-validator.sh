#!/bin/bash
# branch-validator.sh — Validate git branch matches expected pattern for current tool
# Type: Advisory (exit 0) | Trigger: PreToolUse | All phases
# Warns if branch doesn't match Gitflow-SDD convention; never blocks

set -euo pipefail

TOOL="${SDD_TOOL_NAME:-unknown}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo "🔀 Branch Validator — $CURRENT_BRANCH — before $TOOL"

warn() {
  echo "⚠️  $1"
  echo "   Expected: $2"
}

case "$TOOL" in
  sdd_init|sdd_create_branch)
    # Init should happen on develop (about to create spec branch)
    if [[ "$CURRENT_BRANCH" != "develop" ]] && [[ "$CURRENT_BRANCH" != spec/* ]]; then
      warn "sdd_init typically runs on 'develop' before creating a spec branch" "develop"
    fi
    ;;
  sdd_write_spec|sdd_turnkey_spec|sdd_figma_to_spec|sdd_write_design|sdd_write_tasks|sdd_implement|sdd_generate_tests|sdd_generate_pbt|sdd_generate_iac|sdd_generate_dockerfile)
    # Spec work must be on spec/* branch
    if [[ "$CURRENT_BRANCH" != spec/* ]]; then
      warn "Spec work should be on a spec/NNN-* branch, not '$CURRENT_BRANCH'" "spec/NNN-feature-name"
      echo "   Flow: spec/NNN-* → develop → stage → main"
    fi
    ;;
  sdd_discover|sdd_research|sdd_import_document|sdd_import_transcript|sdd_clarify|sdd_validate_ears)
    # Research/clarify on spec branch
    if [[ "$CURRENT_BRANCH" != spec/* ]]; then
      warn "Research and clarification should be on a spec/NNN-* branch" "spec/NNN-feature-name"
    fi
    ;;
  sdd_verify_tests|sdd_verify_tasks|sdd_check_sync)
    # Verification on spec branch
    if [[ "$CURRENT_BRANCH" != spec/* ]]; then
      warn "Verification should be on a spec/NNN-* branch" "spec/NNN-feature-name"
    fi
    ;;
  sdd_run_analysis|sdd_cross_analyze|sdd_compliance_check)
    # Review on develop (after merge from spec)
    if [[ "$CURRENT_BRANCH" != "develop" ]] && [[ "$CURRENT_BRANCH" != spec/* ]]; then
      warn "Review tools typically run on 'develop' after merge from spec" "develop"
    fi
    ;;
  sdd_create_pr)
    # PR: branch determines target
    if [[ "$CURRENT_BRANCH" == spec/* ]]; then
      echo "  ℹ️  spec branch → PR will target develop"
    elif [[ "$CURRENT_BRANCH" == "develop" ]]; then
      echo "  ℹ️  develop → PR will target stage"
    elif [[ "$CURRENT_BRANCH" == "stage" ]]; then
      echo "  ℹ️  stage → PR will target main"
    elif [[ "$CURRENT_BRANCH" == "main" ]]; then
      warn "Cannot create PR from main — nothing to merge" "spec/*, develop, or stage"
    fi
    ;;
  *)
    echo "  ✅ No branch requirement for $TOOL"
    ;;
esac

# Always exit 0 — advisory only
exit 0
