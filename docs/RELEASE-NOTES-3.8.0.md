# Specky 3.8.0 — Wave 1 multi-harness APM targets

> Copy-paste body for the GitHub Release `v3.8.0`.

Specky 3.8.0 expands the platform-native primitive compiler with the first wave of additional APM harness targets, introduces a canonical `--target` install selector, and ships a multi-feature phase-advancement fix.

## Highlights

### Wave 1 APM targets: Cursor, OpenCode, Agent Skills

The primitive compiler now emits target-native assets for three additional harnesses alongside the existing Copilot and Claude targets:

- **`cursor`** — installs Cursor rules and writes `.cursor/mcp.json`.
- **`opencode`** — installs OpenCode assets and writes `opencode.json`.
- **`agent-skills`** — installs the shared `.agents/skills` bundle in isolation (no harness-specific config).

Each target has a registered native compiler, install paths, MCP config writer, and regression coverage.

### Canonical `--target` install selector

`specky install --target=<targets>` is now the canonical, APM-aligned way to choose a harness. The legacy `--ide` flag remains as a deprecated alias for backward compatibility.

```bash
specky install --target=copilot      # VS Code + GitHub Copilot
specky install --target=claude       # Claude Code
specky install --target=cursor       # Cursor
specky install --target=opencode     # OpenCode
specky install --target=agent-skills # Shared .agents/skills bundle
```

`specky compile --target=<targets>` compiles instruction primitives into root context files (`.github/copilot-instructions.md`, `CLAUDE.md`, or `AGENTS.md`).

### Doctor and governance updates

`specky doctor` now validates installed `targets[]` metadata instead of assuming Copilot/Claude IDE scopes. The APM manifest and policy use canonical target names and add Cursor/OpenCode target isolation checks. Copilot-inclusive installs strip Claude hooks from `.claude/settings.json` to prevent Copilot hook cross-read blocks.

### Multi-feature phase-advancement fix

Artifact validation during phase advancement now uses the requested feature number instead of always validating `state.features[0]`, fixing incorrect gating in multi-feature workspaces.

## Validation

- `npm run audit` passed.
- `npm run build` passed.
- `npm test` passed.
- `specky apm verify-lock` passed.
- `npm pack --dry-run` includes the APM manifest, lockfile, and policy file.

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

Full details: [CHANGELOG.md](../CHANGELOG.md)
