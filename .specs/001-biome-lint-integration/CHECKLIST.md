---
title: Specky — Checklist
feature_id: 001-biome-lint-integration
project_name: specky
version: 1.0.0
author: specky
status: Draft
---

# Specky — Checklist

> Final verification checklist for the biome-lint-integration feature.

---

## Implementation Verification

- [x] Biome installed as devDependency
- [x] `biome.json` configuration created
- [x] npm scripts `lint`, `lint:fix`, `format` added
- [x] Tests written for `slug.ts`
- [x] Tests written for `routing-helper.ts`
- [x] Tests written for `audit.ts`
- [x] Tests written for `transcript.ts` MCP tools
- [x] Tests written for CLI commands (`serve`, `upgrade`, `hooks`, `apm`)
- [x] Tests written for `vscode-settings-writer.ts`
- [x] Tests written for `agent-skills.ts`
- [x] Biome warnings fixed (unused imports, variables, optional chains)
- [x] Coverage thresholds ratcheted to 85/71/94/86
- [x] `.specs/` directory created with spec package

## Validation Results

- [x] `npm run build` passes
- [x] `npm test` passes (90 files, 769 tests)
- [x] `npm run lint` passes (0 errors, 0 warnings)
- [x] `npm run test:coverage` passes (85.78/71.63/94.23/86.62)
- [x] `npm run audit` passes
- [x] All new tests deterministic and isolated

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Developer | — | — | APPROVE |
| Reviewer | — | — | APPROVE |
