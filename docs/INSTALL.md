# Installing Specky

> Works on macOS, Linux, Windows, and WSL. Requires Node.js ≥18.

Specky is distributed as a single npm package (`specky-sdd`) that bundles both the MCP server and all assets (13 agents, 22 prompts, 8 skills, 16 hooks). A unified CLI (`specky`) handles install, validation, and upgrade.

---

## Prerequisites

| Tool | Minimum | Check |
|---|---|---|
| Node.js | 20.0.0 (current LTS) | `node --version` |
| npm | 9 (ships with Node 18+) | `npm --version` |
| git | 2.30+ | `git --version` |

---

## Quick install (recommended)

**Default recommendation: global CLI + per-project assets.** The CLI binary goes in your PATH (so `specky install` works from any project), and the agents/hooks/skills get copied per-project on first run.

```bash
# 1. Install the CLI globally (one time per machine)
npm install -g specky-sdd@latest

# 2. Bootstrap each project — choose your IDE:
cd your-project
specky install --ide=copilot   # VS Code + GitHub Copilot (recommended)
specky install --ide=claude    # Claude Code
```

> **Important:** Always specify `--ide=copilot` or `--ide=claude`. The default `--ide=auto` installs for both IDEs, which causes hook cross-read conflicts (Copilot reads `.claude/settings.json` hooks and blocks tool calls). See [IDE-specific install](#ide-specific-install) below.

**After the global install, you never type `npx` or `npm` again for day-to-day Specky commands:**

```bash
specky install          # bootstrap .claude/, .github/, etc.
specky doctor           # validate integrity
specky status           # show pipeline state
specky upgrade          # refresh assets (preserves .specs/)
specky hooks list       # list hooks
```

That's it. The `--ide` flag determines whether assets go to `.github/` (Copilot) or `.claude/` (Claude Code).

**Next:** open VS Code and invoke `@specky-onboarding` (Copilot) or open Claude Code and use `/specky-onboarding` to start the pipeline.

---

## Install modes — which one should I use?

| Mode | Command | When to use |
|---|---|---|
| **Global** (default) | `npm install -g specky-sdd` | Individual developers, CLI-first workflow, multiple projects. CLI always in PATH. |
| **Project-local** | `npm install --save-dev specky-sdd` | Teams that want version pinning via `package.json`. Reproducible across teammates. Use `npx specky` instead of `specky`. |
| **Zero-install** | `npx -y specky-sdd@latest init` | One-shot bootstrap, no persistent install. Downloads fresh each time. |
| **Offline** | `npm pack` + `npm install ./specky-sdd-*.tgz` | Air-gapped environments. |

**Both modes produce the same workspace layout** (`.github/` for Copilot or `.claude/` for Claude Code, plus `.vscode/` and `.specky/`). The only difference is where the `specky` binary lives.

**Rule of thumb**:
- If you maintain many projects → **global**
- If your team needs reproducible builds → **project-local**
- If in doubt → **global** (easier; you can always switch later)

---

## Per-OS walkthroughs

### macOS

```bash
# Homebrew Node (recommended)
brew install node
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

**Apple Silicon + Intel**: both supported. Node is universal2 via Homebrew.

### Linux (Ubuntu/Debian)

```bash
# Node via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git

cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

Alpine (musl libc) and other distros work the same as long as Node ≥18 is installed.

### Windows (PowerShell)

```powershell
# Node via winget (or download from nodejs.org)
winget install OpenJS.NodeJS.LTS

cd your-project
npm install --save-dev specky-sdd@latest
npx specky init
```

Specky hooks run under Node (no bash required on Windows). Path separators are auto-normalized.

### Windows (cmd.exe)

```cmd
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

### Windows Subsystem for Linux (WSL)

Treat as Linux. Install in the WSL workspace, not from the Windows host — otherwise paths get mangled.

```bash
# Inside WSL
sudo apt-get install -y nodejs git
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

---

## Install modes

### Project-local (recommended)

```bash
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

Version pinned in `package.json`; reproducible across teammates.

### Global (individual use)

```bash
npm install -g specky-sdd@latest
cd your-project
specky init --ide=copilot
```

### Zero-install

```bash
cd your-project
npx -y specky-sdd@latest init --ide=copilot
```

No prior setup. Each invocation downloads the latest.

### Offline / air-gapped

On an internet-connected machine:

```bash
npm pack specky-sdd@latest
# produces specky-sdd-<version>.tgz
```

Transfer the tarball to the air-gapped machine, then:

```bash
cd your-project
npm install ./specky-sdd-<version>.tgz
npx specky init --ide=copilot
```

---

## IDE-specific install

Always specify your target IDE explicitly to avoid hook cross-read conflicts:

```bash
specky install --ide=copilot     # VS Code + GitHub Copilot (recommended)
specky install --ide=claude      # Claude Code only
```

> **⚠️ Do NOT use `--ide=both`** unless you understand the implications: VS Code Copilot reads `.claude/settings.json` hooks, which can cause "Blocked by Pre-Tool Use hook" errors. If you must support both IDEs in the same workspace, use `--ide=copilot` (the hooks are stripped from `.claude/settings.json` automatically).

| IDE | Install command | Assets location |
|---|---|---|
| VS Code + Copilot | `specky install --ide=copilot` | `.github/agents/`, `.github/prompts/`, `.github/skills/`, `.github/hooks/specky/`, `.vscode/` |
| Claude Code | `specky install --ide=claude` | `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.claude/hooks/`, `.claude/settings.json` |
| Both (not recommended) | `specky install --ide=both` | Both locations — may cause Copilot hook conflicts |

---

## Verification

After install, always run:

```bash
npx specky doctor
```

Expected: `✅ Install is healthy.` with `121 OK` (for `--ide=both`).

If `doctor` reports drift:

```bash
npx specky doctor --fix
```

Repairs missing/corrupted files by re-running `init --force`.

---

## Upgrading

```bash
npm install --save-dev specky-sdd@latest
npx specky upgrade
```

Preserves `.specs/` (your active pipeline artifacts) and `.specky/profile.json` (onboarding answers). Assets, hooks, and configs are refreshed.

---

## Uninstalling

```bash
# Remove installed assets
rm -rf .claude/agents .claude/commands .claude/skills .claude/hooks/scripts
rm -rf .github/agents .github/prompts .github/skills .github/hooks/specky
rm .mcp.json .vscode/mcp.json
rm -rf .specky

# Remove npm package
npm uninstall specky-sdd
```

`.specs/` (pipeline artifacts) is preserved by default — delete manually if you want a clean slate.

---

## Troubleshooting

### `specky: command not found`

You installed globally but the global npm bin directory is not in your `$PATH`.

- macOS/Linux: add `$(npm bin -g)` to your shell rc.
- Windows: restart the shell after install; npm automatically adds its bin dir on install.

Alternative: use `npx specky` instead of `specky`.

### `Hooks are not firing in Claude Code`

1. Restart the Claude Code session — hooks are loaded on session start.
2. Check `.claude/settings.json` contains a `hooks` section with `mcp__specky__` prefixes.
3. Run `npx specky doctor --verbose` to confirm hook files are present.
4. Manually test: `bash .claude/hooks/scripts/branch-validator.sh`.

### `settings.json hooks is empty {}`

You installed via a version < v3.4.0 which had a broken APM integration that left `.claude/settings.json` without hooks. Fix:

```bash
npm install -g specky-sdd@latest   # update CLI to 3.4+
specky install --force              # rewrite settings.json with hooks + permissions
specky doctor                       # verify
```

### `Blocked by Pre-Tool Use hook` in Copilot Chat

This occurs when Copilot reads hooks from `.claude/settings.json`. Fix:

```bash
npm install -g specky-sdd@latest   # pulls rc.14+ with Copilot fix
cd affected-project
specky install --force --ide=copilot  # strips hooks from .claude/settings.json
# Reload VS Code: Cmd+Shift+P → "Developer: Reload Window"
```

The `--ide=copilot` flag automatically removes hooks from `.claude/settings.json` to prevent cross-read.

### Build-time bundling

If you vendor Specky into a monorepo, point `files` at the published tarball — Specky's `install.lock` uses relative paths and won't work correctly if files are moved.

---

## Security considerations

- **No network access at install time** beyond npm itself.
- Hook scripts are shell scripts — review `.apm/hooks/scripts/` before enabling hooks in security-sensitive environments.
- `specky doctor` verifies SHA256 of every installed file against the package manifest.
- For enterprise pilots, set `SPECKY_ENTERPRISE=1` (available in v3.5.0+) to force `audit_enabled`, `rbac`, and `rate_limit` on by default.

See `SECURITY.md` for the full threat model and reporting process.
