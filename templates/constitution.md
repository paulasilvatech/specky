<!-- markdownlint-disable -->
# {{project_name}} — Constitution

> The foundational charter for the **{{project_name}}** project, establishing principles, constraints, and success criteria.

---

## Article 1: Project Identity

- **Name:** {{project_name}}
- **Description:** {{description}}
- **Creator:** {{author}}
- **License:** {{license}}

---

## Article 2: Principles

{{#each principles}}
- {{this}}
{{/each}}

---

## Article 3: Constraints

{{#each constraints}}
- {{this}}
{{/each}}

---

## Article 4: Success Criteria

| ID | Criterion | Measure |
|----|-----------|---------|
| SC-001 | Project compiles without errors | `npm run build` exits 0 |
| SC-002 | All requirements traceable | Every REQ has design + task mapping |
| SC-003 | Quality gates pass | Analysis gate returns APPROVE |

---

## Article 5: Scope

### In Scope
- {{scope_in}}

### Out of Scope
- {{scope_out}}

---

## Amendment Log

| # | Date | Author | Rationale | Articles Affected |
|---|------|--------|-----------|-------------------|
| — | — | — | Initial version | All |
