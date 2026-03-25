# Specky v2.3.1 — GitHub Copilot Instructions

This project uses **Spec-Driven Development (SDD)** via the Specky MCP server.

## Available Agents

Use these agents in Copilot Chat:

| Agent | Purpose |
|-------|---------|
| `@spec-engineer` | Full pipeline orchestrator — turnkey specs, EARS requirements, discovery, design, tasks |
| `@design-architect` | Architecture, diagrams, IaC, dev environments |
| `@task-planner` | Task decomposition, export to GitHub/Azure/Jira, test generation |
| `@spec-reviewer` | Quality audits, compliance, EARS validation, drift detection |
| `@document-creator` | Create Word, PowerPoint, PDF, and other document formats |

## Quick Start

1. **Turnkey spec:** `@spec-engineer Generate a spec for: [describe your feature]`
2. **Full pipeline:** `@spec-engineer Start SDD pipeline for [project-name]`
3. **Design:** `@design-architect Create architecture for feature 001`
4. **Tasks:** `@task-planner Break down feature 001 into tasks`
5. **Review:** `@spec-reviewer Run quality gate for feature 001`
6. **Diagrams:** `@design-architect Generate all diagrams for feature 001`
7. **Tests:** `@task-planner Generate tests for feature 001 using vitest`
8. **PBT:** `@task-planner Generate property-based tests for feature 001`
9. **Export:** `@task-planner Export tasks to GitHub Issues for feature 001`
10. **Checkpoint:** `@spec-engineer Create checkpoint before redesign`

## SDD Pipeline (10 Phases)

```
Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release
```

Each phase requires its predecessor. Use `sdd_advance_phase` to move forward.

## Key Rules

- **EARS Notation** — All requirements use EARS patterns (When/While/Where/If/The system shall)
- **LGTM Gates** — Wait for user approval at each phase before proceeding
- **Checkpoint before risk** — Create checkpoints before redesigns, scope changes, or amendments
- **Traceability** — Every requirement → design → task → test chain must be complete
- **Files on disk** — All artifacts live in `.specs/NNN-feature-name/`

## 52 MCP Tools Available

Pipeline (8), Utility (6), Transcript (3), Input (3), Quality (5), Visualization (4),
Infrastructure (3), Environment (3), Integration (5), Documentation (4), Ecosystem (1),
Testing (2), PBT (1), Turnkey (1), Checkpointing (3).

See CLAUDE.md for the full tool reference.
