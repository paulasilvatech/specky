# GitHub Copilot model and task routing

Use this reference to decide how much capability and context a GitHub Copilot prompt or agent needs. Do not fabricate model limits, prices, or benchmarks. Verify current model availability in GitHub Copilot documentation or the user's tenant before naming a specific model as mandatory.

## Routing principles

| Task class | Recommended approach |
| --- | --- |
| Simple extraction, summaries, or formatting | Keep the prompt short, specify output shape, and avoid unnecessary tool use. |
| Standard coding and refactoring | Provide target files, acceptance criteria, and validation commands. |
| Architecture, migration, security, or high-risk changes | Use a custom agent or detailed prompt with explicit discovery, constraints, and verification. |
| Research or sourced writing | Require sources, references, caveats, and a final validation pass. |
| Batch or repeatable workflow | Create a prompt file, skill, or MCP-backed tool instead of repeating chat instructions. |

## Model selection guidance

GitHub Copilot model availability varies by plan, policy, IDE surface, and date. When the user asks which model to use:

1. Check the model picker or the tenant policy if available.
2. Prefer the default GitHub Copilot model for routine coding unless the task needs deeper reasoning.
3. Use a stronger reasoning model for architecture, security review, migration planning, and multi-file refactors.
4. Use lower-cost or faster options for classification, formatting, and short summaries when available.
5. State assumptions if the current environment does not expose model options.

## Output recommendation format

When recommending a model, include:

- Task class.
- Required context.
- Risk level.
- Recommended GitHub Copilot surface, such as chat, agent mode, prompt file, custom agent, or skill.
- Validation command or review gate.

## Sources

- GitHub Copilot documentation: https://docs.github.com/en/copilot
- VS Code GitHub Copilot documentation: https://code.visualstudio.com/docs/copilot/overview
