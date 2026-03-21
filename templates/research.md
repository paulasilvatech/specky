# Research: {{title}}

**Feature**: {{feature_id}}
**Date**: {{date}}
**Status**: {{status}}

---

## Open Questions

{{#each questions}}
### {{id}}: {{question}}

**Context**: {{context}}

**Findings**: {{findings}}

**Sources**: {{sources}}

**Recommendation**: {{recommendation}}

**Status**: {{status}}

---

{{/each}}

## Summary

| Question | Status | Recommendation |
|----------|--------|---------------|
{{#each questions}}
| {{id}} | {{status}} | {{recommendation}} |
{{/each}}

## Next Steps

[TODO: next_steps]
