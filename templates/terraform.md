<!-- markdownlint-disable -->
# Infrastructure as Code: {{title}}

**Feature**: {{feature_id}}
**Provider**: {{provider}}
**Cloud**: {{cloud}}
**Date**: {{date}}

---

## Modules

{{#each modules}}
### {{name}}

{{description}}

**Resources**: {{resources}}

{{/each}}

## Variables

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
{{#each variables}}
| {{name}} | {{type}} | {{description}} | {{default}} | {{required}} |
{{/each}}

## Architecture Diagram

```mermaid
{{diagram}}
```

## Validation

Run `sdd_validate_iac` to validate this configuration via Terraform MCP.
