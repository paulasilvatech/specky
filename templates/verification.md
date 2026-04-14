<!-- markdownlint-disable -->
# Task Verification Report: {{title}}

**Feature**: {{feature_id}}
**Date**: {{date}}
**Pass Rate**: {{pass_rate}}%

---

## Verification Results

| Task | Claimed | Verified | Phantom? | Evidence |
|------|---------|----------|----------|----------|
{{#each results}}
| {{task_id}} | {{claimed_status}} | {{verified_status}} | {{phantom}} | {{evidence}} |
{{/each}}

## Summary

- **Total Tasks**: {{total_tasks}}
- **Verified**: {{verified_count}}
- **Phantom Completions**: {{phantom_count}}
- **Pass Rate**: {{pass_rate}}%

## Diagram

```mermaid
{{diagram}}
```

## Gate Decision

{{gate_decision}}
