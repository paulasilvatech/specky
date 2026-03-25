# Getting Started with Specky. From Zero to Production-Ready Specifications

> **Specky v2.3.0** | 52 MCP tools for the full specification lifecycle.
>
> This guide assumes no prior knowledge of MCP, Spec-Driven Development, or EARS notation. By the end, you will have a production-grade specification written, validated, exported to your project tracker, and backed by generated infrastructure code.


## Table of Contents

0.  [The Big Picture: Why This Exists](#0-the-big-picture-why-this-exists) — Vibe coding, Markdown, agents, skills
1.  [What is MCP and Why It Matters](#1-what-is-mcp-and-why-it-matters)
2.  [What is Spec-Driven Development](#2-what-is-spec-driven-development)
3.  [What is EARS Notation](#3-what-is-ears-notation)
4.  [Installing Specky](#4-installing-specky)
5.  [Configuring in VS Code with GitHub Copilot](#5-configuring-in-vs-code-with-github-copilot)
6.  [Configuring in Claude Code](#6-configuring-in-claude-code)
7.  [Your First Specification. Complete Walkthrough](#7-your-first-specification----complete-walkthrough)
8.  [Importing Documents](#8-importing-documents)
9.  [Exporting to Azure Boards, Jira, and GitHub Issues](#9-exporting-to-azure-boards-jira-and-github-issues)
10. [Generating Infrastructure as Code](#10-generating-infrastructure-as-code)
11. [Generating Diagrams](#11-generating-diagrams)
12. [Running Compliance Checks](#12-running-compliance-checks)
13. [Generating Tests from Specifications](#13-generating-tests-from-specifications-new-in-v220)
14. [Project Configuration](#14-project-configuration-new-in-v220)
15. [Specky and the Spec-Kit Foundation](#15-specky-and-the-spec-kit-foundation)
16. [The Full Pipeline. From Meeting to Deployment](#16-the-full-pipeline----from-meeting-to-deployment)
17. [Tool Reference Summary](#17-tool-reference-summary)
18. [Next Steps](#18-next-steps)


## 0. The Big Picture: Why This Exists

<p align="center">
  <img src="media/why-specifications-matter.svg" alt="Why Specifications Matter in the AI Era" width="100%"/>
</p>

### The Vibe Coding Problem

AI coding assistants generate code fast, but they skip the most important step: **understanding what you actually need**. You say "build me a login system" and the AI guesses the architecture, invents requirements, and produces code that might work but doesn't match what anyone agreed on. This is called **vibe coding** — building software based on vibes instead of validated specifications.

The result: 40% of developer time goes to rework because requirements were never written down, never validated, and never agreed upon.

### What Specky Does About It

Specky is a **deterministic engine** that sits between your intent and your code. Instead of letting the AI guess, Specky enforces a structured pipeline: you must define requirements before designing architecture, you must design before creating tasks, and you must validate before implementing. The AI can't skip steps because a **state machine** physically prevents it.

### What is Markdown and Why Does AI Use It?

**Markdown** (`.md` files) is a lightweight text format that is both human-readable and machine-parseable. It's the native language of AI assistants — when you chat with an AI, it "thinks" in Markdown. All Specky artifacts (specifications, designs, tasks) are Markdown files that live in your Git repository, version-controlled alongside your code.

### What are Agents and Skills?

**Agents** (`.github/agents/`) are specialized AI roles with expertise in a specific domain. Specky includes four agents (Spec Engineer, Design Architect, Task Planner, Spec Reviewer) that know how to use the SDD methodology. These work with any IDE that supports GitHub Copilot Custom Agents.

**Skills** (`.claude/commands/`) are reusable slash commands (like `/sdd:spec`, `/sdd:design`) that invoke the Specky pipeline with the right parameters. These work with Claude Code and compatible CLIs.

Both agents and skills call the same 47 Specky MCP tools underneath — they're just different entry points for different platforms.


## 1. What is MCP and Why It Matters

**MCP (Model Context Protocol)** is an open standard created by Anthropic that allows AI assistants to call external tools. Think of it as a universal interface, like USB for AI. Any AI assistant that supports MCP can connect to any MCP-compatible tool server without custom integration work.

Before MCP, if you wanted an AI assistant to write files, query a database, or interact with an API, you needed bespoke plugins for each AI platform. MCP eliminates that fragmentation. A single MCP server works with GitHub Copilot, Claude Code, Claude Desktop, and any other MCP-compatible client.

**Why this matters for specifications:**

Without MCP, you ask an AI to write a spec. It produces text in a chat window. You copy it into a file. There is no validation, no structure enforcement, no traceability between requirements and code.

With MCP, the AI calls Specky's tools directly. Specky validates EARS notation, enforces pipeline phases, writes structured files to disk, and maintains a state machine that prevents skipping steps. The AI becomes an intelligent operator; Specky becomes the engine that ensures quality.

```
You -----> AI Assistant -----> Specky MCP Server -----> Files on disk
           (Copilot/Claude)    (52 tools)               (.specs/ folder)
```


## 2. What is Spec-Driven Development

**Spec-Driven Development (SDD)** is a methodology that places the specification at the center of the software lifecycle. Instead of writing code first and documenting later (or never), SDD requires that every feature begins with a formal specification and that traceability is maintained from requirements through design, implementation, and testing.

### The Problem SDD Solves

In most software projects, requirements exist as scattered Slack messages, meeting notes, and verbal agreements. When a developer asks "what should this feature do?", the answer lives in someone's head. This leads to:

- **Ambiguous requirements** that different people interpret differently.
- **Specification drift** where the code diverges from the original intent.
- **Missing acceptance criteria** that make testing subjective.
- **No traceability** between a requirement and the code that implements it.

### How SDD Works

SDD enforces a 10-phase pipeline:

<p align="center">
  <img src="media/pipeline-lgtm-gates.svg" alt="10-Phase Pipeline with LGTM Gates" width="100%"/>
</p>

Each phase produces a concrete artifact. Each phase has prerequisites. You cannot write a design without a specification, and you cannot create tasks without a design. Quality gates at each phase prevent bad specs from propagating downstream.

### The Core Artifacts

| Artifact | Phase | Purpose |
|----------|-------|---------|
| `CONSTITUTION.md` | Init | Project charter: principles, constraints, boundaries |
| `SPECIFICATION.md` | Specify | Requirements in EARS notation with acceptance criteria |
| `DESIGN.md` | Design | Architecture, Mermaid diagrams, ADRs, API contracts |
| `TASKS.md` | Tasks | Implementation breakdown with effort, dependencies, traceability |
| `ANALYSIS.md` | Analyze | Traceability matrix, coverage report, quality gate decision |

Every requirement in the specification traces forward to a design component, a task, and a test. Every task traces backward to the requirement it fulfills. This bidirectional traceability is the foundation of SDD.


## 3. What is EARS Notation

**EARS (Easy Approach to Requirements Syntax)** is a notation developed by Alistair Mavin and others to eliminate ambiguity in natural-language requirements. Instead of freeform statements like "the system should handle errors gracefully," EARS provides six structured patterns that force precision.

### The Six EARS Patterns

**Ubiquitous**:Always true, no conditions.

```
The system shall log all API requests with timestamp, method, path, and response code.
```

**Event-driven**:Triggered by a specific event.

```
When a user submits valid credentials, the system shall return a JWT token with a 24-hour expiration.
```

**State-driven**:Active only while a condition holds.

```
While in maintenance mode, the system shall return HTTP 503 for all non-admin requests.
```

**Optional**:Active only when a feature or configuration is present.

```
Where two-factor authentication is enabled, the system shall require a TOTP code after password validation.
```

**Unwanted**:Handles failure conditions and edge cases.

```
If the database connection fails, then the system shall retry with exponential backoff up to 3 attempts.
```

**Complex**:Combines two or more patterns.

```
While connected to the message broker, when a new order is placed, the system shall publish an OrderCreated event within 500ms.
```

### Why EARS Matters

Each EARS pattern forces you to answer specific questions:

- **When** does this requirement apply? (Event-driven)
- **Under what conditions** is it active? (State-driven, Optional)
- **What happens when things go wrong?** (Unwanted)
- **Is it always true?** (Ubiquitous)

Specky validates every requirement against these patterns. If a requirement does not match any EARS pattern, Specky flags it and suggests improvements. This validation happens automatically during the `sdd_write_spec` phase.


## 4. Installing Specky

### Prerequisites

- **Node.js 18 or later**:[Download from nodejs.org](https://nodejs.org/)
- **An MCP-compatible AI assistant**:VS Code with GitHub Copilot, Claude Code, or Claude Desktop

Verify your Node.js installation:

```bash
node --version
# Must be v18.0.0 or higher
```

### Option A: npx (recommended, no install required)

```bash
npx specky-sdd
```

npx downloads and runs Specky on demand. Nothing is installed globally. This is the recommended approach for most users.

### Option B: Global npm install

```bash
npm install -g specky-sdd
specky
```

This installs Specky globally so the `specky` command is always available.

### Option C: Docker

```bash
docker pull ghcr.io/paulasilvatech/specky
docker run -p 3200:3200 -v $(pwd):/workspace ghcr.io/paulasilvatech/specky
```

Or with Docker Compose:

```bash
docker compose up
```

The Docker image exposes Specky on port 3200 with Streamable HTTP transport.

### Option D: From source (for contributors)

```bash
git clone https://github.com/paulasilvatech/specky.git
cd specky
npm install
npm run build
node dist/index.js
```

### Verify the installation

You can test that Specky responds to MCP handshakes:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | npx specky-sdd 2>/dev/null
```

A successful response includes `"serverInfo":{"name":"specky","version":"2.3.0"}` and a list of 52 tools.


## 5. Configuring in VS Code with GitHub Copilot

### Step 1: Create the MCP configuration file

In your project root, create `.vscode/mcp.json`:

```json
{
  "servers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd"],
      "env": {
        "SDD_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

**What each field does:**

| Field | Purpose |
|-------|---------|
| `command` | The executable to run. `npx` downloads and runs Specky automatically. |
| `args` | `-y` auto-confirms the npx install prompt. `specky-sdd` is the package name. |
| `env.SDD_WORKSPACE` | Tells Specky where your project root is. VS Code substitutes `${workspaceFolder}` with the actual path. |

### Step 2: Restart VS Code

After saving `mcp.json`, restart VS Code. GitHub Copilot will detect the MCP server configuration and connect to Specky automatically.

### Step 3: Verify the connection

Open GitHub Copilot Chat and type:

```
What SDD tools are available?
```

Copilot should list all 42 Specky tools. If it does not, check the VS Code Output panel (View > Output > select "MCP" from the dropdown) for connection errors.

### Using with Copilot Custom Agents

Specky ships with four custom agents for GitHub Copilot in the `.github/agents/` directory:

| Agent | Role |
|-------|------|
| `@spec-engineer` | Full pipeline orchestrator:uses all 52 tools |
| `@design-architect` | Architecture and design phase specialist |
| `@task-planner` | Task decomposition and estimation |
| `@spec-reviewer` | Quality audit, compliance, and analysis |

Invoke them in Copilot Chat:

```
@spec-engineer Create a specification for a real-time chat application with end-to-end encryption.
```


## 6. Configuring in Claude Code

### Quick setup (one command)

```bash
claude mcp add specky npx -y specky-sdd --env SDD_WORKSPACE=$(pwd)
```

This registers Specky as an MCP server for your current project directory.

### Manual configuration

Add the following to your Claude Code MCP settings file:

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd"],
      "env": {
        "SDD_WORKSPACE": "/absolute/path/to/your/project"
      }
    }
  }
}
```

Replace `/absolute/path/to/your/project` with the actual path to your project directory.

### Claude Code slash commands

If you have Specky's Claude Code command definitions installed (in `.claude/commands/`), the following commands are available:

| Command | Purpose |
|---------|---------|
| `/sdd:spec` | Start the specification workflow |
| `/sdd:design` | Create architecture design |
| `/sdd:tasks` | Break specification into implementation tasks |
| `/sdd:analyze` | Run quality gate analysis |
| `/sdd:bugfix` | Create bugfix specification linked to failing acceptance criteria |
| `/sdd:transcript` | Convert a meeting transcript to a full specification |
| `/sdd:onedrive` | Batch process all transcripts from an OneDrive folder |

### Configuring in Claude Desktop

Locate your Claude Desktop configuration file:

| Operating System | File Location |
|-----------------|---------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Add the Specky server:

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd"],
      "env": {
        "SDD_WORKSPACE": "/absolute/path/to/your/project"
      }
    }
  }
}
```

Restart Claude Desktop after saving.


## 7. Your First Specification. Complete Walkthrough

This section walks through the entire SDD pipeline step by step, from an empty project to a fully analyzed specification. We will build a specification for a task management API.

### Preparation

Open your AI assistant (Copilot Chat or Claude Code) and describe your project:

```
I want to create a specification for a task management REST API. It should support
user authentication with JWT, project-based task organization, role-based access
control, and real-time notifications via WebSocket.
```

The AI will use Specky tools in the following order.

### Phase 1: Init

**Tool:** `sdd_init`

The AI initializes the project structure and creates the project charter.

**What happens:**

```
.specs/
  001-task-management-api/
    CONSTITUTION.md
  .sdd-state.json
```

`CONSTITUTION.md` defines the project identity, its principles, constraints, stakeholders, and boundaries. The state machine records that the pipeline is in the `init` phase.

**Example CONSTITUTION.md excerpt:**

```markdown
## Project Identity
- Name: Task Management API
- Type: REST API with WebSocket support
- Primary Language: TypeScript

## Core Principles
1. Stateless authentication using JWT
2. Role-based access control at the API gateway level
3. Real-time event delivery for task state changes
```

### Phase 2: Discover

**Tool:** `sdd_discover`

Specky generates seven tailored discovery questions based on your project description. If your project already has code, `sdd_scan_codebase` runs first to detect the tech stack, and the questions adapt accordingly.

**The seven discovery questions:**

```
1. Scope:         What are the boundaries of the first release?
2. Users:         Who are the primary users and what is their technical level?
3. Constraints:   Language, framework, hosting environment, budget?
4. Integrations:  What external APIs or services must you connect to?
5. Performance:   Expected load, response time targets, SLAs?
6. Security:      Authentication method, compliance requirements?
7. Deployment:    CI/CD strategy, monitoring, rollback plan?
```

Answer each question. Your answers directly feed into the specification and design phases.

### Phase 3: Specify

**Tool:** `sdd_write_spec`

Using your answers from the discovery phase, Specky generates `SPECIFICATION.md` with EARS-validated requirements.

**What happens:**

```
.specs/
  001-task-management-api/
    CONSTITUTION.md
    SPECIFICATION.md          <-- New
  .sdd-state.json             <-- Updated: phase = "specify"
```

**Example requirements from the generated spec:**

```markdown
### REQ-FUNC-001: User Authentication (event_driven)

When a user submits valid credentials to POST /auth/login, the system shall
return a JSON response containing an access token (JWT, RS256, 1-hour expiry)
and a refresh token (opaque, 7-day expiry).

**Acceptance Criteria:**
- Valid credentials return HTTP 200 with both tokens
- Invalid credentials return HTTP 401 with error code AUTH_INVALID
- Expired refresh token returns HTTP 401 with error code AUTH_EXPIRED
- Token payload contains user_id, role, and iat/exp claims

### REQ-FUNC-002: Task Creation (event_driven)

When an authenticated user sends a POST request to /projects/{id}/tasks with
a valid task payload, the system shall create the task, assign it a unique ID,
and return HTTP 201 with the created resource.

**Acceptance Criteria:**
- Task is persisted with id, title, description, status, assignee, due_date
- Missing required fields return HTTP 400 with field-level validation errors
- Non-member of the project receives HTTP 403
```

Every requirement includes its EARS pattern classification. Specky validates each requirement and suggests improvements if a statement is ambiguous.

**Pause point:** The AI will ask "LGTM?". Respond with LGTM to proceed, or request changes.

### Phase 4: Clarify

**Tool:** `sdd_clarify`

Specky scans the specification for ambiguities and generates targeted clarification questions.

**Example clarifications:**

```
1. REQ-FUNC-005 mentions "real-time notifications". What transport protocol?
   Options: WebSocket, Server-Sent Events, or push notifications?

2. REQ-PERF-001 requires "fast response times". What is the target latency?
   Suggested: p95 < 200ms for read operations, p95 < 500ms for writes.

3. REQ-SEC-002 says "appropriate access control". Define the role hierarchy.
   Suggested: admin > project_owner > member > viewer.
```

Your answers refine the specification. Ambiguous requirements are rewritten with precise language.

### Phase 5: Design

**Tool:** `sdd_write_design`

Specky generates the architecture document with Mermaid diagrams, Architecture Decision Records (ADRs), and API contracts.

**What happens:**

```
.specs/
  001-task-management-api/
    CONSTITUTION.md
    SPECIFICATION.md
    DESIGN.md                 <-- New
  .sdd-state.json             <-- Updated: phase = "design"
```

**DESIGN.md includes:**

- System architecture diagram (Mermaid)
- Component interaction diagrams
- API endpoint contracts
- Data model (entity-relationship)
- Architecture Decision Records (ADRs)
- Technology stack justification

**Pause point:** Review the design and respond LGTM to proceed.

### Phase 6: Tasks

**Tool:** `sdd_write_tasks`

Specky decomposes the specification and design into implementation tasks with effort estimates, dependencies, and traceability links.

**What happens:**

```
.specs/
  001-task-management-api/
    CONSTITUTION.md
    SPECIFICATION.md
    DESIGN.md
    TASKS.md                  <-- New
  .sdd-state.json             <-- Updated: phase = "tasks"
```

**Example task table:**

```markdown
| ID    | Task                              | [P] | Effort | Depends | Traces To    |
|-------|-----------------------------------|-----|--------|---------|--------------|
| T-001 | Project scaffolding and CI setup   |     | M      |:     | REQ-CORE-001 |
| T-002 | JWT authentication service         |     | L      | T-001   | REQ-FUNC-001 |
| T-003 | User registration and profile API  | [P] | M      | T-001   | REQ-FUNC-003 |
| T-004 | Task CRUD API endpoints            | [P] | M      | T-001   | REQ-FUNC-002 |
| T-005 | WebSocket notification service     |     | L      | T-002   | REQ-FUNC-005 |
| T-006 | Role-based access control middleware|     | M      | T-002   | REQ-SEC-002  |
```

The `[P]` marker indicates tasks that can run in parallel. The `Traces To` column links every task back to its originating requirement.

### Phase 7: Analyze

**Tool:** `sdd_run_analysis`

Specky generates a traceability matrix that maps every requirement to its design component, implementation task, and acceptance criteria. It then issues a quality gate decision.

**What happens:**

```
.specs/
  001-task-management-api/
    CONSTITUTION.md
    SPECIFICATION.md
    DESIGN.md
    TASKS.md
    ANALYSIS.md               <-- New
  .sdd-state.json             <-- Updated: phase = "analyze"
```

**Example output:**

```markdown
## Quality Gate Decision: APPROVE

Coverage: 100% (12/12 requirements traced)

| Requirement  | Design Component    | Task  | Acceptance Test | Status |
|-------------|--------------------:|-------|-----------------|--------|
| REQ-FUNC-001 | Auth Service       | T-002 | AC-001-01       | PASS   |
| REQ-FUNC-002 | Task Service       | T-004 | AC-002-01       | PASS   |
| REQ-FUNC-003 | User Service       | T-003 | AC-003-01       | PASS   |
| REQ-SEC-002  | RBAC Middleware    | T-006 | AC-SEC-02       | PASS   |
```

If any requirement lacks a design component, task, or acceptance criteria, the gate decision is `CHANGES_NEEDED` or `BLOCK`, and the analysis report explains exactly what is missing.


## 8. Importing Documents

Specky v2.3.0 can import existing documents and convert them into structured specifications. This is useful when requirements already exist in PDFs, Word documents, PowerPoint decks, or meeting transcripts.

### Importing a single document

**Tool:** `sdd_import_document`

```
Import this requirements document and create a specification from it: ./docs/requirements.pdf
```

Supported formats:

| Format | Extensions | Source |
|--------|-----------|--------|
| PDF | `.pdf` | Requirements documents, RFPs |
| Word | `.docx` | Business requirements documents |
| PowerPoint | `.pptx` | Stakeholder presentations |
| Markdown | `.md` | Existing documentation |
| Plain text | `.txt` | Meeting notes, Otter.ai exports |
| WebVTT | `.vtt` | Microsoft Teams transcripts |
| SubRip | `.srt` | Zoom transcripts |

You can also pass raw text directly instead of a file path, which is useful when pasting content from a clipboard or another tool.

### Importing from a meeting transcript

**Tool:** `sdd_auto_pipeline`

For meeting transcripts, the auto pipeline extracts participants, topics, decisions, and action items, then generates all specification artifacts in a single call:

```
Process this Teams meeting recording and create a full specification: ./recordings/sprint-planning.vtt
```

This generates all five artifacts (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, ANALYSIS.md) plus a cleaned TRANSCRIPT.md.

### Batch importing from a directory

**Tool:** `sdd_batch_import`

If you have a folder of documents to process:

```
Import all documents from ./incoming-docs/ and create specifications for each.
```

Each document becomes its own numbered feature directory under `.specs/`.

### Power Automate integration for continuous import

For teams using Microsoft Teams, you can set up a fully automated pipeline:

```
Teams Meeting --> Power Automate --> OneDrive/Transcripts/ --> sdd_batch_transcripts --> .specs/
```

**Power Automate flow:**

1. Trigger: "When a Teams meeting recording is available"
2. Action: Get the meeting transcript
3. Action: Convert to Markdown
4. Action: Save to `OneDrive/Transcripts/{meeting-title}.md`

**Specky batch processing:**

```
Process all transcripts in my OneDrive transcripts folder.
```

The AI calls `sdd_batch_transcripts` and each transcript becomes a numbered feature spec.


## 9. Exporting to Azure Boards, Jira, and GitHub Issues

Once your specification is complete and the quality gate approves it, you can export tasks as work items to your project tracking platform.

### Tool: `sdd_export_work_items`

**Export to GitHub Issues:**

```
Export the tasks from feature 001 as GitHub Issues.
```

**Export to Azure Boards:**

```
Export the tasks from feature 001 to Azure Boards with area path "MyProject\Backend" and iteration "Sprint 23".
```

**Export to Jira:**

```
Export the tasks from feature 001 to Jira with project key TASK.
```

### What gets exported

Each task from TASKS.md becomes a work item with:

- **Title** derived from the task description
- **Description** including the full acceptance criteria from SPECIFICATION.md
- **Labels/Tags** based on requirement category (functional, performance, security)
- **Priority** mapped from effort estimates
- **Traceability links** referencing the requirement ID and design component
- **Subtasks** for each acceptance criterion (when `include_subtasks` is enabled)

### Platform-specific options

| Platform | Required Fields | Optional Fields |
|----------|----------------|-----------------|
| GitHub Issues | `feature_number` | `include_subtasks` |
| Azure Boards | `feature_number` | `area_path`, `iteration_path`, `include_subtasks` |
| Jira | `feature_number`, `project_key` | `include_subtasks` |

### Creating a feature branch and PR

Specky also supports Git workflow integration:

**Create a feature branch:**

```
Create a feature branch for feature 001.
```

Tool: `sdd_create_branch` creates `feature/001-task-management-api` from your base branch.

**Create a pull request:**

```
Create a draft PR for feature 001.
```

Tool: `sdd_create_pr` generates a PR with a description that includes the specification summary, design highlights, and task checklist.


## 10. Generating Infrastructure as Code

Specky can generate infrastructure code directly from your DESIGN.md architecture. This ensures your infrastructure matches your specification.

### Generating Terraform or Bicep

**Tool:** `sdd_generate_iac`

```
Generate Terraform code for feature 001 targeting Azure.
```

```
Generate Bicep templates for feature 001.
```

Specky reads DESIGN.md, detects the required infrastructure components (compute, networking, database, messaging, storage), and generates provider-specific code.

**Supported providers:**

| IaC Provider | Cloud Targets |
|-------------|---------------|
| Terraform | Azure, AWS, GCP |
| Bicep | Azure |

**What gets generated:**

- Resource definitions for each design component
- Variable files with sensible defaults
- Output definitions for cross-module references
- Module structure following provider best practices

### Generating Dockerfiles

**Tool:** `sdd_generate_dockerfile`

```
Generate a Dockerfile and docker-compose.yml for feature 001.
```

Specky detects the tech stack from DESIGN.md and generates:

- Multi-stage Dockerfile optimized for production
- docker-compose.yml with all required services (database, cache, message broker)
- Environment variable templates

### Generating dev containers

**Tool:** `sdd_generate_devcontainer`

```
Generate a devcontainer configuration for feature 001.
```

Produces `.devcontainer/devcontainer.json` with:

- Base image matched to the detected tech stack
- Required VS Code extensions
- Port forwarding configuration
- Post-create setup commands

### Setting up local development environments

**Tool:** `sdd_setup_local_env`

```
Set up a local development environment for feature 001 with PostgreSQL and Redis.
```

Generates a Docker Compose payload for creating the local development stack.

### Setting up GitHub Codespaces

**Tool:** `sdd_setup_codespaces`

```
Configure a Codespaces environment for feature 001.
```

Produces a payload compatible with the GitHub MCP server for Codespaces provisioning.

### Validating generated IaC

**Tool:** `sdd_validate_iac`

```
Validate the Terraform code generated for feature 001.
```

Produces a validation payload that the AI routes to Terraform MCP or Azure MCP for plan/validate execution.


## 11. Generating Diagrams

Specky generates Mermaid diagrams from your specification artifacts. These diagrams are embedded directly in Markdown and render in GitHub, VS Code, and most documentation platforms.

### Generating a single diagram

**Tool:** `sdd_generate_diagram`

```
Generate a sequence diagram from the design of feature 001.
```

**Supported diagram types:**

| Type | Use Case |
|------|----------|
| `flowchart` | Process flows, decision trees |
| `sequence` | API call sequences, service interactions |
| `class` | Domain model, service interfaces |
| `er` | Database entity-relationship diagrams |
| `state` | State machines, lifecycle diagrams |
| `c4_context` | C4 model context diagrams |
| `c4_container` | C4 model container diagrams |
| `gantt` | Project timeline, task scheduling |
| `pie` | Distribution charts (effort, coverage) |
| `mindmap` | Feature decomposition, brainstorming |

**Source artifacts:** Each diagram can be generated from `spec`, `design`, `tasks`, or `constitution`.

### Generating all diagrams at once

**Tool:** `sdd_generate_all_diagrams`

```
Generate all diagrams for feature 001.
```

This produces architecture, sequence, ERD, flow, dependency, and traceability diagrams in a single call.

### Generating user stories with flow diagrams

**Tool:** `sdd_generate_user_stories`

```
Generate user stories from the specification of feature 001.
```

Each user story includes:

- Story title and narrative ("As a... I want... So that...")
- Acceptance criteria derived from the EARS requirements
- A Mermaid flowchart of the user journey

### Exporting to Figma/FigJam

**Tool:** `sdd_figma_diagram`

```
Generate a FigJam architecture diagram for feature 001.
```

Produces structured data compatible with the Figma MCP server's `generate_diagram` tool. Supported types: `architecture`, `user_flow`, `data_flow`, `integration`.


## 12. Running Compliance Checks

Specky validates your specifications against industry compliance frameworks. This ensures that security, privacy, and regulatory requirements are addressed in the specification before any code is written.

### Running a compliance check

**Tool:** `sdd_compliance_check`

```
Run a HIPAA compliance check on feature 001.
```

**Supported frameworks:**

| Framework | Focus Areas |
|-----------|------------|
| `hipaa` | Protected health information, access controls, audit trails |
| `soc2` | Security, availability, processing integrity, confidentiality, privacy |
| `gdpr` | Data protection, consent, right to erasure, data portability |
| `pci_dss` | Cardholder data protection, encryption, access control |
| `iso27001` | Information security management system controls |
| `general` | Broad security and privacy best practices |

**Output:** Specky writes `COMPLIANCE.md` with:

- Framework controls mapped to specification requirements
- Gap analysis showing which controls lack coverage
- Recommended additional requirements to close gaps
- Risk assessment for each uncovered control

### Cross-artifact consistency analysis

**Tool:** `sdd_cross_analyze`

```
Run cross-analysis on feature 001.
```

This checks alignment between SPECIFICATION.md, DESIGN.md, and TASKS.md. It detects:

- Orphaned requirements (specified but not designed or tasked)
- Missing designs (tasked but not designed)
- Untraced tasks (tasks with no requirement linkage)
- Contradictions between artifacts

Writes `CROSS_ANALYSIS.md`.

### Quality checklists

**Tool:** `sdd_checklist`

```
Generate a security checklist for feature 001.
```

Available domains: `security`, `accessibility`, `performance`, `testing`, `documentation`, `deployment`, `general`.

Writes `CHECKLIST.md` with domain-specific validation items.

### Verifying task implementation

**Tool:** `sdd_verify_tasks`

```
Verify that the tasks for feature 001 are implemented in src/.
```

This compares TASKS.md against actual code files to detect "phantom completions", tasks marked as done with no corresponding code evidence. Writes `VERIFICATION.md`.

### EARS validation

**Tool:** `sdd_validate_ears`

```
Validate the EARS notation in the specification for feature 001.
```

Checks every requirement against the six EARS patterns and provides improvement suggestions for any that are ambiguous or structurally weak.


## 13. Generating Tests from Specifications (NEW in v2.3.0)

Specky can generate test stubs directly from your acceptance criteria — with full traceability back to requirements. This is the competitive differentiator: every test maps to a requirement ID.

### Supported Frameworks

| Framework | Language | File Extension |
|-----------|----------|----------------|
| **vitest** | TypeScript | `.test.ts` |
| **jest** | TypeScript | `.test.ts` |
| **playwright** | TypeScript | `.spec.ts` |
| **pytest** | Python | `_test.py` |
| **junit** | Java | `Test.java` |
| **xunit** | C# | `Tests.cs` |

### How It Works

After writing your specification (`sdd_write_spec`) and tasks (`sdd_write_tasks`), ask:

```
Generate vitest tests from my specification for feature 001
```

Specky calls `sdd_generate_tests` which:

1. Reads `SPECIFICATION.md` and `TASKS.md` from the feature directory
2. Extracts acceptance criteria and maps them to requirement IDs
3. Generates a test file with one test stub per criterion
4. Each stub has a `TODO` placeholder for you to fill with real assertions

### Example Output

For a specification with 3 acceptance criteria, Specky generates:

```typescript
/**
 * Auto-generated test stubs from Specky SDD
 * Feature: user-auth
 * Framework: vitest
 */
import { describe, it, expect } from "vitest";

describe("user-auth", () => {
  it("Verify that valid credentials return a JWT token", () => {
    // TODO: implement test — traces to REQ-001
    expect(true).toBe(true);
  });

  it("Ensure expired tokens trigger re-authentication", () => {
    // TODO: implement test — traces to REQ-001
    expect(true).toBe(true);
  });

  it("Check that stored data is encrypted", () => {
    // TODO: implement test — traces to REQ-002
    expect(true).toBe(true);
  });
});
```

### Verifying Test Coverage Against Requirements

After running your tests, use `sdd_verify_tests` to check how many requirements have passing tests:

```
Verify my test results against the specification for feature 001
```

This reads your test results JSON and compares test names against requirement IDs in `SPECIFICATION.md`. It reports:

- **Covered requirements** — which REQs have corresponding tests
- **Uncovered requirements** — which REQs are missing tests
- **Coverage percentage** — requirement-level coverage (not code coverage)

### Playwright Integration

When you choose Playwright as the framework, Specky automatically includes a `recommended_servers` field suggesting the Playwright MCP server for auto-execution:

```json
{
  "recommended_servers": [{
    "id": "playwright-mcp",
    "name": "Playwright MCP",
    "purpose": "Execute generated Playwright tests directly from the AI client"
  }]
}
```


## 14. Project Configuration (NEW in v2.3.0)

Create a `.specky/config.yml` file in your project root to customize Specky's behavior:

```yaml
# .specky/config.yml

# Use your own templates instead of built-in ones
templates_path: ./my-templates

# Default test framework for sdd_generate_tests
default_framework: vitest

# Compliance frameworks to check (array)
compliance_frameworks: [hipaa, soc2]

# Enable audit trail logging
audit_enabled: true
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templates_path` | string | `""` (built-in) | Path to custom Markdown templates |
| `default_framework` | string | `"vitest"` | Default test framework: vitest, jest, playwright, pytest, junit, xunit |
| `compliance_frameworks` | array | `["general"]` | Frameworks for compliance checks: hipaa, soc2, gdpr, pci_dss, iso27001, general |
| `audit_enabled` | boolean | `false` | Log tool invocations locally |

If no config file exists, Specky uses sensible defaults and works out of the box.


## 15. Specky and the Spec-Kit Foundation

Specky is a **complete, self-contained SDD platform**. It already includes the full [Spec-Kit](https://github.com/paulasilvatech/spec-kit) methodology — the EARS notation, the pipeline phases, the quality patterns, the 22 Markdown templates. **You do not need to install Spec-Kit separately.**

### What comes from Spec-Kit (already built into Specky)

- EARS notation for testable requirements (6 patterns)
- 10-phase pipeline structure (Init → Release)
- 22 Markdown templates for all spec artifacts
- Quality gate patterns and traceability model
- Spec-Driven Development methodology

### What Specky adds on top

- **52 MCP tools** — programmatic enforcement via state machine
- **EARS validator** — regex-based validation, flags vague terms automatically
- **6 input types** — transcripts, documents, Figma, codebase scan, raw text, prompts
- **Compliance engines** — HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001
- **Test generation** — 6 frameworks (vitest, jest, playwright, pytest, junit, xunit)
- **MCP-to-MCP routing** — structured payloads for GitHub, Azure DevOps, Jira, Terraform, Figma, Docker
- **Cross-artifact analysis** — alignment checking with consistency scoring
- **Educative outputs** — every tool response explains what happened and what to do next

### When to use Spec-Kit directly

[Spec-Kit](https://github.com/paulasilvatech/spec-kit) is still useful as a standalone learning tool if you want to learn SDD concepts before using the full platform, or if you work in environments where MCP servers are not available. But for production use, **Specky is all you need** — one install, everything included.


## 16. The Full Pipeline. From Meeting to Deployment

Here is the complete workflow that takes a project from an initial meeting to deployment-ready specifications, infrastructure, and work items.

### Step 1: Record the meeting

Hold your kickoff meeting in Microsoft Teams or Zoom with recording enabled. After the meeting, download the transcript file (`.vtt` for Teams, `.srt` for Zoom).

### Step 2: Import the transcript

```
Process this meeting transcript and create a full specification: ./meeting-transcript.vtt
```

**Tool chain:** `sdd_auto_pipeline` processes the transcript and generates all five specification artifacts in one call.

### Step 3: Review and refine

Read each artifact. Ask the AI to clarify or modify specific requirements:

```
In REQ-FUNC-003, change the notification transport from SSE to WebSocket.
Add a requirement for rate limiting at 100 requests per minute per user.
```

The AI calls `sdd_write_spec` to update the specification, then `sdd_clarify` to verify the changes are unambiguous.

### Step 4: Generate diagrams

```
Generate all diagrams for feature 001.
```

**Tool:** `sdd_generate_all_diagrams` produces architecture, sequence, ERD, and flow diagrams.

### Step 5: Run compliance checks

```
Run SOC 2 compliance check on feature 001.
Run cross-analysis on feature 001.
```

**Tools:** `sdd_compliance_check` and `sdd_cross_analyze` validate the specification against compliance controls and check cross-artifact consistency.

### Step 6: Generate infrastructure

```
Generate Terraform code for feature 001 targeting Azure.
Generate a Dockerfile for feature 001.
Generate a devcontainer for feature 001.
```

**Tools:** `sdd_generate_iac`, `sdd_generate_dockerfile`, `sdd_generate_devcontainer`.

### Step 7: Export work items

```
Export the tasks from feature 001 to Azure Boards with iteration "Sprint 23".
```

**Tool:** `sdd_export_work_items` creates work items in your project tracker with full traceability.

### Step 8: Create the feature branch

```
Create a feature branch for feature 001.
```

**Tool:** `sdd_create_branch` creates `feature/001-task-management-api` from main.

### Step 9: Generate documentation

```
Generate full documentation for feature 001.
Generate an API docs template for feature 001.
Generate a runbook for feature 001.
```

**Tools:** `sdd_generate_docs`, `sdd_generate_api_docs`, `sdd_generate_runbook`.

### Step 10: Implement with traceability

```
Generate an implementation plan for feature 001.
```

**Tool:** `sdd_implement` produces a phased implementation guide with checkpoints for review. Each phase maps to tasks in TASKS.md, which trace back to requirements in SPECIFICATION.md.

### Step 11: Verify and release

After implementation, verify that all tasks are complete:

```
Verify tasks for feature 001 against the code in src/.
```

**Tool:** `sdd_verify_tasks` checks for phantom completions and writes VERIFICATION.md.

Create the pull request:

```
Create a PR for feature 001.
```

**Tool:** `sdd_create_pr` generates a PR description with the specification summary, design highlights, and a task checklist.

### The complete tool chain

```
sdd_auto_pipeline (or manual init/discover/specify/clarify/design/tasks/analyze)
    |
    v
sdd_generate_all_diagrams + sdd_compliance_check + sdd_cross_analyze
    |
    v
sdd_generate_iac + sdd_generate_dockerfile + sdd_generate_devcontainer
    |
    v
sdd_export_work_items + sdd_create_branch
    |
    v
sdd_generate_docs + sdd_generate_api_docs + sdd_generate_runbook
    |
    v
sdd_implement --> code --> sdd_verify_tasks --> sdd_create_pr
```


## 17. Tool Reference Summary

Specky v2.3.0 provides 52 MCP tools organized into eight groups.

### Pipeline Tools (8)

| Tool | Purpose |
|------|---------|
| `sdd_init` | Create project structure and CONSTITUTION.md |
| `sdd_discover` | Generate tailored discovery questions |
| `sdd_write_spec` | Write EARS-validated SPECIFICATION.md |
| `sdd_clarify` | Identify ambiguities and generate clarification questions |
| `sdd_write_design` | Write DESIGN.md with diagrams and ADRs |
| `sdd_write_tasks` | Write TASKS.md with effort, dependencies, traceability |
| `sdd_run_analysis` | Generate traceability matrix and quality gate decision |
| `sdd_advance_phase` | Manually advance the state machine |

### Utility Tools (6)

| Tool | Purpose |
|------|---------|
| `sdd_get_status` | Check current pipeline phase and progress |
| `sdd_get_template` | Retrieve a raw template with placeholders |
| `sdd_write_bugfix` | Create a bugfix specification (not gated by pipeline) |
| `sdd_check_sync` | Detect specification-code drift |
| `sdd_scan_codebase` | Detect tech stack for auto-steering |
| `sdd_amend` | Append amendment to CONSTITUTION.md |

### Transcript Tools (3)

| Tool | Purpose |
|------|---------|
| `sdd_import_transcript` | Parse VTT/SRT/TXT/MD transcripts |
| `sdd_auto_pipeline` | Full automation: transcript to all artifacts |
| `sdd_batch_transcripts` | Process all transcripts in a directory |

### Input and Conversion Tools (3)

| Tool | Purpose |
|------|---------|
| `sdd_import_document` | Import PDF, DOCX, PPTX, TXT, MD |
| `sdd_batch_import` | Batch import all documents from a directory |
| `sdd_figma_to_spec` | Extract Figma design context into requirements |

### Quality and Validation Tools (5)

| Tool | Purpose |
|------|---------|
| `sdd_checklist` | Generate domain-specific quality checklists |
| `sdd_verify_tasks` | Verify task implementation against code |
| `sdd_compliance_check` | Validate against HIPAA, SOC 2, GDPR, PCI DSS, ISO 27001 |
| `sdd_cross_analyze` | Cross-artifact consistency analysis |
| `sdd_validate_ears` | Validate and improve EARS notation |

### Diagrams and Visualization Tools (4)

| Tool | Purpose |
|------|---------|
| `sdd_generate_diagram` | Generate a single Mermaid diagram |
| `sdd_generate_all_diagrams` | Generate all diagram types for a feature |
| `sdd_generate_user_stories` | Generate user stories with flow diagrams |
| `sdd_figma_diagram` | Generate FigJam-compatible diagram data |

### Infrastructure as Code Tools (3)

| Tool | Purpose |
|------|---------|
| `sdd_generate_iac` | Generate Terraform or Bicep from DESIGN.md |
| `sdd_validate_iac` | Validate IaC against cloud provider |
| `sdd_generate_dockerfile` | Generate Dockerfile and docker-compose.yml |

### Dev Environment Tools (3)

| Tool | Purpose |
|------|---------|
| `sdd_setup_local_env` | Generate local dev environment configuration |
| `sdd_setup_codespaces` | Configure GitHub Codespaces environment |
| `sdd_generate_devcontainer` | Generate .devcontainer configuration |

### Integration and Export Tools (5)

| Tool | Purpose |
|------|---------|
| `sdd_create_branch` | Create a Git feature branch |
| `sdd_export_work_items` | Export to GitHub Issues, Azure Boards, or Jira |
| `sdd_create_pr` | Create a pull request with spec-driven description |
| `sdd_implement` | Generate phased implementation plan |
| `sdd_research` | Investigate and resolve research questions |

### Documentation Tools (4)

| Tool | Purpose |
|------|---------|
| `sdd_generate_docs` | Generate comprehensive feature documentation |
| `sdd_generate_api_docs` | Generate API documentation template |
| `sdd_generate_runbook` | Generate operations runbook |
| `sdd_generate_onboarding` | Generate developer onboarding guide |

### Metrics (1)

| Tool | Purpose |
|------|---------|
| `sdd_metrics` | Collect and report specification metrics |


## 18. Next Steps

### Explore the reference materials

- [EARS Notation Guide](references/ears-notation.md). Complete syntax reference with examples for all six patterns
- [Specification Templates](references/spec-templates.md). Boilerplate templates for common feature types
- [Design Patterns](references/design-patterns.md). Architecture templates for the design phase

### Customize for your organization

- Modify templates in `templates/` to match your naming conventions and standards
- Add organization-specific principles to CONSTITUTION.md
- Configure compliance frameworks relevant to your industry

### Integrate with your CI/CD pipeline

- Use `sdd_check_sync` in CI to detect specification-code drift before merge
- Run `sdd_verify_tasks` as a pre-merge gate to catch phantom completions
- Generate work items automatically from approved specifications

### Check your MCP ecosystem

Run `sdd_check_ecosystem` to discover which MCP servers are available in your environment and get recommendations for complementary servers:

```
Use sdd_check_ecosystem to find recommended MCP servers for my project
```

Specky integrates with GitHub MCP, Azure DevOps MCP, Jira MCP, Terraform MCP, Figma MCP, and Docker MCP. See [docs/integration-cookbook.md](docs/integration-cookbook.md) for practical recipes.

### Run the test suite

If you're contributing or want to verify your installation:

```bash
# Run all 292 unit tests
npm test

# Run with coverage report
npm run test:coverage
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full testing guide.

### Learn more

- [README.md](README.md). Full tool documentation and architecture overview
- [CONTRIBUTING.md](CONTRIBUTING.md). How to contribute tools, templates, and services
- [PUBLISH.md](PUBLISH.md). How to publish to GitHub, npm, and Docker
- [GitHub Repository](https://github.com/paulasilvatech/specky). Source code and issue tracker

**Created by [Paula Silva](https://github.com/paulasilvatech)** ([@paulanunes85](https://twitter.com/paulanunes85)) | Americas Software GBB

*Specky. The fun name, the serious engine.*
