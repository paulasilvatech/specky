---
title: "Specky v3.0 Enterprise-Ready — Project Constitution"
project_id: specky-enterprise-ready
version: 1.0.0
date: 2026-03-21
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
last_amended: 2026-03-21
amendment_count: 0
---

# Specky v3.0 Enterprise-Ready — Project Constitution

> **Transform Specky from a functional MCP server into an enterprise-grade platform** with automated testing, test generation for user projects, professional documentation, and trust signals that enterprise procurement requires.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky becomes the industry standard for Spec-Driven Development by earning enterprise trust through automated quality assurance, professional documentation, and supply chain security — while adding test generation as a competitive differentiator that no other MCP-based spec tool offers.

### 1.2 Mission Statement

Add a comprehensive testing layer (both internal and user-facing), improve documentation for zero-friction onboarding, polish integrations for a clean VS Code experience, and implement enterprise trust signals (OpenSSF, SBOM, audit trail) that satisfy procurement and compliance teams.

### 1.3 Success Criteria

- **SC-001:** `npm test` passes with > 80% coverage on all 14 services
- **SC-002:** CI pipeline includes tests, coverage, lint, and security audit — all green
- **SC-003:** New tool `sdd_generate_tests` produces traceable test stubs for 6 frameworks (Vitest, Jest, Playwright, pytest, JUnit, xUnit)
- **SC-004:** README includes demo GIF, coverage badge, and "5-Minute Quickstart"
- **SC-005:** SECURITY.md, CHANGELOG.md, and Integration Cookbook exist
- **SC-006:** `.github/agents/` is the single source for Copilot agents — zero VS Code Problems
- **SC-007:** OpenSSF Scorecard >= 7/10
- **SC-008:** npm publishes with `--provenance` (signed packages)
- **SC-009:** CLAUDE.md version matches package.json version
- **SC-010:** Specky works in Cursor, Windsurf, and Gemini (not just VS Code and Claude)

### 1.4 Constraints

- **No breaking changes** — all existing 43 tools maintain backward compatibility
- **No new runtime dependencies** — test tools are devDependencies only
- **All specs in English** — consistent with existing convention
- **Thin tools, fat services** — new tools follow the same architectural pattern
- **FileManager owns all I/O** — test generator delegates to FileManager

### 1.5 Out of Scope

- Paid features or license changes (Specky remains MIT)
- GUI dashboard (metrics are JSON/HTML generated locally)
- Real-time collaboration features
- Language-specific code generation (Specky generates test stubs, not implementations)

---

## Article 2: Stakeholders

| Stakeholder | Interest | Success Metric |
|-------------|----------|----------------|
| Individual developers | Zero-config spec workflow | SC-004, SC-010 |
| Enterprise dev teams | Compliance, audit, trust | SC-005, SC-007, SC-008 |
| Engineering managers | Quality gates, traceability | SC-001, SC-002, SC-003 |
| DevOps/Platform teams | CI integration, IaC, containers | SC-002, SC-007 |
| Open-source contributors | Clear docs, easy setup | SC-004, SC-005, SC-009 |

---

## Article 3: Architecture Principles

### 3.1 Test What Matters

Focus test coverage on services with business logic (EarsValidator, StateMachine, ComplianceEngine, FileManager). Tools are thin wrappers — test them via integration tests, not unit tests.

### 3.2 Dogfood Everything

Use Specky's own SDD pipeline to specify, design, and track this feature. The `.specs/002-enterprise-ready/` directory is the living proof.

### 3.3 Progressive Enhancement

Each phase delivers standalone value. Phase 1 (tests) works without Phase 2 (test generation). Phase 3 (docs) works without Phase 4 (polish). No phase blocks another except where explicitly marked.

### 3.4 Enterprise Trust Through Transparency

Every trust signal must be verifiable. Badges link to real dashboards. SBOM is machine-readable. Audit trail is JSON Lines. No "security theatre."

---

## Article 4: Delivery Phases

| Phase | Name | Priority | Depends On |
|-------|------|----------|------------|
| 1 | Testing Foundation | P0 | — |
| 2 | Test Generation Pipeline | P1 | Phase 1 |
| 3 | Documentation & Onboarding | P1 | Phase 1 |
| 4 | Integration Polish | P2 | Phase 1 |
| 5 | Enterprise Trust Signals | P2-P3 | Phases 2+3+4 |

---

## Article 5: Amendments

This Constitution may be amended by the maintainer. Each amendment increments `amendment_count` in the frontmatter and adds a dated entry below.

_No amendments yet._
