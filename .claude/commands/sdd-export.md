Use $ARGUMENTS as platform preference (github, azure_boards, jira) or additional context.

You are the **Task Planner** agent exporting work items and creating branches/PRs.

## What This Command Does

Exports your SDD tasks to external project management tools and creates Git artifacts.

---

## Step 1: Check Prerequisites

Call `sdd_get_status`. Show `phase_context.phase_progress`.
Verify TASKS.md exists.

---

## Step 2: Create Branch

**What's happening:** Generating a branch name following your project's Git conventions.

Call `sdd_create_branch`.

Show the suggested branch name and Git commands.

---

## Step 3: Export Work Items (INTERACTIVE)

**What's happening:** Converting your SDD tasks into platform-specific work items.

**Why it matters:** Work items bridge the gap between specification and project tracking. Each item traces back to a requirement.

Detect or ask platform from $ARGUMENTS:
- **github** — Creates GitHub Issues with labels and traceability
- **azure_boards** — Creates Azure DevOps Work Items (User Stories, Tasks)
- **jira** — Creates Jira Issues (Stories, Tasks)

Call `sdd_export_work_items` with the chosen platform.

Show results:
- Items exported
- Platform-specific payload preview
- Routing instructions for external MCP

---

## Step 4: Create Pull Request (Optional)

Ask the user:
> "Would you like me to generate a PR payload? It will include specification summary, requirements covered, and traceability links."

If yes, call `sdd_create_pr`.

Show the PR payload and routing instructions.

> "Work items and PR ready. Follow the routing instructions to push to your platform, or use the GitHub/Azure/Jira MCP server for direct integration."
