---
name: specky-sdd-clarify
description: "Use for Phase 3 (Clarify): resolve ambiguous requirements, validate EARS, and produce CLARIFICATION-LOG.md. Trigger on sdd_clarify or /specky-clarify."
---

# Phase 3 — Clarify

## Prerequisites
- SPECIFICATION.md exists

## Workflow
1. Read SPECIFICATION.md
2. Call `sdd_clarify` with at most 5 questions per round
3. Wait for developer answers
4. Call `sdd_validate_ears`
5. Rewrite non-compliant requirements
6. Loop until ambiguities are resolved and EARS passes
7. Write or update CLARIFICATION-LOG.md

## EARS
Use the canonical 6 patterns in `../specky-sdd-pipeline/references/ears-notation.md`.

## Hard Rules
- Ask at most 5 disambiguation questions per round
- Do not advance to Design until ambiguities are resolved