#!/usr/bin/env bash
# specky-branch-validator.sh — Validate persisted release branch policy.
# Type: advisory by default; strict for native edits when SPECKY_GUARD=strict.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/specky-contract-context.bash"

TOOL="${SDD_TOOL_NAME:-unknown}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '\n' || true)
[ -z "$CURRENT_BRANCH" ] && CURRENT_BRANCH="unknown"

specky_load_contract_context || exit $?
if [ "${SPECKY_CONTEXT_ACTIVE:-0}" != "1" ]; then
  echo "ℹ️  Branch Validator — no explicit feature context; no branch inferred."
  exit 0
fi
if [ "${SPECKY_RELEASE_ENABLED:-0}" != "1" ]; then
  echo "ℹ️  Branch Validator — release capability disabled by $SPECKY_CONTRACT_ID."
  exit 0
fi

EXPECTED_FEATURE_BRANCH="${SPECKY_BRANCH_PREFIX}${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"
EXPECTED="$EXPECTED_FEATURE_BRANCH"
if [ "$TOOL" = "sdd_create_branch" ]; then
  EXPECTED="$SPECKY_BASE_BRANCH"
fi

if [ "$CURRENT_BRANCH" = "$EXPECTED" ]; then
  echo "✅ Branch Validator — $CURRENT_BRANCH matches persisted release policy."
  exit 0
fi

MESSAGE="branch '$CURRENT_BRANCH' does not match persisted release policy '$EXPECTED' for $TOOL"
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" || "$TOOL" == "MultiEdit" ]] && [ "${SPECKY_GUARD:-advisory}" = "strict" ]; then
  echo "🚫 [specky-branch-validator] BLOCKED — $MESSAGE" >&2
  exit 2
fi

echo "⚠️  [specky-branch-validator] $MESSAGE" >&2
echo "   Contract: $SPECKY_CONTRACT_ID" >&2
echo "   Base: $SPECKY_BASE_BRANCH | Prefix: $SPECKY_BRANCH_PREFIX" >&2
echo "   Enforce native edits with: export SPECKY_GUARD=strict" >&2
exit 0
