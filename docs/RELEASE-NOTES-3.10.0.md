# Specky 3.10.0 — Pipeline MCP + Harness Hardening

> Copy-paste body for the GitHub Release `v3.10.0`.

Specky 3.10.0 hardens the MCP pipeline with server-enforced analysis gates, strict phase bookkeeping, and expanded harness doctor/install coverage across all five targets.

## Highlights

### Server-enforced analysis gates

Implement, verify, and release tools now require `gate_decision: APPROVE` once the pipeline reaches Analyze. The check runs centrally in `tool-enforcement.ts` via `validateGateForTool` — not only on `sdd_advance_phase`.

### Phase bookkeeping fixes

- `ensurePhasesThrough` closes orphan phases when write-tools skip `advance_phase`
- `invalidateGateDecision` clears stale approvals after SPEC/DESIGN/TASKS rewrites
- Strict `feature_number` resolution (no silent fallback to `features[0]`)
- Analyze phase completes only on APPROVE

### Pipeline tool improvements

- `discovery_answers` persisted in SPECIFICATION.md
- Real EARS compliance scores; invalid EARS blocked without `force: true`
- `sdd_clarify` starts Clarify without auto-completing it
- Dynamic `pipeline.require_lgtm` config loading

### Harness completeness

- Expanded Cursor instructions; new OpenCode instruction primitive
- VS Code MCP writes both `servers` and `mcpServers`
- Claude/Cursor `MultiEdit` in tool map
- Doctor: Copilot hooks manifest, Claude hooks-in-settings, agent-skills count, improved target inference

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

OpenCode users:

```bash
specky install --target=opencode
specky compile --target=opencode
```

Full details: [CHANGELOG.md](../CHANGELOG.md)
