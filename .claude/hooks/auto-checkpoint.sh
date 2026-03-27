#!/bin/bash
# Hook: auto-checkpoint (PostToolUse: Edit|Write)
# Suggests creating a checkpoint when spec artifacts are modified.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only trigger for spec artifacts
case "$FILE_PATH" in
  *CONSTITUTION.md|*SPECIFICATION.md|*DESIGN.md|*TASKS.md|*ANALYSIS.md|*CHECKLIST.md|*VERIFICATION.md)
    ARTIFACT=$(basename "$FILE_PATH")
    echo "CHECKPOINT REMINDER: $ARTIFACT was modified." >&2
    echo "Consider running sdd_checkpoint to create a safety snapshot before further changes." >&2
    ;;
esac

exit 0
