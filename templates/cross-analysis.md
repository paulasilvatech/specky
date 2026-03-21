# Cross-Artifact Analysis: {{title}}

**Feature**: {{feature_id}}
**Date**: {{date}}
**Consistency Score**: {{consistency_score}}%

---

## Spec → Design Alignment

| Requirement | In Design? | Detail |
|-------------|-----------|--------|
{{#each spec_design_alignment}}
| {{source_id}} | {{status}} | {{detail}} |
{{/each}}

## Design → Tasks Alignment

| Requirement | Has Tasks? | Detail |
|-------------|-----------|--------|
{{#each design_tasks_alignment}}
| {{source_id}} | {{status}} | {{detail}} |
{{/each}}

## Orphaned Requirements

{{#each orphaned_requirements}}
- {{this}} — No design or task coverage
{{/each}}

## Orphaned Tasks

{{#each orphaned_tasks}}
- {{this}} — Not traced to any requirement
{{/each}}

## Traceability Diagram

```mermaid
{{diagram}}
```

## Recommendation

{{recommendation}}
