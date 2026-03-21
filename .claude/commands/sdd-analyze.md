Use $ARGUMENTS as optional flags or focus areas for the SDD analysis phase.

## Purpose

Run a comprehensive quality gate analysis across all specification documents — generating a traceability matrix, coverage report, gap analysis, and a data-driven gate decision (APPROVE / CHANGES_NEEDED / BLOCK).

## Workflow

### Step 1: Verify Prerequisites

Call `sdd_get_status` to confirm all required spec files exist:

- CONSTITUTION.md
- SPECIFICATION.md
- DESIGN.md
- TASKS.md

If any are missing, inform the user which phases need completion first.

### Step 2: Run the Analysis

Call `sdd_run_analysis` to generate ANALYSIS.md. The tool will:

1. **Build Traceability Matrix** — Map every requirement to its design element(s) and task(s).
2. **Calculate Coverage** — Percentage of requirements with both design and task mappings.
3. **Identify Gaps** — Requirements without design, requirements without tasks, orphan tasks.
4. **Assess Risks** — Based on gap severity and coverage thresholds.
5. **Make Gate Decision:**
   - **APPROVE** — Coverage >= 90%, zero high-severity gaps
   - **CHANGES_NEEDED** — Coverage 70-89%, or medium-severity gaps
   - **BLOCK** — Coverage < 70%, or critical gaps

### Step 3: Present Results

Show the user:

- Gate decision with confidence level
- Coverage percentage
- Number of gaps found (by severity)
- Specific recommendations for any gaps

### Step 4: Handle Decision

- **If APPROVE:** Congratulate the user. The specification is ready for implementation. Suggest starting with Phase 1 of TASKS.md.
- **If CHANGES_NEEDED:** List the specific gaps and recommend which spec documents to update. Offer to help fix them.
- **If BLOCK:** Explain the critical issues. Guide the user back to the appropriate phase to address them.

## Optional: Sync Check

If $ARGUMENTS contains "sync" or "drift", also call `sdd_check_sync` to compare the specification against any existing implementation code.

## Error Handling

- If analysis fails due to missing files, call `sdd_get_status` to show exactly what's missing.
- If the user disagrees with the gate decision, explain the criteria and offer to run with adjusted thresholds.

## Tools Used

- `sdd_get_status` — Check pipeline status and file inventory
- `sdd_run_analysis` — Generate ANALYSIS.md with traceability and gate decision
- `sdd_check_sync` — Compare spec vs code for drift detection (optional)
