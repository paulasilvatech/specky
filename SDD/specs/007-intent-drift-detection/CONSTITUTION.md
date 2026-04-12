---
title: "Specky — Intent Drift Detection — Project Constitution"
feature_id: "007-intent-drift-detection"
project_id: specky-intent-drift
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
last_amended: 2026-04-12
amendment_count: 0
---

# Specky — Intent Drift Detection — Project Constitution

> Detect when the CONSTITUTION.md has drifted from the system's actual implementation over time, measuring intent debt accumulation — the most dangerous and least visible of the three debts in the Triple Debt model.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky becomes the first tool that makes intent debt measurable. When the goals and constraints captured in CONSTITUTION.md no longer match what the system actually implements, developers know — before the gap becomes a crisis.

### 1.2 Problem Statement

Intent debt (arXiv:2603.22106) accumulates when organizational goals, constraints, and rationale are not updated as the system evolves. The CONSTITUTION.md is written once and rarely revisited. Over time, the system diverges from its stated principles. Neither humans nor AI agents detect this drift because no one compares the constitution against the implementation systematically.

The CA-MCP paper (arXiv:2601.11595) proposes Shared Context Store to keep agent context synchronized. The Codified Context paper (arXiv:2602.20478) identifies context collapse as the primary failure in long-running development — the constitution becomes stale and agents optimize for the wrong goals.

### 1.3 Success Criteria

- **SC-001:** `sdd_check_sync` enhanced to compare CONSTITUTION.md principles against SPECIFICATION.md requirements and task completion status
- **SC-002:** Drift report identifies which constitutional principles have no corresponding requirements or tasks
- **SC-003:** `sdd_metrics` includes `intent_drift_score` (0–100) measuring how much the constitution has diverged
- **SC-004:** `sdd_amend` creates a constitution amendment suggestion when drift > 40%
- **SC-005:** Temporal tracking — drift score can be compared across versions using `.sdd-state.json` history

### 1.4 Constraints

| Constraint | Detail |
|------------|--------|
| Heuristic, not deterministic | Drift detection uses keyword matching + section coverage, not LLM inference |
| Informational only | Drift score never blocks pipeline advancement |
| Additive to sdd_check_sync | New drift analysis is an additional section in the existing sync report |

---

## References

- arXiv:2603.22106 — Storey 2026 — Triple Debt: Intent Debt definition
- arXiv:2602.20478 — Vasilopoulos 2026 — Codified Context: context collapse
- arXiv:2601.11595 — Jayanti et al. 2026 — CA-MCP: Shared Context Store
