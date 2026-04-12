---
title: "Specky — Model Routing Guidance — Tasks"
feature_id: "003-model-routing-guidance"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
task_count: 14
parallel_tasks: 6
phases: 3
---

# Specky — Model Routing Guidance — Tasks

---
**Model:** `claude-sonnet-4-6`
**Chat mode:** Agent mode
**Extended thinking:** No
**Rationale:** Implementation from approved spec with clear scope — iterative feedback loop with tests. Opus would add cost without benefit here.

---

## Pre-Implementation Gates

- [ ] **Gate 1:** CONSTITUTION.md approved — confirms additive-only constraint
- [ ] **Gate 2:** SPECIFICATION.md reviewed — all 13 requirements have acceptance criteria
- [ ] **Gate 3:** DESIGN.md reviewed — static routing table entries verified against source papers
- [ ] **Gate 4:** Confirm `Phase` enum values in `src/constants.ts` match routing table keys

---

## Phase 1: ModelRoutingEngine Service

**Goal:** Standalone service with static routing table, fully tested, zero side effects.

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-001 | Create `src/services/model-routing-engine.ts` with `ModelRoutingHint`, `ComplexitySignal`, `CostAnalysis` interfaces and `ModelRoutingEngine` class with static `ROUTING_TABLE` (10 phases) | | M | Gate 4 | REQ-ENGINE-001 |
| T-002 | Implement `getHint(phase, signals?)` — returns base hint with complexity override for >10 files on design/implement phases | | S | T-001 | REQ-ENGINE-002, REQ-ENGINE-003 |
| T-003 | Implement `getTable()` — returns array of all phase entries | [P] | S | T-001 | REQ-TOOL-001 |
| T-004 | Implement `calculateCostSavings(teamSize, requestsPerDay?)` — computes correct vs Opus-only premium units and savings percentage | [P] | S | T-001 | REQ-ROUTING-003, REQ-TOOL-002 |
| T-005 | Create `src/services/__tests__/model-routing-engine.test.ts` — 10 phase tests + 3 complexity override tests + 2 implement-never-thinks tests + 1 evidence_id format validation | | M | T-002 | REQ-QUALITY-001, REQ-QUALITY-002 |

**Verification:** `npm test` passes. All 16 unit tests green. `getHint('implement')` never returns `thinking: true`.

**Phase 1 total: 5 tasks (2 parallel), Effort: ~3h**

---

## Phase 2: Tool Registration and Response Injection

**Goal:** All 53 existing tools emit `model_routing_hint`. New `sdd_model_routing` tool registered.

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-006 | Create `src/schemas/routing.ts` — Zod schemas for `sdd_model_routing` input (`team_size?`, `requests_per_day?`) and output | | S | T-001 | REQ-TOOL-001 |
| T-007 | Create `src/tools/routing.ts` — register `sdd_model_routing` thin tool calling `engine.getTable()`, `engine.calculateCostSavings()`, and generating Mermaid diagram | | M | T-003, T-004, T-006 | REQ-TOOL-001, REQ-TOOL-002, REQ-TOOL-003 |
| T-008 | Create shared `appendRoutingHint(response, phase, signals?)` helper in `src/utils/routing-helper.ts` — single function to inject `model_routing_hint` without duplicating code across 53 tools | | S | T-002 | REQ-ROUTING-001 |
| T-009 | Inject `model_routing_hint` into all pipeline tool handlers (pipeline.ts) using `appendRoutingHint` helper | | M | T-008 | REQ-ROUTING-001 |
| T-010 | Inject `model_routing_hint` into all utility tool handlers (utility.ts, quality.ts, integration.ts, testing.ts) | [P] | M | T-008 | REQ-ROUTING-001 |
| T-011 | Update `sdd_advance_phase` handler to add `next_phase_routing` field pointing to the destination phase hint | [P] | S | T-008 | REQ-ROUTING-002 |
| T-012 | Update `sdd_get_status` handler to add `routing_savings` section | [P] | S | T-004 | REQ-ROUTING-003 |

**Verification:** Call `sdd_init` — response includes `model_routing_hint` with Haiku 4.5. Call `sdd_advance_phase` to Specify — `next_phase_routing` shows Opus 4.6 + thinking: true.

**Phase 2 total: 7 tasks (3 parallel), Effort: ~4h**

---

## Phase 3: Quality and Release

**Goal:** No breaking changes verified. All tests pass. CI green.

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-013 | Add backward compatibility test — existing tool response Zod schemas must pass with and without `model_routing_hint` present | | S | T-010 | REQ-QUALITY-003 |
| T-014 | Update CLAUDE.md to document `sdd_model_routing` tool and `model_routing_hint` field | [P] | S | T-007 | REQ-QUALITY-003 |

**Verification:** `npm run build` clean. `npm test` all pass. `sdd_model_routing` returns Mermaid diagram. No existing test fails.

**Phase 3 total: 2 tasks (1 parallel), Effort: ~1h**

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: ModelRoutingEngine | 5 | 2 | ~3h |
| Phase 2: Tool Injection | 7 | 3 | ~4h |
| Phase 3: Quality | 2 | 1 | ~1h |
| **Total** | **14** | **6** | **~8h** |
