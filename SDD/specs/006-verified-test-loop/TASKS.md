---
title: "Specky — Verified Test Loop — Tasks"
feature_id: "006-verified-test-loop"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
task_count: 10
parallel_tasks: 3
phases: 3
---

# Specky — Verified Test Loop — Tasks

---
**Model:** `claude-sonnet-4-6`
**Chat mode:** Agent mode
**Extended thinking:** No
**Rationale:** Implementation from approved spec with clear scope and test feedback loop.

---

## Pre-Implementation Gates

- [ ] **Gate 1:** CONSTITUTION.md approved
- [ ] **Gate 2:** SPECIFICATION.md reviewed — 9 requirements
- [ ] **Gate 3:** Depends on 002-enterprise-ready Phase 2 (sdd_generate_tests exists)
- [ ] **Gate 4:** Test runner fixtures (Vitest JSON, pytest JSON, JUnit XML) prepared

---

## Phase 1: TestResultParser Service

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-001 | Create `src/services/test-result-parser.ts` — parses Vitest JSON, pytest JSON, JUnit XML into `TestResult[]` | | M | Gate 4 | REQ-EXEC-001, REQ-EXEC-002 |
| T-002 | Create `src/services/test-traceability-mapper.ts` — reads test files, extracts `// REQ-` comments, maps test names to req IDs | | M | T-001 | REQ-MAP-001 |
| T-003 | Create `src/services/__tests__/test-result-parser.test.ts` — 3 fixture format tests + edge cases | [P] | M | T-001 | REQ-QUALITY-001 |
| T-004 | Create `src/services/__tests__/test-traceability-mapper.test.ts` | [P] | S | T-002 | REQ-QUALITY-002 |

**Phase 1 total: 4 tasks (2 parallel), Effort: ~4h**

---

## Phase 2: sdd_verify_tests Enhancement

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-005 | Update `sdd_verify_tests` tool — add MCP test runner invocation with 120s timeout | | M | T-001 | REQ-EXEC-001 |
| T-006 | Add CLI fallback in `sdd_verify_tests` — shell execution with framework detection | | M | T-005 | REQ-EXEC-002 |
| T-007 | Add coverage report computation — per-requirement status + overall percent | | M | T-002 | REQ-MAP-002 |
| T-008 | Add failure reporting — error_snippet + suggested_fix_prompt generation | [P] | M | T-007 | REQ-REPORT-001 |

**Phase 2 total: 4 tasks (1 parallel), Effort: ~5h**

---

## Phase 3: Quality

| ID | Task | [P] | Effort | Depends | Traces To |
|----|------|-----|--------|---------|-----------|
| T-009 | Integration test: generate stubs → run → verify coverage report populated | | M | T-008 | REQ-MAP-002 |
| T-010 | Update CLAUDE.md with enhanced sdd_verify_tests documentation | [P] | S | T-008 | — |

**Phase 3 total: 2 tasks (1 parallel), Effort: ~2h**

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Phase 1: Parser + Mapper | 4 | 2 | ~4h |
| Phase 2: Tool Enhancement | 4 | 1 | ~5h |
| Phase 3: Quality | 2 | 1 | ~2h |
| **Total** | **10** | **3** | **~11h** |
