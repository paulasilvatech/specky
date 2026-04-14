# Getting Started with Specky SDD Plugin

## Prerequisites

- VS Code with GitHub Copilot extension
- Node.js 18+ (for the specky-sdd MCP server)

## Installation

### Via Copilot CLI (recommended)

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

The installer creates `.github/plugin/specky/` (agents, skills, hooks, prompts) and `.vscode/` (MCP server, hook settings) in your project, then verifies all files are in place.

> **Tip:** Commit `.github/plugin/` and `.vscode/` to Git so every team member gets Specky on clone.

## Quick Start

### New Project

Open Copilot Chat (`Ctrl+Alt+I`) and type:

```
@workspace /specky-greenfield
```

### Existing Codebase

```
@workspace /specky-brownfield
```

### Check Status

```
@workspace /specky-pipeline-status
```

## Pipeline Phases

Artifacts are created **progressively** — each phase produces its own files inside `.specs/NNN-feature/`:

| # | Phase | Prompt | Agent | Artifacts Created |
|---|-------|--------|-------|-------------------|
| — | Onboarding | /specky-onboarding | @specky-onboarding | — (wizard) |
| — | Full Pipeline | /specky-orchestrate | @specky-orchestrator | All (coordinated) |
| 0 | Init | /specky-greenfield | @sdd-init | CONSTITUTION.md, .sdd-state.json |
| 1 | Research | /specky-research | @research-analyst | RESEARCH.md |
| 2 | Clarify | /specky-clarify | @sdd-clarify | (updates RESEARCH.md) |
| 3 | Specify | /specky-specify | @spec-engineer | SPECIFICATION.md |
| 4 | Design | /specky-design | @design-architect | DESIGN.md |
| 5 | Tasks | /specky-tasks | @task-planner | TASKS.md, CHECKLIST.md |
| 6 | Implement | /specky-implement | @implementer | src/ code, test stubs |
| 7 | Verify | /specky-verify | @test-verifier | VERIFICATION.md, CROSS_ANALYSIS.md |
| 8 | Review | — | @quality-reviewer | ANALYSIS.md, COMPLIANCE.md |
| 9 | Release | /specky-release | @release-engineer | PR, changelog, docs |

> **Note:** You don't need to run every phase. Skip Research (Phase 1) if requirements are clear. Skip Design (Phase 4) if architecture is pre-existing. The pipeline adapts to your needs — but artifacts only appear when their phase runs.

## What the Plugin Installs

```
your-project/
├── .github/
│   └── plugin/
│       └── specky/
│           ├── agents/        ← 7 Copilot agents (.agent.md)
│           ├── prompts/       ← 19 reusable prompts (.prompt.md)
│           ├── skills/        ← 6 domain skills (SKILL.md)
│           ├── hooks/
│           │   ├── scripts/   ← 10 hook shell scripts
│           │   └── sdd-hooks.json
│           ├── instructions/
│           │   └── copilot-instructions.md  ← SDD rules + agents + prompts
│           ├── config.yml     ← Pipeline configuration
│           ├── README.md
│           ├── GETTING-STARTED.md
│           └── LICENSE
├── .vscode/
│   ├── mcp.json               ← MCP server (mcpServers key)
│   └── settings.json          ← Copilot + hook settings
└── ...
```

## Branching Strategy

Every spec gets its own branch. Work progresses through environments before reaching production:

```
spec/001-user-auth ──→ develop ──→ stage ──→ main
spec/002-payments  ──→    ↑
spec/003-notifs    ──→    ↑
```

| Branch | Phases | Artifacts Created | When to Merge |
|--------|--------|-------------------|---------------|
| `spec/NNN-feature-name` | 0-7 | CONSTITUTION.md, .sdd-state.json, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, CHECKLIST.md, VERIFICATION.md, CROSS_ANALYSIS.md | After Phase 7 passes |
| `develop` | 8 (Review) | ANALYSIS.md, COMPLIANCE.md | After integration review |
| `stage` | 8-9 (QA + Gates) | Release docs, changelog | After blocking gates pass |
| `main` | Production | — | Protected; deploy-ready |

**Starting a new spec:**

```bash
git checkout develop
git pull origin develop
git checkout -b spec/001-user-authentication
```

Then run `@workspace /specky-greenfield` in Copilot Chat.

**After Phase 7 passes:**

```bash
git checkout develop
git merge --no-ff spec/001-user-authentication
git branch -d spec/001-user-authentication
```

> **Rule:** Never commit spec work directly to develop, stage, or main. Always go spec/NNN → develop → stage → main.

## EARS Notation

Every requirement follows one of 6 patterns:

- **Ubiquitous:** The system shall...
- **Event-driven:** When [event], the system shall...
- **State-driven:** While [state], the system shall...
- **Optional:** Where [condition], the system shall...
- **Unwanted:** If [condition], then the system shall...
- **Complex:** While [state], when [event], the system shall...

## Model Routing

| Phases | Model | Cost | Use |
|--------|-------|------|-----|
| 0, 9 | Haiku 4.5 | 0.33x | Scaffolding, templates |
| 1, 5-7 | Sonnet 4.6 | 1x | Synthesis, iteration |
| 2-4, 8 | Opus 4.6 | 3x | Reasoning, architecture |

## Plugin vs MCP Server Only

| | Plugin (this) | MCP Server Only |
|--|:-:|:-:|
| 57 MCP tools | ✅ | ✅ |
| 13 specialized agents | ✅ | — |
| 22 reusable prompts | ✅ | — |
| 8 domain skills | ✅ | — |
| 14 automation hooks | ✅ | — |
| EARS notation reference | ✅ | — |
| Model routing guidance | ✅ | — |
| Pipeline orchestrator | ✅ | — |
| Onboarding wizard | ✅ | — |

For MCP-only installation, see the [main README](../../README.md#install-mcp-server-only).
