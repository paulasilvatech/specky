---
name: specky-design-architect
description: "Use for Phase 4 (Design): produce DESIGN.md with architecture, API contracts, data model, and Mermaid diagrams. Trigger on sdd_write_design, sdd_generate_all_diagrams, or /specky-design."
---

# Phase 4 — Design

## Prerequisites
- Approved SPECIFICATION.md at the Phase 2 LGTM gate

## Workflow
1. Read SPECIFICATION.md and CONSTITUTION.md
2. Call `sdd_write_design` for architecture, API contracts, data model, and deployment topology
3. Call `sdd_generate_all_diagrams`
4. Trace every design decision to a REQ-ID
5. Present DESIGN.md for LGTM at the Phase 4 gate

## Hard Rules
- API contracts cover all functional REQ-IDs
- Diagrams use Mermaid syntax only
- Branch must be `spec/NNN-*`