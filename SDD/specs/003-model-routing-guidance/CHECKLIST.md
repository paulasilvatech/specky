---
title: "Specky — Model Routing Guidance — Quality Checklist"
feature_id: "003-model-routing-guidance"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
domain: "Model Routing"
mandatory_pass_rate: 0
---

# Quality Checklist: Model Routing Guidance

**Mandatory Pass Rate:** 100% before merge

| ID | Check | Mandatory | Status | Evidence |
|----|-------|-----------|--------|----------|
| CHK-001 | `ModelRoutingEngine` instantiates without errors | Yes | ⬜ Pending | — |
| CHK-002 | `getHint('specify')` returns `thinking: true` and `model: claude-opus-4-6` | Yes | ⬜ Pending | — |
| CHK-003 | `getHint('implement')` returns `thinking: false` in all conditions including file_count > 10 | Yes | ⬜ Pending | — |
| CHK-004 | `getHint('release')` returns `model: claude-haiku-4-5` | Yes | ⬜ Pending | — |
| CHK-005 | All 53 tool responses include `model_routing_hint` field | Yes | ⬜ Pending | — |
| CHK-006 | `sdd_advance_phase` to Specify includes `next_phase_routing.thinking: true` | Yes | ⬜ Pending | — |
| CHK-007 | `sdd_get_status` includes `routing_savings.savings_percent > 0` | Yes | ⬜ Pending | — |
| CHK-008 | `sdd_model_routing` returns Mermaid diagram that renders in VS Code | Yes | ⬜ Pending | — |
| CHK-009 | All `evidence_id` fields match regex `arXiv:\d{4}\.\d{4,5}` | Yes | ⬜ Pending | — |
| CHK-010 | `npm run build` compiles with zero errors | Yes | ⬜ Pending | — |
| CHK-011 | `npm test` passes with zero failures (all existing + new tests) | Yes | ⬜ Pending | — |
| CHK-012 | No existing tool Zod schema breaks | Yes | ⬜ Pending | — |
| CHK-013 | `sdd_model_routing` with `team_size: 100` returns `savings_percent >= 30` | No | ⬜ Pending | — |

## Summary

- **Total:** 13
- **Passed:** 0
- **Pending:** 13
- **Mandatory Pass Rate:** 0% (not started)
