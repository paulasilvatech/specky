---
applyTo: '**'
---

# Specky SDD — Cursor Instructions

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

## Key Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the 6 EARS patterns (see `.agents/skills/specky-sdd-pipeline/references/ears-notation.md`).
2. **REQ-ID traceability is non-negotiable.** Every test, task, and design decision traces to a REQ-ID.
3. **Model routing matters.** Use a fast model class for lightweight scaffolding (Phase 0, 9), a balanced model class for iterative delivery (Phase 1, 5-7), and a reasoning-focused model class for complex analysis and design (Phase 2-4, 8).
4. **Never skip hooks.** Blocking hooks (specky-security-scan, specky-release-gate, specky-artifact-validator, specky-phase-gate) must pass before release.
5. **Artifacts live in `.specs/NNN-feature/`.** CONSTITUTION.md, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md.
6. **Branch policy is explicit.** Use the persisted release branch prefix and base branch. Do not invent Gitflow branches or create a branch during Init.
7. **Load companion SKILL.md first.** Every agent reads `.agents/skills/{skill-name}/SKILL.md` as the first workflow step. Phase agents have dedicated skills (specky-sdd-init, specky-spec-engineer, specky-sdd-clarify, specky-design-architect, specky-task-planner, specky-quality-reviewer); shared pipeline context lives in specky-sdd-pipeline.
8. **Orchestrator is the single entry point.** When a feature directory contains signed `.sdd-state.json`, work follows its persisted contract through `@specky-orchestrator`. If unsure where to start, invoke `@specky-onboarding`.

## Available Agents

- @specky-onboarding — Interactive wizard and default entry point
- @specky-orchestrator — Contracted phase-graph coordinator
- @specky-sdd-init — Initialize pipeline (Phase 0)
- @specky-requirements-engineer — Produce FRD + NFRD
- @specky-research-analyst — Technical research (Phase 1)
- @specky-spec-engineer — Write SPECIFICATION.md with EARS (Phase 2)
- @specky-sdd-clarify — Resolve ambiguities (Phase 3)
- @specky-design-architect — Write DESIGN.md + diagrams (Phase 4)
- @specky-task-planner — Write TASKS.md + CHECKLIST.md (Phase 5)
- @specky-quality-reviewer — Completeness audit + compliance (Phase 6)
- @specky-implementer — Implementation scaffolding (Phase 7)
- @specky-test-verifier — Coverage verification (Phase 8)
- @specky-release-engineer — Release preparation (Phase 9)

## Available Commands

Use slash commands in Cursor (`/prompt-name`):

**Quick Start:** /specky-onboarding, /specky-orchestrate, /specky-greenfield, /specky-brownfield, /specky-migration, /specky-api
**Pipeline:** /specky-research, /specky-clarify, /specky-specify, /specky-design, /specky-tasks, /specky-implement, /specky-verify, /specky-release, /specky-deploy
**Special:** /specky-from-figma, /specky-from-meeting, /specky-check-drift, /specky-resolve-conflict
**Debug:** /specky-debug-hook, /specky-pipeline-status, /specky-reset-phase

## Quality Gates

Cursor installs native hooks at `.cursor/hooks.json` and `.cursor/hooks/scripts/`:

- **Blocking gates:** specky-artifact-validator, specky-phase-gate, specky-security-scan, specky-release-gate (failClosed)
- **Advisory gates:** specky-branch-validator, specky-pipeline-guard, specky-lgtm-gate, specky-drift-monitor, specky-auto-checkpoint
- **LGTM gates:** Phases 2 (Specify), 4 (Design), 5 (Tasks) pause for human review
- **Server-enforced gates:** Analysis APPROVE is required before implement-phase MCP tools run

If hooks are unavailable, enforce the same gates through MCP tools and agent workflows.

## MCP Server

The specky-sdd MCP server (58 tools) is configured in `.cursor/mcp.json` and runs via npx.

## EARS Patterns

| Pattern | Format |
|---------|--------|
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |
