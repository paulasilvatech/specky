Use $ARGUMENTS as the user's project idea or feature description for the SDD specification workflow.

## Purpose

Orchestrate the full specification phase of Spec-Driven Development: initialize the pipeline, run interactive discovery, and write a complete SPECIFICATION.md with EARS-notation requirements.

## Workflow

### Step 1: Initialize the Pipeline

Call `sdd_init` with the project name extracted from $ARGUMENTS.

- If $ARGUMENTS contains a clear project name (e.g., "user-authentication"), use it directly.
- If $ARGUMENTS is a description (e.g., "Build a REST API for managing todos"), derive a kebab-case name (e.g., "todo-rest-api").
- If initialization has already been done, skip to Step 2.

### Step 2: Scan the Codebase (Optional)

If the user is working in an existing project, call `sdd_scan_codebase` to detect the tech stack and project structure. Pass the result as `codebase_summary` to the discovery phase.

### Step 3: Interactive Discovery

Call `sdd_discover` with the project idea from $ARGUMENTS.

- Present each of the 7 discovery questions to the user clearly.
- Wait for the user to answer all questions before proceeding.
- Use follow-up questions if answers are vague or incomplete.

### Step 4: Write the Specification

Call `sdd_write_spec` with:

- `feature_name`: derived from $ARGUMENTS
- `discovery_answers`: the user's answers from Step 3
- `requirements`: structured EARS-notation requirements based on the discovery

### Step 5: Present and Gate

- Show the user a summary of the specification: requirement count, categories, and key acceptance criteria.
- Tell the user: "Specification draft complete. Review `.specs/001-{name}/SPECIFICATION.md` and reply **LGTM** when ready to proceed to Design phase."
- Do NOT proceed to design until the user explicitly approves.

### Step 6: Advance Phase

Once the user says LGTM, call `sdd_advance_phase` to transition the state machine to the next phase.

## Error Handling

- If `sdd_init` returns an error about existing files, ask the user if they want to use `force: true` to overwrite.
- If `sdd_write_spec` returns an EARS validation error, fix the requirement text and retry.
- If a phase transition fails, call `sdd_get_status` to show the user what's missing.

## Tools Used

- `sdd_init` — Initialize the SDD pipeline and create project structure
- `sdd_scan_codebase` — Detect tech stack and project structure (optional)
- `sdd_discover` — Generate 7 interactive discovery questions
- `sdd_write_spec` — Write SPECIFICATION.md with EARS requirements
- `sdd_advance_phase` — Transition state machine to next phase
- `sdd_get_status` — Check current pipeline status (for error recovery)
