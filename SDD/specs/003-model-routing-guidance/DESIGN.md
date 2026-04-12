---
title: "Specky — Model Routing Guidance — Design"
feature_id: "003-model-routing-guidance"
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
---

# Specky — Model Routing Guidance — Design

---

## 1. Architecture Overview

This feature adds a `ModelRoutingEngine` service and one new tool (`sdd_model_routing`) without modifying any existing tool input schemas. The routing hint is injected into all tool responses as an additive field.

```
┌─────────────────────────────────────────────────────────────┐
│                    Specky MCP Server                          │
│                                                              │
│  ┌─── Existing Tool Layer (53 tools) ─────────────────────┐ │
│  │  Each tool calls ModelRoutingEngine.getHint(phase)      │ │
│  │  and appends model_routing_hint to its response         │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: sdd_model_routing Tool ────────────────────────┐ │
│  │  Returns full RoutingDecisionTable + cost analysis      │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: ModelRoutingEngine Service ────────────────────┐ │
│  │  ROUTING_TABLE: static Map<Phase, ModelRoutingHint>    │ │
│  │  getHint(phase, signals?) → ModelRoutingHint            │ │
│  │  getTable() → RoutingDecisionTable                      │ │
│  │  calculateCostSavings(teamSize) → CostAnalysis          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── Existing Service Layer (unchanged) ─────────────────┐ │
│  │  FileManager │ StateMachine │ EarsValidator │ ...        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. New Files

| File | Type | Purpose |
|------|------|---------|
| `src/services/model-routing-engine.ts` | Service | Static routing table + hint generation |
| `src/schemas/routing.ts` | Schema | Zod schemas for sdd_model_routing input/output |
| `src/tools/routing.ts` | Tool | Thin wrapper for sdd_model_routing |
| `src/services/__tests__/model-routing-engine.test.ts` | Tests | Unit tests for all phases and overrides |

---

## 3. ModelRoutingEngine Interface

```typescript
// src/services/model-routing-engine.ts

export type ModelTier = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'gpt-4-5';
export type ChatMode = 'ask' | 'plan' | 'agent';
export type PremiumMultiplier = '3x' | '1x' | '0.33x';

export interface ModelRoutingHint {
  model: ModelTier;
  mode: ChatMode;
  thinking: boolean;
  rationale: string;
  evidence_id: string;
  premium_multiplier: PremiumMultiplier;
}

export interface ComplexitySignal {
  file_count?: number;       // from sdd_scan_codebase
  spec_clarity?: 'clear' | 'ambiguous';
  has_feedback_loop?: boolean; // test suite detected
}

export interface CostAnalysis {
  team_size: number;
  requests_per_day: number;
  correct_routing_units: number;
  opus_only_units: number;
  savings_percent: number;
  savings_label: string;
}

export class ModelRoutingEngine {
  private static readonly ROUTING_TABLE: Record<string, ModelRoutingHint> = {
    init: {
      model: 'claude-haiku-4-5',
      mode: 'ask',
      thinking: false,
      rationale: 'Init is structured with no ambiguity — Haiku is optimal.',
      evidence_id: 'arXiv:2603.05344',
      premium_multiplier: '0.33x',
    },
    discover: {
      model: 'claude-sonnet-4-6',
      mode: 'ask',
      thinking: false,
      rationale: 'Discovery questions are structured; reasoning depth adds no value.',
      evidence_id: 'arXiv:2505.09027',
      premium_multiplier: '1x',
    },
    specify: {
      model: 'claude-opus-4-6',
      mode: 'ask',
      thinking: true,
      rationale: 'Specify has high ambiguity and no executable feedback — extended thinking justified.',
      evidence_id: 'arXiv:2502.08235',
      premium_multiplier: '3x',
    },
    clarify: {
      model: 'claude-opus-4-6',
      mode: 'ask',
      thinking: true,
      rationale: 'Clarify resolves implicit constraints and contradictions — reasoning depth critical.',
      evidence_id: 'arXiv:2509.13758',
      premium_multiplier: '3x',
    },
    design: {
      model: 'claude-opus-4-6',
      mode: 'plan',
      thinking: true,
      rationale: 'Design requires architectural judgment across multiple files.',
      evidence_id: 'arXiv:2509.16941',
      premium_multiplier: '3x',
    },
    tasks: {
      model: 'claude-sonnet-4-6',
      mode: 'plan',
      thinking: false,
      rationale: 'Task decomposition from approved spec is structured — Sonnet sufficient.',
      evidence_id: 'arXiv:2505.09027',
      premium_multiplier: '1x',
    },
    analyze: {
      model: 'claude-sonnet-4-6',
      mode: 'ask',
      thinking: false,
      rationale: 'Cross-artifact analysis follows deterministic rules — no reasoning overhead needed.',
      evidence_id: 'arXiv:2509.11079',
      premium_multiplier: '1x',
    },
    implement: {
      model: 'claude-sonnet-4-6',
      mode: 'agent',
      thinking: false,
      rationale: 'Implementation is iterative with test feedback — extended thinking actively harmful.',
      evidence_id: 'arXiv:2502.08235',
      premium_multiplier: '1x',
    },
    verify: {
      model: 'claude-sonnet-4-6',
      mode: 'ask',
      thinking: false,
      rationale: 'Verification checks against clear criteria — structured task, Sonnet optimal.',
      evidence_id: 'arXiv:2604.02547',
      premium_multiplier: '1x',
    },
    release: {
      model: 'claude-haiku-4-5',
      mode: 'ask',
      thinking: false,
      rationale: 'Release artifacts (commit messages, PR descriptions, changelogs) need no reasoning depth.',
      evidence_id: 'arXiv:2603.05344',
      premium_multiplier: '0.33x',
    },
  };

  getHint(phase: string, signals?: ComplexitySignal): ModelRoutingHint {
    const base = ModelRoutingEngine.ROUTING_TABLE[phase] ?? ModelRoutingEngine.ROUTING_TABLE['implement'];
    if (!signals) return base;

    // Complexity override: >10 files escalates to Opus for design/implement
    if (signals.file_count && signals.file_count > 10 &&
        (phase === 'design' || phase === 'implement')) {
      return {
        ...base,
        model: 'claude-opus-4-6',
        premium_multiplier: '3x',
        rationale: `Multi-file semantic complexity (${signals.file_count} files) exceeds Sonnet threshold — escalating to Opus.`,
        evidence_id: 'arXiv:2509.16941',
      };
    }
    return base;
  }

  getTable(): ModelRoutingHint[] {
    return Object.entries(ModelRoutingEngine.ROUTING_TABLE).map(([phase, hint]) => ({
      phase,
      ...hint,
    } as any));
  }

  calculateCostSavings(teamSize: number, requestsPerDay = 10): CostAnalysis {
    // Weighted average of correct routing: ~60% Sonnet, 30% Opus, 10% Haiku
    const correctUnits = Math.round(
      teamSize * requestsPerDay * (0.6 * 1 + 0.3 * 3 + 0.1 * 0.33)
    );
    const opusOnlyUnits = teamSize * requestsPerDay * 3;
    const savingsPct = Math.round((1 - correctUnits / opusOnlyUnits) * 100);

    return {
      team_size: teamSize,
      requests_per_day: requestsPerDay,
      correct_routing_units: correctUnits,
      opus_only_units: opusOnlyUnits,
      savings_percent: savingsPct,
      savings_label: `Correct routing saves ~${savingsPct}% of premium spend vs Opus-for-everything.`,
    };
  }
}
```

---

## 4. Response Injection Pattern

Every existing tool handler appends the hint at the end of its return object:

```typescript
// Pattern applied to all 53 tools
import { ModelRoutingEngine } from '../services/model-routing-engine.js';

const routingEngine = new ModelRoutingEngine();

// Inside any tool handler, at the end of the return statement:
return {
  content: [{ type: 'text', text: JSON.stringify({
    // ...existing response fields...
    model_routing_hint: routingEngine.getHint(currentPhase, complexitySignals),
  }, null, 2) }],
};
```

The `currentPhase` is read from `.sdd-state.json` via `StateMachine.loadState()`. The `complexitySignals` are optional and only populated in tools that have codebase scan context.

---

## 5. sdd_model_routing Tool Response Shape

```json
{
  "routing_table": [
    {
      "phase": "specify",
      "model": "claude-opus-4-6",
      "mode": "ask",
      "thinking": true,
      "rationale": "Specify has high ambiguity and no executable feedback.",
      "evidence_id": "arXiv:2502.08235",
      "premium_multiplier": "3x"
    }
  ],
  "cost_analysis": {
    "team_size": 10,
    "requests_per_day": 10,
    "correct_routing_units": 183,
    "opus_only_units": 300,
    "savings_percent": 39,
    "savings_label": "Correct routing saves ~39% of premium spend vs Opus-for-everything."
  },
  "framework_note": "LLM choice drives outcome more than framework choice. Agents sharing the same LLM agree on 73% more tasks than agents sharing the same framework.",
  "framework_note_evidence": "arXiv:2604.02547",
  "diagram": "flowchart TD\n  Init[Init\nHaiku 4.5\n0.33x] --> Discover[...]\n  ..."
}
```

---

## 6. Mermaid Diagram Template

```
flowchart TD
  Init["Init\n🐢 Haiku 4.5 · 0.33x"]
  Discover["Discover\n⚡ Sonnet 4.6 · 1x"]
  Specify["Specify\n🧠 Opus 4.6 · 3x\n[extended thinking ON]"]
  Clarify["Clarify\n🧠 Opus 4.6 · 3x\n[extended thinking ON]"]
  Design["Design\n🧠 Opus 4.6 · 3x\n[extended thinking ON]"]
  Tasks["Tasks\n⚡ Sonnet 4.6 · 1x"]
  Analyze["Analyze\n⚡ Sonnet 4.6 · 1x"]
  Implement["Implement\n⚡ Sonnet 4.6 · 1x\n[thinking = HARMFUL here]"]
  Verify["Verify\n⚡ Sonnet 4.6 · 1x"]
  Release["Release\n🐢 Haiku 4.5 · 0.33x"]

  Init --> Discover --> Specify --> Clarify --> Design
  Design --> Tasks --> Analyze --> Implement --> Verify --> Release

  style Specify fill:#f25022,color:#fff
  style Clarify fill:#f25022,color:#fff
  style Design fill:#f25022,color:#fff
  style Init fill:#888780,color:#fff
  style Release fill:#888780,color:#fff
```

---

## 7. ADR-001: Static Table vs Dynamic Inference

**Decision:** Use a static routing table with evidence IDs, not dynamic LLM inference.

**Rationale:** Dynamic inference would add latency, cost, and non-determinism to every tool call. The routing table encodes peer-reviewed findings that do not change between calls. A static table is auditable, testable, and zero-overhead.

**Consequences:** Table must be updated manually when new papers supersede existing recommendations. Version the table alongside the package.json version.
