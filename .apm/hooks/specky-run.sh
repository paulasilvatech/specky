#!/usr/bin/env bash
# specky-run.sh - Cursor hook adapter -> Specky hook scripts.
set -euo pipefail

SCRIPT="${1:?usage: specky-run.sh <script-name> [--blocking]}"
BLOCKING="${2:-}"
HOOK=".cursor/hooks/scripts/${SCRIPT}"
INPUT=$(cat || true)

if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  RAW=$(echo "$INPUT" | jq -r '
    .tool_name // .toolName // .tool // .mcpTool // .mcp_tool // .name // empty
  ' 2>/dev/null || true)
  case "$RAW" in
    mcp__specky__*) export SDD_TOOL_NAME="${RAW#mcp__specky__}" ;;
    MCP:*|*mcp__specky__*) export SDD_TOOL_NAME="$(echo "$RAW" | sed -n 's/.*sdd_/sdd_/p')" ;;
    Write|Edit|MultiEdit) export SDD_TOOL_NAME="$RAW" ;;
  esac

  PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // .text // empty' 2>/dev/null || true)
  [ -n "$PROMPT" ] && export CLAUDE_USER_PROMPT="$PROMPT"
fi

set +e
bash "$HOOK"
CODE=$?
set -e

if [ "$BLOCKING" = "--blocking" ] && [ "$CODE" -eq 2 ]; then
  echo '{"permission":"deny","user_message":"Specky quality gate blocked this action."}'
fi
exit "$CODE"