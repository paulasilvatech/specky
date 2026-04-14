# Specky SDD

Spec-Driven Development plugin that provides 57 MCP tools for a structured
10-phase pipeline — from requirements through release — with EARS notation
validation, model routing, cognitive debt metrics, and enterprise security.

13 agents, 22 prompts, 8 skills, 14 hook scripts.

Powered by the [specky-sdd](https://www.npmjs.com/package/specky-sdd) MCP server.

## What it does

Specky SDD transforms feature requests into production-ready code through a
rigorous specification pipeline:

| Capability | Description |
|------------|-------------|
| 10-Phase Pipeline | Init → Research → Clarify → Specify → Design → Tasks → Implement → Verify → Review → Release |
| EARS Notation | Validates requirements using 6 patterns: Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex |
| Model Routing | Automatic routing to optimal model tier per phase (Haiku → Sonnet → Opus) |
| Cognitive Debt | Metrics and alerts for specification complexity and technical debt |
| 17 Diagram Types | Architecture, sequence, state machine, ERD, dependency graphs, and more |
| 6 Compliance Frameworks | SOC2, HIPAA, GDPR, PCI-DSS, ISO 27001, FedRAMP |
| Enterprise Security | Rate limiting, HMAC state integrity, RBAC, hash-chained audit logs |

## Skills

### `sdd-pipeline`

Core pipeline guide activated for SDD pipeline phases, EARS notation, model
routing, and specification artifacts. Provides the foundational knowledge for
all 10 pipeline phases.

### `implementer`

Phase 6 implementation orchestrator for generating implementation plans, quality
checklists, test stubs, and infrastructure scaffolding from specifications.

### `test-verifier`

Phase 7 test verification specialist for coverage analysis, phantom completion
detection, and spec-code drift checking.

### `release-engineer`

Phase 9 release orchestrator for running blocking gates, generating
documentation, creating PRs, and exporting work items.

### `research-analyst`

Phase 1 research analyst for codebase scanning, tech stack analysis, document
import, and discovery questions to build the knowledge baseline.

### `sdd-markdown-standard`

Formatting standard for all SDD artifacts (CONSTITUTION.md, SPECIFICATION.md,
DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md).

## Agents

| Agent | Phase | Purpose |
|-------|-------|---------|
| `@specky-onboarding` | Pre | Interactive wizard and default entry point |
| `@specky-orchestrator` | All | Full pipeline coordinator |
| `@sdd-init` | 0 | Initialize the SDD pipeline for a new feature |
| `@research-analyst` | 1 | Gather technical context before specification |
| `@sdd-clarify` | 2 | Find and resolve ambiguities in requirements |
| `@spec-engineer` | 3 | Write SPECIFICATION.md with EARS notation |
| `@design-architect` | 4 | Write DESIGN.md with architecture + diagrams |
| `@task-planner` | 5 | Write TASKS.md + CHECKLIST.md |
| `@requirements-engineer` | — | Analyze raw input and produce FRD/NFRD documents |
| `@implementer` | 6 | Generate implementation plans and scaffolding |
| `@test-verifier` | 7 | Verify test coverage and detect spec drift |
| `@quality-reviewer` | 8 | Completeness audit, compliance, gate decision |
| `@release-engineer` | 9 | Prepare features for release |

## Branching Strategy

Each spec gets its own branch following the Gitflow-SDD model:

| Branch | Phases | Merge Target |
|--------|--------|--------------|
| `spec/NNN-feature-name` | 0-7 (all spec work + artifacts) | → `develop` |
| `develop` | 8 (integration review) | → `stage` |
| `stage` | 8-9 (QA + blocking gates) | → `main` |
| `main` | Production | Protected |

All `.specs/` artifacts (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, etc.) are
created on the `spec/NNN-*` branch. See [GETTING-STARTED.md](GETTING-STARTED.md#branching-strategy)
for git commands and detailed workflow.

## Commands

| Command | Description |
|---------|-------------|
| `/specky-onboarding` | Interactive wizard — get started with Specky |
| `/specky-orchestrate` | Run the full 10-phase pipeline end-to-end |
| `/specky-greenfield` | Start a new project from scratch |
| `/specky-brownfield` | Onboard an existing codebase |
| `/specky-research` | Run Phase 1 research |
| `/specky-clarify` | Run Phase 2 clarification |
| `/specky-specify` | Run Phase 3 specification |
| `/specky-design` | Run Phase 4 design |
| `/specky-tasks` | Run Phase 5 task breakdown |
| `/specky-implement` | Run Phase 6 implementation |
| `/specky-verify` | Run Phase 7 verification |
| `/specky-release` | Run Phase 9 release |
| `/specky-deploy` | Generate deployment artifacts (IaC, Docker, runbook) |
| `/specky-pipeline-status` | Check pipeline status |
| `/specky-check-drift` | Detect spec-code drift |
| `/specky-api` | Generate API documentation |
| `/specky-from-figma` | Generate specs from Figma designs |
| `/specky-from-meeting` | Generate specs from meeting transcripts |
| `/specky-migration` | Plan a migration |
| `/specky-debug-hook` | Debug hook execution |
| `/specky-reset-phase` | Reset a pipeline phase |
| `/specky-resolve-conflict` | Resolve specification conflicts |

## MCP server

Specky SDD includes an MCP server configuration (`.mcp.json`) that runs the
[specky-sdd](https://www.npmjs.com/package/specky-sdd) package via npx.

```json
{
  "mcpServers": {
    "specky-sdd": {
      "command": "npx",
      "args": ["-y", "specky-sdd@latest"],
      "tools": ["*"]
    }
  }
}
```

## Prerequisites

- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org/)
- **VS Code** with GitHub Copilot extension
- **npm** (included with Node.js)

## Installation

### Via Copilot CLI

```bash
copilot plugin install paulasilvatech/specky
```

Or via marketplace:

```bash
copilot plugin marketplace add paulasilvatech/specky   # one-time
copilot plugin install specky-sdd@specky
```

### Manual

```bash
cd your-project/
bash <(curl -sL https://raw.githubusercontent.com/paulasilvatech/specky/main/plugins/specky-sdd/install.sh)
```

## Quick start

Open Copilot Chat and type:

```
@workspace /specky-greenfield
```

Or for an existing codebase:

```
@workspace /specky-brownfield
```
