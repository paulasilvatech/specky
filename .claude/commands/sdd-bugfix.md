Use $ARGUMENTS as the bug description, title, or issue reference for the SDD bugfix specification workflow.

## Purpose

Create a structured BUGFIX_SPEC.md that documents the bug with current behavior, expected behavior, unchanged behavior, root cause analysis, and test plan — without requiring the full SDD pipeline.

## Workflow

### Step 1: Parse the Bug Information

Extract from $ARGUMENTS:

- **Bug title**: A concise summary of the issue
- **Current behavior**: What is happening now (the bug)
- **Expected behavior**: What should happen instead

If $ARGUMENTS only contains a brief description, ask the user for the missing details before proceeding.

### Step 2: Gather Additional Context (Optional)

If working in an existing project:

- Call `sdd_scan_codebase` to understand the tech stack and project structure.
- Call `sdd_get_status` to check if there's an existing SDD pipeline for this project.
- If a SPECIFICATION.md exists, reference relevant requirement IDs in the bugfix spec.

### Step 3: Write the Bugfix Specification

Call `sdd_write_bugfix` with:

- `bug_title`: From $ARGUMENTS
- `current_behavior`: What is broken
- `expected_behavior`: What should happen
- `unchanged_behavior`: Aspects of the system that must NOT change during the fix (regression boundaries)
- `root_cause`: Initial hypothesis about why the bug exists (if known)
- `test_plan`: How to verify the fix works and no regressions are introduced

### Step 4: Present the Result

Show the user a summary of the BUGFIX_SPEC.md and confirm the file location.

This command does NOT require or affect the SDD pipeline state machine. It can be called at any time, from any phase.

## Error Handling

- If $ARGUMENTS is empty, ask the user to describe the bug.
- If file write fails, check workspace permissions and report the issue.

## Tools Used

- `sdd_write_bugfix` — Write BUGFIX_SPEC.md (not gated by state machine)
- `sdd_scan_codebase` — Detect project context (optional)
- `sdd_get_status` — Check for existing pipeline (optional)
