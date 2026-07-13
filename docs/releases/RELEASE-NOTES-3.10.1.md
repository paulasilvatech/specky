# Specky 3.10.1 — Tasks Parser + Report Persistence

> Copy-paste body for the GitHub Release `v3.10.1`.

Specky 3.10.1 fixes the TASKS.md table↔checkbox mismatch that caused verify/implement/export to report "No tasks found", and closes related P0 gaps around persisted quality reports and Analyze-phase remediation.

## Highlights

### Dual TASKS.md parser

Writers emit markdown tables; readers now accept both table rows and legacy `- [ ] T-001:` checkboxes via shared `parseTasksFromMarkdown`. Wired into verify, implement, export, git progress, and Gantt diagrams.

### Honest quality reports

`COMPLIANCE.md` and `VERIFICATION.md` persist pre-rendered table rows — no more `[TODO:` placeholders for findings/results.

### Analyze remediation

After a `BLOCK` or `CHANGES_NEEDED` gate, authors can rewrite SPEC/DESIGN/TASKS in Analyze and re-run analysis. Implement/release tools remain gated until `APPROVE`.

### Generation quality

- User stories use EARS prose titles (not `(event_driven)`)
- Spec functional vs non-functional split
- Design stubs derived from SPECIFICATION.md when optional fields are omitted

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

Full details: [CHANGELOG.md](../../CHANGELOG.md)
