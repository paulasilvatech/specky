---
title: Specky — Specification
feature_id: 001-biome-lint-integration
project_name: specky
version: 1.0.0
author: specky
status: Draft
---

# Specky — Specification

> All requirements use **EARS notation** (Easy Approach to Requirements Syntax). Each requirement is testable, unambiguous, and traceable to the Constitution's success criteria.

---

## Table of Contents

- [1. Core Requirements](#1-core-requirements)
- [2. Functional Requirements](#2-functional-requirements)
- [3. Non-Functional Requirements](#3-non-functional-requirements)
- [Acceptance Criteria Summary](#acceptance-criteria-summary)

---

## Discovery Context

This feature implements the Biome lint integration and coverage improvements identified in the post-audit gap analysis. The work closes three gaps: (1) modules without unit tests, (2) lint warnings from Biome, and (3) absence of dogfooding via `.specs/`.

---

## 1. Core Requirements

### REQ-CORE-001: Add Biome lint configuration

When a developer runs `npm run lint`, the system shall execute Biome check with zero errors and zero warnings.

### REQ-CORE-002: Ratchet coverage thresholds

When the test suite runs with coverage, the system shall enforce thresholds of at least 85% statements, 71% branches, 94% functions, and 86% lines.

### REQ-CORE-003: Create spec package for dogfooding

When a user inspects the repository, the system shall contain a `.specs/` directory with a valid SDD spec package for the biome-lint-integration feature.

---

## 2. Functional Requirements

### REQ-FUNC-001: Test uncovered utility modules

When the test suite runs, the system shall execute unit tests for `slug.ts`, `routing-helper.ts`, and `audit.ts`.

### REQ-FUNC-002: Test transcript and CLI modules

When the test suite runs, the system shall execute unit tests for `transcript.ts` MCP tools and CLI command modules (`serve`, `upgrade`, `hooks`, `apm`).

### REQ-FUNC-003: Fix Biome warnings

When Biome check runs, the system shall report zero warnings for unused imports, unused variables, optional chains, and static-only classes.

---

## 3. Non-Functional Requirements

### REQ-NF-001: Maintain backward compatibility

When Biome fixes are applied, the system shall preserve all existing public APIs and behavior.

### REQ-NF-002: Keep tests deterministic

When tests run in CI, the system shall produce the same results across runs without flaky dependencies.

---

## Acceptance Criteria Summary

| ID | Requirement | Test Method |
|----|-------------|-------------|
| REQ-CORE-001 | Add Biome lint configuration | `npm run lint` exits 0 |
| REQ-CORE-002 | Ratchet coverage thresholds | `npm run test:coverage` exits 0 |
| REQ-CORE-003 | Create spec package for dogfooding | `.specs/` exists with valid artifacts |
| REQ-FUNC-001 | Test uncovered utility modules | `vitest run tests/unit/slug.test.ts tests/unit/routing-helper.test.ts tests/unit/audit-tools.test.ts` |
| REQ-FUNC-002 | Test transcript and CLI modules | `vitest run tests/unit/transcript-tools.test.ts tests/unit/cli-commands.test.ts` |
| REQ-FUNC-003 | Fix Biome warnings | `npx biome check .` reports 0 warnings |
| REQ-NF-001 | Maintain backward compatibility | `npm test` passes without changes to existing tests |
| REQ-NF-002 | Keep tests deterministic | CI passes on repeated runs |

---

## Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| EARS notation compliance | 100% | All requirements follow EARS patterns |
| Testability | 100% | Every requirement has acceptance criteria |
| Traceability | 100% | Every requirement traces to Constitution |
| Uniqueness of IDs | 100% | No duplicate requirement IDs |
