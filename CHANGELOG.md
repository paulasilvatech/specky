# Changelog

All notable changes to Specky are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.12.0] - 2026-07-20

### Added

- Backward-compatible `mode: "explicit" | "auto"` inputs for `sdd_generate_diagram` and `sdd_generate_all_diagrams`; explicit remains the default.
- Evidence-grounded automatic Mermaid generation for C4 context, sequence, ER, and deployment diagrams from `SPECIFICATION.md` and `DESIGN.md`.
- Source evidence tracking for derived actors, requirements, exchanges, use cases, components, entities, and deployment nodes.
- Biome lint and format integration with `biome.json` and npm scripts (`lint`, `lint:fix`, `format`).
- Unit tests for previously uncovered modules: `slug`, `routing-helper`, `audit-tools`, `transcript-tools`, `cli-commands`, `vscode-settings-writer`, and `agent-skills`.
- `.specs/001-biome-lint-integration/` spec package for dogfooding the SDD pipeline on Specky itself.

### Changed

- Terraform resource discovery now uses canonical `module:service` keys derived from the relevant `DESIGN.md` sections, with clause-scoped handling for exclusions such as `without`, `avoid`, and `not use`.
- Diagram-set auto mode synthesizes and validates the complete contracted set in memory before atomically writing `DIAGRAMS.md`.
- Coverage thresholds ratcheted to 89% statements, 77% branches, 95% functions, and 90% lines.
- Test suite expanded from 663 to 1019 tests across 99 files.

### Fixed

- Unsupported Terraform resource types now fail preflight with an actionable error instead of emitting placeholder comments.
- `specky compile` now validates and reads instruction primitives through a single file descriptor, eliminating the CodeQL-reported filesystem race.
- Feature directory identifiers use stable forward-slash separators in user-facing MCP errors on Windows.
- Integration test and hook timeouts allow subprocess-heavy tests to complete under full-suite CPU contention.
- Biome warnings for unused imports, unused variables, optional chains, and static-only classes.
- `useOptionalChain` violations in `settings-merger`, `audit-logger`, `http-auth`, and `token-table`.
- `noUnusedVariables` violations in `pipeline.ts`, `cross-analyzer.ts`, and `vscode-settings-writer.ts`.
- `noUnusedFunctionParameters` violations in `metrics.ts` and `turnkey.ts`.
- `noStaticOnlyClass` suppressions documented for `DependencyGraph` and `MethodologyGuide`.

## [3.11.1] - 2026-07-16

### Added

- Signed per-feature use-case contracts for the 54 supported lifecycle, workload, and execution-mode combinations.
- Central execution-context resolution and contract enforcement for the MCP tool surface.
- `specky migrate-contracts` for explicit migration of legacy root state to signed v5 per-feature state.
- Contract-aware pipeline profiles, strict capability configuration, explicit evidence payloads, and atomic multi-file writes.

### Changed

- Documentation, diagrams, research, and turnkey specification tools now consume caller-supplied evidence and contract configuration instead of synthesizing unspecified content.
- Agents, prompts, skills, hooks, installer output, generated API reference, and public site content describe the signed per-feature contract model.
- Build output is cleaned before compilation so deleted source modules cannot remain in the npm tarball.

### Fixed

- Cursor plugin creation now avoids the previously identified TOCTOU path race and removes unsafe `any` usage.
- APM primitive lock material is regenerated for the current canonical assets.

### Security

- Feature-scoped MCP tools reject ambiguous, legacy, missing, or mismatched execution context rather than selecting a feature implicitly.

## [3.11.0] - 2026-07-13

### Added

- Canonical agent `capabilities:` declarations compiled into target-native tool identifiers for Copilot, Claude Code, Cursor, and OpenCode.
- `--permission-profile=scoped|prompt` installation modes. The scoped Claude profile derives narrow native, command, and MCP allow rules from installed agent capabilities.
- Optional GitHub MCP registration with `--integration=github`, including target-aware diagnostics in `specky doctor`.
- [Target Capabilities](docs/TARGET-CAPABILITIES.md) reference for target rendering, approval boundaries, and GitHub MCP routing.

### Changed

- Initializer, orchestrator, verifier, implementer, and release workflows now declare the Git/test/release capabilities their instructions require.
- Release workflows distinguish Specky payload generation from authenticated GitHub MCP mutations.
- APM runtime references are pinned to the package release version rather than `@latest`.

## [3.10.2] - 2026-07-13

Patch release: Specky logo in VS Code and Cursor MCP / Agent Plugins UI.

### Added

- **`mcpServerIcons`** (`src/utils/server-icon.ts`) — resolves `site/specky-icon.png` to a `file://` URI with `sizes` for stdio MCP clients (VS Code requires local URIs; HTTPS icons are ignored).
- **Cursor plugin manifest on install** — `specky install --target=cursor` writes `.cursor-plugin/plugin.json` and copies `.cursor/assets/specky-icon.png` so the Specky logo appears in Cursor Agent Plugins.
- **Repo plugin scaffold** — root `.cursor-plugin/plugin.json` and `mcp.json` for Cursor Marketplace / Git plugin installs.
- Regression tests for server-icon resolution and cursor-plugin-writer.

### Fixed

- **VS Code / Copilot MCP icon** — server handshake no longer advertises `raw.githubusercontent.com` URLs; uses the packaged PNG via `file://`.
- **Cursor generic plug icon** — workspace installs get an explicit plugin manifest with logo instead of relying on MCP `serverInfo.icons` alone (still inconsistent in some Cursor MCP views).

### Changed

- `.gitignore` block ignores vendored `.cursor/assets/`; keeps `.cursor-plugin/plugin.json` team-shareable (same as `.cursor/mcp.json`).

## [3.10.1] - 2026-07-13

Patch release: dual TASKS.md parser (table + checkbox), honest COMPLIANCE/VERIFICATION persistence, Analyze-phase remediation for blocked gates, and generation quality fixes.

### Added

- **Shared `parseTasksFromMarkdown`** (`src/utils/task-parser.ts`) — reads canonical task tables and legacy checkbox lines, merges by task id.
- **`deriveDesignStubs`** — minimal DESIGN.md section content from SPECIFICATION.md when optional write_design fields are omitted.
- Regression coverage for table→verify/export round-trip, remediation phase rules, user-story titles, and design stubs.

### Fixed

- **TASKS.md mismatch** — `sdd_verify_tasks`, `sdd_implement`, `sdd_export_work_items`, git progress, and Gantt diagrams no longer fail or return empty results on table-format TASKS.md.
- **COMPLIANCE.md / VERIFICATION.md** — persisted reports use pre-rendered table rows (no `[TODO:` placeholders).
- **Analyze dead-end** — `sdd_write_spec` / `sdd_write_design` / `sdd_write_tasks` allowed in Analyze when gate is absent, `BLOCK`, or `CHANGES_NEEDED` (implement remains gated).
- **User story titles** — use EARS prose instead of the `(event_driven)` heading label.
- **Spec FN/NFR split** and design stubs derived from requirements in write_spec / write_design / auto-pipeline.

### Changed

- `extractRequirementIds` unified via `id-contracts.ts` in pipeline writers.
- **Documentation layout** — `GETTING-STARTED.md` and `CONTRIBUTING.md` moved under `docs/`; release notes and audit reports organized into `docs/releases/` and `docs/audits/`; root keeps only essential public files.

## [3.10.0] - 2026-07-13

Pipeline MCP hardening and harness completeness: server-enforced analysis gates, strict phase bookkeeping, and expanded per-target doctor/install coverage.

### Added

- **Central analysis gate enforcement** via `validateGateForTool` in tool-enforcement — implement/verify/release tools require `gate_decision: APPROVE` once the pipeline reaches Analyze.
- **`ensurePhasesThrough`** closes orphan phase states when write-tools run without intermediate `sdd_advance_phase` calls.
- **`invalidateGateDecision`** clears stale approvals when SPEC/DESIGN/TASKS are rewritten.
- **Strict feature resolution** — wrong `feature_number` throws instead of silently falling back to `features[0]`.
- **OpenCode instruction primitive** (`.apm/instructions/opencode-instructions.instructions.md`) and target-aware `specky compile --target=opencode`.
- **Expanded Cursor instructions** with full agent/command/gate documentation.
- **Doctor checks:** Copilot hooks manifest, Claude hooks-in-settings, agent-skills skill count, OpenCode AGENTS.md advisory, improved workspace target inference (Cursor/OpenCode/agent-skills).
- **Regression tests:** pipeline gate MCP integration, Cursor full install, mcp-writer dual VS Code schema, expanded pipeline-honesty and state-integrity coverage.

### Changed

- **`sdd_write_spec`** persists `discovery_answers` in SPECIFICATION.md, computes real EARS scores, blocks invalid EARS without `force: true`, and reorders phase recording (start-before-write).
- **`sdd_run_analysis`** marks Analyze completed only on APPROVE; BLOCK/CHANGES_NEEDED leave Analyze in progress.
- **`sdd_clarify`** no longer auto-completes Clarify — only starts the phase.
- **`sdd_discover`** completes Discover phase and uses correct MCP `readOnlyHint`.
- **`sdd_advance_phase`** loads `pipeline.require_lgtm` dynamically; LGTM check runs inside the state-machine lock.
- **VS Code MCP registration** writes both `servers` and `mcpServers` for legacy compatibility.
- **Claude/Cursor tool map** includes `MultiEdit` for `workspace.edit` parity with hook permissions.
- **Doctor default targets** returns empty scope with guidance when no install metadata or signals are found (no more silent claude+copilot default).

### Fixed

- Analysis gate was only enforced on `sdd_advance_phase`, not on downstream implement tools.
- Phase state could become inconsistent when skipping `advance_phase` between discover and specify.
- Stale `gate_decision` survived artifact rewrites.
- Multi-feature silent fallback to the wrong feature directory.
- Cognitive-debt timing improved via start-before-write phase recording on write tools.
- Audited public documentation and website assets (carried from unreleased work).
- Aligned container security claims with the workflow (SBOM always; Cosign optional).

## [3.9.0] - 2026-07-09

Cursor-native hook automation, six dedicated phase skills, full `specky doctor` install parity across harnesses, and cross-target instruction isolation fixes.

### Added

- **Cursor-native hook automation.** `specky install --target=cursor` now installs `.cursor/hooks.json` (Cursor schema v1), the `.cursor/hooks/specky-run.sh` stdin adapter, and `.cursor/hooks/scripts/` (16 scripts). Blocking gates (artifact validation, phase gate, security scan, release gate) deny unsafe actions with `failClosed`; advisory gates warn without blocking.
- **Six dedicated phase companion skills** (14 total): `specky-sdd-init`, `specky-spec-engineer`, `specky-sdd-clarify`, `specky-design-architect`, `specky-task-planner`, and `specky-quality-reviewer`. Each phase agent loads its dedicated skill first; `specky-sdd-pipeline` remains the shared cross-phase overview.
- **Dedicated Cursor instruction primitive** compiled to `.cursor/rules/specky-sdd.mdc` with `alwaysApply` and a neutral title.
- **Dedicated Claude instruction primitive** compiled to `.claude/rules/specky-sdd.md` with neutral naming (no Copilot title or `@workspace` references).
- **Full `specky doctor` install parity** for Cursor (11 checks), Claude (10), Copilot (9), and OpenCode (7): agent/prompt/skill/hook-script counts, rule format, MCP registration, and a cross-target leakage scan.
- Regression suites: `cursor-target`, `copilot-target`, `claude-target`, and `opencode-target`.
- APM policy now allows the Cursor-native hook events (`sessionStart`, `beforeSubmitPrompt`, `beforeMCPExecution`, `afterMCPExecution`, `preToolUse`, `postToolUse`, `stop`).

### Changed

- Renamed the hook-manifest generator `scripts/build-claude-hooks.mjs` → `scripts/build-hook-manifests.mjs`; it now emits Claude, Copilot, **and** Cursor manifests from the single `.apm/hooks/sdd-hooks.json` source of truth.
- `specky compile` is now target-aware: each target renders only its own instruction primitive (with the Copilot primitive as the neutral fallback) instead of concatenating every primitive into each root context file.
- EARS notation is unified to the canonical six patterns (Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex) across the rule, phase agents, and the `specky-sdd-pipeline` skill.
- All slash-command prompts now carry an `argument-hint`.

### Fixed

- Copilot installs no longer copy the Cursor/Claude instruction primitives into `.github/instructions/` (cross-target leak); only the Copilot instruction is installed and stale primitives are removed.
- Claude installs no longer receive the Copilot-named rule (`copilot-instructions.md`) or `@workspace`/`applyTo` leakage; the stale file is removed on install.
- Copilot instruction content: merged the orphaned `## Rule #7`/`## Rule #8` headings back into the Key Rules list and replaced the outdated `@workspace /prompt-name` invocation with `/prompt-name`.
- Corrected duplicated workflow step numbering in phase agents.

## [3.8.0] - 2026-07-07

Wave 1 multi-harness APM targets (Cursor, OpenCode, Agent Skills) plus a multi-feature phase-advancement fix.

### Added

- Wave 1 APM target support for `cursor`, `opencode`, and `agent-skills`, including target-native compiler registration, install paths, MCP config writers, and regression coverage.
- `specky install --target=<targets>` as the canonical APM-aligned install selector. The legacy `--ide` flag remains as a deprecated alias for backward compatibility.
- `specky compile --target=<targets>` for compiling instruction primitives into root context files (`.github/copilot-instructions.md`, `CLAUDE.md`, or `AGENTS.md`).
- `.markdownlint.json` configuration codifying the repository's Markdown conventions (Keep a Changelog sibling headings, intentional inline HTML in `README.md`) so documentation lint is clean.
- Regression test verifying that pre-existing Claude hooks in `.claude/settings.json` are removed when Copilot is installed into the same workspace, while non-hook user settings are preserved.

### Changed

- **All APM primitives are now namespaced with a `specky-` prefix** (agents, skills, and hook scripts; prompts already carried the prefix) to avoid collisions with other packages installed in the same workspace. Agent mentions change accordingly (for example `@spec-engineer` is now `@specky-spec-engineer`). The Copilot instruction primitive keeps the reserved `.github/copilot-instructions.md` filename.
- `specky doctor` now validates installed `targets[]` metadata instead of assuming only Copilot/Claude IDE scopes.
- Copilot-inclusive installs strip Claude hooks from `.claude/settings.json` even when installing both Copilot and Claude assets, preventing Copilot hook cross-read blocks.
- APM manifest and policy now use canonical target names and include Cursor/OpenCode target isolation checks.

### Fixed

- Fixed multi-feature phase advancement so artifact validation uses the requested feature number instead of always validating `state.features[0]`.
- Confirmed existing diagram persistence and REQ-ID test generation regressions remain covered by passing tests.

## [3.7.3] - 2026-07-07

APM governance, primitive lockfiles, and enterprise package validation.

### Added

- APM governance commands: `specky apm validate`, `specky apm lock`, `specky apm verify-lock`, `specky apm policy`, `specky apm audit`, and `specky apm sbom`.
- `apm-policy.yml` and `apm.lock.yaml` package governance files. The lock pins SHA256 hashes for packaged primitives and the policy enforces MCP allowlists, allowed hook events, and per-harness tool-name isolation.
- Harness compiler registry (`src/cli/lib/harness`) and APM governance modules (`src/cli/lib/apm`) with regression coverage.

### Changed

- `npm run build` now checks `apm.yml` name/version parity with `package.json` before compiling.
- `npm pack --dry-run` now includes `apm.yml`, `apm.lock.yaml`, `apm-policy.yml`, and the compiled `specky apm` command/modules.

## [3.7.2] - 2026-07-06

Platform-native primitive generation for GitHub Copilot and Claude Code.

### Changed

- `.apm` primitive source is now GitHub Copilot-native: agents use VS Code tool ids such as `search`, `agent`, and namespaced Specky MCP tools like `specky/sdd_get_status`; prompts use `agent: agent` frontmatter.
- `specky install --ide=claude` now transforms the shared source into Claude-native primitives at install time: agents use `Read`, `Glob`, `Grep`, `Task`, and `mcp__specky__sdd_*`; slash commands omit Copilot-only `agent:` metadata; Claude rules use `paths` instead of `applyTo`.
- `specky install --ide=copilot` keeps Copilot-native syntax in `.github/agents` and `.github/prompts` instead of copying Claude-style tool names.

### Added

- Primitive audit coverage for Copilot-native tool names, namespaced Specky MCP tool ids, and prompt `agent:` frontmatter.
- Regression tests proving Copilot and Claude installs generate different platform-correct agent, prompt, and instruction frontmatter.

### Fixed

- GitHub Copilot agents no longer receive Claude-only tool names such as `Read`, `Glob`, `Grep`, or `Task`.
- Claude Code agents no longer receive Copilot-only tool names such as `search`, `agent`, or `specky/sdd_*`.

## [3.7.1] - 2026-07-04

GitHub Copilot primitive metadata and hook cleanup.

### Changed

- Normalized Specky Agent Skill names to lowercase kebab-case matching their folder names.
- Added agent-mode prompt metadata and corrected reset-phase guidance to use checkpoint restore tools.
- Reduced native mutating tools in agents where Specky MCP tools perform the artifact writes.

### Fixed

- Copilot instruction file now has `applyTo: '**'` frontmatter.
- Fixed branch-validator/session hooks to read `current_phase` and string phase names.
- Prevented Copilot hook manifests from falling back to unresolved Claude plugin paths.

## [3.7.0] - 2026-07-03

Update awareness: users of old versions now find out — without the server ever
phoning home.

### Added

- **Version-drift advisory (always on, zero network).** `specky doctor`, `specky status`, and the MCP server at startup compare the workspace's installed assets version (`.specky/install.json`) against the running CLI/server version and suggest `specky upgrade` when they differ — the common "updated the global CLI but the project still runs the old pinned server" case. Local file comparison only; stderr only; never blocks startup.
- **Once-daily update banner (CLI only, opt-out).** After `install`/`init`, `doctor`, `status`, `upgrade`, and `--version`, the CLI checks `https://registry.npmjs.org/specky-sdd/latest` (24h cache in `~/.specky/update-check.json`, 2s timeout, fail-silent offline) and prints `Update available: specky-sdd vX → vY → npm install -g specky-sdd@latest && specky upgrade`. **Never runs in `specky serve`** — the MCP server keeps making zero outbound calls. Disabled automatically in CI (`CI=true`); opt out with `SPECKY_NO_UPDATE_CHECK=1` or `update_check: false` in `.specky/config.yml` (not flipped by the enterprise profile). No telemetry — nothing is sent beyond the GET itself.
- `compareSemver`/`checkForUpdate` utilities with 37 dependency-injected tests (semver matrix incl. prereleases, cache TTL, opt-outs, offline/timeout, unwritable cache).
- Docs: README "Staying up to date" (banner, one-command upgrade, Renovate/Dependabot for per-project pins, GitHub Watch → Releases), CLI.md update-notifications section + `SPECKY_NO_UPDATE_CHECK`, INSTALL.md upgrading guidance, SECURITY.md precise network disclosure (server: zero outbound; CLI: the single optional registry GET).

### Changed

- `specky status` no longer crashes on a corrupt `.specky/install.json` (reports "metadata unreadable" instead).

## [3.6.0] - 2026-07-03

Delivery-honesty release. A black-box audit executed all 65 public product
promises against the real 3.5.0 server (`docs/AUDIT-DELIVERY-3.5.md` is the
full record: 30 delivered / 29 partial / 6 not delivered). This release fixes
every finding.

### Fixed

- **`sdd_auto_pipeline` fabricated its quality gate** (hard-coded `APPROVE`/100% — the same defect fixed for other paths in 3.4.0 had survived here). It now runs the shared `AnalysisEngine`: real decision, real coverage, requirement-level traceability matrix in `ANALYSIS.md`. Auto-generated packages honestly report `CHANGES_NEEDED` until traceability is complete.
- **`sdd_get_status` reported a stale phase** (it preferred a per-feature state file no pipeline tool writes and fell back to a fresh default). Headline fields (current phase, progress, gate decision, next action) now reflect the state the pipeline actually persists.
- **Phase-skip loophole**: with no registered feature, `sdd_advance_phase` skipped every artifact check and could walk six phases with zero artifacts. Advancing past init now requires a registered feature.
- **Generated tests now compile/run**: pytest output was a Python syntax error (JS-style header); junit class names didn't match filenames and had duplicate methods; xunit had duplicate members; vitest/jest/playwright emitted markdown ToC noise as tests, traced to a nonexistent `REQ-000`, and truncated the `REQ-` prefix. All fixed, with structural (and where possible compile) tests.
- **PBT generators produce runnable property tests**: valid `fast-check` import, self-contained bodies (no undefined helpers), meaningful assertions, and real REQ IDs (never fabricated `REQ-GEN-00N` — untraceable items are skipped or explicitly labeled `UNTRACED-`).
- **`sdd_verify_tests` coverage scanned the wrong directories** (always 0%): it now scans where `sdd_generate_tests` writes (via a generated-tests manifest), so the REQ→test mapping and `next_steps` use real numbers.
- **Doc generators derive real content**: the "first 15 lines" summarizer (which captured only frontmatter + ToC) was replaced with requirement-aware extraction — generated docs now contain the actual EARS requirements; the runbook is derived from `DESIGN.md` (was 100% static template); onboarding explains the feature; API docs extract request/response examples from the design contracts (were always `{}`) and no longer duplicate endpoints from mermaid blocks; the journey doc joined the parallel batch and failures surface in the response.
- **Diagrams**: `er`/`dfd` emitted invalid Mermaid (unsanitized ids) — fixed; `class`/`state`/`c4_code` were byte-identical stubs regardless of input — now derived from the artifacts; `pie` fabricated numbers — now computed; `gantt` was header-only from spec/design and used a date syntax real Mermaid rejects — fixed; `sequence` derivation is readable (`Client->>System` per requirement). `sdd_generate_all_diagrams` now **writes `DIAGRAMS.md`** (it returned diagrams but wrote nothing) and covers c4_context + state (18 diagrams). ToC headings are no longer treated as architecture components; `sdd_figma_diagram` types differ structurally with meaningful edge labels.
- **Binary document imports fail honestly**: real (compressed) PDF/DOCX/PPTX used to import as gibberish flagged "success". Unsupported binaries now return a clear error pointing to md/txt conversion or the MarkItDown MCP; `sdd_batch_import` counts them as failed.
- **`sdd_export_work_items` payloads are target-specific** (GitHub `{title, body, labels}` / Jira `{fields: {project.key, issuetype…}}` / Azure Boards `System.*` fields + `area_path`/`iteration_path`) and honor the documented inputs that were silently discarded (`project_key`, `include_subtasks`, …).
- **Persisted `[TODO:]` placeholders**: `CHECKLIST.md` and `CROSS_ANALYSIS.md` now render the real items/alignment tables and recommendation (the data existed only in the JSON response).
- **Terraform generation emits real resources** parsed from the `DESIGN.md` tech stack (was a provider-only skeleton with four generic modules); devcontainer/local-env/codespaces honor the documented DESIGN.md fallback detection (`additional_services` is no longer always empty); the Codespaces payload no longer references a nonexistent `create_codespace` MCP tool.
- **`ears-validator.sh` hook** no longer fails (exit 1) whenever a spec lacks one of the 6 EARS pattern types — it reports per-pattern coverage as an advisory.
- **`sdd_figma_to_spec`** payload referenced nonexistent tool names (`sdd_gen_spec` → `sdd_write_spec` etc.).
- Cognitive-debt gate instrumentation resolved artifact paths against the process cwd instead of the workspace root, silently degrading in hosted (HTTP) mode.

### Added

- **Opt-in server-side LGTM**: `pipeline.require_lgtm: true` in `.specky/config.yml` makes `sdd_advance_phase` refuse to pass the Specify/Design/Tasks gates without an explicit `lgtm: true` input. Default off; not flipped by the enterprise profile (human-review gating is a workflow choice, not a security control). Gate history records LGTM presence.
- **`docs/AUDIT-DELIVERY-3.5.md`** — the full promise-delivery audit as a public record.
- 6 new test suites (~112 new tests, 299 total) locking generated-content quality: compilable test output, valid Mermaid structure, target-specific export payloads, honest import failures, requirement-bearing docs, pipeline-state truthfulness.

### Container publishing docs

- Expanded GHCR/container documentation across README, install, enterprise deployment, and publishing guidance.
- Updated GHCR publish automation to preserve multi-arch `linux/amd64` + `linux/arm64` images.

## [3.5.0] - 2026-07-02

Enterprise mode — an **opt-in configuration profile** of the same 100%
open-source (MIT) package. Every control below ships in `specky-sdd` for
everyone, default-OFF, and the standard profile is byte-for-byte the same
experience as 3.4.0. See `docs/ENTERPRISE-DEPLOYMENT.md`.

### Added

- **Enterprise profile.** `profile: enterprise` in `.specky/config.yml` — or `SPECKY_PROFILE=enterprise`, the `SPECKY_ENTERPRISE=1` shorthand, or `specky serve --profile=enterprise` (flag > env > file) — flips the *defaults* of `audit_enabled`, `rbac.enabled`, `rate_limit.enabled`, and the new `audit.fail_closed` to ON. Explicit config values always win, so any control can still be switched off individually. The server logs the resolved posture at startup.
- **Identity-based RBAC over HTTP.** `SDD_HTTP_TOKENS_FILE` points at a YAML token table (kept outside the workspace) mapping bearer tokens — plaintext or `token_sha256` — to a named `principal` and RBAC `role`. Tokens are constant-time compared; loading is fail-closed (a malformed table aborts startup instead of accepting everyone). Role precedence is now **authenticated token role > `SDD_ROLE` > `rbac.default_role`** — an authenticated request ignores `SDD_ROLE`, so a remote caller cannot out-vote its token. `sdd_check_access` and `access_denied` responses report the principal and role source. The legacy shared `SDD_HTTP_TOKEN` continues to work unchanged when no table is configured.
- **Tamper-evident audit trail.** With `SDD_AUDIT_HMAC_KEY` (or `SDD_AUDIT_HMAC_KEY_FILE`, key held outside the workspace) every audit entry is signed with HMAC-SHA256 over its serialized form — `previous_hash` included, so signatures chain. `sdd_verify_audit` now verifies both the hash chain and the signatures and reports `hmac_checked` / `signed_entries`; a workspace writer who rewrites the log and recomputes the plain chain is detected. Audit entries also record the authenticated `principal`. (Documented limit: tail truncation needs external anchoring of `current_hash`.)
- **Fail-closed auditing.** `audit.fail_closed: true` (enterprise default) refuses tool execution with `audit_unavailable` when the pre-execution audit entry cannot be written — no unaudited actions. Post-execution audit failures are surfaced on stderr without masking the tool result. Standard profile keeps the historical fail-open behavior.
- **`docs/ENTERPRISE-DEPLOYMENT.md`** — profiles, token table setup (with token/hash generation commands), HMAC audit + verification, hosted `serve --http` behind TLS (systemd/container examples), air-gapped tarball + private-registry installs, CI enforcement, the full enterprise env-var/config reference, and an honest out-of-scope list (no in-process TLS, no SSO yet, stdio has no auth layer).
- Tests: `config-profile` (profile precedence + explicit-wins), `audit-hmac` (signing, forged-rewrite detection, fail-closed, key resolution), `token-table` (load validation + identity resolution), and identity/fail-closed cases in `tool-enforcement`.

### Changed

- `AuditLogger` accepts an options object (`{ exportFormat, maxFileSizeMb, hmacKey, failClosed }`); the old positional signature still works.
- RBAC denial responses and audit entries include the caller's `principal` when authenticated.
- README, SECURITY.md, CLI.md, INSTALL.md, and ENTERPRISE-CONTROLS.md updated for the profile, token table, and HMAC audit; API reference regenerated.

## [3.4.0] - 2026-07-02

First stable `3.4.0` (supersedes the `3.4.0-rc.*` prereleases). Consolidates the
audit-remediation work — see `docs/AUDIT-2026-07.md` for the full report.

### Fixed

- **Feature-identity split (broke the happy path).** `sdd_write_spec` and `sdd_turnkey_spec` now resolve the feature directory from the pipeline state / disk instead of re-deriving it from the free-text display name. Previously `sdd_init` with `project_name: user-auth` followed by `sdd_write_spec` with `feature_name: "User Authentication"` wrote the spec into `001-user-authentication` while the state still pointed at `001-user-auth`, so `sdd_advance_phase` failed with "missing SPECIFICATION.md". A single canonical slug helper (`src/utils/slug.ts`) replaces the divergent inline variants.
- **Fabricated quality gate.** `sdd_auto_pipeline` and `sdd_batch_transcripts` previously wrote `ANALYSIS.md` with a hard-coded `APPROVE` decision, 100% coverage, and 0 orphans. The real gate math now runs through a shared `AnalysisEngine` (also used by `sdd_run_analysis`), so auto-generated packages report their true decision (typically `CHANGES_NEEDED` until traceability is completed).
- **EARS validator.** The `complex` compound pattern is now reachable (it was shadowed by the greedy state-driven rule); `suggestImprovement` no longer doubles the boilerplate ("The system shall The system shall …"); vague-term detection uses word boundaries (so "breakfast" no longer trips "fast"); multiple `shall` clauses are flagged; match input is bounded to avoid ReDoS.
- **State races.** A per-spec-dir async mutex in `StateMachine` serializes concurrent load→mutate→save cycles, preventing lost updates and torn `state`/`.sig` writes (which surfaced as false "tamper detected" warnings under pipelined requests).
- Corrected the advertised MCP tool count from `57` to `58` across the MCP server description, the `apm.yml` plugin manifest, the RBAC admin role description, `README.md`, `GETTING-STARTED.md`, `CONTRIBUTING.md`, `SECURITY.md`, and the onboarding agent and skill. The runtime already registered 58 tools; this aligns all user-facing copy with `TOTAL_TOOLS`.
- Corrected `CONTRIBUTING.md` to report 88 source files and 22 templates.
- Synced the stale `version` metadata in `apm.yml` and `config.yml` to match the package version.
- **Documentation accuracy.** Removed the inflated "507 tests" claim; added the missing `sdd_verify_audit` tool to the README catalog (57 → 58 listed); corrected the pipeline phase names in the README and `GETTING-STARTED.md` (the non-existent "Research"/"Review" phases → the real Discover/Analyze); corrected the `sdd_turnkey_spec` description ("5 EARS patterns" → 6); corrected the OWASP A02 note (Specky does use HMAC/hash-chain for local integrity); fixed `config.yml` hook paths (`.github/plugin/` → `.apm/`) and enumerated all 16 hooks (was 12); clarified the Spec-Kit lineage (upstream `github/spec-kit`; EARS is a Kiro-style addition).

### Added

- **`examples/todo-api/`** — a complete spec package produced by running the pipeline end-to-end (`sdd_init` → `sdd_run_analysis`), reaching an `APPROVE` quality gate at 100% traceability. Demonstrates the real flow and proves the gate is computed, not asserted (it returned `CHANGES_NEEDED` until the design referenced the requirement IDs).
- **`examples/specky-verify.example.yml`** — a drop-in GitHub Action that verifies EARS compliance and the quality gate on every PR.
- **`scripts/generate-api-reference.mjs`** — regenerates `docs/API_REFERENCE.md` from the live MCP `tools/list`; wired into CI with `--check` so the reference can never drift from the tool registry.
- Added the real Dockerfile and `.dockerignore` (multi-stage build, non-root, `EXPOSE 3200`, `/health` HEALTHCHECK, `serve --http` entrypoint) and un-ignored them in `.gitignore` — the release-container test and the `docker-publish` workflow require a tracked Dockerfile that had never been committable.
- Added the `--host` flag to `serve` and defensive tests (`security-hardening`, `generators`, `engines`) — coverage over the whole `src/**` tree rose from ~17% to ~24%.
- Added `src/services/analysis-engine.ts`, `src/utils/slug.ts`, and regression tests: `ears-validator`, `analysis-engine`, `doc-consistency` (config-vs-disk hook/phase/count guard), and a `happy-path-mcp` end-to-end suite.
- Added `tests/unit/tool-count.test.ts`, a regression guard asserting that the number of registered tools equals `TOTAL_TOOLS` (58) so the advertised count cannot drift again.

### Changed

- Deduplicated the `publish.yml` workflow to a single `release: published` trigger, preventing duplicate npm publish attempts per release.
- Linked all five enterprise documents (System Design, Enterprise Controls, Determinism, Branch Governance, Evidence) from the README.

## [3.4.0-rc.15] - 2026-06-17

### Added

- Added centralized MCP tool enforcement with RBAC, phase validation, and audit logging across all registered tools.
- Added `sdd_verify_audit` for hash-chain audit trail verification.
- Added complete feature package generation for new specifications. `sdd_write_spec`, `sdd_turnkey_spec`, `sdd_auto_pipeline`, and `sdd_batch_transcripts` now create companion artifacts including `README.md`, `DESIGN.md`, `TASKS.md`, `ADR.md`, `PLAYBOOK.md`, `DIAGRAMS.md`, `TDD_STATUS.md`, `EVIDENCE.md`, and `SPEC_PACKAGE.json`.
- Added scaffold detection so generated `DESIGN.md` and `TASKS.md` placeholders cannot satisfy phase advancement until completed.
- Added deterministic runtime helpers through `SDD_FIXED_NOW` for stable generated artifact timestamps.
- Added enterprise documentation: branch governance, determinism, enterprise controls, system design, and evidence pack.
- Added agent frontmatter audit script and CI gate to prevent hardcoded model metadata or missing `sdd_*` tool permissions.
- Added Dockerfile and `.dockerignore` for the GHCR publish workflow.

### Changed

- Removed hardcoded `model` and `model_fallback` frontmatter from all Specky `.apm` agents. Agents now recommend model capability classes and let users choose any model available in GitHub Copilot.
- Replaced vendor-specific model guidance in `.apm` instructions and skills with `fast`, `balanced`, and `reasoning-focused` recommendations.
- Updated `specky doctor` to validate only the recorded IDE installation scope from `.specky/install.json`.
- Updated package metadata and documentation for 58 MCP tools and 3 runtime dependencies.
- Strengthened publish validation with coverage thresholds, npm provenance, package dry-run, and CLI smoke checks.

### Fixed

- Fixed document import path handling so document conversion reads workspace files through `FileManager` and rejects absolute paths and path traversal.
- Fixed `pipeline-guard.sh` so prompt JSON on stdin still triggers advisory or strict enforcement while accidental interactive invocations skip safely.
- Fixed stale release smoke expectations for the current template count and removed the obsolete `.claude-plugin` package assertion.

### Validation

- `npm run build` passed.
- `npm test` passed with 16 test files and 111 tests.
- `npm run test:coverage` passed with statements 56.14%, branches 43.82%, functions 67.91%, and lines 57.89%.
- `npm audit --audit-level=high` passed. One low severity `esbuild` advisory remains in the development toolchain.
- `npm pack --dry-run`, MCP initialize smoke, fresh install smoke, and CLI smoke passed.

## [3.4.0-rc.14] - 2026-04-20

### Fixed — CRITICAL: Copilot still blocks after rc.13 (hook lifecycle mismatch)

Field incident continuation: after rc.13 fixed the advisory-default polarity,
the pilot still saw "Blocked by Pre-Tool Use hook" on @specky-onboarding in
VS Code Copilot Chat. The onboarding agent's Read/Glob/Grep tools were blocked
3 times before falling back to text-only guidance.

**Root cause (three layers):**

1. **Copilot treats ALL lifecycle events as PreToolUse.** The Copilot hooks
   manifest included `SessionStart` (session-banner.sh) and `UserPromptSubmit`
   (pipeline-guard.sh with `matcher: ""`) — Claude Code lifecycle events that
   Copilot doesn't distinguish. Copilot ran pipeline-guard.sh on every tool
   call. That script reads from stdin to parse the user prompt; Copilot provides
   tool call data instead → jq parse failure → cat hangs → 5s timeout → block.

2. **`Write|Edit|MultiEdit` matcher fires for unrelated tools in Copilot.**
   Copilot uses different internal tool names (read_file, write_file, etc.).
   The Claude Code native-tool matcher `Write|Edit|MultiEdit` may trigger
   branch-validator.sh for unrelated Copilot tools.

3. **Stale pre-rc.12 manifest not cleaned up.** Old installs left
   `.github/hooks/specky-sdd-hooks.json` (with broken `${CLAUDE_PLUGIN_ROOT}`
   paths) alongside the fixed `.github/hooks/specky/sdd-hooks.json`. Copilot
   loads both → broken paths → script not found → block.

**Fix:**

- `build-claude-hooks.mjs` now strips `SessionStart`, `UserPromptSubmit`, and
  `Write|Edit|MultiEdit` from the Copilot manifest. Only `sdd_*` PreToolUse
  and PostToolUse hooks remain — these only fire for Specky MCP tool calls.
- `asset-copier.ts` now deletes the stale `.github/hooks/specky-sdd-hooks.json`
  during `specky install --force`.

**Migration for existing installs:**

```bash
npm install -g specky-sdd@next     # pulls rc.14+
cd affected-project
specky install --force              # removes stale manifest + installs stripped hooks
# Cmd+Shift+P → Developer: Reload Window
```

## [3.4.0-rc.13] - 2026-04-19

### Fixed — CRITICAL: Copilot still blocked after rc.12 (over-aggressive hooks)

Field incident continuation: after migrating to rc.12 (which resolved the
`${CLAUDE_PLUGIN_ROOT}` path bug), the pilot still saw "Blocked by
Pre-Tool Use hook" on nearly every prompt in Copilot. Path resolution
was fixed, but the hooks themselves were blocking by default.

**Root cause:** two hooks shipped with blocking-by-default semantics that
were too aggressive for real pilot usage:

1. `pipeline-guard.sh` (UserPromptSubmit, `matcher=""` → runs on **every**
   prompt): blocked any prompt containing the words
   `implement|create|build|write|code|fix|add|refactor|deploy|release|merge|commit|push|test|install|setup|configure`.
   That regex matches practically every developer prompt. Every block
   surfaced as "Blocked by Pre-Tool Use hook" in Copilot.

2. `branch-validator.sh` (PreToolUse, `matcher="Write|Edit|MultiEdit"`):
   blocked every edit tool call whenever a `.specs/` pipeline existed and
   the user wasn't on a `spec/*` branch. Pilots who ran `specky init` and
   then edited anything from `develop`/`main` were blocked.

The only escape hatch was `SPECKY_GUARD=off` (opt-OUT), which pilots had
no way of knowing to set.

**Fix — flipped polarity:** both hooks now default to **advisory**
(warn on stderr, `exit 0`). Enforcement is explicit opt-in via
`SPECKY_GUARD=strict`.

| Mode                        | pipeline-guard | branch-validator |
|-----------------------------|----------------|------------------|
| `SPECKY_GUARD=strict`       | BLOCK (exit 2) | BLOCK (exit 2)   |
| (unset) / `off` / `advisory`| warn, exit 0   | warn, exit 0     |

No agents, prompts, or MCP tools changed. Only the two hook scripts +
their integration tests.

**Migration for existing installs:**

```bash
npm install -g specky-sdd@next     # pulls rc.13+
cd affected-project
specky install --force              # overwrites the hook scripts
# reload Copilot Chat / restart VS Code — no more spurious blocks
```

To re-enable strict enforcement after pilot has adopted the orchestrator
routing:

```bash
export SPECKY_GUARD=strict          # per-shell opt-in
```

Tests updated to verify the flipped semantics (74/74 still passing).

## [3.4.0-rc.12] - 2026-04-19

### Fixed — CRITICAL: Copilot hook executor denied all tools

Field incident: in projects installed with rc.10 or earlier, the GitHub
Copilot Autopilot agent blocked every tool call (including native
`read_file`, `list_dir`, `grep_search`, `manage_todo_list`) with the
message "Denied by PreToolUse hook: Tried to use X - an unexpected
error occurred".

**Root cause:** `specky install` copied `.apm/hooks/sdd-hooks.json`
verbatim to `.github/hooks/specky/sdd-hooks.json`. That source file
references `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/` — a Claude Code plugin
variable that does NOT resolve in Copilot. When Copilot's hook executor
tried to spawn `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-banner.sh`,
the shell treated `${CLAUDE_PLUGIN_ROOT}` as an empty string and
searched for `/hooks/scripts/session-banner.sh` (absolute path), which
doesn't exist. Copilot generically reported "unexpected error" and
denied the tool.

51 unresolved `${CLAUDE_PLUGIN_ROOT}` references in the Copilot-facing
hooks manifest caused every tool call to be denied.

**Fix:**

- `scripts/build-claude-hooks.mjs` now generates TWO manifests:
  - `dist/claude-hooks.json` — existing (Claude Code format with `mcp__specky__` prefix)
  - `dist/copilot-hooks.json` — NEW (Copilot format with resolved `.github/hooks/specky/scripts/` paths, no prefix)
- `src/cli/lib/asset-copier.ts` now copies `dist/copilot-hooks.json` to
  `.github/hooks/specky/sdd-hooks.json` (falling back to `.apm/hooks/sdd-hooks.json`
  only when the generator hasn't run, e.g. during dev builds).
- `src/cli/lib/paths.ts` exposes the new `copilotHooksManifest` source path.

**Validation:**

```bash
specky install
grep -c 'CLAUDE_PLUGIN_ROOT' .github/hooks/specky/sdd-hooks.json
# Before rc.12: 51
# After rc.12:  0 ✅
grep -c '.github/hooks/specky/scripts' .github/hooks/specky/sdd-hooks.json
# 51 (all paths resolved)
```

**Migration for existing installs:**

```bash
npm install -g specky-sdd@next     # pulls rc.12+
cd affected-project
specky install --force              # overwrites the broken hooks manifest
# reload Copilot Chat / restart VS Code
```

74/74 tests still passing. No production code in agents/hooks changed —
only the hook manifest generation and copy step.

## [3.4.0-rc.11] - 2026-04-19

### Fixed — Windows CI flaky test timeout

CI on rc.10 revealed that `tests/integration/flow-enforcement.test.ts`
timed out intermittently on `windows-latest` (Git Bash spawn is slow;
3 sequential spawns + workspace setup can exceed the 5s default).
Linux and macOS matrix jobs passed consistently.

Fix: set `{ timeout: 20_000 }` at the describe block level for both
integration test suites (`pipeline-guard.sh` and `branch-validator.sh`).
20s covers worst-case Windows CI with margin; local runs remain <5s.

No production code change. 74/74 tests still passing.

## [3.4.0-rc.10] - 2026-04-19

### Fixed — CRITICAL UX: `specky install` polluted git with ~125 vendored files

Field feedback from the pilot: after `specky install`, running `git add`
staged 125+ files (agents, prompts, skills, hooks) that are **vendored
from the npm package** — same mental model as `node_modules/`. Committing
them produced huge diffs on every `specky upgrade` and pushed merge pain
onto teams.

**Fix:** `specky install` now writes (or refreshes) a managed block in
the project's `.gitignore`. The block is idempotent — safe to run
repeatedly on install/upgrade.

Before rc.10: `git add -A` → 125+ files staged ❌
After rc.10:  `git add -A` → 6 files staged ✅

**Files gitignored (vendored — regenerated by the CLI):**

- `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.claude/hooks/`, `.claude/rules/`
- `.github/agents/`, `.github/prompts/`, `.github/skills/`, `.github/hooks/specky/`, `.github/instructions/`
- `.specky/install.lock`, `.specky/install.json`

**Files kept in git (project-specific):**

- `.specky/config.yml` — pipeline config
- `.specky/profile.json` — onboarding answers
- `.specs/` — your pipeline artifacts
- `.claude/settings.json` — team-shared permissions + hooks
- `.mcp.json`, `.vscode/mcp.json`, `.vscode/settings.json` — team-shared MCP + editor config

**Implementation:** new `src/cli/lib/gitignore-writer.ts` with idempotent
block management (delimited by `# ─── Specky ───` markers). Safe to run
on existing `.gitignore` files — never touches user-authored entries
outside the block.

**Migration for existing installs** (if you already committed vendored files):

```bash
npm install -g specky-sdd@next
cd your-project
specky install --force       # writes .gitignore block

git rm -r --cached .claude/agents .claude/commands .claude/skills \
                   .claude/hooks .claude/rules \
                   .github/agents .github/prompts .github/skills \
                   .github/hooks/specky .github/instructions \
                   .specky/install.lock .specky/install.json 2>/dev/null
git commit -m "chore: remove vendored Specky assets (now gitignored)"
```

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

[3.3.2]: https://github.com/paulasilvatech/specky/compare/v3.3.0...v3.3.2
[3.3.0]: https://github.com/paulasilvatech/specky/compare/v3.2.2...v3.3.0
[3.2.2]: https://github.com/paulasilvatech/specky/compare/v3.2.1...v3.2.2
[3.2.1]: https://github.com/paulasilvatech/specky/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/paulasilvatech/specky/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/paulasilvatech/specky/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/paulasilvatech/specky/compare/v2.3.1...v3.0.0
[2.3.1]: https://github.com/paulasilvatech/specky/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/paulasilvatech/specky/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/paulasilvatech/specky/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/paulasilvatech/specky/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/paulasilvatech/specky/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/paulasilvatech/specky/releases/tag/v1.0.0
