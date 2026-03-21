Use $ARGUMENTS as additional context or constraints for the SDD task breakdown phase.

## Purpose

Decompose the approved design into sequenced implementation tasks with pre-implementation gates, effort estimates, dependency tracking, and `[P]` parallel markers — written to TASKS.md.

## Workflow

### Step 1: Verify Prerequisites

Call `sdd_get_status` to confirm:

- SPECIFICATION.md and DESIGN.md both exist on disk.
- Pipeline is in or past the "design" phase.
- If not, inform the user which phases need completion first.

### Step 2: Read Specification and Design

Read both SPECIFICATION.md and DESIGN.md to understand:

- All requirements and their acceptance criteria
- Architecture components, services, and interfaces
- ADRs and their implications for implementation order

### Step 3: Create Task Breakdown

Based on the design and any additional context from $ARGUMENTS, create:

1. **Pre-Implementation Gates** — Checklist items that must be verified before coding starts. Map each gate to a Constitution article or quality standard.

2. **Sequenced Tasks** — Each task includes:
   - `id`: Sequential ID (T-001, T-002, ...)
   - `title`: Clear, actionable task name
   - `description`: What needs to be implemented
   - `effort`: S (Small, <30 min), M (Medium, 30-90 min), L (Large, 90+ min)
   - `dependencies`: Which tasks must complete first
   - `parallel`: Whether this task can run in parallel with others (marked `[P]`)
   - Traceability to at least one requirement ID

3. **Dependency Graph** — Ensure no circular dependencies. Identify critical path.

### Step 4: Write the Tasks

Call `sdd_write_tasks` with the structured task data.

### Step 5: Present and Gate

- Show the user: total task count, parallel task count, estimated effort, phases.
- Tell the user: "Task breakdown complete. Review `.specs/{feature}/TASKS.md` and reply **LGTM** when ready to proceed to Analysis phase."

### Step 6: Advance Phase

Once the user says LGTM, call `sdd_advance_phase` to transition to the analyze phase.

## Error Handling

- If circular dependencies are detected, restructure tasks before writing.
- If a task cannot trace to any requirement, flag it as potentially out of scope.

## Tools Used

- `sdd_get_status` — Check pipeline status and prerequisites
- `sdd_write_tasks` — Write TASKS.md with gates, tasks, and dependencies
- `sdd_advance_phase` — Transition state machine to next phase
