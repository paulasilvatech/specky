---
title: "Specky — Context Tiering — Project Constitution"
feature_id: "004-context-tiering"
project_id: specky-context-tiering
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
last_amended: 2026-04-12
amendment_count: 0
---

# Specky — Context Tiering — Project Constitution

> Implement a Hot/Domain/Cold context loading architecture in Specky so that token cost scales with actual usage, not with workspace size — eliminating unnecessary token overhead for large teams.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky serves enterprise teams of 100+ developers without multiplying token costs by the number of spec files in the workspace. Context is loaded only when it is relevant to the current phase and feature — not universally on every MCP call.

### 1.2 Mission Statement

Implement three-tier context loading (Hot/Domain/Cold) based on arXiv:2602.20478, where CONSTITUTION.md is always loaded (Hot), active feature SPECIFICATION.md and DESIGN.md are loaded per feature (Domain), and RESEARCH.md and ANALYSIS.md are loaded only when explicitly needed (Cold). Expose a `sdd_context_status` tool showing which tier each file belongs to and its current load status.

### 1.3 Problem Statement

The Specky MCP server currently loads CONSTITUTION.md context on every tool call. For a team of 1,000 developers making 10 requests/day with a 2,000-token constitution, this consumes 20M input tokens/day before a single line of code is written. The Tokenomics paper (arXiv:2601.14470) shows code review alone consumes 59.42% of all agent tokens in agentic systems. Universal context loading compounds this.

### 1.4 Success Criteria

- **SC-001:** CONSTITUTION.md (Hot) is loaded on every tool call — behavior unchanged
- **SC-002:** SPECIFICATION.md and DESIGN.md (Domain) are loaded only when the active feature matches the tool's `spec_dir`
- **SC-003:** RESEARCH.md, ANALYSIS.md, CHECKLIST.md (Cold) are loaded only when explicitly referenced by the tool
- **SC-004:** `sdd_context_status` tool reports tier assignment and load count for all spec files
- **SC-005:** Token load reduction of at least 40% vs current universal loading for a 3-feature workspace
- **SC-006:** No functional regression — all tools return equivalent results for single-feature workspaces
- **SC-007:** Context tiering is transparent — developers see which tier loaded in `sdd_get_status` output

### 1.5 Constraints

| Constraint | Detail |
|------------|--------|
| No breaking changes | All tools maintain current behavior; tiering is an optimization |
| Backward compatible | Single-feature workspaces behave identically to current behavior |
| FileManager owns I/O | Tiering logic lives in a new ContextTieringEngine; FileManager does the actual reads |
| No in-memory caching | Files are read from disk per-call; no process-level cache (MCP server is stateless per-call) |

### 1.6 Out of Scope

- Cross-session memory (session state is already in .sdd-state.json)
- Token counting or billing integration
- Automatic tier reassignment based on usage patterns

---

## Article 2: Tier Definitions

| Tier | Files | Load Frequency | Rationale |
|------|-------|----------------|-----------|
| **Hot** | CONSTITUTION.md | Every call | Project principles needed for every decision |
| **Domain** | SPECIFICATION.md, DESIGN.md, TASKS.md | Per active feature | Needed for feature-scoped tools |
| **Cold** | RESEARCH.md, ANALYSIS.md, CHECKLIST.md, VERIFICATION.md, CROSS_ANALYSIS.md, COMPLIANCE.md | On-demand | Reference documents — needed rarely |

---

## Article 3: Architecture Principles

### 3.1 Phase-Aware Loading

Domain context is only loaded when the tool's `spec_dir` matches the active feature in `.sdd-state.json`. Tools that operate across all features (e.g., `sdd_cross_analyze`) load Domain context for all active features.

### 3.2 Cold Files on Explicit Request

Cold files are loaded only when the tool explicitly requests them (e.g., `sdd_run_analysis` needs ANALYSIS.md, `sdd_compliance_check` needs COMPLIANCE.md). They are never pre-loaded.

### 3.3 Transparent Accounting

Every tool response includes a `context_load_summary` field showing which tier was loaded, how many tokens each tier consumed (estimated), and how much was saved vs universal loading.

---

## References

- arXiv:2602.20478 — Vasilopoulos 2026 — Codified Context Infrastructure: Hot/Domain/Cold tiers
- arXiv:2601.14470 — Tokenomics in Agentic Systems
- arXiv:2603.29919 — SkillReducer: Token Cost Analysis of Agent Skills
