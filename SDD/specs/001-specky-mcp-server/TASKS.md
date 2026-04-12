---
title: "Specky — Tasks"
feature_id: "001-specky-mcp-server"
version: 1.0.0
date: 2026-03-20
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
task_count: 56
parallel_tasks: 12
phases: 5
---

# Specky — Tasks

> Sequenced implementation tasks with pre-implementation gates, `[P]` parallel markers, effort estimates, and requirement traceability.

---

## Table of Contents

- [Pre-Implementation Gates](#pre-implementation-gates)
- [Phase 1: Project Scaffold](#phase-1-project-scaffold)
- [Phase 2: Services Layer](#phase-2-services-layer)
- [Phase 3: Pipeline Tools](#phase-3-pipeline-tools)
- [Phase 4: Utility Tools + Analysis](#phase-4-utility-tools--analysis)
- [Phase 5: Integration (Agents + Commands)](#phase-5-integration-agents--commands)
- [Phase 6: Quality + Release](#phase-6-quality--release)
- [Dependency Graph](#dependency-graph)
- [Effort Summary](#effort-summary)

---

## Pre-Implementation Gates

Before writing any code, the following gates must pass. Each maps to a Constitution article.

- [ ] **Gate 1:** CONSTITUTION.md approved (Art. 1) → Confirms project charter, naming, scope
- [ ] **Gate 2:** SPECIFICATION.md reviewed — all 52 requirements have acceptance criteria (Art. 4)
- [ ] **Gate 3:** DESIGN.md reviewed — architecture, ADRs, data models complete (Art. 3)
- [ ] **Gate 4:** npm name `specky` availability confirmed (Art. 2.1)
- [ ] **Gate 5:** Node.js >= 18 available in development environment (Art. 1.5)
- [ ] **Gate 6:** MCP SDK latest version identified and compatible (Art. 1.5)

---

## Phase 1: Project Scaffold

**Goal:** Empty project that compiles and starts an MCP server responding to `initialize`.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-001 | Create `specky/package.json` with name, version, bin entry, dependencies (`@modelcontextprotocol/sdk`, `zod`), scripts (`build`, `start`, `dev`) | | S | Gates | REQ-CORE-005 |
| T-002 | Create `specky/tsconfig.json` with strict mode, ES2022 target, Node16 module resolution, outDir `dist/` | [P] | S | Gates | REQ-QUAL-001 |
| T-003 | Create `specky/src/constants.ts` with VERSION, CHARACTER_LIMIT (25000), DEFAULT_SPEC_DIR, Phase enum, tool names | [P] | S | Gates | REQ-CORE-006 |
| T-004 | Create `specky/src/types.ts` with all TypeScript interfaces: SddState, Phase, PhaseStatus, FeatureInfo, GateDecision, EarsRequirement, DirectoryTree, CodebaseSummary, TechStack, TransitionResult, ValidationResult | [P] | M | Gates | REQ-SVC-004 |
| T-005 | Create `specky/src/index.ts` — McpServer initialization with stdio transport (default) and `--http` flag for Streamable HTTP on port 3200 | | M | T-001, T-003 | REQ-CORE-001, REQ-CORE-002, REQ-CORE-003 |
| T-006 | Add shebang `#!/usr/bin/env node` to `dist/index.js` via build script, verify `npx` invocation | | S | T-005 | REQ-CORE-005 |
| T-007 | Add SIGINT/SIGTERM graceful shutdown handler | | S | T-005 | REQ-CORE-007 |
| T-008 | Add workspace root resolution from `SDD_WORKSPACE` env or `process.cwd()` | | S | T-005 | REQ-CORE-004 |

**Verification:** `npm run build` succeeds, `node dist/index.js` responds to MCP `initialize` handshake.

**Phase 1 total: 8 tasks (3 parallel), Effort: ~4 hours**

---

## Phase 2: Services Layer

**Goal:** All 5 services implemented and independently testable.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-009 | Implement `FileManager` — constructor with workspaceRoot, `sanitizePath()` rejecting `..` and absolute paths | | M | T-004, T-008 | REQ-SVC-001 |
| T-010 | Implement `FileManager.writeSpecFile()` — atomic write (temp + rename), directory creation, `force` parameter | | M | T-009 | REQ-SVC-002 |
| T-011 | Implement `FileManager.readSpecFile()`, `listSpecFiles()`, `fileExists()`, `listFeatures()` | | S | T-009 | REQ-SVC-001 |
| T-012 | Implement `FileManager.scanDirectory()` — recursive with depth limit and exclude patterns | | M | T-009 | REQ-SVC-010 |
| T-013 | Implement `StateMachine` — `loadState()` / `saveState()` reading/writing `.sdd-state.json` | | M | T-009 | REQ-SVC-004 |
| T-014 | Implement `StateMachine.canTransition()` and `advancePhase()` — phase order enforcement with required file checks | | M | T-013 | REQ-SVC-003, REQ-PIPE-008 |
| T-015 | Implement `TemplateEngine.render()` — load `.md` template, replace `{{variables}}`, leave unknown as `[TODO]` | [P] | M | T-009 | REQ-SVC-005 |
| T-016 | Implement `TemplateEngine.renderWithFrontmatter()` — YAML frontmatter generation | [P] | S | T-015 | REQ-SVC-006 |
| T-017 | Implement `EarsValidator.detectPattern()` — regex-based detection of 6 EARS patterns | [P] | M | T-004 | REQ-SVC-007 |
| T-018 | Implement `EarsValidator.suggestImprovement()` — rewrite suggestions for non-matching requirements | [P] | S | T-017 | REQ-SVC-008 |
| T-019 | Implement `CodebaseScanner.detectTechStack()` — read package manifests, return language/framework/runtime | [P] | M | T-009 | REQ-SVC-009 |
| T-020 | Implement `CodebaseScanner.scan()` — combine directory tree + tech stack into CodebaseSummary | | S | T-012, T-019 | REQ-SVC-009, REQ-SVC-010 |
| T-021 | Create all 7 template files in `templates/` — constitution, specification, design, tasks, analysis, bugfix, sync-report | | L | T-015 | REQ-UTIL-002, REQ-SVC-005 |

**Verification:** Each service can be instantiated and tested with mock data. FileManager creates/reads files. StateMachine rejects invalid transitions.

**Phase 2 total: 13 tasks (5 parallel), Effort: ~10 hours**

---

## Phase 3: Pipeline Tools

**Goal:** All 8 pipeline tools registered and functional.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-022 | Create `src/schemas/common.ts` — shared Zod schemas: spec_dir, feature_number, force | | S | T-003 | REQ-PIPE-001 |
| T-023 | Create `src/schemas/pipeline.ts` — Zod `.strict()` schemas for all 8 pipeline tool inputs | | M | T-022 | REQ-PIPE-001 to REQ-PIPE-008 |
| T-024 | Register `sdd_init` — create .specs dir, write CONSTITUTION.md, init state | | M | T-023, T-010, T-013, T-015 | REQ-PIPE-001 |
| T-025 | Register `sdd_discover` — generate 7 structured discovery questions based on project_idea | | M | T-023, T-014 | REQ-PIPE-002 |
| T-026 | Register `sdd_write_spec` — validate EARS, write SPECIFICATION.md via TemplateEngine | | L | T-023, T-017, T-015 | REQ-PIPE-003 |
| T-027 | Register `sdd_clarify` — read SPECIFICATION.md, return disambiguation questions | | M | T-023, T-011 | REQ-PIPE-004 |
| T-028 | Register `sdd_write_design` — write DESIGN.md with Mermaid diagrams and ADRs | | M | T-023, T-015 | REQ-PIPE-005 |
| T-029 | Register `sdd_write_tasks` — write TASKS.md with gates, [P] markers, dependencies | | M | T-023, T-015 | REQ-PIPE-006 |
| T-030 | Register `sdd_run_analysis` — read all specs, write ANALYSIS.md, return gate decision JSON | | L | T-023, T-011, T-015 | REQ-PIPE-007 |
| T-031 | Register `sdd_advance_phase` — validate files, transition state machine | | M | T-023, T-014 | REQ-PIPE-008 |

**Verification:** MCP Inspector shows all 8 tools. Calling `sdd_init` → `sdd_discover` → `sdd_write_spec` creates files on disk.

**Phase 3 total: 10 tasks (0 parallel — sequential due to inter-dependencies), Effort: ~10 hours**

---

## Phase 4: Utility Tools + Analysis

**Goal:** All 6 utility tools registered. Full 14-tool inventory complete.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-032 | Create `src/schemas/utility.ts` — Zod schemas for all 6 utility tool inputs | | S | T-022 | REQ-UTIL-001 to REQ-UTIL-006 |
| T-033 | Register `sdd_get_status` — read state + list files on disk, return structured JSON | [P] | M | T-032, T-013 | REQ-UTIL-001 |
| T-034 | Register `sdd_get_template` — return raw template without writing files | [P] | S | T-032, T-021 | REQ-UTIL-002 |
| T-035 | Register `sdd_write_bugfix` — write BUGFIX_SPEC.md (not gated by state machine) | [P] | M | T-032, T-015 | REQ-UTIL-003 |
| T-036 | Register `sdd_check_sync` — compare spec requirements vs code file summaries | | M | T-032, T-011, T-019 | REQ-UTIL-004 |
| T-037 | Register `sdd_scan_codebase` — return project structure and tech stack | [P] | S | T-032, T-020 | REQ-UTIL-005 |
| T-038 | Register `sdd_amend` — append amendment to CONSTITUTION.md, update frontmatter | | M | T-032, T-010 | REQ-UTIL-006 |

**Verification:** `tools/list` returns all 14 tools. `sdd_get_status` reports correct state. `sdd_scan_codebase` detects tech stack.

**Phase 4 total: 7 tasks (4 parallel), Effort: ~6 hours**

---

## Phase 5: Integration (Agents + Commands)

**Goal:** Updated agents and commands that reference MCP tools and work across the full pipeline.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-039 | Write `spec-engineer.agent.md` — tools frontmatter (all 14), full pipeline workflow instructions | | M | T-031, T-038 | REQ-INT-001, REQ-INT-002 |
| T-040 | Write `design-architect.agent.md` — tools frontmatter (design subset), design workflow | [P] | M | T-039 | REQ-INT-001 |
| T-041 | Write `task-planner.agent.md` — tools frontmatter (task subset), task breakdown workflow | [P] | M | T-039 | REQ-INT-001 |
| T-042 | Write `spec-reviewer.agent.md` — tools frontmatter (analysis subset), quality gate workflow | [P] | M | T-039 | REQ-INT-001 |
| T-043 | Write `sdd-spec.md` Claude command — uses $ARGUMENTS, calls sdd_init + sdd_discover + sdd_write_spec | | M | T-031 | REQ-INT-003 |
| T-044 | Write `sdd-design.md` Claude command — calls sdd_write_design | [P] | S | T-043 | REQ-INT-003 |
| T-045 | Write `sdd-tasks.md` Claude command — calls sdd_write_tasks | [P] | S | T-043 | REQ-INT-003 |
| T-046 | Write `sdd-analyze.md` Claude command — calls sdd_run_analysis | [P] | S | T-043 | REQ-INT-003 |
| T-047 | Write `sdd-bugfix.md` Claude command — calls sdd_write_bugfix | [P] | S | T-043 | REQ-INT-003 |
| T-048 | Create `.vscode/mcp.json.example` with npx specky config | | S | T-006 | REQ-INT-004 |

**Verification:** In VS Code, agent lists MCP tools. In Claude Code, `/sdd:spec "test"` triggers pipeline.

**Phase 5 total: 10 tasks (7 parallel), Effort: ~6 hours**

---

## Phase 6: Quality + Release

**Goal:** Production-ready with docs, Docker, and all quality gates passing.

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-049 | Write `README.md` — project description, creator credit, install (npm/npx/Docker), VS Code + Claude setup, tool reference, comparison table | | L | T-038, T-048 | REQ-QUAL-005 |
| T-050 | Create `Dockerfile` — multi-stage build, slim Node.js image, HTTP mode | [P] | M | T-005 | REQ-QUAL-004 |
| T-051 | Create `docker-compose.yml` — HTTP mode on port 3200 | [P] | S | T-050 | REQ-QUAL-004 |
| T-052 | Create `LICENSE` (MIT) with Paula Silva attribution | [P] | S | Gates | Constitution 1.3 |
| T-053 | Verify `npm run build` compiles without errors — zero `any` types | | S | T-038 | REQ-QUAL-001, REQ-QUAL-002 |
| T-054 | Run full pipeline integration test: init → discover → write_spec → clarify → write_design → write_tasks → run_analysis | | L | T-038 | All REQ-PIPE |
| T-055 | Verify all 14 tool annotations (readOnlyHint, destructiveHint, etc.) | | M | T-038 | REQ-QUAL-006, REQ-INT-006 |
| T-056 | Final cross-reference check — every REQ has at least one task, every task traces to a REQ | | M | T-055 | ANALYSIS.md |

**Verification:** `npm run build` clean, Docker builds, full pipeline test passes, ANALYSIS.md gate = APPROVE.

**Phase 6 total: 8 tasks (3 parallel), Effort: ~8 hours**

---

## Dependency Graph

```
Gates ──┬── T-001 (package.json) ──── T-005 (index.ts) ──── T-006 (shebang)
        │                                  │                      │
        ├── T-002 (tsconfig) ──────────────┘                      │
        ├── T-003 (constants) ─────────────┘                      │
        └── T-004 (types) ─────────┐                              │
                                   │                              │
        T-008 (workspace) ─────────┤                              │
                                   │                              │
        T-009 (FileManager) ───────┤                              │
        T-010 (FM.write) ─────────┤                              │
        T-011 (FM.read) ──────────┤                              │
        T-012 (FM.scan) ──────────┤                              │
                                   │                              │
        T-013 (StateMachine) ──────┤                              │
        T-014 (SM.advance) ───────┤                              │
                                   │                              │
        T-015 (TemplateEngine) ────┤                              │
        T-016 (TE.frontmatter) ───┤                              │
        T-017 (EarsValidator) ─────┤                              │
        T-018 (EV.suggest) ───────┤                              │
        T-019 (Scanner.tech) ──────┤                              │
        T-020 (Scanner.scan) ──────┤                              │
        T-021 (templates/) ────────┘                              │
                                                                  │
        T-022 (schemas/common) ────┐                              │
        T-023 (schemas/pipeline) ──┤                              │
        T-024..T-031 (pipeline) ───┤                              │
        T-032 (schemas/utility) ───┤                              │
        T-033..T-038 (utility) ────┘                              │
                                                                  │
        T-039..T-048 (agents+cmds) ───────────────────────────────┘
                                                                  │
        T-049..T-056 (quality+release) ───────────────────────────┘
```

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: Project Scaffold | 8 | 3 | ~4h |
| Phase 2: Services Layer | 13 | 5 | ~10h |
| Phase 3: Pipeline Tools | 10 | 0 | ~10h |
| Phase 4: Utility Tools | 7 | 4 | ~6h |
| Phase 5: Integration | 10 | 7 | ~6h |
| Phase 6: Quality + Release | 8 | 3 | ~8h |
| **Total** | **56** | **22** | **~44h** |

**Effort key:** S = Small (<30 min), M = Medium (30-90 min), L = Large (90+ min)

With parallel execution, **effective implementation time is ~30 hours** for a senior engineer or coding agent.
