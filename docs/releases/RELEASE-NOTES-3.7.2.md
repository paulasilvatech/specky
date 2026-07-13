# Specky 3.7.2 — Platform-native primitives

> Copy-paste body for the GitHub Release `v3.7.2`.

Specky now installs different agent and prompt frontmatter for GitHub Copilot and Claude Code instead of copying one shared syntax into both environments.

## Highlights

### GitHub Copilot-native installs

`specky install --ide=copilot` now writes `.github/agents/*.agent.md` and `.github/prompts/*.prompt.md` using VS Code and GitHub Copilot customization syntax:

- Agent tools use `search`, `agent`, `edit`, `fetch`, and namespaced MCP tool ids such as `specky/sdd_get_status`.
- Prompt files use `agent: agent` frontmatter so they run with agent-mode tool access.
- Claude-only tool names such as `Read`, `Glob`, `Grep`, `Task`, and `mcp__specky__*` are not emitted into `.github/` assets.

### Claude Code-native installs

`specky install --ide=claude` transforms the same source assets into Claude Code syntax:

- Agent tools use `Read`, `Glob`, `Grep`, `Task`, and `mcp__specky__sdd_*`.
- Slash commands omit Copilot-only `agent:` metadata.
- Claude rules use `paths: ['**']` instead of Copilot's `applyTo` frontmatter.

### Regression coverage

The build now audits the `.apm` primitive source for Copilot-native tool ids, prompt `agent:` frontmatter, skill name/folder matches, and nonexistent `sdd_*` references. A dedicated asset-copier regression test verifies both install targets produce platform-correct primitive files.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

For project-local installs:

```bash
npm install --save-dev specky-sdd@latest
npx specky upgrade
```

Full details: [CHANGELOG.md](../../CHANGELOG.md)
