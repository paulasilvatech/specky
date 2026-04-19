# Changelog

All notable changes to Specky are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.0-rc.9] - 2026-04-19

### Added — `specky install` as a first-class alias for `specky init`

Feedback from the field: users expect `install` (matches `npm install` mental
model) over `init` for a bootstrap command. Adding it as an alias rather
than a rename preserves any existing muscle memory or docs.

```bash
specky install          # new preferred spelling
specky init             # still works — identical behavior
```

Both resolve to the same underlying `runInit()` in the CLI dispatcher.

### Fixed — `specky status` showed `phase=?` for active features

Cosmetic bug in the CLI `status` command (not MCP `sdd_get_status` — that
was fixed in rc.8). The CLI proxy read `state.phase` but the schema key
is `state.current_phase`. Now reads both (current_phase preferred, phase as
legacy fallback) and adds progress/gate info:

```
Before:  001-sifap: phase=?
After:   001-sifap: phase=implement (7/10) gate=APPROVE
```

### Changed — Docs recommend global install as default

`README.md` and `docs/INSTALL.md` updated to make global install the
first-listed option (`npm install -g specky-sdd` → `specky install`),
matching field feedback that users find `npx specky` cumbersome for
day-to-day use. Per-project and zero-install modes still documented.

## [3.4.0-rc.8] - 2026-04-19

### Fixed — CRITICAL: `sdd_get_status` ignored existing `.specs/` features

Field-reported blocker: users running `sdd_get_status` on projects with
active features in `.specs/` (e.g., `.specs/001-sifap/.sdd-state.json`
showing phase 7) got back `features: []` and `current_phase: "init"` —
as if no pipeline existed. This broke every brownfield workflow and
made pipeline resumption impossible.

**Root cause:** `sdd_get_status` called `stateMachine.loadState(spec_dir)`
which reads `<spec_dir>/.sdd-state.json` — but state actually lives
per-feature at `<spec_dir>/<NNN-name>/.sdd-state.json`. The tool never
opened feature directories, so `state.features` was always the empty
default array.

**Fix (`src/tools/utility.ts`):**

- `sdd_get_status` now scans `<spec_dir>/` for feature directories via
  `fileManager.listFeatures()` (which already existed but was ignored).
- For each feature on disk, loads its per-feature state file.
- Response now includes:
  - `features: [...]` — full list of features with `phase`, `phase_progress`, `gate_decision`
  - `active_feature: { number, name, phase, directory }` — resolves explicit `feature_number` or picks the last feature
- When `feature_number` is provided, loads THAT feature's state as the current phase.
- Falls back to root state only when no features exist on disk (preserves greenfield behavior).

**Regression test (`tests/integration/status-detection.test.ts`):**

4 new tests covering:
1. Greenfield (no `.specs/`) → features:[] + current_phase:init ✅
2. Single feature in progress → detected with correct phase/progress ✅
3. Multiple features → aggregated independently with per-feature state ✅
4. Explicit `feature_number` → targets that feature's state ✅

Total test suite: 74/74 passing (70 prior + 4 new).

**Impact:** this fix makes Specky usable for brownfield projects and
enables the SIFAP-style workflow where a team works on features across
days/weeks and needs to resume where they left off. Without this fix,
every session would reset state to init regardless of what's on disk.

## [3.4.0-rc.7] - 2026-04-19

### Changed — Model routing: Opus 4.7 for reasoning phases, explicit fallback chains

Upgraded Specky's default model recommendations to the latest generation and
made the fallback strategy explicit for teams without top-tier access.

**Primary model matrix (new defaults):**

| Phase | Agent | Old model | New model |
|---|---|---|---|
| 0 Init | sdd-init | haiku | `claude-haiku-4-5` (unchanged, explicit version) |
| 1 Discover | research-analyst | sonnet | `claude-sonnet-4-6` (explicit) |
| 2 Specify | spec-engineer | opus-4-6 | **`claude-opus-4-7`** |
| 3 Clarify | sdd-clarify | opus-4-6 | **`claude-opus-4-7`** |
| 4 Design | design-architect | opus-4-6 | **`claude-opus-4-7`** |
| 5 Tasks | task-planner | sonnet | `claude-sonnet-4-6` (explicit) |
| 6 Analyze | quality-reviewer | sonnet-4-6 | **`claude-opus-4-7`** (upgraded — gate decisions need deep reasoning) |
| 7 Implement | implementer | sonnet | `claude-sonnet-4-6` (explicit) |
| 8 Verify | test-verifier | sonnet-4-6 | **`claude-opus-4-7`** (upgraded — REQ-ID traceability needs reasoning) |
| 9 Release | release-engineer | haiku | `claude-haiku-4-5` (explicit) |
| — Orchestrator | specky-orchestrator | sonnet | `claude-sonnet-4-6` (explicit) |

**Fallback chains** (new `fallback_chain` field in `ModelRoutingHint`):

- **Reasoning-heavy**: `opus-4-7 → opus-4-6 → sonnet-4-6 → gpt-5 → gpt-4.5`
- **Balanced**: `sonnet-4-6 → opus-4-6 → gpt-5 → gpt-4.5`
- **Fast**: `haiku-4-5 → sonnet-4-6 → gpt-4.5`
- **Coding**: `sonnet-4-6 → codex → gpt-5 → opus-4-6`

Every agent's frontmatter now includes a `model_fallback` list that users
can consult if they don't have access to the primary. `sdd_model_routing`
MCP tool returns the full chain programmatically for CI integrations.

**Key takeaways:**

- Analyze (Phase 6) and Verify (Phase 8) upgraded from Sonnet to Opus 4.7.
  Research (arXiv:2509.11079, arXiv:2604.02547) shows these phases produce
  downstream-critical decisions (gate approvals, phantom completions) that
  justify top-tier reasoning.
- Implement (Phase 7) stays on Sonnet 4.6 — extended thinking is actively
  harmful for iterative code tasks with test feedback (arXiv:2502.08235).
- New `docs/MODEL_GUIDE.md` documents the full matrix, fallback strategy,
  cost implications, and when to enable extended thinking.

**New ModelTier values:**
`claude-opus-4-7`, `gpt-5`, `codex` added. `gpt-4-5` renamed to `gpt-4.5`
for consistency with provider naming.

### Added

- `docs/MODEL_GUIDE.md` — complete model routing reference with fallback chains.

## [3.4.0-rc.6] - 2026-04-19

### Changed — Node.js minimum bumped to 20.0

CI (matrix macOS + Windows + Linux × Node 18/20/22) revealed that our
test runner `vitest ^4.1.0` depends on `rolldown`, which uses
`node:util.styleText` — an API introduced in Node 20. Node 18 left LTS
in April 2025 and cannot run our test suite.

- `package.json` `engines.node`: `>=18` → `>=20`
- `install-smoke.yml` matrix: removed Node 18; kept Node 20 + 22
- `docs/INSTALL.md`: updated prerequisite table

Not breaking for any user on Node 20+ (current LTS).

## [3.4.0-rc.5] - 2026-04-19

### Fixed — CI green: `\b` Perl escape + smoke-test hook count

Two bugs + one false positive surfaced by the first full CI run after rc.4:

**Real bug (`pipeline-guard.sh`):**
Lines 70 and 76 used `\b` (Perl word boundary) inside `grep -E` patterns.
`\b` in ERE is a GNU extension; BSD grep on macOS does not support it.
Replaced with explicit POSIX char-class boundaries:

```bash
# before (BSD-incompatible):
grep -qE '\b(implement|create|...)\b'
# after (portable):
grep -qE '(^|[^a-z0-9])(implement|create|...)([^a-z0-9]|$)'
```

**False positive (`drift-monitor.sh`):**
A comment contained the literal string `\b and (?:) not portable` which
our own lint regex matched. Rephrased the comment to avoid triggering
the scanner.

**CI lint hardening (`hooks-compat.yml`):**
The banned-pattern scan now strips `^\s*#` comment lines before linting,
so documentation referencing banned patterns doesn't cause false positives.

**Install smoke count (`install-smoke.yml`):**
Sprint 3 added `pipeline-guard.sh` and `session-banner.sh`, bringing the
total to 16. The smoke assertions were still checking 14 — updated to 16
for both `.claude/hooks/scripts` and `.github/hooks/specky/scripts`.

## [3.4.0-rc.4] - 2026-04-19

### Fixed — Complete permission allowlist for hooks and utilities

Expanded `SPECKY_REQUIRED_ALLOWS` from 17 → 37 entries to cover every
command that Specky hooks and agents invoke. Previously, when an agent
needed to run `jq`, `find`, `wc`, `sed`, etc., the user would still get
approval prompts even after v3.4.0-rc.3.

New allow rules (all `Bash(<cmd>:*)` patterns):
`sh`, `npx`, `rm`, `cp`, `mv`, `touch`, `chmod`, `head`, `tail`, `wc`,
`find`, `grep`, `sed`, `awk`, `jq`, `bc`, `pip`, `pip3`, `python`, `python3`.

Determined by auditing actual hook scripts:

```bash
grep -rhoE '\b(bash|jq|find|wc|...)\b' .apm/hooks/scripts/*.sh | sort -u
```

### Changed — Install mode guidance

README and `docs/INSTALL.md` now recommend **global install** as the default
for individual developers, with project-local install clearly marked as the
team/reproducibility option. Matches the intuition that CLI tools like
`specky`, `gh`, `npm` are typically global.

New "which install mode?" table in INSTALL.md covers: global, project-local,
zero-install (`npx -y`), and offline (`npm pack`) scenarios.

## [3.4.0-rc.3] - 2026-04-19

### Fixed — Tool access configuration

Resolves the field-reported issue where agents and MCP tools were unavailable
in a fresh install ("tool_search returns no results, MCP specky-sdd not
loaded, read_file/run_in_terminal disabled"). Three root causes addressed:

**Agent tool declarations expanded:**

All 13 agents had `tools:` frontmatter listing only their MCP tools
(whitelist mode). This meant agents could invoke `sdd_*` MCP tools but
could NOT use native tools like `Read`, `Write`, `Edit`, `Bash`, `Grep`
which they need to validate state, scaffold code, or inspect the workspace.

- `specky-orchestrator`: added `Read`, `Glob`, `Grep`, `Bash`, `Task`
- `specky-onboarding`: added `Read`, `Glob`, `Grep`, `Bash`, `Write`
- `sdd-init`: added `Read`, `Glob`, `Grep`, `Bash`
- `research-analyst`: added `Read`, `Glob`, `Grep`, `Bash`, `WebFetch`, `WebSearch`
- `requirements-engineer`: added `Read`, `Glob`, `Grep`, `Write`, `Edit`
- `spec-engineer`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`
- `sdd-clarify`: added `Read`, `Glob`, `Grep`, `Edit`
- `design-architect`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`
- `task-planner`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`
- `quality-reviewer`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash`
- `implementer`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`, `MultiEdit`, `Bash`
- `test-verifier`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash`
- `release-engineer`: added `Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash`

**Claude Code permissions pre-authorized:**

`specky init` now deep-merges a `permissions.allow` allowlist into
`.claude/settings.json`:

- Native tools: `Read`, `Glob`, `Grep`, `Edit`, `Write`, `MultiEdit`,
  `Bash(git:*)`, `Bash(npm:*)`, `Bash(node:*)`, `Bash(bash:*)`,
  `Bash(ls:*)`, `Bash(mkdir:*)`, `Bash(cat:*)`, `WebFetch`, `WebSearch`, `Task`
- All Specky MCP tools: `mcp__specky__*`

Users no longer face per-invocation approval prompts during pipeline
execution. Existing user-authored `allow` entries are preserved (union merge).

**VS Code Copilot MCP auto-enabled:**

`specky init` now writes `.vscode/settings.json` with:

- `chat.mcp.enabled: true`
- `chat.mcp.discovery.enabled: true`
- `chat.agent.enabled: true`
- `github.copilot.chat.codeGeneration.useInstructionFiles: true`

Without these keys, Copilot Chat does not discover `.vscode/mcp.json` even
if it is present — matching the field incident where MCP tools were
unavailable despite correct installation. Existing user keys in
`settings.json` are preserved; only missing keys are added.

**`specky doctor` extended:**

New configuration checks (alongside existing integrity checks):

- Claude `permissions.allow` contains all required rules
- `.mcp.json` registers the `specky` server
- `.vscode/mcp.json` registers the `specky` server
- `.vscode/settings.json` has Copilot MCP discovery enabled

Output now distinguishes file integrity (SHA256 against install.lock)
from configuration health.

### Refactored

- `src/cli/commands/init.ts`: extracted `installClaude`, `installCopilot`,
  `writeSpeckyMeta`, `printHeader`, `printFooter` to reduce cognitive
  complexity and support future per-IDE customization.
- `src/cli/commands/doctor.ts`: extracted `verifyIntegrity`,
  `checkClaudePermissions`, `checkVscodeSettings`, `checkMcpRegistration`,
  `runConfigChecks`, `printIntegrity`, `printChecks`.

## [3.4.0-rc.2] - 2026-04-19

### Added — Pipeline flow enforcement (Sprint 3)

Prevents the SIFAP-style incident where a user creates `impl/*` branches and
commits code without invoking the Specky orchestrator. Rule #8 is now
hard-enforced via three coordinated hooks.

**New hooks:**

- `pipeline-guard.sh` — `UserPromptSubmit` matcher. Blocks free-form
  implementation prompts ("implement X", "build Y", "fix Z", etc.) when
  `.specs/*/​.sdd-state.json` shows an active pipeline. Allowlist includes
  `@specky-*`, `/specky-*`, `specky <subcommand>`, and informational
  prompts (what/why/how/show/explain). Exits 2 with clear remediation.
- `session-banner.sh` — `SessionStart` matcher. Prints a one-screen banner
  at every new session showing active feature, phase, and branch. Warns if
  the current branch doesn't match the expected pattern for the phase
  (P0-P7 → `spec/NNN-*`, P8 → `develop`, P9 → `stage`).

**Changed — `branch-validator.sh`:**

- Now **BLOCKING** (exit 2) for `Write|Edit|MultiEdit` when a pipeline is
  active and the branch doesn't match the expected pattern.
- Remains **advisory** (exit 0 with warning) for `sdd_*` MCP tools to avoid
  breaking legitimate pipeline operations.
- Registered under new `Write|Edit|MultiEdit` matcher in both hook manifests.

**Escape hatch — `SPECKY_GUARD=off`:**

- Env var that bypasses both pipeline-guard and branch-validator blocks.
- Logs a warning every time it's used.
- Deprecated — will be removed in v3.6.

**Integration tests:**

- `tests/integration/flow-enforcement.test.ts` — 16 tests covering:
  - Greenfield user not harmed (no `.specs/` → no blocks)
  - Active pipeline + free-form prompts → blocked
  - Active pipeline + orchestrator/onboarding prompts → allowed
  - Active pipeline + info prompts (what/show/explain) → allowed
  - Active P7 + impl/* branch + Write tool → blocked
  - Active P7 + spec/* branch + Write tool → allowed
  - SPECKY_GUARD=off → allowed with warning
  - sdd_* tools remain advisory
  - P8 enforces `develop`, P9 enforces `stage`

**Test suite:** 70 total (54 unit + 16 integration), all passing.

## [3.4.0-rc.1] - 2026-04-19

### Added — Unified `specky` CLI

Specky now ships as a single npm package with a cross-platform CLI that
consolidates installation, validation, and upgrade. Replaces the previous
fragmented distribution (npm: server only, APM: broken `.claude/` install,
no Claude Code plugin).

**New commands:**

- `specky init [--ide=claude|copilot|both|auto] [--force] [--dry-run]`
  Auto-detects the IDE and installs 13 agents, 22 prompts, 8 skills, 14
  hooks to the correct locations (`.claude/` and/or `.github/`). Writes
  `.mcp.json`, `.vscode/mcp.json`, merges hooks into `.claude/settings.json`,
  and produces `.specky/install.lock` (SHA256 manifest) for integrity.
- `specky doctor [--fix]` — validates every installed file against
  `install.lock`; `--fix` re-installs.
- `specky status` — pipeline + install summary.
- `specky upgrade` — refresh assets while preserving `.specs/` and
  `.specky/profile.json`.
- `specky hooks <list|test|run NAME>` — inspect and test installed hooks.
- `specky serve [--http] [--port=N]` — canonical MCP server entry point.

**Legacy compatibility:**

- `specky-sdd` bin remains — routes to `specky serve` when invoked without
  a subcommand. Existing MCP configs using `npx -y specky-sdd` keep working.

### Added — Multi-OS support

- Windows, macOS, Linux, and WSL all work identically — the CLI runs on
  Node, no bash required for the CLI itself.
- New CI workflow `.github/workflows/install-smoke.yml` runs the full
  install flow on `[ubuntu-latest, macos-latest, windows-latest]` ×
  `[node-18, node-20, node-22]` and asserts exact file counts per target.

### Added — Claude Code native plugin

- New `.claude-plugin/plugin.json` enables `/plugin install paulasilvatech/specky`.

### Changed — npm package contents

- `.apm/`, `templates/`, `apm.yml`, `config.yml` now ship in the npm tarball
  (previously excluded). Package size: 356kB compressed, 1.6MB unpacked.
- `.npmignore` rewritten as a minimal exclusion list (relies on `files` in
  `package.json` for the allowlist).

### Changed — Bin entries

- `specky` bin now points to `./dist/cli/index.js` (unified CLI).
- `specky-sdd` bin also points to the CLI; legacy-name detection routes to
  `serve` automatically.

### Changed — Start script

- `npm start` now runs `node dist/cli/index.js serve` (was `node dist/index.js`).

### Docs

- `docs/CLI.md` — complete CLI reference.
- `docs/INSTALL.md` — per-OS walkthroughs, offline install, troubleshooting.
- `README.md` — install section rewritten around `npx specky init`.

### Removed

- No breaking removals in this release. Legacy bin and MCP server entry
  (`dist/index.js`) are preserved.

## [3.3.3] - 2026-04-19

### Fixed — Cross-platform hook portability

- **grep -P removed** across all 10 shell hooks that used Perl-compatible regex. BSD grep on macOS has no `-P` flag, which caused every affected hook to crash with exit code 2. All patterns converted to POSIX ERE (`grep -E` with `[0-9]` for `\d`, `[[:space:]]` for `\s`, and word-boundary alternatives).
- Scripts fixed: `artifact-validator.sh`, `drift-monitor.sh`, `ears-validator.sh`, `lgtm-gate.sh`, `phase-gate.sh`, `release-gate.sh`, `security-scan.sh`, `spec-quality.sh`, `spec-sync.sh`, `task-tracer.sh`.

### Fixed — Build

- **Template duplication** in `dist/templates/templates/` caused by repeated `cp -r templates dist/templates`. Build script now removes the target directory first (`rm -rf dist/templates && cp -r templates dist/templates`).

### Added — Claude Code hooks manifest

- **`dist/claude-hooks.json`** — build-time generator (`scripts/build-claude-hooks.mjs`) that derives the Claude Code hook manifest from `.apm/hooks/sdd-hooks.json`:
  - Prefixes MCP tool matchers with `mcp__specky__` (required for Claude Code to match tool calls).
  - Resolves `${CLAUDE_PLUGIN_ROOT}` to relative `.claude/hooks/scripts/` paths.
  - Preserves native Claude tools (`Write`, `Edit`, `MultiEdit`, etc.) without prefix.
- Output is consumed by the upcoming `specky init` CLI (v3.4.0) to deep-merge into `.claude/settings.json`.

### Added — Documentation

- **Rule #8** in `copilot-instructions` — orchestrator is the single entry point when a pipeline is active. Direct calls to phase agents, manual branch creation, or free-form edits are pipeline violations (enforcement in v3.5.0 via `pipeline-guard` hook).
- **Shell Script Compatibility section** in `CONTRIBUTING.md` — documents banned patterns (`grep -P`, `\d`, `\s`, `\b`, `declare -A`, `mapfile`) with portable alternatives.

### Added — CI

- **`.github/workflows/hooks-compat.yml`** — four-job workflow blocks regressions:
  1. `lint-portability` — banned-pattern regex check.
  2. `syntax-check` — `bash -n` matrix on `ubuntu-latest` + `macos-latest`.
  3. `selftest-run` — executes every hook in an empty workspace on both OSes.
  4. `build-claude-hooks` — validates the generator output.

### Known issues (planned for v3.4.0)

- `npm install specky-sdd` still ships only the MCP server; assets in `.apm/` require APM or manual copy. The upcoming `specky init` CLI will unify this.
- Pipeline bypass (e.g., creating `impl/*` branches outside `spec/NNN-*`) is not yet hard-blocked — `pipeline-guard` hook ships in v3.5.0.

## [3.3.2] - 2026-04-14

### Security & Code Quality

- **CodeQL fixes**: Resolved all High-severity alerts — incomplete HTML sanitization in transcript-parser and document-converter, incomplete string escaping in pbt-generator and test-generator
- **HTML tag stripping**: Replaced single-pass regex with iterative loop-based approach (CodeQL-safe)
- **String escaping**: Added backslash, newline, and carriage return escaping alongside double-quote escaping
- **Regex escaping**: Full special-character escape in XML zip extraction
- **Unused code cleanup**: Removed 40 unused variables, imports, and parameters across 28 files
- **GitHub Actions**: Pinned all actions to commit SHA, added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, minimal `permissions` on all workflows
- **Scorecard**: Moved to schedule-only (weekly) to avoid verification failures on push
- **Removed**: Dead Docker CI job (no Dockerfile), conflicting CodeQL workflow (default setup active)

### APM

- **APM-native package**: All primitives in `.apm/` directory (13 agents, 22 prompts, 8 skills, 14 hooks, 1 instruction)
- **Repo cleanup**: Removed 17 redundant files/dirs (agents/, commands/, skills/, hooks/, plugin.json, install.sh, etc.)
- **Phase alignment**: Fixed all phase ordering across all skills, agents, prompts, instructions, and config

## [3.3.0] - 2026-04-14

### Plugin Architecture (APM)

- **APM distribution**: Specky is now installable via `apm install paulasilvatech/specky` — the official Agent Package Manager from Microsoft ([install APM](https://microsoft.github.io/apm/getting-started/installation/) first)
- **`apm.yml`**: Root-level manifest with MCP server dependency (`npx specky-sdd@latest`)
- **`plugin.json`**: Root-level plugin descriptor with 13 agents, 22 commands, 8 skills
- **Root-level primitives**: All agents, commands, skills, and hooks moved from `plugins/specky-sdd/` to repo root (APM convention)
- **`.npmignore`**: Excludes APM primitives from npm tarball — npm gets only the MCP engine

### 13 Agents

- `@specky-orchestrator`, `@specky-onboarding`, `@sdd-init`, `@sdd-clarify`, `@requirements-engineer`, `@research-analyst`, `@spec-engineer`, `@design-architect`, `@task-planner`, `@implementer`, `@test-verifier`, `@quality-reviewer`, `@release-engineer`
- Each agent loads a companion SKILL.md as its first step (lean agent + rich skill pattern)

### 22 Prompts

- Phase prompts for all 10 pipeline phases plus utility prompts (see `commands/` for full list): `/specky-onboarding`, `/specky-greenfield`, `/specky-brownfield`, `/specky-from-meeting`, `/specky-from-figma`, `/specky-research`, `/specky-clarify`, `/specky-specify`, `/specky-design`, `/specky-tasks`, `/specky-implement`, `/specky-verify`

### 8 Skills

- Domain knowledge for every pipeline stage: `sdd-pipeline`, `sdd-markdown-standard`, `research-analyst`, `implementer`, `test-verifier`, `release-engineer`, `specky-orchestrator`, `specky-onboarding`

### 14 Hooks

- Pre/post automation for every phase: artifact validation, branch checks, LGTM gates, security scan, spec sync, drift monitor
- `sdd-hooks.json` configuration with phase-to-hook mapping

### Gitflow-SDD Branching

- Branch-aware pipeline: `spec/NNN` → `develop` → `stage` → `main`
- Phase 9 (Release) enforces branching strategy with blocking gates

### Site & Branding

- **getspecky.ai**: Custom domain live on GitHub Pages
- **Plugin-first messaging**: Hero, features, install sections all updated to plugin product positioning
- **"What is a Plugin?" section**: Educational content explaining agents, prompts, skills, hooks, MCP servers, and APM distribution
- **Comparison table**: Side-by-side vs Kiro, Cursor, Windsurf, Antigravity

### Documentation

- **README**: Plugin-first hero, APM install as primary Quick Start, "What is a Plugin?" section
- **GETTING-STARTED**: Plugin intro, APM section, "What is a Plugin?" with primitives table
- **CONTRIBUTING**: Updated to v3.3.x architecture
- **SECURITY**: Version references updated to 3.3.0
- **All version references**: Aligned to 3.3.0 across all files

## [3.2.2] - 2026-04-13

### Documentation (npm republish)

- **Plugin-first Quick Start**: README now leads with plugin installation (`copilot plugin install`), MCP-only as alternative
- **`mcpServers` key**: All JSON config examples updated from `servers` to `mcpServers`
- **Stale counts fixed**: Tool count (53/55/56 → 57), hook count (7 → 10), agent count (5 → 7), skill count (6) across README, SECURITY, CONTRIBUTING
- **SDD Platform table**: Updated to 57 tools, plugin install command
- **GETTING-STARTED.md**: Full English rewrite with plugin-first installation, use cases, model routing, hooks, FAQ
- **CONTRIBUTING.md**: Added Plugin Structure section; version reference updated to v3.2.x
- **No runtime changes** — MCP server code is identical to v3.2.1

## [3.2.1] - 2026-04-13

### Plugin Marketplace

- **`marketplace.json`**: Added `.github/plugin/marketplace.json` — repo is now a valid GitHub Copilot plugin marketplace
- **`plugin.json`**: Added `plugins/specky-sdd/.github/plugin/plugin.json` in Claude Code spec format (7 agents, 19 commands, 6 skills)
- **`.mcp.json`**: Plugin ships its own MCP config with `mcpServers` key and `specky-sdd@latest`
- **`.claude-plugin/`**: Added symlink for Claude Code marketplace compatibility
- **Plugin README**: Full plugin documentation at `plugins/specky-sdd/README.md` with skills, agents, commands, MCP server, and installation instructions
- **Plugin install**: Users can now install via `copilot plugin marketplace add paulasilvatech/specky && copilot plugin install specky-sdd@specky`
- **Flat structure**: Restructured from versioned `specky-sdd-vscode-v1.2.1/.github/plugin/specky/` to flat `plugins/specky-sdd/`
- **MCP key fix**: All JSON configs now use `mcpServers` key (previously `servers` in some files)
- **Version sync**: All plugin files aligned to v3.2.1 (`config.yml`, `plugin.json`, `marketplace.json`)
- **Cleanup**: Removed duplicate directories, empty `.github/agents/`, `.github/prompts/`, `.github/instructions/`, `.github/hooks/`

### MCP Server Metadata

- **Server title**: MCP panel now shows "Specky" with description instead of raw binary name
- **Server icon**: SVG + PNG icons served from GitHub raw content, visible in VS Code MCP panel
- **Website URL**: Links to [getspecky.ai](https://getspecky.ai) from server metadata
- **Instructions**: AI clients receive pipeline guidance during MCP handshake
- **Template path fix**: Templates now resolve from `dist/templates/` (self-contained npm package)

### Documentation

- **MCP config examples**: Added `"type": "stdio"` to all VS Code, Claude Code, and Claude Desktop config examples
- **Removed broken env vars**: Removed `SDD_WORKSPACE` / `${workspaceFolder}` that caused startup errors
- **Tool count**: Updated 56 → 57 across all documentation
- **EARS patterns**: Fixed 5 → 6 pattern count (includes Complex)
- **Broken links**: Fixed references to private files (CLAUDE.md, SYSTEM-DESIGN.md, ears-notation.md)
- **Site fixes**: Updated EARS count and footer links on [getspecky.ai](https://getspecky.ai)

## [3.2.0] - 2026-04-12

### Enterprise Security Hardening

#### Rate Limiting (opt-in)

- **`RateLimiter` service**: Token bucket algorithm — no external deps, pure TypeScript
- HTTP transport now supports `rate_limit.enabled: true` in `.specky/config.yml`
- Config: `max_requests_per_minute` (default 60), `burst` (default 10)
- Returns HTTP 429 with `Retry-After` header when limit exceeded
- stdio mode bypasses rate limiting by design (single-session, process-isolated)

#### State File Integrity

- **`StateMachine.saveState()`** now writes HMAC-SHA256 signature to `.sdd-state.json.sig`
- **`StateMachine.loadState()`** verifies signature on every load — tamper warning to stderr on mismatch
- Key: `SDD_STATE_KEY` env var, or derived from workspace path using SHA-256
- Missing `.sig` treated as unverified (no warning) — backward-compatible with pre-v3.2.0 state files

#### Enhanced Audit Logger

- **Hash-chaining**: every `AuditEntry` includes `previous_hash` (SHA-256 of previous line, seed `specky-audit-v1`)
- **Log rotation**: rotates `.audit.jsonl` → `.audit.jsonl.1` when `audit.max_file_size_mb` exceeded (default 10 MB)
- **Syslog export**: RFC 5424 format written to `.audit.syslog` when `audit.export_format: syslog`
- **OTLP stub**: `audit.export_format: otlp` logs placeholder — implementation in next release

#### RBAC Foundation (opt-in)

- **`RbacEngine` service**: `viewer` / `contributor` / `admin` roles; disabled by default
- **`sdd_check_access`** (NEW tool #57): Returns active role, per-tool access check, full role summary
- Role enforcement via `SDD_ROLE` env var or `rbac.default_role` in config
- Viewer: read-only tools only; Contributor: all except `sdd_create_pr`; Admin: all 57 tools
- Config: `rbac.enabled: true`, `rbac.default_role: contributor`

#### Config Extension

- `.specky/config.yml` now supports nested blocks: `rate_limit:`, `audit:`, `rbac:`
- Parser upgraded to handle indented YAML child keys (dot-notation flattening)
- All new options opt-in with safe defaults — existing behavior unchanged from v3.1.0

### NPM-as-Default Migration

- Global install (`npm install -g specky-sdd`) is now the recommended installation method
- npx retained as an "alternative" option for per-workspace and convenience use
- All docs updated: README.md, GETTING-STARTED.md, SYSTEM-DESIGN.md, ONBOARDING.md, SECURITY.md
- New "Enterprise Installation Methods" section in GETTING-STARTED.md
- New "NPX Supply Chain Risk" + "MCP Security Framework Compliance" sections in SECURITY.md

### Security Documentation

- **CoSAI MCP Security White Paper** — full T-01 through T-12 threat coverage table in SECURITY.md
- **OWASP MCP Top 10** — M1 through M10 coverage table in SECURITY.md

### Tests

- 561 tests (+54): `rate-limiter.test.ts` (11), `state-integrity.test.ts` (8), `audit-enhanced.test.ts` (12), `rbac-engine.test.ts` (15), plus existing suite maintained at 100%

---

## [3.1.0] - 2026-04-12

### Intelligence Layer (Specs 003–007)

#### Model Routing Guidance (Spec 003)

- **`sdd_model_routing`** (NEW tool #54): Returns the full 10-phase model routing decision table with optimal model, mode, extended thinking settings, arXiv evidence, and cost savings calculator
- **`model_routing_hint`** field added to ALL 55 tool responses via `buildToolResponse()` — every response now tells the AI client which model to use for the current phase
- Complexity override: `implement`/`design` phases with >10 files escalate to Opus automatically
- `ModelRoutingEngine` service with empirically-grounded ROUTING_TABLE (arXiv:2601.08419)

#### Context Tiering (Spec 004)

- **`sdd_context_status`** (NEW tool #55): Returns Hot/Domain/Cold tier assignment for all spec artifacts with estimated token savings
- **`context_load_summary`** field added to ALL 55 tool responses — shows which files are loaded per call
- `ContextTieringEngine` service: CONSTITUTION.md=Hot, SPEC/DESIGN/TASKS=Domain, ANALYSIS/CHECKLIST/etc=Cold
- Token estimation: `Math.ceil(content.length / 4)` — matches GPT/Claude tokenization heuristic

#### Cognitive Debt Metrics (Spec 005)

- **`cognitive_debt`** field in `sdd_metrics` and `sdd_get_status` responses (when gate history available)
- Gate instrumentation in `sdd_advance_phase`: records mtime-based modified/unmodified detection per gate
- `CognitiveDebtEngine` service: LGTM-without-modification rate as cognitive surrender signal; score = `(lgtm_rate × 0.6) + (delta_normalized × 0.4)`, labels: healthy/caution/high_risk
- Warning shown in `sdd_advance_phase` response when unmodified approval is detected

#### Verified Test Loop (Spec 006)

- **`TestResultParser`** service: auto-detects and parses Vitest JSON, pytest JSON, and JUnit XML into normalized `TestResult[]`
- **`TestTraceabilityMapper`** service: maps test names to REQ-XXX IDs via `// REQ-XXX` comment convention, builds per-requirement coverage report and failure details with `suggested_fix_prompt`
- `sdd_verify_tests` enhanced: adds `enhanced_coverage` (per-requirement breakdown) and `failure_details` to response when parsers are wired
- JUnit XML parser bug fixed: self-closing `<testcase .../>` was greedily consumed by open-tag alternative, merging two testcases; fixed with negative lookbehind `(?<!\/)`

#### Intent Drift Detection (Spec 007)

- **`intent_drift`** report in `sdd_check_sync` and `sdd_metrics` responses
- **`drift_amendment_suggestion`** in `sdd_amend` response when last drift score > 40 — lists orphaned constitutional principles with recommended spec actions
- `IntentDriftEngine` service: extracts principles from CONSTITUTION.md `## Article` sections, keyword-overlap coverage detection (≥2 keywords threshold), trend analysis (improving/stable/worsening) over last 3 DriftSnapshots
- `drift_history` stored in `.sdd-state.json` (FIFO, max 100 entries)

### Stats

- **56 tools** (was 53, corrected to 56 — sdd_metrics, sdd_validate_ears, sdd_check_ecosystem were already implemented but undercounted): +sdd_model_routing, +sdd_context_status, count reconciled
- **24 services** (was 18): +ModelRoutingEngine, +ContextTieringEngine, +CognitiveDebtEngine, +IntentDriftEngine, +TestResultParser, +TestTraceabilityMapper
- **507 unit tests** across 30 test files (was 321 across 22 files)
- All 7 specs (001–007) at ≥93% acceptance criteria coverage

---

## [3.0.0] - 2026-03-26

### Pipeline Validation & Enforcement

- **Phase validation on every tool**: `validatePhaseForTool()` maps 53 tools to allowed pipeline phases; tools called out-of-order return structured errors with fix guidance
- **Gate decision enforcement**: `advancePhase()` now blocks advancement past Analyze if gate decision is BLOCK or CHANGES_NEEDED; only APPROVE allows progression
- **Clarify phase fix**: `sdd_clarify` now properly completes the Clarify phase (was stuck in `in_progress`)
- **Proper state transitions**: `sdd_auto_pipeline` and `sdd_turnkey_spec` now use `advancePhase()` instead of direct state manipulation

### Software Engineering Diagrams (10 → 17 types)

- **7 new diagram types**: C4 Component (L3), C4 Code (L4), Activity, Use Case, Data Flow (DFD), Deployment, Network Topology
- **`generateAllDiagrams()`** now generates up to 16 diagrams per feature automatically
- **Schema updated**: `diagram_type` enum expanded from 10 to 17 types

### System Design Completeness (6 → 12 sections)

- **Design template expanded**: System Context (C4 L1), Container Architecture (C4 L2), Component Design (C4 L3), Code-Level Design (C4 L4), System Diagrams, Data Model, API Contracts, Infrastructure & Deployment, Security Architecture, ADRs, Error Handling, Cross-Cutting Concerns
- **9 new optional fields** in `writeDesignInputSchema` for backward compatibility
- **Design completeness validation**: `validateDesignCompleteness()` scores DESIGN.md against 12 required sections

### Enriched Interactive Responses (ALL 53 tools)

- **`enrichResponse()`**: Every tool response now includes phase progress bar, educational notes, methodology tips, handoff context, and parallel execution hints
- **`enrichStateless()`**: Utility tools without phase context get educational notes and common mistakes
- **`buildPhaseError()`**: Structured phase validation errors with fix guidance and methodology context
- **`MethodologyGuide`** service: Educational content for all 10 phases (what/why/how/anti-patterns/best-practices) and 20+ tools
- **`DependencyGraph`** service: Parallel execution groups for all 10 phases, tool dependency mapping, execution plans

### Parallel Documentation Generation

- **`sdd_generate_all_docs`** (NEW tool #53): Generates 5 doc types in parallel via `Promise.all()`
- **`generateJourneyDocs()`**: New SDD Journey document capturing complete pipeline audit trail (phases, timestamps, gate decisions, traceability)
- **DocGenerator wired with StateMachine** for phase-aware documentation

### Active Hooks (6 → 7)

- **`auto-checkpoint.sh`** (NEW): Suggests checkpoint creation when spec artifacts are modified
- **`security-scan.sh`** now BLOCKS (exit 2) when hardcoded secrets detected
- **`spec-sync.sh`** enhanced with drift detection and spec-reference checking
- **`auto-docs.sh`** enhanced with modification tracking via `.doc-tracker.json`

### Interactive Commands (12 rewritten)

- All 12 `/sdd:*` commands rewritten with step-by-step educational guidance
- Every step explains "What's happening" and "Why it matters"
- WAIT/LGTM gates at all quality checkpoints
- Enriched response data surfaced (progress bar, parallel hints, handoff)
- Error recovery sections with guidance back on track

### New Files

- `src/services/methodology.ts` — Educational content service (static, no dependencies)
- `src/services/dependency-graph.ts` — Parallel execution graph (static, no dependencies)
- `src/tools/response-builder.ts` — Response enrichment (enrichResponse, enrichStateless, buildPhaseError)
- `templates/journey.md` — SDD Journey documentation template
- `.claude/hooks/auto-checkpoint.sh` — Auto-checkpoint hook

### Stats

- **53 tools** (was 52), **17 diagram types** (was 10), **22 templates** (was 21), **7 hooks** (was 6)
- **18 services** (was 16): +MethodologyGuide, +DependencyGraph
- **321 unit tests**, all passing
- **12 interactive commands** fully rewritten

## [2.3.1] - 2026-03-25

### Changed

- Added Specky MCP logo and icon (PNG 256x256 + 128x128) for VS Code MCP Gallery and npm
- Configured "icon" field in package.json

## [2.3.0] - 2026-03-24

### Added

- `sdd_turnkey_spec` tool — generates complete EARS specification from a natural language description with auto-extracted requirements, EARS pattern classification, acceptance criteria generation, NFR inference, and clarification questions
- `sdd_generate_pbt` tool — generates property-based tests using fast-check (TypeScript) or Hypothesis (Python), extracting 6 property types from EARS requirements: invariant, state_transition, conditional, negative, round_trip, idempotence
- `sdd_checkpoint` tool — creates named snapshots of all spec artifacts and pipeline state for safe rollback
- `sdd_restore` tool — restores spec artifacts from a previous checkpoint with automatic backup of current state
- `sdd_list_checkpoints` tool — lists all available checkpoints with labels, dates, and phases
- `src/services/pbt-generator.ts` — new PBT generator service with EARS-to-property extraction and framework-specific code generation
- 5 new Claude Code commands: `/sdd:verify`, `/sdd:docs`, `/sdd:export`, `/sdd:diagrams`, `/sdd:iac`
- 6 executable hook scripts in `.claude/hooks/` with Claude Code `settings.json` integration (PostToolUse, Stop, TaskCompleted events)
- `.github/copilot-instructions.md` — GitHub Copilot project instructions with quick start guide
- `.github/workflows/sdd-hooks.yml` — GitHub Actions workflow replicating hook automation (spec-sync, security-scan, SRP validator, changelog reminder)
- `tests/unit/pbt-generator.test.ts` — 36 test cases for PBT generator (property extraction, classification, fast-check/hypothesis generation)
- `tests/unit/turnkey.test.ts` — 36 test cases for turnkey spec helpers (candidate extraction, EARS conversion, acceptance criteria, clarifications, NFR inference)
- `tests/integration/checkpoint-e2e.test.ts` — 9 integration test cases for checkpoint create/restore/list with real filesystem

### Changed

- MCP tool count: 47 → 52
- Claude Code commands: 7 → 12
- Test suite expanded: 211 → 292 tests across 19 files
- All 4 GitHub Copilot agents rewritten with complete workflows (turnkey, PBT, checkpointing, diagrams, IaC, docs, export, compliance)
- `spec-engineer.agent.md` now documents 8 workflows and references 49 tools
- `design-architect.agent.md` now includes diagram generation, IaC, and dev environment workflows
- `task-planner.agent.md` now includes export, test generation, and verification workflows
- `spec-reviewer.agent.md` now includes compliance, EARS validation, cross-artifact analysis, and test verification workflows
- `CLAUDE.md` updated to v2.3.0 with complete tool reference
- `README.md` updated with new tools, comparison matrix, and feature descriptions
- `TOTAL_TOOLS` constant corrected: 44 → 52
- Version bumped: 2.2.3 → 2.3.0

## [2.2.0] - 2026-03-24

### Added

- `sdd_generate_tests` tool — generates test stubs from acceptance criteria for 6 frameworks (vitest, jest, playwright, pytest, junit, xunit)
- `sdd_verify_tests` tool — verifies test results JSON against specification requirements, reports traceability coverage
- `.specky/config.yml` support — project-local configuration for templates path, default framework, compliance frameworks, audit toggle
- `src/config.ts` — centralized configuration loader with simple YAML parsing
- MCP integration test (`tests/integration/pipeline-e2e.test.ts`) — full pipeline validation with real FileManager
- Unit tests for 6 additional services: DocGenerator, GitManager, IacGenerator, WorkItemExporter, TranscriptParser, DocumentConverter
- OpenSSF Scorecard workflow (`.github/workflows/scorecard.yml`)
- SBOM generation (CycloneDX) in CI pipeline
- `templates/test-stub.md` template for generated test files

### Changed

- Test suite expanded: 120 → 211 tests across 16 files
- Coverage improved: 38% → 89% lines (threshold: 80%)
- MCP tool count: 44 → 47
- CI pipeline now enforces coverage thresholds

## [2.1.0] - 2026-03-21

### Added

- `sdd_check_ecosystem` tool — detects installed MCP servers and recommends complementary ones
- `sdd_validate_ears` tool — batch EARS requirement validation with pattern classification
- `recommended_servers` field in tool outputs for MCP ecosystem guidance
- Unit test suite with Vitest (101 tests across 7 service files)
- CI pipeline runs `npm test` on every push and pull request
- `SECURITY.md` with vulnerability disclosure policy and OWASP coverage
- `CHANGELOG.md` (this file)

### Changed

- Tool count: 42 → 44
- Updated `CLAUDE.md` to reflect v2.1.0 tools and version history

## [2.0.0] - 2026-03-21

### Added

- **25 new MCP tools** (17 → 42 total)
- **3 new pipeline phases**: Discover, Clarify, Release (7 → 10 phases)
- **8 new services**: DocumentConverter, DiagramGenerator, IacGenerator, WorkItemExporter, CrossAnalyzer, ComplianceEngine, DocGenerator, GitManager
- **14 new templates**: compliance, cross-analysis, data-model, devcontainer, dockerfile, onboarding, runbook, terraform, user-stories, verification, work-items, api-docs, checklist, research
- Compliance checking against 6 frameworks: HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001, General
- Mermaid diagram generation (10 types: flowchart, sequence, ER, class, state, Gantt, pie, mindmap, C4 context, C4 container)
- Infrastructure as Code generation: Terraform, Bicep, Dockerfile, devcontainer
- MCP-to-MCP routing architecture — structured payloads for GitHub, Azure DevOps, Jira, Terraform, Figma, Docker MCP servers
- Educative outputs (`next_steps`, `learning_note`) on every tool response
- Document import: PDF, DOCX, PPTX, TXT, MD conversion
- Figma design-to-spec conversion via Figma MCP integration
- Work item export to GitHub Issues, Azure Boards, Jira
- Cross-artifact analysis with consistency scoring
- User story generation from specifications
- Developer onboarding guide generation
- Operational runbook generation
- API documentation generation
- Git branch naming and PR payload generation
- GitHub Codespaces and devcontainer configuration generation
- Docker-based local development environment setup

### Changed

- Pipeline expanded from 7 to 10 phases
- State machine updated for new phase transitions
- All schemas updated to use `.strict()` mode
- Tool annotations added to all tools (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- Architecture documentation updated in `CLAUDE.md`

## [1.0.0] - 2026-03-20

### Added

- Initial release of Specky MCP server
- 17 MCP tools across 4 tool files
- 7-phase pipeline: Init, Discover, Specify, Clarify, Design, Tasks, Analyze
- 6 core services: FileManager, StateMachine, TemplateEngine, EarsValidator, CodebaseScanner, TranscriptParser
- 7 Markdown templates with `{{variable}}` placeholders
- EARS notation validation (6 patterns: ubiquitous, event-driven, state-driven, optional, unwanted, complex)
- State machine with required-file gates per phase
- 4 GitHub Copilot Custom Agents (Spec Engineer, Design Architect, Task Planner, Spec Reviewer)
- 7 Claude Code slash commands
- 6 automation hooks (auto-test, auto-docs, security-scan, spec-sync, changelog, srp-validator)
- TypeScript strict mode with zero `any` types
- Zod schema validation on all tool inputs
- Published to npm (`specky-sdd`), GitHub Container Registry, and GitHub Releases

[3.0.0]: https://github.com/paulasilvatech/specky/compare/v2.3.1...v3.0.0
[2.3.1]: https://github.com/paulasilvatech/specky/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/paulasilvatech/specky/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/paulasilvatech/specky/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/paulasilvatech/specky/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/paulasilvatech/specky/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/paulasilvatech/specky/releases/tag/v1.0.0
