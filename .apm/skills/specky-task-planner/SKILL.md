---
name: specky-task-planner
description: "Use for Phase 5 (Tasks): produce TASKS.md and CHECKLIST.md with dependencies, REQ traceability, and complexity. Trigger on sdd_write_tasks, sdd_checklist, or /specky-tasks."
---

# Tasks — Explicit Dependency Contract

## Preconditions

Read the approved Specification, complete Design, and signed feature contract.

## Exact Task Shape

```json
{
	"id": "T-001",
	"title": "Implement order creation",
	"description": "Implement the request path and persistence behavior for REQ-API-001.",
	"effort": "M",
	"dependencies": [],
	"parallel": false,
	"traces_to": ["REQ-API-001"]
}
```

- IDs are `T-NNN`.
- Effort is only `S`, `M`, or `L`.
- Dependencies and parallel status are explicit, even when empty/false.
- Every task traces to one or more real requirement IDs.

## Pre-Implementation Gates

`pre_impl_gates` is always supplied explicitly. Each gate has `id`, measurable `check`, and `constitution_article`. Use `[]` only when reviewed evidence establishes no gate applies.

## Exact Call

`sdd_write_tasks` requires `tasks`, `pre_impl_gates`, `spec_dir`, `feature_number`, and explicit `force`.

Call `sdd_checklist` separately with an explicit domain, feature identity, and overwrite decision. Do not imply that one generic checklist covers all workloads or capabilities.