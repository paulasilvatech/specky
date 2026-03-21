# Specky

**The open-source MCP server for Spec-Driven Development (SDD).**

*The fun name, the serious engine.*

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)
![Tools](https://img.shields.io/badge/MCP_tools-17-orange.svg)

**Created by [Paula Silva](https://github.com/paulasilvatech)** ([@paulanunes85](https://twitter.com/paulanunes85)) | Americas Software GBB

---

## What is Specky?

Specky is an **MCP server** that transforms natural language project ideas — or meeting transcripts — into production-grade specifications. It enforces **EARS notation** (Easy Approach to Requirements Syntax), maintains a **state machine** across 7 pipeline phases, and writes real files to disk.

```
You ──→ AI Assistant ──→ Specky (17 tools) ──→ .specs/ files on disk
        (Copilot/Claude)                       CONSTITUTION.md
                                               SPECIFICATION.md
                                               DESIGN.md
                                               TASKS.md
                                               ANALYSIS.md
```

### What is MCP?

**MCP (Model Context Protocol)** is an open standard that lets AI assistants call external tools. Think of it like USB — a universal plug between any AI and any tool. Specky is a "device" that speaks MCP, giving Copilot and Claude the ability to create structured specification files.

### Key Features

- **17 MCP tools** for the full specification lifecycle
- **EARS notation** validation with 6 pattern types and improvement suggestions
- **7-phase pipeline** with state machine enforcement
- **Meeting transcript → full spec** — VTT, SRT, TXT, MD formats
- **Power Automate + OneDrive** integration for automated workflows
- **Quality gates** with traceability matrix and coverage analysis
- **Atomic file writes** — safe, no corruption on crash
- **Auto-steering** — scans your codebase to tailor discovery questions
- **Zero external dependencies** — runs entirely local, no API calls
- **GitHub Copilot agents** + **Claude Code commands** included

### Two Ways to Use

| Mode | How | Best For |
|------|-----|----------|
| **Interactive** | Conversation with AI, step by step | New projects, learning SDD |
| **Transcript** | Feed a meeting recording, get full spec | Existing meetings, automation |

---

## Quick Start

### npx (recommended)

```bash
npx specky
```

### npm global install

```bash
npm install -g specky
specky
```

### Docker

```bash
docker compose up
# Server starts on http://localhost:3200
```

---

## Setup

### VS Code (GitHub Copilot)

Create or update `.vscode/mcp.json`:

```json
{
  "servers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky"],
      "env": {
        "SDD_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

### Claude Code

```bash
# Quick setup (one command):
claude mcp add specky npx -y specky --env SDD_WORKSPACE=$(pwd)
```

Or manually add to MCP settings:

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky"],
      "env": {
        "SDD_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

| OS | Config File Location |
|----|---------------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky"],
      "env": {
        "SDD_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

---

## Meeting Transcript to Specs (Auto Pipeline)

**One command. Full specification from a Teams/Zoom meeting.**

```
/sdd:transcript meeting.vtt my-project
```

Or call the tool directly:

```json
{
  "name": "sdd_auto_pipeline",
  "arguments": {
    "file_path": "meeting.vtt",
    "project_name": "my-project"
  }
}
```

**What happens automatically:**

1. Parses the VTT/SRT/TXT/MD transcript
2. Extracts participants, topics, decisions, action items
3. Generates EARS requirements from meeting content
4. Creates all 6 spec files in one call:

| File | Content |
|------|---------|
| `CONSTITUTION.md` | Project charter with principles from the meeting |
| `SPECIFICATION.md` | EARS requirements extracted from decisions and discussions |
| `DESIGN.md` | Architecture overview based on topics discussed |
| `TASKS.md` | Implementation tasks from requirements + action items |
| `ANALYSIS.md` | Traceability matrix and quality gate |
| `TRANSCRIPT.md` | Clean markdown version of the meeting |

**Supported formats:**

| Format | Source | Extension |
|--------|--------|-----------|
| WebVTT | Microsoft Teams | `.vtt` |
| SubRip | Zoom | `.srt` |
| Plain text | Otter.ai, manual notes | `.txt` |
| Markdown | Any structured notes | `.md` |

### Power Automate + OneDrive Integration

For fully automated meeting-to-spec workflows:

```
Teams Meeting → Power Automate → OneDrive/Transcripts/ → sdd_batch_transcripts → .specs/
```

**Power Automate flow:**
1. Trigger: "When a Teams meeting recording is available"
2. Action: Get the meeting transcript
3. Action: Convert to Markdown
4. Action: Save to `OneDrive/Transcripts/{meeting-title}.md`

**Specky picks up from there:**

```json
{
  "name": "sdd_batch_transcripts",
  "arguments": {
    "transcripts_dir": "~/OneDrive/Transcripts"
  }
}
```

Each transcript in the folder becomes its own numbered feature spec package (`001-sprint-planning/`, `002-architecture-review/`, etc.) with 6 files each.

---

## Pipeline Overview

```
sdd_init → sdd_discover → sdd_write_spec → sdd_clarify → sdd_write_design → sdd_write_tasks → sdd_run_analysis
```

Each phase produces a Markdown artifact in `.specs/001-your-feature/`:

| Phase | Tool | Output |
|-------|------|--------|
| Init | `sdd_init` | `CONSTITUTION.md` |
| Discover | `sdd_discover` | 7 structured questions (JSON) |
| Specify | `sdd_write_spec` | `SPECIFICATION.md` |
| Clarify | `sdd_clarify` | 5 disambiguation questions (JSON) |
| Design | `sdd_write_design` | `DESIGN.md` |
| Tasks | `sdd_write_tasks` | `TASKS.md` |
| Analyze | `sdd_run_analysis` | `ANALYSIS.md` + gate decision |

---

## Tool Reference

### Pipeline Tools (8)

| Tool | Description | R/W |
|------|-------------|-----|
| `sdd_init` | Creates `.specs/` directory, writes CONSTITUTION.md, initializes state machine | Write |
| `sdd_discover` | Returns 7 tailored discovery questions based on your project idea | Read |
| `sdd_write_spec` | Validates EARS notation and writes SPECIFICATION.md | Write |
| `sdd_clarify` | Identifies ambiguous requirements, returns disambiguation questions | Read |
| `sdd_write_design` | Writes DESIGN.md with Mermaid diagrams, ADRs, and API contracts | Write |
| `sdd_write_tasks` | Writes TASKS.md with gates, parallel markers, and traceability | Write |
| `sdd_run_analysis` | Generates traceability matrix, returns APPROVE/CHANGES_NEEDED/BLOCK | Write |
| `sdd_advance_phase` | Validates prerequisites and advances the state machine | Write |

### Utility Tools (6)

| Tool | Description | R/W |
|------|-------------|-----|
| `sdd_get_status` | Returns current phase, completion %, files on disk, next action | Read |
| `sdd_get_template` | Returns raw template with {{placeholders}} intact | Read |
| `sdd_write_bugfix` | Writes BUGFIX_SPEC.md (not gated by state machine) | Write |
| `sdd_check_sync` | Compares spec requirements vs code references, reports drift | Read |
| `sdd_scan_codebase` | Scans project structure, detects tech stack for auto-steering | Read |
| `sdd_amend` | Appends amendment to CONSTITUTION.md changelog | Write |

### Transcript Automation Tools (3)

| Tool | Description | R/W |
|------|-------------|-----|
| `sdd_import_transcript` | Parses VTT/SRT/TXT/MD, extracts topics, decisions, requirements | Read |
| `sdd_auto_pipeline` | FULL AUTOMATION: transcript → all 6 spec files in one call | Write |
| `sdd_batch_transcripts` | Scan folder for transcripts, process ALL in one call (Power Automate + OneDrive) | Write |

---

## EARS Notation

Specky validates all requirements against 6 EARS patterns:

| Pattern | Syntax | Example |
|---------|--------|---------|
| Ubiquitous | The system shall ... | The system shall log all API requests. |
| Event-driven | When X, the system shall ... | When a user logs in, the system shall create a session. |
| State-driven | While X, the system shall ... | While in maintenance mode, the system shall reject writes. |
| Optional | Where X, the system shall ... | Where dark mode is enabled, the system shall use dark theme. |
| Unwanted | If X, then the system shall ... | If the database is unreachable, then the system shall retry. |
| Complex | Combination of above | While online, when a message arrives, the system shall notify. |

---

## GitHub Copilot Agents

Specky ships with 4 GitHub Copilot custom agents in `.github/agents/`:

| Agent | Role | Tools |
|-------|------|-------|
| `@spec-engineer` | Full pipeline orchestrator | All 17 tools |
| `@design-architect` | Architecture and design | 7 design tools |
| `@task-planner` | Task decomposition | 5 task tools |
| `@spec-reviewer` | Quality audit and analysis | 7 analysis tools |

---

## Claude Code Commands

| Command | Purpose |
|---------|---------|
| `/sdd:spec` | Start specification workflow |
| `/sdd:design` | Create architecture design |
| `/sdd:tasks` | Break down into implementation tasks |
| `/sdd:analyze` | Run quality gate analysis |
| `/sdd:bugfix` | Create bugfix specification |
| `/sdd:transcript` | Convert meeting transcript to full spec (VTT/SRT/TXT/MD) |
| `/sdd:onedrive` | Batch process all transcripts from OneDrive folder |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SDD_WORKSPACE` | `process.cwd()` | Workspace root for file operations |
| `PORT` | `3200` | HTTP port (with `--http` flag) |

---

## HTTP Mode

For remote deployment or MCP Inspector testing:

```bash
# Direct
node dist/index.js --http

# Docker
docker compose up
```

The server listens on `http://localhost:3200/mcp` for Streamable HTTP transport.

---

## Project Structure

```
.specs/
  001-your-feature/
    CONSTITUTION.md      # Project charter, principles, constraints
    SPECIFICATION.md     # EARS requirements with acceptance criteria
    DESIGN.md            # Architecture, Mermaid diagrams, ADRs
    TASKS.md             # Implementation tasks with gates
    ANALYSIS.md          # Traceability matrix, quality gate
  .sdd-state.json        # Pipeline state (phase, timestamps)
```

---

## Comparison with Alternatives

| Feature | Specky | Manual Specs | Kiro | Traditional |
|---------|--------|-------------|------|-------------|
| MCP native | Yes | No | Yes | No |
| EARS notation | Yes | Manual | No | No |
| State machine | Yes | No | Yes | No |
| File generation | Yes | Manual | Yes | Manual |
| Quality gates | Yes | Manual | Yes | No |
| Open source | MIT | N/A | Proprietary | Varies |
| GitHub Copilot agents | Yes | No | No | No |
| Claude Code commands | Yes | No | No | No |

---

## How It Works Inside

```
┌─────────────────────────────────────────────────────────────┐
│                    SPECKY MCP SERVER                        │
│                                                             │
│  Transport: stdio (default) or HTTP (:3200)                 │
│  Protocol:  JSON-RPC 2.0 (MCP standard)                    │
│                                                             │
│  ┌─── 17 Tools ───────────────────────────────────────────┐ │
│  │  Pipeline (8)  │  Utility (6)  │  Transcript (3)       │ │
│  └────────────────┴───────────────┴───────────────────────┘ │
│                          │                                  │
│  ┌─── 6 Services ────────────────────────────────────────┐  │
│  │  FileManager       │ StateMachine   │ TemplateEngine   │  │
│  │  EarsValidator     │ CodebaseScanner│ TranscriptParser  │  │
│  └────────────────────┴────────────────┴─────────────────┘  │
│                          │                                  │
│  ┌─── 7 Templates ──────────────────────────────────────┐   │
│  │  constitution │ specification │ design │ tasks        │   │
│  │  analysis     │ bugfix        │ sync-report           │   │
│  └───────────────┴───────────────┴───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key design principle:** Tools are thin (validate input, call service, format output). Services are fat (all business logic). FileManager owns all disk I/O.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GETTING-STARTED.md](GETTING-STARTED.md) | Step-by-step tutorial from zero to first spec |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to add tools, templates, and services |
| [PUBLISH.md](PUBLISH.md) | How to publish to GitHub, npm, and Docker |

---

## Development

```bash
# Clone and setup
git clone https://github.com/paulasilvatech/specky.git
cd specky
npm install

# Build
npm run build

# Development mode (auto-reload)
npm run dev

# Verify MCP handshake
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js 2>/dev/null

# Clean build artifacts
npm run clean
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Created by [Paula Silva](https://github.com/paulasilvatech)** ([@paulanunes85](https://twitter.com/paulanunes85)) | Americas Software GBB

*Specky — The fun name, the serious engine.*
