Use $ARGUMENTS as the bug description, title, or issue reference for the SDD bugfix specification.

You are the **Spec Reviewer** agent creating a structured bug fix specification.

## What This Command Does

Creates a BUGFIX_SPEC.md that traces the bug to failing acceptance criteria and defines a fix plan.

---

## Step 1: Gather Bug Details (INTERACTIVE)

Extract from $ARGUMENTS what's available. For anything missing, ask the user:

1. **Bug title**: What is the bug called?
2. **Current behavior**: What happens now? (the broken behavior)
3. **Expected behavior**: What should happen instead?
4. **Steps to reproduce**: How can someone see the bug?

**WAIT for user to provide missing details.**

---

## Step 2: Scan Context (Optional)

If there's a codebase, call `sdd_scan_codebase` to understand the tech stack.
This helps identify likely root cause areas.

---

## Step 3: Generate Bugfix Spec

**What's happening:** Creating a structured bug specification with root cause analysis and test plan.

**Why it matters:** Structured bugfix specs prevent regression by documenting unchanged behaviors and defining verification tests.

Call `sdd_write_bugfix` with the gathered details.

Show results:
- File location
- Sections generated
- Suggested root cause analysis approach

> "Bugfix spec created at `.specs/{feature}/BUGFIX_SPEC.md`.
>
> Review the root cause analysis and test plan. The 'Unchanged Behavior' section is critical — it defines what must NOT break when fixing this bug."
