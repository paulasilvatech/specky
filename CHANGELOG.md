# Changelog

All notable changes to Specky are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-04-12

### Intelligence Layer (Specs 003–007)

#### Model Routing Guidance (Spec 003)
- **`sdd_model_routing`** (NEW tool #54): Returns the full 10-phase model routing decision table with optimal model, mode, extended thinking settings, arXiv evidence, and cost savings calculator
- **`model_routing_hint`** field added to ALL 55 tool responses via `buildToolResponse()` — every response now tells the AI client which model to use for the current phase
- Complexity override: `implement`/`design` phases with >10 files escalate to Opus automatically
- `ModelRoutingEngine` service with empirically-grounded ROUTING_TABLE (arXiv:2601.08419)

#### Context Tiering (Spec 004)
- **`sdd_context_status`** (NEW tool #55): Returns Hot/Domain/Cold tier assignment for all spec artifacts with estimated token savings
- **`context_load_summary`** field added to ALL 55 tool responses — shows which files are loaded per call
- `ContextTieringEngine` service: CONSTITUTION.md=Hot, SPEC/DESIGN/TASKS=Domain, ANALYSIS/CHECKLIST/etc=Cold
- Token estimation: `Math.ceil(content.length / 4)` — matches GPT/Claude tokenization heuristic

#### Cognitive Debt Metrics (Spec 005)
- **`cognitive_debt`** field in `sdd_metrics` and `sdd_get_status` responses (when gate history available)
- Gate instrumentation in `sdd_advance_phase`: records mtime-based modified/unmodified detection per gate
- `CognitiveDebtEngine` service: LGTM-without-modification rate as cognitive surrender signal; score = `(lgtm_rate × 0.6) + (delta_normalized × 0.4)`, labels: healthy/caution/high_risk
- Warning shown in `sdd_advance_phase` response when unmodified approval is detected

#### Verified Test Loop (Spec 006)
- **`TestResultParser`** service: auto-detects and parses Vitest JSON, pytest JSON, and JUnit XML into normalized `TestResult[]`
- **`TestTraceabilityMapper`** service: maps test names to REQ-XXX IDs via `// REQ-XXX` comment convention, builds per-requirement coverage report and failure details with `suggested_fix_prompt`
- `sdd_verify_tests` enhanced: adds `enhanced_coverage` (per-requirement breakdown) and `failure_details` to response when parsers are wired
- JUnit XML parser bug fixed: self-closing `<testcase .../>` was greedily consumed by open-tag alternative, merging two testcases; fixed with negative lookbehind `(?<!\/)`

#### Intent Drift Detection (Spec 007)
- **`intent_drift`** report in `sdd_check_sync` and `sdd_metrics` responses
- **`drift_amendment_suggestion`** in `sdd_amend` response when last drift score > 40 — lists orphaned constitutional principles with recommended spec actions
- `IntentDriftEngine` service: extracts principles from CONSTITUTION.md `## Article` sections, keyword-overlap coverage detection (≥2 keywords threshold), trend analysis (improving/stable/worsening) over last 3 DriftSnapshots
- `drift_history` stored in `.sdd-state.json` (FIFO, max 100 entries)

### Stats
- **56 tools** (was 53, corrected to 56 — sdd_metrics, sdd_validate_ears, sdd_check_ecosystem were already implemented but undercounted): +sdd_model_routing, +sdd_context_status, count reconciled
- **24 services** (was 18): +ModelRoutingEngine, +ContextTieringEngine, +CognitiveDebtEngine, +IntentDriftEngine, +TestResultParser, +TestTraceabilityMapper
- **507 unit tests** across 30 test files (was 321 across 22 files)
- All 7 specs (001–007) at ≥93% acceptance criteria coverage

---

## [3.0.0] - 2026-03-26

### Pipeline Validation & Enforcement
- **Phase validation on every tool**: `validatePhaseForTool()` maps 53 tools to allowed pipeline phases; tools called out-of-order return structured errors with fix guidance
- **Gate decision enforcement**: `advancePhase()` now blocks advancement past Analyze if gate decision is BLOCK or CHANGES_NEEDED; only APPROVE allows progression
- **Clarify phase fix**: `sdd_clarify` now properly completes the Clarify phase (was stuck in `in_progress`)
- **Proper state transitions**: `sdd_auto_pipeline` and `sdd_turnkey_spec` now use `advancePhase()` instead of direct state manipulation

### Software Engineering Diagrams (10 → 17 types)
- **7 new diagram types**: C4 Component (L3), C4 Code (L4), Activity, Use Case, Data Flow (DFD), Deployment, Network Topology
- **`generateAllDiagrams()`** now generates up to 16 diagrams per feature automatically
- **Schema updated**: `diagram_type` enum expanded from 10 to 17 types

### System Design Completeness (6 → 12 sections)
- **Design template expanded**: System Context (C4 L1), Container Architecture (C4 L2), Component Design (C4 L3), Code-Level Design (C4 L4), System Diagrams, Data Model, API Contracts, Infrastructure & Deployment, Security Architecture, ADRs, Error Handling, Cross-Cutting Concerns
- **9 new optional fields** in `writeDesignInputSchema` for backward compatibility
- **Design completeness validation**: `validateDesignCompleteness()` scores DESIGN.md against 12 required sections

### Enriched Interactive Responses (ALL 53 tools)
- **`enrichResponse()`**: Every tool response now includes phase progress bar, educational notes, methodology tips, handoff context, and parallel execution hints
- **`enrichStateless()`**: Utility tools without phase context get educational notes and common mistakes
- **`buildPhaseError()`**: Structured phase validation errors with fix guidance and methodology context
- **`MethodologyGuide`** service: Educational content for all 10 phases (what/why/how/anti-patterns/best-practices) and 20+ tools
- **`DependencyGraph`** service: Parallel execution groups for all 10 phases, tool dependency mapping, execution plans

### Parallel Documentation Generation
- **`sdd_generate_all_docs`** (NEW tool #53): Generates 5 doc types in parallel via `Promise.all()`
- **`generateJourneyDocs()`**: New SDD Journey document capturing complete pipeline audit trail (phases, timestamps, gate decisions, traceability)
- **DocGenerator wired with StateMachine** for phase-aware documentation

### Active Hooks (6 → 7)
- **`auto-checkpoint.sh`** (NEW): Suggests checkpoint creation when spec artifacts are modified
- **`security-scan.sh`** now BLOCKS (exit 2) when hardcoded secrets detected
- **`spec-sync.sh`** enhanced with drift detection and spec-reference checking
- **`auto-docs.sh`** enhanced with modification tracking via `.doc-tracker.json`

### Interactive Commands (12 rewritten)
- All 12 `/sdd:*` commands rewritten with step-by-step educational guidance
- Every step explains "What's happening" and "Why it matters"
- WAIT/LGTM gates at all quality checkpoints
- Enriched response data surfaced (progress bar, parallel hints, handoff)
- Error recovery sections with guidance back on track

### New Files
- `src/services/methodology.ts` — Educational content service (static, no dependencies)
- `src/services/dependency-graph.ts` — Parallel execution graph (static, no dependencies)
- `src/tools/response-builder.ts` — Response enrichment (enrichResponse, enrichStateless, buildPhaseError)
- `templates/journey.md` — SDD Journey documentation template
- `.claude/hooks/auto-checkpoint.sh` — Auto-checkpoint hook

### Stats
- **53 tools** (was 52), **17 diagram types** (was 10), **22 templates** (was 21), **7 hooks** (was 6)
- **18 services** (was 16): +MethodologyGuide, +DependencyGraph
- **321 unit tests**, all passing
- **12 interactive commands** fully rewritten

## [2.3.1] - 2026-03-25

### Changed
- Added Specky MCP logo and icon (PNG 256x256 + 128x128) for VS Code MCP Gallery and npm
- Configured "icon" field in package.json

## [2.3.0] - 2026-03-24

### Added
- `sdd_turnkey_spec` tool — generates complete EARS specification from a natural language description with auto-extracted requirements, EARS pattern classification, acceptance criteria generation, NFR inference, and clarification questions
- `sdd_generate_pbt` tool — generates property-based tests using fast-check (TypeScript) or Hypothesis (Python), extracting 6 property types from EARS requirements: invariant, state_transition, conditional, negative, round_trip, idempotence
- `sdd_checkpoint` tool — creates named snapshots of all spec artifacts and pipeline state for safe rollback
- `sdd_restore` tool — restores spec artifacts from a previous checkpoint with automatic backup of current state
- `sdd_list_checkpoints` tool — lists all available checkpoints with labels, dates, and phases
- `src/services/pbt-generator.ts` — new PBT generator service with EARS-to-property extraction and framework-specific code generation
- 5 new Claude Code commands: `/sdd:verify`, `/sdd:docs`, `/sdd:export`, `/sdd:diagrams`, `/sdd:iac`
- 6 executable hook scripts in `.claude/hooks/` with Claude Code `settings.json` integration (PostToolUse, Stop, TaskCompleted events)
- `.github/copilot-instructions.md` — GitHub Copilot project instructions with quick start guide
- `.github/workflows/sdd-hooks.yml` — GitHub Actions workflow replicating hook automation (spec-sync, security-scan, SRP validator, changelog reminder)
- `tests/unit/pbt-generator.test.ts` — 36 test cases for PBT generator (property extraction, classification, fast-check/hypothesis generation)
- `tests/unit/turnkey.test.ts` — 36 test cases for turnkey spec helpers (candidate extraction, EARS conversion, acceptance criteria, clarifications, NFR inference)
- `tests/integration/checkpoint-e2e.test.ts` — 9 integration test cases for checkpoint create/restore/list with real filesystem

### Changed
- MCP tool count: 47 → 52
- Claude Code commands: 7 → 12
- Test suite expanded: 211 → 292 tests across 19 files
- All 4 GitHub Copilot agents rewritten with complete workflows (turnkey, PBT, checkpointing, diagrams, IaC, docs, export, compliance)
- `spec-engineer.agent.md` now documents 8 workflows and references 49 tools
- `design-architect.agent.md` now includes diagram generation, IaC, and dev environment workflows
- `task-planner.agent.md` now includes export, test generation, and verification workflows
- `spec-reviewer.agent.md` now includes compliance, EARS validation, cross-artifact analysis, and test verification workflows
- `CLAUDE.md` updated to v2.3.0 with complete tool reference
- `README.md` updated with new tools, comparison matrix, and feature descriptions
- `TOTAL_TOOLS` constant corrected: 44 → 52
- Version bumped: 2.2.3 → 2.3.0

## [2.2.0] - 2026-03-24

### Added
- `sdd_generate_tests` tool — generates test stubs from acceptance criteria for 6 frameworks (vitest, jest, playwright, pytest, junit, xunit)
- `sdd_verify_tests` tool — verifies test results JSON against specification requirements, reports traceability coverage
- `.specky/config.yml` support — project-local configuration for templates path, default framework, compliance frameworks, audit toggle
- `src/config.ts` — centralized configuration loader with simple YAML parsing
- MCP integration test (`tests/integration/pipeline-e2e.test.ts`) — full pipeline validation with real FileManager
- Unit tests for 6 additional services: DocGenerator, GitManager, IacGenerator, WorkItemExporter, TranscriptParser, DocumentConverter
- OpenSSF Scorecard workflow (`.github/workflows/scorecard.yml`)
- SBOM generation (CycloneDX) in CI pipeline
- `templates/test-stub.md` template for generated test files

### Changed
- Test suite expanded: 120 → 211 tests across 16 files
- Coverage improved: 38% → 89% lines (threshold: 80%)
- MCP tool count: 44 → 47
- CI pipeline now enforces coverage thresholds

## [2.1.0] - 2026-03-21

### Added
- `sdd_check_ecosystem` tool — detects installed MCP servers and recommends complementary ones
- `sdd_validate_ears` tool — batch EARS requirement validation with pattern classification
- `recommended_servers` field in tool outputs for MCP ecosystem guidance
- Unit test suite with Vitest (101 tests across 7 service files)
- CI pipeline runs `npm test` on every push and pull request
- `SECURITY.md` with vulnerability disclosure policy and OWASP coverage
- `CHANGELOG.md` (this file)

### Changed
- Tool count: 42 → 44
- Updated `CLAUDE.md` to reflect v2.1.0 tools and version history

## [2.0.0] - 2026-03-21

### Added
- **25 new MCP tools** (17 → 42 total)
- **3 new pipeline phases**: Discover, Clarify, Release (7 → 10 phases)
- **8 new services**: DocumentConverter, DiagramGenerator, IacGenerator, WorkItemExporter, CrossAnalyzer, ComplianceEngine, DocGenerator, GitManager
- **14 new templates**: compliance, cross-analysis, data-model, devcontainer, dockerfile, onboarding, runbook, terraform, user-stories, verification, work-items, api-docs, checklist, research
- Compliance checking against 6 frameworks: HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001, General
- Mermaid diagram generation (10 types: flowchart, sequence, ER, class, state, Gantt, pie, mindmap, C4 context, C4 container)
- Infrastructure as Code generation: Terraform, Bicep, Dockerfile, devcontainer
- MCP-to-MCP routing architecture — structured payloads for GitHub, Azure DevOps, Jira, Terraform, Figma, Docker MCP servers
- Educative outputs (`next_steps`, `learning_note`) on every tool response
- Document import: PDF, DOCX, PPTX, TXT, MD conversion
- Figma design-to-spec conversion via Figma MCP integration
- Work item export to GitHub Issues, Azure Boards, Jira
- Cross-artifact analysis with consistency scoring
- User story generation from specifications
- Developer onboarding guide generation
- Operational runbook generation
- API documentation generation
- Git branch naming and PR payload generation
- GitHub Codespaces and devcontainer configuration generation
- Docker-based local development environment setup

### Changed
- Pipeline expanded from 7 to 10 phases
- State machine updated for new phase transitions
- All schemas updated to use `.strict()` mode
- Tool annotations added to all tools (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- Architecture documentation updated in `CLAUDE.md`

## [1.0.0] - 2026-03-20

### Added
- Initial release of Specky MCP server
- 17 MCP tools across 4 tool files
- 7-phase pipeline: Init, Discover, Specify, Clarify, Design, Tasks, Analyze
- 6 core services: FileManager, StateMachine, TemplateEngine, EarsValidator, CodebaseScanner, TranscriptParser
- 7 Markdown templates with `{{variable}}` placeholders
- EARS notation validation (6 patterns: ubiquitous, event-driven, state-driven, optional, unwanted, complex)
- State machine with required-file gates per phase
- 4 GitHub Copilot Custom Agents (Spec Engineer, Design Architect, Task Planner, Spec Reviewer)
- 7 Claude Code slash commands
- 6 automation hooks (auto-test, auto-docs, security-scan, spec-sync, changelog, srp-validator)
- TypeScript strict mode with zero `any` types
- Zod schema validation on all tool inputs
- Published to npm (`specky-sdd`), GitHub Container Registry, and GitHub Releases

[3.0.0]: https://github.com/paulasilvatech/specky/compare/v2.3.1...v3.0.0
[2.3.1]: https://github.com/paulasilvatech/specky/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/paulasilvatech/specky/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/paulasilvatech/specky/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/paulasilvatech/specky/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/paulasilvatech/specky/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/paulasilvatech/specky/releases/tag/v1.0.0
