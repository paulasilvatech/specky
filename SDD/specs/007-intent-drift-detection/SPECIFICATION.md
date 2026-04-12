---
title: "Specky — Intent Drift Detection — Specification"
feature_id: "007-intent-drift-detection"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
ears_notation: true
requirement_count: 10
categories: [DRIFT, ENGINE, REPORT, QUALITY]
---

# Specky — Intent Drift Detection — Specification

---

## 1. Drift Detection (REQ-DRIFT)

### REQ-DRIFT-001: Constitution Principle Extraction (Ubiquitous)

The system shall extract constitutional principles from CONSTITUTION.md by parsing H3 headings and their content under Article sections.

**Acceptance Criteria:**
- Extracts all H3 headings under `## Article` sections as principles
- Each principle has: `id`, `heading`, `keywords[]` (nouns and verbs from heading)
- Extraction is regex-based, not LLM-based
- Works on CONSTITUTION.md files following the Specky template format

**Traces to:** SC-001 | **Evidence:** arXiv:2603.22106

---

### REQ-DRIFT-002: Principle-to-Requirement Coverage (Ubiquitous)

The system shall check whether each constitutional principle has at least one corresponding requirement in SPECIFICATION.md by keyword overlap.

**Acceptance Criteria:**
- Each principle is matched against requirement descriptions using keyword overlap (min 2 keywords)
- Principles with zero matching requirements are flagged as `orphaned`
- Coverage: `covered_principles / total_principles * 100`
- Orphaned principles list is included in drift report

**Traces to:** SC-001, SC-002 | **Evidence:** arXiv:2602.20478

---

### REQ-DRIFT-003: Principle-to-Task Coverage (Ubiquitous)

The system shall check whether each constitutional principle has at least one corresponding task in TASKS.md.

**Acceptance Criteria:**
- Same keyword matching approach as REQ-DRIFT-002 applied to TASKS.md
- Principles with no matching tasks flagged as `unimplemented`
- Combined orphaned + unimplemented list forms the drift signal

**Traces to:** SC-001, SC-002 | **Evidence:** arXiv:2601.11595

---

### REQ-DRIFT-004: Intent Drift Score in sdd_metrics (Ubiquitous)

The `sdd_metrics` tool shall include an `intent_drift_score` (0–100) measuring the percentage of constitutional principles with no coverage in specs or tasks.

**Acceptance Criteria:**
- `intent_drift_score = (orphaned + unimplemented) / total_principles * 100`
- Score 0–20: aligned (green)
- Score 21–40: minor drift (yellow)
- Score 41–100: significant drift (red)
- Score and label both present in response

**Traces to:** SC-003 | **Evidence:** arXiv:2603.22106

---

### REQ-DRIFT-005: Amendment Suggestion on High Drift (State-driven)

While `intent_drift_score > 40`, the `sdd_amend` tool shall proactively generate an amendment suggestion listing the orphaned principles and recommended actions.

**Acceptance Criteria:**
- Amendment suggestion includes list of orphaned principles
- Each orphaned principle has a recommended action: `add_requirement`, `add_task`, or `remove_principle`
- Suggestion is returned as part of `sdd_amend` response, not automatically applied
- Human must explicitly call `sdd_amend` with the suggested text to apply it

**Traces to:** SC-004 | **Evidence:** arXiv:2603.22106

---

### REQ-DRIFT-006: Temporal Drift Tracking in sdd-state.json (Ubiquitous)

The system shall store a drift score snapshot in `.sdd-state.json` after every `sdd_check_sync` call, enabling historical comparison.

**Acceptance Criteria:**
- `drift_history` array in `.sdd-state.json` with entries `{ timestamp, score, orphaned_count }`
- Max 100 entries (FIFO rotation)
- `sdd_metrics` includes `drift_trend`: `improving`, `stable`, `worsening` based on last 3 snapshots

**Traces to:** SC-005 | **Evidence:** arXiv:2602.20478

---

## 2. IntentDriftEngine Service (REQ-ENGINE)

### REQ-ENGINE-001: IntentDriftEngine Service (Ubiquitous)

The system shall implement an `IntentDriftEngine` service encapsulating all drift detection logic.

**Acceptance Criteria:**
- `extractPrinciples(constitution: string): Principle[]`
- `computeCoverage(principles, spec, tasks): DriftReport`
- `computeScore(report): number`
- `computeTrend(history): 'improving' | 'stable' | 'worsening'`
- No external dependencies — regex and string operations only

**Traces to:** SC-001..SC-005

---

## 3. Reporting (REQ-REPORT)

### REQ-REPORT-001: Drift Section in sdd_check_sync Response (Ubiquitous)

The `sdd_check_sync` tool shall include an `intent_drift` section in its response with the full drift report.

**Acceptance Criteria:**
- `intent_drift.score` is 0–100
- `intent_drift.label` is aligned/minor/significant
- `intent_drift.orphaned_principles[]` lists uncovered principles
- `intent_drift.coverage_percent` is covered principles / total

**Traces to:** SC-002

---

## 4. Quality (REQ-QUALITY)

### REQ-QUALITY-001: Unit Tests for IntentDriftEngine (Ubiquitous)

The test suite shall verify principle extraction and coverage scoring.

**Acceptance Criteria:**
- 3 tests: extraction from small, medium, large CONSTITUTION.md fixtures
- 3 tests: coverage scoring at 0%, 50%, 100% orphaned
- 2 tests: trend detection (improving, worsening)

**Traces to:** SC-001..SC-005
