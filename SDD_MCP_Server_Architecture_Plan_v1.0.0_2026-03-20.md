---
title: "SDD MCP Server — Architecture Analysis & Implementation Plan"
description: "Complete analysis of the SDD Spec Engineer v3.0 system, gap assessment, and implementation plan for a standalone professional MCP server"
author: "Paula Silva"
date: "2026-03-20"
version: "1.0.0"
status: "review"
tags: ["sdd", "mcp-server", "architecture", "plan", "spec-driven-development"]
---

# SDD MCP Server — Architecture Analysis & Implementation Plan

> A professional, standalone MCP server that makes the SDD Spec Engineer pipeline fully executable in VS Code (GitHub Copilot) and Claude Code — replacing the current documentation-only system with working tools.

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-20 | Paula Silva | Initial analysis and plan |

## Table of Contents

- [1. Current State Assessment](#1-current-state-assessment)
  - [1.1 What We Built](#11-what-we-built)
  - [1.2 What Actually Works](#12-what-actually-works)
  - [1.3 What Does Not Work](#13-what-does-not-work)
- [2. Gap Analysis](#2-gap-analysis)
  - [2.1 MCP SDK Compliance](#21-mcp-sdk-compliance)
  - [2.2 VS Code Integration](#22-vs-code-integration)
  - [2.3 Kiro Feature Parity](#23-kiro-feature-parity)
- [3. Architecture Decision](#3-architecture-decision)
  - [3.1 Why a Standalone MCP Server](#31-why-a-standalone-mcp-server)
  - [3.2 Why stdio Transport](#32-why-stdio-transport)
  - [3.3 Why Tools That Write Files](#33-why-tools-that-write-files)
- [4. Target Architecture](#4-target-architecture)
  - [4.1 System Overview](#41-system-overview)
  - [4.2 Project Structure](#42-project-structure)
  - [4.3 Tool Inventory (14 tools)](#43-tool-inventory-14-tools)
  - [4.4 Services Layer](#44-services-layer)
  - [4.5 State Machine](#45-state-machine)
  - [4.6 Template Engine](#46-template-engine)
- [5. Integration with .github and .claude](#5-integration-with-github-and-claude)
  - [5.1 GitHub Copilot Custom Agents](#51-github-copilot-custom-agents)
  - [5.2 Claude Code Commands](#52-claude-code-commands)
  - [5.3 VS Code MCP Configuration](#53-vs-code-mcp-configuration)
  - [5.4 Claude Desktop Configuration](#54-claude-desktop-configuration)
- [6. Implementation Plan](#6-implementation-plan)
  - [6.1 Phase 1: Core Infrastructure](#61-phase-1-core-infrastructure)
  - [6.2 Phase 2: Pipeline Tools](#62-phase-2-pipeline-tools)
  - [6.3 Phase 3: Utility Tools](#63-phase-3-utility-tools)
  - [6.4 Phase 4: Agent & Command Updates](#64-phase-4-agent--command-updates)
  - [6.5 Phase 5: Testing & Documentation](#65-phase-5-testing--documentation)
- [7. File Deliverables](#7-file-deliverables)
- [8. Quality Gates](#8-quality-gates)
- [References](#references)

---

## 1. Current State Assessment

### 1.1 What We Built

The SDD Spec Engineer v3.0 currently has **24 files** across the `sdd-spec-engineer/` directory plus **1 tool module** (`sdd.ts`, 1,204 lines) inside the existing `mcp-servers/` ecosystem.

| Component | Files | Lines | Purpose |
|-----------|-------|-------|---------|
| Agents (.github/agents/) | 4 | 1,581 | GitHub Copilot Custom Agents |
| Commands (.claude/commands/) | 5 | 2,153 | Claude Code slash commands |
| Hooks | 6 | 426 | Automation templates |
| References | 2 | 1,541 | EARS notation + spec templates |
| Documentation | 5 | 3,395 | README, ARCHITECTURE, ONBOARDING, CLAUDE, SKILL |
| Config | 1 | 143 | apm.yml |
| HTML | 1 | 1,667 | Showcase (not useful for VS Code) |
| MCP Module | 1 | 1,204 | 12 tools in mcp-ecosystem server |
| **Total** | **25** | **12,110** | |

### 1.2 What Actually Works

These components are high quality and **production-ready as standalone prompts**:

- **Agent prompts** (4 files) — excellent few-shot examples, clear role boundaries, good EARS notation guidance
- **EARS notation reference** — complete, correct, 6 patterns with anti-patterns
- **Spec templates** — CONSTITUTION, SPECIFICATION, DESIGN, TASKS, ANALYSIS, BUGFIX, SYNC_REPORT
- **Documentation** — README with honest comparison table, ARCHITECTURE with ADRs, ONBOARDING guide

### 1.3 What Does Not Work

| Problem | Severity | Root Cause |
|---------|----------|------------|
| MCP tools use deprecated `server.tool()` API | **CRITICAL** | MCP SDK guide says use `server.registerTool()` |
| sdd.ts is a module inside mcp-ecosystem, not standalone | **HIGH** | Cannot distribute or configure independently |
| Tools return template text, do not read/write files | **HIGH** | No file I/O service — tools are glorified string generators |
| No state machine — nothing prevents jumping phases | **HIGH** | No `.sdd-state.json` tracking |
| Agents reference `@design-architect` mid-execution | **MEDIUM** | Sub-agent invocation does not exist in Claude Code or Copilot |
| Commands do not use `$ARGUMENTS` correctly | **MEDIUM** | Claude Code command format not followed |
| Hooks have undefined trigger mechanisms | **MEDIUM** | No Git hook integration, no CI/CD wiring |
| HTML showcase is not VS Code integrated | **LOW** | Wrong delivery format — should be Copilot/Claude native |

---

## 2. Gap Analysis

### 2.1 MCP SDK Compliance

Based on the [MCP TypeScript Implementation Guide](./reference/node_mcp_server.md):

| Best Practice | Current State | Required State |
|---------------|---------------|----------------|
| Use `server.registerTool()` | Uses deprecated `server.tool()` | Must migrate to `registerTool()` |
| Include `title`, `description`, `inputSchema`, `annotations` | Missing `title`, `outputSchema`, `annotations` | Add all required fields |
| Zod schemas with `.strict()` | Loose schemas without `.strict()` | Add `.strict()` to all schemas |
| `structuredContent` in responses | Only returns `text` content | Add `structuredContent` for JSON tools |
| Tool naming: `sdd_{action}_{resource}` | Uses `sdd_{action}` only | Add resource to names where appropriate |
| Error handling with `isError: true` | No error handling pattern | Add try/catch with actionable messages |
| Character limit (25,000) | No truncation | Add CHARACTER_LIMIT constant |
| stdio + HTTP dual transport | Only runs inside HTTP ecosystem | Must support stdio for VS Code |

### 2.2 VS Code Integration

For the MCP server to work in VS Code with GitHub Copilot:

| Requirement | Status | What's Needed |
|-------------|--------|---------------|
| stdio transport (primary) | Missing | VS Code spawns MCP servers as subprocesses via stdio |
| `.vscode/mcp.json` configuration | Missing | Tells VS Code how to start the MCP server |
| `copilot-instructions.md` references tools | Missing | Agents must declare which MCP tools they use |
| Tools read/write to workspace | Missing | `sdd_init` must create `.specs/` in the project root |
| State persists across tool calls | Missing | `.specs/.sdd-state.json` tracks current phase |

### 2.3 Kiro Feature Parity (Honest)

| Kiro Feature | With Current System | With MCP Server |
|-------------|-------------------|-----------------|
| Interactive discovery | Manual prompt only | `sdd_discover` returns structured questions → agent presents them |
| Spec generation | Manual prompt only | `sdd_write_spec` writes SPECIFICATION.md to disk |
| Design with Mermaid | Manual prompt only | `sdd_write_design` writes DESIGN.md with Mermaid blocks |
| Task breakdown | Manual prompt only | `sdd_write_tasks` writes TASKS.md with gates + [P] |
| Phase tracking | None | `sdd_get_status` reads state, `sdd_advance_phase` transitions |
| Bugfix workflow | Manual prompt only | `sdd_write_bugfix` writes BUGFIX_SPEC.md |
| Spec sync detection | None | `sdd_check_sync` compares spec vs code files |
| Quality gate | Manual prompt only | `sdd_run_analysis` writes ANALYSIS.md with gate decision |
| Auto-codebase scan | None | `sdd_scan_codebase` reads project structure for auto-steering |
| Visual task tracking | None | `sdd_get_status` returns structured JSON with phase completion |

---

## 3. Architecture Decision

### 3.1 Why a Standalone MCP Server

**Decision:** Build `sdd-mcp-server` as an independent project, not a module inside `mcp-ecosystem`.

**Rationale:**

- **Distributable** — can be published to npm, installed via `npx`, or added to any project
- **Configurable** — each VS Code project adds it to `.vscode/mcp.json` with project-specific paths
- **Testable** — has its own `npm test`, independent of the ecosystem server
- **Scalable** — can be versioned, released, and maintained separately
- **No coupling** — does not depend on Paula's specific infrastructure

**Trade-off:** Requires its own `package.json` and build step. This is standard for any professional MCP server.

### 3.2 Why stdio Transport

**Decision:** Primary transport is **stdio**, with optional HTTP for remote/Docker scenarios.

**Rationale:**

- VS Code spawns MCP servers as **subprocesses** — this requires stdio
- Claude Code uses stdio for local MCP servers (`claude mcp add`)
- Claude Desktop uses stdio in `claude_desktop_config.json`
- stdio is simpler, no port conflicts, no network configuration
- The MCP best practices guide says: *"Use stdio for local integrations, command-line tools, desktop applications"*

**Consequence:** The server starts via `node dist/index.js` and communicates over stdin/stdout. Logging goes to stderr.

### 3.3 Why Tools That Write Files

**Decision:** Tools write files directly to the workspace instead of just returning content.

**Rationale:**

- The whole point is that `sdd_write_spec` creates `SPECIFICATION.md` on disk — the agent doesn't need to manually save
- State machine depends on files existing: `sdd_get_status` checks which `.specs/` files are present
- `sdd_check_sync` needs to read both spec files AND implementation files from disk
- This matches how Kiro works — it writes spec files directly into the project

**Safety:** All write operations use `destructiveHint: false` (they create new files, not overwrite). Overwrite requires explicit `force: true` parameter.

---

## 4. Target Architecture

### 4.1 System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  VS Code / Claude Code / Claude Desktop                              │
│                                                                      │
│  ┌──────────────────────┐     ┌──────────────────────┐              │
│  │ .github/agents/      │     │ .claude/commands/     │              │
│  │ spec-engineer.agent   │     │ sdd-spec.md           │              │
│  │ design-architect.agent│     │ sdd-design.md         │              │
│  │ task-planner.agent    │     │ sdd-tasks.md          │              │
│  │ spec-reviewer.agent   │     │ sdd-analyze.md        │              │
│  └──────────┬───────────┘     └──────────┬───────────┘              │
│             │ calls tools                │ calls tools               │
│             └──────────┬─────────────────┘                           │
│                        │ stdio                                       │
│             ┌──────────▼───────────┐                                 │
│             │  sdd-mcp-server      │                                 │
│             │  (Node.js process)   │                                 │
│             │                      │                                 │
│             │  ┌─ Tools ─────────┐ │                                 │
│             │  │ sdd_init         │ │                                 │
│             │  │ sdd_discover     │ │                                 │
│             │  │ sdd_write_spec   │ │  ┌──────────────────────┐      │
│             │  │ sdd_write_design │ │  │ .specs/              │      │
│             │  │ sdd_write_tasks  │ ├──► 001-feature/         │      │
│             │  │ sdd_run_analysis │ │  │   CONSTITUTION.md    │      │
│             │  │ sdd_write_bugfix │ │  │   SPECIFICATION.md   │      │
│             │  │ sdd_check_sync   │ │  │   DESIGN.md          │      │
│             │  │ sdd_get_status   │ │  │   TASKS.md           │      │
│             │  │ sdd_scan_codebase│ │  │   ANALYSIS.md        │      │
│             │  │ sdd_get_template │ │  │ .sdd-state.json      │      │
│             │  │ sdd_advance_phase│ │  └──────────────────────┘      │
│             │  │ sdd_amend        │ │                                 │
│             │  └─────────────────┘ │                                 │
│             │                      │                                 │
│             │  ┌─ Services ──────┐ │                                 │
│             │  │ FileManager     │ │                                 │
│             │  │ StateMachine    │ │                                 │
│             │  │ TemplateEngine  │ │                                 │
│             │  │ EarsValidator   │ │                                 │
│             │  └─────────────────┘ │                                 │
│             └──────────────────────┘                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Project Structure

```
sdd-mcp-server/
├── package.json                 # npm package with bin entry
├── tsconfig.json                # Strict TypeScript config
├── Dockerfile                   # For Docker/remote deployment
├── docker-compose.yml           # Optional HTTP mode
├── README.md                    # Installation + VS Code setup
├── .vscode/
│   └── mcp.json.example         # Example MCP config for VS Code
├── src/
│   ├── index.ts                 # Entry point: stdio + optional HTTP
│   ├── constants.ts             # CHARACTER_LIMIT, version, defaults
│   ├── types.ts                 # TypeScript interfaces
│   ├── schemas/                 # Zod schemas (one per domain)
│   │   ├── pipeline.ts          # Pipeline tool schemas
│   │   ├── utility.ts           # Utility tool schemas
│   │   └── common.ts            # Shared schemas (spec_dir, feature_number)
│   ├── services/                # Business logic layer
│   │   ├── file-manager.ts      # Read/write .specs/ files safely
│   │   ├── state-machine.ts     # Phase tracking + transitions
│   │   ├── template-engine.ts   # Generate document content from templates
│   │   ├── ears-validator.ts    # Validate EARS notation syntax
│   │   └── codebase-scanner.ts  # Scan project for auto-steering
│   └── tools/                   # MCP tool registrations (one per domain)
│       ├── pipeline.ts          # Core pipeline tools (init, discover, write_*, advance)
│       ├── analysis.ts          # Quality gate tools (run_analysis, check_sync)
│       └── utility.ts           # Helper tools (get_status, get_template, scan, amend)
├── templates/                   # Embedded Markdown templates
│   ├── constitution.md          # CONSTITUTION.md template
│   ├── specification.md         # SPECIFICATION.md with EARS sections
│   ├── design.md                # DESIGN.md with Mermaid placeholders
│   ├── tasks.md                 # TASKS.md with gates + [P]
│   ├── analysis.md              # ANALYSIS.md with traceability matrix
│   ├── bugfix.md                # BUGFIX_SPEC.md template
│   └── sync-report.md           # SYNC_REPORT.md template
├── agents/                      # Updated GitHub Copilot agents (reference MCP tools)
│   ├── spec-engineer.agent.md
│   ├── design-architect.agent.md
│   ├── task-planner.agent.md
│   └── spec-reviewer.agent.md
├── commands/                    # Updated Claude Code commands (reference MCP tools)
│   ├── sdd-spec.md
│   ├── sdd-design.md
│   ├── sdd-tasks.md
│   ├── sdd-analyze.md
│   └── sdd-bugfix.md
└── dist/                        # Compiled JavaScript (npm run build)
    └── index.js
```

### 4.3 Tool Inventory (14 tools)

All tools use `server.registerTool()` with full `title`, `description`, `inputSchema`, `outputSchema`, and `annotations`.

#### Pipeline Tools (8 tools)

| # | Tool Name | Phase | Read/Write | Description |
|---|-----------|-------|------------|-------------|
| 1 | `sdd_init` | Setup | Write | Creates `.specs/` directory, writes `CONSTITUTION.md` skeleton, initializes `.sdd-state.json` |
| 2 | `sdd_discover` | 0 | Read-only | Analyzes project idea + optional codebase scan, returns 7 structured discovery questions as JSON |
| 3 | `sdd_write_spec` | 2 | Write | Generates and writes `SPECIFICATION.md` with EARS requirements from discovery answers |
| 4 | `sdd_clarify` | 3 | Read-only | Reads SPECIFICATION.md, identifies ambiguities, returns 5 disambiguation questions as JSON |
| 5 | `sdd_write_design` | 4 | Write | Reads SPECIFICATION.md, generates and writes `DESIGN.md` with Mermaid diagrams + ADRs |
| 6 | `sdd_write_tasks` | 5 | Write | Reads DESIGN.md, generates and writes `TASKS.md` with pre-impl gates, [P] markers, numbering |
| 7 | `sdd_run_analysis` | 6 | Write | Reads all spec files, writes `ANALYSIS.md` with traceability matrix, returns gate decision JSON |
| 8 | `sdd_advance_phase` | Any | Write | Validates current phase is complete, transitions state machine to next phase |

#### Utility Tools (6 tools)

| # | Tool Name | Read/Write | Description |
|---|-----------|------------|-------------|
| 9 | `sdd_get_status` | Read-only | Returns current pipeline status: phase, files found, completion %, next action |
| 10 | `sdd_get_template` | Read-only | Returns a spec template by name (constitution, specification, design, tasks, analysis, bugfix) |
| 11 | `sdd_write_bugfix` | Write | Generates BUGFIX_SPEC.md with current/expected/unchanged behavior, root cause template |
| 12 | `sdd_check_sync` | Read-only | Compares spec files against code file summaries, returns drift report |
| 13 | `sdd_scan_codebase` | Read-only | Reads project structure (package.json, folder tree, key files), returns auto-steering context |
| 14 | `sdd_amend` | Write | Records a spec amendment with rationale, updates CONSTITUTION.md changelog |

### 4.4 Services Layer

The services layer encapsulates business logic so tools remain thin wrappers.

#### FileManager

```typescript
// services/file-manager.ts
export class FileManager {
  constructor(private workspaceRoot: string) {}

  async ensureSpecDir(specDir: string): Promise<string>
  async writeSpecFile(specDir: string, fileName: string, content: string, force?: boolean): Promise<string>
  async readSpecFile(specDir: string, fileName: string): Promise<string>
  async listSpecFiles(specDir: string): Promise<string[]>
  async listFeatures(specDir: string): Promise<FeatureInfo[]>
  async fileExists(path: string): Promise<boolean>
  async readProjectFile(relativePath: string): Promise<string>
  async scanDirectory(dir: string, depth?: number): Promise<DirectoryTree>
}
```

Sanitizes all file paths (prevents directory traversal), creates directories as needed, and provides safe read/write operations.

#### StateMachine

```typescript
// services/state-machine.ts
export class StateMachine {
  async loadState(specDir: string): Promise<SddState>
  async saveState(specDir: string, state: SddState): Promise<void>
  async canTransition(specDir: string, targetPhase: Phase): Promise<TransitionResult>
  async advancePhase(specDir: string): Promise<SddState>
  async getCurrentPhase(specDir: string): Promise<Phase>
  async getRequiredFiles(phase: Phase): Promise<string[]>
}
```

State is stored in `.specs/.sdd-state.json`:

```json
{
  "version": "3.0.0",
  "project_name": "itau-pix-scheduled",
  "current_phase": "specify",
  "phases": {
    "init": { "status": "completed", "completed_at": "2026-03-20T10:00:00Z" },
    "discover": { "status": "completed", "completed_at": "2026-03-20T10:05:00Z" },
    "specify": { "status": "in_progress", "started_at": "2026-03-20T10:10:00Z" },
    "clarify": { "status": "pending" },
    "design": { "status": "pending" },
    "tasks": { "status": "pending" },
    "analyze": { "status": "pending" }
  },
  "features": ["001-pix-scheduled-transfer"],
  "amendments": [],
  "gate_decision": null
}
```

Phase transitions enforce order: `init → discover → specify → clarify → design → tasks → analyze`. Each phase requires its predecessor's output files to exist.

#### TemplateEngine

```typescript
// services/template-engine.ts
export class TemplateEngine {
  async renderConstitution(context: ConstitutionContext): Promise<string>
  async renderSpecification(context: SpecContext): Promise<string>
  async renderDesign(context: DesignContext): Promise<string>
  async renderTasks(context: TasksContext): Promise<string>
  async renderAnalysis(context: AnalysisContext): Promise<string>
  async renderBugfix(context: BugfixContext): Promise<string>
  async renderSyncReport(context: SyncContext): Promise<string>
}
```

Templates are embedded as `.md` files in the `templates/` directory. The engine reads them, replaces `{{variables}}`, and adds YAML frontmatter with version, date, feature number.

#### EarsValidator

```typescript
// services/ears-validator.ts
export class EarsValidator {
  validate(requirement: string): ValidationResult
  detectPattern(requirement: string): EarsPattern
  suggestImprovement(requirement: string): string
}
```

Validates that EARS requirements follow one of the 6 patterns: Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex.

### 4.5 State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │           SDD Phase State Machine            │
                    └─────────────────────────────────────────────┘

  ┌──────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌────────┐    ┌───────┐    ┌─────────┐
  │ INIT │───►│ DISCOVER │───►│ SPECIFY │───►│ CLARIFY │───►│ DESIGN │───►│ TASKS │───►│ ANALYZE │
  └──────┘    └──────────┘    └─────────┘    └─────────┘    └────────┘    └───────┘    └─────────┘
   creates:    produces:       writes:        updates:       writes:       writes:      writes:
   .specs/     questions       SPEC.md        SPEC.md        DESIGN.md    TASKS.md     ANALYSIS.md
   state.json  (JSON)          (EARS)         (clarified)    (Mermaid)    (gates,[P])  (matrix)
                                                                                        ↓
                                                                                   GATE DECISION
                                                                                   ├─ APPROVE → done
                                                                                   ├─ CHANGES → loop
                                                                                   └─ BLOCK → stop

  Transition rules:
  - Each phase requires predecessor files to exist on disk
  - sdd_advance_phase validates files, then updates .sdd-state.json
  - Agents/commands call sdd_advance_phase between each phase
  - User LGTM is handled by the agent, not the MCP server
```

### 4.6 Template Engine

Templates live in `templates/` as standalone `.md` files that are bundled with the server. Each template has `{{placeholder}}` variables:

| Template | Key Variables | Output File |
|----------|--------------|-------------|
| `constitution.md` | `{{project_name}}`, `{{principles}}`, `{{constraints}}`, `{{naming}}`, `{{amendments}}` | CONSTITUTION.md |
| `specification.md` | `{{feature_name}}`, `{{feature_number}}`, `{{ears_requirements}}`, `{{acceptance_criteria}}`, `{{self_assessment}}` | SPECIFICATION.md |
| `design.md` | `{{architecture_overview}}`, `{{mermaid_diagrams}}`, `{{adrs}}`, `{{api_contracts}}`, `{{risk_assessment}}` | DESIGN.md |
| `tasks.md` | `{{pre_impl_gates}}`, `{{feature_tasks}}`, `{{parallel_markers}}`, `{{effort_estimates}}`, `{{dependency_graph}}` | TASKS.md |
| `analysis.md` | `{{traceability_matrix}}`, `{{coverage_report}}`, `{{gap_analysis}}`, `{{gate_decision}}`, `{{recommendations}}` | ANALYSIS.md |
| `bugfix.md` | `{{bug_description}}`, `{{current_behavior}}`, `{{expected_behavior}}`, `{{unchanged_behavior}}`, `{{root_cause}}`, `{{test_plan}}` | BUGFIX_SPEC.md |

---

## 5. Integration with .github and .claude

### 5.1 GitHub Copilot Custom Agents

Each agent's `tools:` frontmatter field must reference the MCP tool names so Copilot knows which tools the agent can call:

```yaml
---
name: "SDD Spec Engineer"
description: "Orchestrates the full SDD pipeline using MCP tools"
model: "claude-sonnet-4"
tools:
  - sdd_init
  - sdd_discover
  - sdd_write_spec
  - sdd_clarify
  - sdd_write_design
  - sdd_write_tasks
  - sdd_run_analysis
  - sdd_advance_phase
  - sdd_get_status
  - sdd_scan_codebase
---
```

The agent body describes the workflow (when to call each tool, how to present results), and the MCP tools handle file I/O and state management.

### 5.2 Claude Code Commands

Each command uses `$ARGUMENTS` and calls MCP tools:

```markdown
# /sdd:spec

Run the full SDD specification pipeline for: $ARGUMENTS

## Steps

1. Call `sdd_init` with project_name extracted from $ARGUMENTS
2. Call `sdd_discover` with the project idea from $ARGUMENTS
3. Present the discovery questions to the user and collect answers
4. Call `sdd_write_spec` with the answers
5. Call `sdd_advance_phase` to move to "specify"
6. Present SPECIFICATION.md to user — wait for LGTM
7. Call `sdd_clarify` to get disambiguation questions
8. Present questions, collect answers, update spec
9. Call `sdd_advance_phase` to move to "clarify"
...continue through all phases...
```

### 5.3 VS Code MCP Configuration

Users add to `.vscode/mcp.json` in their project:

```json
{
  "servers": {
    "sdd": {
      "command": "npx",
      "args": ["-y", "sdd-mcp-server"],
      "env": {
        "SDD_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "servers": {
    "sdd": {
      "command": "node",
      "args": ["/path/to/sdd-mcp-server/dist/index.js"],
      "env": {
        "SDD_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

### 5.4 Claude Desktop Configuration

Users add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sdd": {
      "command": "npx",
      "args": ["-y", "sdd-mcp-server"],
      "env": {
        "SDD_WORKSPACE": "/path/to/project"
      }
    }
  }
}
```

---

## 6. Implementation Plan

### 6.1 Phase 1: Core Infrastructure

**Goal:** Working project skeleton that compiles and starts.

| Task | File | Description |
|------|------|-------------|
| 1.1 | `package.json` | Name: `sdd-mcp-server`, bin entry, dependencies (@modelcontextprotocol/sdk, zod), scripts |
| 1.2 | `tsconfig.json` | Strict mode, ES2022, Node16 module resolution |
| 1.3 | `src/constants.ts` | VERSION, CHARACTER_LIMIT, DEFAULT_SPEC_DIR, phase enum |
| 1.4 | `src/types.ts` | SddState, Phase, FeatureInfo, TransitionResult, EarsPattern interfaces |
| 1.5 | `src/index.ts` | McpServer init with stdio transport (default) + optional HTTP |
| 1.6 | `src/services/file-manager.ts` | Read/write/list operations with path sanitization |
| 1.7 | `src/services/state-machine.ts` | Phase tracking, transition validation, state persistence |
| 1.8 | `src/services/template-engine.ts` | Load templates, render with context variables |
| 1.9 | `src/services/ears-validator.ts` | 6-pattern EARS validation |
| 1.10 | `src/services/codebase-scanner.ts` | Read directory tree, detect package.json, tech stack |

**Verification:** `npm run build` succeeds, `node dist/index.js` starts and responds to MCP initialize.

### 6.2 Phase 2: Pipeline Tools

**Goal:** All 8 pipeline tools registered and working.

| Task | File | Tools |
|------|------|-------|
| 2.1 | `src/schemas/pipeline.ts` | Zod schemas for all pipeline tool inputs/outputs |
| 2.2 | `src/schemas/common.ts` | Shared schemas (spec_dir, feature_number, force) |
| 2.3 | `src/tools/pipeline.ts` | `sdd_init`, `sdd_discover`, `sdd_write_spec`, `sdd_clarify`, `sdd_write_design`, `sdd_write_tasks`, `sdd_run_analysis`, `sdd_advance_phase` |
| 2.4 | `templates/*.md` | All 7 Markdown templates embedded in project |

**Verification:** Each tool can be called via MCP Inspector (`npx @modelcontextprotocol/inspector`), writes correct files to `.specs/`, state transitions work.

### 6.3 Phase 3: Utility Tools

**Goal:** All 6 utility tools registered and working.

| Task | File | Tools |
|------|------|-------|
| 3.1 | `src/schemas/utility.ts` | Zod schemas for utility tool inputs/outputs |
| 3.2 | `src/tools/utility.ts` | `sdd_get_status`, `sdd_get_template`, `sdd_write_bugfix`, `sdd_check_sync`, `sdd_scan_codebase`, `sdd_amend` |

**Verification:** `sdd_get_status` returns correct JSON, `sdd_scan_codebase` detects project structure, `sdd_check_sync` identifies drift.

### 6.4 Phase 4: Agent & Command Updates

**Goal:** Agents and commands reference MCP tools and actually work end-to-end.

| Task | File | Description |
|------|------|-------------|
| 4.1 | `agents/spec-engineer.agent.md` | Add `tools:` frontmatter with MCP tool names, rewrite body to call tools |
| 4.2 | `agents/design-architect.agent.md` | Reference `sdd_write_design`, `sdd_get_status` |
| 4.3 | `agents/task-planner.agent.md` | Reference `sdd_write_tasks`, `sdd_advance_phase` |
| 4.4 | `agents/spec-reviewer.agent.md` | Reference `sdd_run_analysis`, `sdd_check_sync` |
| 4.5 | `commands/sdd-spec.md` | Rewrite to use `$ARGUMENTS` and call MCP tools |
| 4.6 | `commands/sdd-design.md` | Rewrite to call `sdd_write_design` |
| 4.7 | `commands/sdd-tasks.md` | Rewrite to call `sdd_write_tasks` |
| 4.8 | `commands/sdd-analyze.md` | Rewrite to call `sdd_run_analysis` |
| 4.9 | `commands/sdd-bugfix.md` | Rewrite to call `sdd_write_bugfix` |
| 4.10 | `.vscode/mcp.json.example` | Example VS Code configuration |

**Verification:** In VS Code, `@copilot spec-engineer "build a REST API"` triggers the full pipeline using MCP tools.

### 6.5 Phase 5: Testing & Documentation

**Goal:** Production-ready with docs and tests.

| Task | File | Description |
|------|------|-------------|
| 5.1 | `README.md` | Installation (npm, Docker, manual), VS Code setup, Claude Code setup, tool reference |
| 5.2 | `Dockerfile` | Multi-stage build, slim Node.js image |
| 5.3 | `docker-compose.yml` | HTTP mode for remote deployment |
| 5.4 | Manual integration test | Run full pipeline from init → analyze in VS Code |

**Verification:** `npm run build` clean, Docker builds, full pipeline test passes.

---

## 7. File Deliverables

Complete list of files to be created:

```
sdd-mcp-server/                          (NEW — standalone project)
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── README.md
├── .vscode/
│   └── mcp.json.example
├── src/
│   ├── index.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── schemas/
│   │   ├── pipeline.ts
│   │   ├── utility.ts
│   │   └── common.ts
│   ├── services/
│   │   ├── file-manager.ts
│   │   ├── state-machine.ts
│   │   ├── template-engine.ts
│   │   ├── ears-validator.ts
│   │   └── codebase-scanner.ts
│   └── tools/
│       ├── pipeline.ts
│       ├── analysis.ts
│       └── utility.ts
├── templates/
│   ├── constitution.md
│   ├── specification.md
│   ├── design.md
│   ├── tasks.md
│   ├── analysis.md
│   ├── bugfix.md
│   └── sync-report.md
├── agents/                              (UPDATED — reference MCP tools)
│   ├── spec-engineer.agent.md
│   ├── design-architect.agent.md
│   ├── task-planner.agent.md
│   └── spec-reviewer.agent.md
└── commands/                            (UPDATED — reference MCP tools)
    ├── sdd-spec.md
    ├── sdd-design.md
    ├── sdd-tasks.md
    ├── sdd-analyze.md
    └── sdd-bugfix.md
```

**Total: 31 files** (15 TypeScript source, 7 templates, 4 agents, 5 commands, 5 config/docs, 1 example)

---

## 8. Quality Gates

Before declaring the MCP server production-ready, all of these must pass:

### MCP SDK Compliance

- [ ] All tools use `server.registerTool()` (not deprecated `server.tool()`)
- [ ] All tools have `title`, `description`, `inputSchema`, `annotations`
- [ ] All Zod schemas use `.strict()`
- [ ] `structuredContent` returned for JSON-producing tools
- [ ] Tool names follow `sdd_{action}_{resource}` pattern
- [ ] Error handling returns `isError: true` with actionable messages
- [ ] CHARACTER_LIMIT enforced on large responses
- [ ] stdio transport works as primary (stderr for logging)

### VS Code Integration

- [ ] `.vscode/mcp.json.example` provided and documented
- [ ] `npx sdd-mcp-server` starts correctly via stdio
- [ ] Agents declare MCP tools in `tools:` frontmatter
- [ ] Full pipeline works in VS Code: `@copilot spec-engineer "..."` → files created in `.specs/`

### Claude Code Integration

- [ ] `claude mcp add sdd -- npx sdd-mcp-server` works
- [ ] Commands use `$ARGUMENTS` correctly
- [ ] Full pipeline works: `/sdd:spec "..."` → files created in `.specs/`

### Functional Completeness

- [ ] State machine enforces phase order (cannot skip phases)
- [ ] All 14 tools produce correct output
- [ ] Files are written to `.specs/NNN-feature/` with correct naming
- [ ] EARS validation catches malformed requirements
- [ ] Traceability matrix maps requirements → design → tasks
- [ ] Gate decision (APPROVE/CHANGES_NEEDED/BLOCK) is data-driven

### Code Quality

- [ ] `npm run build` compiles without errors
- [ ] TypeScript strict mode enabled
- [ ] No use of `any` type
- [ ] All async functions have `Promise<T>` return types
- [ ] DRY — no duplicated logic between tools

---

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official SDK documentation
- [MCP Best Practices](./reference/mcp_best_practices.md) — Server design guidelines
- [MCP TypeScript Implementation Guide](./reference/node_mcp_server.md) — Patterns and quality checklist
- [GitHub Copilot Custom Agents](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-agents) — Agent frontmatter and tool references
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp) — Adding MCP servers to Claude Code
- [VS Code MCP Configuration](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) — `.vscode/mcp.json` format
- [GitHub Spec-Kit](https://github.com/github/spec-kit) — Spec-Driven Development methodology
- [EARS Notation](https://www.iaria.org/conferences2015/filesICCGI15/EARS_Tutorial.pdf) — Easy Approach to Requirements Syntax
