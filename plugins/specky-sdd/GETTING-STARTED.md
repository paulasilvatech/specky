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

| # | Phase | Prompt | Agent |
|---|-------|--------|-------|
| 0 | Init | /specky-greenfield | @sdd-init |
| 1 | Research | /specky-research | @research-analyst |
| 2 | Clarify | /specky-clarify | @sdd-clarify |
| 3 | Specify | /specky-specify | — |
| 4 | Design | /specky-design | — |
| 5 | Tasks | /specky-tasks | — |
| 6 | Implement | /specky-implement | @implementer |
| 7 | Verify | /specky-verify | @test-verifier |
| 8 | Review | — | — |
| 9 | Release | /specky-release | @release-engineer |

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
| 7 specialized agents | ✅ | — |
| 19 reusable prompts | ✅ | — |
| 6 domain skills | ✅ | — |
| 10 automation hooks | ✅ | — |
| EARS notation reference | ✅ | — |
| Model routing guidance | ✅ | — |
| Pipeline config | ✅ | — |

For MCP-only installation, see the [main README](../../README.md#install-mcp-server-only).
