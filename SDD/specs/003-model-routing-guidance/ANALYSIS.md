---
title: "Specky — Model Routing Guidance — Analysis"
feature_id: "003-model-routing-guidance"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
gate_decision: APPROVE
coverage_percent: 100
requirement_count: 13
task_count: 14
---

# Specky — Model Routing Guidance — Analysis

---

## 1. Traceability Matrix

### 1.1 Routing Response Field (REQ-ROUTING)

| Requirement | Design Section | Tasks | Status |
|-------------|---------------|-------|--------|
| REQ-ROUTING-001: model_routing_hint on all responses | §4 Response Injection | T-008, T-009, T-010 | Covered |
| REQ-ROUTING-002: next_phase_routing on sdd_advance_phase | §4 Response Injection | T-011 | Covered |
| REQ-ROUTING-003: routing_savings on sdd_get_status | §4 Response Injection | T-012 | Covered |

**ROUTING coverage: 3/3 (100%)**

### 1.2 ModelRoutingEngine Service (REQ-ENGINE)

| Requirement | Design Section | Tasks | Status |
|-------------|---------------|-------|--------|
| REQ-ENGINE-001: Static routing table, 10 phases | §3 ModelRoutingEngine Interface | T-001 | Covered |
| REQ-ENGINE-002: Complexity signal override >10 files | §3 getHint() | T-002 | Covered |
| REQ-ENGINE-003: Feedback loop detection, implement never thinks | §3 getHint() | T-002 | Covered |
| REQ-ENGINE-004: LLM-over-framework note | §5 Response Shape | T-007 | Covered |

**ENGINE coverage: 4/4 (100%)**

### 1.3 sdd_model_routing Tool (REQ-TOOL)

| Requirement | Design Section | Tasks | Status |
|-------------|---------------|-------|--------|
| REQ-TOOL-001: Full routing decision table | §5 Response Shape | T-006, T-007 | Covered |
| REQ-TOOL-002: Team size configuration | §4 calculateCostSavings | T-004, T-007 | Covered |
| REQ-TOOL-003: Mermaid routing diagram | §6 Mermaid Diagram | T-007 | Covered |

**TOOL coverage: 3/3 (100%)**

### 1.4 Quality (REQ-QUALITY)

| Requirement | Design Section | Tasks | Status |
|-------------|---------------|-------|--------|
| REQ-QUALITY-001: Unit tests for all phases | §3 ROUTING_TABLE | T-005 | Covered |
| REQ-QUALITY-002: Evidence ID validation | §3 evidence_id fields | T-005 | Covered |
| REQ-QUALITY-003: No breaking changes | §4 Injection Pattern | T-013, T-014 | Covered |

**QUALITY coverage: 3/3 (100%)**

---

## 2. Coverage Report

| Category | Requirements | Designed | Tasks | Coverage |
|----------|-------------|----------|-------|----------|
| ROUTING | 3 | 3 | 3 | **100%** |
| ENGINE | 4 | 4 | 4 | **100%** |
| TOOL | 3 | 3 | 3 | **100%** |
| QUALITY | 3 | 3 | 3 | **100%** |
| **Total** | **13** | **13** | **13** | **100%** |

Orphan tasks: None. Orphan requirements: None.

---

## 3. Gap Analysis

| Gap | Severity | Resolution |
|-----|----------|------------|
| No persistence of team_size across sessions | Low | Use `.specky/config.yml` (already planned in 002) |
| Mermaid diagram not tested programmatically | Low | Manual verification in VS Code preview sufficient |
| GPT-4.5 not included in routing table by default | Low | Added as fallback only; primary table uses Claude models |

---

## 4. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| StateMachine.loadState() unavailable in some tool contexts | Medium | Medium | Fall back to 'implement' phase hint when state unknown |
| 53 tools need injection — high surface area for mistakes | Medium | Low | `appendRoutingHint` helper ensures consistent application |
| arXiv IDs become stale as new papers supersede | Low | Low | Version routing table with package.json; document update process |

---

## 5. Quality Gate Decision

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| Requirement coverage | ≥ 90% | 100% | PASS |
| All requirements have acceptance criteria | 100% | 100% | PASS |
| All requirements trace to design | ≥ 90% | 100% | PASS |
| All requirements trace to tasks | ≥ 90% | 100% | PASS |
| No HIGH severity gaps | 0 | 0 | PASS |
| No CRITICAL risks without mitigation | 0 | 0 | PASS |

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   GATE DECISION:  ✅ APPROVE                            │
│                                                         │
│   Coverage: 100% (13/13 requirements traced)            │
│   Gaps: 0 HIGH, 3 LOW (all with resolutions)            │
│   Risks: 0 CRITICAL, 0 HIGH, 2 MEDIUM (mitigated)      │
│                                                         │
│   Recommendation: Proceed to implementation.            │
│   Start with Phase 1 (ModelRoutingEngine).              │
│                                                         │
│   Signed: SDD Analysis Engine                           │
│   Date: 2026-04-12                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
