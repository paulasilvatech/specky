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
| npm `next` dist-tag | `3.4.0-rc.14` |
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
| Unit and integration tests | `npm test` output | Passed on 2026-06-17: 8 files, 85 tests |
| Coverage | `npm run test:coverage` and thresholds | Passed on 2026-06-17: statements 51.25%, branches 42.1%, functions 60.57%, lines 52.36% |
| Dependency audit | `npm audit --audit-level=high` | Passed on 2026-06-17; 1 low severity advisory remains |
| MCP handshake | JSON-RPC initialize response includes Specky server metadata | Pending |
| Fresh install | `npm pack` plus fresh workspace `npx specky install`, `doctor`, `status` | Pending |
| RBAC enforcement | Viewer/contributor/admin integration tests | In progress; viewer allow/deny verified through MCP |
| Audit chain | Hash-chain generated and verification detects tampering | In progress; global tool execution writes audit entries and `sdd_verify_audit` verifies chain integrity |
| Determinism | Same input and fixed clock generate identical artifacts | Pending |
| Filesystem boundary | Path traversal and outside-workspace paths rejected | Pending |
| ID contracts | Shared requirement/task ID helpers and parser tests | In progress; core parsers now accept canonical `T-001` and legacy `T001` |
| Semantic gate | Orphaned requirements/tests/compliance failures block approval | Pending |
| Documentation | C4, controls, determinism, branch governance and evidence docs present | In progress |

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
Test Files  8 passed (8)
Tests       85 passed (85)
```

### Coverage

Command:

```bash
npm run test:coverage
```

Result:

```text
Test Files  11 passed (11)
Tests       96 passed (96)
Statements  51.25%
Branches    42.1%
Functions   60.57%
Lines       52.36%
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

## Required Evidence Commands

```bash
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
- Add coverage thresholds.
- Implement centralized tool enforcement.
- Add audit verification command/tool.
- Add deterministic snapshot tests.

## References

- [GitHub Dependabot alerts](https://docs.github.com/code-security/dependabot/dependabot-alerts/about-dependabot-alerts)
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [C4 model](https://c4model.com/)
