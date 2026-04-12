---
title: "Specky — Intent Drift Detection — Tasks"
feature_id: "007-intent-drift-detection"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
task_count: 10
parallel_tasks: 4
phases: 3
---

# Specky — Intent Drift Detection — Tasks

---
**Model:** `claude-sonnet-4-6`
**Chat mode:** Agent mode
**Extended thinking:** No
**Rationale:** Implementation from approved spec, regex-based logic, clear test criteria.

---

## Pre-Implementation Gates

- [ ] **Gate 1:** CONSTITUTION.md approved — heuristic-only constraint confirmed
- [ ] **Gate 2:** SPECIFICATION.md reviewed — 10 requirements
- [ ] **Gate 3:** CONSTITUTION.md template format confirmed (H3 under Article headings)
- [ ] **Gate 4:** Depends on 005 (gate_history in sdd-state.json already added)

---

## Phase 1: IntentDriftEngine Service

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-001 | Create `src/services/intent-drift-engine.ts` — `extractPrinciples()` using regex on H3 headings under Article sections | | M | Gate 3 | REQ-DRIFT-001, REQ-ENGINE-001 |
| T-002 | Implement `computeCoverage(principles, spec, tasks)` — keyword overlap matching, returns `DriftReport` with orphaned lists | | M | T-001 | REQ-DRIFT-002, REQ-DRIFT-003 |
| T-003 | Implement `computeScore(report)` and `computeTrend(history)` | | S | T-002 | REQ-DRIFT-004, REQ-DRIFT-006 |
| T-004 | Create `src/services/__tests__/intent-drift-engine.test.ts` — 3 extraction tests + 3 coverage tests + 2 trend tests | [P] | M | T-003 | REQ-QUALITY-001 |
| T-005 | Update `SddState` type in `types.ts` — add `drift_history: DriftSnapshot[]` | [P] | S | Gate 4 | REQ-DRIFT-006 |

**Phase 1 total: 5 tasks (2 parallel), Effort: ~4h**

---

## Phase 2: Tool Integration

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-006 | Update `sdd_check_sync` to call `IntentDriftEngine` and append `intent_drift` section to response | | M | T-002 | REQ-REPORT-001 |
| T-007 | Update `sdd_metrics` to include `intent_drift_score` and `drift_trend` | [P] | S | T-003 | REQ-DRIFT-004 |
| T-008 | Update `sdd_amend` to include amendment suggestion when drift > 40% | [P] | M | T-002 | REQ-DRIFT-005 |
| T-009 | Store drift snapshot in `.sdd-state.json` after every `sdd_check_sync` | | S | T-005 | REQ-DRIFT-006 |

**Phase 2 total: 4 tasks (2 parallel), Effort: ~3h**

---

## Phase 3: Quality

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-010 | Integration test: create spec with constitution, advance phases, run sdd_check_sync, verify drift score computed and stored | [P] | M | T-009 | REQ-QUALITY-001 |

**Phase 3 total: 1 task (1 parallel), Effort: ~1h**

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: IntentDriftEngine | 5 | 2 | ~4h |
| Phase 2: Tool Integration | 4 | 2 | ~3h |
| Phase 3: Quality | 1 | 1 | ~1h |
| **Total** | **10** | **4** | **~8h** |
