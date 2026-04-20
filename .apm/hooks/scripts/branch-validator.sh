#!/bin/bash
# branch-validator.sh — Validate git branch matches expected pattern for current tool.
#
# Type: Mixed (see below) | Trigger: PreToolUse | All phases
#   • Advisory (exit 0, warn) for sdd_* pipeline tools (always).
#   • For native edit tools (Write|Edit|MultiEdit) on a wrong branch during
#     an active pipeline:
#       - default (SPECKY_GUARD unset OR "off"/"advisory") → warn, exit 0
#       - SPECKY_GUARD=strict                              → exit 2 (BLOCK)
#
# Rationale (rc.13): rc.10-rc.12 defaulted Write|Edit|MultiEdit to BLOCKING,
# which burned pilots who run `specky init` and then edit anything from
# develop/main. Enforcement is now explicit opt-in.

set -euo pipefail

TOOL="${SDD_TOOL_NAME:-unknown}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '\n' || true)
[ -z "$CURRENT_BRANCH" ] && CURRENT_BRANCH="unknown"

# Mode selection (rc.13): strict = block, anything else = advisory.
SPECKY_GUARD_MODE="${SPECKY_GUARD:-advisory}"
if [ "$SPECKY_GUARD_MODE" = "off" ]; then
  SPECKY_GUARD_MODE="advisory"
fi

# ── Branch enforcement for native edit tools when pipeline is active ──
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" || "$TOOL" == "MultiEdit" ]]; then
  LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
  if [ -z "$LATEST" ]; then exit 0; fi
  STATE="$LATEST/.sdd-state.json"
  if [ ! -f "$STATE" ]; then exit 0; fi

  PHASE="?"
  if command -v jq >/dev/null 2>&1; then
    PHASE=$(jq -r '.phase // "?"' "$STATE" 2>/dev/null || echo "?")
  fi

  FEATURE=$(basename "$LATEST")

  emit_violation() {
    local expected="$1"
    if [ "$SPECKY_GUARD_MODE" = "strict" ]; then
      echo "" >&2
      echo "🚫 [branch-validator] BLOCKED — $TOOL on '$CURRENT_BRANCH' (phase $PHASE expects $expected) [SPECKY_GUARD=strict]" >&2
      echo "   Feature:  $FEATURE" >&2
      echo "   Fix:      git checkout $expected   (or: git checkout -b spec/$FEATURE)" >&2
      echo "   Disable:  unset SPECKY_GUARD" >&2
      exit 2
    fi
    echo "⚠️  [branch-validator] $TOOL on '$CURRENT_BRANCH' during phase $PHASE (expected $expected). Enforce with: export SPECKY_GUARD=strict" >&2
  }

  case "$PHASE" in
    0|1|2|3|4|5|6|7)
      if [[ "$CURRENT_BRANCH" != spec/* ]]; then
        emit_violation "spec/$FEATURE"
      fi
      ;;
    8)
      if [[ "$CURRENT_BRANCH" != "develop" ]]; then
        emit_violation "develop"
      fi
      ;;
    9)
      if [[ "$CURRENT_BRANCH" != "stage" ]]; then
        emit_violation "stage"
      fi
      ;;
  esac
  exit 0
fi

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
