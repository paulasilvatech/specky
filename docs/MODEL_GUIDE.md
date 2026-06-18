# Model Guidance

Specky recommends model capability classes instead of hardcoding concrete model IDs in agents or prompts. This keeps Specky portable across GitHub Copilot environments where available models can vary by plan, organization policy, IDE surface, and date.

## Core Policy

- Do not put `model` or `model_fallback` keys in Specky agent frontmatter.
- Let the user choose any model available in their GitHub Copilot environment.
- Use capability classes when giving guidance: fast, balanced, reasoning-focused.
- Avoid unsourced model limits, pricing, quality, or benchmark claims.
- Validate high-risk outputs with deterministic tools, tests, and human review gates.

## Capability Classes

| Class | Use When | Typical Work |
| --- | --- | --- |
| Fast | The task is deterministic, small, or mostly formatting/scaffolding | Init, release notes, simple summaries, fixed templates |
| Balanced | The task needs normal coding or moderate synthesis with feedback loops | Discovery, task planning, implementation, analysis |
| Reasoning-focused | The task is ambiguous, architectural, security-sensitive, or requires deep traceability reasoning | Specification, clarification, design, verification |

## SDD Phase Recommendations

| Phase | Name | Recommended Class | Rationale |
| --- | --- | --- | --- |
| 0 | Init | Fast | Project setup and scaffolding have low ambiguity |
| 1 | Discover | Balanced | Requires context synthesis and user-facing questions |
| 2 | Specify | Reasoning-focused | EARS requirements and acceptance criteria require precision |
| 3 | Clarify | Reasoning-focused | Ambiguity reduction and trade-off discovery require careful reasoning |
| 4 | Design | Reasoning-focused | Architecture decisions need traceability and trade-off analysis |
| 5 | Tasks | Balanced | Work breakdown is structured and benefits from clear constraints |
| 6 | Analyze | Balanced | Cross-artifact checks are evidence-driven and tool-assisted |
| 7 | Implement | Balanced | Code generation should iterate with build, tests, and lint feedback |
| 8 | Verify | Reasoning-focused | Coverage, drift, and phantom-completion review require deeper reasoning |
| 9 | Release | Fast | Release packaging and documentation assembly should be deterministic |

## Escalation Rules

Use a stronger class temporarily when any of these conditions are true:

| Condition | Recommended Escalation |
| --- | --- |
| More than 10 files are affected | Use reasoning-focused model for planning, then balanced model for edits |
| More than 3 service boundaries are affected | Use reasoning-focused model for interface and risk analysis |
| Security or compliance findings are involved | Use reasoning-focused model and require evidence in the output |
| The model output misses traceability requirements | Escalate for the review pass and rerun deterministic validators |

## Validation Over Model Choice

Specky does not rely on model choice alone for quality. Every important step should have evidence:

- `npm run build`
- `npm test`
- `npm run test:coverage`
- `npm audit --audit-level=high`
- `node scripts/audit-agent-frontmatter.mjs`
- `sdd_run_analysis`
- `sdd_verify_audit`
- `sdd_verify_tests`
- `sdd_verify_tasks`

## GitHub Copilot Usage Notes

Use the model picker or organization policy to choose the concrete model available to you. Specky agents and prompts provide task context, tool access, and validation requirements. They do not force a specific model.

## References

- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot prompt engineering](https://docs.github.com/en/copilot/using-github-copilot/prompt-engineering-for-github-copilot)
- [VS Code GitHub Copilot overview](https://code.visualstudio.com/docs/copilot/overview)
- [VS Code custom instructions](https://code.visualstudio.com/docs/copilot/copilot-customization)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
