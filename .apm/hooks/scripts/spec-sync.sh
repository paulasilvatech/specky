#!/bin/bash
# spec-sync.sh — Detect spec-code drift
# Target: Claude Code (.claude/hooks/)
# Type: Advisory | Trigger: PostToolUse | Phase: 6
# Paper: arXiv:2602.20478 — anti-context-collapse
#
# Claude Code settings.json:
#   "hooks": { "PostToolUse": ["bash .claude/hooks/spec-sync.sh"] }

set -euo pipefail
SPECS_DIR=".specs"
[ -d "$SPECS_DIR" ] || exit 0

DRIFT=0
for dir in "$SPECS_DIR"/*/; do
  [ -f "$dir/SPECIFICATION.md" ] || continue
  REQS=$(grep -oE 'REQ-[A-Z]+-[0-9]+' "$dir/SPECIFICATION.md" 2>/dev/null | sort -u)
  for req in $REQS; do
    if ! grep -rq "$req" src/ tests/ test/ __tests__/ 2>/dev/null; then
      echo "⚠️  DRIFT: $req ($(basename "$dir")) — not found in code or tests"
      DRIFT=1
    fi
  done
done

[ "$DRIFT" -eq 1 ] && echo "📋 Run sdd_check_sync for details. If intentional, run sdd_amend."
exit 0
