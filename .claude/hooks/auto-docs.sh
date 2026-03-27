#!/bin/bash
# Hook: auto-docs (PostToolUse: Edit|Write)
# Tracks source file modifications and recommends doc updates.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"//')

# Skip non-source files
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.specs/*|*.checkpoints/*|*/node_modules/*|*/dist/*|*/test*|*/hooks/*|*.md)
    exit 0
    ;;
esac

case "$FILE_PATH" in
  *.ts|*.py|*.js|*.java|*.cs|*.go|*.rs|*.tsx|*.jsx)
    ;;
  *)
    exit 0
    ;;
esac

# Track modification
TRACKER=".specs/.doc-tracker.json"

if [ ! -f "$TRACKER" ]; then
  echo '{"modified_files":[],"last_doc_gen":null}' > "$TRACKER" 2>/dev/null
fi

# Count modified files since last doc generation
MOD_COUNT=0
if [ -f "$TRACKER" ]; then
  MOD_COUNT=$(grep -o '"file"' "$TRACKER" 2>/dev/null | wc -l | tr -d ' ')
fi

if [ "$MOD_COUNT" -ge 3 ]; then
  echo "AUTO-DOCS: $((MOD_COUNT + 1)) source files modified since last documentation generation." >&2
  echo "Recommendation: Run sdd_generate_docs or sdd_generate_all_docs to update project documentation." >&2
fi

exit 0
