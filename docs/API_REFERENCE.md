# Specky MCP Server — API Reference

> Manually maintained — last updated 2026-04-14.
> Align with `src/constants.ts` TOOL_NAMES when adding or removing tools.

**Total tools: 57**

## Categories

- [Checkpointing](#checkpointing) (3 tools)
- [Dev Environment](#dev-environment) (3 tools)
- [Documentation](#documentation) (5 tools)
- [Infrastructure as Code](#infrastructure-as-code) (3 tools)
- [Input & Conversion](#input-conversion) (3 tools)
- [Integration & Export](#integration-export) (5 tools)
- [Metrics](#metrics) (1 tools)
- [Other](#other) (2 tools)
- [Pipeline](#pipeline) (9 tools)
- [Property-Based Testing](#property-based-testing) (1 tools)
- [Quality & Validation](#quality-validation) (5 tools)
- [Security](#security) (1 tools)
- [Testing](#testing) (2 tools)
- [Transcript](#transcript) (3 tools)
- [Turnkey](#turnkey) (1 tools)
- [Utility](#utility) (6 tools)
- [Visualization](#visualization) (4 tools)

## Checkpointing {#checkpointing}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_checkpoint` | Create Checkpoint | Creates a named snapshot of all spec artifacts (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, etc.) | `feature_number` |
| `sdd_list_checkpoints` | List Checkpoints | Lists all available checkpoints for a feature with their labels, dates, and phases. | `feature_number` |
| `sdd_restore` | Restore from Checkpoint | Restores all spec artifacts to a previous checkpoint snapshot. | `feature_number` |

## Dev Environment {#dev-environment}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_generate_devcontainer` | Generate Devcontainer Config | Generates .devcontainer/devcontainer.json from the detected tech stack and DESIGN.md. Writes the file to disk for local … | — |
| `sdd_setup_codespaces` | Setup GitHub Codespaces | Detects the project tech stack and generates a devcontainer configuration suitable for GitHub Codespaces. Returns a payl… | — |
| `sdd_setup_local_env` | Setup Local Dev Environment | Detects the project tech stack and generates a Docker-based local development environment (Dockerfile + docker-compose.y… | — |

## Documentation {#documentation}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_generate_all_docs` | Generate All Documentation | Generates ALL documentation types in parallel: full docs, API docs, runbook, onboarding guide, and SDD journey. | `feature_number` |
| `sdd_generate_api_docs` | Generate API Documentation |  | — |
| `sdd_generate_docs` | Generate Full Documentation | Generates comprehensive feature documentation from SPECIFICATION.md, DESIGN.md, TASKS.md, and ANALYSIS.md. Writes a comb… | `feature_number` |
| `sdd_generate_onboarding` | Generate Onboarding Guide |  | — |
| `sdd_generate_runbook` | Generate Operational Runbook |  | — |

## Infrastructure as Code {#infrastructure-as-code}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_generate_dockerfile` | Generate Dockerfile | Reads DESIGN.md or uses sdd_scan_codebase results to detect the tech stack, then generates a Dockerfile and optionally a… | — |
| `sdd_generate_iac` | Generate Infrastructure as Code | Reads DESIGN.md to detect infrastructure needs and generates Terraform or Bicep files. Returns generated file contents, … | — |
| `sdd_validate_iac` | Validate Infrastructure as Code | Generates a validation payload for Terraform MCP (plan/validate) or Azure MCP (template validation). The AI client route… | — |

## Input & Conversion {#input-conversion}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_batch_import` | Batch Import Documents | Scans a directory for supported documents (PDF, DOCX, PPTX, TXT, MD) and converts each to Markdown. Returns an array of … | — |
| `sdd_figma_to_spec` | Figma to Spec | Prepares a structured payload for extracting design context from a Figma file. The AI client should use the returned rou… | — |
| `sdd_import_document` | Import Document | Imports a document (PDF, DOCX, PPTX, TXT, MD, VTT, SRT) or raw text and converts it to Markdown for SDD processing. Retu… | — |

## Integration & Export {#integration-export}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_create_branch` | Create Feature Branch | Generates a branch name following SDD conventions and returns a command_hint for creating the branch. Does not execute g… | — |
| `sdd_create_pr` | Create Pull Request Payload | Generates a pull request payload from SPECIFICATION.md and TASKS.md with spec summary, requirements covered, and task pr… | — |
| `sdd_export_work_items` | Export Work Items | Transforms TASKS.md into platform-specific work item payloads (GitHub Issues, Azure Boards, or Jira). Returns routing_in… | — |
| `sdd_implement` | Generate Implementation Plan | Reads TASKS.md and produces an ordered implementation roadmap with phases, parallel groups, dependency resolution, and c… | — |
| `sdd_research` | Research Questions | Takes an array of research questions, generates RESEARCH.md with structured entries (question, findings placeholder, sou… | — |

## Metrics {#metrics}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_metrics` | Generate Metrics Dashboard | Generate a self-contained HTML metrics dashboard for a feature. | — |

## Other {#other}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_context_status` | Context Tier Status | Return the context tier assignment (Hot/Domain/Cold) for all spec artifacts in the active feature. | — |
| `sdd_model_routing` | Model Routing Decision Table | Return the full model routing decision table for all 10 SDD pipeline phases. | — |

## Pipeline {#pipeline}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_advance_phase` | Advance Pipeline Phase | Validates that the current phase | — |
| `sdd_check_sync` | Check Spec-Code Sync | Compares specification requirements against implementation files and returns a drift report showing which requirements a… | — |
| `sdd_clarify` | Clarify Requirements | Reads SPECIFICATION.md and returns up to 5 disambiguation questions targeting ambiguous or incomplete requirements. | — |
| `sdd_discover` | Discover Project Requirements | Returns 7 structured discovery questions tailored to your project idea. Covers: scope, users, constraints, integrations,… | — |
| `sdd_init` | Initialize SDD Pipeline | Creates .specs/ directory, writes CONSTITUTION.md skeleton, and initializes the state machine. Call this first before an… | — |
| `sdd_run_analysis` | Run Specification Analysis | Reads all spec files, generates ANALYSIS.md with traceability matrix and coverage report, and returns a gate decision (A… | — |
| `sdd_write_design` | Write Design Document | Generates and writes DESIGN.md with architecture overview, Mermaid diagrams, ADRs, and API contracts. | — |
| `sdd_write_spec` | Write Specification | Generates and writes SPECIFICATION.md with all requirements in EARS notation. Validates each requirement against EARS pa… | — |
| `sdd_write_tasks` | Write Task Breakdown | Generates and writes TASKS.md with pre-implementation gates, sequenced tasks with [P] parallel markers, effort estimates… | — |

## Property-Based Testing {#property-based-testing}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_generate_pbt` | Generate Property-Based Tests | Extracts universal properties (invariants, round-trips, idempotence) from EARS requirements | — |

## Quality & Validation {#quality-validation}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_checklist` | Generate Quality Checklist | Generates a domain-specific quality checklist (security, accessibility, performance, etc.) by analyzing SPECIFICATION.md… | — |
| `sdd_compliance_check` | Run Compliance Check | Validates specification and design against a compliance framework (HIPAA, SOC2, GDPR, PCI-DSS, ISO27001, or general). Wr… | — |
| `sdd_cross_analyze` | Cross-Artifact Analysis | Cross-artifact consistency analysis: checks alignment between SPECIFICATION.md, DESIGN.md, and TASKS.md. Finds orphaned … | — |
| `sdd_validate_ears` | Validate EARS Requirements | Validates requirement statements against EARS notation patterns (ubiquitous, event-driven, state-driven, optional, unwan… | — |
| `sdd_verify_tasks` | Verify Task Completions | Reads TASKS.md and checks code_paths for implementation evidence. Detects phantom completions — tasks marked [x] but wit… | — |

## Testing {#testing}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_generate_tests` | Generate Test Stubs | Generate test stubs from acceptance criteria in SPECIFICATION.md and TASKS.md. | — |
| `sdd_verify_tests` | Verify Test Coverage Against Requirements | Reads test results JSON and cross-references with requirement IDs from SPECIFICATION.md. | — |

## Transcript {#transcript}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_auto_pipeline` | Auto Pipeline from Transcript | FULLY AUTOMATED: Reads a meeting transcript, extracts requirements, and runs the complete SDD pipeline in one call. Crea… | — |
| `sdd_batch_transcripts` | Batch Process Transcript Folder | Scans a folder for transcript files (.vtt, .srt, .txt, .md) and runs the full SDD auto-pipeline for each one. Designed f… | — |
| `sdd_import_transcript` | Import Meeting Transcript | Parses a meeting transcript (VTT, SRT, TXT, or MD) and extracts structured data: participants, topics, decisions, action… | — |

## Turnkey {#turnkey}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_turnkey_spec` | Turnkey Specification from Description | Generates a complete EARS specification from a natural language feature description. | `feature_name`, `description`, `feature_number` |

## Utility {#utility}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_amend` | Amend Constitution | Appends an amendment entry to CONSTITUTION.md | — |
| `sdd_check_ecosystem` | Check MCP Ecosystem | Reports which external MCP servers are recommended for the full Specky experience. Shows what each server does, which Sp… | — |
| `sdd_get_status` | Get Pipeline Status | Returns the current pipeline status including: current phase, completed phases, files on disk, completion percentage, an… | — |
| `sdd_get_template` | Get Raw Template |  | — |
| `sdd_scan_codebase` | Scan Codebase | Scans the workspace project structure and returns auto-steering context: detected language, framework, package manager, … | — |
| `sdd_write_bugfix` | Write Bugfix Specification | Generates and writes BUGFIX_SPEC.md with current behavior, expected behavior, unchanged behavior, root cause analysis, a… | — |

## Visualization {#visualization}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_figma_diagram` | Generate Figma Diagram Payload | Generates a FigJam-ready diagram payload from DESIGN.md. Returns structured data with routing_instructions for the AI cl… | — |
| `sdd_generate_all_diagrams` | Generate All Diagrams | Generates ALL diagram types for a feature in one call. Produces architecture, sequence, ERD, flow, dependency, and trace… | — |
| `sdd_generate_diagram` | Generate Mermaid Diagram | Generates a single Mermaid diagram from a specification artifact. Supports 17 diagram types: flowchart, sequence, class,… | — |
| `sdd_generate_user_stories` | Generate User Stories | Generates user stories with acceptance criteria and flow diagrams from SPECIFICATION.md. Each story includes a Mermaid f… | — |

## Security {#security}

| Tool | Title | Description | Inputs |
|------|-------|-------------|--------|
| `sdd_check_access` | Check RBAC Access | Check RBAC access for the current role. Returns the active role, whether a specific tool is accessible, and a summary of what each role can do. Useful for diagnosing permission issues in enterprise deployments. | `role_override`, `tool_name` |
