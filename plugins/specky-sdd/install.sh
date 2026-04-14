#!/bin/bash
set -euo pipefail

VERSION="3.2.2"
REPO="paulasilvatech/specky"
BRANCH="main"
PLUGIN_PATH="plugins/specky-sdd"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Specky SDD v${VERSION} — VS Code + Copilot       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

REPO_DIR="$(pwd)"
P="$REPO_DIR/.github/plugin/specky"
CLEANUP_TMP=0

# Detect if running via curl pipe (BASH_SOURCE points to /dev/fd/*)
# or locally from within the specky repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd 2>/dev/null || echo "/dev/fd")"

if [[ "$SCRIPT_DIR" == /dev/fd* ]] || [[ "$SCRIPT_DIR" == /proc/* ]] || [[ ! -d "$SCRIPT_DIR/agents" ]]; then
  # Running via curl — download from GitHub
  echo "📥 Downloading plugin from GitHub..."
  TMP_SRC=$(mktemp -d)
  CLEANUP_TMP=1
  git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$TMP_SRC/repo" 2>/dev/null
  S="$TMP_SRC/repo/$PLUGIN_PATH"
  if [ ! -d "$S/agents" ]; then
    echo "❌ Failed to download plugin from GitHub"
    rm -rf "$TMP_SRC"
    exit 1
  fi
  echo "✅ Downloaded"
else
  # Running locally — use script's directory
  S="$SCRIPT_DIR"
  # If S and P overlap, use a temp copy
  if [ "$(cd "$S" && pwd)" = "$(cd "$P" 2>/dev/null && pwd)" ] 2>/dev/null; then
    TMP_SRC=$(mktemp -d)
    cp -r "$S/." "$TMP_SRC/"
    S="$TMP_SRC"
    CLEANUP_TMP=1
  fi
fi

cleanup() { [ "${CLEANUP_TMP:-0}" = "1" ] && rm -rf "$TMP_SRC" 2>/dev/null || true; }
trap cleanup EXIT

PASS=0; FAIL=0; FAILS=()
check() {
  if [ -e "$REPO_DIR/$2" ]; then
    echo "  ✅ $1"; PASS=$((PASS+1))
  else
    echo "  ❌ $1"; FAIL=$((FAIL+1)); FAILS+=("$2")
  fi
}

# ─── Create directories ───
echo "📁 Creating .github/plugin/specky/..."
mkdir -p "$P/agents" "$P/hooks/scripts" "$P/prompts" "$P/instructions"
mkdir -p "$P/skills/sdd-pipeline/references"
mkdir -p "$P/skills/implementer" "$P/skills/test-verifier"
mkdir -p "$P/skills/release-engineer" "$P/skills/research-analyst"
mkdir -p "$P/skills/sdd-markdown-standard"
mkdir -p "$REPO_DIR/.vscode"

# ─── Agents ───
echo "🤖 Installing 7 agents..."
cp "$S/agents/"*.agent.md "$P/agents/"

# ─── Prompts ───
echo "💬 Installing 19 prompts..."
cp "$S/prompts/"*.prompt.md "$P/prompts/"

# ─── Skills ───
echo "🧠 Installing 6 skills..."
cp -r "$S/skills/"* "$P/skills/"

# ─── Hooks ───
echo "🪝 Installing 10 hooks..."
cp "$S/hooks/scripts/"*.sh "$P/hooks/scripts/"
chmod +x "$P/hooks/scripts/"*.sh
cp "$S/hooks/sdd-hooks.json" "$P/hooks/"

# ─── Config + Instructions ───
echo "⚙️  Installing config..."
cp "$S/config.yml" "$P/"
cp "$S/instructions/copilot-instructions.md" "$P/instructions/"

# ─── Plugin metadata ───
echo "📋 Installing plugin metadata..."
cp "$S/GETTING-STARTED.md" "$P/"
cp "$S/LICENSE" "$P/"

# ─── VS Code ───
echo "🔌 Installing VS Code config..."
mkdir -p "$REPO_DIR/.vscode"

# Write .vscode/mcp.json with correct mcpServers key
cat > "$REPO_DIR/.vscode/mcp.json" << 'MCPEOF'
{
  "mcpServers": {
    "specky-sdd": {
      "command": "npx",
      "args": ["-y", "specky-sdd@latest"],
      "env": {
        "SDD_WORKSPACE": "${workspaceFolder}"
      },
      "tools": ["*"]
    }
  }
}
MCPEOF

if [ -f "$REPO_DIR/.vscode/settings.json" ]; then
  echo "   ⚠️  Merging into existing settings.json..."
  python3 -c "
import json, sys
try:
  with open('$REPO_DIR/.vscode/settings.json') as f: existing = json.load(f)
except: existing = {}
with open('$S/settings.json') as f: new = json.load(f)
existing.update(new)
with open('$REPO_DIR/.vscode/settings.json', 'w') as f: json.dump(existing, f, indent=2)
" 2>/dev/null || cp "$S/settings.json" "$REPO_DIR/.vscode/settings.json"
else
  cp "$S/settings.json" "$REPO_DIR/.vscode/settings.json"
fi

# ─── Verify ───
echo ""
echo "🔍 Verifying..."

echo "  Agents:"
check "sdd-init" ".github/plugin/specky/agents/sdd-init.agent.md"
check "requirements-engineer" ".github/plugin/specky/agents/requirements-engineer.agent.md"
check "research-analyst" ".github/plugin/specky/agents/research-analyst.agent.md"
check "sdd-clarify" ".github/plugin/specky/agents/sdd-clarify.agent.md"
check "implementer" ".github/plugin/specky/agents/implementer.agent.md"
check "test-verifier" ".github/plugin/specky/agents/test-verifier.agent.md"
check "release-engineer" ".github/plugin/specky/agents/release-engineer.agent.md"

echo "  Prompts:"
check "specky-greenfield" ".github/plugin/specky/prompts/specky-greenfield.prompt.md"
check "specky-brownfield" ".github/plugin/specky/prompts/specky-brownfield.prompt.md"
check "pipeline-status" ".github/plugin/specky/prompts/specky-pipeline-status.prompt.md"

echo "  Skills:"
check "sdd-pipeline" ".github/plugin/specky/skills/sdd-pipeline/SKILL.md"
check "ears-notation ref" ".github/plugin/specky/skills/sdd-pipeline/references/ears-notation.md"
check "implementer skill" ".github/plugin/specky/skills/implementer/SKILL.md"

echo "  Hooks:"
check "security-scan" ".github/plugin/specky/hooks/scripts/security-scan.sh"
check "release-gate" ".github/plugin/specky/hooks/scripts/release-gate.sh"
check "spec-sync" ".github/plugin/specky/hooks/scripts/spec-sync.sh"
check "sdd-hooks.json" ".github/plugin/specky/hooks/sdd-hooks.json"

echo "  Config:"
check "config.yml" ".github/plugin/specky/config.yml"
check "copilot-instructions" ".github/plugin/specky/instructions/copilot-instructions.md"

echo "  Plugin files:"
check "GETTING-STARTED" ".github/plugin/specky/GETTING-STARTED.md"
check "LICENSE" ".github/plugin/specky/LICENSE"

echo "  VS Code:"
check "mcp.json (vscode)" ".vscode/mcp.json"
check "settings.json" ".vscode/settings.json"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Passed: $PASS"
[ "$FAIL" -gt 0 ] && echo "  ❌ Failed: $FAIL"
echo "════════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🎉 Specky SDD installed!"
  echo ""
  echo "  .github/plugin/specky/"
  echo "  ├── agents/          (7)"
  echo "  ├── prompts/         (19)"
  echo "  ├── skills/          (6)"
  echo "  ├── hooks/scripts/   (10)"
  echo "  ├── instructions/"
  echo "  ├── config.yml"
  echo "  ├── mcp.json"
  echo "  ├── LICENSE"
  echo "  ├── GETTING-STARTED.md"
  echo "  └── install.sh"
  echo ""
  echo "  Open Copilot Chat → @workspace /specky-greenfield"
  echo ""
else
  echo ""
  echo "⚠️  Failed files:"
  for f in "${FAILS[@]}"; do echo "   - $f"; done
fi
