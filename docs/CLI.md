# Specky CLI Reference

> Version: v3.4.0+

The `specky` CLI is the single write-path for installing, validating, and upgrading Specky in a workspace. It replaces the previous ad-hoc copying done by APM and manual `.github/` / `.claude/` setup.

---

## Commands

### `specky install` (alias: `specky init`)

Install Specky assets (agents, prompts, skills, hooks) into the current workspace. `install` is the preferred spelling (matches `npm install` intuition); `init` remains as an alias and dispatches to the same implementation.

```
specky install [--ide=<claude|copilot|both|auto>] [--force] [--dry-run]
specky init    [--ide=<claude|copilot|both|auto>] [--force] [--dry-run]   # alias
```

| Flag | Default | Description |
|---|---|---|
| `--ide` | `auto` | Target IDE. `auto` detects based on workspace signals. |
| `--force` | false | Overwrite existing files. Required to re-install over an existing layout. |
| `--dry-run` | false | Show what would be written without modifying the filesystem. |

**What it writes:**

- `.claude/agents/*.md` (13 files) — when `ide=claude` or `both`
- `.claude/commands/*.md` (22 slash commands)
- `.claude/skills/*/SKILL.md` (8 skills)
- `.claude/hooks/scripts/*.sh` (16 hook scripts, executable — adds `pipeline-guard.sh` + `session-banner.sh` on top of the 14 phase hooks)
- `.claude/settings.json` — deep-merged:
  - `hooks` section (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop)
  - `permissions.allow` auto-populated with native tools (`Read`, `Edit`, `Write`, `Bash(git:*)`, `Bash(npm:*)`, etc.) and all `mcp__specky__*` tools — prevents per-invocation approval prompts
- `.claude/rules/copilot-instructions.md`
- `.mcp.json` — MCP server registration
- `.github/agents/*.agent.md` (13 files) — when `ide=copilot` or `both`
- `.github/prompts/*.prompt.md` (22)
- `.github/skills/*/SKILL.md` (8)
- `.github/hooks/specky/scripts/*.sh` (14)
- `.github/hooks/specky/sdd-hooks.json`
- `.github/instructions/copilot-instructions.instructions.md`
- `.vscode/mcp.json` — MCP server registration for Copilot
- `.vscode/settings.json` — deep-merged with:
  - `chat.mcp.enabled: true`
  - `chat.mcp.discovery.enabled: true`
  - `chat.agent.enabled: true`
  - `github.copilot.chat.codeGeneration.useInstructionFiles: true`
- `.specky/config.yml` — project pipeline config
- `.specky/install.lock` — SHA256 manifest of every installed file
- `.specky/install.json` — install metadata (version, ide, timestamp)

Never overwrites `.specs/`, `.specky/profile.json`, or existing user-authored keys in `settings.json`.

**Why `.vscode/settings.json` auto-config matters:**
Without `chat.mcp.enabled` and `chat.mcp.discovery.enabled`, GitHub Copilot in VS Code won't discover the Specky MCP server even if `.vscode/mcp.json` is correct. Users previously had to manually toggle tools in the Copilot Chat tool selector — now it Just Works.

**Why Claude `permissions.allow` matters:**
Claude Code asks for approval each time an agent invokes a tool unless the tool is pre-authorized via `permissions.allow`. Specky's agents need `Read`, `Write`, `Bash`, `mcp__specky__*`, etc. The CLI pre-authorizes them so pipeline work doesn't get interrupted by prompts.

---

### `specky doctor`

Validate install integrity against `.specky/install.lock`.

```
specky doctor [--fix] [--verbose]
```

| Flag | Description |
|---|---|
| `--fix` | Re-run `init --force` to restore missing or modified files |
| `--verbose` | List every tracked file (not just failures) |

**Exit codes:**
- `0` — healthy install (all checksums match)
- `1` — drift detected (user may have modified files); non-destructive
- `2` — install missing or lockfile absent

---

### `specky status`

Summarize install + pipeline state.

```
specky status
```

Shows version, IDE targets, asset counts per target, and any active features in `.specs/`.

---

### `specky upgrade`

Refresh installed assets to the current package version while preserving `.specs/` and `.specky/profile.json`.

```
specky upgrade
```

Internally runs `init --force` with the IDE target read from `.specky/install.json`.

---

### `specky hooks`

Inspect and test installed hooks.

```
specky hooks list              # list all installed hook scripts
specky hooks test              # run every hook in current workspace
specky hooks run <name>        # run a single hook by name
```

Useful for debugging why a hook did or did not fire.

---

### `specky serve`

Start the MCP server.

```
specky serve [--http] [--port=<N>]
```

| Flag | Description |
|---|---|
| `--http` | Use HTTP streaming transport instead of stdio |
| `--port` | HTTP port (default: 3001) |

This is the canonical replacement for `npx specky-sdd`. The legacy `specky-sdd` bin still works (it delegates to `specky serve`).

---

## Invocation patterns

### Project-local (recommended for teams)

```bash
npm install --save-dev specky-sdd@latest
npx specky init
```

Pins the version in `package.json` — reproducible across teammates.

### Global install

```bash
npm install -g specky-sdd@latest
specky init
```

Convenient for individual use; version not pinned per project.

### Zero install via npx

```bash
npx -y specky-sdd@latest init
```

No prior install required. Each invocation downloads fresh.

### Legacy compatibility

Existing MCP configs using `npx -y specky-sdd` (no subcommand) still work — they are routed to `specky serve` automatically.

---

## Environment variables

| Var | Effect |
|---|---|
| `SDD_WORKSPACE` | Override the workspace root (default: `process.cwd()`) |
| `SPECKY_DEBUG=1` | Print full error stacks |
| `PORT` | HTTP port for `specky serve --http` (default: 3001) |

---

## Exit code conventions

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Advisory failure (drift, warnings) |
| 2 | Hard failure (install missing, invalid args, blocking hook failed) |

`specky init` always exits 0 on success, even if individual files were skipped due to user edits (use `--force` to override).
