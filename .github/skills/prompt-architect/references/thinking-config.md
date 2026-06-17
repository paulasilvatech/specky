# Reasoning and context guidance for GitHub Copilot prompts

GitHub Copilot does not need a special "thinking mode" instruction to be useful. What matters is clear scope, relevant context, and verifiable output.

## Prompt effort levels

| Effort | Use when | Prompt pattern |
| --- | --- | --- |
| Low | Simple edits, formatting, short explanations | State task and output format. |
| Medium | Normal coding tasks and documentation | Add relevant files, constraints, and validation. |
| High | Architecture, migration, security, multi-file changes | Add discovery steps, decision criteria, validation gates, and stop conditions. |

## Context budget

- Put the most important instructions first.
- Prefer file paths, symbols, and exact constraints over long pasted context.
- Tell GitHub Copilot what to inspect before editing.
- Tell GitHub Copilot what to ignore, especially generated files and unrelated directories.
- For long tasks, ask for a brief plan before edits only when architectural choices matter.

## Agentic prompt pattern

A reliable GitHub Copilot agent prompt includes:

1. Role and objective.
2. Relevant files or folders.
3. Constraints and non-goals.
4. Steps to discover context.
5. Editing rules.
6. Validation commands.
7. Completion criteria.

## Anti-patterns

- Asking for broad changes without defining validation.
- Pasting huge context without saying what matters.
- Mixing implementation, research, and deliverable generation in one vague prompt.
- Asking GitHub Copilot to invent metrics, prices, or customer data.
