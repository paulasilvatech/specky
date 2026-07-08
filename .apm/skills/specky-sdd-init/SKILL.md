---
name: specky-sdd-init
description: "Use when initializing Phase 0 (Init): scaffold .specs/NNN-feature/, CONSTITUTION.md, .sdd-state.json, and spec branch from develop. Trigger on sdd_init, greenfield setup, or new feature bootstrap."
---

# Phase 0 — Init

## Prerequisites
- Feature name and project type: greenfield, brownfield, migration, or API
- `develop` branch exists, or the exception is documented

## Workflow
1. Gather feature name, project type, and constraints
2. Read FRD/NFRD from `docs/requirements/` if present
3. Call `sdd_init` to create `.specs/NNN-feature/`, CONSTITUTION.md, and `.sdd-state.json`
4. Call `sdd_create_branch` to create `spec/NNN-feature-name` from `develop`
5. For brownfield projects, call `sdd_scan_codebase`
6. Present CONSTITUTION.md and wait for developer confirmation
7. Hand off to `@specky-research-analyst`

## Outputs
- CONSTITUTION.md
- `.sdd-state.json`

## Hard Rules
- Never assign NNN manually; `sdd_init` owns numbering
- Never write artifacts beyond Phase 0
- Create `spec/NNN-*` from `develop`, never from `main` or `stage`