---
title: "Specky — Specification"
feature_id: "001-specky-mcp-server"
version: 1.0.0
date: 2026-03-20
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
ears_notation: true
requirement_count: 43
categories: [CORE, PIPE, UTIL, SVC, INT, QUAL]
---

# Specky — Specification

> All requirements use **EARS notation** (Easy Approach to Requirements Syntax). Each requirement is testable, unambiguous, and traceable to the Constitution's success criteria.

---

## Table of Contents

- [1. Core Infrastructure (REQ-CORE)](#1-core-infrastructure-req-core)
- [2. Pipeline Tools (REQ-PIPE)](#2-pipeline-tools-req-pipe)
- [3. Utility Tools (REQ-UTIL)](#3-utility-tools-req-util)
- [4. Services Layer (REQ-SVC)](#4-services-layer-req-svc)
- [5. Integration (REQ-INT)](#5-integration-req-int)
- [6. Quality (REQ-QUAL)](#6-quality-req-qual)
- [Acceptance Criteria Summary](#acceptance-criteria-summary)
- [Self-Assessment](#self-assessment)

---

## 1. Core Infrastructure (REQ-CORE)

### REQ-CORE-001: Server Initialization (Ubiquitous)

The server shall initialize an MCP server instance named "specky" with version from `package.json` and capabilities `{ tools: {} }`.

**Acceptance Criteria:**
- MCP `initialize` handshake completes successfully
- Server reports name "specky" and correct version in `serverInfo`

**Traces to:** SC-001, SC-005

---

### REQ-CORE-002: stdio Transport (Ubiquitous)

The server shall communicate over stdio transport (stdin/stdout) as the default mode.

**Acceptance Criteria:**
- `node dist/index.js` starts and accepts JSON-RPC messages on stdin
- Responses are written to stdout as JSON-RPC
- All diagnostic logging goes to stderr

**Traces to:** SC-001, SC-005

---

### REQ-CORE-003: HTTP Transport (Optional)

Where the `--http` flag is provided, the server shall start a Streamable HTTP transport on port 3200 (or `PORT` env variable).

**Acceptance Criteria:**
- `node dist/index.js --http` starts HTTP server on port 3200
- MCP Inspector can connect via HTTP
- Port is configurable via `PORT` environment variable

**Traces to:** SC-008

---

### REQ-CORE-004: Workspace Root Resolution (Event-driven)

When the server starts, the server shall resolve the workspace root from the `SDD_WORKSPACE` environment variable, falling back to the current working directory.

**Acceptance Criteria:**
- `SDD_WORKSPACE=/path/to/project npx specky` uses `/path/to/project` as workspace
- Without `SDD_WORKSPACE`, uses `process.cwd()`

**Traces to:** SC-002, SC-003

---

### REQ-CORE-005: npx Invocation (Ubiquitous)

The package shall expose a `bin` entry so that `npx specky` or `npx -y specky` starts the server with zero configuration.

**Acceptance Criteria:**
- `package.json` has `"bin": { "specky": "./dist/index.js" }`
- `dist/index.js` has `#!/usr/bin/env node` shebang
- `npx specky` starts the server

**Traces to:** SC-005

---

### REQ-CORE-006: Character Limit (Ubiquitous)

The server shall truncate any tool response exceeding 25,000 characters, appending a `[TRUNCATED]` message with guidance on how to retrieve the full content.

**Acceptance Criteria:**
- Response of 30,000 chars is truncated to 25,000 + truncation notice
- Truncation notice includes the tool name for retrieving full content

**Traces to:** Constitution Art. 4.5

---

### REQ-CORE-007: Graceful Shutdown (Event-driven)

When a SIGINT or SIGTERM signal is received, the server shall complete any in-flight tool call, then exit with code 0.

**Acceptance Criteria:**
- Sending SIGINT during a tool call does not corrupt state files
- Server exits cleanly after completing current operation

**Traces to:** Constitution Art. 3.1

---

## 2. Pipeline Tools (REQ-PIPE)

### REQ-PIPE-001: sdd_init (Event-driven)

When `sdd_init` is called with `project_name` and optional `spec_dir`, the tool shall create the `.specs/001-{project_name}/` directory, write a `CONSTITUTION.md` skeleton, and initialize `.specs/.sdd-state.json` with phase set to "init".

**Input Schema:**
```
project_name: string (required, 1-100 chars, kebab-case)
spec_dir: string (optional, defaults to ".specs")
principles: string[] (optional, project principles)
constraints: string[] (optional, project constraints)
```

**Acceptance Criteria:**
- Directory `.specs/001-{name}/` is created on disk
- `CONSTITUTION.md` exists with YAML frontmatter and provided principles
- `.sdd-state.json` exists with `current_phase: "init"` and `status: "completed"` for init phase
- Calling `sdd_init` twice returns error unless `force: true`

**Traces to:** SC-001, SC-006

---

### REQ-PIPE-002: sdd_discover (Event-driven)

When `sdd_discover` is called with `project_idea` and optional `codebase_summary`, the tool shall return 7 structured discovery questions as JSON covering: scope, users, constraints, integrations, performance, security, and deployment.

**Input Schema:**
```
project_idea: string (required, 1-5000 chars)
codebase_summary: string (optional, from sdd_scan_codebase)
spec_dir: string (optional)
feature_number: string (optional, defaults to "001")
```

**Output:** `structuredContent` with JSON array of 7 question objects, each containing `id`, `category`, `question`, `why_it_matters`, `example_answer`.

**Acceptance Criteria:**
- Returns exactly 7 questions in structured JSON
- Questions are tailored to the project_idea (not generic)
- State machine transitions to "discover" phase
- If codebase_summary is provided, questions reference detected tech stack

**Traces to:** SC-001, SC-002

---

### REQ-PIPE-003: sdd_write_spec (Event-driven)

When `sdd_write_spec` is called with `feature_name`, `discovery_answers`, and `requirements`, the tool shall generate and write `SPECIFICATION.md` to the feature directory with all requirements in EARS notation.

**Input Schema:**
```
feature_name: string (required)
feature_number: string (optional, defaults to "001")
discovery_answers: object (required, answers to discovery questions)
requirements: array of { id, ears_pattern, text, acceptance_criteria } (required)
spec_dir: string (optional)
force: boolean (optional, overwrite existing)
```

**Acceptance Criteria:**
- `SPECIFICATION.md` written to `.specs/{feature}/` with YAML frontmatter
- Each requirement uses valid EARS notation (validated by EarsValidator)
- Requirements have unique IDs in `REQ-{CAT}-{SEQ}` format
- File includes acceptance criteria for every requirement
- State machine records "specify" phase as in_progress

**Traces to:** SC-001, SC-006

---

### REQ-PIPE-004: sdd_clarify (State-driven)

While the pipeline is in "specify" phase, the tool shall read `SPECIFICATION.md`, identify ambiguous or incomplete requirements, and return 5 disambiguation questions as structured JSON.

**Input Schema:**
```
spec_dir: string (optional)
feature_number: string (optional)
```

**Acceptance Criteria:**
- Returns up to 5 questions targeting specific requirement IDs
- Each question references the ambiguous text and suggests alternatives
- Only callable when SPECIFICATION.md exists (state-driven)
- Returns error if called before specify phase

**Traces to:** SC-001

---

### REQ-PIPE-005: sdd_write_design (Event-driven)

When `sdd_write_design` is called with `architecture` data, the tool shall read `SPECIFICATION.md`, generate, and write `DESIGN.md` with architecture overview, Mermaid diagrams, ADRs, and API contracts.

**Input Schema:**
```
architecture_overview: string (required)
mermaid_diagrams: array of { title, type, code } (required, min 1)
adrs: array of { title, decision, rationale, consequences } (optional)
api_contracts: array of { endpoint, method, description, request, response } (optional)
spec_dir: string (optional)
feature_number: string (optional)
force: boolean (optional)
```

**Acceptance Criteria:**
- `DESIGN.md` written with YAML frontmatter
- Contains at least 1 Mermaid diagram with valid syntax
- Each ADR follows "Decision / Rationale / Consequences" structure
- Cross-references requirement IDs from SPECIFICATION.md
- State machine records "design" phase

**Traces to:** SC-001, SC-006

---

### REQ-PIPE-006: sdd_write_tasks (Event-driven)

When `sdd_write_tasks` is called with task data, the tool shall read `DESIGN.md`, generate, and write `TASKS.md` with pre-implementation gates, sequenced tasks, `[P]` parallel markers, and effort estimates.

**Input Schema:**
```
tasks: array of { id, title, description, effort, dependencies, parallel } (required)
pre_impl_gates: array of { id, check, constitution_article } (required)
spec_dir: string (optional)
feature_number: string (optional)
force: boolean (optional)
```

**Acceptance Criteria:**
- `TASKS.md` written with YAML frontmatter
- Pre-implementation gates section with checkboxes mapped to Constitution articles
- Tasks are numbered sequentially (T-001, T-002, ...)
- Tasks with `parallel: true` are marked with `[P]`
- Dependency graph is acyclic (no circular dependencies)
- Each task traces to at least one requirement ID
- State machine records "tasks" phase

**Traces to:** SC-001, SC-006

---

### REQ-PIPE-007: sdd_run_analysis (Event-driven)

When `sdd_run_analysis` is called, the tool shall read all spec files (CONSTITUTION, SPECIFICATION, DESIGN, TASKS), generate and write `ANALYSIS.md` with a traceability matrix, coverage report, gap analysis, and return a gate decision as structured JSON.

**Input Schema:**
```
spec_dir: string (optional)
feature_number: string (optional)
force: boolean (optional)
```

**Output:** `structuredContent` with gate decision: `{ decision: "APPROVE" | "CHANGES_NEEDED" | "BLOCK", reasons: string[], coverage_percent: number, gaps: string[] }`.

**Acceptance Criteria:**
- `ANALYSIS.md` written with traceability matrix (REQ → Design → Task)
- Coverage percentage calculated (requirements with both design and task mappings)
- Gate decision is data-driven: APPROVE (≥90% coverage, 0 gaps), CHANGES_NEEDED (70-89%), BLOCK (<70%)
- Returns structured JSON with decision, reasons, and gaps
- State machine records "analyze" phase

**Traces to:** SC-001, SC-006

---

### REQ-PIPE-008: sdd_advance_phase (Event-driven)

When `sdd_advance_phase` is called, the tool shall validate that the current phase's required files exist on disk, then transition the state machine to the next phase.

**Input Schema:**
```
spec_dir: string (optional)
feature_number: string (optional)
```

**Acceptance Criteria:**
- Validates required files for current phase exist
- Transitions state to next phase in order: init → discover → specify → clarify → design → tasks → analyze
- Returns new state with phase name, timestamp, and next expected action
- Returns error with missing file list if validation fails
- Cannot advance past "analyze" (terminal phase)

**Traces to:** SC-004

---

## 3. Utility Tools (REQ-UTIL)

### REQ-UTIL-001: sdd_get_status (Ubiquitous)

The tool shall return the current pipeline status including: current phase, completed phases, files found on disk, completion percentage, and recommended next action.

**Input Schema:**
```
spec_dir: string (optional)
feature_number: string (optional)
```

**Output:** `structuredContent` with JSON: `{ current_phase, phases: {...}, files_found: [...], completion_percent, next_action }`.

**Acceptance Criteria:**
- Returns accurate phase information from `.sdd-state.json`
- Lists which spec files actually exist on disk (not just state claims)
- Completion percentage = (completed phases / total phases) × 100
- Next action is a human-readable string describing what to do next

**Traces to:** SC-001

---

### REQ-UTIL-002: sdd_get_template (Ubiquitous)

The tool shall return the raw Markdown template for a given artifact type without writing any files.

**Input Schema:**
```
template_name: enum ["constitution", "specification", "design", "tasks", "analysis", "bugfix", "sync_report"] (required)
```

**Acceptance Criteria:**
- Returns the complete template with `{{placeholder}}` variables intact
- Does not write any files (read-only)
- Returns error for unknown template names

**Traces to:** SC-001

---

### REQ-UTIL-003: sdd_write_bugfix (Event-driven)

When `sdd_write_bugfix` is called with bug data, the tool shall generate and write `BUGFIX_SPEC.md` with current behavior, expected behavior, unchanged behavior, root cause analysis template, and test plan.

**Input Schema:**
```
bug_title: string (required)
current_behavior: string (required)
expected_behavior: string (required)
unchanged_behavior: string[] (optional)
root_cause: string (optional)
test_plan: string (optional)
spec_dir: string (optional)
feature_number: string (optional)
```

**Acceptance Criteria:**
- `BUGFIX_SPEC.md` written with YAML frontmatter
- Contains all 5 sections: current, expected, unchanged, root cause, test plan
- Callable from any phase (not gated by state machine)

**Traces to:** SC-001

---

### REQ-UTIL-004: sdd_check_sync (State-driven)

While at least `SPECIFICATION.md` and one implementation file exist, the tool shall compare spec requirements against code file summaries and return a drift report.

**Input Schema:**
```
spec_dir: string (optional)
feature_number: string (optional)
code_paths: string[] (optional, paths to implementation files to check)
```

**Output:** `structuredContent` with JSON: `{ in_sync: boolean, drift_items: [...], last_sync_check, recommendation }`.

**Acceptance Criteria:**
- Lists requirements not reflected in code (missing implementations)
- Lists code files not traced to any requirement (orphan code)
- Returns `in_sync: true` only when all requirements have matching code references
- Optionally writes `SYNC_REPORT.md`

**Traces to:** SC-001

---

### REQ-UTIL-005: sdd_scan_codebase (Ubiquitous)

The tool shall scan the workspace project structure and return auto-steering context including: detected language, framework, package manager, folder structure, and key file summaries.

**Input Schema:**
```
depth: number (optional, defaults to 3, max 5)
exclude: string[] (optional, glob patterns to exclude, defaults to ["node_modules", ".git", "dist"])
```

**Acceptance Criteria:**
- Reads `package.json` (or equivalent) for project metadata
- Returns folder tree up to specified depth
- Detects primary language and framework
- Respects exclude patterns
- Does not read file contents beyond package manifests (performance)
- Total response stays under CHARACTER_LIMIT

**Traces to:** SC-001

---

### REQ-UTIL-006: sdd_amend (Event-driven)

When `sdd_amend` is called with amendment data, the tool shall append an amendment entry to `CONSTITUTION.md`'s changelog and update the `amendment_count` in frontmatter.

**Input Schema:**
```
rationale: string (required)
articles_affected: string[] (required)
changes_description: string (required)
spec_dir: string (optional)
feature_number: string (optional)
```

**Acceptance Criteria:**
- Amendment appended to CONSTITUTION.md's Amendment Log table
- `amendment_count` in YAML frontmatter incremented
- `last_amended` date updated
- Original content preserved (append-only)

**Traces to:** SC-001

---

## 4. Services Layer (REQ-SVC)

### REQ-SVC-001: FileManager — Path Sanitization (Ubiquitous)

The FileManager service shall sanitize all file paths to prevent directory traversal attacks, rejecting any path containing `..` or absolute paths outside the workspace root.

**Acceptance Criteria:**
- Path `../../etc/passwd` is rejected with error
- Path `/etc/passwd` is rejected with error
- Path `.specs/001-feature/SPEC.md` is accepted
- All paths are resolved relative to workspace root

**Traces to:** Constitution Art. 3.2

---

### REQ-SVC-002: FileManager — Safe Write (Event-driven)

When writing a file, the FileManager shall create parent directories as needed, write atomically (temp file + rename), and return the absolute path of the written file.

**Acceptance Criteria:**
- Writing to a non-existent directory creates the directory first
- Partial writes (crash mid-write) do not leave corrupt files
- Returns the absolute path of the created file
- Existing files are not overwritten unless `force: true`

**Traces to:** Constitution Art. 3.2

---

### REQ-SVC-003: StateMachine — Phase Enforcement (State-driven)

While the state machine is in phase N, attempting to write artifacts for phase N+2 or later shall return an error listing the required intermediate steps.

**Acceptance Criteria:**
- In "init" phase, calling `sdd_write_design` returns error: "Must complete discover and specify phases first"
- Error message lists exactly which phases and files are missing
- Phase order: init → discover → specify → clarify → design → tasks → analyze

**Traces to:** SC-004

---

### REQ-SVC-004: StateMachine — State Persistence (Ubiquitous)

The state machine shall persist all state to `.specs/.sdd-state.json` after every transition, with ISO 8601 timestamps for each phase change.

**Acceptance Criteria:**
- `.sdd-state.json` is valid JSON after every write
- Each phase has `status` ("pending" | "in_progress" | "completed") and timestamps
- State survives server restart (loaded from disk on next tool call)

**Traces to:** SC-004

---

### REQ-SVC-005: TemplateEngine — Variable Replacement (Ubiquitous)

The TemplateEngine shall replace all `{{variable}}` placeholders in templates with provided context values, leaving unreplaced variables as `[TODO: variable]`.

**Acceptance Criteria:**
- `{{project_name}}` is replaced with actual project name
- Unknown variable `{{unknown}}` becomes `[TODO: unknown]`
- No double-encoding of special characters in replaced values

**Traces to:** SC-006

---

### REQ-SVC-006: TemplateEngine — YAML Frontmatter (Ubiquitous)

The TemplateEngine shall prepend YAML frontmatter to every generated document with: `title`, `version`, `date`, `author`, `status`, and `feature_id`.

**Acceptance Criteria:**
- Every generated `.md` file starts with `---` YAML block
- Frontmatter includes all required fields
- Date is ISO 8601 format

**Traces to:** SC-006

---

### REQ-SVC-007: EarsValidator — Pattern Detection (Ubiquitous)

The EarsValidator shall detect which of the 6 EARS patterns a requirement follows: Ubiquitous, Event-driven, State-driven, Optional, Unwanted, or Complex.

**Acceptance Criteria:**
- "The system shall X" → Ubiquitous
- "When X, the system shall Y" → Event-driven
- "While X, the system shall Y" → State-driven
- "Where X, the system shall Y" → Optional
- "If X, then the system shall Y" → Unwanted (negative)
- Combinations detected as Complex
- Unrecognized patterns return "unknown" with suggestion

**Traces to:** SC-006

---

### REQ-SVC-008: EarsValidator — Improvement Suggestions (Event-driven)

When a requirement does not match any EARS pattern, the EarsValidator shall return a suggested rewrite using the closest matching pattern.

**Acceptance Criteria:**
- "Make the UI fast" → suggestion: "The system shall render UI responses within 200ms" (Ubiquitous)
- Suggestion includes the pattern name and template

**Traces to:** SC-006

---

### REQ-SVC-009: CodebaseScanner — Tech Stack Detection (Ubiquitous)

The CodebaseScanner shall detect the primary technology stack by reading package manifests (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`).

**Acceptance Criteria:**
- Detects Node.js/TypeScript from `package.json`
- Detects Python from `requirements.txt` or `pyproject.toml`
- Detects Go from `go.mod`
- Detects Rust from `Cargo.toml`
- Detects Java from `pom.xml` or `build.gradle`
- Returns `{ language, framework, package_manager }` object

**Traces to:** SC-001

---

### REQ-SVC-010: CodebaseScanner — Directory Tree (Ubiquitous)

The CodebaseScanner shall return a directory tree structure respecting depth limits and exclude patterns.

**Acceptance Criteria:**
- Default depth of 3 levels
- Excludes `node_modules`, `.git`, `dist` by default
- Returns tree as JSON with `{ name, type: "file"|"dir", children? }`
- Total file count included in response

**Traces to:** SC-001

---

## 5. Integration (REQ-INT)

### REQ-INT-001: GitHub Copilot Agent — tools Frontmatter (Ubiquitous)

Each agent definition in `.github/agents/` shall include a `tools:` array in YAML frontmatter listing the MCP tool names it requires.

**Acceptance Criteria:**
- `spec-engineer.agent.md` lists all 14 tools
- `design-architect.agent.md` lists design-related tools
- `task-planner.agent.md` lists task-related tools
- `spec-reviewer.agent.md` lists analysis-related tools
- Tools names match exactly the registered MCP tool names

**Traces to:** SC-002

---

### REQ-INT-002: GitHub Copilot Agent — Workflow Instructions (Ubiquitous)

Each agent shall contain step-by-step instructions for calling MCP tools in the correct order, presenting results to the user, and handling errors.

**Acceptance Criteria:**
- Agent body describes when to call each tool
- Includes user interaction points (present results, ask for LGTM)
- Error handling instructions (what to do when a tool returns isError)

**Traces to:** SC-002

---

### REQ-INT-003: Claude Code Commands — $ARGUMENTS (Ubiquitous)

Each command in `.claude/commands/` shall use `$ARGUMENTS` to receive user input and call MCP tools with parsed arguments.

**Acceptance Criteria:**
- `/sdd:spec "Build a REST API"` passes "Build a REST API" as project idea
- Command parses $ARGUMENTS to extract project name and idea
- Each command calls the appropriate MCP tools in sequence

**Traces to:** SC-003

---

### REQ-INT-004: VS Code MCP Configuration (Ubiquitous)

The project shall include a `.vscode/mcp.json.example` file showing how to configure Specky as an MCP server in VS Code.

**Acceptance Criteria:**
- Example uses `npx specky` as command
- Includes `SDD_WORKSPACE: "${workspaceFolder}"` in env
- Comments explain each field

**Traces to:** SC-002

---

### REQ-INT-005: Claude Desktop Configuration (Ubiquitous)

The README shall include a Claude Desktop configuration example for `claude_desktop_config.json`.

**Acceptance Criteria:**
- Example uses `npx specky` as command
- Includes `SDD_WORKSPACE` environment variable
- Instructions for finding `claude_desktop_config.json` on macOS, Linux, Windows

**Traces to:** SC-003

---

### REQ-INT-006: MCP Tool Registration (Ubiquitous)

The server shall register all 14 tools using `server.registerTool()` with complete metadata: `title`, `description`, `inputSchema` (Zod), `outputSchema`, and `annotations`.

**Acceptance Criteria:**
- `tools/list` MCP method returns all 14 tools
- Each tool has `title` (human-readable), `description` (for LLM), `inputSchema`, and `annotations`
- Annotations include `readOnlyHint`, `destructiveHint`, `idempotentHint`

**Traces to:** SC-001, Constitution Art. 4.3

---

## 6. Quality (REQ-QUAL)

### REQ-QUAL-001: TypeScript Strict Compilation (Ubiquitous)

The project shall compile with `tsc --strict` without errors or warnings.

**Acceptance Criteria:**
- `npm run build` exits with code 0
- No TypeScript errors or warnings in output
- `tsconfig.json` has `"strict": true`

**Traces to:** Constitution Art. 4.1

---

### REQ-QUAL-002: Zero any Types (Ubiquitous)

The codebase shall contain zero uses of the `any` type.

**Acceptance Criteria:**
- `grep -r "any" src/ --include="*.ts"` finds no `any` type annotations
- All function parameters and return types are explicitly typed

**Traces to:** Constitution Art. 4.1

---

### REQ-QUAL-003: Error Responses (Ubiquitous)

The server shall return errors in MCP format with `isError: true` and actionable messages.

**Acceptance Criteria:**
- Invalid input returns `isError: true` with Zod validation message
- Phase violation returns `isError: true` with "complete X phase first" message
- File not found returns `isError: true` with expected file path

**Traces to:** Constitution Art. 4.4

---

### REQ-QUAL-004: Docker Build (Ubiquitous)

The project shall include a multi-stage Dockerfile that produces a slim production image.

**Acceptance Criteria:**
- `docker build -t specky .` succeeds
- Image size < 200MB
- Container starts with `--http` flag for remote deployment
- `docker-compose up` starts server on port 3200

**Traces to:** SC-008

---

### REQ-QUAL-005: README Documentation (Ubiquitous)

The README shall include: project description, creator attribution, installation instructions (npm, npx, Docker), VS Code setup, Claude Code setup, tool reference table, and comparison with alternatives.

**Acceptance Criteria:**
- All 14 tools documented with input/output descriptions
- Installation section covers npm, npx, and Docker
- VS Code and Claude Code setup sections with copy-paste configs
- Creator section credits Paula Silva with GitHub and Twitter links

**Traces to:** SC-005, SC-007

---

### REQ-QUAL-006: Annotations Metadata (Ubiquitous)

Every registered tool shall include `annotations` with accurate hints for the MCP client.

**Acceptance Criteria:**
- Read-only tools: `readOnlyHint: true, destructiveHint: false`
- Write tools: `readOnlyHint: false, destructiveHint: false` (creates, not overwrites)
- `sdd_init` with `force: true`: `destructiveHint: true`
- All tools: `openWorldHint: false` (no external API calls)

**Traces to:** Constitution Art. 4.3

---

## Acceptance Criteria Summary

| ID | Requirement | Test Method |
|----|-------------|-------------|
| REQ-CORE-001 | Server initialization | MCP Inspector handshake |
| REQ-CORE-002 | stdio transport | `echo '{"jsonrpc":"2.0"...}' \| node dist/index.js` |
| REQ-CORE-003 | HTTP transport | `curl http://localhost:3200/mcp` |
| REQ-CORE-004 | Workspace resolution | Set `SDD_WORKSPACE`, verify file paths |
| REQ-CORE-005 | npx invocation | `npx specky` starts server |
| REQ-CORE-006 | Character limit | Generate >25K response, verify truncation |
| REQ-CORE-007 | Graceful shutdown | Send SIGINT during tool call, verify state integrity |
| REQ-PIPE-001 | sdd_init | Call tool, verify files on disk |
| REQ-PIPE-002 | sdd_discover | Call tool, verify 7 JSON questions |
| REQ-PIPE-003 | sdd_write_spec | Call tool, verify SPECIFICATION.md on disk |
| REQ-PIPE-004 | sdd_clarify | Call in specify phase, verify 5 questions |
| REQ-PIPE-005 | sdd_write_design | Call tool, verify DESIGN.md with Mermaid |
| REQ-PIPE-006 | sdd_write_tasks | Call tool, verify TASKS.md with gates |
| REQ-PIPE-007 | sdd_run_analysis | Call tool, verify ANALYSIS.md + gate JSON |
| REQ-PIPE-008 | sdd_advance_phase | Advance each phase, verify state.json |
| REQ-UTIL-001 | sdd_get_status | Call tool, verify JSON matches disk state |
| REQ-UTIL-002 | sdd_get_template | Call for each template, verify placeholders |
| REQ-UTIL-003 | sdd_write_bugfix | Call tool, verify BUGFIX_SPEC.md |
| REQ-UTIL-004 | sdd_check_sync | Compare spec vs code, verify drift report |
| REQ-UTIL-005 | sdd_scan_codebase | Scan project, verify tech stack detection |
| REQ-UTIL-006 | sdd_amend | Amend constitution, verify changelog |
| REQ-SVC-001 | Path sanitization | Attempt traversal, verify rejection |
| REQ-SVC-002 | Safe write | Write to nested path, verify dirs created |
| REQ-SVC-003 | Phase enforcement | Skip phase, verify error |
| REQ-SVC-004 | State persistence | Restart server, verify state loaded |
| REQ-SVC-005 | Variable replacement | Render template, verify no `{{}}` remain |
| REQ-SVC-006 | YAML frontmatter | Check all generated files for frontmatter |
| REQ-SVC-007 | EARS pattern detection | Test all 6 patterns + unknown |
| REQ-SVC-008 | EARS improvement | Submit vague req, verify suggestion |
| REQ-SVC-009 | Tech stack detection | Scan Node/Python/Go projects |
| REQ-SVC-010 | Directory tree | Scan project, verify depth/excludes |
| REQ-INT-001 | Agent tools frontmatter | Parse YAML, verify tool names |
| REQ-INT-002 | Agent workflow | Read agent body, verify tool call sequence |
| REQ-INT-003 | Commands $ARGUMENTS | Run command, verify tool calls |
| REQ-INT-004 | VS Code config | Copy example, verify server starts |
| REQ-INT-005 | Claude Desktop config | Copy example, verify server starts |
| REQ-INT-006 | Tool registration | `tools/list` returns 14 tools with metadata |
| REQ-QUAL-001 | TypeScript strict | `npm run build` exits 0 |
| REQ-QUAL-002 | Zero any | grep finds no `any` types |
| REQ-QUAL-003 | Error responses | Trigger errors, verify `isError: true` |
| REQ-QUAL-004 | Docker build | `docker build` succeeds, image < 200MB |
| REQ-QUAL-005 | README | Review all required sections present |
| REQ-QUAL-006 | Annotations | `tools/list`, verify annotations per tool |

---

## Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| EARS notation compliance | 43/43 | All requirements use one of 6 patterns |
| Testability | 43/43 | Every requirement has acceptance criteria |
| Traceability | 43/43 | Every requirement traces to Constitution SC or Article |
| Uniqueness of IDs | 43/43 | No duplicate requirement IDs |
| Completeness | High | Covers all 14 tools, 5 services, integrations, quality |
| Ambiguity | Low | Input schemas defined, output formats specified |

**Total requirements:** 43
**Categories:** CORE (7), PIPE (8), UTIL (6), SVC (10), INT (6), QUAL (6)
