<!-- markdownlint-disable -->
# {{project_name}} — Tasks

> Sequenced implementation tasks with pre-implementation gates, `[P]` parallel markers, effort estimates, and requirement traceability.

---

## Pre-Implementation Gates

Before writing any code, the following gates must pass:

{{#each gates}}
- [ ] {{this}}
{{/each}}

---

## Task Breakdown

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| {{task_table}} | | | | | |

---

## Dependency Graph

```
{{dependency_graph}}
```

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| {{effort_summary}} | | | |
| **Total** | **{{total_tasks}}** | **{{parallel_tasks}}** | **{{total_effort}}** |
