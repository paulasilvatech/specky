#!/bin/bash
# Hook: security-scan (Stop)
# Scans for hardcoded secrets in modified files.
# EXIT CODE 2 = BLOCK (secrets detected)

# Get modified files from git
MODIFIED=$(git diff --name-only --cached 2>/dev/null)
if [ -z "$MODIFIED" ]; then
  MODIFIED=$(git diff --name-only 2>/dev/null)
fi

if [ -z "$MODIFIED" ]; then
  exit 0
fi

SECRETS_FOUND=0
SECRET_FILES=""

while IFS= read -r file; do
  [ -f "$file" ] || continue

  # Skip binary files and spec files
  case "$file" in
    *.png|*.jpg|*.gif|*.ico|*.woff*|*.ttf|*.eot|*.pdf|*.zip|*.tar*|*.gz)
      continue
      ;;
    *.specs/*|*.checkpoints/*)
      continue
      ;;
  esac

  # Scan for secret patterns
  if grep -qE "(api[_-]?key|secret[_-]?key|password|token|credential|private[_-]?key|aws_access|aws_secret)\s*[:=]\s*[\"'][^\s\"']{8,}" "$file" 2>/dev/null; then
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
    SECRET_FILES="$SECRET_FILES\n  - $file"
  fi
done <<< "$MODIFIED"

if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo "SECURITY SCAN FAILED: Potential secrets detected in $SECRETS_FOUND file(s):" >&2
  echo -e "$SECRET_FILES" >&2
  echo "" >&2
  echo "Action required: Remove hardcoded secrets and use environment variables or a secrets manager." >&2
  exit 2
fi

echo "Security scan passed: no secrets detected in modified files." >&2
exit 0
