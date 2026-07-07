#!/bin/bash
# release-gate.sh — Verify VERIFICATION.md + 90% pass rate before PR
# Target: Claude Code (.claude/hooks/)
# Type: BLOCKING (exit 2) | Trigger: before sdd_create_pr | Phase: 9
# Paper: arXiv:2601.03878 — human-in-loop gate

set -euo pipefail
FAILS=0

echo "🚦 Release Gate Check"

# Branch validation (advisory — warning only)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "⚠️  WARNING: You are on 'main'. Spec work should be on spec/NNN-* branches."
  echo "   Expected flow: spec/NNN-* → develop → stage → main"
elif [[ "$CURRENT_BRANCH" == "develop" ]] || [[ "$CURRENT_BRANCH" == "stage" ]]; then
  echo "ℹ️  Branch: $CURRENT_BRANCH (integration/release branch)"
elif [[ "$CURRENT_BRANCH" == spec/* ]]; then
  echo "ℹ️  Branch: $CURRENT_BRANCH (spec branch → PR targets develop)"
else
  echo "⚠️  WARNING: Branch '$CURRENT_BRANCH' does not follow naming convention."
  echo "   Expected: spec/NNN-feature-name, develop, stage, or main"
fi
echo ""

# Find active feature
LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
[ -z "$LATEST" ] && { echo "❌ No .specs/ directory found"; exit 2; }

# VERIFICATION.md must exist
if [ ! -f "$LATEST/VERIFICATION.md" ]; then
  echo "🚫 Missing VERIFICATION.md in $LATEST — run /sdd:test first"
  FAILS=$((FAILS+1))
fi

# CHECKLIST.md must exist
if [ ! -f "$LATEST/CHECKLIST.md" ]; then
  echo "🚫 Missing CHECKLIST.md in $LATEST — run /sdd:implement first"
  FAILS=$((FAILS+1))
fi

# Pass rate >= 90%
if [ -f "$LATEST/VERIFICATION.md" ]; then
  RATE=$(grep -oE 'pass_rate:[[:space:]]*"?([0-9]+(\.[0-9]+)?)"?' "$LATEST/VERIFICATION.md" | grep -oE '[0-9.]+' | head -1 || echo "0")
  if [ -n "$RATE" ]; then
    PASS=$(echo "$RATE >= 90" | bc -l 2>/dev/null || echo "0")
    if [ "$PASS" -eq 0 ]; then
      echo "🚫 Test pass rate ${RATE}% < 90% — fix failing tests"
      FAILS=$((FAILS+1))
    fi
  fi
fi

if [ "$FAILS" -gt 0 ]; then
  echo ""
  echo "❌ Release gate FAILED ($FAILS issues). Cannot create PR."
  exit 2  # BLOCKING
fi

echo "✅ Release gate passed."
exit 0
