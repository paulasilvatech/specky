# Specky 3.9.0 — Cursor-native hooks, dedicated phase skills, and doctor parity

> Copy-paste body for the GitHub Release `v3.9.0`.

Specky 3.9.0 brings the Cursor target to full functional parity with Claude and Copilot — native hook automation, a dedicated always-on rule, and six new phase companion skills — and levels up `specky doctor` with per-target install validation. It also fixes cross-target instruction leakage in the Copilot and compile paths.

## Highlights

### Cursor-native hook automation

`specky install --target=cursor` now installs a complete, honest hook stack instead of skipping hooks:

- `.cursor/hooks.json` — Cursor schema v1 manifest generated from the single `.apm/hooks/sdd-hooks.json` source.
- `.cursor/hooks/specky-run.sh` — stdin adapter that maps Cursor hook payloads to the Specky hook scripts (`SDD_TOOL_NAME`, prompt extraction), with graceful `jq`-optional fallback.
- `.cursor/hooks/scripts/` — the same 16 hook scripts used by Claude and Copilot.

Blocking gates (artifact validation, phase gate, security scan, release gate) deny unsafe actions with `failClosed: true`; advisory gates (branch, pipeline guard, LGTM, drift, checkpoint) warn without blocking.

### Six dedicated phase companion skills (14 total)

Each pipeline phase agent now loads a dedicated skill first, with `specky-sdd-pipeline` retained as the shared cross-phase overview:

- `specky-sdd-init` (Phase 0), `specky-spec-engineer` (Phase 2), `specky-sdd-clarify` (Phase 3), `specky-design-architect` (Phase 4), `specky-task-planner` (Phase 5), `specky-quality-reviewer` (Phase 6).

### Dedicated, leak-free instruction rules

- **Cursor** compiles to `.cursor/rules/specky-sdd.mdc` with `alwaysApply` and a neutral title.
- **Claude** compiles to `.claude/rules/specky-sdd.md` with neutral naming — no Copilot title, `@workspace`, or `.vscode` references.
- **Copilot** keeps its reserved `.github/instructions/copilot-instructions.instructions.md`, with the orphaned `Rule #7`/`#8` headings merged into the Key Rules list and the outdated `@workspace /prompt-name` invocation corrected to `/prompt-name`.

### `specky doctor` install parity

`doctor` now runs a full per-target install audit — agent, prompt/command, skill, and hook-script counts, rule format, MCP registration, and a cross-target leakage scan:

| Target | Config checks |
|--------|---------------|
| Cursor | 11 |
| Claude | 10 |
| Copilot | 9 |
| OpenCode | 7 |
| Agent Skills | 2 (skills-only by design) |

### Cross-target isolation fixes

- Copilot installs no longer copy the Cursor/Claude instruction primitives into `.github/instructions/`; only the Copilot instruction is installed and stale primitives are removed.
- `specky compile` is now target-aware — each target renders only its own instruction primitive (Copilot as the neutral fallback) instead of concatenating every primitive into each root context file.
- Claude installs no longer receive the Copilot-named rule or `@workspace`/`applyTo` leakage.

### Unified EARS notation

The rule, phase agents, and the `specky-sdd-pipeline` skill now use the canonical six EARS patterns: Ubiquitous, Event-driven, State-driven, Optional, Unwanted, and Complex.

## Validation

- `npm run build` passed.
- `npm test` passed.
- `specky apm validate`, `specky apm policy`, and `specky apm verify-lock` passed.
- Smoke installs for all five targets (`cursor`, `copilot`, `claude`, `opencode`, `agent-skills`) pass their `specky doctor` checks with no cross-target leakage.

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

Cursor users gain native hooks on upgrade; enable the `specky` MCP server in Cursor Settings → MCP, then run `specky doctor` to confirm the install.

Full details: [CHANGELOG.md](../../CHANGELOG.md)
