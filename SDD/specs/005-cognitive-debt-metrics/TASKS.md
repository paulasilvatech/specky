---
title: "Specky — Cognitive Debt Metrics — Tasks"
feature_id: "005-cognitive-debt-metrics"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
task_count: 11
parallel_tasks: 4
phases: 3
---

# Specky — Cognitive Debt Metrics — Tasks

---
**Model:** `claude-sonnet-4-6`
**Chat mode:** Agent mode
**Extended thinking:** No
**Rationale:** Implementation from approved spec with clear scope. Iterative with test feedback loop.

---

## Pre-Implementation Gates

- [ ] **Gate 1:** CONSTITUTION.md approved — informational-only constraint confirmed
- [ ] **Gate 2:** SPECIFICATION.md reviewed — 11 requirements with acceptance criteria
- [ ] **Gate 3:** sdd-state.json current schema inspected to confirm additive-only changes
- [ ] **Gate 4:** Depends on 002-enterprise-ready Phase 1 (Vitest installed)

---

## Phase 1: Gate Instrumentation

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-001 | Update `SddState` type in `src/types.ts` — add `gate_history: GateHistoryEntry[]` and `GateHistoryEntry` interface | | S | Gate 3 | REQ-STORAGE-001 |
| T-002 | Implement `recordGateEvent(specDir, phase, artifact, wasMod)` in `StateMachine` — reads mtime before/after, appends to gate_history, caps at 1000 entries | | M | T-001 | REQ-GATE-001 |
| T-003 | Update `sdd_advance_phase` handler to call `recordGateEvent` and include `cognitive_debt_warning` when `was_modified: false` | | M | T-002 | REQ-GATE-001, REQ-GATE-002 |
| T-004 | Create `src/services/__tests__/gate-instrumentation.test.ts` — 2 mtime tests + 3 rate calc tests + 2 delta tests + 1 score boundary test | [P] | M | T-003 | REQ-QUALITY-001 |

**Phase 1 total: 4 tasks (1 parallel), Effort: ~4h**

---

## Phase 2: Metrics Computation and Storage

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-005 | Create `src/services/cognitive-debt-engine.ts` — `computeMetrics(gateHistory)` returning rate, delta, score with label | | M | T-001 | REQ-METRICS-001..003 |
| T-006 | Implement `persistMetrics(specDir, metrics)` in `CognitiveDebtEngine` — atomic write to `.specky/metrics.json` | [P] | S | T-005 | REQ-STORAGE-002 |
| T-007 | Update `sdd_metrics` tool to call `CognitiveDebtEngine.computeMetrics()` and include all three metrics in response | | M | T-005 | REQ-METRICS-001..003 |
| T-008 | Update `sdd_get_status` to include `cognitive_debt_alert` when rate > 70% | [P] | S | T-005 | REQ-METRICS-004 |

**Phase 2 total: 4 tasks (2 parallel), Effort: ~3h**

---

## Phase 3: Quality

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-009 | Add `.specky/metrics.json` to `.gitignore` template | [P] | S | — | REQ-STORAGE-002 |
| T-010 | Test: sdd_advance_phase with unmodified artifact still advances phase | | S | T-003 | REQ-QUALITY-002 |
| T-011 | Update CLAUDE.md with cognitive debt metrics documentation | [P] | S | T-007 | — |

**Phase 3 total: 3 tasks (2 parallel), Effort: ~1h**

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: Gate Instrumentation | 4 | 1 | ~4h |
| Phase 2: Metrics | 4 | 2 | ~3h |
| Phase 3: Quality | 3 | 2 | ~1h |
| **Total** | **11** | **4** | **~8h** |
