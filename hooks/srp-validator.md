---
name: srp-validator
description: "Validate Single Responsibility Principle; flag files/functions doing too much"
trigger: "after code changes"
model: claude-haiku-3.5
enabled: true
---

# SRP Validator Hook

Validates code against the Single Responsibility Principle (SRP) after every change. Flags functions and files that do too much and suggests decomposition.

## Trigger Event

- Code changes in `src/`, `lib/`, or `app/`
- New function added (>50 lines or >5 responsibilities detected)
- New file added (>200 lines)
- Manual SRP audit requested

## Execution Steps

1. **Analyze changed functions** — extract responsibilities
2. **Count responsibilities** using heuristics:
   - Number of reasons to change (spec dependencies)
   - Cyclomatic complexity (decision branches)
   - Function length (lines of code)
   - Parameter count
3. **Flag violations**:
   - Functions with >1 domain responsibility
   - Files with >3 related responsibilities
   - Utility files with >10 unrelated functions
4. **Generate suggestions** for decomposition
5. **Write SRP_REPORT.md** with findings

## Output Format

```markdown
# SRP Validator Report

Analyzed: [file count], [function count]
Timestamp: [ISO]
Violations: [count]

## Violations

### [file.js] - Line [N]
**Function:** \`functionName()\`
**Responsibilities:**
1. [responsibility 1 - spec dependency]
2. [responsibility 2 - spec dependency]
3. [responsibility 3 - spec dependency]

**Metrics:**
- Lines: [N]
- Complexity: [N]
- Parameters: [N]

**Suggestion:**
Extract into:
- \`validateInput()\` — handles validation
- \`processData()\` — handles transformation

## SRP Score
Overall: [percent] violations of SRP
```

## Responsibility Detection

Scans for:
- Multiple spec sections referenced
- Multiple error conditions or branches
- Multiple domain concepts (parsing + validation + logging)
- Multiple external dependencies injected

## Model Configuration

- **Model:** claude-haiku-3.5 (structural analysis)
- **Temperature:** 0.2 (objective measurement)
- **Max tokens:** 2000

## Notes

- SRP violations are warnings, not blockers (allow override with `@srp-skip` comment)
- Store reports in `reports/code-quality/`
- Use this hook to guide refactoring, not mandate it
- High complexity functions should be reviewed manually regardless of line count
