---
title: "Specky — Cognitive Debt Metrics — Project Constitution"
feature_id: "005-cognitive-debt-metrics"
project_id: specky-cognitive-debt
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
last_amended: 2026-04-12
amendment_count: 0
---

# Specky — Cognitive Debt Metrics — Project Constitution

> Instrument Specky's LGTM gates to detect cognitive surrender — developers approving spec artifacts without modification — providing the first measurable signal of cognitive debt accumulation in AI-native development workflows.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky becomes the first SDD tool that measures cognitive debt, not just technical debt. Teams that use Specky can quantify whether developers are genuinely engaging with AI-generated specs or rubber-stamping them — the critical difference between AI-assisted and AI-dependent development.

### 1.2 Mission Statement

Instrument the LGTM gate in the Specky pipeline to record whether each artifact was modified before approval. Expose two new metrics in `sdd_metrics`: `lgtm_without_modification_rate` and `spec_to_implementation_delta`. Both are leading indicators of cognitive surrender as defined by Storey (arXiv:2603.22106).

### 1.3 Problem Statement

The Triple Debt paper (arXiv:2603.22106) defines cognitive debt as the gap between what developers accept and what they understand. When a developer approves a LGTM gate without modifying the artifact, they may be accepting AI-generated content they do not fully understand. This is cognitive surrender. Specky currently has no way to detect or measure this pattern.

A large-scale study of 304,362 AI-authored commits in 6,275 repos (arXiv:2603.28592) found that AI-generated code introduces higher shares of requirement debt and test debt. The pattern starts at the spec level — requirements accepted without scrutiny become code accepted without scrutiny.

### 1.4 Success Criteria

- **SC-001:** LGTM gate records whether the artifact was modified before approval in `.sdd-state.json`
- **SC-002:** `sdd_metrics` includes `lgtm_without_modification_rate` (% of gates approved without edit)
- **SC-003:** `sdd_metrics` includes `spec_to_implementation_delta` (requirements count diff between Specify and Verify)
- **SC-004:** `sdd_get_status` shows a cognitive debt warning when `lgtm_without_modification_rate > 70%`
- **SC-005:** Metrics are per-feature and aggregate across all features in the workspace
- **SC-006:** No forced changes — the metric is informational, not a gate blocker

### 1.5 Constraints

| Constraint | Detail |
|------------|--------|
| Informational only | Cognitive debt metrics NEVER block pipeline advancement |
| Privacy-safe | No developer identity is stored — metrics are aggregate counts only |
| Additive to .sdd-state.json | New fields added to state schema, not breaking existing structure |
| No external telemetry | All metrics stored locally in .sdd-state.json and .specky/metrics.json |

### 1.6 Out of Scope

- Individual developer attribution
- Forced modification requirements before LGTM
- Integration with external dashboards (metrics are local JSON only)

---

## Article 2: Metric Definitions

| Metric | Definition | Formula |
|--------|-----------|---------|
| `lgtm_without_modification_rate` | % of LGTM gates approved without any file modification | `unmodified_gates / total_gates * 100` |
| `spec_to_implementation_delta` | Count of requirements that changed between Specify and Verify phases | `abs(specify_req_count - verify_req_count)` |
| `cognitive_debt_score` | Composite 0-100 score combining both metrics | `(lgtm_rate * 0.6) + (delta_normalized * 0.4)` |

---

## Article 3: Architecture Principles

### 3.1 Gate Instrumentation

The LGTM gate in `sdd_advance_phase` records a snapshot of the artifact's last-modified timestamp before and after the phase. If the timestamp did not change, the gate was approved without modification.

### 3.2 Aggregate, Not Individual

Metrics are counts and rates — never tied to a specific developer, timestamp, or IP. The only question answered is "was this artifact modified before approval?"

### 3.3 Warning, Not Block

A high `lgtm_without_modification_rate` triggers a visible warning in `sdd_get_status` and `sdd_metrics`. It never blocks `sdd_advance_phase`.

---

## References

- arXiv:2603.22106 — Storey 2026 — Triple Debt: Technical, Cognitive, and Intent Debt
- arXiv:2603.28592 — Liu et al. 2026 — Debt Behind the AI Boom (304,362 commits)
- arXiv:2601.20404 — AGENTS.md Impact: LLM-generated files perform 3% worse
