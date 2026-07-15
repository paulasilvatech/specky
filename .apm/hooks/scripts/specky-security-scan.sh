#!/usr/bin/env bash
# specky-security-scan.sh — Contract-aware release security checks.
# Type: BLOCKING (exit 2) | Trigger: before release operations.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/specky-contract-context.bash"
specky_require_feature_context || exit $?

if [ "${SPECKY_RELEASE_ENABLED:-0}" != "1" ]; then
  echo "🚫 Security scan requires the release capability." >&2
  exit 2
fi

FAILS=0
echo "🔒 Security Scan — ${SPECKY_FEATURE_NUMBER}-${SPECKY_FEATURE_NAME} ($SPECKY_CONTRACT_ID)"

PATTERNS='AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{48}|sk-ant-[a-zA-Z0-9-]{90}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|xox[bpors]-[a-zA-Z0-9-]+|sk_live_[a-zA-Z0-9]{24}'
FOUND=$(git grep -nE "$PATTERNS" -- ':!*.lock' ':!.specs/**' 2>/dev/null || true)
if [ -n "$FOUND" ]; then
  echo "🚫 Hardcoded credential patterns found in tracked files:"
  echo "$FOUND" | head -10
  FAILS=$((FAILS+1))
fi

TRACKED_ENV=$(git ls-files '.env' '.env.*' 2>/dev/null || true)
if [ -n "$TRACKED_ENV" ]; then
  echo "🚫 Environment secret files are tracked:"
  echo "$TRACKED_ENV"
  FAILS=$((FAILS+1))
fi

case "${SPECKY_DEV_LANGUAGE:-}" in
  TypeScript|JavaScript)
    if [ -f package-lock.json ] && command -v npm >/dev/null 2>&1; then
      AUDIT=$(npm audit --json 2>/dev/null || true)
      CRITICAL=$(printf '%s' "$AUDIT" | node -e 'let x="";process.stdin.on("data",d=>x+=d).on("end",()=>{try{const j=JSON.parse(x);console.log(j.metadata?.vulnerabilities?.critical??0)}catch{console.log(0)}})')
      if [ "$CRITICAL" -gt 0 ]; then
        echo "🚫 npm audit reports $CRITICAL critical vulnerabilities"
        FAILS=$((FAILS+1))
      fi
    fi
    ;;
  Python)
    if [ -f requirements.txt ] && command -v pip-audit >/dev/null 2>&1; then
      if ! pip-audit -r requirements.txt --strict; then
        echo "🚫 pip-audit reports vulnerabilities"
        FAILS=$((FAILS+1))
      fi
    fi
    ;;
  Go)
    if [ -f go.mod ] && command -v govulncheck >/dev/null 2>&1; then
      if ! govulncheck ./...; then
        echo "🚫 govulncheck reports reachable vulnerabilities"
        FAILS=$((FAILS+1))
      fi
    fi
    ;;
esac

if [ "${SPECKY_COMPLIANCE_ENABLED:-0}" = "1" ] && [ ! -f "$SPECKY_FEATURE_DIR/COMPLIANCE.md" ]; then
  echo "🚫 Configured compliance frameworks lack COMPLIANCE.md evidence: $SPECKY_COMPLIANCE_FRAMEWORKS"
  FAILS=$((FAILS+1))
fi

if [ "$FAILS" -gt 0 ]; then
  echo "❌ Security scan failed with $FAILS issue(s)."
  exit 2
fi

echo "✅ Contract-aware security scan passed."
