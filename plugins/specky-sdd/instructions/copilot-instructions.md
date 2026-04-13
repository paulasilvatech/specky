# Specky SDD — Copilot Instructions

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

## Key Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the 6 EARS patterns.
2. **REQ-ID traceability is non-negotiable.** Every test, task, and design decision traces to a REQ-ID.
3. **Model routing matters.** Use Haiku for scaffolding (Phase 0, 9), Sonnet for iteration (Phase 1, 5-7), Opus for reasoning (Phase 2-4, 8).
4. **Never skip hooks.** Blocking hooks (security-scan, release-gate) must pass before release.
5. **Artifacts live in `.specs/NNN-feature/`.** CONSTITUTION.md, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md.

## Available Agents

- @sdd-init — Initialize pipeline (Phase 0)
- @requirements-engineer — Produce FRD + NFRD
- @research-analyst — Technical research (Phase 1)
- @sdd-clarify — Resolve ambiguities (Phase 2)
- @implementer — Implementation scaffolding (Phase 6)
- @test-verifier — Coverage verification (Phase 7)
- @release-engineer — Release preparation (Phase 9)

## Available Prompts

Use in Copilot Chat with `@workspace /prompt-name`:

**Quick Start:** /specky-greenfield, /specky-brownfield, /specky-migration, /specky-api
**Pipeline:** /specky-research, /specky-clarify, /specky-specify, /specky-design, /specky-tasks, /specky-implement, /specky-verify, /specky-release
**Special:** /specky-from-figma, /specky-from-meeting, /specky-check-drift, /specky-resolve-conflict
**Debug:** /specky-debug-hook, /specky-pipeline-status, /specky-reset-phase

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
