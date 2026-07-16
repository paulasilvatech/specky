---
applyTo: '**'
---

# Specky SDD — OpenCode Instructions

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

## Bootstrap

OpenCode requires two steps after install:

1. `specky install --target=opencode` — agents, commands, skills, MCP in `opencode.json`
2. `specky compile --target=opencode` — writes `AGENTS.md` root context

## Key Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the 6 EARS patterns.
2. **REQ-ID traceability is non-negotiable.** Every test, task, and design decision traces to a REQ-ID.
3. **Artifacts live in `.specs/NNN-feature/`.** CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, ANALYSIS.md, VERIFICATION.md.
4. **Branch policy is explicit.** Use the persisted release branch prefix and base branch. Do not invent Gitflow branches or create a branch during Init.
5. **Load companion SKILL.md first.** Read `.agents/skills/{skill-name}/SKILL.md` before phase work.
6. **Orchestrator is the single entry point.** When a feature directory has signed state, route work through `@specky-orchestrator` or `/specky-orchestrate` and follow its persisted contract.

## Available Agents

- @specky-onboarding, @specky-orchestrator, @specky-sdd-init, @specky-spec-engineer, @specky-sdd-clarify
- @specky-design-architect, @specky-task-planner, @specky-quality-reviewer, @specky-implementer
- @specky-test-verifier, @specky-release-engineer, @specky-research-analyst, @specky-requirements-engineer

## Tool Tokens

OpenCode agents use native tools: `read`, `edit`, `bash`, `fetch`, `agent`, `todo`, and `specky/sdd_*` MCP tools.

## Quality Gates

OpenCode has no native hook runtime. Enforce gates via MCP tools:

- Run `sdd_run_analysis` and obtain APPROVE before implementation tools
- Use `/specky-pipeline-status` to check phase and gate state
- LGTM review at Specify, Design, and Tasks phases

## MCP Server

Configured in `opencode.json` under `mcp.specky` — runs via `npx specky-sdd serve`.
