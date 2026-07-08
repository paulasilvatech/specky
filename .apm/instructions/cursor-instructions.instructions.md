---
applyTo: '**'
---

# Specky SDD

1. EARS notation is mandatory: use the 6 canonical patterns from `.agents/skills/specky-sdd-pipeline/references/ears-notation.md`.
2. REQ-ID traceability is required on every requirement, task, design decision, and test.
3. Pipeline artifacts live in `.specs/NNN-feature/`; Phases 0-7 run on `spec/NNN-*` branches from `develop`.
4. Active pipeline (`.sdd-state.json`) routes through `@specky-orchestrator`; otherwise start with `@specky-onboarding`.
5. Load the companion SKILL.md before phase work: `.agents/skills/{agent-name}/SKILL.md`.
6. Cursor MCP is configured in `.cursor/mcp.json` with the `specky` server.

## Quality Gates

Cursor installs native hooks at `.cursor/hooks.json` and `.cursor/hooks/scripts/` when `dist/cursor-hooks.json` is available. Blocking gates deny unsafe artifact, phase, security, and release actions; advisory gates warn for branch, pipeline, LGTM, drift, and checkpoint workflows.

If hooks are unavailable, enforce the same gates through MCP tools, agent workflows, and this rule. Do not claim non-Cursor hook or MCP locations are Cursor runtime paths.

For the full phase workflow, invoke `/specky-onboarding` or read `.agents/skills/specky-sdd-pipeline/SKILL.md`.