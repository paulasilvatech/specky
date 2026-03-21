---
name: auto-test
description: "Generate test stubs for completed tasks, mapped to acceptance criteria from SPECIFICATION.md"
trigger: "after task completion"
model: claude-haiku-3.5
enabled: true
---

# Auto-Test Hook

Automatically generates test stubs whenever a task is marked complete. Tests are derived from acceptance criteria in the specification and mapped to the completed work.

## Trigger Event

- Task marked as complete in task tracker
- `TASK_STATUS` changes to `done` or `completed`

## Execution Steps

1. **Read the completed task** from `tasks/` directory
2. **Extract acceptance criteria** from the task's linked SPECIFICATION.md reference
3. **Generate test stubs** in BDD (Gherkin) or unit test format matching the project's test framework
4. **Map coverage** — each test case references one or more acceptance criteria
5. **Write output** to `tests/auto-generated/[TASK_ID]-tests.md`
6. **Log entry** in SYNC_REPORT.md with timestamp and test count

## Output Format

```markdown
# Tests for [TASK_ID]: [Task Title]

Generated: [ISO timestamp]
Based on: SPECIFICATION.md § [spec section]
Acceptance Criteria Mapped: [count]

## Test Cases

### TC-1: [Criterion 1]
\`\`\`gherkin
Given [precondition]
When [action]
Then [expected result]
\`\`\`

## Coverage Summary
- Total test stubs: [N]
- Criteria mapped: [N]
- Orphaned criteria: [N]
```

## Model Configuration

- **Model:** claude-haiku-3.5 (speed + consistency)
- **Temperature:** 0.3 (deterministic)
- **Max tokens:** 2000

## Notes

- Test stubs should be implementation-agnostic (framework-agnostic format)
- If acceptance criteria are missing, log warning in SYNC_REPORT.md
- Do not execute tests; only generate stubs
