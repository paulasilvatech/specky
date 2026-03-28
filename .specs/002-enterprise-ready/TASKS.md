# Specky v3.0 — Enterprise-Ready Implementation Plan

**Feature:** 002-enterprise-ready
**Goal:** Transform Specky from a functional MCP server into an enterprise-grade platform with tests, documentation, and trust signals.
**Total Tasks:** 56 | **Phases:** 5 | **Estimated Effort:** ~12 days

---

## Dependency Graph

```
Phase 1 (Testing) ──┬──→ Phase 2 (Test Gen)
                    ├──→ Phase 3 (Docs)
                    └──→ Phase 4 (Polish)
                              │
Phase 2 + 3 + 4 ─────────→ Phase 5 (Enterprise)
```

---

## Phase 1: Testing Foundation (P0)

**Goal:** Specky tests itself before testing specs for others. Coverage > 80% on services.

| ID | Task | Effort | Depends | Status |
|----|------|--------|---------|--------|
| T-001 | Install Vitest + `@vitest/coverage-v8` as devDependencies | S | — | not-started |
| T-002 | Create `vitest.config.ts` — ESM, coverage thresholds (80%), include `src/services/**` | S | T-001 | not-started |
| T-003 | Add scripts to package.json: `test`, `test:watch`, `test:coverage` | S | T-001 | not-started |
| T-004 | **EarsValidator tests** — 6 valid EARS patterns + 6 invalid + edge cases (empty, whitespace, unicode) | M | T-002 | not-started |
| T-005 | **StateMachine tests** — valid transitions (10 phases), skip blocking, `.sdd-state.json` persistence, reset | M | T-002 | not-started |
| T-006 | **ComplianceEngine tests** — each framework: HIPAA (6 controls), SOC2 (6), GDPR (5), PCI-DSS (6), ISO27001 (6), General (4) with fixture specs | L | T-002 | not-started |
| T-007 | **TemplateEngine tests** — render 21 templates, placeholder substitution, missing placeholder handling | M | T-002 | not-started |
| T-008 | **FileManager tests** — path traversal attack prevention (`../../etc/passwd`), write/read/exists, atomic ops | M | T-002 | not-started |
| T-009 | **CodebaseScanner tests** — tech stack detection with fixture projects (Node, Python, .NET, Java) | M | T-002 | not-started |
| T-010 | **TranscriptParser tests** — VTT, SRT, MD, TXT parsing with real fixture files | M | T-002 | not-started |
| T-011 | **MCP integration test** — handshake → `sdd_init` → verify files → `sdd_advance_phase` → verify state | L | T-004..T-010 | not-started |
| T-012 | **Pipeline E2E test** — init → discover → specify → clarify → design → tasks → analyze (7 phases) | L | T-011 | not-started |
| T-013 | Update `ci.yml` — add `npm test`, coverage report, fail if < 80% | S | T-003 | not-started |
| T-014 | Add coverage badge to README.md | S | T-013 | not-started |
| T-015 | Sync CLAUDE.md version (v2.0.0 → v2.1.0) with package.json | S | — | not-started |

**Deliverables:** `npm test` passes, coverage > 80% on services, CI green with tests.

---

## Phase 2: Test Generation Pipeline (P1)

**Goal:** Specky generates tests for user projects — the competitive differentiator.

| ID | Task | Effort | Depends | Status |
|----|------|--------|---------|--------|
| T-020 | Create `src/services/test-generator.ts` — reads SPECIFICATION.md + TASKS.md, generates test stubs | L | Phase 1 | not-started |
| T-021 | Create `src/schemas/testing.ts` — Zod schemas for test generation tools | S | T-020 | not-started |
| T-022 | Create template `templates/test-stub.md` — template for generated test files | S | — | not-started |
| T-023 | **Tool `sdd_generate_tests`** — generates test stubs from acceptance criteria. Params: `framework` (vitest/jest/playwright/pytest/junit/xunit), `spec_dir`, `output_dir` | L | T-020, T-021 | not-started |
| T-024 | Playwright support — when `sdd_scan_codebase` detects frontend, generate E2E tests with Playwright. Each user story → test scenario with `data-testid` selectors | L | T-023 | not-started |
| T-025 | API testing support — when backend detected (Express/FastAPI/.NET), generate contract tests with Supertest/pytest/xUnit based on API contracts from DESIGN.md | L | T-023 | not-started |
| T-026 | **Tool `sdd_verify_tests`** (optional) — reads test results JSON, compares with acceptance criteria, reports requirement coverage | M | T-023 | not-started |
| T-027 | Playwright MCP recommendation — when `sdd_generate_tests` produces Playwright tests, include `recommended_servers` with Playwright MCP for auto-execution | S | T-024 | not-started |
| T-028 | Register tools in `src/tools/testing.ts` following thin tools pattern | M | T-023..T-026 | not-started |
| T-029 | Unit tests for `test-generator.ts` | M | T-020 | not-started |
| T-030 | Update CLAUDE.md with new testing tools | S | T-028 | not-started |

**Deliverables:** `sdd_generate_tests` generates traceable stubs for 6 frameworks. Playwright E2E optional.

---

## Phase 3: Documentation & Onboarding (P1)

**Goal:** Impeccable first impression. Enterprise trusts professional documentation.

| ID | Task | Effort | Depends | Status |
|----|------|--------|---------|--------|
| T-040 | Record GIF/video (30s) — real flow in VS Code: prompt → spec → design → tasks | M | Phase 1 | not-started |
| T-041 | README.md — add GIF at top, "5-Minute Quickstart" section with literal copy-paste `mcp.json` | M | T-040 | not-started |
| T-042 | README.md — add badges: build, coverage, npm downloads, Docker pulls, OpenSSF Scorecard | S | T-014 | not-started |
| T-043 | README.md — "Enterprise" section with compliance frameworks, audit trail, security posture | M | — | not-started |
| T-044 | Create `SECURITY.md` — vulnerability disclosure, OWASP controls (path sanitization, Zod validation, no eval), dependency audit | M | — | not-started |
| T-045 | Create `CHANGELOG.md` — retroactive v1.0.0 → v2.0.0 → v2.1.0 in Conventional Commits format | M | — | not-started |
| T-046 | Update GETTING-STARTED.md — add Testing section (Phase 2 tools), Ecosystem Check section | S | Phase 2 | not-started |
| T-047 | Update CONTRIBUTING.md — add "Running Tests", "Adding a New Tool" with checklist | S | Phase 1 | not-started |
| T-048 | Auto-generated API Reference — script reads all tools and generates table with inputs/outputs/annotations | L | — | not-started |
| T-049 | Create `docs/integration-cookbook.md` — practical recipes for GitHub + Azure DevOps + Jira + Terraform + Figma + Docker | L | — | not-started |
| T-050 | Create `docs/enterprise-deployment.md` — Docker, HTTP mode, CI/CD, multi-team setup, audit trail | L | — | not-started |

**Deliverables:** README with GIF + badges, SECURITY.md, CHANGELOG.md, Integration Cookbook.

---

## Phase 4: Integration Polish (P2)

**Goal:** Zero friction in user experience. No warnings, no confusion.

| ID | Task | Effort | Depends | Status |
|----|------|--------|---------|--------|
| T-060 | Unify agents — move rich content from `agents/` to `.github/agents/`, remove `agents/` from root | M | — | not-started |
| T-061 | Update CLAUDE.md section 12 to reference only `.github/agents/` | S | T-060 | not-started |
| T-062 | Improve `sdd_check_ecosystem` — detect which MCP servers are active vs just installed | M | — | not-started |
| T-063 | Generate sample `.vscode/mcp.json` with snippet for each recommended MCP server | S | T-062 | not-started |
| T-064 | Clean internal analysis sub-repo — move to separate repo or delete internal `.git` | S | — | not-started |
| T-065 | Update workspace `.vscode/mcp.json` — use `npx specky-sdd` instead of `node dist/index.js` | S | — | not-started |
| T-066 | Customizable templates — if `.specky/templates/` exists in user project, use instead of built-in | M | — | not-started |
| T-067 | `sdd_import_document` — integrate with MarkItDown MCP when available (detect via ecosystem) | M | — | not-started |
| T-068 | Test in Cursor, Windsurf, Gemini — verify MCP protocol works in other IDEs | L | Phase 1 | not-started |

**Deliverables:** Clean experience, zero warnings, unified agents, improved ecosystem detection.

---

## Phase 5: Enterprise Trust Signals (P2-P3)

**Goal:** Signals that enterprise procurement requires for adoption approval.

| ID | Task | Effort | Depends | Status |
|----|------|--------|---------|--------|
| T-080 | OpenSSF Scorecard — configure and achieve >= 7/10 (branch protection, signed commits, CI, SECURITY.md, license) | M | T-044, T-013 | not-started |
| T-081 | npm provenance — enable `--provenance` on publish for signed packages | S | — | not-started |
| T-082 | Docker image signing — cosign for `ghcr.io/paulasilvatech/specky` | M | — | not-started |
| T-083 | SBOM — generate Software Bill of Materials per release (CycloneDX or SPDX) | M | — | not-started |
| T-084 | Audit trail — each tool logs `{ tool, timestamp, user, result, spec_dir }` to `.specs/NNN/.audit.jsonl` | L | — | not-started |
| T-085 | Metrics dashboard — `sdd_metrics` generates local HTML with: time per phase, requirements/spec, compliance score, requirement test coverage | L | Phase 2 | not-started |
| T-086 | Config file `.specky/config.yml` — customize: templates path, default framework, compliance frameworks, audit on/off | M | T-066 | not-started |
| T-087 | Dependabot + CodeQL — enable on repo for automated security scanning | S | — | not-started |
| T-088 | Create GitHub Issue templates — bug report, feature request, spec-related issue | S | — | not-started |
| T-089 | npm publish v3.0.0 with all improvements | S | Phase 1..4 | not-started |

**Deliverables:** OpenSSF badge, signed artifacts, audit trail, SBOM, config file.

---

## Summary

| Phase | Tasks | Effort | Priority | Parallel? |
|-------|-------|--------|----------|-----------|
| 1 — Testing Foundation | 15 | ~3 days | P0 | — |
| 2 — Test Generation Pipeline | 11 | ~3 days | P1 | After Phase 1 |
| 3 — Documentation & Onboarding | 11 | ~2 days | P1 | After Phase 1 |
| 4 — Integration Polish | 9 | ~2 days | P2 | After Phase 1 |
| 5 — Enterprise Trust Signals | 10 | ~2 days | P2-P3 | After Phases 2+3+4 |
| **Total** | **56** | **~12 days** | | |
