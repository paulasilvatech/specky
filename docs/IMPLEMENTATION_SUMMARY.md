# Specky v3.1.0 — Implementation Summary

**Package:** `specky-sdd@3.1.0` · **Published:** 2026-04-12  
**npm:** [npmjs.com/package/specky-sdd](https://www.npmjs.com/package/specky-sdd)  
**Docker:** `ghcr.io/paulasilvatech/specky:3.1.0`  
**Source:** [github.com/paulasilvatech/specky](https://github.com/paulasilvatech/specky)

---

## Overview

Specky is an MCP (Model Context Protocol) server for **Spec-Driven Development (SDD)** — a methodology that enforces continuous traceability between requirements, design, implementation, and tests. It exposes **56 tools** across a **10-phase pipeline**, uses EARS notation for requirement statements, and ships with 26 services, 22 templates, 4 Custom Agents, 12 Claude Code commands, and 10 automation hooks.

**Core principle:** Close the gap between specification and code through continuous validation, preventing requirements drift and ensuring every acceptance criterion is met before merge.

---

## Specification Coverage: All 7 Specs Implemented

| # | Spec | Description | Pass Rate | Tests |
|---|------|-------------|-----------|-------|
| 001 | specky-mcp-server | Core MCP server, 10-phase pipeline, 53 base tools | 100% | Foundation |
| 002 | enterprise-ready | Pipeline enforcement, gate decisions, enriched responses | 93% (52/56) | 321 total |
| 003 | model-routing-guidance | Per-phase model recommendations in every tool response | 100% (14/14) | 432 total |
| 004 | context-tiering | Progressive context loading, tier classification, sdd_context_status | 100% (10/10) | 455 total |
| 005 | cognitive-debt-metrics | Cognitive debt scoring, sdd_metrics, HTML dashboard | 100% (11/11) | 478 total |
| 006 | verified-test-loop | Enhanced sdd_verify_tests, TestResultParser, TestTraceabilityMapper | 100% (14/14) | 507 total |
| 007 | intent-drift-detection | sdd_detect_drift, drift history, drift_amendment_suggestion | 100% (13/13) | 507 total |

**Total: 7/7 specs implemented · 507 tests passing · 30 test files**

---

## Architecture

### Pattern: Thin Tools / Fat Services

```
MCP Client
    │
    ▼
Tool Handler (src/tools/*.ts)
    │  validates Zod schema
    │  calls ONE service method
    │  enriches response via buildToolResponse()
    ▼
Service (src/services/*.ts)
    │  all business logic lives here
    │  no tool-layer imports
    ▼
FileManager (file-manager.ts)
    │  all filesystem I/O goes through here
    ▼
.specs/NNN-feature-name/
```

This separation allows unit testing every service in isolation without MCP infrastructure, and keeps tools under 80 lines each.

### Dependency Injection

All optional services (IntentDriftEngine, TestResultParser, TestTraceabilityMapper, etc.) are injected as optional parameters into tool registration functions. This preserves backwards compatibility: existing integrations continue working without the new services, and new capabilities activate only when the full service set is wired.

### Central Response Enrichment

`buildToolResponse()` in `src/tools/response-builder.ts` is called by all 56 tools. It centrally injects:
- `model_routing_hint` — recommended model for this phase
- `context_load_summary` — which files were loaded, context tier classification

One change in response-builder covers all tools automatically.

---

## Services (26 Total)

| Service | Added | Purpose |
|---------|-------|---------|
| `file-manager` | v1.0 | Atomic file I/O — the only class allowed to touch the filesystem |
| `state-machine` | v1.0 | 10-phase pipeline enforcement, gate decisions, phase transitions |
| `template-engine` | v1.0 | Markdown template rendering with variable substitution |
| `ears-validator` | v1.0 | EARS pattern detection (ubiquitous / event / state / optional / unwanted) |
| `codebase-scanner` | v1.0 | Tech stack detection from package files and source patterns |
| `transcript-parser` | v1.0 | VTT/SRT/MD/TXT parsing for meeting transcript import |
| `document-converter` | v2.0 | PDF/DOCX/PPTX import into spec artifacts |
| `diagram-generator` | v2.0 | Mermaid diagram generation (17 diagram types) |
| `iac-generator` | v2.0 | Terraform/Bicep/Dockerfile generation from DESIGN.md |
| `work-item-exporter` | v2.0 | GitHub Issues / Azure Boards / Jira export payloads |
| `cross-analyzer` | v2.0 | Multi-spec analysis for cross-cutting concerns |
| `compliance-engine` | v2.0 | HIPAA / SOC2 / GDPR / PCI-DSS / ISO27001 / General controls |
| `doc-generator` | v2.0 | Full documentation generation (API, runbook, onboarding, journey) |
| `git-manager` | v2.0 | Branch/PR payload generation for GitHub MCP forwarding |
| `pbt-generator` | v2.3 | Property-based test generation (fast-check / Hypothesis) |
| `methodology` | v3.0 | Educational content — why each phase matters |
| `dependency-graph` | v3.0 | Parallel execution graph for documentation generation |
| `test-generator` | v3.0 | Test stub generation for 6 frameworks (vitest/jest/playwright/pytest/junit/xunit) |
| `metrics-generator` | v3.0 | HTML metrics dashboard from spec artifacts |
| `model-routing-engine` | v3.1 | Per-phase model recommendations (spec 003) |
| `context-tiering-engine` | v3.1 | Progressive context loading with tier classification (spec 004) |
| `cognitive-debt-engine` | v3.1 | Cognitive debt scoring and backlog recommendations (spec 005) |
| `test-result-parser` | v3.1 | Auto-detects Vitest JSON / pytest JSON / JUnit XML formats (spec 006) |
| `test-traceability-mapper` | v3.1 | Maps test names to REQ-IDs, builds per-requirement coverage reports (spec 006) |
| `intent-drift-engine` | v3.1 | Detects divergence between CONSTITUTION.md principles and spec artifacts (spec 007) |
| `audit-logger` | v3.1 | JSONL audit trail for all tool calls |

---

## Tools (56 Total)

### Pipeline Tools (8)

| Tool | Phase | Description |
|------|-------|-------------|
| `sdd_init` | Init | Initialize feature directory with CONSTITUTION.md |
| `sdd_discover` | Discover | Scan codebase for tech stack and existing patterns |
| `sdd_write_spec` | Specify | Write SPECIFICATION.md in EARS notation |
| `sdd_clarify` | Clarify | Generate clarification questions for ambiguous requirements |
| `sdd_write_design` | Design | Write DESIGN.md with 12-section architecture template |
| `sdd_write_tasks` | Tasks | Write TASKS.md with implementation breakdown |
| `sdd_run_analysis` | Analyze | Run completeness and traceability analysis |
| `sdd_advance_phase` | Any | Advance pipeline to next phase with gate enforcement |

### Utility Tools (6)

| Tool | Description |
|------|-------------|
| `sdd_get_status` | Get current pipeline state and phase |
| `sdd_get_template` | Retrieve a blank template by name |
| `sdd_write_bugfix` | Link a bug to failing acceptance criteria |
| `sdd_check_sync` | Check spec-code drift |
| `sdd_scan_codebase` | Detect tech stack and project structure |
| `sdd_amend` | Amend spec artifact — triggers `drift_amendment_suggestion` when drift score > 40 |

### Transcript Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_import_transcript` | Import VTT/SRT/MD/TXT transcript |
| `sdd_auto_pipeline` | Auto-run full pipeline from transcript |
| `sdd_batch_transcripts` | Batch-process multiple transcripts |

### Input and Conversion Tools (3)

| Tool | Description |
|------|-------------|
| `sdd_import_document` | Import PDF, DOCX, PPTX, MD, TXT |
| `sdd_batch_import` | Batch-import multiple documents |
| `sdd_figma_to_spec` | Convert Figma design tokens to specification |

### Quality and Validation Tools (5)

| Tool | Description |
|------|-------------|
| `sdd_checklist` | Generate domain-specific quality checklist |
| `sdd_verify_tasks` | Verify task completion against acceptance criteria |
| `sdd_compliance_check` | Check specs against compliance framework controls |
| `sdd_cross_analyze` | Analyze cross-cutting concerns across multiple specs |
| `sdd_validate_ears` | Validate EARS notation patterns in a specification |

### Visualization Tools (4)

| Tool | Description |
|------|-------------|
| `sdd_generate_diagram` | Generate a Mermaid diagram (17 types) |
| `sdd_generate_all_diagrams` | Generate all applicable diagram types at once |
| `sdd_generate_user_stories` | Generate user stories from specification |
| `sdd_figma_diagram` | Generate diagram from Figma design data |

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
| `sdd_export_work_items` | Export tasks as GitHub Issues / Azure Boards / Jira |
| `sdd_create_pr` | Generate PR payload for GitHub MCP |
| `sdd_implement` | Generate phased implementation plan |
| `sdd_research` | Generate research questions and investigation plan |

### Documentation Tools (5)

| Tool | Description |
|------|-------------|
| `sdd_generate_docs` | Generate full project documentation |
| `sdd_generate_api_docs` | Generate API endpoint documentation |
| `sdd_generate_runbook` | Generate operational runbook |
| `sdd_generate_onboarding` | Generate developer onboarding guide |
| `sdd_generate_all_docs` | Generate ALL documentation types in parallel |

### Testing Tools (2)

| Tool | Description |
|------|-------------|
| `sdd_generate_tests` | Generate test stubs (vitest/jest/playwright/pytest/junit/xunit) |
| `sdd_verify_tests` | Verify test results against spec — full traceability report |

### Property-Based Testing (1)

| Tool | Description |
|------|-------------|
| `sdd_generate_pbt` | Generate fast-check (TS) or Hypothesis (Python) tests from EARS |

### Turnkey Specification (1)

| Tool | Description |
|------|-------------|
| `sdd_turnkey_spec` | Complete EARS spec from natural language — auto-extracts requirements, ACs, NFRs |

### Checkpoint / Restore (3)

| Tool | Description |
|------|-------------|
| `sdd_checkpoint` | Create named snapshot of all spec artifacts |
| `sdd_restore` | Restore from checkpoint (auto-backup before restore) |
| `sdd_list_checkpoints` | List checkpoints with labels, dates, phases |

### Intelligence Layer — v3.1.0 (5)

| Tool | Spec | Description |
|------|------|-------------|
| `sdd_model_routing` | 003 | Per-phase model recommendation table |
| `sdd_context_status` | 004 | Context tier status — what to load, what to defer |
| `sdd_metrics` | 005 | Cognitive debt score, HTML dashboard, backlog recommendations |
| `sdd_verify_tests` (enhanced) | 006 | Per-requirement traceability, failure details, suggested_fix_prompt |
| `sdd_detect_drift` | 007 | Intent drift score, orphaned principles, amendment suggestions |

### Ecosystem (1)

| Tool | Description |
|------|-------------|
| `sdd_check_ecosystem` | Report recommended MCP servers with install commands |

---

## New Capabilities in v3.1.0 (Intelligence Layer)

### Spec 003 — Model Routing Guidance

Every tool response now includes `model_routing_hint` — the recommended Claude model for the current phase, with rationale and max_tokens guidance. Injected centrally via `buildToolResponse()`, covering all 56 tools without individual handler changes.

**Key file:** `src/services/model-routing-engine.ts`  
**Tool added:** `sdd_model_routing`

### Spec 004 — Context Tiering

Progressive context loading strategy: each phase loads only the files needed for that phase, classified into tiers (tier-1: immediate, tier-2: on-demand, tier-3: deferred). Every tool response includes `context_load_summary` indicating what was loaded and what to defer.

**Key file:** `src/services/context-tiering-engine.ts`  
**Tool added:** `sdd_context_status`

### Spec 005 — Cognitive Debt Metrics

Cognitive debt scoring system that quantifies the mental complexity burden of a feature's specification. Generates an HTML dashboard (`metrics-dashboard.html`) inside the spec directory with bar charts and trend visualization. Provides a structured backlog of debt-reduction recommendations.

**Key file:** `src/services/cognitive-debt-engine.ts`  
**Tool added:** `sdd_metrics`

### Spec 006 — Verified Test Loop

Enhanced `sdd_verify_tests` with multi-format test result parsing (Vitest JSON, pytest JSON, JUnit XML) and per-requirement traceability mapping. Test files are scanned for `// REQ-XXX` comment annotations; the mapper builds coverage percent per requirement and generates `suggested_fix_prompt` for failing tests.

**Key files:**  
- `src/services/test-result-parser.ts` — auto-detects format, parses pass/fail counts  
- `src/services/test-traceability-mapper.ts` — maps test names to REQ-IDs, builds coverage report  
- `tests/unit/test-traceability-mapper.test.ts` — 14 unit tests

**Notable fix:** JUnit XML `<testcase/>` self-closing tags were being merged with adjacent open-close `<testcase>` elements due to greedy regex. Fixed with negative lookbehind `(?<!\/)` to distinguish `/>` from `>`.

### Spec 007 — Intent Drift Detection

Detects semantic drift between the original intent captured in `CONSTITUTION.md` and what is actually specified in `SPECIFICATION.md` + `TASKS.md`. Computes a drift score (0–100), classifies as `low/medium/high/critical`, and lists orphaned principles — principles from the constitution with no corresponding requirement.

**Drift amendment integration:** When `sdd_amend` is called and the last drift score in drift history exceeds 40, the tool automatically appends a `drift_amendment_suggestion` block to the response, listing specific actions to close the gap.

**Key file:** `src/services/intent-drift-engine.ts`  
**Tool added:** `sdd_detect_drift`

---

## Test Coverage

| Category | Count |
|----------|-------|
| Unit test files | 27 |
| Integration test files | 3 |
| **Total test files** | **30** |
| **Total tests passing** | **507** |
| Test framework | Vitest |

### Unit Tests by Service

| Test File | Coverage Area |
|-----------|---------------|
| `audit-logger.test.ts` | JSONL audit trail entries |
| `codebase-scanner.test.ts` | Tech stack detection patterns |
| `cognitive-debt-engine.test.ts` | Debt scoring, backlog generation |
| `compliance-engine.test.ts` | HIPAA/SOC2/GDPR/PCI/ISO controls |
| `context-tiering-engine.test.ts` | Tier classification, context summaries |
| `cross-analyzer.test.ts` | Multi-spec analysis |
| `dependency-graph.test.ts` | Parallel execution planning |
| `diagram-generator.test.ts` | Mermaid output for 17 diagram types |
| `doc-generator.test.ts` | Documentation synthesis |
| `document-converter.test.ts` | PDF/DOCX/PPTX parsing |
| `ears-validator.test.ts` | EARS pattern recognition |
| `file-manager.test.ts` | File I/O, atomic writes |
| `git-manager.test.ts` | Branch/PR payload generation |
| `iac-generator.test.ts` | Terraform/Bicep/Dockerfile output |
| `intent-drift-engine.test.ts` | Drift scoring, principle extraction |
| `methodology.test.ts` | Educational content correctness |
| `metrics-generator.test.ts` | HTML dashboard generation |
| `model-routing-engine.test.ts` | Per-phase model recommendations |
| `pbt-generator.test.ts` | fast-check/Hypothesis property tests |
| `state-machine.test.ts` | Phase transitions, gate enforcement |
| `template-engine.test.ts` | Template rendering |
| `test-generator.test.ts` | Test stub generation |
| `test-result-parser.test.ts` | Vitest/pytest/JUnit parsing |
| `test-traceability-mapper.test.ts` | REQ-ID mapping, coverage reports |
| `transcript-parser.test.ts` | VTT/SRT parsing |
| `work-item-exporter.test.ts` | GitHub/Azure/Jira payloads |

---

## File Structure

```
specky/
├── src/
│   ├── index.ts                    MCP server entry point, service wiring
│   ├── constants.ts                Enums, TOOL_NAMES (56), TOTAL_TOOLS=56
│   ├── types.ts                    TypeScript interfaces (zero `any`)
│   ├── schemas/                    10 Zod schema files
│   └── services/                   26 service classes
│   └── tools/                      15 tool registration files
├── templates/                      22 Markdown templates
├── .specs/                         7 implemented spec directories
│   ├── 001-specky-mcp-server/
│   ├── 002-enterprise-ready/
│   ├── 003-model-routing-guidance/
│   ├── 004-context-tiering/
│   ├── 005-cognitive-debt-metrics/
│   ├── 006-verified-test-loop/
│   └── 007-intent-drift-detection/
├── .github/
│   ├── agents/                     4 GitHub Copilot custom agents
│   └── workflows/
│       ├── ci.yml                  Build + test on push/PR
│       └── docker-publish.yml      GHCR publish + cosign signing + SBOM
├── .claude/
│   ├── commands/                   12 Claude Code slash commands
│   └── hooks/                      10 executable hook scripts
├── tests/
│   ├── unit/                       27 unit test files
│   └── integration/                3 integration test files
├── docs/
│   ├── API_REFERENCE.md            Auto-generated, all 56 tools
│   ├── SYSTEM-DESIGN.md
│   └── IMPLEMENTATION_SUMMARY.md   This document
├── references/
│   ├── ears-notation.md
│   ├── spec-templates.md
│   └── design-patterns.md
├── Dockerfile                      Multi-stage, non-root, GHCR labels
├── package.json                    specky-sdd@3.1.0
├── CHANGELOG.md                    Full history from v1.0.0
├── CLAUDE.md                       Project instructions (auto-loaded)
└── README.md                       Public documentation, badges
```

---

## CI/CD and Publishing

### GitHub Actions Workflows

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `ci.yml` | Push / PR to main, develop | `npm ci` → `npm run build` → `npm test` → `tsc --noEmit` |
| `docker-publish.yml` | Push tag `v*.*.*` | Build multi-arch (amd64/arm64) → Push GHCR → cosign sign → SBOM (syft) |

### npm

```bash
npm publish --access public   # published specky-sdd@3.1.0 on 2026-04-12
```

Registry: [npmjs.com/package/specky-sdd](https://www.npmjs.com/package/specky-sdd)

### Docker (GHCR)

```bash
docker pull ghcr.io/paulasilvatech/specky:3.1.0
docker pull ghcr.io/paulasilvatech/specky:latest
```

Image features:
- Multi-stage build (builder + production stages)
- Non-root user (`specky:specky`)
- Health check via `/health` endpoint
- OCI labels with source, version, license
- Supply chain security: cosign signing + SBOM attestation

---

## Automation Hooks (10)

| Hook | Trigger | Blocking | Purpose |
|------|---------|----------|---------|
| `spec-sync.sh` | PostToolUse (Write/Edit) | No | Detect spec-code drift, write SYNC_REPORT.md |
| `auto-test.sh` | PostToolUse | No | Remind to generate tests after spec changes |
| `auto-docs.sh` | PostToolUse | No | Flag documentation updates needed |
| `security-scan.sh` | Stop | Yes (exit 2) | OWASP Top 10 + secrets scan |
| `srp-validator.sh` | PostToolUse | No | Flag SRP violations, suggest decomposition |
| `changelog.sh` | Stop | No | Remind to update CHANGELOG.md |
| `auto-checkpoint.sh` | PostToolUse | No | Auto-checkpoint spec artifact writes |
| `spec-quality.sh` | After sdd_write_spec | No | Check req count, AC coverage, REQ-ID format |
| `task-tracer.sh` | After sdd_write_tasks | No | Detect tasks missing REQ-* traceability |
| `release-gate.sh` | Before sdd_create_pr | Yes (exit 2) | Enforce VERIFICATION.md + CHECKLIST.md + 90% pass rate |

---

## Pipeline Phases

```
Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release
```

Each phase requires its predecessor to be complete. The state machine persists phase state in `.sdd-state.json` inside each spec directory. Gates enforce that mandatory files exist before a phase can close.

---

## Version History

| Version | Date | Tools | Services | Tests | Key Changes |
|---------|------|-------|----------|-------|-------------|
| 1.0.0 | 2026-03-20 | 17 | 6 | — | Initial release: pipeline, EARS validation, 4 agents |
| 2.0.0 | 2026-03-21 | 42 | 14 | — | 10-phase pipeline, compliance, diagrams, IaC, MCP-to-MCP routing |
| 2.1.0 | 2026-03-21 | 44 | 14 | — | sdd_check_ecosystem, sdd_validate_ears, MCP ecosystem detection |
| 2.2.0 | 2026-03-24 | 47 | 16 | 211 | sdd_generate_tests, sdd_verify_tests, 6 test frameworks |
| 2.3.1 | 2026-03-24 | 52 | 17 | 292 | sdd_turnkey_spec, sdd_generate_pbt, checkpoint/restore (3 tools) |
| 3.0.0 | 2026-03-26 | 53 | 18 | 321 | Phase validation, gate enforcement, 17 diagram types, enriched responses |
| **3.1.0** | **2026-04-12** | **56** | **26** | **507** | **Intelligence layer: model routing, context tiering, cognitive debt, test traceability, intent drift** |

---

## Compliance Frameworks Supported

`sdd_compliance_check` validates specifications against:

| Framework | Controls | Target |
|-----------|----------|--------|
| HIPAA | Access control, audit, encryption, PHI, integrity, transmission | Healthcare |
| SOC 2 | Logical access, monitoring, change management, encryption, incidents | SaaS/Cloud |
| GDPR | Lawful processing, erasure, portability, privacy by design, breach notification | EU data |
| PCI-DSS | Firewall, stored data, transmission, secure systems, authentication, monitoring | Payments |
| ISO 27001 | Security policies, access control, cryptography, operations, incidents | Enterprise |
| General | Input validation, authentication, authorization, logging | All projects |

---

## MCP-to-MCP Integration

Specky integration tools produce payloads designed for forwarding to other MCP servers:

| Specky Tool | Target MCP | Target Tool |
|-------------|------------|-------------|
| `sdd_create_branch` | GitHub MCP | `create_branch` |
| `sdd_create_pr` | GitHub MCP | `create_pull_request` |
| `sdd_export_work_items` | GitHub / Azure / Jira MCP | `create_issue` / equivalent |
| `sdd_generate_iac` | Terraform MCP | `validate` / `plan` |
| `sdd_setup_local_env` | Docker MCP | `compose` tools |
| `sdd_generate_devcontainer` | Docker MCP | container tools |

Each tool response includes a `routing_instructions` or `command_hint` field for the AI client to route accordingly.

---

*Generated: 2026-04-12 · Specky v3.1.0 · MIT License*
