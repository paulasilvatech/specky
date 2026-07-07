#!/bin/bash
# security-scan.sh — OWASP + secrets scan
# Target: Claude Code (.claude/hooks/)
# Type: BLOCKING (exit 2) | Trigger: Stop | Phase: 9
# Paper: arXiv:2503.23278 — security enforcement
#
# Claude Code settings.json:
#   "hooks": { "Stop": ["bash .claude/hooks/security-scan.sh"] }

set -euo pipefail
FAILS=0

echo "🔒 Security Scan"

# Hardcoded secrets
PATTERNS='AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{48}|sk-ant-[a-zA-Z0-9-]{90}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|xox[bpors]-[a-zA-Z0-9-]+|sk_live_[a-zA-Z0-9]{24}'
FOUND=$(grep -rnE "$PATTERNS" src/ tests/ test/ --include="*.ts" --include="*.js" --include="*.py" --include="*.json" --include="*.yml" --include="*.env" 2>/dev/null || true)
if [ -n "$FOUND" ]; then
  echo "🚫 HARDCODED SECRETS FOUND:"
  echo "$FOUND" | head -10
  FAILS=$((FAILS+1))
fi

# .env in tracked files
if git ls-files --error-unmatch .env .env.local .env.production 2>/dev/null; then
  echo "🚫 .env file tracked in git — add to .gitignore"
  FAILS=$((FAILS+1))
fi

# npm audit (if package.json exists)
if [ -f "package.json" ] && command -v npm &>/dev/null; then
  AUDIT=$(npm audit --json 2>/dev/null | grep -o '"critical":[0-9]*' | head -1 || true)
  CRITICAL=$(echo "$AUDIT" | grep -oE '[0-9]+' || echo "0")
  if [ "$CRITICAL" -gt 0 ]; then
    echo "🚫 npm audit: $CRITICAL critical vulnerabilities"
    FAILS=$((FAILS+1))
  fi
fi

# pip audit (if requirements.txt exists)
if [ -f "requirements.txt" ] && command -v pip-audit &>/dev/null; then
  if ! pip-audit -r requirements.txt --strict 2>/dev/null; then
    echo "🚫 pip-audit: vulnerabilities found"
    FAILS=$((FAILS+1))
  fi
fi

if [ "$FAILS" -gt 0 ]; then
  echo ""
  echo "❌ Security scan FAILED ($FAILS issues). Fix before release."
  exit 2  # BLOCKING
fi

echo "✅ Security scan passed."
exit 0
