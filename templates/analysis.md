# {{project_name}} — Analysis

> Traceability matrix, coverage report, gap analysis, and quality gate decision.

---

## Gate Decision

**Decision:** {{gate_decision}}
**Coverage:** {{coverage_percent}}%
**Date:** {{date}}

---

## Traceability Matrix

| Requirement | Design Component | Task | Test | Status |
|-------------|-----------------|------|------|--------|
{{traceability_matrix}}

---

## Coverage Report

- **Requirements with design mapping:** {{design_coverage}}
- **Requirements with task mapping:** {{task_coverage}}
- **Requirements with test mapping:** {{test_coverage}}
- **Overall coverage:** {{coverage_percent}}%

---

## Gap Analysis

{{#each gaps}}
- {{this}}
{{/each}}

---

## Recommendations

{{#each recommendations}}
- {{this}}
{{/each}}

---

## Quality Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| EARS compliance | {{ears_compliance}} | 100% | {{ears_status}} |
| Requirement coverage | {{coverage_percent}}% | ≥90% | {{coverage_status}} |
| Orphan requirements | {{orphan_count}} | 0 | {{orphan_status}} |
