---
title: Specky — Tasks
feature_id: 001-biome-lint-integration
project_name: specky
version: 1.0.0
author: specky
status: Draft
---

# Specky — Tasks

> Sequenced implementation tasks with pre-implementation gates, `[P]` parallel markers, effort estimates, and requirement traceability.

---

## Pre-Implementation Gates

Before writing any code, the following gates must pass:

- [ ] **Gate 1:** Constitution approved (Article 2: Principles)
- [ ] **Gate 2:** Specification reviewed (EARS compliance)

---

## Task Breakdown

| ID | Task | [P] | Effort | Depends On | Traces To |
|----|------|-----|--------|------------|-----------|
| T-001 | Add Biome dependency and configuration | | M | — | REQ-CORE-001 |
| T-002 | Add npm scripts for lint/format | | S | T-001 | REQ-CORE-001 |
| T-003 | Write tests for slug, routing-helper, audit | | M | — | REQ-FUNC-001 |
| T-004 | Write tests for transcript MCP tools | | L | — | REQ-FUNC-002 |
| T-005 | Write tests for CLI commands | | L | — | REQ-FUNC-002 |
| T-006 | Write tests for vscode-settings-writer and agent-skills | | M | — | REQ-FUNC-002 |
| T-007 | Fix Biome warnings (unused imports, variables, optional chains) | | M | T-001 | REQ-FUNC-003 |
| T-008 | Ratchet coverage thresholds | | S | T-003, T-004, T-005, T-006 | REQ-CORE-002 |
| T-009 | Create .specs/ spec package for dogfooding | | M | — | REQ-CORE-003 |
| T-010 | Validate full build, tests, lint, coverage | | S | T-001..T-009 | REQ-NF-001, REQ-NF-002 |

---

## Dependency Graph

```
T-001: Add Biome dependency and configuration -> []
T-002: Add npm scripts for lint/format -> [T-001]
T-003: Write tests for slug, routing-helper, audit -> []
T-004: Write tests for transcript MCP tools -> []
T-005: Write tests for CLI commands -> []
T-006: Write tests for vscode-settings-writer and agent-skills -> []
T-007: Fix Biome warnings -> [T-001]
T-008: Ratchet coverage thresholds -> [T-003, T-004, T-005, T-006]
T-009: Create .specs/ spec package -> []
T-010: Validate full build, tests, lint, coverage -> [T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009]
```

---

## Effort Summary

| Phase | Tasks | Parallel | Effort |
|-------|-------|----------|--------|
| Setup | T-001, T-002 | No | M + S |
| Tests | T-003, T-004, T-005, T-006 | Yes | M + L + L + M |
| Fixes | T-007, T-008 | No | M + S |
| Dogfooding | T-009 | No | M |
| Validation | T-010 | No | S |
| **Total** | **10** | **4** | **10 tasks** |
