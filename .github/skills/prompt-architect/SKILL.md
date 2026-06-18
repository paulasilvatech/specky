---
name: prompt-architect
description: >
  Design, improve, and validate prompts, prompt files, custom instructions, custom agents, and skill instructions for GitHub Copilot in VS Code, GitHub Copilot CLI, and GitHub Copilot cloud agent. Use when the user asks to write or improve prompts, create prompt files, design agent instructions, tune context usage, choose task routing, structure tool use, or make GitHub Copilot outputs more reliable.
---

# Prompt Architect

Use this skill to turn a vague request into a production-grade GitHub Copilot prompt or agent instruction. The output is always in English unless the user explicitly asks for a different output language.

## Core rules

1. Optimize for GitHub Copilot, VS Code, GitHub Copilot CLI, and GitHub Copilot cloud agent.
2. Write "GitHub Copilot" in full unless naming another official Microsoft product such as Microsoft Copilot or Copilot Studio.
3. Do not fabricate model limits, prices, or benchmarks. Cite sources or mark assumptions.
4. No em dashes. Use commas, colons, semicolons, or parentheses.
5. Prefer clear instructions, scoped context, explicit output format, and verifiable acceptance criteria.

## Workflow

### 1. Understand the prompt target

Identify what the prompt is for:

- Chat prompt in VS Code.
- Reusable prompt file under `.github/prompts/` or a user prompts folder.
- Custom instruction file under `.github/instructions/`.
- Custom agent file under `.github/agents/`.
- Agent Skill under `.github/skills/`.
- GitHub Copilot CLI prompt.

Clarify the user goal, input files, output format, safety constraints, and success criteria. If the prompt controls code changes, include validation commands and stop conditions.

### 2. Choose the right GitHub Copilot customization primitive

Use the lightest primitive that solves the problem:

| Need | Use |
| --- | --- |
| One-off task | Chat prompt |
| Repeatable task with arguments | Prompt file |
| Always-on coding convention | Custom instruction |
| Specialized persona with workflow | Custom agent |
| Reusable capability with references/scripts/assets | Agent Skill |
| External tool integration | MCP server or tool API |

### 3. Structure the prompt

Use sections with explicit boundaries:

- Role and context.
- Task.
- Inputs.
- Constraints.
- Tools or files to use.
- Output format.
- Validation and completion criteria.

XML-style tags can help when prompts contain long context, but Markdown headings are often enough for GitHub Copilot prompt files.

### 4. Manage context deliberately

Include only context that changes the answer. Prefer file references, paths, and exact symbols over pasting entire files. For large tasks, tell GitHub Copilot what to inspect first, what to ignore, and when to ask a question.

For agentic workflows, specify:

- What context to gather first.
- Which actions are safe to take autonomously.
- Which commands validate the result.
- What not to change.
- How to report blockers.

### 5. Make outputs testable

Every production prompt should include a concrete done condition. Examples:

- Run `npm test` and report failures.
- Return a Markdown table with columns A, B, C.
- Create the file under `md/` and include a References section.
- Do not modify audited numbers.

### 6. Review and improve

After drafting, check the prompt against these questions:

- Could GitHub Copilot tell what success looks like?
- Is the output format unambiguous?
- Are constraints specific enough without being brittle?
- Is the prompt reusable without hidden assumptions?
- Does it avoid unsupported tools or platform-specific leakage?

## Reference files

- `references/model-selection.md`: GitHub Copilot task routing and model-selection guidance.
- `references/thinking-config.md`: Reasoning, planning, and context-budget guidance for GitHub Copilot prompts.
- `references/sources.md`: GitHub Copilot and Microsoft documentation sources to use when validating claims.
