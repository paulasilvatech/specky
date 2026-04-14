<!-- markdownlint-disable -->
# Quality Checklist: {{title}}

**Feature**: {{feature_id}}
**Domain**: {{domain}}
**Date**: {{date}}
**Mandatory Pass Rate**: {{mandatory_pass_rate}}

---

## Checklist Items

| ID | Check | Mandatory | Status | Evidence |
|----|-------|-----------|--------|----------|
{{#each items}}
| {{id}} | {{check}} | {{mandatory}} | {{status}} | {{evidence}} |
{{/each}}

## Summary

- **Total**: {{total_items}}
- **Passed**: {{pass_count}}
- **Failed**: {{fail_count}}
- **Pending**: {{pending_count}}
- **Mandatory Pass Rate**: {{mandatory_pass_rate}}%

## Gate Decision

{{gate_decision}}
