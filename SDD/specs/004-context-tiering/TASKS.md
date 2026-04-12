---
title: "Specky — Context Tiering — Tasks"
feature_id: "004-context-tiering"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
task_count: 10
parallel_tasks: 4
phases: 2
---

# Specky — Context Tiering — Tasks

---
**Model:** `claude-sonnet-4-6`
**Chat mode:** Agent mode
**Extended thinking:** No
**Rationale:** Implementation from approved spec, clear scope, iterative test feedback loop.

---

## Pre-Implementation Gates

- [ ] **Gate 1:** CONSTITUTION.md approved — tier definitions confirmed
- [ ] **Gate 2:** SPECIFICATION.md reviewed — 10 requirements with acceptance criteria
- [ ] **Gate 3:** DESIGN.md reviewed — ContextTieringEngine interface confirmed
- [ ] **Gate 4:** Depends on 003 being merged (model_routing_hint injection pattern can be reused)

---

## Phase 1: ContextTieringEngine Service

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-001 | Create `src/services/context-tiering-engine.ts` — static `TIER_TABLE` mapping all 10 artifact filenames to Hot/Domain/Cold, `getTier(filename)`, `estimateTokens(content)` | | M | Gate 3 | REQ-TIER-001..003, REQ-ENGINE-001..002 |
| T-002 | Implement `buildContextPayload(specDir, requestedColdFiles[])` — reads Hot always, Domain if specDir provided, Cold only if explicitly listed | | M | T-001 | REQ-TIER-001..003 |
| T-003 | Implement `buildContextLoadSummary(loaded)` — returns `context_load_summary` with estimated tokens and savings vs universal | | S | T-001 | REQ-TIER-004, REQ-ENGINE-002 |
| T-004 | Create `src/services/__tests__/context-tiering-engine.test.ts` — 10 tier assignment tests + 3 estimation tests + 2 summary tests | [P] | M | T-003 | REQ-QUALITY-001 |
| T-005 | Create `src/tools/context.ts` — register `sdd_context_status` thin tool | [P] | S | T-002 | REQ-TOOL-001 |

**Phase 1 total: 5 tasks (2 parallel), Effort: ~4h**

---

## Phase 2: Injection and Regression

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-006 | Create `appendContextSummary(response, summary)` helper in `src/utils/context-helper.ts` | | S | T-003 | REQ-TIER-004 |
| T-007 | Inject `context_load_summary` into all pipeline tool handlers using helper | | M | T-006 | REQ-TIER-004 |
| T-008 | Inject `context_load_summary` into all utility, quality, integration tool handlers | [P] | M | T-006 | REQ-TIER-004 |
| T-009 | Update `sdd_get_status` to show `context_tier_summary` section | [P] | S | T-003 | REQ-TOOL-001 |
| T-010 | Regression test: full pipeline in single-feature workspace with tiering — verify all artifacts created, no errors | | M | T-008 | REQ-QUALITY-002 |

**Phase 2 total: 5 tasks (2 parallel), Effort: ~4h**

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: ContextTieringEngine | 5 | 2 | ~4h |
| Phase 2: Injection | 5 | 2 | ~4h |
| **Total** | **10** | **4** | **~8h** |
