---
title: "Specky v3.0 Enterprise-Ready — Specification"
feature_id: "002-enterprise-ready"
version: 1.0.0
date: 2026-03-21
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
ears_notation: true
requirement_count: 32
categories: [TEST, TGEN, DOC, INTG, TRUST]
---

# Specky v3.0 Enterprise-Ready — Specification

> All requirements use **EARS notation** (Easy Approach to Requirements Syntax). Each requirement is testable, unambiguous, and traceable to the Constitution's success criteria.

---

## 1. Testing Foundation (REQ-TEST)

### REQ-TEST-001: Test Framework Setup (Ubiquitous)

The project shall use Vitest as the test runner with ESM support, TypeScript, and `@vitest/coverage-v8` for coverage reporting.

**Acceptance Criteria:**
- `npm test` runs all test files matching `src/**/*.test.ts`
- `npm run test:coverage` produces coverage report
- Coverage thresholds enforce >= 80% on `src/services/`

**Traces to:** SC-001, SC-002

---

### REQ-TEST-002: EarsValidator Unit Tests (Ubiquitous)

The test suite shall validate all 6 EARS patterns (Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex) with valid and invalid inputs.

**Acceptance Criteria:**
- 6 valid pattern tests pass
- 6 invalid pattern tests correctly return validation errors
- Edge cases (empty string, whitespace-only, unicode) are tested

**Traces to:** SC-001

---

### REQ-TEST-003: StateMachine Unit Tests (Ubiquitous)

The test suite shall verify all 10 phase transitions, skip prevention, state persistence to `.sdd-state.json`, and state reset.

**Acceptance Criteria:**
- Valid transitions (Init→Discover→...→Release) succeed
- Attempting to skip a phase returns an actionable error
- State persists to disk and survives process restart
- Reset clears state to Init phase

**Traces to:** SC-001

---

### REQ-TEST-004: ComplianceEngine Unit Tests (Ubiquitous)

The test suite shall validate all 6 compliance frameworks (HIPAA, SOC2, GDPR, PCI-DSS, ISO27001, General) using fixture specification documents.

**Acceptance Criteria:**
- Each framework's controls are tested with a matching fixture spec
- Controls with required keywords present return "passed"
- Controls with missing keywords return "needs attention"

**Traces to:** SC-001

---

### REQ-TEST-005: FileManager Security Tests (Ubiquitous)

The test suite shall verify that path traversal attacks are blocked by FileManager's sanitization.

**Acceptance Criteria:**
- Paths containing `../` are rejected or sanitized
- Paths containing absolute paths outside workspace are rejected
- Null bytes in paths are rejected

**Traces to:** SC-001

---

### REQ-TEST-006: TemplateEngine Tests (Ubiquitous)

The test suite shall verify rendering of all 21 templates with placeholder substitution.

**Acceptance Criteria:**
- Each template renders without errors
- `{{placeholder}}` values are substituted correctly
- Missing placeholders produce predictable fallback (empty string or placeholder name)

**Traces to:** SC-001

---

### REQ-TEST-007: MCP Integration Test (Event-driven)

When the test suite runs the MCP integration test, the system shall perform a complete handshake, call `sdd_init`, verify file creation, call `sdd_advance_phase`, and verify state transition.

**Acceptance Criteria:**
- MCP `initialize` handshake succeeds
- `sdd_init` creates `.specs/test-feature/CONSTITUTION.md`
- `sdd_advance_phase` transitions from Init to Discover
- `.sdd-state.json` reflects the new phase

**Traces to:** SC-001, SC-002

---

### REQ-TEST-008: Pipeline E2E Test (Event-driven)

When the test suite runs the E2E test, the system shall execute 7 pipeline phases (Init through Analyze) with fixture data and verify all artifacts are created.

**Acceptance Criteria:**
- CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, ANALYSIS.md created
- State machine reflects phase "analyze" after completion
- No errors during the full pipeline run

**Traces to:** SC-001, SC-002

---

### REQ-TEST-009: CI Pipeline with Tests (Ubiquitous)

The CI workflow shall run `npm test` with coverage reporting and fail if coverage drops below 80%.

**Acceptance Criteria:**
- `.github/workflows/ci.yml` includes `npm test` step
- Coverage report is generated and checked against threshold
- Build fails if coverage < 80% on `src/services/`

**Traces to:** SC-002

---

### REQ-TEST-010: Coverage Badge (Ubiquitous)

The README shall display a coverage badge that reflects the current test coverage percentage.

**Acceptance Criteria:**
- Badge is visible in README.md
- Badge updates automatically on each CI run

**Traces to:** SC-002, SC-004

---

## 2. Test Generation Pipeline (REQ-TGEN)

### REQ-TGEN-001: Test Generator Service (Ubiquitous)

The system shall provide a `TestGenerator` service that reads SPECIFICATION.md and TASKS.md and produces test stub files mapped to acceptance criteria.

**Acceptance Criteria:**
- Each acceptance criterion from SPECIFICATION.md generates at least one test stub
- Test stubs include the requirement ID as a comment (e.g., `// REQ-TEST-001`)
- Output directory is configurable

**Traces to:** SC-003

---

### REQ-TGEN-002: Multi-Framework Support (Ubiquitous)

The `sdd_generate_tests` tool shall support 6 test frameworks: Vitest, Jest, Playwright, pytest, JUnit, xUnit.

**Acceptance Criteria:**
- `framework` parameter accepts each of the 6 values
- Generated stubs use correct syntax for each framework
- Invalid framework names return an actionable error

**Traces to:** SC-003

---

### REQ-TGEN-003: Playwright E2E Generation (State-driven)

While the codebase scanner detects a frontend framework (React, Angular, Vue, Next.js, Svelte), the `sdd_generate_tests` tool shall generate Playwright E2E test stubs with `data-testid` selectors.

**Acceptance Criteria:**
- Each user story from SPECIFICATION.md becomes a Playwright test scenario
- Tests use `page.goto()`, `page.fill()`, `page.click()`, `expect()` patterns
- `data-testid` selectors are derived from component names in DESIGN.md

**Traces to:** SC-003

---

### REQ-TGEN-004: API Contract Testing (State-driven)

While the codebase scanner detects a backend API framework (Express, FastAPI, .NET, Spring), the `sdd_generate_tests` tool shall generate API contract test stubs based on endpoints from DESIGN.md.

**Acceptance Criteria:**
- Each API endpoint from DESIGN.md becomes a contract test
- Tests validate HTTP method, URL, status code, and response schema
- Framework-appropriate test library is used (Supertest, pytest, xUnit, RestAssured)

**Traces to:** SC-003

---

### REQ-TGEN-005: Test Verification Tool (Optional)

If test results are available in JSON format, the `sdd_verify_tests` tool shall compare results against acceptance criteria and report requirement coverage.

**Acceptance Criteria:**
- Reads standard test result formats (JUnit XML, Vitest JSON)
- Maps test names to requirement IDs via naming convention
- Reports: X of Y requirements covered by passing tests

**Traces to:** SC-003

---

### REQ-TGEN-006: Playwright MCP Recommendation (Event-driven)

When `sdd_generate_tests` produces Playwright tests, the response shall include `recommended_servers` with Playwright MCP for automated execution.

**Acceptance Criteria:**
- `recommended_servers` field includes Playwright MCP with install command
- `install_note` explains that Playwright MCP enables auto-execution
- Recommendation only appears when framework is "playwright"

**Traces to:** SC-003

---

## 3. Documentation & Onboarding (REQ-DOC)

### REQ-DOC-001: Demo GIF in README (Ubiquitous)

The README shall include a 30-second demo GIF showing the real VS Code flow: prompt → spec → design → tasks.

**Acceptance Criteria:**
- GIF is visible at the top of README.md
- GIF shows actual Copilot Chat interaction with Specky
- File size < 5MB for fast loading

**Traces to:** SC-004

---

### REQ-DOC-002: 5-Minute Quickstart (Ubiquitous)

The README shall include a "5-Minute Quickstart" section with literal copy-paste instructions for `.vscode/mcp.json`.

**Acceptance Criteria:**
- JSON snippet is copy-pasteable without modification
- Instructions work for VS Code, Claude Code, and Cursor
- No prerequisites beyond Node.js >= 18

**Traces to:** SC-004

---

### REQ-DOC-003: SECURITY.md (Ubiquitous)

The project shall include a SECURITY.md file documenting vulnerability disclosure policy, implemented OWASP controls, and dependency audit process.

**Acceptance Criteria:**
- Vulnerability reporting email or GitHub Security Advisories link
- List of OWASP controls implemented (path sanitization, Zod validation, no eval)
- Reference to `npm audit` in CI pipeline

**Traces to:** SC-005

---

### REQ-DOC-004: CHANGELOG.md (Ubiquitous)

The project shall include a CHANGELOG.md with retroactive entries for v1.0.0, v2.0.0, and v2.1.0 in Conventional Commits format.

**Acceptance Criteria:**
- Each version has a date, list of changes, and breaking changes (if any)
- Format follows Keep a Changelog or Conventional Commits
- Future releases add entries automatically via hook

**Traces to:** SC-005

---

### REQ-DOC-005: Integration Cookbook (Ubiquitous)

The project shall include an Integration Cookbook with practical recipes for GitHub, Azure DevOps, Jira, Terraform, Figma, and Docker MCP servers.

**Acceptance Criteria:**
- Each recipe includes: what it does, prerequisites, step-by-step, expected output
- Recipes are tested with actual MCP server configurations
- Document lives in `docs/integration-cookbook.md`

**Traces to:** SC-005

---

### REQ-DOC-006: Version Sync (Ubiquitous)

The CLAUDE.md version header shall always match the version in package.json.

**Acceptance Criteria:**
- CLAUDE.md header says "Specky vX.Y.Z" matching package.json `version`
- CI check fails if versions are mismatched

**Traces to:** SC-009

---

## 4. Integration Polish (REQ-INTG)

### REQ-INTG-001: Unified Agents (Ubiquitous)

The project shall maintain Copilot agents exclusively in `.github/agents/` — the `agents/` root directory shall be removed or converted to symlinks.

**Acceptance Criteria:**
- `.github/agents/` contains all 4 agent definitions with full content
- No duplicate agent files exist in `agents/`
- VS Code Problems panel shows zero agent-related warnings

**Traces to:** SC-006

---

### REQ-INTG-002: Ecosystem Detection (Event-driven)

When `sdd_check_ecosystem` is called, the tool shall report installed, active, and missing MCP servers with install commands.

**Acceptance Criteria:**
- Lists all 10 recommended MCP servers
- Each server shows: id, name, purpose, install_command, status
- Status is one of: "installed", "recommended", "not-detected"

**Traces to:** SC-006

---

### REQ-INTG-003: Customizable Templates (Optional)

If a `.specky/templates/` directory exists in the user's project, the TemplateEngine shall use those templates instead of built-in ones.

**Acceptance Criteria:**
- User templates in `.specky/templates/` override matching built-in templates
- Non-matching templates fall back to built-in
- Template names must match exactly (e.g., `specification.md`)

**Traces to:** SC-006

---

### REQ-INTG-004: Cross-IDE Compatibility (Ubiquitous)

The MCP server shall work correctly in VS Code (Copilot), Claude Code, Cursor, Windsurf, and any MCP-compatible client.

**Acceptance Criteria:**
- stdio transport works in all 4 tested IDEs
- No IDE-specific code in the server
- GETTING-STARTED.md includes setup for each IDE

**Traces to:** SC-010

---

## 5. Enterprise Trust Signals (REQ-TRUST)

### REQ-TRUST-001: OpenSSF Scorecard (Ubiquitous)

The project shall achieve an OpenSSF Scorecard score of >= 7/10.

**Acceptance Criteria:**
- Branch protection enabled on `main`
- CI passes (tests, build)
- SECURITY.md exists
- License file exists
- Signed commits recommended
- Dependency update tool enabled (Dependabot)

**Traces to:** SC-007

---

### REQ-TRUST-002: npm Provenance (Ubiquitous)

The npm publish workflow shall use `--provenance` flag for signed package attestation.

**Acceptance Criteria:**
- `.github/workflows/publish.yml` includes `--provenance`
- Published package shows provenance badge on npmjs.com
- Build environment is attestable (GitHub Actions)

**Traces to:** SC-008

---

### REQ-TRUST-003: Audit Trail (Optional)

If audit is enabled in `.specky/config.yml`, each tool invocation shall log `{ tool, timestamp, spec_dir, result_summary }` to `.specs/NNN/.audit.jsonl`.

**Acceptance Criteria:**
- Audit log is JSON Lines format (one JSON object per line)
- Each entry includes ISO 8601 timestamp
- Audit is off by default, enabled via config
- Log file is gitignored by default

**Traces to:** SC-007

---

### REQ-TRUST-004: SBOM Generation (Event-driven)

When a release is tagged, the CI pipeline shall generate a Software Bill of Materials in CycloneDX or SPDX format.

**Acceptance Criteria:**
- SBOM is attached as a release artifact
- Format is machine-readable (JSON)
- Includes all runtime dependencies with versions and licenses

**Traces to:** SC-007

---

### REQ-TRUST-005: Dependabot and CodeQL (Ubiquitous)

The repository shall have Dependabot enabled for npm dependencies and CodeQL enabled for JavaScript/TypeScript analysis.

**Acceptance Criteria:**
- `.github/dependabot.yml` exists with weekly npm updates
- CodeQL workflow runs on push to main and on PRs
- Security alerts are visible in GitHub Security tab

**Traces to:** SC-007

---

## Acceptance Criteria Summary

| Category | Requirements | Tested By |
|----------|-------------|-----------|
| TEST (Testing Foundation) | 10 | Vitest unit + integration tests |
| TGEN (Test Generation) | 6 | Vitest unit tests for TestGenerator |
| DOC (Documentation) | 6 | Manual review + CI version check |
| INTG (Integration) | 4 | Manual testing + cross-IDE verification |
| TRUST (Enterprise Trust) | 5 | OpenSSF Scorecard + CI checks |
| **Total** | **31** | |

---

## Self-Assessment

| Criterion | Status |
|-----------|--------|
| All requirements use EARS notation? | Yes — Ubiquitous, Event-driven, State-driven, Optional |
| All requirements are testable? | Yes — each has concrete acceptance criteria |
| All requirements trace to Constitution success criteria? | Yes — SC-001 through SC-010 |
| No vague terms (should, might, could)? | Yes — all use "shall" |
| Positive framing (capabilities, not restrictions)? | Yes |
