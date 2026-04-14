<!-- markdownlint-disable -->
# Dev Container: {{title}}

**Feature**: {{feature_id}}
**Base Image**: {{base_image}}
**Date**: {{date}}

---

## Configuration

```json
{{devcontainer_json}}
```

## Included Features

{{#each features}}
- {{this}}
{{/each}}

## VS Code Extensions

{{#each extensions}}
- {{this}}
{{/each}}

## Getting Started

1. Open VS Code in the project root
2. Press `Ctrl+Shift+P` → "Dev Containers: Reopen in Container"
3. Wait for the container to build
4. Start developing!

Alternatively, use GitHub Codespaces:
- Run `sdd_setup_codespaces` to create a cloud environment
