# Model Routing Reference

## Cost-Optimized Model Selection

The SDD pipeline routes each phase to the most cost-effective model based on task complexity. This routing is research-backed (arXiv:2502.08235).

## Routing Table

| Phase | Name | Model | Cost | Thinking | Rationale |
|-------|------|-------|------|----------|-----------|
| 0 | Init | claude-haiku-4-5 | 0.33x | No | Pure scaffolding — directory creation, template population |
| 1 | Discover | claude-sonnet-4-6 | 1x | No | Information synthesis, not deep reasoning |
| 2 | Specify | claude-opus-4-6 | 3x | Yes | EARS pattern formulation requires precise reasoning |
| 3 | Clarify | claude-opus-4-6 | 3x | Yes | Deep language understanding for ambiguity detection |
| 4 | Design | claude-opus-4-6 | 3x | Yes | Architecture decisions, trade-off analysis |
| 5 | Tasks | claude-sonnet-4-6 | 1x | No | Dependency sequencing is algorithmic |
| 6 | Analyze | claude-sonnet-4-6 | 1x | No | Cross-artifact analysis, compliance checks |
| 7 | Implement | claude-sonnet-4-6 | 1x | No | Iterative with executable feedback |
| 8 | Verify | claude-opus-4-6 | 3x | Yes | Coverage analysis, drift detection |
| 9 | Release | claude-haiku-4-5 | 0.33x | No | Deterministic, template-based outputs |

## Key Research Finding

**arXiv:2502.08235** found that enabling extended thinking on Phase 7 (implementation):
- Increases cost by +43%
- Degrades output quality by -30%

This is because implementation is iterative with executable feedback (tests, linters, type checkers). The model doesn't need to reason deeply — it needs to generate, test, and iterate quickly.

**Rule:** Only enable thinking for phases that involve ambiguity resolution without executable feedback (Phases 2, 3, 4, 8).

## Escalation Rules

Within a phase, individual subtasks may warrant a different model:

| Condition | Escalation |
|-----------|-----------|
| Task touches >10 files | Escalate to Opus for planning, return to Sonnet for execution |
| >3 service boundaries | Escalate to Opus for interface design |
| Complex architecture decision | Escalate to Opus with thinking enabled |
| Security review finding | Escalate to Opus for threat analysis |

Always return to the phase's default model after the escalated subtask completes.

## Cost Projection

For a typical medium feature (30 requirements, 50 tasks):

| Phase | Calls | Model | Est. Cost |
|-------|-------|-------|-----------|
| 0 Init | 2-3 | Haiku | $0.02 |
| 1 Discover | 5-8 | Sonnet | $0.15 |
| 2 Specify | 3-5 | Opus | $0.45 |
| 3 Clarify | 5-10 | Opus | $0.90 |
| 4 Design | 3-5 | Opus | $0.45 |
| 5 Tasks | 3-5 | Sonnet | $0.10 |
| 6 Analyze | 10-20 | Sonnet | $0.40 |
| 7 Implement | 5-8 | Sonnet | $0.15 |
| 8 Verify | 3-5 | Opus | $0.45 |
| 9 Release | 3-5 | Haiku | $0.02 |
| **Total** | **42-74** | — | **~$3.09** |

Without model routing (all Opus): ~$9.50. Savings: ~67%.
