# Specky SDD — Copilot Instructions

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

## Key Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the 6 EARS patterns.
2. **REQ-ID traceability is non-negotiable.** Every test, task, and design decision traces to a REQ-ID.
3. **Model routing matters.** Use Haiku for scaffolding (Phase 0, 9), Sonnet for iteration (Phase 1, 5-7), Opus for reasoning (Phase 2-4, 8).
4. **Never skip hooks.** Blocking hooks (security-scan, release-gate) must pass before release.
5. **Artifacts live in `.specs/NNN-feature/`.** CONSTITUTION.md, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md.
6. **One branch per spec.** Create `spec/NNN-feature-name` from `develop` for all pipeline work (Phases 0-7). All `.specs/` artifacts are created on this branch. Merge to `develop` after verification, then `stage` for QA and release gates, then `main` for production. Never commit spec work directly to develop, stage, or main.

## Available Agents

- @specky-onboarding — Interactive wizard and default entry point
- @specky-orchestrator — Full pipeline coordinator (all 10 phases)
- @sdd-init — Initialize pipeline (Phase 0)
- @requirements-engineer — Produce FRD + NFRD
- @research-analyst — Technical research (Phase 1)
- @sdd-clarify — Resolve ambiguities (Phase 2)
- @spec-engineer — Write SPECIFICATION.md with EARS (Phase 3)
- @design-architect — Write DESIGN.md + diagrams (Phase 4)
- @task-planner — Write TASKS.md + CHECKLIST.md (Phase 5)
- @implementer — Implementation scaffolding (Phase 6)
- @test-verifier — Coverage verification (Phase 7)
- @quality-reviewer — Completeness audit + compliance (Phase 8)
- @release-engineer — Release preparation (Phase 9)

## Available Prompts

Use in Copilot Chat with `@workspace /prompt-name`:

**Quick Start:** /specky-onboarding, /specky-orchestrate, /specky-greenfield, /specky-brownfield, /specky-migration, /specky-api
**Pipeline:** /specky-research, /specky-clarify, /specky-specify, /specky-design, /specky-tasks, /specky-implement, /specky-verify, /specky-release, /specky-deploy
**Special:** /specky-from-figma, /specky-from-meeting, /specky-check-drift, /specky-resolve-conflict
**Debug:** /specky-debug-hook, /specky-pipeline-status, /specky-reset-phase

## Hook Enforcement

Hooks fire automatically on MCP tool calls:
- **Pre-tool:** artifact-validator (BLOCKING) + branch-validator (advisory) before every phase tool
- **Post-tool:** phase-gate (BLOCKING) + lgtm-gate (advisory) + quality hooks after artifact writes
- **LGTM gates:** Phases 3 (Specify), 4 (Design), 5 (Tasks) pause for human review
- **Blocking gates:** security-scan + release-gate before PR creation

## Work Modes

- **Full Pipeline:** Use @specky-orchestrator or /specky-orchestrate for automated end-to-end
- **Agent-by-agent:** Call individual agents (@spec-engineer, @implementer, etc.)
- **Direct MCP tools:** Call sdd_* tools directly for maximum control
- **Use /specky-onboarding to choose your mode**

## Rule #7

7. **Load companion SKILL.md first.** Every agent must read its companion skill file as the first workflow step.

## MCP Server

The specky-sdd MCP server (57 tools) is configured in .vscode/mcp.json and runs via npx.

## EARS Patterns

| Pattern | Format |
|---------|--------|
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |
