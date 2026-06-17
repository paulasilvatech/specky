---
name: architecture-doc
description: "Validate an architecture document (the {app}_Architecture.md produced by the Senior Cloud Architect agent) against a hard Definition of Done: required sections, the five required diagrams, well-formed Mermaid, the seven explanation parts per diagram, and the repository copy conventions. Use when producing, reviewing, or finishing an architecture document, or whenever you need to confirm a Mermaid-based architecture deliverable is complete and will render before presenting it."
argument-hint: "the architecture markdown file to validate, for example UBB_Platform_Architecture.md"
---

# Architecture Doc

The quality gate for architecture documents in this workspace. It turns the Senior Cloud Architect's Definition of Done into an executable check so an architecture deliverable cannot ship incomplete or with broken Mermaid, which is the main source of rework.

Pair this with the `Senior Cloud Architect` agent ([../../agents/arch.agent.md](../../agents/arch.agent.md)): the agent designs and writes `{app}_Architecture.md`, then runs this gate before presenting.

## When to use

- After producing an architecture document, before presenting it.
- When reviewing or finishing someone else's architecture markdown.
- Whenever you need to confirm the Mermaid diagrams will render and every diagram is fully explained.

## What it enforces

1. **Required sections**: Executive Summary, System Context, Component Architecture, Deployment Architecture, Data Flow, Risks and Mitigations.
2. **The five required diagrams** are present: System Context, Component, Deployment, Data Flow, Sequence.
3. **Well-formed Mermaid**: every block is fenced and non-empty, declares a known diagram type (`graph`, `flowchart`, `sequenceDiagram`, `erDiagram`, `stateDiagram-v2`, and so on), has balanced brackets, and has edges or messages where the type needs them.
4. **The seven explanation parts** appear in each diagram's section: Overview, Key Components, Relationships, Design Decisions, NFR Considerations, Trade-offs, Risks and Mitigations.
5. **Conventions**: no em dashes, "GitHub Copilot" never abbreviated to bare "Copilot", and no unfilled template placeholders (`{app}`, `[Diagram]`, `TODO`, `TBD`).

## Workflow

1. Write or update the architecture document as `{app}_Architecture.md`.
2. Run the gate:

   ```bash
   python .github/skills/architecture-doc/scripts/validate_arch.py <App_Architecture.md>
   ```

   It prints warnings (review) and errors (must fix), and exits non-zero if any error is found.
3. Fix every reported error, then rerun until it passes. Do not present a document that fails the gate.
4. Record the result at the end of the document as a short "Validation" note.

Override the minimum diagram count only when justified: `--min-diagrams 6`.

## Notes

- The script is standard-library Python and self-contained; no install needed.
- It cannot fully render Mermaid, so it uses high-signal structural checks. If a diagram is very complex, simplify it rather than risk a render error.
- Numbers in an architecture document (NFR targets, costs) must be sourced or labeled as assumptions; the gate flags conventions, not factual accuracy, so keep the data integrity rule yourself.
