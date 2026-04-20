# Installing Specky

> Works on macOS, Linux, Windows, and WSL. Requires Node.js ≥18.

Specky is distributed as a single npm package (`specky-sdd`) that bundles both the MCP server and all plugin assets (13 agents, 22 prompts, 8 skills, 16 hooks). A unified CLI (`specky`) handles install, validation, and upgrade.

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

# 2. Bootstrap each project
cd your-project
specky install          # `init` is the same — install is the alias
```

**After the global install, you never type `npx` or `npm` again for day-to-day Specky commands:**

```bash
specky install          # bootstrap .claude/, .github/, etc.
specky doctor           # validate integrity
specky status           # show pipeline state
specky upgrade          # refresh assets (preserves .specs/)
specky hooks list       # list hooks
```

That's it. The CLI auto-detects whether you use Claude Code, GitHub Copilot, or both, and installs the correct assets to `.claude/` and/or `.github/`.

**Next:** open Claude Code or VS Code and invoke `@specky-onboarding` (Copilot) or `/specky-onboarding` (Claude) to start the pipeline.

---

## Install modes — which one should I use?

| Mode | Command | When to use |
|---|---|---|
| **Global** (default) | `npm install -g specky-sdd` | Individual developers, CLI-first workflow, multiple projects. CLI always in PATH. |
| **Project-local** | `npm install --save-dev specky-sdd` | Teams that want version pinning via `package.json`. Reproducible across teammates. Use `npx specky` instead of `specky`. |
| **Zero-install** | `npx -y specky-sdd@latest init` | One-shot bootstrap, no persistent install. Downloads fresh each time. |
| **Offline** | `npm pack` + `npm install ./specky-sdd-*.tgz` | Air-gapped environments. |

**Both modes produce the same workspace layout** (`.claude/`, `.github/`, `.vscode/`, `.specky/`). The only difference is where the `specky` binary lives.

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
npx specky init
```

**Apple Silicon + Intel**: both supported. Node is universal2 via Homebrew.

### Linux (Ubuntu/Debian)

```bash
# Node via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git

cd your-project
npm install --save-dev specky-sdd@latest
npx specky init
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
npx specky init
```

### Windows Subsystem for Linux (WSL)

Treat as Linux. Install in the WSL workspace, not from the Windows host — otherwise paths get mangled.

```bash
# Inside WSL
sudo apt-get install -y nodejs git
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init
```

---

## Install modes

### Project-local (recommended)

```bash
npm install --save-dev specky-sdd@latest
npx specky init
```

Version pinned in `package.json`; reproducible across teammates.

### Global (individual use)

```bash
npm install -g specky-sdd@latest
cd your-project
specky init
```

### Zero-install

```bash
cd your-project
npx -y specky-sdd@latest init
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
npx specky init
```

### Claude Code native plugin

```
/plugin marketplace add paulasilvatech/specky
/plugin install specky@paulasilvatech
```

Reads `.claude-plugin/plugin.json` and produces the same `.claude/` layout as `specky init --ide=claude`.

### APM (Microsoft Agent Package Manager) — legacy

For teams already standardized on [APM](https://microsoft.github.io/apm/):

```bash
brew install microsoft/apm/apm     # macOS
# or see https://microsoft.github.io/apm/getting-started/installation/ for other OSes
apm install paulasilvatech/specky
```

APM downloads the package and delegates to `specky install` for file placement — so the resulting workspace layout is identical to the `npm install -g` path.

> **Note**: new projects should prefer the native CLI install (`npm install -g specky-sdd@latest` + `specky install`). APM is kept working for backward compatibility but is no longer the primary distribution channel as of v3.4.

---

## IDE-specific install

Force a specific target when you only use one IDE:

```bash
npx specky init --ide=claude      # only .claude/
npx specky init --ide=copilot     # only .github/ + .vscode/
npx specky init --ide=both        # default — install everything
npx specky init --ide=auto        # detect based on what's present
```

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

### `Denied by Pre-Tool Use hook: unexpected error` in Copilot Chat

You installed via v3.4.0-rc.10 or earlier, which shipped a Copilot hook manifest with unresolved `${CLAUDE_PLUGIN_ROOT}` paths. Copilot's hook executor failed to spawn hook scripts, denying every tool call. Fix:

```bash
npm install -g specky-sdd@latest   # pulls rc.12+ with fixed manifest
cd affected-project
specky install --force              # overwrites .github/hooks/specky/sdd-hooks.json
# Reload VS Code: Cmd+Shift+P → "Developer: Reload Window"
```

### Build-time bundling

If you vendor Specky into a monorepo, point `files` at the published tarball — Specky's `install.lock` uses relative paths and won't work correctly if files are moved.

---

## Security considerations

- **No network access at install time** beyond npm itself.
- Hook scripts are shell scripts — review `.apm/hooks/scripts/` before enabling hooks in security-sensitive environments.
- `specky doctor` verifies SHA256 of every installed file against the package manifest.
- For enterprise pilots, set `SPECKY_ENTERPRISE=1` (available in v3.5.0+) to force `audit_enabled`, `rbac`, and `rate_limit` on by default.

See `SECURITY.md` for the full threat model and reporting process.
