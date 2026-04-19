#!/bin/bash
# pipeline-guard.sh — Enforce Rule #8: all work flows through @specky-orchestrator.
# Target: Claude Code (.claude/hooks/) + GitHub Copilot (.github/hooks/specky/)
# Type: BLOCKING (exit 2) | Trigger: UserPromptSubmit
# Phase: any — runs on every user prompt when .specs/ has an active pipeline
#
# Behavior:
#   • If no .specs/ OR no active .sdd-state.json → exit 0 (pipeline-guard OFF).
#   • If SPECKY_GUARD=off env var is set → exit 0 with warning.
#   • If user prompt mentions orchestrator / onboarding / specky → exit 0.
#   • If user prompt looks like a free-form code/build/edit request → exit 2 (BLOCK).
#
# The user's prompt is read from stdin (Claude Code passes prompt as JSON on stdin)
# OR from env var $CLAUDE_USER_PROMPT (Copilot). We try both.
#
# Rule #8 (copilot-instructions.md): When .specs/ exists with an active pipeline,
# ALL work MUST flow through @specky-orchestrator.

set -euo pipefail

# ── Escape hatch ─────────────────────────────────────────
if [ "${SPECKY_GUARD:-on}" = "off" ]; then
  echo "⚠️  [pipeline-guard] SPECKY_GUARD=off — bypass allowed (deprecated, removed in v3.6)" >&2
  exit 0
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
if echo "$PROMPT_LC" | grep -qE '^(what|why|how|where|when|show|list|explain|describe|status|help)\b'; then
  exit 0
fi

# ── Blocklist: free-form code / build / edit requests ──
# Keywords that trigger when a pipeline is active
if echo "$PROMPT_LC" | grep -qE '\b(implement|create|build|write|code|fix|add|refactor|deploy|release|merge|commit|push|test|install|setup|configure)\b'; then
  echo "" >&2
  echo "🚫 [pipeline-guard] BLOCKED — active Specky pipeline detected" >&2
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
  echo "   Emergency bypass (logs warning, deprecated in v3.6):" >&2
  echo "     export SPECKY_GUARD=off" >&2
  echo "" >&2
  exit 2
fi

# Default: allow (ambiguous prompt — err on side of not blocking legitimate work)
exit 0
