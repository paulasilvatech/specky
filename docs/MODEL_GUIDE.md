# Model Routing & Fallbacks

> Specky routes each pipeline phase to the model best suited for the task.
> Primary recommendations use Anthropic's flagship reasoning model (Opus 4.7),
> but every phase has a fallback chain so teams without Opus access can still
> run the full pipeline.

---

## Primary model matrix (recommended)

| Phase | Agent | Model | Why |
|---|---|---|---|
| 0 Init | `sdd-init` | **claude-haiku-4-5** | Scaffolding. No ambiguity. |
| 1 Discover | `research-analyst` | **claude-sonnet-4-6** | Structured research questions. |
| 2 Specify | `spec-engineer`, `requirements-engineer` | **claude-opus-4-7** | EARS requirements, high ambiguity. |
| 3 Clarify | `sdd-clarify` | **claude-opus-4-7** | Resolves implicit constraints. |
| 4 Design | `design-architect` | **claude-opus-4-7** | Multi-file architectural judgment. |
| 5 Tasks | `task-planner` | **claude-sonnet-4-6** | Decomposition from approved spec. |
| 6 Analyze | `quality-reviewer` | **claude-opus-4-7** | Gate decisions (APPROVE/CONDITIONAL/REJECT). |
| 7 Implement | `implementer` | **claude-sonnet-4-6** | Iterative coding; extended thinking is harmful here. |
| 8 Verify | `test-verifier` | **claude-opus-4-7** | REQ-ID coverage + phantom-completion detection. |
| 9 Release | `release-engineer` | **claude-haiku-4-5** | Mechanical doc/PR generation. |

**Also:** `specky-orchestrator` uses **claude-sonnet-4-6** as its permanent coordination model (balanced; orchestrates the phase agents above).

---

## What if I don't have Opus 4.7 access?

Opus 4.7 requires a Claude Max, Team, or Enterprise plan. If you're on Pro or
free tier, substitute with the next entry in the relevant **fallback chain**:

### Reasoning-heavy (Specify / Clarify / Design / Analyze / Verify)

```
claude-opus-4-7           ← primary (best quality)
    ↓
claude-opus-4-6           ← previous gen Opus (if 4.7 unavailable)
    ↓
claude-sonnet-4-6         ← strong alternative; loses ~15% quality on ambiguous specs
    ↓
gpt-5                     ← cross-provider (OpenAI); different failure modes
    ↓
gpt-4.5                   ← last resort
```

### Balanced (Discover / Tasks)

```
claude-sonnet-4-6   →   claude-opus-4-6   →   gpt-5   →   gpt-4.5
```

### Fast (Init / Release)

```
claude-haiku-4-5   →   claude-sonnet-4-6   →   gpt-4.5
```

### Coding (Implement)

```
claude-sonnet-4-6   →   codex   →   gpt-5   →   claude-opus-4-6
```

> **Note on `codex`:** OpenAI's code-specialized model. Strong at code
> generation but weaker at spec-to-code traceability; only recommended
> when Sonnet 4.6 is unavailable.

---

## How to switch models

### Claude Code

Each agent's `model:` frontmatter is already set to the primary. If you
don't have access, edit the frontmatter:

```markdown
---
name: spec-engineer
model: claude-sonnet-4-6   # was claude-opus-4-7 — downgraded
model_fallback: [...]
---
```

Or set `ANTHROPIC_MODEL` env var globally to force a different default.

### GitHub Copilot (VS Code)

Copilot Chat uses the model configured in VS Code settings
(`github.copilot.chat.model`). Set it to your highest-available tier.
The agent's `model:` hint is advisory — Copilot will use whatever
the user has selected in the UI.

### Programmatic / CI

The `sdd_model_routing` MCP tool returns the `ModelRoutingHint` for any
phase including the full `fallback_chain`. Your CI can consume this to
pick the best available model given your API key's entitlements.

```json
{
  "phase": "specify",
  "model": "claude-opus-4-7",
  "fallback_chain": [
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "gpt-5",
    "gpt-4.5"
  ],
  "mode": "ask",
  "thinking": true,
  "rationale": "Specify has high ambiguity...",
  "premium_multiplier": "3x"
}
```

---

## Cost implications

Default matrix splits roughly:

| Tier | Phases | Weight | Cost |
|---|---|---|---|
| Opus 4.7 (3x multiplier) | 2, 3, 4, 6, 8 | ~50% of pipeline turns | highest |
| Sonnet 4.6 (1x) | 1, 5, 7 + orchestrator | ~35% | baseline |
| Haiku 4.5 (0.33x) | 0, 9 | ~15% | lowest |

**Running the same pipeline entirely on Opus 4.7** costs ~2.4x the optimized matrix.
**Running entirely on Sonnet 4.6** costs ~0.85x but loses an estimated 15–25%
of gate-decision quality on ambiguous specs — research suggests this shows up
as phantom approvals and missed requirement traceability.

`sdd_model_routing` includes a `calculateCostSavings()` helper that
estimates the savings for your team size.

---

## When extended thinking is a win — and when it's a trap

| Phase | `thinking: true`? | Why |
|---|---|---|
| Specify, Clarify, Design, Analyze, Verify | ✅ yes | High ambiguity, no executable feedback loop |
| Tasks | ❌ no | Spec already approved; decomposition is structured |
| Implement | ❌ no | Tests provide feedback; extended thinking adds ~43% cost for ~30% quality loss (arXiv:2502.08235) |
| Init, Discover, Release | ❌ no | Mechanical tasks |

Don't enable thinking by default — the routing engine turns it on only where
research shows it helps.

---

## References

- arXiv:2502.08235 — extended thinking productivity paradox
- arXiv:2505.09027 — structured decomposition without thinking
- arXiv:2509.11079 — gate decision reasoning
- arXiv:2509.13758 — ambiguity resolution
- arXiv:2509.16941 — multi-file architectural judgment
- arXiv:2603.05344 — cost-optimized routing
- arXiv:2604.02547 — traceability verification
