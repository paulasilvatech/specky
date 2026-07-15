#!/usr/bin/env bash
# specky-session-banner.sh — Show explicit feature context or workspace-level status guidance.
# Type: Advisory | Trigger: SessionStart.

set -euo pipefail
[ -n "${CLAUDE_PROJECT_DIR:-}" ] || exit 0
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/specky-contract-context.bash"
specky_load_contract_context || exit $?

if [ "${SPECKY_CONTEXT_ACTIVE:-0}" != "1" ]; then
  if [ -d .specs ]; then
    echo "🧭 Specky workspace detected. No feature selected; run 'specky status' and resume with explicit spec_dir + feature_number."
  fi
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '\n' || true)
[ -n "$BRANCH" ] || BRANCH="unknown"

echo ""
echo "🧭 Specky Feature Context"
echo "   Feature:  ${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"
echo "   Contract: $SPECKY_CONTRACT_ID"
echo "   Phase:    $SPECKY_PHASE"
echo "   Branch:   $BRANCH"
echo "   Resume:   @specky-orchestrator or /specky-orchestrate"
if [ "${SPECKY_RELEASE_ENABLED:-0}" = "1" ]; then
  echo "   Release:  head=${SPECKY_BRANCH_PREFIX}${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME} base=$SPECKY_BASE_BRANCH"
fi
