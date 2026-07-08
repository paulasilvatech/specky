---
name: specky-spec-engineer
description: "Use for Phase 2 (Specify): write SPECIFICATION.md with EARS, REQ-IDs, and acceptance criteria. Trigger on sdd_write_spec, sdd_turnkey_spec, sdd_validate_ears, or /specky-specify."
---

# Phase 2 — Specify

## Prerequisites
- CONSTITUTION.md and RESEARCH.md exist on `spec/NNN-*`

## Workflow
1. Read CONSTITUTION.md and RESEARCH.md
2. Call `sdd_write_spec` or `sdd_turnkey_spec`
3. Optional: call `sdd_figma_to_spec`
4. Call `sdd_validate_ears` and fix every failure
5. Present SPECIFICATION.md for LGTM at the Phase 2 gate

## EARS
Use the canonical 6 patterns in `../specky-sdd-pipeline/references/ears-notation.md`.

## REQ-ID Format
`REQ-{DOMAIN}-{NNN}` — unique, uppercase domain, zero-padded sequence.

## Hard Rules
- Every requirement needs an EARS pattern, REQ-ID, and measurable acceptance criteria
- Always run `sdd_validate_ears` before presenting
- Branch must be `spec/NNN-*`