<div align="center">
  <h1>Specky</h1>
  <h3>The Complete Spec-Driven Development Platform</h3>
  <p><strong>44 MCP tools. 10-phase pipeline. Works in any IDE.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/specky-sdd"><img src="https://img.shields.io/npm/v/specky-sdd" alt="npm"/></a>
    <a href="https://github.com/paulasilvatech/specky/actions/workflows/ci.yml"><img src="https://github.com/paulasilvatech/specky/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
    <a href="https://github.com/paulasilvatech/specky"><img src="https://img.shields.io/github/stars/paulasilvatech/specky?style=social" alt="Stars"/></a>
    <a href="https://github.com/paulasilvatech/specky/blob/main/LICENSE"><img src="https://img.shields.io/github/license/paulasilvatech/specky" alt="License"/></a>
  </p>
</div>

---

## What is Specky?

Specky is an open-source MCP (Model Context Protocol) server that transforms how software is built. It provides a complete, deterministic pipeline from any input -- meeting transcripts, documents, designs, or user prompts -- through specifications, architecture, infrastructure as code, implementation, and deployment.

Unlike template-based tools, Specky enforces every step programmatically: a state machine blocks phase-skipping, an EARS validator ensures testable requirements, cross-artifact analysis catches drift, and compliance engines validate against frameworks like HIPAA and SOC2.

**Specky works inside the tools you already use** -- VS Code with GitHub Copilot, Claude Code, Cursor, Windsurf, or any AI agent that supports MCP.

---

## Why Specky?

### The Problem

AI coding assistants are fast but chaotic. They skip requirements, ignore architecture, and produce code that drifts from the original intent. Template-based approaches help but rely on the AI to follow instructions -- with no programmatic enforcement.

### The Solution

Specky adds a **deterministic engine** between your intent and your code:

- **State Machine** -- 10 mandatory phases, no skipping. Init, Discover, Specify, Clarify, Design, Tasks, Analyze, Implement, Verify, Release.
- **EARS Validator** -- Every requirement validated against 6 patterns (Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex). No vague statements pass.
- **Cross-Artifact Analysis** -- Automatic alignment checking between spec, design, and tasks. Orphaned requirements are flagged instantly.
- **MCP-to-MCP Architecture** -- Specky outputs structured JSON that your AI client routes to GitHub, Azure DevOps, Jira, Terraform, Figma, and Docker MCP servers. No vendor lock-in.

### Differentiators

<p align="center">
  <img src="media/comparison-matrix.svg" alt="Specky vs Spec-Kit vs Kiro vs Cursor" width="100%"/>
</p>

<details>
<summary>View as table</summary>

| Capability | Spec-Kit | Kiro | Cursor | **Specky** |
|---|---|---|---|---|
| Any input (PDF/DOCX/PPTX/transcript) to spec | No | No | No | **Yes** |
| EARS validation (programmatic) | No | AI-tries | No | **Yes** |
| State machine (10 phases) | No | No | No | **Yes** |
| Auto-diagrams every phase (Mermaid) | No | No | No | **Yes** |
| Terraform IaC generation | No | No | No | **Yes** |
| Azure Boards + Jira + GitHub Issues (MCP) | Extension | No | No | **Yes** |
| Figma design to spec (reverse) | No | No | No | **Yes** |
| FigJam diagram generation | No | No | No | **Yes** |
| Docker dev environment | No | No | No | **Yes** |
| Codespaces setup | No | No | No | **Yes** |
| Cross-artifact analysis | Yes | No | No | **Yes** |
| Compliance (HIPAA/SOC2/GDPR) | No | No | No | **Yes** |
| Phantom task detection | Extension | No | No | **Yes** |
| Complete auto-documentation | No | No | No | **Yes** |
| Educative outputs | No | No | No | **Yes** |
| 42 MCP tools | N/A | N/A | N/A | **Yes** |
| Works in ANY IDE via MCP | Templates | IDE-locked | IDE-locked | **Yes** |

</details>

---

## Quick Start

### Install

```bash
# npm (recommended)
npx specky-sdd

# Or install globally
npm install -g specky-sdd
```

### Configure in VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your project:

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

Open Copilot Chat -- Specky's 44 tools are now available.

### Configure in Claude Code

```bash
claude mcp add specky -- npx -y specky-sdd
```

Or add to your MCP settings manually:

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd"],
      "env": {
        "SDD_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

### Configure in Claude Desktop

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
      "args": ["-y", "specky-sdd"],
      "env": {
        "SDD_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

### Configure in Cursor

Add to Cursor's MCP settings (Settings > MCP Servers):

```json
{
  "specky": {
    "command": "npx",
    "args": ["-y", "specky-sdd"]
  }
}
```

### Docker

```bash
docker run -v $(pwd):/workspace ghcr.io/paulasilvatech/specky:latest
```

---

## The 10-Phase Pipeline

<p align="center">
  <img src="media/pipeline-10-phases.svg" alt="Specky 10-Phase Pipeline" width="100%"/>
</p>

Each phase is **mandatory**. The state machine blocks advancement until prerequisites are met.

| Phase | What Happens | Required Output |
|-------|-------------|----------------|
| **Init** | Create project structure, constitution, scan codebase | CONSTITUTION.md |
| **Discover** | Interactive discovery: 7 structured questions about scope, users, constraints | Discovery answers |
| **Specify** | Write EARS requirements with acceptance criteria | SPECIFICATION.md |
| **Clarify** | Resolve ambiguities, generate decision tree | Updated SPECIFICATION.md |
| **Design** | Architecture, data model, API contracts, research unknowns | DESIGN.md, RESEARCH.md |
| **Tasks** | Implementation breakdown by user story, dependency graph | TASKS.md |
| **Analyze** | Cross-artifact analysis, quality checklist, compliance check | ANALYSIS.md, CHECKLIST.md, CROSS_ANALYSIS.md |
| **Implement** | Ordered execution with checkpoints per user story | Implementation progress |
| **Verify** | Drift detection, phantom task detection | VERIFICATION.md |
| **Release** | PR generation, work item export, documentation | Complete package |

---

## All 44 Tools

### Input and Conversion (5)

| Tool | Description |
|------|-------------|
| `sdd_import_document` | Convert PDF, DOCX, PPTX, TXT, MD to Markdown |
| `sdd_import_transcript` | Parse meeting transcripts (Teams, Zoom, Google Meet) |
| `sdd_auto_pipeline` | Any input to complete spec pipeline (all documents) |
| `sdd_batch_import` | Process folder of mixed documents |
| `sdd_figma_to_spec` | Figma design to requirements specification |

### Pipeline Core (8)

| Tool | Description |
|------|-------------|
| `sdd_init` | Initialize project with constitution and scope diagram |
| `sdd_discover` | Interactive discovery with stakeholder mapping |
| `sdd_write_spec` | Write EARS requirements with flow diagrams |
| `sdd_clarify` | Resolve ambiguities with decision tree |
| `sdd_write_design` | Architecture with sequence diagrams, ERD, API flow |
| `sdd_write_tasks` | Task breakdown with dependency graph |
| `sdd_run_analysis` | Quality gate analysis with coverage heatmap |
| `sdd_advance_phase` | Move to next pipeline phase |

### Quality and Validation (5)

| Tool | Description |
|------|-------------|
| `sdd_checklist` | Mandatory quality checklist (security, accessibility, etc.) |
| `sdd_verify_tasks` | Detect phantom completions |
| `sdd_compliance_check` | HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001 validation |
| `sdd_cross_analyze` | Spec-design-tasks alignment with consistency score |
| `sdd_validate_ears` | Batch EARS requirement validation |

### Diagrams and Visualization (4)

| Tool | Description |
|------|-------------|
| `sdd_generate_diagram` | Single Mermaid diagram (10 types) |
| `sdd_generate_all_diagrams` | All diagrams for a feature at once |
| `sdd_generate_user_stories` | User stories with flow diagrams |
| `sdd_figma_diagram` | FigJam-ready diagram via Figma MCP |

### Infrastructure as Code (3)

| Tool | Description |
|------|-------------|
| `sdd_generate_iac` | Terraform/Bicep from architecture design |
| `sdd_validate_iac` | Validation via Terraform MCP + Azure MCP |
| `sdd_generate_dockerfile` | Dockerfile + docker-compose from tech stack |

### Dev Environment (3)

| Tool | Description |
|------|-------------|
| `sdd_setup_local_env` | Docker-based local dev environment |
| `sdd_setup_codespaces` | GitHub Codespaces configuration |
| `sdd_generate_devcontainer` | .devcontainer/devcontainer.json generation |

### Integration and Export (5)

| Tool | Description |
|------|-------------|
| `sdd_create_branch` | Git branch naming convention |
| `sdd_export_work_items` | Tasks to GitHub Issues, Azure Boards, or Jira |
| `sdd_create_pr` | PR payload with spec summary |
| `sdd_implement` | Ordered implementation plan with checkpoints |
| `sdd_research` | Resolve unknowns in RESEARCH.md |

### Documentation (4)

| Tool | Description |
|------|-------------|
| `sdd_generate_docs` | Complete auto-documentation |
| `sdd_generate_api_docs` | API documentation from design |
| `sdd_generate_runbook` | Operational runbook |
| `sdd_generate_onboarding` | Developer onboarding guide |

### Utility (5)

| Tool | Description |
|------|-------------|
| `sdd_get_status` | Pipeline status with guided next action |
| `sdd_get_template` | Get any template |
| `sdd_scan_codebase` | Detect tech stack and structure |
| `sdd_metrics` | Project metrics dashboard |
| `sdd_amend` | Amend project constitution |

---

## MCP Integration Architecture

<p align="center">
  <img src="media/architecture-mcp-ecosystem.svg" alt="Specky MCP Ecosystem Architecture" width="100%"/>
</p>

Specky outputs structured JSON with routing instructions. Your AI client calls the appropriate external MCP server:

```
Specky --> sdd_export_work_items(platform: "azure_boards") --> JSON payload
  --> AI Client --> Azure DevOps MCP --> create_work_item()

Specky --> sdd_validate_iac(provider: "terraform") --> validation payload
  --> AI Client --> Terraform MCP --> plan/validate

Specky --> sdd_figma_to_spec(file_key: "abc123") --> Figma request
  --> AI Client --> Figma MCP --> get_design_context()
```

### Supported External MCP Servers

| MCP Server | Integration |
|-----------|-------------|
| **GitHub MCP** | Issues, PRs, Codespaces |
| **Azure DevOps MCP** | Work Items, Boards |
| **Jira MCP** | Issues, Projects |
| **Terraform MCP** | Plan, Validate, Apply |
| **Azure MCP** | Template validation |
| **Figma MCP** | Design context, FigJam diagrams |
| **Docker MCP** | Local dev environments |

---

## EARS Notation

Every requirement in Specky follows EARS (Easy Approach to Requirements Syntax):

| Pattern | Format | Example |
|---------|--------|---------|
| Ubiquitous | The system shall... | The system shall encrypt all data at rest |
| Event-driven | When [event], the system shall... | When a user submits login, the system shall validate credentials |
| State-driven | While [state], the system shall... | While offline, the system shall queue requests |
| Optional | Where [condition], the system shall... | Where 2FA is enabled, the system shall require OTP |
| Unwanted | If [condition], then the system shall... | If session expires, the system shall redirect to login |
| Complex | While [state], when [event]... | While in maintenance, when request arrives, queue it |

The EARS validator programmatically checks every requirement against these 6 patterns. Vague terms like "fast", "good", "easy" are flagged automatically.

---

## Compliance Frameworks

Built-in compliance checking against:

- **HIPAA** -- Access control, audit, encryption, PHI protection
- **SOC 2** -- Logical access, monitoring, change management, incident response
- **GDPR** -- Lawful processing, right to erasure, data portability, breach notification
- **PCI-DSS** -- Firewall, stored data protection, encryption, user identification
- **ISO 27001** -- Security policies, access control, cryptography, incident management

---

## Educative Outputs

Every tool response includes structured guidance:

```json
{
  "explanation": "What was done and why",
  "next_steps": "Guided next action with command suggestion",
  "learning_note": "Educational context about the concept",
  "diagram": "Mermaid diagram relevant to the output"
}
```

---

## End-to-End Flow

<p align="center">
  <img src="media/end-to-end-flow.svg" alt="Specky End-to-End Development Flow" width="100%"/>
</p>

From any input to production — fully automated, MCP-orchestrated, with artifacts and diagrams generated at every step.

---

## Project Structure

```
.specs/
  001-feature-name/
    CONSTITUTION.md       -- Project principles and governance
    SPECIFICATION.md      -- EARS requirements with acceptance criteria
    DESIGN.md             -- Architecture, data model, API contracts
    RESEARCH.md           -- Resolved unknowns and decisions
    TASKS.md              -- Implementation breakdown
    ANALYSIS.md           -- Quality gate report
    CHECKLIST.md          -- Mandatory quality checklist
    CROSS_ANALYSIS.md     -- Spec-design-tasks alignment
    COMPLIANCE.md         -- Compliance framework report
    VERIFICATION.md       -- Phantom detection results
```

---

## Enterprise Ready

Specky is built with enterprise adoption in mind.

### Security Posture

- **2 runtime dependencies** — minimal attack surface (`@modelcontextprotocol/sdk`, `zod`)
- **Zero outbound network requests** — all data stays local
- **No `eval()` or dynamic code execution** — template rendering is string replacement only
- **Path traversal prevention** — FileManager sanitizes all paths, blocks `..` sequences
- **Zod `.strict()` validation** — every tool input is schema-validated; unknown fields rejected
- See [SECURITY.md](SECURITY.md) for full OWASP Top 10 coverage

### Compliance Validation

Built-in compliance checking validates your specifications against industry frameworks:

| Framework | Controls | Use Case |
|-----------|----------|----------|
| HIPAA | 6 controls | Healthcare applications |
| SOC 2 | 6 controls | SaaS and cloud services |
| GDPR | 5 controls | EU data processing |
| PCI-DSS | 6 controls | Payment card handling |
| ISO 27001 | 6 controls | Enterprise security management |

### Audit Trail

Every pipeline phase produces a traceable artifact in `.specs/NNN-feature/`. The complete specification-to-code journey is documented and reproducible.

### Quality Gates

- **EARS Validator** — programmatic requirement quality enforcement
- **Cross-Artifact Analysis** — automatic alignment checking between spec, design, and tasks
- **Phase Enforcement** — state machine blocks phase-skipping; required files gate advancement
- **101 unit tests** with Vitest; CI runs on every push

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
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details and how to add tools, templates, or services.

---

## License

MIT -- Created by [Paula Silva](https://github.com/paulasilvatech) | Americas Software GBB, Microsoft
