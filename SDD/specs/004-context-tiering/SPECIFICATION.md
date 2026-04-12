---
title: "Specky — Context Tiering — Specification"
feature_id: "004-context-tiering"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
ears_notation: true
requirement_count: 10
categories: [TIER, ENGINE, TOOL, QUALITY]
---

# Specky — Context Tiering — Specification

---

## 1. Tier Assignment (REQ-TIER)

### REQ-TIER-001: Hot Tier Always Loaded (Ubiquitous)

The system shall load CONSTITUTION.md on every tool call regardless of phase or feature.

**Acceptance Criteria:**
- CONSTITUTION.md is present in every tool's context payload
- Tier assignment is static and not configurable at runtime
- Hot tier behavior is identical to current behavior

**Traces to:** SC-001 | **Evidence:** arXiv:2602.20478

---

### REQ-TIER-002: Domain Tier Loaded Per Active Feature (State-driven)

While a tool operates on a specific `spec_dir`, the system shall load SPECIFICATION.md, DESIGN.md, and TASKS.md for that feature only.

**Acceptance Criteria:**
- Domain files are loaded when `spec_dir` is provided and matches active feature
- Domain files are NOT loaded for tools that do not receive a `spec_dir` parameter
- Multiple spec_dirs in `sdd_cross_analyze` load Domain tier for each

**Traces to:** SC-002 | **Evidence:** arXiv:2602.20478

---

### REQ-TIER-003: Cold Tier Loaded On-Demand Only (Optional)

If a tool explicitly requires a Cold file (RESEARCH.md, ANALYSIS.md, CHECKLIST.md, VERIFICATION.md, CROSS_ANALYSIS.md, COMPLIANCE.md), the system shall load only that specific file.

**Acceptance Criteria:**
- `sdd_run_analysis` loads ANALYSIS.md (Cold) + SPECIFICATION.md (Domain)
- `sdd_compliance_check` loads COMPLIANCE.md (Cold) only
- No Cold file is loaded unless the tool's implementation explicitly requests it
- `sdd_get_status` loads Hot only — zero Domain or Cold files

**Traces to:** SC-003 | **Evidence:** arXiv:2603.29919

---

### REQ-TIER-004: Context Load Summary in Every Response (Ubiquitous)

Every tool response shall include a `context_load_summary` field showing which tiers were loaded and estimated token count.

**Acceptance Criteria:**
- `context_load_summary.hot_loaded: boolean`
- `context_load_summary.domain_files: string[]` (filenames loaded)
- `context_load_summary.cold_files: string[]` (filenames loaded)
- `context_load_summary.estimated_tokens: number`
- `context_load_summary.vs_universal_tokens: number` (what universal loading would cost)
- `context_load_summary.savings_percent: number`

**Traces to:** SC-007 | **Evidence:** arXiv:2601.14470

---

## 2. ContextTieringEngine Service (REQ-ENGINE)

### REQ-ENGINE-001: Tier Assignment Table (Ubiquitous)

The `ContextTieringEngine` service shall maintain a static assignment of all spec artifact filenames to Hot, Domain, or Cold tiers.

**Acceptance Criteria:**
- Table covers: CONSTITUTION.md (Hot), SPECIFICATION.md/DESIGN.md/TASKS.md (Domain), all others (Cold)
- Assignment is not overridable at runtime
- New artifact types default to Cold unless explicitly promoted

**Traces to:** SC-001, SC-002, SC-003

---

### REQ-ENGINE-002: Token Estimation (Ubiquitous)

The `ContextTieringEngine` shall estimate token count for loaded files using a 4-characters-per-token approximation.

**Acceptance Criteria:**
- `estimateTokens(content: string): number` uses `Math.ceil(content.length / 4)`
- Estimation is used only for reporting — not for truncation decisions
- Universal loading estimate assumes all files in the spec_dir are loaded

**Traces to:** SC-005, SC-007

---

## 3. sdd_context_status Tool (REQ-TOOL)

### REQ-TOOL-001: Context Status Report (Ubiquitous)

The `sdd_context_status` tool shall return the tier assignment and current load status for all files in the active spec directory.

**Acceptance Criteria:**
- Response lists every file in `.specs/` with tier assignment
- Includes `total_hot_tokens`, `total_domain_tokens`, `total_cold_tokens` estimates
- Includes `universal_would_load_tokens` comparison
- Includes `savings_percent` for current session

**Traces to:** SC-004, SC-007

---

## 4. Quality (REQ-QUALITY)

### REQ-QUALITY-001: Unit Tests for ContextTieringEngine (Ubiquitous)

The test suite shall verify correct tier assignment for all 10 artifact types.

**Acceptance Criteria:**
- 10 tests: one per artifact type verifying correct tier assignment
- 3 tests: token estimation for small, medium, large files
- 2 tests: context_load_summary fields present and accurate

**Traces to:** SC-006

---

### REQ-QUALITY-002: Regression — Single Feature Workspace (Ubiquitous)

The test suite shall verify that all tools return functionally equivalent results in a single-feature workspace under context tiering vs universal loading.

**Acceptance Criteria:**
- End-to-end test runs full pipeline (init→release) with context tiering enabled
- All artifacts created correctly
- No tool returns an error due to missing context

**Traces to:** SC-006
