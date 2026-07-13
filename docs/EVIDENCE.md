# Evidence Pack

This document tracks evidence that Specky works as claimed. It should be updated in the same pull request as implementation, validation, release, branch, or documentation changes.

## Evidence Principles

- Record command inputs and summarized outputs.
- Do not invent metrics or results.
- Link claims to source files, generated artifacts, or trusted documentation.
- Keep security-sensitive data out of evidence logs.
- Treat failed checks as useful evidence and record remediation.

## Current Branch Reset Evidence

Date: 2026-06-17

Repository: `paulasilvatech/specky`

### Preflight Findings

| Check | Result |
| --- | --- |
| Current local branch before reset | `develop` |
| Old `develop` divergence from `main` | 32 commits behind, 1 commit ahead |
| `origin/main` SHA | `4225130af2780f44bc3a3825e5db275879f6b111` |
| npm `latest` dist-tag | `3.4.0-rc.14` |
| npm `next` dist-tag | `3.4.0-rc.15` |
| Open PRs before cleanup | 13 Dependabot PRs |
| Open PRs after cleanup | 0 |
| GitHub push security notice | 17 vulnerabilities on default branch, reported by GitHub during push |

### Branch Reset Result

Remote branches after cleanup:

```text
develop 4225130af2780f44bc3a3825e5db275879f6b111
main    4225130af2780f44bc3a3825e5db275879f6b111
```

Local branches after cleanup:

```text
develop 4225130af2780f44bc3a3825e5db275879f6b111
main    4225130af2780f44bc3a3825e5db275879f6b111
```

Comparison after cleanup:

```text
origin/main...origin/develop: 0 0
```

Dirty local `develop` state was preserved in stash before branch reset:

```text
stash@{0}: On develop: specky-pre-branch-reset-develop-dirty-20260617T205947Z
```

## Implementation Evidence Matrix

| Area | Evidence Required | Status |
| --- | --- | --- |
| Build | `npm run build` output | Passed on 2026-06-17 |
| Unit and integration tests | `npm test` output | Passed on 2026-06-17: 16 files, 111 tests |
| Coverage | `npm run test:coverage` and thresholds | Passed on 2026-06-17: statements 56.14%, branches 43.82%, functions 67.91%, lines 57.89% |
| Dependency audit | `npm audit --audit-level=high` | Passed on 2026-06-17; 1 low severity advisory remains |
| MCP handshake | JSON-RPC initialize response includes Specky server metadata | Passed on 2026-06-17 |
| Fresh install | `npm pack` plus fresh workspace `npx specky install`, `doctor`, `status` | Passed on 2026-06-17 |
| RBAC enforcement | Viewer/contributor/admin integration tests | In progress; viewer allow/deny verified through MCP |
| Audit chain | Hash-chain generated and verification detects tampering | In progress; global tool execution writes audit entries and `sdd_verify_audit` verifies chain integrity |
| Determinism | Same input and fixed clock generate identical artifacts | In progress; fixed clock tested for frontmatter, docs, and test stubs |
| Filesystem boundary | Path traversal and outside-workspace paths rejected | Passed for document import |
| ID contracts | Shared requirement/task ID helpers and parser tests | In progress; core parsers now accept canonical `T-001` and legacy `T001` |
| Semantic gate | Orphaned requirements/tests/compliance failures block approval | In progress; EARS/design/task mapping gate tested |
| Spec package completeness | New specs generate companion docs, diagrams, TDD status, evidence, and manifest | In progress; `sdd_write_spec`, `sdd_turnkey_spec`, `sdd_auto_pipeline`, and `sdd_batch_transcripts` now create companion package artifacts; `sdd_write_spec` is verified through MCP and scaffold phase blocking is tested |
| Agent portability and permissions | `.apm` agents avoid hardcoded model IDs and declare required `sdd_*` tools used in instructions | Passed on 2026-06-17 via `node scripts/audit-agent-frontmatter.mjs` and model-frontmatter grep audit |
| Documentation | C4, controls, determinism, branch governance and evidence docs present | Present on 2026-06-17: `docs/SYSTEM-DESIGN.md`, `docs/ENTERPRISE-CONTROLS.md`, `docs/DETERMINISM.md`, `docs/BRANCH-GOVERNANCE.md`, and `docs/EVIDENCE.md` all present and linked from README |
| Release container | Dockerfile and `.dockerignore` for GHCR publish workflow | In progress; Dockerfile present and configured for HTTP on port 3200; local Docker daemon validation was unavailable in this run |

## 2026-06-17 Validation Results

### Build

Command:

```bash
npm run build
```

Result: passed after refreshing dependencies with `npm ci`.

### Tests

Command:

```bash
npm test
```

Result:

```text
Test Files  16 passed (16)
Tests       111 passed (111)
```

### Coverage

Command:

```bash
npm run test:coverage
```

Result:

```text
Test Files  16 passed (16)
Tests       111 passed (111)
Statements  56.14%
Branches    43.82%
Functions   67.91%
Lines       57.89%
```

Configured thresholds in `vitest.config.ts`:

```text
Statements  50%
Branches    40%
Functions   60%
Lines       50%
```

### Focused Document Import Boundary Test

Command:

```bash
npx vitest run tests/unit/document-converter.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Coverage added:

- Workspace-relative Markdown conversion.
- Workspace-relative text conversion.
- Absolute path rejection.
- Path traversal rejection.

### MCP Handshake

Command: Node harness spawning `dist/index.js` and sending JSON-RPC `initialize`.

Result: passed. The response included server metadata for `specky` version `3.4.0-rc.15`.

### Fresh Install Smoke

Commands:

```bash
npm pack
npm install /path/to/specky-sdd-3.4.0-rc.15.tgz
npx specky install --ide=copilot
npx specky doctor
npx specky status
```

Result: passed.

Evidence summary:

```text
[specky doctor] ✅ Install is healthy.
Install: v3.4.0-rc.15, ide=copilot
.github/ agents=13, prompts=22, skills=8, hooks=16
```

### Global Tool Enforcement

Commands:

```bash
npx vitest run tests/integration/tool-enforcement-mcp.test.ts tests/unit/tool-enforcement.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       5 passed (5)
```

Coverage added:

- Viewer role can call read-only tools through MCP.
- Viewer role is denied write tools before handler execution.
- Global audit entries include role and input/output hashes.
- The enforcement wrapper preserves MCP handler extra arguments.

### ID Contract Normalization

Command:

```bash
npx vitest run tests/unit/id-contracts.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

Coverage added:

- Canonical task ID formatting as `T-001`.
- Legacy `T001` compatibility in extractors/parsers.
- Sorted unique requirement and task extraction.

### Deterministic Runtime Context

Command:

```bash
npx vitest run tests/unit/determinism.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Coverage added:

- `SDD_FIXED_NOW` controls runtime timestamp helpers.
- Template frontmatter uses the fixed date.
- Documentation generation is stable for fixed input and fixed clock.
- Test stub generation is stable for fixed input and fixed clock.

### Semantic Analysis Gate

Command:

```bash
npx vitest run tests/integration/analysis-gate.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

Coverage added:

- `sdd_run_analysis` approves when requirements are valid EARS and mapped through design and tasks.
- `sdd_run_analysis` does not approve when design/task mappings are missing.

### Spec Package Completeness

Command:

```bash
npx vitest run tests/integration/spec-package-mcp.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

Coverage added:

- `sdd_write_spec` creates the complete feature package through MCP.
- `sdd_turnkey_spec`, `sdd_auto_pipeline`, and `sdd_batch_transcripts` call the same feature package generator.
- Companion artifacts include README, DESIGN scaffold, TASKS scaffold, ADR, PLAYBOOK, DIAGRAMS, TDD_STATUS, EVIDENCE, and SPEC_PACKAGE manifest.
- DESIGN and TASKS scaffolds carry `specky_scaffold: true` so they cannot be treated as final artifacts.

### Agent Frontmatter and Model Neutrality

Commands:

```bash
node scripts/audit-agent-frontmatter.mjs
grep -RInE '^model:|^model_fallback:' .apm/agents
```

Result:

```text
Agent frontmatter audit passed for 13 agent files.
```

Coverage added:

- Removed hardcoded `model` and `model_fallback` fields from all `.apm/agents/*.agent.md` files.
- Added missing `sdd_*` tools in agent frontmatter where instructions referenced tools not previously declared.
- Added CI gate `Audit agent frontmatter portability` in `.github/workflows/ci.yml`.
- Replaced hardcoded model-family guidance in `.apm` instructions and skills with capability-class recommendations (fast, balanced, reasoning-focused).

### Dependency Audit

Command:

```bash
npm audit --audit-level=high
```

Initial result: failing and release-blocking.

Summary:

```json
{
  "info": 0,
  "low": 1,
  "moderate": 4,
  "high": 3,
  "critical": 0,
  "total": 8
}
```

This must be remediated or explicitly risk-accepted before publish.

Remediation command:

```bash
npm audit fix
```

Post-remediation result:

```text
npm audit --audit-level=high
```

Release-blocking high/critical vulnerabilities were remediated. One low severity `esbuild` advisory remains in the development toolchain.

## rc.15 Release & Consistency Hardening (2026-06-17)

Following the initial `v3.4.0-rc.15` publication, a consistency audit found that the advertised MCP tool count had not been fully propagated after `sdd_verify_audit` was added (the count moved from 57 to 58). The drift was corrected and anchored with an automated guard so it cannot recur.

### Release facts

| Item | Value |
| --- | --- |
| Branch merge | `develop` -> `main` (merge commit `123c130`) |
| Tag | `v3.4.0-rc.15` (pushed) |
| GitHub release | Published as pre-release |
| npm dist-tags | `next` = `3.4.0-rc.15`, `latest` = `3.4.0-rc.14` |

### Consistency corrections

| Area | Change |
| --- | --- |
| Tool count | Corrected `57` -> `58` across the MCP server description, plugin manifest, RBAC admin role, README, GETTING-STARTED, CONTRIBUTING, SECURITY, and the onboarding agent/skill |
| Source counts | CONTRIBUTING corrected to 88 source files and 22 templates |
| Version metadata | `apm.yml` and `config.yml` synced `3.3.2` -> `3.4.0-rc.15` |
| Regression guard | Added `tests/unit/tool-count.test.ts` asserting registered tools == `TOTAL_TOOLS` == 58 |
| Publish workflow | `.github/workflows/publish.yml` deduplicated to a single `release: published` trigger |
| Documentation | README now links all five enterprise docs (System Design, Enterprise Controls, Determinism, Branch Governance, Evidence) |

### Validation gates (2026-06-17)

| Gate | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm test` | Passed — 17 files, 113 tests |
| `node scripts/audit-agent-frontmatter.mjs` | Passed — 13 agents, no `model`/`model_fallback` keys |
| `npm audit --audit-level=high` | Passed — one low-severity `esbuild` dev advisory remains |
| `npm pack --dry-run` | Passed — 468 files, 397.6 kB |

> Note: `src/index.ts` and `src/tools/rbac.ts` carry runtime-visible strings (the MCP server description and the RBAC admin role description). Because `3.4.0-rc.15` was already published to npm, these corrected strings ship in the next published build (`rc.16` or the stable `3.4.0`).

## Audit remediation (2026-07)

Remediation of `docs/audits/AUDIT-2026-07.md` on `develop`. See that report's
remediation-status table and the `CHANGELOG` for detail.

| Area | Change |
| --- | --- |
| Happy path | Feature identity resolved from state (not the display name); `sdd_advance_phase` no longer stalls on a mis-located `SPECIFICATION.md`. E2E MCP regression test added |
| Quality gate | `sdd_auto_pipeline` no longer writes a hard-coded `APPROVE`; a shared `AnalysisEngine` computes the real gate (verified: the `examples/todo-api` package was `CHANGES_NEEDED` at 75% until design referenced the requirement IDs, then `APPROVE`) |
| EARS | `complex` pattern reachable; suggestion de-duplicated; word-boundary vague terms; ReDoS bound; dedicated tests |
| State | Per-spec-dir async mutex; atomic state + signature writes |
| HTTP | Binds `127.0.0.1` by default; opt-in bearer-token auth (`SDD_HTTP_TOKEN`); DNS-rebinding protection |
| Installer | Pre-authorized allow-list reduced 37 → 11 (no arbitrary shell/`rm`/network); `.mcp.json` pinned to the installed version |
| Config | `.specky/config.yml` parsed with the `yaml` library + Zod schema; `spec_dir`/`templates_path` reject traversal |
| Coverage | Measured over the whole `src/**` tree (`all:true`); honest baseline ~24% (was 56% over imported files only) |
| Docs | Public counts/phases/lineage corrected; `docs/API_REFERENCE.md` generated from `tools/list` with a CI `--check`; source count 88 → 92 |
| Dedup | Single `tool-result` helper replaces 16× `formatError` + 18× `truncate` copies |

### Validation gates (2026-07)

| Gate | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm test` | Passed — 25 files, 160 tests |
| `node scripts/generate-api-reference.mjs --check` | Passed — 58 tools in sync |
| `node scripts/audit-agent-frontmatter.mjs` | Passed |
| Fresh install + `specky doctor` | Passed — 11 allow rules, `.mcp.json` pinned |
| HTTP auth smoke | `/mcp` 401 without/with-wrong token, 200 with token; `/health` open |

## Required Evidence Commands

```bash
node scripts/audit-agent-frontmatter.mjs
npm run build
npm test
npm run test:coverage
npm audit --audit-level=high
npm pack
```

Fresh install smoke:

```bash
mkdir /tmp/specky-evidence
cd /tmp/specky-evidence
npm init -y
npm install /path/to/specky-sdd-*.tgz --silent
npx specky install --ide=copilot
npx specky doctor
npx specky status
```

MCP initialize smoke:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"evidence","version":"0.1.0"}}}' | node dist/index.js
```

## Evidence Documents

- [Branch Governance](BRANCH-GOVERNANCE.md)
- [Determinism](DETERMINISM.md)
- [Enterprise Controls](ENTERPRISE-CONTROLS.md)
- [System Design](SYSTEM-DESIGN.md)

## Open Follow-ups

- Explicitly triage the remaining low severity `esbuild` advisory.
- Enforce publish preflight in GitHub Actions.
- Add an install-smoke assertion that generated `.github/agents` files contain no `model`/`model_fallback` keys.

## References

- [GitHub Dependabot alerts](https://docs.github.com/code-security/dependabot/dependabot-alerts/about-dependabot-alerts)
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [C4 model](https://c4model.com/)
