---
name: sdd-spec-engineer
description: >
  Spec-Driven Development orchestrator, the open-source alternative to AWS Kiro.
  Transforms natural language into production-grade specs through interactive discovery.
  Auto-scans codebases, generates EARS-notation requirements, creates Mermaid architecture
  diagrams, produces sequenced task plans with [P] parallel markers and pre-implementation
  gates, runs quality gates with traceability matrices, and hands off to coding agents.
  Works in GitHub Copilot custom agents, prompt files, and skills.
  USE THIS when the user mentions: spec, requirements, plan feature, user stories,
  acceptance criteria, technical design, architect solution, implementation plan,
  SDD, "spec this", "plan this", "break into tasks", PRD, constitution, "like Kiro",
  bugfix spec, quality gate, spec sync, or any variation of spec-driven development.
---

# SDD Spec Engineer

This package provides a complete Spec-Driven Development workflow for GitHub Copilot.

## Available Agents (GitHub Copilot)

| Agent | Purpose |
|-------|---------|
| **Spec Engineer** | Full pipeline orchestrator, the only agent developers need |
| **Design Architect** | Architecture and Mermaid diagrams |
| **Task Planner** | Task breakdown with [P] markers |
| **Spec Reviewer** | Quality gate and traceability matrix |

## Suggested prompt file commands

| Command | Purpose |
|---------|---------|
| `/sdd:spec` | Full pipeline: scan → discover → spec → clarify → design → tasks → analyze |
| `/sdd:design` | Generate DESIGN.md from existing spec |
| `/sdd:tasks` | Generate TASKS.md from existing design |
| `/sdd:analyze` | Run quality gate on existing specs |
| `/sdd:bugfix` | Generate bugfix specification |

## Key Features

- Interactive discovery with smart questions before generating
- Requirements-First AND Design-First workflows
- EARS notation for unambiguous acceptance criteria
- Mandatory Mermaid diagrams in architecture
- Pre-implementation gates (constitution enforcement)
- [P] parallel task markers for team coordination
- /clarify phase for spec disambiguation
- Automatic quality gate with traceability matrix
- Sequential feature numbering (001-, 002-)
- Implementation handoff to GitHub Copilot agent mode or terminal agents
- 6 pre-built hook templates

## Reference Files

Read `references/ears-notation.md` before generating specifications.
Read `references/spec-templates.md` for artifact templates.
