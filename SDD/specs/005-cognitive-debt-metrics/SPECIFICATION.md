---
title: "Specky — Cognitive Debt Metrics — Specification"
feature_id: "005-cognitive-debt-metrics"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
ears_notation: true
requirement_count: 11
categories: [GATE, METRICS, TOOL, QUALITY]
---

# Specky — Cognitive Debt Metrics — Specification

---

## 1. LGTM Gate Instrumentation (REQ-GATE)

### REQ-GATE-001: Modification Detection on sdd_advance_phase (Event-driven)

When `sdd_advance_phase` is called, the system shall compare the artifact's file modification timestamp at gate entry vs the last recorded write timestamp, and record whether the artifact was modified before approval.

**Acceptance Criteria:**
- `.sdd-state.json` gains a `gate_history` array per feature
- Each entry: `{ phase, timestamp, artifact, was_modified: boolean }`
- `was_modified: true` when file mtime changed since phase entry
- `was_modified: false` when file mtime is unchanged (cognitive surrender signal)
- Gate history is append-only — never modified after writing

**Traces to:** SC-001 | **Evidence:** arXiv:2603.22106

---

### REQ-GATE-002: Unmodified Gate Warning in sdd_advance_phase Response (Event-driven)

When `sdd_advance_phase` completes and `was_modified: false`, the system shall include a `cognitive_debt_warning` field in the response with an educational message.

**Acceptance Criteria:**
- `cognitive_debt_warning` field is present when `was_modified: false`
- Field is absent when `was_modified: true`
- Message text: "Artifact approved without modification. Consider whether the AI-generated content reflects your actual requirements. Unmodified approvals are a leading indicator of cognitive debt (arXiv:2603.22106)."
- Warning is informational — gate still advances

**Traces to:** SC-004, SC-006 | **Evidence:** arXiv:2603.22106

---

## 2. Cognitive Debt Metrics (REQ-METRICS)

### REQ-METRICS-001: lgtm_without_modification_rate in sdd_metrics (Ubiquitous)

The `sdd_metrics` tool shall include `lgtm_without_modification_rate` as a percentage of total LGTM gates approved without file modification, both per-feature and aggregate.

**Acceptance Criteria:**
- `metrics.per_feature[feature_id].lgtm_without_modification_rate` is a number 0–100
- `metrics.aggregate.lgtm_without_modification_rate` is a number 0–100
- Rate is 0 when no gates have been processed
- Rate updates on every `sdd_advance_phase` call

**Traces to:** SC-002, SC-005 | **Evidence:** arXiv:2603.22106

---

### REQ-METRICS-002: spec_to_implementation_delta in sdd_metrics (Ubiquitous)

The `sdd_metrics` tool shall include `spec_to_implementation_delta` counting the number of requirements that changed between the Specify phase snapshot and the Verify phase snapshot.

**Acceptance Criteria:**
- Specify phase snapshot stores requirement count in gate_history
- Verify phase snapshot stores requirement count in gate_history
- `spec_to_implementation_delta = abs(specify_count - verify_count)`
- Delta of 0 means spec was faithfully implemented (positive signal)
- Delta > 20% of specify_count triggers a drift warning

**Traces to:** SC-003, SC-005 | **Evidence:** arXiv:2603.28592

---

### REQ-METRICS-003: Cognitive Debt Score in sdd_metrics (Ubiquitous)

The `sdd_metrics` tool shall compute a composite `cognitive_debt_score` (0–100) combining `lgtm_without_modification_rate` and normalized `spec_to_implementation_delta`.

**Acceptance Criteria:**
- Score 0–30: healthy (green label)
- Score 31–70: caution (yellow label)
- Score 71–100: high risk (red label)
- Score formula: `(lgtm_rate * 0.6) + (delta_normalized * 0.4)` where delta_normalized = min(delta/spec_count * 100, 100)
- Label and score both present in response

**Traces to:** SC-002, SC-003 | **Evidence:** arXiv:2603.22106

---

### REQ-METRICS-004: High-Rate Warning in sdd_get_status (State-driven)

While `lgtm_without_modification_rate > 70%`, the `sdd_get_status` response shall include a `cognitive_debt_alert` field with a recommended action.

**Acceptance Criteria:**
- Alert present when rate > 70%
- Alert absent when rate <= 70%
- Alert text explains cognitive surrender and links to arXiv:2603.22106
- Recommended action: "Review spec artifacts manually before next phase advance"

**Traces to:** SC-004 | **Evidence:** arXiv:2603.22106

---

## 3. Metrics Storage (REQ-STORAGE)

### REQ-STORAGE-001: gate_history in sdd-state.json (Ubiquitous)

The `.sdd-state.json` schema shall include a `gate_history` array storing gate instrumentation records per feature.

**Acceptance Criteria:**
- `gate_history` is an array, empty by default
- Each entry is immutable after writing
- File size growth is bounded: max 1,000 entries per feature (older entries dropped)
- Format: `{ phase, timestamp: ISO8601, artifact, was_modified, req_count? }`

**Traces to:** SC-001

---

### REQ-STORAGE-002: metrics.json Persistence (Ubiquitous)

Computed metrics shall be persisted to `.specky/metrics.json` after every `sdd_advance_phase` call.

**Acceptance Criteria:**
- `.specky/metrics.json` created on first gate event
- File updated atomically (write to temp, rename)
- File is gitignored by default
- Format is human-readable JSON

**Traces to:** SC-005

---

## 4. Quality (REQ-QUALITY)

### REQ-QUALITY-001: Unit Tests for Gate Instrumentation (Ubiquitous)

The test suite shall verify modification detection for modified and unmodified artifacts.

**Acceptance Criteria:**
- 2 tests: was_modified true/false based on mtime
- 3 tests: lgtm_without_modification_rate calculation at 0%, 50%, 100%
- 2 tests: spec_to_implementation_delta calculation
- 1 test: cognitive_debt_score boundary conditions

**Traces to:** SC-001, SC-002, SC-003

---

### REQ-QUALITY-002: No Pipeline Blockage (Ubiquitous)

The test suite shall verify that sdd_advance_phase always advances the phase regardless of was_modified value.

**Acceptance Criteria:**
- `sdd_advance_phase` with unmodified artifact returns phase transition success
- `cognitive_debt_warning` present in response but `isError: false`
- Phase advances to next phase in both modified and unmodified cases

**Traces to:** SC-006
