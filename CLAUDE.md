# Specky v2.1.0 -- Claude Code Project Instructions

**Auto-loaded by Claude Code when working in this directory.**

---

## 1. Project Overview

Specky v2.1.0 is an **MCP server for Spec-Driven Development (SDD)** that enforces traceability between requirements, design, implementation, and tests. It exposes **44 tools** across a **10-phase pipeline**, uses EARS notation for requirement statements, and includes 14 services, 21 templates, 4 Custom Agents, and 6 automation hooks.

**Goal:** Close the gap between specification and code through continuous validation, preventing drift and ensuring acceptance criteria are met.

**What changed in v2.0.0:** The tool count grew from 17 to 42. The pipeline expanded from 7 phases to 10 (adding Discover, Clarify, and Release). New capabilities include compliance checking, diagram generation, IaC generation, document import, cross-spec analysis, work item export, and MCP-to-MCP routing for integration with GitHub, Docker, and Terraform MCP servers.

---

## 2. Available Commands

Use these `/sdd:*` commands in Claude Code to invoke specialized workflows:

| Command | Agent | Purpose | Output |
|---------|-------|---------|--------|
| `/sdd:spec` | Spec Engineer | Write or refine requirements in EARS notation | `.specs/NNN-feature/SPECIFICATION.md` |
| `/sdd:design` | Design Architect | Create architecture and interface design | `.specs/NNN-feature/DESIGN.md` |
| `/sdd:tasks` | Task Planner | Break specification into implementation tasks | `.specs/NNN-feature/TASKS.md` |
| `/sdd:analyze` | Spec Reviewer | Audit spec for ambiguity, completeness, traceability | `reports/spec-analysis.md` |
| `/sdd:bugfix` | Spec Reviewer | Link bugs to failing acceptance criteria | `reports/bugfix-trace.md` |
| `/sdd:transcript` | Spec Engineer | Import meeting transcript and auto-generate specs | `.specs/NNN-feature/SPECIFICATION.md` |
| `/sdd:onedrive` | Spec Engineer | Import OneDrive/SharePoint documents into specs | `.specs/NNN-feature/SPECIFICATION.md` |

---

## 3. MCP Tools (44 Total)

### Pipeline Tools (8)

| Tool | Phase | Description |
|------|-------|-------------|
| `sdd_init` | Init | Initialize a feature directory with CONSTITUTION.md |
| `sdd_discover` | Discover | Scan codebase for tech stack and existing patterns |
| `sdd_write_spec` | Specify | Write SPECIFICATION.md in EARS notation |
| `sdd_clarify` | Clarify | Generate clarification questions for ambiguous requirements |
| `sdd_write_design` | Design | Write DESIGN.md with architecture and interfaces |
| `sdd_write_tasks` | Tasks | Write TASKS.md with implementation breakdown |
| `sdd_run_analysis` | Analyze | Run completeness and traceability analysis |
| `sdd_advance_phase` | Any | Advance the pipeline to the next phase |

### Utility Tools (6)

| Tool | Description |
|------|-------------|
| `sdd_get_status` | Get current pipeline state and phase |
| `sdd_get_template` | Retrieve a blank template by name |
| `sdd_write_bugfix` | Link a bug to failing acceptance criteria |
| `sdd_check_sync` | Check spec-code drift |
| `sdd_scan_codebase` | Detect tech stack and project structure |
| `sdd_amend` | Amend an existing spec artifact |

### Transcript Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_import_transcript` | Import VTT/SRT/MD/TXT transcript |
| `sdd_auto_pipeline` | Auto-run full pipeline from transcript |
| `sdd_batch_transcripts` | Batch-process multiple transcripts |

### Input and Conversion Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_import_document` | Import PDF, DOCX, PPTX, MD, TXT into specs |
| `sdd_batch_import` | Batch-import multiple documents |
| `sdd_figma_to_spec` | Convert Figma design tokens to specification |

### Quality and Validation Tools (4)

| Tool | Description |
|------|-------------|
| `sdd_checklist` | Generate domain-specific quality checklist |
| `sdd_verify_tasks` | Verify task completion against acceptance criteria |
| `sdd_compliance_check` | Check specs against compliance framework controls |
| `sdd_cross_analyze` | Analyze cross-cutting concerns across multiple specs |

### Visualization Tools (4)

| Tool | Description |
|------|-------------|
| `sdd_generate_diagram` | Generate a Mermaid diagram from spec artifacts |
| `sdd_generate_all_diagrams` | Generate all applicable diagram types at once |
| `sdd_generate_user_stories` | Generate user stories from specification |
| `sdd_figma_diagram` | Generate a diagram from Figma design data |

### Infrastructure as Code Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_generate_iac` | Generate Terraform or Bicep from DESIGN.md |
| `sdd_validate_iac` | Validate generated IaC configuration |
| `sdd_generate_dockerfile` | Generate Dockerfile from spec artifacts |

### Dev Environment Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_setup_local_env` | Generate local development environment config |
| `sdd_setup_codespaces` | Generate GitHub Codespaces configuration |
| `sdd_generate_devcontainer` | Generate devcontainer.json |

### Integration and Export Tools (5)

| Tool | Description |
|------|-------------|
| `sdd_create_branch` | Generate branch name and Git commands |
| `sdd_export_work_items` | Export tasks as GitHub Issues, Azure Boards, or Jira items |
| `sdd_create_pr` | Generate PR payload for GitHub MCP |
| `sdd_implement` | Generate phased implementation plan |
| `sdd_research` | Generate research questions and investigation plan |

### Documentation Tools (4)

| Tool | Description |
|------|-------------|
| `sdd_generate_docs` | Generate full project documentation |
| `sdd_generate_api_docs` | Generate API endpoint documentation |
| `sdd_generate_runbook` | Generate operational runbook |
| `sdd_generate_onboarding` | Generate developer onboarding guide |

### Ecosystem (1)

| Tool | Description |
|------|-------------|
| `sdd_check_ecosystem` | Report recommended MCP servers with install commands |

---

## 4. Model Routing Table

**Choose the right model for each phase:**

| Phase | Model | Reason | Max Tokens |
|-------|-------|--------|-----------|
| Specification (EARS writing) | claude-opus-4 | High quality, long context | 8000 |
| Design (architecture, UML) | claude-opus-4 | Structural reasoning | 8000 |
| Task planning (decomposition) | claude-sonnet-4 | Fast, sufficient for planning | 4000 |
| Code review / SRP validation | claude-haiku-3.5 | Lightweight structural analysis | 3000 |
| Specification audit | claude-opus-4 | Complex traceability logic | 6000 |
| Compliance checking | claude-opus-4 | Regulatory precision required | 6000 |
| Diagram generation | claude-sonnet-4 | Structured output, fast iteration | 4000 |
| IaC generation | claude-sonnet-4 | Template-based, deterministic | 4000 |
| Documentation generation | claude-sonnet-4 | Content synthesis from artifacts | 6000 |
| Hooks (test, docs, security, sync) | claude-haiku-3.5 | Deterministic, repetitive work | 2000-3000 |

---

## 5. Pipeline Phases (10)

```
Init -> Discover -> Specify -> Clarify -> Design -> Tasks -> Analyze -> Implement -> Verify -> Release
```

| # | Phase | Required File | Key Tools |
|---|-------|---------------|-----------|
| 1 | Init | `CONSTITUTION.md` | `sdd_init` |
| 2 | Discover | -- | `sdd_discover`, `sdd_scan_codebase` |
| 3 | Specify | `SPECIFICATION.md` | `sdd_write_spec`, `sdd_import_transcript`, `sdd_import_document` |
| 4 | Clarify | `SPECIFICATION.md` | `sdd_clarify`, `sdd_validate_ears` |
| 5 | Design | `DESIGN.md` | `sdd_write_design`, `sdd_generate_diagram` |
| 6 | Tasks | `TASKS.md` | `sdd_write_tasks`, `sdd_export_work_items` |
| 7 | Analyze | `ANALYSIS.md` | `sdd_run_analysis`, `sdd_compliance_check`, `sdd_cross_analyze` |
| 8 | Implement | `CHECKLIST.md` | `sdd_implement`, `sdd_generate_iac`, `sdd_create_branch` |
| 9 | Verify | `VERIFICATION.md` | `sdd_verify_tasks`, `sdd_checklist`, `sdd_check_sync` |
| 10 | Release | -- | `sdd_create_pr`, `sdd_generate_docs` |

Each phase requires its predecessor to be completed. Use `sdd_advance_phase` to move forward.

---

## 6. File Structure

```
specky/
├── src/
│   ├── index.ts                      Entry point: MCP server, service wiring
│   ├── constants.ts                  Enums, tool names, config values
│   ├── types.ts                      All TypeScript interfaces (zero `any`)
│   ├── schemas/                      10 Zod schema files
│   │   ├── common.ts                 Shared schemas (spec_dir, feature_number, force)
│   │   ├── pipeline.ts               Pipeline tool schemas
│   │   ├── utility.ts                Utility tool schemas
│   │   ├── transcript.ts             Transcript tool schemas
│   │   ├── input.ts                  Document import schemas
│   │   ├── quality.ts                Quality/compliance schemas
│   │   ├── visualization.ts          Diagram/stories schemas
│   │   ├── infrastructure.ts         IaC/Dockerfile schemas
│   │   ├── environment.ts            Dev environment schemas
│   │   └── integration.ts            Git/export/PR schemas
│   ├── services/                     14 service classes
│   │   ├── file-manager.ts           Atomic file I/O
│   │   ├── state-machine.ts          10-phase pipeline enforcement
│   │   ├── template-engine.ts        Markdown template rendering
│   │   ├── ears-validator.ts         EARS pattern detection (pure)
│   │   ├── codebase-scanner.ts       Tech stack detection
│   │   ├── transcript-parser.ts      VTT/SRT/MD/TXT parsing
│   │   ├── document-converter.ts     PDF/DOCX/PPTX import
│   │   ├── diagram-generator.ts      Mermaid diagram generation
│   │   ├── iac-generator.ts          Terraform/Bicep/Dockerfile generation
│   │   ├── work-item-exporter.ts     GitHub/Azure Boards/Jira export
│   │   ├── cross-analyzer.ts         Multi-spec analysis
│   │   ├── compliance-engine.ts      Regulatory framework controls
│   │   ├── doc-generator.ts          Documentation generation
│   │   └── git-manager.ts            Branch/PR payload generation
│   └── tools/                        11 tool registration files
│       ├── pipeline.ts               8 pipeline tools
│       ├── analysis.ts               1 analysis tool
│       ├── utility.ts                5 utility tools
│       ├── transcript.ts             3 transcript tools
│       ├── input.ts                  3 input/conversion tools
│       ├── quality.ts                5 quality/validation tools
│       ├── visualization.ts          4 visualization tools
│       ├── infrastructure.ts         3 IaC tools
│       ├── environment.ts            3 dev environment tools
│       ├── integration.ts            5 integration/export tools
│       └── documentation.ts          4 documentation tools
├── templates/                        21 Markdown templates
│   ├── constitution.md               Project constitution
│   ├── specification.md              EARS requirements
│   ├── design.md                     Architecture/interfaces
│   ├── tasks.md                      Implementation tasks
│   ├── analysis.md                   Spec analysis report
│   ├── bugfix.md                     Bug-to-criteria trace
│   ├── sync-report.md                Spec-code drift report
│   ├── research.md                   Research investigation
│   ├── data-model.md                 Data model design
│   ├── checklist.md                  Quality checklist
│   ├── cross-analysis.md             Cross-cutting analysis
│   ├── work-items.md                 Work item export
│   ├── verification.md               Task verification
│   ├── compliance.md                 Compliance report
│   ├── user-stories.md               User stories
│   ├── api-docs.md                   API documentation
│   ├── runbook.md                    Operational runbook
│   ├── onboarding.md                 Onboarding guide
│   ├── terraform.md                  Terraform config
│   ├── dockerfile.md                 Dockerfile
│   └── devcontainer.md               Devcontainer config
├── .specs/                           Feature specification directories
│   └── NNN-feature-name/             Numbered, self-contained spec package
│       ├── CONSTITUTION.md
│       ├── SPECIFICATION.md
│       ├── DESIGN.md
│       ├── TASKS.md
│       ├── ANALYSIS.md
│       ├── CHECKLIST.md
│       └── VERIFICATION.md
├── .github/
│   └── agents/                       4 Custom Agent definitions (GitHub Copilot)
│       ├── spec-engineer.agent.md
│       ├── design-architect.agent.md
│       ├── task-planner.agent.md
│       └── spec-reviewer.agent.md
├── .claude/
│   └── commands/                     7 Claude Code command definitions
│       ├── sdd-spec.md
│       ├── sdd-design.md
│       ├── sdd-tasks.md
│       ├── sdd-analyze.md
│       ├── sdd-bugfix.md
│       ├── sdd-transcript.md
│       └── sdd-onedrive.md
├── hooks/                            6 automation hooks
│   ├── auto-test.md
│   ├── auto-docs.md
│   ├── security-scan.md
│   ├── spec-sync.md
│   ├── changelog.md
│   └── srp-validator.md
├── references/                       Reference guides
│   ├── ears-notation.md
│   ├── spec-templates.md
│   └── design-patterns.md
├── reports/                          Generated reports
├── CLAUDE.md                         This file (auto-loaded)
└── package.json                      npm package (specky-sdd)
```

---

## 7. Working Rules

### Positive Framing Only
- Write specs in **can do, will do** language, not "shall not"
- Frame requirements as capabilities, not restrictions
- Example: "The system **validates** user input" not "The system **rejects invalid** input"

### Anti-Over-Engineering: Start Simple
- Begin with the simplest approach that meets acceptance criteria
- Refactor later if complexity justifies it
- Avoid premature abstraction; let patterns emerge

### Progressive Context Loading
- Read reference files **per phase**, not all at once
- Load EARS notation guide before writing specs
- Load design patterns before writing architecture
- Load task templates before decomposing work

### Phase Pause for LGTM (Looks Good To Me)
- After completing each phase (spec, design, tasks), **pause and wait for approval**
- Example: "Spec draft complete. Review `.specs/001-feature/SPECIFICATION.md` and reply LGTM when ready to proceed to Design."
- Do not proceed without explicit LGTM from user

### Default to Action on LGTM
- Once user replies **LGTM**, proceed immediately with next phase
- No need to re-ask for permission
- This accelerates workflow while maintaining quality gates

### Feature Numbering Convention
- All features live in `.specs/NNN-feature-name/` where NNN is zero-padded (001, 002, etc.)
- Use kebab-case for feature names: `001-user-login`, `002-payment-gateway`
- Each directory is a complete, self-contained specification package

### All Specs in English
- All specification, design, and acceptance criteria documents written in English
- Code comments and docstrings may be in other languages if client prefers
- Reports always in English for consistency

### Thin Tools, Fat Services
- Tools only validate input, call a service, and format the response
- All business logic lives in services
- FileManager owns all file I/O; no other code touches the filesystem directly

---

## 8. Educative Outputs

Every Specky tool response includes educative fields that guide the AI client through the SDD pipeline:

- **`next_steps`**: Tells the AI client what to do after this tool completes. May reference other Specky tools or external MCP servers.
- **`learning_note`**: Explains why this step matters in the SDD pipeline. Helps the AI client make better decisions in subsequent calls.

These fields are defined in the `EducativeOutput` interface in `src/types.ts`. All new tools must include them.

Example response structure:

```json
{
  "phase": "specify",
  "file_written": ".specs/001-login/SPECIFICATION.md",
  "requirements_count": 12,
  "next_steps": "Run sdd_clarify to identify ambiguous requirements, then proceed to sdd_write_design.",
  "learning_note": "EARS notation ensures every requirement is testable. The five patterns (ubiquitous, event-driven, state-driven, optional, unwanted) cover all requirement types."
}
```

---

## 9. MCP-to-MCP Architecture

Specky integration tools produce structured payloads designed for forwarding to other MCP servers. The AI client acts as an orchestrator between MCP servers.

| Specky Tool | Target MCP Server | Target Tool | Payload |
|-------------|-------------------|-------------|---------|
| `sdd_create_branch` | GitHub MCP | `create_branch` | Branch name, base ref |
| `sdd_create_pr` | GitHub MCP | `create_pull_request` | Title, body, branch, base |
| `sdd_export_work_items` | GitHub/Azure/Jira MCP | `create_issue` / equivalent | Title, body, labels, assignees |
| `sdd_generate_iac` | Terraform MCP | `validate` / `plan` | HCL configuration |
| `sdd_setup_local_env` | Docker MCP | `compose` tools | Docker Compose, Dockerfile |
| `sdd_generate_devcontainer` | Docker MCP | container tools | devcontainer.json, Dockerfile |

Each tool's response includes a `routing_instructions` or `command_hint` field that specifies exactly which external MCP server and tool should receive the payload. The AI client reads this field and routes accordingly.

---

## 10. Compliance Frameworks

The `sdd_compliance_check` tool validates specifications against regulatory framework controls:

| Framework | Controls | Use Case |
|-----------|----------|----------|
| HIPAA | Access control, audit, encryption, PHI protection, integrity, transmission | Healthcare applications |
| SOC 2 | Logical access, monitoring, change management, recovery, encryption, incidents | SaaS and cloud services |
| GDPR | Lawful processing, erasure, portability, privacy by design, breach notification | EU data processing |
| PCI-DSS | Firewall, stored data, transmission, secure systems, authentication, monitoring | Payment card handling |
| ISO 27001 | Security policies, organization, access control, cryptography, operations, incidents | Enterprise security |
| General | Input validation, authentication, authorization, logging | All projects |

Controls are defined as keyword-matching rules in `src/services/compliance-engine.ts`. Each control has an ID, description, keyword list, and mandatory flag. The engine scans SPECIFICATION.md and DESIGN.md content for keyword matches.

---

## 11. Reference Files and Guides

**Available in `references/` directory:**

- **ears-notation.md** -- Complete EARS syntax with examples (load before `/sdd:spec`)
- **spec-templates.md** -- Boilerplate for common feature types (user flows, integrations, data models)
- **design-patterns.md** -- Architecture patterns and interface templates for design phase

Load these progressively -- do not read all at once.

---

## 12. Agents and GitHub Copilot Integration

Four Custom Agents available in `.github/agents/` for GitHub Copilot:

1. **spec-engineer.agent.md** -- Writes EARS requirements, validates completeness
2. **design-architect.agent.md** -- Creates system architecture, interface design, UML
3. **task-planner.agent.md** -- Decomposes specs into implementation tasks
4. **spec-reviewer.agent.md** -- Audits specs for quality, finds ambiguity and drift

Use in Copilot Chat with: `@spec-engineer [prompt]` (or any of the 4 agents)

---

## 13. Hooks and Automation

Six hooks run automatically after code changes or task completion (see `hooks/` directory):

| Hook | Trigger | Action |
|------|---------|--------|
| **auto-test** | Task completion | Generate test stubs from acceptance criteria |
| **auto-docs** | Code changes | Update README, API docs to match implementation |
| **security-scan** | Pre-merge | OWASP Top 10 + secrets check |
| **spec-sync** | Code changes | Flag spec-code drift in SYNC_REPORT.md |
| **changelog** | Release tag | Generate CHANGELOG.md entry |
| **srp-validator** | Code changes | Flag SRP violations; suggest decomposition |

All hooks use **claude-haiku-3.5** for speed and determinism. Hooks run asynchronously and log results in `reports/`.

---

## 14. Traceability and Quality Gates

### Acceptance Criteria Traceability
Every task must have acceptance criteria mapped to:
1. **Specification requirement** (EARS statement)
2. **Design component** (interface or module)
3. **Test case** (acceptance test stub)
4. **Code location** (file, function, line)

### Quality Gates
- **Specification phase:** Completeness audit (no orphaned criteria), EARS validation
- **Design phase:** No missing interfaces or design documents
- **Analyze phase:** Compliance check passes, cross-analysis complete
- **Implementation phase:** Auto-test, auto-docs, security-scan hooks pass
- **Verify phase:** All checklist items pass, task verification complete
- **Merge gate:** spec-sync report shows zero drift

---

## 15. Quick Start

1. **Create a feature directory:**
   ```bash
   mkdir -p .specs/001-my-feature
   ```

2. **Initialize the pipeline:**
   Call `sdd_init` to create CONSTITUTION.md and set up pipeline state.

3. **Start specification:**
   ```
   /sdd:spec
   ```
   Creates SPECIFICATION.md in EARS notation.

4. **Wait for LGTM**, then proceed to design:
   ```
   /sdd:design
   ```
   Creates DESIGN.md with architecture.

5. **Wait for LGTM**, then break down tasks:
   ```
   /sdd:tasks
   ```
   Creates TASKS.md with implementation plan.

6. **Run quality checks:**
   ```
   /sdd:analyze
   ```
   Audit spec completeness, compliance, and traceability.

7. **Generate artifacts:**
   Use visualization, IaC, and documentation tools as needed: `sdd_generate_diagram`, `sdd_generate_iac`, `sdd_generate_docs`.

8. **Export and integrate:**
   Use `sdd_create_branch`, `sdd_export_work_items`, and `sdd_create_pr` to push work to GitHub/Azure/Jira.

---

## 16. Environment Variables and Config

Optional configuration:

```bash
SDD_WORKSPACE=/path/to/project         # Workspace root (default: cwd)
SDD_MODEL_SPEC=claude-opus-4            # Specification model
SDD_MODEL_DESIGN=claude-opus-4          # Design model
SDD_MODEL_TASKS=claude-sonnet-4         # Task planning model
SDD_HOOK_AUTO_TEST=true                 # Enable auto-test hook
SDD_HOOK_SECURITY_SCAN=true             # Enable security scanning
PORT=3200                               # HTTP transport port (--http mode)
```

---

## 17. Support and Resources

- **EARS Notation Guide:** `references/ears-notation.md`
- **Specification Examples:** `references/spec-templates.md`
- **Design Patterns:** `references/design-patterns.md`
- **Contributing Guide:** `CONTRIBUTING.md`
- **GitHub Repository:** https://github.com/paulasilvatech/specky
- **npm Package:** `specky-sdd`

---

## 18. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.0 | 2026-03-21 | 44 tools (+sdd_check_ecosystem, sdd_validate_ears), MCP ecosystem detection, server recommendations, recommended_servers in tool outputs |
| 2.0.0 | 2026-03-21 | 42 tools, 10-phase pipeline, 14 services, 21 templates, compliance frameworks, MCP-to-MCP routing, educative outputs, IaC generation, diagram generation, document import |
| 1.0.0 | 2026-03-20 | Initial release: 17 tools, 7-phase pipeline, 6 services, 4 agents, 6 hooks |

---

**Last Updated:** 2026-03-22
**Maintainer:** Paula Silva
**License:** MIT
