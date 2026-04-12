---
title: "Specky — Model Routing Guidance — Project Constitution"
feature_id: "003-model-routing-guidance"
project_id: specky-model-routing
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
last_amended: 2026-04-12
amendment_count: 0
---

# Specky — Model Routing Guidance — Project Constitution

> Add empirically-grounded model routing recommendations to every Specky pipeline phase so developers always know which model to use, at what cost, and why — eliminating the single largest source of wasted spend and degraded output quality in AI-native development.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky becomes the first SDD tool that makes model routing a first-class citizen of the specification pipeline. Every phase output tells the developer exactly which model to use next, backed by published empirical evidence — so no developer ever wastes Opus tokens on a docstring or Haiku tokens on a security review.

### 1.2 Mission Statement

Add a `model_routing_hint` field to every Specky tool response. Implement a `ModelRoutingEngine` service that maps pipeline phase, task complexity, file count, and feedback loop type to a concrete model recommendation with rationale. Expose a standalone `sdd_model_routing` tool that returns the full routing decision table for the current project.

### 1.3 Problem Statement

Specky is model-agnostic by design — correct for portability. But this leaves a critical gap: no guidance on which model to use per phase. The empirical cost is documented:

- Reasoning model on iterative implementation tasks: **-30% quality, +43% cost** (arXiv:2502.08235 — 4,018 trajectories)
- Difficulty-aware routing vs uniform strong-model: **+11.21% accuracy at 64% cost** (arXiv:2509.11079)
- Accuracy-optimal vs Pareto-efficient configurations: **4.4–10.8x cost difference** (arXiv:2511.14136, 300 enterprise tasks)

A team of 100 developers routing incorrectly spends approximately 3x more on model costs with worse output quality on implementation tasks.

### 1.4 Success Criteria

- **SC-001:** Every tool response includes a `model_routing_hint` object with `model`, `mode`, `thinking`, and `rationale` fields
- **SC-002:** `sdd_model_routing` tool returns the complete routing decision table with cost ratio analysis
- **SC-003:** `ModelRoutingEngine` service has unit tests covering all 10 Specky pipeline phases
- **SC-004:** `sdd_advance_phase` response includes routing hint for the upcoming phase
- **SC-005:** All recommendations trace to a published arXiv paper or analyst report
- **SC-006:** No breaking changes to existing tool response schemas — additive only
- **SC-007:** Cost savings estimate included in `sdd_model_routing` output for configurable team size

### 1.5 Constraints

| Constraint | Detail |
|------------|--------|
| No breaking changes | `model_routing_hint` is a new optional field on existing responses |
| No new runtime dependencies | ModelRoutingEngine uses only internal data structures |
| Evidence-backed only | Every recommendation traces to a published paper |
| Model-agnostic core | Specky recommends; the developer decides |
| Thin tools, fat services | ModelRoutingEngine is a service; tools are thin wrappers |
| GitHub Copilot models | Opus 4.6, Sonnet 4.6, Haiku 4.5, GPT-4.5 as primary reference |

### 1.6 Out of Scope

- Automatic model switching (Specky recommends; the IDE agent switches)
- Real-time model pricing or availability checking
- Per-user model preference storage
- Fine-tuned or custom model support

---

## Article 2: Naming Conventions

### 2.1 New Tool

| Tool | Description |
|------|-------------|
| `sdd_model_routing` | Returns the full routing decision table, cost ratio, and per-phase recommendations |

### 2.2 New Service

| Service | File |
|---------|------|
| `ModelRoutingEngine` | `src/services/model-routing-engine.ts` |

### 2.3 New Types

| Type | Description |
|------|-------------|
| `ModelRoutingHint` | `{ model, mode, thinking, rationale, evidence_id, premium_multiplier }` |
| `RoutingDecisionTable` | Full table of all phases with recommendations |
| `ComplexitySignal` | `{ file_count, spec_clarity, has_feedback_loop, phase }` |

---

## Article 3: Architecture Principles

### 3.1 Additive Only

`model_routing_hint` is appended to existing tool response objects. No existing field changes. Callers that ignore the new field continue to work unchanged.

### 3.2 Evidence-First

The ModelRoutingEngine contains a static routing table. Every entry has an `evidence_id` field pointing to the arXiv paper that justifies the recommendation. No entry exists without evidence.

### 3.3 Phase as Primary Signal

Pipeline phase is the primary routing signal. Complexity signals (file count, spec clarity, feedback loop presence) are secondary modifiers. The routing table covers all 10 Specky pipeline phases.

### 3.4 Cost Transparency

Every recommendation includes the premium multiplier (3x Opus, 1x Sonnet, 0.33x Haiku). The `sdd_model_routing` tool calculates estimated daily token cost for a configurable team size, making the business case visible to engineering managers.

---

## Article 4: Scope Boundaries

### 4.1 In Scope

- `ModelRoutingEngine` service with static evidence-backed routing table
- `model_routing_hint` field added to all tool responses
- `sdd_model_routing` standalone tool
- Unit tests for ModelRoutingEngine covering all phases
- Cost savings calculation for configurable team size

### 4.2 Out of Scope

- Changes to existing tool input schemas
- Real-time model availability or pricing APIs
- IDE-specific model switching automation

---

## References

- arXiv:2502.08235 — The Danger of Overthinking: Reasoning-Action Dilemma in Agentic Tasks
- arXiv:2509.11079 — Difficulty-Aware Agent Orchestration in LLM-Powered Workflows
- arXiv:2511.14136 — CLEAR Framework: Beyond Accuracy for Enterprise Agentic AI
- arXiv:2509.13758 — Thinking Patterns of Large Reasoning Models in Code Generation
- arXiv:2604.02547 — Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success
- arXiv:2603.05344 — OpenDev: Building AI Coding Agents for the Terminal
