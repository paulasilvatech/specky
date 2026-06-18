# Model Recommendation Reference

## Purpose

This reference defines how to recommend model capability classes per SDD phase without hardcoding provider-specific model IDs.

Use this guidance to keep Specky portable across GitHub Copilot environments where model availability and policy differ by tenant.

## Recommendation Table

| Phase | Name | Recommended Class | Deep Reasoning | Rationale |
| --- | --- | --- | --- | --- |
| 0 | Init | Fast | No | Scaffolding and deterministic setup tasks |
| 1 | Discover | Balanced | No | Multi-source synthesis with moderate complexity |
| 2 | Specify | Reasoning-focused | Yes | Requirement formalization and EARS precision |
| 3 | Clarify | Reasoning-focused | Yes | Ambiguity reduction and requirement refinement |
| 4 | Design | Reasoning-focused | Yes | Architecture decisions and trade-off analysis |
| 5 | Tasks | Balanced | No | Structured task decomposition and dependency mapping |
| 6 | Analyze | Balanced | No | Cross-artifact analysis and compliance checks |
| 7 | Implement | Balanced | No | Iterative execution with test and lint feedback |
| 8 | Verify | Reasoning-focused | Yes | Coverage reasoning and drift interpretation |
| 9 | Release | Fast | No | Final validation and deterministic release tasks |

## Selection Rules

1. Always let the user choose the concrete model available in their GitHub Copilot environment.
2. Prefer fast models for deterministic, low-ambiguity tasks.
3. Prefer balanced models for iterative coding and medium-complexity workflows.
4. Prefer reasoning-focused models for ambiguity, architecture, and verification reasoning.
5. If the selected model underperforms, escalate one class up for that subtask and return to the phase default afterward.

## Escalation Rules

| Condition | Recommended Action |
| --- | --- |
| Task touches more than 10 files | Use a reasoning-focused model for planning, then return to balanced for execution |
| More than 3 service boundaries | Use reasoning-focused model for interface and contract design |
| Architecture trade-offs are unresolved | Use reasoning-focused model with explicit decision criteria |
| Security-critical findings need investigation | Use reasoning-focused model for threat and mitigation analysis |

## Practical Notes

- Do not encode concrete model IDs in agent frontmatter.
- Do not assume a specific provider model is available.
- Do not hardcode pricing values in prompts or skills unless sourced and versioned.
- Report recommendations as classes: fast, balanced, reasoning-focused.
