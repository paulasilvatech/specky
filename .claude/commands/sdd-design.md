Use $ARGUMENTS as additional context or constraints for the SDD design phase.

## Purpose

Create a comprehensive DESIGN.md with architecture overview, Mermaid diagrams, Architecture Decision Records (ADRs), and API contracts — all traced back to requirements in SPECIFICATION.md.

## Workflow

### Step 1: Verify Prerequisites

Call `sdd_get_status` to confirm the pipeline is in the correct phase:

- SPECIFICATION.md must exist on disk.
- If the pipeline is not past the "specify" phase, inform the user they need to complete `/sdd:spec` first.

### Step 2: Read the Specification

Read the existing SPECIFICATION.md to understand all requirements, their EARS patterns, and acceptance criteria. Use this as the foundation for architectural decisions.

### Step 3: Design the Architecture

Based on the specification and any additional context from $ARGUMENTS, create:

1. **Architecture Overview** — High-level system description and key design principles.
2. **Mermaid Diagrams** — At least 2 diagrams:
   - Component/service diagram showing system structure
   - Sequence diagram showing key workflows
   - Additional diagrams as needed (state machine, deployment, data flow)
3. **ADRs** — Architecture Decision Records for significant choices:
   - Each ADR has: Decision, Rationale, Consequences
   - Reference the requirement IDs that drove each decision
4. **API Contracts** (if applicable) — Endpoint definitions with request/response schemas.

### Step 4: Write the Design

Call `sdd_write_design` with the structured architecture data.

### Step 5: Present and Gate

- Show the user a summary: diagram count, ADR count, requirement coverage.
- Tell the user: "Design draft complete. Review `.specs/{feature}/DESIGN.md` and reply **LGTM** when ready to proceed to Tasks phase."
- Do NOT proceed to tasks until the user explicitly approves.

### Step 6: Advance Phase

Once the user says LGTM, call `sdd_advance_phase` to transition to the tasks phase.

## Error Handling

- If prerequisites are missing, call `sdd_get_status` and show the user what needs to be completed first.
- If `sdd_write_design` fails due to phase enforcement, explain the required phase sequence.

## Tools Used

- `sdd_get_status` — Check pipeline status and prerequisites
- `sdd_write_design` — Write DESIGN.md with architecture, diagrams, and ADRs
- `sdd_advance_phase` — Transition state machine to next phase
