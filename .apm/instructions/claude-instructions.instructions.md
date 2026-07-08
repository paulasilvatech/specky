---
applyTo: '**'
---

# Specky SDD

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

## Key Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the 6 EARS patterns.
2. **REQ-ID traceability is non-negotiable.** Every test, task, and design decision traces to a REQ-ID.
3. **Model routing matters.** Use a fast model class for lightweight scaffolding (Phase 0, 9), a balanced model class for iterative delivery (Phase 1, 5-7), and a reasoning-focused model class for complex analysis and design (Phase 2-4, 8). The user chooses any available model.
4. **Never skip hooks.** Blocking hooks (specky-security-scan, specky-release-gate) must pass before release.
5. **Artifacts live in `.specs/NNN-feature/`.** CONSTITUTION.md, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md.
6. **One branch per spec.** Create `spec/NNN-feature-name` from `develop` for all pipeline work (Phases 0-7). All `.specs/` artifacts are created on this branch. Merge to `develop` after verification, then `stage` for QA and release gates, then `main` for production. Never commit spec work directly to develop, stage, or main.
7. **Load companion SKILL.md first.** Every agent reads its companion skill file (`.claude/skills/{skill-name}/SKILL.md`) as the first workflow step. Phase agents have dedicated skills (specky-sdd-init, specky-spec-engineer, specky-sdd-clarify, specky-design-architect, specky-task-planner, specky-quality-reviewer); shared pipeline context lives in specky-sdd-pipeline.
8. **Orchestrator is the single entry point.** When `.specs/` exists with an active pipeline (`.sdd-state.json` present), ALL work — code, branches, commits, PRs — MUST flow through `@specky-orchestrator`. Direct calls to phase agents, manual branch creation outside `spec/NNN-*`, or free-form edits bypass the quality gates and are pipeline violations. If unsure where to start, invoke `@specky-onboarding`. Starting in v3.5, `specky-pipeline-guard` hook enforces this automatically.

## Available Agents

- @specky-onboarding — Interactive wizard and default entry point
- @specky-orchestrator — Full pipeline coordinator (all 10 phases)
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

Use slash commands in Claude Code (`/prompt-name`):

**Quick Start:** /specky-onboarding, /specky-orchestrate, /specky-greenfield, /specky-brownfield, /specky-migration, /specky-api
**Pipeline:** /specky-research, /specky-clarify, /specky-specify, /specky-design, /specky-tasks, /specky-implement, /specky-verify, /specky-release, /specky-deploy
**Special:** /specky-from-figma, /specky-from-meeting, /specky-check-drift, /specky-resolve-conflict
**Debug:** /specky-debug-hook, /specky-pipeline-status, /specky-reset-phase

## Quality Gates

Claude Code enforces gates natively via `.claude/settings.json` hook registration and the scripts in `.claude/hooks/scripts/`:

- **Pre-tool:** specky-artifact-validator (BLOCKING) + specky-branch-validator (advisory) before every phase tool
- **Post-tool:** specky-phase-gate (BLOCKING) + specky-lgtm-gate (advisory) + quality hooks after artifact writes
- **LGTM gates:** Phases 2 (Specify), 4 (Design), 5 (Tasks) pause for human review
- **Blocking gates:** specky-security-scan + specky-release-gate before PR creation

## Work Modes

- **Full Pipeline:** Use @specky-orchestrator or /specky-orchestrate for automated end-to-end
- **Agent-by-agent:** Call individual agents (@specky-spec-engineer, @specky-implementer, etc.)
- **Direct MCP tools:** Call sdd_* tools directly for maximum control
- **Use /specky-onboarding to choose your mode**

## MCP Server

The specky-sdd MCP server (58 tools) is configured in .mcp.json and runs via npx.

## EARS Patterns

| Pattern | Format |
|---------|--------|
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |
