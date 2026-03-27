#!/bin/bash
# Hook: spec-sync (PostToolUse: Edit|Write)
# Detects when spec-referenced source files are modified.
# Warns if a file referenced in spec artifacts is changed without sync check.

# Read tool input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"//')

# Skip if no file path or if it's a spec/checkpoint file
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.specs/*|*.checkpoints/*|*.sdd-state.json|*/templates/*|*/hooks/*)
    exit 0
    ;;
esac

# Only check source code files
case "$FILE_PATH" in
  *.ts|*.py|*.js|*.java|*.cs|*.go|*.rs|*.rb|*.php)
    ;;
  *)
    exit 0
    ;;
esac

# Check if this file is referenced in any spec artifact
SPEC_DIR=".specs"
if [ -d "$SPEC_DIR" ]; then
  BASENAME=$(basename "$FILE_PATH")
  REFERENCED=$(grep -rl "$BASENAME" "$SPEC_DIR" --include="*.md" 2>/dev/null | head -1)
  if [ -n "$REFERENCED" ]; then
    echo "SPEC-SYNC WARNING: '$BASENAME' is referenced in $REFERENCED" >&2
    echo "Run sdd_check_sync to verify spec-code alignment before proceeding." >&2
  fi
fi

# Always check for drift indicator
if [ -d "$SPEC_DIR" ]; then
  SPEC_COUNT=$(find "$SPEC_DIR" -name "*.md" -newer "$FILE_PATH" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SPEC_COUNT" -gt 0 ]; then
    echo "DRIFT ALERT: $SPEC_COUNT spec file(s) are newer than modified source. Consider running sdd_check_sync." >&2
  fi
fi

exit 0
