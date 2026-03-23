# Changelog

All notable changes to Specky are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.1.0]: https://github.com/paulasilvatech/specky/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/paulasilvatech/specky/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/paulasilvatech/specky/releases/tag/v1.0.0
