#!/bin/bash
# session-banner.sh — Show Specky pipeline status at session start.
# Target: Claude Code + GitHub Copilot
# Type: Advisory (exit 0 always) | Trigger: SessionStart
#
# Prints a one-screen banner whenever the user opens a new session so they
# immediately see which feature and phase are active. Helps avoid the SIFAP
# incident where a user bypassed the pipeline because they didn't realize
# one was running.

set -euo pipefail

SPECS_DIR=".specs"
[ -d "$SPECS_DIR" ] || exit 0

# Find most recently touched feature
LATEST=$(ls -td "$SPECS_DIR"/*/ 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  exit 0
fi

STATE="$LATEST/.sdd-state.json"
if [ ! -f "$STATE" ]; then
  exit 0
fi

FEATURE=$(basename "$LATEST")
PHASE="?"
if command -v jq >/dev/null 2>&1; then
  PHASE=$(jq -r '.phase // "?"' "$STATE" 2>/dev/null || echo "?")
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '\n' || true)
[ -z "$BRANCH" ] && BRANCH="unknown"

echo ""
echo "╭─────────────────────────────────────────────────────────────╮"
echo "│ 🧭 Specky Pipeline Active                                    │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│ Feature:  %-50s│\n" "$FEATURE"
printf "│ Phase:    %-50s│\n" "$PHASE"
printf "│ Branch:   %-50s│\n" "$BRANCH"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ Resume:   @specky-orchestrator (Copilot)                     │"
echo "│           /specky-orchestrate (Claude Code)                  │"
echo "│ Status:   specky status  (or npx specky status)             │"
echo "│ New work: @specky-onboarding                                 │"
echo "╰─────────────────────────────────────────────────────────────╯"
echo ""

# Validate branch matches expected for phase (advisory warning only)
case "$PHASE" in
  0|1|2|3|4|5|6|7)
    if [[ ! "$BRANCH" =~ ^spec/ ]]; then
      echo "⚠️  [session-banner] Phase $PHASE expects branch spec/NNN-* — you are on '$BRANCH'"
      echo "    Consider: git checkout -b spec/$FEATURE (or let @specky-orchestrator handle it)"
      echo ""
    fi
    ;;
  8)
    if [ "$BRANCH" != "develop" ]; then
      echo "⚠️  [session-banner] Phase 8 expects branch 'develop' — you are on '$BRANCH'"
      echo ""
    fi
    ;;
  9)
    if [ "$BRANCH" != "stage" ]; then
      echo "⚠️  [session-banner] Phase 9 expects branch 'stage' — you are on '$BRANCH'"
      echo ""
    fi
    ;;
esac

exit 0
