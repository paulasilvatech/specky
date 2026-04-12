---
title: "Specky — Model Routing Guidance — Specification"
feature_id: "003-model-routing-guidance"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
ears_notation: true
requirement_count: 18
categories: [ROUTING, ENGINE, TOOL, QUALITY]
---

# Specky — Model Routing Guidance — Specification

> All requirements use EARS notation. Every requirement is testable, unambiguous, and traces to a published empirical source.

---

## 1. Routing Response Field (REQ-ROUTING)

### REQ-ROUTING-001: Model Routing Hint on All Responses (Ubiquitous)

Every Specky tool response shall include a `model_routing_hint` object containing `model`, `mode`, `thinking`, `rationale`, `evidence_id`, and `premium_multiplier` fields.

**Acceptance Criteria:**
- All 53 existing tools return `model_routing_hint` as a top-level field in the response JSON
- Field is present even when the tool call succeeds with no errors
- Field is additive — existing response fields are unchanged
- `model` is one of: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-4-5`
- `mode` is one of: `ask`, `plan`, `agent`
- `thinking` is boolean
- `rationale` is a non-empty string, max 150 characters
- `evidence_id` is a valid arXiv ID (format: `arXiv:NNNN.NNNNN`)
- `premium_multiplier` is one of: `3x`, `1x`, `0.33x`

**Traces to:** SC-001, SC-006
**Evidence:** arXiv:2509.11079 (difficulty-aware routing: +11.21% accuracy at 64% cost)

---

### REQ-ROUTING-002: Phase-Specific Routing on sdd_advance_phase (Event-driven)

When `sdd_advance_phase` is called and the transition succeeds, the system shall include a `next_phase_routing` field with the routing hint for the phase the developer is entering, not the phase they are leaving.

**Acceptance Criteria:**
- `next_phase_routing` field is present in every successful `sdd_advance_phase` response
- The hint reflects the destination phase, not the source phase
- Transitioning to Specify returns Opus 4.6 + extended thinking = true
- Transitioning to Implement returns Sonnet 4.6 + extended thinking = false
- Transitioning to Verify returns Sonnet 4.6 + extended thinking = false

**Traces to:** SC-001, SC-004
**Evidence:** arXiv:2502.08235 (overthinking on iterative tasks: -30% quality)

---

### REQ-ROUTING-003: Cost Savings Display on sdd_get_status (Event-driven)

When `sdd_get_status` is called, the system shall include a `routing_savings` section estimating daily premium token cost for the current phase under correct routing vs uniform Opus routing, for a default team of 10 developers.

**Acceptance Criteria:**
- `routing_savings.correct_routing_units` is a positive integer
- `routing_savings.opus_only_units` is a positive integer greater than `correct_routing_units`
- `routing_savings.savings_percent` is between 0 and 100
- `routing_savings.team_size` reflects the configured or default team size (10)
- Calculation uses: Opus=3x, Sonnet=1x, Haiku=0.33x premium multipliers

**Traces to:** SC-007
**Evidence:** arXiv:2511.14136 (accuracy-optimal configs cost 4.4–10.8x more than Pareto-efficient)

---

## 2. ModelRoutingEngine Service (REQ-ENGINE)

### REQ-ENGINE-001: Static Routing Table (Ubiquitous)

The `ModelRoutingEngine` service shall contain a static routing table mapping each of the 10 Specky pipeline phases to a default `ModelRoutingHint`.

**Acceptance Criteria:**
- Table covers all 10 phases: Init, Discover, Specify, Clarify, Design, Tasks, Analyze, Implement, Verify, Release
- Each entry has: `model`, `mode`, `thinking`, `rationale`, `evidence_id`, `premium_multiplier`
- Init → Haiku 4.5, ask, false (structured task, no ambiguity)
- Discover → Sonnet 4.6, ask, false (structured questions, clear output)
- Specify → Opus 4.6, ask, true (high ambiguity, no executable feedback)
- Clarify → Opus 4.6, ask, true (resolving contradictions, implicit constraints)
- Design → Opus 4.6, plan, true (multi-file reasoning, architectural judgment)
- Tasks → Sonnet 4.6, plan, false (structured decomposition from approved spec)
- Analyze → Sonnet 4.6, ask, false (structured cross-artifact check)
- Implement → Sonnet 4.6, agent, false (iterative feedback loop, overthinking harmful)
- Verify → Sonnet 4.6, ask, false (structured verification, clear criteria)
- Release → Haiku 4.5, ask, false (commit messages, PR descriptions, changelogs)

**Traces to:** SC-001, SC-003, SC-005
**Evidence:** arXiv:2502.08235, arXiv:2509.13758, arXiv:2603.05344

---

### REQ-ENGINE-002: Complexity Signal Override (State-driven)

While `sdd_write_design` or `sdd_implement` detects more than 10 files in scope via codebase scan, the `ModelRoutingEngine` shall escalate the model recommendation from Sonnet 4.6 to Opus 4.6.

**Acceptance Criteria:**
- `file_count > 10` triggers model escalation for Design and Implement phases
- Escalation changes `model` from `claude-sonnet-4-6` to `claude-opus-4-6`
- Escalation changes `premium_multiplier` from `1x` to `3x`
- `rationale` reflects the escalation reason: "Multi-file semantic complexity exceeds Sonnet threshold"
- `evidence_id` updates to `arXiv:2509.16941` (SWE-Bench Pro: frontier models maintain performance at 10+ files)

**Traces to:** SC-001, SC-003
**Evidence:** arXiv:2509.16941 (SWE-Bench Pro: gap between models widens beyond 3 files)

---

### REQ-ENGINE-003: Feedback Loop Detection (State-driven)

While the current phase is Implement and a test suite is detected in the codebase, the `ModelRoutingEngine` shall explicitly flag extended thinking as harmful and set `thinking: false` with a warning rationale.

**Acceptance Criteria:**
- `thinking: false` is always set for Implement phase regardless of file count
- `rationale` includes the word "harmful" when phase is Implement
- `evidence_id` references arXiv:2502.08235 for Implement phase
- No Implement-phase hint ever sets `thinking: true`

**Traces to:** SC-001, SC-003, SC-005
**Evidence:** arXiv:2502.08235 (Analysis Paralysis, Rogue Actions, Premature Disengagement patterns)

---

### REQ-ENGINE-004: LLM-over-Framework Note (Ubiquitous)

The `ModelRoutingEngine` shall append a `framework_note` field to responses from `sdd_model_routing` stating that model choice is first-order and framework choice is second-order.

**Acceptance Criteria:**
- `framework_note` is present in every `sdd_model_routing` response
- Text reads: "LLM choice drives outcome more than framework choice. Agents sharing the same LLM agree on 73% more tasks than agents sharing the same framework."
- `framework_note_evidence` references arXiv:2604.02547

**Traces to:** SC-002, SC-005
**Evidence:** arXiv:2604.02547 (9,374 trajectories: LLM is primary driver of outcome)

---

## 3. sdd_model_routing Tool (REQ-TOOL)

### REQ-TOOL-001: Full Routing Decision Table (Ubiquitous)

The `sdd_model_routing` tool shall return the complete routing decision table covering all 10 pipeline phases in a structured JSON response.

**Acceptance Criteria:**
- Response includes `routing_table` array with one entry per phase
- Each entry includes: `phase`, `model`, `mode`, `thinking`, `rationale`, `evidence_id`, `premium_multiplier`
- Response includes `cost_analysis` section with correct vs Opus-only comparison
- Response includes `framework_note` field
- Response includes `team_size` (default 10, configurable via input parameter)

**Traces to:** SC-002, SC-007

---

### REQ-TOOL-002: Team Size Configuration (Optional)

If the caller provides a `team_size` parameter to `sdd_model_routing`, the system shall use that value in the cost savings calculation instead of the default of 10.

**Acceptance Criteria:**
- `team_size` parameter is optional, integer, minimum 1, maximum 10000
- If omitted, defaults to 10
- Cost calculation uses: `team_size × requests_per_day × multiplier`
- `requests_per_day` defaults to 10 (configurable in `.specky/config.yml`)
- Output clearly labels which team_size was used

**Traces to:** SC-007

---

### REQ-TOOL-003: Mermaid Routing Diagram (Ubiquitous)

The `sdd_model_routing` tool shall include a Mermaid diagram visualizing the routing decision flow across all 10 phases with model labels and thinking indicators.

**Acceptance Criteria:**
- `diagram` field contains valid Mermaid flowchart syntax
- Diagram shows all 10 phases as nodes
- Nodes are color-coded by model tier (Opus=red, Sonnet=blue, Haiku=grey)
- Extended thinking phases show a lightning bolt indicator in the node label
- Diagram renders correctly in VS Code Markdown preview

**Traces to:** SC-002

---

## 4. Quality and Testing (REQ-QUALITY)

### REQ-QUALITY-001: Unit Tests for ModelRoutingEngine (Ubiquitous)

The test suite shall verify that `ModelRoutingEngine` returns the correct recommendation for every pipeline phase under default conditions.

**Acceptance Criteria:**
- 10 tests covering each pipeline phase default recommendation
- 3 tests covering complexity signal overrides (file_count > 10)
- 2 tests covering Implement phase never sets thinking: true
- 1 test verifying all 53 tool responses include model_routing_hint
- All tests pass with zero failures

**Traces to:** SC-003

---

### REQ-QUALITY-002: Evidence ID Validation (Ubiquitous)

The test suite shall verify that every routing table entry has a valid arXiv ID that follows the format `arXiv:NNNN.NNNNN`.

**Acceptance Criteria:**
- Regex test validates all `evidence_id` fields in the static routing table
- Test fails if any entry has an empty, null, or malformed evidence_id
- At least 5 distinct arXiv IDs are referenced across the routing table

**Traces to:** SC-005

---

### REQ-QUALITY-003: No Breaking Changes (Ubiquitous)

The test suite shall verify that all existing tool response schemas remain valid after adding `model_routing_hint`.

**Acceptance Criteria:**
- Existing Zod output schemas pass validation with the new field present
- Existing Zod output schemas pass validation with the new field absent (backward compat)
- No existing test fails after this feature is merged

**Traces to:** SC-006

---

## Acceptance Criteria Summary

| Category | Requirements | Tested By |
|----------|-------------|-----------|
| ROUTING (Response field) | 3 | Unit + integration tests |
| ENGINE (ModelRoutingEngine) | 4 | Unit tests |
| TOOL (sdd_model_routing) | 3 | Unit + manual |
| QUALITY (Testing) | 3 | Automated CI |
| **Total** | **13** | |
