# Installing Specky

> Works on macOS, Linux, Windows, and WSL. Requires Node.js ≥20.

Specky is distributed as a single npm package (`specky-sdd`) that bundles both the MCP server and all assets (13 agents, 22 prompts, 14 skills, 16 hooks). A unified CLI (`specky`) handles install, validation, and upgrade.

Specky includes its own APM governance commands (`specky apm ...`). Users do **not** need to install the Microsoft APM CLI to install or run Specky. See [Uso do APM pelo Specky](APM-USAGE.md) for the detailed package, CLI, MCP, and container model.

---

## Prerequisites

| Tool | Minimum | Check |
| --- | --- | --- |
| Node.js | 20.0.0 (current LTS) | `node --version` |
| npm | 9 (ships with Node 18+) | `npm --version` |
| git | 2.30+ | `git --version` |

---

## Quick install (recommended)

**Default recommendation: global CLI + per-project assets.** The CLI binary goes in your PATH (so `specky install` works from any project), and the agents/hooks/skills get copied per-project on first run.

```bash
# 1. Install the CLI globally (one time per machine)
npm install -g specky-sdd@latest

# 2. Bootstrap each project — choose your target harness:
cd your-project
specky install --target=copilot      # VS Code + GitHub Copilot (recommended)
specky install --target=claude       # Claude Code
specky install --target=cursor       # Cursor
specky install --target=opencode     # OpenCode
specky install --target=agent-skills # Shared .agents/skills bundle
```

> **Important:** Prefer `--target=...`. The legacy `--ide` flag still works for `copilot`, `claude`, `both`, and `auto`, but new installs should use APM-style targets. When Copilot is installed in the same workspace, Specky strips Claude hooks from `.claude/settings.json` to prevent Copilot cross-read blocks. See [Target-specific install](#target-specific-install) below.

**After the global install, you never type `npx` or `npm` again for day-to-day Specky commands:**

```bash
specky install          # bootstrap detected/default target assets
specky doctor           # validate integrity
specky status           # show pipeline state
specky upgrade          # refresh assets (preserves .specs/)
specky hooks list       # list hooks
```

That's it. The `--target` flag determines which harness-native assets are written.

**Next:** open your target IDE and start with `@specky-onboarding` or `/specky-onboarding` depending on the chat surface.

### Container runtime (hosted deployments)

Use npm for developer workstations and project bootstrapping. For hosted HTTP
deployments, use the published GHCR image instead of installing Node/npm on the
host:

```bash
docker pull ghcr.io/paulasilvatech/specky:latest        # or pin: :3.9.0
docker run --rm -p 3200:3200 ghcr.io/paulasilvatech/specky:latest
curl -s http://localhost:3200/health                    # -> {"status":"ok","version":"3.9.0"}
```

Production deployments should pin an explicit version tag and enable token auth
behind TLS. See [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md) for the
full container model, secrets layout, and private-package login guidance.

---

## Install modes — which one should I use?

| Mode | Command | When to use |
| --- | --- | --- |
| **Global** (default) | `npm install -g specky-sdd` | Individual developers, CLI-first workflow, multiple projects. CLI always in PATH. |
| **Project-local** | `npm install --save-dev specky-sdd` | Teams that want version pinning via `package.json`. Reproducible across teammates. Use `npx specky` instead of `specky`. |
| **Zero-install** | `npx -y specky-sdd@latest init` | One-shot bootstrap, no persistent install. Downloads fresh each time. |
| **Offline** | `npm pack` + `npm install ./specky-sdd-*.tgz` | Air-gapped environments. |

**Both modes produce the same target-specific workspace layout** (`.github/`, `.claude/`, `.cursor/`, `.opencode/`, `.agents/skills/`, and `.specky/` as applicable). The only difference is where the `specky` binary lives.

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
npx specky init --target=copilot
```

**Apple Silicon + Intel**: both supported. Node is universal2 via Homebrew.

### Linux (Ubuntu/Debian)

```bash
# Node via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git

cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --target=copilot
```

Alpine (musl libc) and other distros work the same as long as Node ≥20 is installed.

### Windows (PowerShell)

```powershell
# Node via winget (or download from nodejs.org)
winget install OpenJS.NodeJS.LTS

cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --target=copilot
```

Specky hooks run under Node (no bash required on Windows). Path separators are auto-normalized.

### Windows (cmd.exe)

```cmd
npm install --save-dev specky-sdd@latest
npx specky init --target=copilot
```

### Windows Subsystem for Linux (WSL)

Treat as Linux. Install in the WSL workspace, not from the Windows host — otherwise paths get mangled.

```bash
# Inside WSL
sudo apt-get install -y nodejs git
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init --target=copilot
```

---

## Install modes

### Project-local (recommended)

```bash
npm install --save-dev specky-sdd@latest
npx specky init --target=copilot
```

Version pinned in `package.json`; reproducible across teammates.

### Global (individual use)

```bash
npm install -g specky-sdd@latest
cd your-project
specky init --target=copilot
```

### Zero-install

```bash
cd your-project
npx -y specky-sdd@latest init --target=copilot
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
npx specky init --target=copilot
```

---

## Target-specific install

Prefer explicit targets so every developer and CI runner gets the same harness layout:

```bash
specky install --target=copilot      # VS Code + GitHub Copilot (recommended)
specky install --target=claude       # Claude Code only
specky install --target=cursor       # Cursor
specky install --target=opencode     # OpenCode
specky install --target=agent-skills # Shared .agents/skills only
```

`--ide=copilot`, `--ide=claude`, `--ide=both`, and `--ide=auto` remain as deprecated aliases for older scripts.

If Copilot is part of the selected target set (`copilot`, `both`, or `all`), Specky removes `hooks` from `.claude/settings.json`. This keeps VS Code Copilot from treating Claude lifecycle hooks as pre-tool hooks and blocking tool calls.

| Target | Install command | Assets location |
| --- | --- | --- |
| VS Code + Copilot | `specky install --target=copilot` | `.github/agents/`, `.github/prompts/`, `.github/skills/`, `.github/hooks/specky/`, `.vscode/` |
| Claude Code | `specky install --target=claude` | `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.claude/hooks/`, `.claude/settings.json` |
| Cursor | `specky install --target=cursor` | `.cursor/agents/`, `.cursor/commands/`, `.cursor/rules/specky-sdd.mdc`, `.cursor/hooks.json`, `.cursor/hooks/`, `.cursor/mcp.json`, `.agents/skills/` |
| OpenCode | `specky install --target=opencode` | `.opencode/agents/`, `.opencode/commands/`, `opencode.json`, `.agents/skills/` |
| Agent Skills | `specky install --target=agent-skills` | `.agents/skills/` |
| Legacy both | `specky install --target=both` | Copilot + Claude assets; Claude hooks are stripped for Copilot safety |

### Cursor first run

After `specky install --target=cursor`:

1. Open Cursor Settings → MCP and confirm the `specky` server is enabled.
2. Start an Agent chat and approve Specky MCP tools on first use, following your team policy.
3. Run `/specky-onboarding` or invoke `@specky-onboarding`.
4. Run `specky doctor` and confirm Cursor agents, commands, skills, rules, hooks, and MCP checks pass.

Cursor project skills intentionally install to `.agents/skills/{skill-name}/SKILL.md`. Do not move them to `.cursor/skills/`; `.cursor/agents/` stores personas, while `.agents/skills/` stores reusable playbooks.

### After clone for Cursor teams

Every developer should run this after cloning a project that uses Cursor:

```bash
specky install --target=cursor
specky doctor
```

This regenerates `.cursor/agents/`, `.cursor/commands/`, `.cursor/rules/`, `.cursor/hooks/`, and `.agents/skills/`. Keep `.specky/config.yml`, `.cursor/mcp.json`, and `.specs/` in git.

---

## Verification

After install, always run:

```bash
npx specky doctor
```

Expected: `✅ Install is healthy.` with every tracked file reported as OK.

If `doctor` reports drift:

```bash
npx specky doctor --fix
```

Repairs missing/corrupted files by re-running `init --force`.

---

## Upgrading

**How you learn about updates:**

- `specky doctor` and `specky status` warn (locally, no network) when your project's installed assets differ from the CLI version — run `specky upgrade` to resync.
- The CLI checks the npm registry at most once per day (after `install`, `doctor`, `status`, `upgrade`, or `--version`) and prints `Update available: vX → vY`. It fails silently offline, is disabled in CI (`CI=true`), never runs in `specky serve`, and can be turned off with `SPECKY_NO_UPDATE_CHECK=1` or `update_check: false` in `.specky/config.yml`.
- For release emails, use **Watch → Custom → Releases** on [GitHub](https://github.com/paulasilvatech/specky). Teams pinning per-project should let Renovate or Dependabot propose the `package.json` bump.

**How to upgrade:**

```bash
# Global install
npm install -g specky-sdd@latest && specky upgrade

# Project-local install
npm install --save-dev specky-sdd@latest && npx specky upgrade
```

`specky upgrade` refreshes the installed assets (agents, prompts, skills, hooks, configs) **and re-pins MCP registration files** (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, or `opencode.json`) to the new version — updating the npm package alone leaves the MCP registration pointing at the old version. It preserves `.specs/` (your active pipeline artifacts) and `.specky/profile.json` (onboarding answers).

---

## Uninstalling

```bash
# Remove installed assets
rm -rf .claude/agents .claude/commands .claude/skills .claude/hooks/scripts
rm -rf .github/agents .github/prompts .github/skills .github/hooks/specky
rm -rf .cursor/agents .cursor/commands .cursor/rules .cursor/hooks .cursor/hooks.json
rm -rf .opencode/agents .opencode/commands .agents/skills
rm .mcp.json .vscode/mcp.json .cursor/mcp.json opencode.json
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
4. Manually test: `bash .claude/hooks/scripts/specky-branch-validator.sh`.

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
npm install -g specky-sdd@latest   # pulls the latest (3.4.0+) with the Copilot fix
cd affected-project
specky install --force --target=copilot  # strips hooks from .claude/settings.json
# Reload VS Code: Cmd+Shift+P → "Developer: Reload Window"
```

The `--target=copilot` flag automatically removes hooks from `.claude/settings.json` to prevent cross-read. Legacy `--ide=copilot` does the same for older scripts.

### Build-time bundling

If you vendor Specky into a monorepo, point `files` at the published tarball — Specky's `install.lock` uses relative paths and won't work correctly if files are moved.

---

## Security considerations

- **No network access at install time** beyond npm itself and the CLI's once-daily update check against the npm registry (a single GET, no telemetry; disable with `SPECKY_NO_UPDATE_CHECK=1` or `update_check: false` in `.specky/config.yml`). The MCP server (`specky serve`) makes zero outbound calls.
- Hook scripts are shell scripts — review `.apm/hooks/scripts/` before enabling hooks in security-sensitive environments.
- `specky doctor` verifies SHA256 of every installed file against the package manifest.
- For enterprise deployments, enable the opt-in enterprise profile (v3.5.0+): `profile: enterprise` in `.specky/config.yml`, or `SPECKY_PROFILE=enterprise` / `SPECKY_ENTERPRISE=1` in the environment. It defaults `audit_enabled`, `rbac`, `rate_limit`, and `audit.fail_closed` to ON (explicit config values still win). Identity-based HTTP tokens and the tamper-evident audit trail are covered in [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md).

See `SECURITY.md` for the full threat model and reporting process.
