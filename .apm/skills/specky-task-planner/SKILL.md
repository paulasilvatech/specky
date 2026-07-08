---
name: specky-task-planner
description: "Use for Phase 5 (Tasks): produce TASKS.md and CHECKLIST.md with dependencies, REQ traceability, and complexity. Trigger on sdd_write_tasks, sdd_checklist, or /specky-tasks."
---

# Phase 5 — Tasks

## Prerequisites
- Approved DESIGN.md at the Phase 4 LGTM gate

## Workflow
1. Read DESIGN.md and SPECIFICATION.md
2. Call `sdd_write_tasks` to create TASK-NNN items with [P], S/M/L/XL, dependencies, and REQ links
3. Call `sdd_checklist` for security, testing, and NFR checks
4. Present TASKS.md and CHECKLIST.md for LGTM at the Phase 5 gate

## Hard Rules
- Every task traces to at least one REQ-ID
- Parallel tasks are marked `[P]`
- Dependencies are explicit