# Specky v2.0 — Session Log | 2026-03-21

## Overview

Complete development session covering the creation, expansion, and publication of Specky v2.0 — The Complete Spec-Driven Development Platform via MCP Protocol. Started from v1.0 (17 tools), ended at v2.1 (43 tools) published across 4 channels.

---

## 1. Starting Point — Specky v1.0.0

Specky v1.0.0 was already built and committed with:

- 17 MCP tools across 4 tool files
- 7-phase pipeline: Init, Discover, Specify, Clarify, Design, Tasks, Analyze
- 6 services: FileManager, StateMachine, TemplateEngine, EarsValidator, CodebaseScanner, TranscriptParser
- 7 Markdown templates
- 4 Copilot agents, 7 Claude Code commands, 6 automation hooks

---

## 2. Publication of v1.0.0

### GitHub Repository

- Created repo via `gh repo create paulasilvatech/specky --public`
- Pushed 76 files, 19,683 lines
- URL: https://github.com/paulasilvatech/specky

### npm Package

- Name `specky` was taken on npm (owned by another author)
- Renamed to `specky-sdd` in package.json
- Published via `npm publish --access public` (required 2FA + OTP via authenticator app)
- URL: https://www.npmjs.com/package/specky-sdd

### Docker Image

- Built multi-stage Docker image
- Added `write:packages` scope via `gh auth refresh`
- Pushed to GitHub Container Registry: `ghcr.io/paulasilvatech/specky:1.0.0`

### GitHub Release

- Created release v1.0.0 with changelog
- URL: https://github.com/paulasilvatech/specky/releases/tag/v1.0.0

---

## 3. Strategic Analysis — Specky vs Spec-Kit vs Kiro

### Research Conducted

- Deep dive into GitHub Spec-Kit fork at `paulasilvatech/spec-kit`
- Read all command templates: specify.md, plan.md, tasks.md, implement.md, analyze.md, clarify.md, checklist.md, taskstoissues.md, constitution.md
- Read all templates: spec-template.md, plan-template.md, tasks-template.md, checklist-template.md, constitution-template.md
- Analyzed extension system (catalog.json, 20+ community extensions)
- Analyzed preset system (domain customization)
- Analyzed CLI source code (Python, specify_cli/__init__.py)
- Researched Amazon Kiro IDE (GA Nov 2025, 250k+ developers)

### Key Findings

| Aspect | Spec-Kit | Kiro | Specky |
|--------|----------|------|--------|
| Type | CLI + templates | IDE (VS Code fork) | MCP Server |
| How it works | Copies prompts to repo | Built-in AI IDE | Server exposes 17+ tools via MCP |
| Validation | AI tries to follow | AI tries to follow | Programmatic (EARS regex, state machine) |
| Agent support | 22+ agents | Claude Sonnet only | Any MCP-compatible |
| Price | Free (MIT) | $0-200/month | Free (MIT) |

### Strategic Decision

Paula decided to **absorb Spec-Kit INTO Specky** — not the reverse. Specky becomes the primary product with Spec-Kit's best features integrated natively.

---

## 4. Architecture Design — Specky v2.0

### Paula's Requirements

1. Azure Boards + Jira + GitHub Issues via MCP-to-MCP
2. Everything optional in Spec-Kit becomes mandatory in Specky
3. Maximum deterministic behavior
4. Maximum automation, interactive, educative
5. Multiple input sources: transcripts, PDF, DOCX, PPTX, Markdown, user text
6. All inputs converted to Markdown as raw source
7. Terraform IaC generation + validation via Terraform MCP + Azure MCP
8. Figma MCP: design to code to specs (reverse), FigJam diagrams
9. Docker MCP: local dev environments
10. Codespaces: cloud dev environments
11. Mermaid diagrams at EVERY phase
12. Complete auto-documentation
13. MCP-to-MCP pattern (AI client orchestrates, not server-to-server)

### MCP-to-MCP Architecture (Option B)

```
Specky MCP Server → Structured JSON with routing_instructions
  → AI Client (Copilot/Claude) reads routing_instructions
  → AI Client calls appropriate external MCP server
```

Why Option B:
- Specky never needs API keys or OAuth tokens
- Each external MCP server maintains its own auth
- No server-to-server coupling
- New platforms added without Specky changes
- AI client is the natural orchestration layer

### 10-Phase Pipeline

```
Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release
```

Every phase mandatory. State machine blocks advancement until prerequisites are met.

---

## 5. Implementation — Specky v2.0

### Batch 1: Foundation (3 files modified)

**src/constants.ts:**
- Phase enum: added Implement, Verify, Release (7 → 10 phases)
- PHASE_ORDER: expanded to 10 entries
- PHASE_REQUIRED_FILES: added entries for new phases
- VERSION: "1.0.0" → "2.0.0"
- Added 25+ new tool name constants
- Added 14 new template names
- Added 7 new type aliases: WorkItemPlatform, DiagramType, ComplianceFramework, ChecklistDomain, DocumentFormat, IacProvider, CloudProvider

**src/types.ts:**
- Added 37 new interfaces organized in 14 categories
- Grew from 183 to 558 lines
- Categories: Document Conversion, Work Item Export, Cross-Analysis, Checklist, Research, Compliance, Diagrams, User Stories, IaC, Dev Environment, PR/Branch, Implementation, Verification, Metrics, Documentation, MCP Ecosystem, Educative Output

**src/services/state-machine.ts:**
- Added v1→v2 state migration logic (auto-detects old state files, adds missing phases)
- Version bump: "3.0.0" → "4.0.0" in createDefaultState

### Batch 2: Schemas (6 new files)

| File | Tools Covered |
|------|--------------|
| `src/schemas/input.ts` | sdd_import_document, sdd_figma_to_spec, sdd_batch_import |
| `src/schemas/quality.ts` | sdd_checklist, sdd_verify_tasks, sdd_compliance_check, sdd_cross_analyze |
| `src/schemas/visualization.ts` | sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram |
| `src/schemas/infrastructure.ts` | sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile |
| `src/schemas/environment.ts` | sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer |
| `src/schemas/integration.ts` | sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research |

### Batch 3: Services (8 new files)

| Service | File | Responsibility |
|---------|------|---------------|
| DocumentConverter | `document-converter.ts` | PDF/DOCX/PPTX/TXT → Markdown (built-in + optional mammoth/pdfjs-dist upgrade) |
| DiagramGenerator | `diagram-generator.ts` | Deterministic Mermaid generation (10 diagram types, no AI inference) |
| IacGenerator | `iac-generator.ts` | Terraform/Bicep/Dockerfile generation from DESIGN.md |
| WorkItemExporter | `work-item-exporter.ts` | Tasks → GitHub Issues / Azure Boards / Jira structured JSON |
| CrossAnalyzer | `cross-analyzer.ts` | REQ-ID cross-artifact alignment analysis with consistency score |
| ComplianceEngine | `compliance-engine.ts` | Static compliance controls for 6 frameworks (HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001, General) |
| DocGenerator | `doc-generator.ts` | Auto-documentation: full docs, API docs, runbooks, onboarding guides |
| GitManager | `git-manager.ts` | Branch naming, PR payload generation (no git execution) |

### Batch 4: Templates (14 new files)

| Template | Purpose |
|----------|---------|
| research.md | Questions, findings, recommendations |
| data-model.md | Entity-relationship documentation |
| checklist.md | Quality checklist with pass/fail items |
| cross-analysis.md | Alignment matrices, orphans, consistency score |
| work-items.md | Export summary per platform |
| verification.md | Phantom detection results |
| compliance.md | Compliance controls report |
| user-stories.md | User stories with flow diagrams |
| api-docs.md | API documentation template |
| runbook.md | Operational runbook |
| onboarding.md | Developer onboarding guide |
| terraform.md | Terraform module template |
| dockerfile.md | Dockerfile template |
| devcontainer.md | Devcontainer.json template |

### Batch 5: Tools (7 new registration files)

| File | Tools Registered |
|------|-----------------|
| `src/tools/input.ts` | sdd_import_document, sdd_figma_to_spec, sdd_batch_import |
| `src/tools/quality.ts` | sdd_checklist, sdd_verify_tasks, sdd_compliance_check, sdd_cross_analyze |
| `src/tools/visualization.ts` | sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram |
| `src/tools/infrastructure.ts` | sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile |
| `src/tools/environment.ts` | sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer |
| `src/tools/integration.ts` | sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research |
| `src/tools/documentation.ts` | sdd_generate_docs, sdd_generate_api_docs, sdd_generate_runbook, sdd_generate_onboarding |

### Batch 6: Wiring

**src/index.ts:**
- Imported 8 new services and 7 new tool registration functions
- Instantiated all new services
- Registered all new tool groups
- Updated comment: "42 total"

### Batch 7: Build and Verify

- `npm run build` — zero errors
- Server startup: `[specky] Server started on stdio (v2.0.0)`

---

## 6. Documentation Rewrite

### README.md (397 lines)

- Complete rewrite with comparison table (Specky vs Spec-Kit vs Kiro vs Cursor)
- Installation for VS Code + Copilot, Claude Code, Claude Desktop, Cursor, Docker
- All 42 tools documented in 9 groups
- MCP integration architecture explained
- EARS notation reference
- Compliance frameworks
- Educative outputs

### GETTING-STARTED.md (1,222 lines)

- Tutorial from zero: what is MCP, what is SDD, what is EARS
- Step-by-step pipeline walkthrough
- Document import, work item export, IaC generation
- Diagram generation, compliance checks
- Full pipeline from meeting to deployment

### CONTRIBUTING.md (398 lines)

- Architecture overview: 14 services, 11 tool files, 10 schemas, 21 templates
- How to add new tools, templates, services, compliance frameworks, diagram types
- Code style, testing approach, PR guidelines

### CLAUDE.md (531 lines)

- Updated for 42 tools, 10 phases, MCP-to-MCP architecture
- Model routing table updated
- Compliance frameworks documented
- Educative outputs documented

---

## 7. Professional SVG Diagrams

Created 4 SVGs in `media/` following the Microsoft brand design system:

| SVG | Content | Dimensions |
|-----|---------|-----------|
| `architecture-mcp-ecosystem.svg` | Input sources → Specky → 7 external MCP servers | 1200x720 |
| `pipeline-10-phases.svg` | 10 mandatory phases with artifacts and color coding | 1400x600 |
| `comparison-matrix.svg` | 12-row comparison: Specky vs Spec-Kit vs Kiro vs Cursor | 1200x900 |
| `end-to-end-flow.svg` | 6 swim lanes: Input → Spec → Design → Implementation → Quality → Delivery | 1400x800 |

Design rules followed:
- Microsoft brand colors: Blue #0078D4, Green #7FBA00, Yellow #FFB900, Red #F25022
- Neutrals: Near-black #2C2C2A, Medium gray #888780, Light gray #B4B2A9
- Font: -apple-system, BlinkMacSystemFont, Segoe UI
- Orthogonal routing with Q-curve corners
- Section backgrounds at opacity 0.03-0.05
- Metric badges, accent bar, arrow markers

---

## 8. MCP Ecosystem Detection (v2.1.0)

Added `sdd_check_ecosystem` tool and MCP server recommendation system:

### MCP_ECOSYSTEM Registry

10 recommended external MCP servers mapped to Specky tools:

| Server | Enhances |
|--------|----------|
| Microsoft MarkItDown | sdd_import_document, sdd_batch_import |
| GitHub MCP | sdd_export_work_items, sdd_create_pr, sdd_create_branch |
| Azure DevOps MCP | sdd_export_work_items (azure_boards) |
| Jira MCP | sdd_export_work_items (jira) |
| Terraform MCP | sdd_validate_iac, sdd_generate_iac |
| Azure MCP | sdd_validate_iac (Azure cloud) |
| Figma MCP | sdd_figma_to_spec, sdd_figma_diagram |
| Docker MCP | sdd_setup_local_env |
| Playwright MCP | sdd_verify_tasks |
| Miro MCP | sdd_generate_diagram |

### Recommendation Pattern

Every tool that depends on external MCP includes `recommended_servers` in output:
- If the AI client HAS the MCP server → routes automatically
- If NOT → shows recommendation with install_command and install_note

---

## 9. Paula's VS Code MCP Ecosystem (discovered)

25 MCP servers already installed globally:

| Server | Type |
|--------|------|
| GitHub MCP (Copilot built-in + standalone) | HTTP + stdio |
| Azure MCP (@azure/mcp) | stdio |
| Azure DevOps MCP (@azure-devops/mcp) | stdio |
| Terraform MCP (HashiCorp) | Docker |
| Figma MCP (local + cloud) | HTTP |
| MarkItDown MCP (Microsoft) | stdio |
| Playwright MCP | stdio |
| Miro MCP | HTTP |
| Azure AI Foundry MCP | stdio |
| AKS MCP | Docker |
| Microsoft Docs MCP | HTTP |
| DevBox MCP | stdio |
| Fabric RTI MCP | stdio |
| Sentinel MCP | HTTP |
| Clarity MCP | stdio |
| Enterprise MCP | HTTP |
| Sequential Thinking | stdio |
| Firecrawl MCP | stdio |
| Desktop Commander | stdio |
| Chrome DevTools MCP | stdio |
| ImageSorcery | stdio |

All of these are accessible to Copilot Chat simultaneously with Specky's 43 tools.

---

## 10. VS Code Issues Encountered

### Problem: 730+ markdown lint warnings in Problems panel

- Caused by markdownlint extension validating template files containing Handlebars `{{placeholders}}`
- Also affected by VS Code built-in markdown validation

### Resolution

- Added `"markdown.validate.enabled": false` to VS Code global settings (both Code and Code Insiders)
- Added `.vscode/settings.json` to project with markdown validation disabled
- Created then reverted `.markdownlint.jsonc` (was insufficient)

---

## 11. Publication Summary — v2.0 and v2.1

### v2.0.0

| Channel | Status | Link |
|---------|--------|------|
| GitHub | Published | https://github.com/paulasilvatech/specky |
| GitHub Release | v2.0.0 | https://github.com/paulasilvatech/specky/releases/tag/v2.0.0 |
| npm | Published | https://www.npmjs.com/package/specky-sdd |
| Docker | Published | ghcr.io/paulasilvatech/specky:2.0.0 |

### v2.1.0

- Added MCP ecosystem detection
- Published to GitHub (pushed)
- npm publish pending (user runs in terminal)

---

## 12. Final Inventory — Specky v2.1.0

| Metric | v1.0 | v2.1 | Delta |
|--------|------|------|-------|
| Source TypeScript files | 17 | 38 | +21 |
| Lines of TypeScript | ~8,000 | 27,738 | +19,738 |
| Templates | 7 | 21 | +14 |
| Services | 6 | 14 | +8 |
| Schemas | 4 | 10 | +6 |
| Tool registration files | 4 | 11 | +7 |
| MCP tools | 17 | 43 | +26 |
| Pipeline phases | 7 | 10 | +3 |
| Diagram types | 0 | 10 | +10 |
| Compliance frameworks | 0 | 6 | +6 |
| Work item platforms | 0 | 3 | +3 |
| Input formats | 3 | 7 | +4 |
| MCP integrations | 0 | 10 | +10 |
| SVG diagrams | 0 | 4 | +4 |
| Documentation lines | ~1,000 | 2,548 | +1,548 |

### Complete Tool List (43)

**Input and Conversion (5):**
sdd_import_document, sdd_import_transcript, sdd_auto_pipeline, sdd_batch_import, sdd_figma_to_spec

**Pipeline Core (8):**
sdd_init, sdd_discover, sdd_write_spec, sdd_clarify, sdd_write_design, sdd_write_tasks, sdd_run_analysis, sdd_advance_phase

**Quality and Validation (5):**
sdd_checklist, sdd_verify_tasks, sdd_compliance_check, sdd_cross_analyze, sdd_validate_ears

**Diagrams and Visualization (4):**
sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram

**Infrastructure as Code (3):**
sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile

**Dev Environment (3):**
sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer

**Integration and Export (5):**
sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research

**Documentation (4):**
sdd_generate_docs, sdd_generate_api_docs, sdd_generate_runbook, sdd_generate_onboarding

**Utility (6):**
sdd_get_status, sdd_get_template, sdd_scan_codebase, sdd_metrics, sdd_amend, sdd_check_ecosystem

---

## 13. Git Commit History

```
e8cd06b feat: MCP ecosystem detection and server recommendations
fbcb832 fix: suppress VS Code markdown lint warnings in template files
bac5a07 feat: add professional SVG diagrams replacing ASCII art
1d28b6d docs: professional documentation for Specky v2.0.0
403b0bb feat: Specky v2.0.0 — The Complete SDD Platform
ce27b71 fix: rename npm package to specky-sdd (name specky was taken)
b46de4a feat: Specky MCP Server v1.0.0
```

---

## 14. How to Use

### VS Code with GitHub Copilot

Create `.vscode/mcp.json` in any project:

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

Open Copilot Chat — 43 tools are available. Specky auto-integrates with all other MCP servers installed in VS Code.

### Claude Code

```bash
claude mcp add specky -- npx -y specky-sdd
```

Or use slash commands: `/sdd-spec`, `/sdd-design`, `/sdd-tasks`, `/sdd-analyze`, `/sdd-transcript`

### Docker

```bash
docker run -v $(pwd):/workspace ghcr.io/paulasilvatech/specky:latest
```

---

## 15. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP-to-MCP pattern | AI client orchestration (Option B) | No credentials in Specky, no server coupling |
| Spec-Kit absorption | Absorbed INTO Specky | Specky is the primary product |
| Everything mandatory | State machine enforces | Maximum determinism |
| Document conversion | Built-in + optional MarkItDown MCP | Works standalone, enhanced with MarkItDown |
| Diagram generation | Deterministic Mermaid (no AI) | Reproducible, consistent |
| Compliance controls | Static TypeScript constants | No external dependencies |
| IaC generation | Template-based Terraform | Deterministic, auditable |
| Work item export | Structured JSON payloads | Platform-agnostic, AI client routes |

---

**Session Duration:** ~4 hours
**Author:** Paula Silva | Americas Software GBB, Microsoft
**AI Assistant:** Claude Opus 4.6 (1M context)
