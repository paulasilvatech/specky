#!/usr/bin/env bash
# specky-release-gate.sh — Verify persisted release and TDD policy before PR payload generation.
# Type: BLOCKING (exit 2) | Trigger: before release operations.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/specky-contract-context.bash"
specky_require_feature_context || exit $?

FAILS=0
echo "🚦 Release Gate — ${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"

if [ "${SPECKY_RELEASE_ENABLED:-0}" != "1" ]; then
  echo "🚫 Release capability is not enabled by $SPECKY_CONTRACT_ID"
  FAILS=$((FAILS+1))
fi
if [ "${SPECKY_GATE_DECISION:-}" != "APPROVE" ]; then
  echo "🚫 Analysis gate is '${SPECKY_GATE_DECISION:-none}', expected APPROVE"
  FAILS=$((FAILS+1))
fi
if [ ! -f "$SPECKY_FEATURE_DIR/ANALYSIS.md" ]; then
  echo "🚫 Missing ANALYSIS.md"
  FAILS=$((FAILS+1))
fi
if [ ! -f "$SPECKY_FEATURE_DIR/VERIFICATION.md" ]; then
  echo "🚫 Missing VERIFICATION.md"
  FAILS=$((FAILS+1))
fi

if [ "${SPECKY_TDD_ENABLED:-0}" = "1" ] && [ -f "$SPECKY_FEATURE_DIR/VERIFICATION.md" ]; then
  RATE=$(grep -m1 -oE '\*\*Pass Rate\*\*:[[:space:]]*[0-9]+([.][0-9]+)?%' "$SPECKY_FEATURE_DIR/VERIFICATION.md" | grep -oE '[0-9]+([.][0-9]+)?' || true)
  if [ -z "$RATE" ]; then
    echo "🚫 VERIFICATION.md does not contain a parseable Pass Rate"
    FAILS=$((FAILS+1))
  elif ! node -e 'process.exit(Number(process.argv[1]) >= Number(process.argv[2]) ? 0 : 1)' "$RATE" "$SPECKY_TDD_THRESHOLD"; then
    echo "🚫 Verification pass rate ${RATE}% is below contracted threshold ${SPECKY_TDD_THRESHOLD}%"
    FAILS=$((FAILS+1))
  else
    echo "  ✅ Verification pass rate ${RATE}% meets ${SPECKY_TDD_THRESHOLD}%"
  fi
fi

EXPECTED_BRANCH="${SPECKY_BRANCH_PREFIX}${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "⚠️  Current branch '$CURRENT_BRANCH' differs from persisted release head '$EXPECTED_BRANCH'"
fi

if [ "$FAILS" -gt 0 ]; then
  echo "❌ Release gate failed with $FAILS issue(s)."
  exit 2
fi

echo "✅ Release gate passed for base '$SPECKY_BASE_BRANCH'."
