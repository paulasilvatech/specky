# Specky CLI Reference

> Version: v3.7.3+

The `specky` CLI is the single write-path for installing, validating, and upgrading Specky in a workspace. It replaces the previous ad-hoc copying done by APM and manual `.github/` / `.claude/` setup.

---

## Commands

### `specky install` (alias: `specky init`)

Install Specky assets (agents, prompts, skills, hooks) into the current workspace. `install` is the preferred spelling (matches `npm install` intuition); `init` remains as an alias and dispatches to the same implementation. Starting in v3.7.3, the installer generates platform-native primitives for the selected IDE instead of copying one shared syntax into both environments.

```
specky install [--ide=<claude|copilot|both|auto>] [--force] [--dry-run]
specky init    [--ide=<claude|copilot|both|auto>] [--force] [--dry-run]   # alias
```

| Flag | Default | Description |
|---|---|---|
| `--ide` | `auto` | Target IDE. **Recommended: always specify `copilot` or `claude` explicitly.** `auto` detects based on workspace signals but may default to `both`, which causes hook cross-read conflicts. |
| `--force` | false | Overwrite existing files. Required to re-install over an existing layout. |
| `--dry-run` | false | Show what would be written without modifying the filesystem. |

**What it writes (depends on `--ide` flag):**

When `--ide=copilot`:
- `.github/agents/*.agent.md` (13 files)
- `.github/prompts/*.prompt.md` (22)
- `.github/skills/*/SKILL.md` (8)
- `.github/hooks/specky/scripts/*.sh` (16 hook scripts)
- `.github/hooks/specky/sdd-hooks.json` — Copilot-specific manifest (no `SessionStart`/`UserPromptSubmit`, only `sdd_*` PreToolUse matchers)
- `.github/instructions/copilot-instructions.instructions.md`
- `.vscode/mcp.json` — MCP server registration for Copilot
- `.vscode/settings.json` — deep-merged with `chat.mcp.enabled`, `chat.agent.enabled`, etc.
- If `.claude/settings.json` exists, **strips the `hooks` section** to prevent Copilot cross-read

The installed Copilot agents use GitHub Copilot-native tool identifiers such as `search`, `agent`, and namespaced Specky MCP tools like `specky/sdd_get_status`. Prompt files use `agent: agent` frontmatter so VS Code runs them with agent-mode tool access.

When `--ide=claude`:
- `.claude/agents/*.md` (13 files)
- `.claude/commands/*.md` (22 slash commands)
- `.claude/skills/*/SKILL.md` (8 skills)
- `.claude/hooks/scripts/*.sh` (16 hook scripts)
- `.claude/settings.json` — deep-merged:
  - `hooks` section (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop)
  - `permissions.allow` auto-populated with native tools (`Read`, `Edit`, `Write`, `Bash(git:*)`, etc.) and all `mcp__specky__*` tools
- `.claude/rules/copilot-instructions.md`
- `.mcp.json` — MCP server registration

The installed Claude agents use Claude-native tool identifiers such as `Read`, `Glob`, `Grep`, `Task`, and Specky MCP tools like `mcp__specky__sdd_get_status`. Claude slash commands omit Copilot-only `agent:` frontmatter.

Both modes also write:
- `.specky/config.yml` — project pipeline config
- `.specky/install.lock` — SHA256 manifest of every installed file
- `.specky/install.json` — install metadata (version, ide, timestamp)

Never overwrites `.specs/`, `.specky/profile.json`, or existing user-authored keys in `settings.json`.

**Why `.vscode/settings.json` auto-config matters:**
Without `chat.mcp.enabled` and `chat.mcp.discovery.enabled`, GitHub Copilot in VS Code won't discover the Specky MCP server even if `.vscode/mcp.json` is correct. Users previously had to manually toggle tools in the Copilot Chat tool selector — now it Just Works.

**Why Claude `permissions.allow` matters:**
Claude Code asks for approval each time an agent invokes a tool unless the tool is pre-authorized via `permissions.allow`. Specky's Claude agents need read/search tools, scoped git/npm/npx shell commands, workspace edit tools, and `mcp__specky__*`. The CLI pre-authorizes that least-privilege set so pipeline work does not get interrupted by repeated prompts.

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

Internally runs `init --force` with the IDE target read from `.specky/install.json`. This also re-pins `.mcp.json` / `.vscode/mcp.json` to the new version — updating the npm package alone leaves the MCP registration pointing at the old pinned server.

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

### `specky apm`

Validate and govern Specky's APM package metadata and primitive integrity. These commands operate on the package source (`apm.yml`, `apm-policy.yml`, `apm.lock.yaml`, and `.apm/`) and are intended for maintainers, CI, and enterprise governance.

```bash
specky apm validate      # validate apm.yml against package.json and primitive paths
specky apm lock          # write apm.lock.yaml with SHA256 per primitive
specky apm verify-lock   # diff current primitives against apm.lock.yaml
specky apm policy        # enforce apm-policy.yml governance rules
specky apm audit         # run the primitive frontmatter/tool audit
specky apm sbom          # emit a CycloneDX SBOM for packaged primitives
```

The APM layer does not replace `specky install`; it governs what `specky install` consumes. The normal flow is:

1. Maintain canonical primitives under `.apm/`.
2. Run `specky apm validate`, `specky apm policy`, and `specky apm verify-lock` in CI.
3. Run `specky install --ide=copilot` or `specky install --ide=claude` to generate platform-native assets.

`apm.lock.yaml` pins the primitive hashes shipped in the package. `apm-policy.yml` enforces MCP allowlists, allowed hook events, and per-harness tool-name isolation.

For the detailed architecture, including why APM is not a runtime proxy and why Specky users do not need the external Microsoft APM CLI, see [Uso do APM pelo Specky](APM-USAGE.md).

---

### `specky serve`

Start the MCP server.

```
specky serve [--http] [--port=<N>] [--host=<addr>] [--profile=<standard|enterprise>]
```

| Flag | Description |
|---|---|
| `--http` | Use HTTP streaming transport instead of stdio |
| `--port` | HTTP port (default: 3200) |
| `--host` | HTTP bind address (default: `127.0.0.1`; set `0.0.0.0` only behind an auth proxy) |
| `--profile` | Config profile; `enterprise` defaults audit/RBAC/rate-limit to ON (explicit config.yml values win) |

Set `SDD_HTTP_TOKEN` (shared token) or `SDD_HTTP_TOKENS_FILE` (named tokens → principal + RBAC role) to require an `Authorization: Bearer <token>` header on `/mcp` requests. HTTP binds to loopback by default and rejects cross-origin (DNS-rebinding) requests. Full enterprise setup: [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md).

This is the canonical replacement for `npx specky-sdd`. The legacy `specky-sdd` bin still works (it delegates to `specky serve`).

---

## Invocation patterns

### Project-local (recommended for teams)

```bash
npm install --save-dev specky-sdd@latest
npx specky init --ide=copilot
```

Pins the version in `package.json` — reproducible across teammates.

### Global install

```bash
npm install -g specky-sdd@latest
specky init --ide=copilot
```

Convenient for individual use; version not pinned per project.

### Zero install via npx

```bash
npx -y specky-sdd@latest init --ide=copilot
```

No prior install required. Each invocation downloads fresh.

### Legacy compatibility

Existing MCP configs using `npx -y specky-sdd` (no subcommand) still work — they are routed to `specky serve` automatically.

---

## Update notifications

The CLI surfaces new versions in two layers:

1. **Version drift warning (always on, zero network).** `specky doctor` and `specky status` warn when the assets installed in the workspace differ from the version of the CLI running them, and suggest `specky upgrade`. The MCP server prints the same warning at startup. This is a local version comparison — no network involved.
2. **Update banner (once daily).** After `install`/`init`, `doctor`, `status`, `upgrade`, and `--version`, the CLI checks `https://registry.npmjs.org/specky-sdd/latest` at most once per day and prints `Update available: vX → vY` when a newer release exists.

The registry check:

- **never runs in `specky serve`** — the MCP server makes zero outbound network calls
- fails silently when offline (no error, no delay)
- is disabled automatically in CI (`CI=true`)
- sends nothing beyond the HTTP GET itself — no telemetry, no identifiers

Opt out with `SPECKY_NO_UPDATE_CHECK=1` in the environment or `update_check: false` in `.specky/config.yml`.

---

## Environment variables

| Var | Effect |
|---|---|
| `SDD_WORKSPACE` | Override the workspace root (default: `process.cwd()`) |
| `SPECKY_DEBUG=1` | Print full error stacks |
| `SPECKY_NO_UPDATE_CHECK=1` | Disable the once-daily [update check](#update-notifications) (same as `update_check: false` in `.specky/config.yml`; the check never runs in `specky serve` regardless) |
| `PORT` | HTTP port for `specky serve --http` (default: 3200) |
| `SDD_HTTP_TOKEN` | Require `Authorization: Bearer <token>` on `/mcp` (HTTP mode, shared token) |
| `SDD_HTTP_TOKENS_FILE` | Token table (YAML) mapping bearer tokens to principal + RBAC role |
| `SDD_HTTP_HOST` | HTTP bind address (default: `127.0.0.1`) |
| `SPECKY_PROFILE` | `standard` or `enterprise` (beats `.specky/config.yml`; `SPECKY_ENTERPRISE=1` is shorthand) |
| `SDD_ROLE` | Local RBAC role for stdio mode (ignored on authenticated HTTP requests) |
| `SDD_AUDIT_HMAC_KEY` / `SDD_AUDIT_HMAC_KEY_FILE` | Sign audit entries with HMAC-SHA256 (tamper evidence) |

---

## Exit code conventions

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Advisory failure (drift, warnings) |
| 2 | Hard failure (install missing, invalid args, blocking hook failed) |

`specky init` always exits 0 on success, even if individual files were skipped due to user edits (use `--force` to override).
