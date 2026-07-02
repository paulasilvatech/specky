# v3.4.0 — stable

First stable **3.4.0**, superseding the `3.4.0-rc.*` prereleases. Consolidates the
audit-remediation work. Full report: [`docs/AUDIT-2026-07.md`](docs/AUDIT-2026-07.md).

**Install:** `npm i -g specky-sdd@latest`

## Engine correctness
- **Repaired the happy path** — feature identity is resolved from the pipeline state, not re-derived from the display name, so `sdd_advance_phase` no longer stalls on a "missing SPECIFICATION.md" when the feature name differs from the project name.
- **Removed the fabricated quality gate** — `sdd_auto_pipeline` no longer hard-codes `APPROVE`/100%; a shared `AnalysisEngine` computes the real decision (used by `sdd_run_analysis` too).
- **EARS v2** — reachable `complex` pattern, de-duplicated suggestions, word-boundary vague-term detection, multi-`shall` flagging, and a ReDoS bound.
- **State integrity** — a per-spec-dir async mutex serializes concurrent load→mutate→save cycles and writes `state`/`.sig` atomically.

## Security
- **HTTP** binds `127.0.0.1` by default, with optional bearer-token auth (`SDD_HTTP_TOKEN`, constant-time) and DNS-rebinding protection.
- **Least-privilege installer** — pre-authorized allow-list reduced 37 → 11 (no arbitrary shell / `rm` / network); `.mcp.json` pinned to the installed version.
- **Traversal guards** on `spec_dir`/`templates_path`; config parsed with `yaml` + Zod.

## Quality & docs
- Coverage measured over the whole `src/**` tree (honest ~24% baseline); ratcheted thresholds; CI also runs on `develop`.
- Real Dockerfile; `docs/API_REFERENCE.md` generated from the live tool registry with a CI drift check.
- Corrected public counts/phases/lineage (58 tools, real phase names, 6 EARS patterns, no "507 tests").
- `examples/todo-api/` — a real pipeline run reaching an **APPROVE** gate — plus a `specky-verify` GitHub Action.
- A single `tool-result` helper replaces 16× `formatError` + 18× `truncate`.

---
Full changelog: [`CHANGELOG.md`](CHANGELOG.md)
