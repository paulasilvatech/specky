---
name: spec-sync
description: "Compare implementation against SPECIFICATION.md and DESIGN.md; flag drift"
trigger: "after code changes"
model: claude-haiku-3.5
enabled: true
---

# Spec-Sync Hook

Continuously validates that implementation matches specification and design documents. Flags any divergence and suggests updates to either code or specs.

## Trigger Event

- Code changes in `src/`, `lib/`, or `app/`
- SPECIFICATION.md or DESIGN.md modified
- Manual sync check requested

## Execution Steps

1. **Read specification** from SPECIFICATION.md (acceptance criteria, requirements)
2. **Read design** from DESIGN.md (architecture, interfaces, algorithms)
3. **Read implementation** from changed code files
4. **Map acceptance criteria** to code sections
5. **Check for drift**:
   - Missing implementations vs. spec
   - Extra features not in spec (scope creep)
   - Design changes not reflected in code
   - Code changes not reflected in design docs
6. **Generate SYNC_REPORT.md** with findings

## Output Format

```markdown
# Spec-Sync Report

Generated: [ISO timestamp]
Comparison: SPECIFICATION.md ↔ DESIGN.md ↔ Implementation

## Status Summary
- Total Criteria: [N]
- Implemented: [N]
- Pending: [N]
- Drifted: [N]

## Drift Analysis

### Missing Implementations
- [spec criterion] → [file] → NOT FOUND

### Extra Implementations
- [code feature] → [file] → NOT IN SPEC

### Design Drift
- [design doc] conflicts with [code] in [file]

## Recommended Actions
1. [action to realign spec or code]
```

## Traceability Matrix

Each finding includes a trace ID linking:
- Spec requirement ID
- Design section reference
- Code file location
- Status (implemented / pending / drifted)

## Model Configuration

- **Model:** claude-haiku-3.5 (precision)
- **Temperature:** 0.2 (objective comparison)
- **Max tokens:** 3000

## Notes

- This hook is the "source of truth" for spec-code alignment
- Run before every PR merge
- Store reports in `reports/traceability/`
- Do not modify code or specs; only report drift
