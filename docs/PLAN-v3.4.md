# Specky v3.4 — Complete Remediation & CLI Plan

> **Status:** Draft — 2026-04-19
> **Owner:** Paula Silva
> **Scope:** Unified `specky` CLI, multi-OS install, enforced pipeline flow, enterprise hardening
> **Source incidents:** `SPECKY-FIX-REPORT.md` (ai-maturity-client-platform), SIFAP branch-bypass incident

---

## 1. Problem Statement

Today Specky has **3 distribution channels** with **inconsistent results** on client workspaces:

| Channel | What ships | What breaks |
|---|---|---|
| `npm install specky-sdd` | MCP server + templates only | User has no agents/prompts/skills/hooks — broken install |
| `apm install paulasilvatech/specky` | `.github/` assets + partial MCP config | `.claude/hooks/scripts/` empty, `settings.json` hooks `{}` |
| Claude Code `/plugin install` | **Not supported** | No `.claude-plugin/plugin.json` |

Additional bugs:
- 14 shell hooks use `grep -P` → BSD grep on macOS rejects it
- Matchers use `sdd_init` instead of `mcp__specky__sdd_init` → Claude Code never fires them
- `${CLAUDE_PLUGIN_ROOT}` is not a Claude Code variable → paths don't resolve
- No Windows support (bash hooks won't run)
- Pipeline bypass: user can create `impl/*` branch + commit without invoking orchestrator

---

## 2. Target Architecture

### 2.1 Single CLI = single write-path

All channels delegate actual file placement to the `specky` CLI:

```
   ┌────────────┐    ┌────────────┐    ┌──────────────────┐
   │ npm / npx  │    │  APM CLI   │    │ Claude /plugin   │
   │(universal) │    │ (optional) │    │ (native)         │
   └──────┬─────┘    └──────┬─────┘    └────────┬─────────┘
          │                 │                   │
          │ downloads .tgz  │ downloads repo    │ reads plugin.json
          │ with everything │ + invokes CLI     │ + local placement
          ▼                 ▼                   ▼
          ┌─────────────────────────────────────┐
          │           specky CLI                │  ◀── single source of truth
          │  init | doctor | status | upgrade   │
          │  hooks | serve                      │
          └─────────────────────────────────────┘
                          │
                          ▼
          Workspace: .claude/, .github/, .vscode/, .specky/
```

### 2.2 Why a single CLI

| Problem today | Fix with CLI |
|---|---|
| APM and npm diverge on what they install | Both delegate to `specky init` |
| Claude Code not supported | `.claude-plugin/plugin.json` references same assets; CLI produces same layout |
| No way to validate install | `specky doctor` compares against `install.lock` |
| Windows unsupported | Node-based hooks + CLI runs on Node → works on win/mac/linux |
| Hook matchers wrong for Claude | CLI generates `claude-hooks.json` at install time with correct prefixes |

### 2.3 CLI command surface

```
specky init [--ide=<claude|copilot|both|auto>] [--force] [--dry-run] [--offline=<tgz>]
specky doctor [--fix] [--verbose]
specky status                        # proxy to sdd_get_status
specky upgrade [--keep-specs]
specky hooks <test|list|run NAME>
specky serve [--http] [--port=3000]  # runs MCP server (current specky-sdd behavior)
specky --version
specky --help
```

### 2.4 Workspace layout after `specky init`

```
.claude/                                  # Claude Code
├── agents/*.md                           # 13 agents (flat)
├── commands/*.md                         # 22 prompts → slash commands
├── skills/*/SKILL.md                     # 8 skills
├── hooks/
│   ├── scripts/*.mjs                     # 14 Node hooks (cross-platform)
│   └── claude-hooks.json                 # generated with mcp__specky__ prefix
├── rules/copilot-instructions.md
└── settings.json                         # merged hooks section

.github/                                  # GitHub Copilot
├── agents/*.agent.md                     # 13 agents
├── prompts/*.prompt.md                   # 22 prompts
├── skills/*/SKILL.md                     # 8 skills
├── instructions/copilot-instructions.instructions.md
└── hooks/specky/
    ├── sdd-hooks.json                    # Copilot format
    └── scripts/*.mjs                     # same 14 Node hooks

.vscode/mcp.json                          # MCP registration (Copilot path)
.mcp.json                                 # MCP registration (Claude path)

.specky/
├── config.yml                            # pipeline config (was root config.yml)
├── install.lock                          # SHA256 of every installed file
├── profile.json                          # onboarding answers
└── orchestration.jsonl                   # orchestrator audit trail

.specs/                                   # created by sdd_init, not by specky init
└── NNN-feature-name/...
```

### 2.5 Why Node-based hooks (not bash)

| Aspect | Bash (`.sh`) | Node (`.mjs`) |
|---|---|---|
| Windows | Requires Git Bash / WSL | Native |
| macOS | `grep -P` breaks (BSD) | Works |
| Linux | Works | Works |
| Dependencies | grep, sed, awk versions vary | Node ≥18 (already required) |
| Debugging | Shell stack traces | JS stack traces |
| Test coverage | Hard to unit-test | vitest native |
| Binary startup | ~5ms | ~30ms (acceptable for hook timeout 5-10s) |

**Decision:** Rewrite all 14 hooks as `.mjs` Node scripts. Keep `.sh` versions for 1 release as fallback, removed in v3.5.

---

## 3. Multi-OS Installation

### 3.1 Prerequisites matrix

| OS | Minimum | Recommended | Notes |
|---|---|---|---|
| macOS | 12 Monterey | 14 Sonoma+ | Apple Silicon & Intel |
| Linux | Ubuntu 20.04 / any glibc ≥2.31 | Ubuntu 22.04+ | Alpine (musl) supported |
| Windows | Windows 10 1909 | Windows 11 | PowerShell 5.1+ or pwsh 7+ |

All OSes require:
- **Node.js ≥18.0.0** (LTS recommended)
- **npm ≥9** (ships with Node 18+)
- **git ≥2.30**

### 3.2 Install commands by OS

#### macOS / Linux / WSL

```bash
# Option A — project-local (recommended for teams)
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init

# Option B — global (for exploration)
npm install -g specky-sdd@latest
cd your-project
specky init

# Option C — zero-install
cd your-project
npx -y specky-sdd@latest init
```

#### Windows (PowerShell)

```powershell
# Same commands work — CLI is Node-based, no bash required
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init
```

Windows-specific notes:
- CLI detects PowerShell vs cmd and adjusts line endings (CRLF) in generated files
- Hook scripts run via `node` — no bash/WSL needed
- Paths in `settings.json` use forward slashes (Node handles both)

#### Windows (cmd.exe)

```cmd
cd your-project
npm install --save-dev specky-sdd@latest
npx specky init
```

#### Offline / air-gapped (enterprise)

```bash
# On internet-connected machine:
npm pack specky-sdd@latest
# Produces specky-sdd-3.4.0.tgz

# Transfer to air-gapped machine, then:
cd your-project
npm install ./specky-sdd-3.4.0.tgz
npx specky init --offline
```

### 3.3 IDE-specific installs

```bash
# GitHub Copilot only
npx specky init --ide=copilot

# Claude Code only
npx specky init --ide=claude

# Both (default)
npx specky init --ide=both

# Auto-detect based on what's present in workspace
npx specky init --ide=auto
```

### 3.4 Claude Code native plugin install

```bash
# Inside Claude Code
/plugin marketplace add paulasilvatech/specky
/plugin install specky@paulasilvatech
```

Reads `.claude-plugin/plugin.json` which produces the same `.claude/` layout as `specky init --ide=claude`.

### 3.5 APM install (optional shortcut)

```bash
# Microsoft APM CLI (if team already uses it)
brew install microsoft/apm/apm      # macOS
# Then:
apm install paulasilvatech/specky
# APM delegates to `npx specky init` under the hood
```

---

## 4. Roadmap — 4 Sprints

### Sprint 1 — P0 Hotfixes (3h, unblocks existing customers)

Patches current v3.3.x without architectural changes.

| # | Task | Effort | Files |
|---|---|---|---|
| S1-1 | Replace `grep -P` with `grep -E` + POSIX ERE in 14 hook scripts | 20m | `.apm/hooks/scripts/*.sh` |
| S1-2 | Fix build template duplication (`dist/templates/templates/`) | 5m | `package.json:12` |
| S1-3 | Add Rule #8 to copilot-instructions (orchestrator mandatory) | 10m | `.apm/instructions/copilot-instructions.instructions.md` |
| S1-4 | Add shell-compat section to CONTRIBUTING.md | 10m | `CONTRIBUTING.md` |
| S1-5 | CI matrix: run all hooks on `macos-latest` + `ubuntu-latest` | 1h | `.github/workflows/hooks-compat.yml` |
| S1-6 | Build-time generator for `claude-hooks.json` (prefix + path resolve) | 1h | `scripts/build-claude-hooks.mjs`, `package.json` |
| S1-7 | Tag v3.3.3 | 15m | `CHANGELOG.md` |

**Exit criteria:**
- Client on macOS runs all 14 hooks successfully (exit 0)
- `claude-hooks.json` exists in `dist/` with correct `mcp__specky__` matchers
- CI blocks `grep -P` reintroduction

---

### Sprint 2 — Specky CLI + unified distribution (3 days, core)

| # | Task | Effort | Files |
|---|---|---|---|
| **CLI scaffolding** | | | |
| S2-1 | Scaffold `src/cli/` with commander; dispatcher pattern | 2h | `src/cli/index.ts`, `src/cli/dispatcher.ts` |
| S2-2 | `specky serve` — preserves current `specky-sdd` behavior | 30m | `src/cli/commands/serve.ts` |
| S2-3 | Single `bin` entry `specky`; alias `specky-sdd` for compat | 15m | `package.json` |
| **init command** | | | |
| S2-4 | `specky init` — IDE detection (auto/claude/copilot/both) | 3h | `src/cli/commands/init.ts`, `src/cli/ide-detect.ts` |
| S2-5 | Asset copier (agents/prompts/skills/hooks → target dirs) | 2h | `src/cli/asset-copier.ts` |
| S2-6 | `settings.json` deep-merge for Claude Code hooks section | 1h | `src/cli/settings-merger.ts` |
| S2-7 | `.vscode/mcp.json` and `.mcp.json` writer | 1h | `src/cli/mcp-writer.ts` |
| S2-8 | `--offline=<tgz>` flag for air-gap installs | 1h | `src/cli/commands/init.ts` |
| S2-9 | `--dry-run` prints planned changes without writing | 30m | `src/cli/commands/init.ts` |
| **Node-based hooks** | | | |
| S2-10 | Rewrite 14 hooks as `.mjs` Node scripts (cross-platform) | 4h | `.apm/hooks/scripts/*.mjs` |
| S2-11 | Shared helpers: `readSpec`, `checkBranch`, `reportExit` | 1h | `.apm/hooks/lib/*.mjs` |
| S2-12 | Unit tests for each hook with vitest | 3h | `tests/unit/hooks/*.test.ts` |
| **Doctor / validation** | | | |
| S2-13 | `install.lock` generator at build time (SHA256 per asset) | 1h | `scripts/build-install-lock.mjs` |
| S2-14 | `specky doctor` — diff workspace against install.lock | 2h | `src/cli/commands/doctor.ts` |
| S2-15 | `specky doctor --fix` — repair missing/corrupted files | 1h | `src/cli/commands/doctor.ts` |
| S2-16 | `specky status` — proxy to MCP `sdd_get_status` | 30m | `src/cli/commands/status.ts` |
| S2-17 | `specky upgrade` — preserves `.specs/` and `.specky/profile.json` | 2h | `src/cli/commands/upgrade.ts` |
| S2-18 | `specky hooks test|list|run` | 2h | `src/cli/commands/hooks.ts` |
| **Distribution** | | | |
| S2-19 | Create `.claude-plugin/plugin.json` (Claude Code native) | 1h | `.claude-plugin/plugin.json` |
| S2-20 | Update `.npmignore` — include `.apm/`, `apm.yml`, `config.yml`, `templates/` | 15m | `.npmignore` |
| S2-21 | Update `package.json` `files` field | 15m | `package.json` |
| S2-22 | Update `apm.yml` — post-install invokes `npx specky init` | 15m | `apm.yml` |
| **CI / tests** | | | |
| S2-23 | Install smoke test: fresh dir → `npm install` → `specky init` → assert layout | 1h | `.github/workflows/install-smoke.yml` |
| S2-24 | Matrix: `[ubuntu-latest, macos-latest, windows-latest]` × `[node-18, node-20, node-22]` | 1h | same workflow |
| S2-25 | Parity test: compare APM-installed layout vs CLI-installed layout | 1h | same workflow |
| **Docs** | | | |
| S2-26 | Rewrite README install section | 1h | `README.md` |
| S2-27 | Create `docs/CLI.md` — full CLI reference | 1h | `docs/CLI.md` |
| S2-28 | Create `docs/INSTALL.md` — OS-by-OS walkthrough | 1h | `docs/INSTALL.md` |
| **Release** | | | |
| S2-29 | Tag v3.4.0 | 30m | `CHANGELOG.md` |

**Exit criteria:**
- `npm install specky-sdd && npx specky init` produces identical layout to `apm install paulasilvatech/specky`
- `specky doctor` returns 0 on healthy install, non-zero with repair steps on drift
- Claude Code `/plugin install` works natively
- CI green on Linux/macOS/Windows × Node 18/20/22
- Layout file counts: 13 agents, 22 prompts, 8 skills, 14 hooks in each target dir

---

### Sprint 3 — Pipeline Flow Enforcement (2 days)

Prevents the SIFAP-style bypass where a user commits code without going through the orchestrator.

| # | Task | Effort | Files |
|---|---|---|---|
| **Guard hooks** | | | |
| S3-1 | `pipeline-guard.mjs` — UserPromptSubmit hook; blocks free-form code when `.specs/` active | 3h | `.apm/hooks/scripts/pipeline-guard.mjs` |
| S3-2 | Register `UserPromptSubmit` matcher in both hook manifests | 30m | hooks manifests |
| S3-3 | Promote `branch-validator.mjs` to BLOCKING for `Write|Edit|MultiEdit` | 1h | `.apm/hooks/scripts/branch-validator.mjs` |
| S3-4 | `SessionStart` hook — banner with pipeline status | 30m | `.apm/hooks/scripts/session-banner.mjs` |
| **Orchestrator lock** | | | |
| S3-5 | `specky-onboarding` must write `.specky/profile.json` before handoff | 1h | agent + skill |
| S3-6 | `specky-orchestrator` refuses to run without `.specky/profile.json` | 30m | agent |
| S3-7 | New MCP tool `sdd_orchestrator_lock` — marks state orchestrator-controlled | 2h | `src/tools/pipeline.ts`, `src/services/state-machine.ts` |
| S3-8 | Phase tools refuse when `orchestrator_lock=true` and caller ≠ orchestrator | 1h | tool registrations |
| **Escape hatch** | | | |
| S3-9 | `SPECKY_GUARD=off` env — disables pipeline-guard for 1 release | 15m | hook script |
| S3-10 | Warning message clearly states how to use orchestrator instead | 15m | hook script |
| **Tests** | | | |
| S3-11 | Integration test: free-form edit on active pipeline → BLOCKED | 1h | `tests/integration/flow-enforcement.test.ts` |
| S3-12 | Integration test: orchestrator path → ALLOWED | 30m | same file |
| **Release** | | | |
| S3-13 | Tag v3.5.0 | 30m | `CHANGELOG.md` |

**Exit criteria:**
- User on `impl/001-*` branch with `.specs/001/.sdd-state.json` phase 7 active → Write tool is blocked
- `SPECKY_GUARD=off` allows override with clear warning in logs
- Onboarding → Orchestrator → Phase Agents is the only valid path (enforced)

---

### Sprint 4 — Enterprise Hardening (1 week, backlog)

Post-v3.5 features for enterprise deployments.

| # | Task | Effort |
|---|---|---|
| S4-1 | `npm publish --provenance` + CycloneDX SBOM on release | 2h |
| S4-2 | Sigstore signing on published artifacts | 3h |
| S4-3 | `specky bundle` — self-contained `.tgz` with deps vendored (air-gap) | 1d |
| S4-4 | `SPECKY_ENTERPRISE=1` flag — forces `audit + rbac + rate_limit` on | 2h |
| S4-5 | RBAC per-phase: phases 6 (analyze), 9 (release) require `admin` role | 3h |
| S4-6 | OTLP exporter for audit trail (SIEM integration) | 1d |
| S4-7 | `specky doctor --enterprise` — compliance checklist (SOC2/GDPR/HIPAA) | 1d |
| S4-8 | Docs: `docs/ENTERPRISE.md` — air-gap, RBAC, compliance | 1d |

---

## 5. Migration & Compat

### v3.3.x → v3.4.0

| Scenario | Behavior |
|---|---|
| Existing APM install | `apm install` now delegates to `specky init`; files re-written idempotently |
| Manual install with patches (per SPECKY-FIX-REPORT) | `specky doctor` detects absent `install.lock`, prompts `specky init --force` |
| Fresh install | Single command: `npx specky-sdd init` |
| `.apm/` directory in source | Stays as source of truth, no longer auto-copied to user workspace |

### v3.4.0 → v3.5.0

| Scenario | Behavior |
|---|---|
| Existing `.specs/` active | Pipeline-guard takes effect on next session; banner explains |
| Users want old behavior | `SPECKY_GUARD=off` env (valid for v3.5.x; removed in v3.6) |
| Breaking MCP tool changes | None — surface remains 57 tools + `sdd_orchestrator_lock` added |

### Deprecations

| Feature | Deprecated in | Removed in |
|---|---|---|
| `specky-sdd` bin name | v3.4 (alias to `specky`) | v4.0 |
| `.sh` hook scripts | v3.4 (alongside `.mjs`) | v3.5 |
| Root `config.yml` | v3.4 (moves to `.specky/config.yml`) | v3.5 |
| `SPECKY_GUARD=off` escape | v3.5 | v3.6 |

---

## 6. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Bin naming | Single `specky` bin; keep `specky-sdd` as alias until v4.0 |
| 2 | CLI framework | Commander (mature, tiny, ~20KB) |
| 3 | Hook timeout | 5s default, overridable per-hook |
| 4 | Windows shell hooks | Skip `.sh` entirely; ship only `.mjs` (simpler) |
| 5 | Global vs local install | Recommend local via `devDependencies` for reproducibility |
| 6 | `specky serve` vs legacy `specky-sdd` | Both work; `serve` preferred |

---

## 7. Acceptance Tests (end-to-end)

Each sprint only ships when these pass in CI.

### Sprint 1

```bash
# macOS hook portability
for s in .apm/hooks/scripts/*.sh; do bash "$s" --selftest || exit 1; done
test -f dist/claude-hooks.json
grep -q "mcp__specky__sdd_init" dist/claude-hooks.json
```

### Sprint 2 (cross-OS matrix)

```bash
# Fresh install produces expected layout
mkdir fresh && cd fresh && npm init -y
npm install ../specky-sdd-3.4.0.tgz
npx specky init --ide=both

# Asset counts (all platforms)
[ $(find .claude/agents -name '*.md' | wc -l) -eq 13 ]
[ $(find .claude/commands -name '*.md' | wc -l) -eq 22 ]
[ $(find .claude/skills -name 'SKILL.md' | wc -l) -eq 8 ]
[ $(find .claude/hooks/scripts -name '*.mjs' | wc -l) -eq 14 ]
[ $(find .github/agents -name '*.md' | wc -l) -eq 13 ]
[ $(find .github/prompts -name '*.md' | wc -l) -eq 22 ]

# Integrity
npx specky doctor     # must exit 0

# Hook execution (cross-OS)
node .claude/hooks/scripts/branch-validator.mjs --selftest
```

### Sprint 3

```bash
# Pipeline bypass blocked
cd fresh
npx specky init
mkdir -p .specs/001-test
echo '{"phase":7,"feature":"001-test"}' > .specs/001-test/.sdd-state.json
git checkout -b impl/001-test
node .claude/hooks/scripts/branch-validator.mjs Write src/main.ts
[ $? -ne 0 ]   # must exit non-zero

# Escape hatch works
SPECKY_GUARD=off node .claude/hooks/scripts/pipeline-guard.mjs "implement X"
[ $? -eq 0 ]   # allowed, with warning
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Breaking existing APM users | Medium | High | APM post-install script detects missing CLI, runs `npx -y specky-sdd@latest init` |
| CLI binary size bloat | Low | Medium | Tree-shake; commander only; budget < 250KB added |
| `specky init` overwrites user edits | Medium | High | Default non-destructive; `--force` required; `doctor` reports drift first |
| Pipeline-guard blocks legit work | Medium | Medium | `SPECKY_GUARD=off` escape; clear error with resolution steps |
| Windows path separators breaking hooks | Low | Medium | All Node hooks use `path.join`; never hardcode `/` |
| Node 18 EOL during rollout | Low | Low | Already targeting 18+; add 20 LTS as recommended |
| Hook rewrite `.sh` → `.mjs` regression | Medium | High | Keep both versions in v3.4; `.sh` removal only in v3.5 after telemetry |
| Template duplication regression | Low | Low | CI test: `find dist/templates -name '*.md' | wc -l` == 23 |

---

## 9. Deliverable Checklist

### Sprint 1 (v3.3.3)
- [ ] 7 tasks complete, PR merged, tagged
- [ ] CI green: hooks-compat matrix passes on macOS + Linux
- [ ] `dist/claude-hooks.json` generated

### Sprint 2 (v3.4.0)
- [ ] 29 tasks complete
- [ ] CLI: `init | doctor | status | upgrade | hooks | serve` working
- [ ] CI matrix: Linux/macOS/Windows × Node 18/20/22 all green
- [ ] Asset parity: `apm install` layout == `specky init` layout
- [ ] Docs: README, `docs/CLI.md`, `docs/INSTALL.md`
- [ ] `.claude-plugin/plugin.json` works for `/plugin install`

### Sprint 3 (v3.5.0)
- [ ] 13 tasks complete
- [ ] Free-form edit on active pipeline blocked
- [ ] Onboarding + orchestrator enforced as single entry path
- [ ] Escape hatch `SPECKY_GUARD=off` documented

### Sprint 4 (Enterprise, backlog)
- [ ] Provenance + SBOM signed
- [ ] Air-gap bundle command
- [ ] `SPECKY_ENTERPRISE=1` flag
- [ ] `docs/ENTERPRISE.md`

---

## 10. Execution Order & Dependencies

```
Sprint 1 (v3.3.3)  ──▶  Sprint 2 (v3.4.0)  ──▶  Sprint 3 (v3.5.0)  ──▶  Sprint 4 (enterprise)
   hot fixes            CLI + unified dist       flow enforcement         hardening
   ~3 hours             ~3 days                  ~2 days                  ~1 week
```

Sprints 1-3 are **sequential** (each builds on previous). Sprint 4 is **backlog** and can be parallelized once Sprint 3 ships.

Within each sprint, tasks are grouped into PRs of 2-4 hours each to keep reviews fast.

---

## 11. Success Metrics

Measured 30 days after v3.5.0 release:

| Metric | Target |
|---|---|
| Install success rate (successful `specky doctor` on first try) | ≥95% |
| Cross-OS install parity (macOS/Linux/Windows identical layouts) | 100% |
| Pipeline bypass incidents (via support tickets / GitHub issues) | 0 |
| Time-to-first-pipeline (install → `sdd_init` running) | <5 min |
| npm weekly downloads | +50% vs v3.3.x baseline |
| Enterprise pilots initiated | ≥3 |

---

_End of plan — v3.4 roadmap._
