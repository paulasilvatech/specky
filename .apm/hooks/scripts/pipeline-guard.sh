#!/bin/bash
# pipeline-guard.sh — Remind about Rule #8: all work flows through @specky-orchestrator.
# Target: Claude Code (.claude/hooks/) + GitHub Copilot (.github/hooks/specky/)
# Type: ADVISORY by default (warn, exit 0) | Trigger: UserPromptSubmit
# Phase: any — runs on every user prompt when .specs/ has an active pipeline
#
# Behavior (rc.13 — flipped polarity after field incident):
#   • If no .specs/ OR no active .sdd-state.json → exit 0 silently.
#   • Default (SPECKY_GUARD unset OR "off"/"advisory") → print warning, exit 0.
#   • Only when SPECKY_GUARD=strict → exit 2 (BLOCK) on free-form edit prompts.
#
# Rationale: rc.10-rc.12 defaulted this to BLOCKING, which fired on every
# developer prompt containing common words (create, add, fix, test, install…).
# Copilot surfaced every block as "Blocked by Pre-Tool Use hook", making the
# IDE unusable. Enforcement is now explicit opt-in until the UX for
# resuming/routing through @specky-orchestrator is polished.
#
# The user's prompt is read from stdin (Claude Code passes prompt as JSON on stdin)
# OR from env var $CLAUDE_USER_PROMPT (Copilot). We try both.
#
# Rule #8 (copilot-instructions.md): When .specs/ exists with an active pipeline,
# ALL work MUST flow through @specky-orchestrator.

set -euo pipefail

# ── Mode selection ───────────────────────────────────────
# strict  → block free-form edit prompts (exit 2)
# advisory|off|<unset> → warn only (exit 0)
SPECKY_GUARD_MODE="${SPECKY_GUARD:-advisory}"
if [ "$SPECKY_GUARD_MODE" = "off" ]; then
  # Back-compat alias: treat explicit "off" as advisory (still warn).
  SPECKY_GUARD_MODE="advisory"
fi

# ── Check if pipeline is active ──────────────────────────
LATEST=$(ls -td .specs/*/ 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  exit 0
fi

STATE="$LATEST/.sdd-state.json"
if [ ! -f "$STATE" ]; then
  exit 0
fi

FEATURE=$(basename "$LATEST")

# Try to read current phase (optional — requires jq)
PHASE="?"
if command -v jq >/dev/null 2>&1; then
  PHASE=$(jq -r '.phase // "?"' "$STATE" 2>/dev/null || echo "?")
fi

# ── Extract user prompt ──────────────────────────────────
# Claude Code sends the prompt as JSON on stdin: {"prompt": "..."}
# Copilot uses $CLAUDE_USER_PROMPT. Fall back to empty.
PROMPT=""
if [ -n "${CLAUDE_USER_PROMPT:-}" ]; then
  PROMPT="$CLAUDE_USER_PROMPT"
elif [ ! -t 0 ]; then
  # Read from stdin non-blocking
  if command -v jq >/dev/null 2>&1; then
    PROMPT=$(jq -r '.prompt // .user_prompt // ""' 2>/dev/null || cat || true)
  else
    PROMPT=$(cat 2>/dev/null || true)
  fi
fi

# Lowercase for matching
PROMPT_LC=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]' 2>/dev/null || true)

# ── Allowlist: orchestrator / onboarding / specky commands ──
if echo "$PROMPT_LC" | grep -qE '(@specky-|@sdd-|/specky-|/sdd-|specky-orchestrator|specky-onboarding|specky init|specky doctor|specky status|specky upgrade|specky hooks)'; then
  exit 0
fi

# ── Allowlist: pure informational / read-only ──
# Word-boundary emulated with POSIX char classes for BSD/GNU portability.
if echo "$PROMPT_LC" | grep -qE '^(what|why|how|where|when|show|list|explain|describe|status|help)([^a-z0-9]|$)'; then
  exit 0
fi

# ── Edit-intent detection ──
# Keywords that hint at free-form code/build/edit requests when a pipeline is active.
# Pattern: keyword must be preceded and followed by a non-alphanumeric (or bounds).
if echo "$PROMPT_LC" | grep -qE '(^|[^a-z0-9])(implement|create|build|write|code|fix|add|refactor|deploy|release|merge|commit|push|test|install|setup|configure)([^a-z0-9]|$)'; then
  if [ "$SPECKY_GUARD_MODE" = "strict" ]; then
    echo "" >&2
    echo "🚫 [pipeline-guard] BLOCKED — active Specky pipeline detected (SPECKY_GUARD=strict)" >&2
    echo "" >&2
    echo "   Feature:    $FEATURE" >&2
    echo "   Phase:      $PHASE" >&2
    echo "   State:      $STATE" >&2
    echo "" >&2
    echo "   Rule #8 (copilot-instructions.md): ALL work must flow through @specky-orchestrator." >&2
    echo "" >&2
    echo "   What to do:" >&2
    echo "     • Resume:   invoke @specky-orchestrator (Copilot) or /specky-orchestrate (Claude)" >&2
    echo "     • Status:   npx specky status" >&2
    echo "     • Help:     invoke @specky-onboarding (Copilot) or /specky-onboarding (Claude)" >&2
    echo "" >&2
    echo "   Disable enforcement (default):" >&2
    echo "     unset SPECKY_GUARD      # or: export SPECKY_GUARD=advisory" >&2
    echo "" >&2
    exit 2
  fi

  # Advisory mode (default): warn but allow.
  echo "⚠️  [pipeline-guard] active Specky pipeline ($FEATURE, phase $PHASE) — consider routing through @specky-orchestrator." >&2
  echo "   Enforce blocking with: export SPECKY_GUARD=strict" >&2
fi

# Default: allow.
exit 0
