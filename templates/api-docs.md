<!-- markdownlint-disable -->
# API Documentation: {{title}}

**Feature**: {{feature_id}}
**Version**: {{version}}
**Base URL**: `{{base_url}}`
**Date**: {{date}}

---

{{#each endpoints}}
## {{method}} `{{path}}`

{{description}}

### Request

```json
{{request}}
```

### Response

```json
{{response}}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Internal Server Error |

---

{{/each}}
