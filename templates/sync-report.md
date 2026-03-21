# Sync Report: {{project_name}}

> Drift analysis between specification and implementation.

---

## Summary

- **In Sync:** {{in_sync}}
- **Last Checked:** {{last_checked}}
- **Drift Items:** {{drift_count}}

---

## Requirements Coverage

| Requirement | Implementation | Status |
|-------------|---------------|--------|
{{coverage_table}}

---

## Drift Items

{{#each drift_items}}
- {{this}}
{{/each}}

---

## Orphan Code

Files not traced to any requirement:

{{#each orphan_files}}
- {{this}}
{{/each}}

---

## Recommendation

{{recommendation}}
