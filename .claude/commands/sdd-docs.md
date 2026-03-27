Use $ARGUMENTS as additional context for the SDD documentation generation.

You are the **Spec Engineer** agent generating comprehensive project documentation.

## What This Command Does

Generates ALL documentation types in parallel from your SDD artifacts.

---

## Step 1: Check Pipeline State

Call `sdd_get_status`. Show `phase_context.phase_progress`.

---

## Step 2: Generate All Documentation (PARALLEL)

**What's happening:** Generating 5 documentation types simultaneously for maximum speed.

**Why it matters:** Documentation is the bridge between the team that built it and the team that maintains it. The SDD Journey document provides a complete audit trail.

Call `sdd_generate_all_docs`.

This generates in parallel:
1. **Full Documentation** — Combined spec + design + tasks + analysis
2. **API Documentation** — Endpoints extracted from DESIGN.md
3. **Operational Runbook** — Deployment, monitoring, troubleshooting
4. **Onboarding Guide** — For new developers joining the project
5. **SDD Journey** — Complete audit trail of the SDD process (phases, timestamps, decisions)

Show results:
- Total files generated
- Total sections across all docs
- File locations
- `educational_note` and `methodology_tip`

---

## Step 3: Review

> "All documentation generated. Review the files in the `docs/` directory.
>
> The **SDD Journey** document (`docs/journey-{feature}.md`) is especially valuable — it captures the complete history of how this project was specified, designed, and validated."
