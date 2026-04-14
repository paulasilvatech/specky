# Specky v3.3.0 — Complete Audit Report & Remediation Plan

> **Audited**: 2026-04-14
> **Scope**: All documentation, site, plugin primitives, MCP engine, and cross-file consistency
> **Source of truth**: `src/constants.ts` (Phase enum, TOOL_NAMES, TOTAL_TOOLS=57)

---

## Table of Contents

1. [Ground Truth](#ground-truth)
2. [Primitive Counts](#primitive-counts)
3. [Verified Correct](#verified-correct)
4. [Issue Register](#issue-register)
5. [Remediation Plan](#remediation-plan)
6. [File Reference](#file-reference)

---

## Ground Truth

These files are the single source of truth. All documentation, agents, skills, and site content must align to them.

| Source | File | Value |
|--------|------|-------|
| Phase enum | `src/constants.ts` L161-172 | `init → discover → specify → clarify → design → tasks → analyze → implement → verify → release` |
| Phase indices | `src/constants.ts` PHASE_ORDER | 0=init, 1=discover, 2=specify, 3=clarify, 4=design, 5=tasks, 6=analyze, 7=implement, 8=verify, 9=release |
| Tool count | `src/constants.ts` L17 | `TOTAL_TOOLS = 57` |
| Tool names | `src/constants.ts` L209-281 | 57 unique `sdd_*` entries in `TOOL_NAMES` |
| Plugin manifest | `plugin.json` | 13 agents, 22 commands, 8 skills, hooks ref |
| Version | `package.json` | `3.3.0` |

### Correct Phase → Agent Mapping

| Phase | Index | Phase Name | Agent |
|-------|:-----:|------------|-------|
| 0 | 0 | Init | @sdd-init |
| 1 | 1 | Discover | @research-analyst |
| 2 | 2 | Specify | @spec-engineer |
| 3 | 3 | Clarify | @sdd-clarify |
| 4 | 4 | Design | @design-architect |
| 5 | 5 | Tasks | @task-planner |
| 6 | 6 | Analyze | @quality-reviewer |
| 7 | 7 | Implement | @implementer |
| 8 | 8 | Verify | @test-verifier |
| 9 | 9 | Release | @release-engineer |

### LGTM Gates

Phases **2 (Specify)**, **4 (Design)**, **5 (Tasks)** — human approval required before advancing.

---

## Primitive Counts

| Primitive | Actual | Claimed (docs) | Status |
|-----------|:------:|:--------------:|:------:|
| MCP Tools | 57 | 57 | ✅ |
| Agents (`agents/*.agent.md`) | 13 | 13 | ✅ |
| Prompts (`commands/*.prompt.md`) | 22 | 22 | ✅ |
| Skills (`skills/*/SKILL.md`) | 8 | 8 | ✅ |
| Hooks (`hooks/scripts/*.sh`) | 14 | 14 | ✅ |
| Templates (`templates/*.md`) | 23 | 23 (CONTRIBUTING header) / 21 (tree) | ⚠️ |
| Services (`src/services/*.ts`) | 28 | 26 (CONTRIBUTING) | ⚠️ |
| Tool files (`src/tools/*.ts`) | 20 | 14 (CONTRIBUTING) | ⚠️ |
| Schema files (`src/schemas/*.ts`) | 15 | 10 (CONTRIBUTING) | ⚠️ |
| Source files total (`src/**/*.ts`) | 69 | 66 (CONTRIBUTING) | ⚠️ |
| Utils (`src/utils/*.ts`) | 2 | 0 (not shown) | ⚠️ |

---

## Verified Correct

These items were audited and confirmed accurate across all files:

| Area | Details |
|------|---------|
| `config.yml` ↔ `constants.ts` | Phase names, phase_agents, lgtm_gates `[2,4,5]`, artifacts_per_phase — all aligned |
| `specky-orchestrator.agent.md` | Routing table phases 0-9 correct, LGTM gates `(2,4,5)` |
| `specky-orchestrator/SKILL.md` | Routing table, LGTM gates, branch validation — all aligned |
| README tool tables | 57 tools across 14 categories — all match `TOOL_NAMES` |
| README roadmap | `v3.3 (current)`, RBAC + Rate Limiting in current features |
| `SECURITY.md` | `3.3.x | ✅ Active` |
| CHANGELOG agent names | All 13 match actual `.agent.md` filenames |
| CHANGELOG skill list | All 8 match `plugin.json` skills array |
| `API_REFERENCE.md` | `Total tools: 57`, `sdd_check_access` present in Security section |
| `plugin.json` | 13 agents, 22 commands, 8 skills — all paths validated |
| Site (`index.html`) | 57 tools, 13 agents, 22 prompts, 8 skills, 14 hooks — all correct everywhere (meta, hero, install, comparison table, i18n) |
| `GETTING-STARTED.md` | Counts correct, no stale version numbers |
| TypeScript compilation | `npx tsc --noEmit` → 0 errors |

---

## Issue Register

### 🔴 Issue #1 — CRITICAL: `sdd-pipeline/SKILL.md` uses old phase ordering throughout

**File**: `skills/sdd-pipeline/SKILL.md`
**Severity**: Critical — this is the primary domain knowledge skill loaded by most agents

**What's wrong**:
- Line 3 (description meta): `"Init → Research → Clarify → Specify → Design → Tasks → Implement → Verify → Review → Release"`
- Lines 13-28 (phase descriptions): Phase 1="Research", Phase 2="Clarify", Phase 3="Specify", Phase 6="Implement", Phase 7="Verify", Phase 8="Review"
- Lines 60-70 (model routing table): Uses old phase names and numbers
- Line 78 (hooks section): Says "10 integration hooks" with only 2 blocking + 8 advisory

**Should be**:
- Description: `"Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release"`
- Phase 1="Discover", Phase 2="Specify", Phase 3="Clarify", Phase 6="Analyze", Phase 7="Implement", Phase 8="Verify"
- Model routing: Aligned to new phase names/numbers
- Hooks: "14 automation hooks" with 4 blocking (artifact-validator, phase-gate, security-scan, release-gate) + 10 advisory

---

### 🔴 Issue #2 — CRITICAL: `specky-onboarding/SKILL.md` agent table uses old phase numbers

**File**: `skills/specky-onboarding/SKILL.md` lines 50-61
**Severity**: Critical — this is shown to every new user during onboarding

**What's wrong** (agent table):

| Phase in SKILL | Current Agent | Correct Agent |
|:-:|---|---|
| 2 | @sdd-clarify | @spec-engineer |
| 3 | @spec-engineer | @sdd-clarify |
| 6 | @implementer | @quality-reviewer |
| 7 | @test-verifier | @implementer |
| 8 | @quality-reviewer | @test-verifier |

---

### 🟡 Issue #3 — MODERATE: Individual agent descriptions have wrong phase numbers

**Files affected**:

| File | Current Text | Correct Text |
|------|-------------|-------------|
| `agents/spec-engineer.agent.md` L3 | `"Phase 3 agent that writes SPECIFICATION.md"` | `"Phase 2 agent..."` |
| `agents/spec-engineer.agent.md` L10 | `"Post-research specification writing is Phase 3."` | `"...is Phase 2."` |
| `agents/quality-reviewer.agent.md` L3 | `"Phase 8 agent that runs completeness audit"` | `"Phase 6 agent..."` |
| `agents/quality-reviewer.agent.md` L10 | `"Post-verification review is Phase 8."` | `"Post-tasks analysis is Phase 6."` |
| `agents/test-verifier.agent.md` L10 | `"Post-implementation verification is Phase 7"` | `"...is Phase 8"` |

**Not affected** (correct): `research-analyst.agent.md` (Phase 1 ✅), `sdd-init.agent.md`, `design-architect.agent.md`, `task-planner.agent.md`, `implementer.agent.md`, `release-engineer.agent.md`

---

### 🟡 Issue #4 — MODERATE: `CONTRIBUTING.md` architecture tree is stale

**File**: `CONTRIBUTING.md` lines 25-88
**Severity**: Moderate — misleads contributors about codebase structure

| Claim | Actual | Gap |
|-------|--------|-----|
| "66 source files" | 69 `.ts` files in `src/` | +3 |
| "10 Zod validation schemas" | 15 files in `src/schemas/` | +5 missing: `context.ts`, `metrics.ts`, `pbt.ts`, `routing.ts`, `testing.ts` |
| "26 service classes" | 28 files in `src/services/` | +2 (plus 10 services missing from the listed tree) |
| "14 tool registration files" | 20 files in `src/tools/` | +6 missing: `context.ts`, `metrics.ts`, `rbac.ts`, `routing.ts`, `testing.ts`, `response-builder.ts` |
| "21 Markdown templates" (tree text) | 23 files in `templates/` | +2 missing: `bugfix.md`, `sync-report.md` |
| `utils/` directory | 2 files: `context-helper.ts`, `routing-helper.ts` | Not shown at all |
| Service table | Lists 16 services | 12 missing from table |

**Missing from tree — Schemas**: `context.ts`, `metrics.ts`, `pbt.ts`, `routing.ts`, `testing.ts`

**Missing from tree — Services**: `audit-logger.ts`, `cognitive-debt-engine.ts`, `context-tiering-engine.ts`, `intent-drift-engine.ts`, `metrics-generator.ts`, `model-routing-engine.ts`, `rate-limiter.ts`, `rbac-engine.ts`, `test-generator.ts`, `test-result-parser.ts`, `test-traceability-mapper.ts`

**Missing from tree — Tools**: `context.ts`, `metrics.ts`, `rbac.ts`, `routing.ts`, `testing.ts`, `response-builder.ts`

**Missing from service table** (CONTRIBUTING §Service Layer): All 28 services should be listed.

---

### 🟡 Issue #5 — MODERATE: CHANGELOG says "Phase 10 (Release Gate)"

**File**: `CHANGELOG.md` line 39
**Text**: `"Phase 10 (Release Gate) enforces branching strategy with blocking gates"`

Pipeline has phases 0-9 (10 phases, zero-indexed). Phase 9 = Release. There is no Phase 10.

**Fix**: Change to `"Phase 9 (Release Gate) enforces branching strategy with blocking gates"`

---

### 🟡 Issue #6 — MODERATE: `config.yml` blocking hooks array lists only 2 of 4

**File**: `config.yml` lines 32-34
**Current**:
```yaml
blocking:
  - "security-scan"
  - "release-gate"
```

**Actual blocking hooks** (scripts that `exit 2` to halt workflow):
1. `artifact-validator.sh` — Pre-tool: blocks if required artifacts missing
2. `phase-gate.sh` — Post-tool: blocks if output artifact wasn't created
3. `security-scan.sh` — Pre-release: blocks if secrets detected
4. `release-gate.sh` — Pre-release: blocks if gate conditions not met

**Fix**: Add `artifact-validator` and `phase-gate` to blocking array.

---

### 🟢 Issue #7 — MINOR: `API_REFERENCE.md` header says "Auto-generated"

**File**: `docs/API_REFERENCE.md` lines 3-4
**Text**:
```
> Auto-generated on 2026-04-12 — do not edit manually.
> Source: `scripts/generate-api-ref.ts`
```

The script `scripts/generate-api-ref.ts` does not exist. The `scripts/` directory was never created. The file is now maintained manually.

**Fix**: Update header to `> Manually maintained — last updated 2026-04-14.`

---

### 🟢 Issue #8 — MINOR: `package.json` references non-existent script

**File**: `package.json`
**Script**: `"generate:api-ref": "tsx scripts/generate-api-ref.ts"`

The `scripts/` directory and `generate-api-ref.ts` file do not exist.

**Fix**: Either create the generator script or remove the npm script entry.

---

### 🟢 Issue #9 — MINOR: CHANGELOG prompt list is incomplete

**File**: `CHANGELOG.md` line 25
**Text**: Lists 12 prompt names as examples but labels the section "22 Prompts"

The actual 22 prompts are confirmed present in `commands/`. The CHANGELOG text is just a representative subset, not a complete list. Minor readability issue.

**Fix**: Either list all 22 or add "(representative subset)" after the list.

---

### 🟢 Issue #10 — MINOR: `apm.yml` still has removed `SDD_WORKSPACE` env var

**File**: `apm.yml` line 17
**Text**:
```yaml
env:
  SDD_WORKSPACE: "${workspaceFolder}"
```

This env var was documented as removed in v3.2.1 CHANGELOG: "Removed broken env vars: Removed SDD_WORKSPACE / ${workspaceFolder} that caused startup errors." It was removed from docs but remains in `apm.yml`.

**Fix**: Remove the `env:` block from `apm.yml`.

---

## Remediation Plan

### Phase 1 — CRITICAL: Fix `sdd-pipeline/SKILL.md` (Issue #1)

**Priority**: Highest — affects AI behavior for all agents that load this skill

| Step | Task | File | Lines |
|:----:|------|------|-------|
| 1.1 | Update description meta phase ordering | `skills/sdd-pipeline/SKILL.md` | L3 |
| 1.2 | Rename Phase 1 "Research" → "Discover" | `skills/sdd-pipeline/SKILL.md` | L13 |
| 1.3 | Swap Phase 2/3: "Clarify"→"Specify", "Specify"→"Clarify" | `skills/sdd-pipeline/SKILL.md` | L15-17 |
| 1.4 | Rename Phase 6 "Implement"→"Analyze" | `skills/sdd-pipeline/SKILL.md` | L21 |
| 1.5 | Rename Phase 7 "Verify"→"Implement" | `skills/sdd-pipeline/SKILL.md` | L23 |
| 1.6 | Rename Phase 8 "Review"→"Verify" | `skills/sdd-pipeline/SKILL.md` | L25 |
| 1.7 | Update model routing table phase names/numbers | `skills/sdd-pipeline/SKILL.md` | L60-70 |
| 1.8 | Fix hook section: "10 hooks" → "14 hooks", add 4 blocking hooks | `skills/sdd-pipeline/SKILL.md` | L78-96 |
| 1.9 | Update Key Artifacts per Phase section | `skills/sdd-pipeline/SKILL.md` | L98+ |

**Verification**: Compare every phase name/number in the file against `constants.ts` Phase enum.

---

### Phase 2 — CRITICAL: Fix `specky-onboarding/SKILL.md` (Issue #2)

| Step | Task | File | Lines |
|:----:|------|------|-------|
| 2.1 | Fix agent table: Phase 2 → @spec-engineer | `skills/specky-onboarding/SKILL.md` | L54 |
| 2.2 | Fix agent table: Phase 3 → @sdd-clarify | `skills/specky-onboarding/SKILL.md` | L55 |
| 2.3 | Fix agent table: Phase 6 → @quality-reviewer | `skills/specky-onboarding/SKILL.md` | L58 |
| 2.4 | Fix agent table: Phase 7 → @implementer | `skills/specky-onboarding/SKILL.md` | L59 |
| 2.5 | Fix agent table: Phase 8 → @test-verifier | `skills/specky-onboarding/SKILL.md` | L60 |

**Verification**: Agent table matches `config.yml` phase_agents.

---

### Phase 3 — MODERATE: Fix agent description phase numbers (Issue #3)

| Step | Task | File |
|:----:|------|------|
| 3.1 | `spec-engineer.agent.md` L3: "Phase 3" → "Phase 2" | `agents/spec-engineer.agent.md` |
| 3.2 | `spec-engineer.agent.md` L10: "Phase 3" → "Phase 2" | `agents/spec-engineer.agent.md` |
| 3.3 | `quality-reviewer.agent.md` L3: "Phase 8" → "Phase 6" | `agents/quality-reviewer.agent.md` |
| 3.4 | `quality-reviewer.agent.md` L10: "Phase 8" → "Phase 6" | `agents/quality-reviewer.agent.md` |
| 3.5 | `test-verifier.agent.md` L10: "Phase 7" → "Phase 8" | `agents/test-verifier.agent.md` |

**Verification**: `grep -n "Phase [0-9]" agents/*.agent.md` — all phase references match constants.ts.

---

### Phase 4 — MODERATE: Update `CONTRIBUTING.md` architecture tree (Issue #4)

| Step | Task |
|:----:|------|
| 4.1 | Update header: "66 source files" → "69 source files" |
| 4.2 | Update schemas section: "10 Zod validation schemas" → "15 Zod validation schemas" and add 5 missing files |
| 4.3 | Update services section: "26 service classes" → "28 service classes" and add all missing services to tree |
| 4.4 | Update tools section: "14 tool registration files" → "20 tool registration files" and add 6 missing files |
| 4.5 | Update templates line: "21 Markdown templates" → "23 Markdown templates" |
| 4.6 | Add `utils/` directory to tree with its 2 files |
| 4.7 | Add `config.ts` to the root src/ tree |
| 4.8 | Update Service Layer table to include all 28 services |

**Verification**: `find src/ -name "*.ts" | wc -l` matches header count; all files in tree match filesystem.

---

### Phase 5 — MODERATE: Fix CHANGELOG "Phase 10" (Issue #5)

| Step | Task | File |
|:----:|------|------|
| 5.1 | Change "Phase 10 (Release Gate)" → "Phase 9 (Release)" | `CHANGELOG.md` L39 |

---

### Phase 6 — MODERATE: Fix `config.yml` blocking hooks (Issue #6)

| Step | Task | File |
|:----:|------|------|
| 6.1 | Add `artifact-validator` and `phase-gate` to blocking array | `config.yml` L32-34 |

**After**:
```yaml
blocking:
  - "artifact-validator"
  - "phase-gate"
  - "security-scan"
  - "release-gate"
```

---

### Phase 7 — MINOR: Fix `API_REFERENCE.md` header (Issue #7)

| Step | Task | File |
|:----:|------|------|
| 7.1 | Replace auto-generated notice with manual maintenance notice | `docs/API_REFERENCE.md` L3-4 |

---

### Phase 8 — MINOR: Fix `package.json` dead script (Issue #8)

| Step | Task | File |
|:----:|------|------|
| 8.1 | Remove `"generate:api-ref"` script entry | `package.json` |

---

### Phase 9 — MINOR: Fix CHANGELOG prompt list (Issue #9)

| Step | Task | File |
|:----:|------|------|
| 9.1 | Add note "(see `commands/` for full list)" after subset | `CHANGELOG.md` L25 |

---

### Phase 10 — MINOR: Remove `SDD_WORKSPACE` from `apm.yml` (Issue #10)

| Step | Task | File |
|:----:|------|------|
| 10.1 | Remove `env:` block with `SDD_WORKSPACE` | `apm.yml` L15-17 |

---

### Phase 11 — Final Re-Audit

| Step | Task |
|:----:|------|
| 11.1 | Re-run TypeScript compilation check |
| 11.2 | Verify all phase references across all files |
| 11.3 | Verify all primitive counts across all docs |
| 11.4 | Verify config.yml ↔ constants.ts ↔ agents ↔ skills alignment |
| 11.5 | Produce clean audit report |

---

## File Reference

All files touched or referenced in this audit:

| File | Role | Issues |
|------|------|:------:|
| `src/constants.ts` | Source of truth — Phase enum, TOOL_NAMES, TOTAL_TOOLS | — (reference only) |
| `plugin.json` | Source of truth — agents, commands, skills arrays | — (reference only) |
| `package.json` | Version, npm config | #8 |
| `config.yml` | Pipeline config, phase agents, hooks, branching | #6 |
| `apm.yml` | APM manifest | #10 |
| `skills/sdd-pipeline/SKILL.md` | Primary domain knowledge skill | #1 |
| `skills/specky-onboarding/SKILL.md` | Onboarding wizard skill | #2 |
| `skills/specky-orchestrator/SKILL.md` | Orchestrator routing/hooks skill | ✅ |
| `agents/spec-engineer.agent.md` | Phase 2 agent | #3 |
| `agents/quality-reviewer.agent.md` | Phase 6 agent | #3 |
| `agents/test-verifier.agent.md` | Phase 8 agent | #3 |
| `agents/specky-orchestrator.agent.md` | Master orchestrator agent | ✅ |
| `README.md` | Primary documentation | ✅ |
| `CHANGELOG.md` | Version history | #5, #9 |
| `CONTRIBUTING.md` | Developer guide, architecture tree | #4 |
| `SECURITY.md` | Security policy, version table | ✅ |
| `GETTING-STARTED.md` | User onboarding guide | ✅ |
| `docs/API_REFERENCE.md` | MCP tool reference | #7 |
| `index.html` | getspecky.ai site | ✅ |
| `hooks/sdd-hooks.json` | Hook wiring config | — (reference only) |
| `hooks/scripts/*.sh` | 14 hook scripts | — (reference only) |

---

## Execution Priority

```
CRITICAL (do first — affects live agent behavior)
├── Phase 1: sdd-pipeline/SKILL.md full rewrite
└── Phase 2: specky-onboarding/SKILL.md agent table fix

MODERATE (do second — documentation accuracy)
├── Phase 3: Agent description phase numbers (3 files)
├── Phase 4: CONTRIBUTING.md architecture tree update
├── Phase 5: CHANGELOG "Phase 10" → "Phase 9"
└── Phase 6: config.yml blocking hooks array

MINOR (do last — cleanup)
├── Phase 7: API_REFERENCE.md header
├── Phase 8: package.json dead script
├── Phase 9: CHANGELOG prompt list note
└── Phase 10: apm.yml SDD_WORKSPACE removal

FINAL
└── Phase 11: Complete re-audit
```
