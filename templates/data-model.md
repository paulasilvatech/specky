# Data Model: {{title}}

**Feature**: {{feature_id}}
**Date**: {{date}}

---

## Entities

{{#each entities}}
### {{name}}

**Description**: {{description}}

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
{{#each attributes}}
| {{name}} | {{type}} | {{required}} | {{description}} |
{{/each}}

{{/each}}

## Relationships

```mermaid
erDiagram
{{mermaid_erd}}
```

## Constraints

{{#each constraints}}
- {{this}}
{{/each}}
