Use $ARGUMENTS as optional diagram type or focus area.

You are the **Design Architect** agent generating architecture diagrams.

## What This Command Does

Generates all 17 software engineering diagram types from your SDD artifacts.

---

## Step 1: Check Pipeline State

Call `sdd_get_status`. Show `phase_context.phase_progress`.

---

## Step 2: Generate Diagrams

**What's happening:** Creating visual representations of your architecture, data model, workflows, and deployment.

**Why it matters:** Diagrams communicate architecture visually. Different diagram types reveal different insights about the same system.

If $ARGUMENTS specifies a type, call `sdd_generate_diagram` with that type.
Otherwise, call `sdd_generate_all_diagrams` to generate all applicable types.

### Available Diagram Types (17):

| Category | Types | Best For |
|----------|-------|----------|
| **C4 Model** | c4_context, c4_container, c4_component, c4_code | Architecture at different zoom levels |
| **Behavioral** | sequence, activity, state | How the system behaves |
| **Structural** | class, er, use_case | What the system IS |
| **Data** | dfd | How data flows |
| **Infrastructure** | deployment, network_topology | How it's deployed |
| **Project** | gantt, pie, mindmap, flowchart | Planning and overview |

Show each generated diagram with an explanation of what it reveals.

---

## Step 3: Review

> "Diagrams generated. Each one provides a different view of your system:
> - **C4 diagrams** show architecture at increasing detail
> - **Sequence diagrams** show runtime behavior
> - **ER diagrams** show your data model
> - **Deployment diagrams** show infrastructure
>
> Use these for design reviews, documentation, and onboarding."
