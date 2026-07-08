---
name: specky-sdd-pipeline
description: "This skill should be used when the user asks about 'spec-driven development', 'SDD pipeline', 'specky', 'pipeline phases', 'EARS notation', 'requirements engineering', 'model routing', or needs guidance on the 10-phase SDD workflow (Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release). Also trigger on 'spec this', 'plan this feature', 'break into tasks', 'quality gate', 'constitution', or 'spec sync'."
---

# Spec-Driven Development (SDD) Pipeline

## 10-Phase Pipeline Overview

The SDD pipeline consists of 10 sequential phases designed to transform feature requests into production-ready code with comprehensive specification artifacts:

**Phase 0: Init** — Project initialization, scope definition, stakeholder identification, and initial artifact setup (CONSTITUTION.md).

**Phase 1: Discover** — Brownfield/greenfield analysis, technology stack discovery, document import, and ecosystem investigation. Produces RESEARCH.md.

**Phase 2: Specify** — Detailed requirements capture using EARS notation, acceptance criteria definition, and constraint documentation. Produces SPECIFICATION.md.

**Phase 3: Clarify** — Refinement of ambiguous requirements, stakeholder interviews, discovery questions, and context enrichment. Updates SPECIFICATION.md.

**Phase 4: Design** — System architecture, data flow diagrams, API contracts, and technical approach documentation. Produces DESIGN.md.

**Phase 5: Tasks** — Work breakdown structure, task dependencies, story points estimation, and implementation sequencing. Produces TASKS.md.

**Phase 6: Analyze** — Cross-artifact analysis, quality checklist, compliance checks, and completeness audit. Produces ANALYSIS.md, COMPLIANCE.md.

**Phase 7: Implement** — Code generation, infrastructure setup, test scaffolding, and quality checklist generation based on specifications.

**Phase 8: Verify** — Test execution, coverage analysis, phantom completion detection, and spec-code drift verification. Produces VERIFICATION.md.

**Phase 9: Release** — Release gate execution, documentation generation, PR creation, work item export, and changelog preparation.

## EARS Notation (Canonical 6 Patterns)

EARS (Easy Approach to Requirements Syntax) uses six requirement patterns. Should/May express priority or obligation level inside a requirement; they are not separate Specky EARS patterns.

| Pattern | Format |
|---------|--------|
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |

See `references/ears-notation.md` for examples and validation guidance.

## Model Recommendation Table

Recommend a model capability class per phase. Do not hardcode a vendor-specific model ID. Let the user choose any available model.

| Phase | Recommended Class | Reasoning |
|-------|-------------------|-----------|
| 0 (Init) | Fast | Basic scope definition and scaffolding |
| 1 (Discover) | Balanced | Multi-source synthesis and ecosystem analysis |
| 2 (Specify) | Reasoning-focused | Complex requirement formalization and EARS patterns |
| 3 (Clarify) | Reasoning-focused | Ambiguity detection and refinement |
| 4 (Design) | Reasoning-focused | Architecture decisions and trade-off analysis |
| 5 (Tasks) | Balanced | Work breakdown and dependency mapping |
| 6 (Analyze) | Balanced | Cross-artifact analysis and compliance checks |
| 7 (Implement) | Balanced | Iterative implementation with executable feedback |
| 8 (Verify) | Reasoning-focused | Coverage analysis and drift detection |
| 9 (Release) | Fast | Deterministic final gates and documentation assembly |

## Extended Reasoning Guidance

Reference: **arXiv:2502.08235** — "Extended Thinking and Specification Quality in Large Language Models"

For Phase 7 (Implementation), prioritize fast feedback loops over long reasoning traces. Reserve deeper reasoning for ambiguous design and verification tasks.

## Hook System

The pipeline includes 16 automation hooks for customization:

**Blocking Hooks** (workflow stops if hook fails — exit code 2):
1. `specky-artifact-validator` — Pre-tool: blocks if required artifacts missing
2. `specky-phase-gate` — Post-tool: blocks if output artifact wasn't created
3. `specky-security-scan` — Pre-release: blocks if hardcoded secrets detected
4. `specky-release-gate` — Pre-release: blocks if gate conditions not met

**Advisory Hooks** (workflow continues; failures logged):
1. `specky-branch-validator` — Pre-tool: warns if wrong branch for phase
2. `specky-spec-sync` — Post-tool: checks spec-code drift
3. `specky-auto-checkpoint` — Post-tool: suggests checkpoint after artifact changes
4. `specky-spec-quality` — Post-spec: validates specification quality
5. `specky-task-tracer` — Post-tasks: traces task dependencies
6. `specky-ears-validator` — Post-spec: validates EARS notation patterns
7. `specky-lgtm-gate` — Post-spec/design/tasks: pauses for human LGTM
8. `specky-drift-monitor` — Post-verify/review: monitors specification drift
9. `specky-cognitive-debt-alert` — Post-analysis: flags cognitive debt metrics
10. `specky-metrics-dashboard` — Post-analysis: updates metrics dashboard

Hooks are configured in `sdd-hooks.json` with PreToolUse and PostToolUse matchers.

## Key Artifacts per Phase

- **CONSTITUTION.md** (Phase 0 — Init) — Project charter, scope boundaries, success criteria, stakeholder register
- **RESEARCH.md** (Phase 1 — Discover) — Technology scan, document inventory, ecosystem analysis, discovery findings
- **SPECIFICATION.md** (Phase 2 — Specify) — Requirements in EARS notation, acceptance criteria, constraints, compliance matrix
- **DESIGN.md** (Phase 4 — Design) — Architecture diagrams, API contracts, data schema, deployment topology
- **TASKS.md** (Phase 5 — Tasks) — WBS, task cards, dependencies, story points, implementation sequence
- **ANALYSIS.md** (Phase 6 — Analyze) — Cross-artifact analysis, compliance checks, quality gate decision
- **VERIFICATION.md** (Phase 8 — Verify) — Test results, coverage report, drift analysis, gate status

## Invocation Methods

**Direct CLI:**
```
/specky:init
/specky:discover
/specky:specify
/specky:clarify
/specky:design
/specky:tasks
/specky:analyze
/specky:implement
/specky:verify
/specky:release
```

**Agent-based:**
```
@specky-orchestrator           (end-to-end pipeline coordinator)
@specky-sdd-init feature-name         (Phase 0 — initialize feature)
@specky-spec-engineer                 (Phase 2 — write SPECIFICATION.md)
@specky-implementer                   (Phase 7 — scaffold code + tests)
```

See the target-specific instruction rule for the full runtime entry point guidance.

## Workflow Entry Points

- **Greenfield** — Start at Phase 0 with new project initialization
- **Brownfield** — Start at Phase 1 to analyze existing codebase, then Phase 2 to specify new work
- **Rapid** — Skip Phase 3 if requirements are pre-clarified; proceed directly to Phase 4
- **Emergency** — Jump to Phase 5 if architecture and design are pre-existing; focus on tasks and implementation

Use the `/specky:check` command to validate artifact completeness before advancing phases.

## Branching Strategy

Every spec gets its own branch. Work progresses through environments before reaching production:

```
spec/001-user-auth ──→ develop ──→ stage ──→ main
spec/002-payments  ──→    ↑
spec/003-notifs    ──→    ↑
```

### Branch-to-Phase Mapping

| Branch | Phases | Artifacts Created | When to Merge |
|--------|--------|-------------------|---------------|
| `spec/NNN-feature-name` | 0-7 | CONSTITUTION.md, .sdd-state.json, RESEARCH.md, SPECIFICATION.md, DESIGN.md, TASKS.md, CHECKLIST.md, VERIFICATION.md, CROSS_ANALYSIS.md | After Phase 7 passes |
| `develop` | 8 (Verify) | ANALYSIS.md, COMPLIANCE.md | After integration review |
| `stage` | 8-9 (QA + Gates) | Release docs, changelog | After blocking gates pass |
| `main` | Production | — | Protected; deploy-ready |

### Rules

1. Each spec MUST have its own branch: `spec/NNN-feature-name`
2. Create spec branch from `develop`, never from `main`
3. All `.specs/` artifacts are created on the spec branch (Phases 0-7)
4. Merge to `develop` only after Phase 8 (verify) passes
5. Merge to `stage` only after integration review on develop
6. Merge to `main` only after blocking gates pass on stage
7. Delete spec branch after successful merge to develop

### Git Commands

**Starting a new spec:**
```bash
git checkout develop
git pull origin develop
git checkout -b spec/001-user-authentication
# Run @specky-sdd-init / /specky-greenfield
```

**After Phase 7 passes:**
```bash
git checkout develop
git merge --no-ff spec/001-user-authentication
git branch -d spec/001-user-authentication
git push origin develop
```

**Promoting to stage:**
```bash
git checkout stage
git merge --no-ff develop
git push origin stage
# Run @specky-release-engineer for blocking gates
```

**Releasing to production:**
```bash
git checkout main
git merge --no-ff stage
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
```

## MCP Tools per Phase

| Phase | Tools |
|-------|-------|
| 0 Init | `sdd_init`, `sdd_scan_codebase`, `sdd_create_branch` |
| 1 Discover | `sdd_discover`, `sdd_research`, `sdd_import_document`, `sdd_import_transcript`, `sdd_batch_import`, `sdd_check_ecosystem` |
| 2 Specify | `sdd_write_spec`, `sdd_turnkey_spec`, `sdd_validate_ears`, `sdd_figma_to_spec` |
| 3 Clarify | `sdd_clarify`, `sdd_validate_ears`, `sdd_turnkey_spec` |
| 4 Design | `sdd_write_design`, `sdd_generate_all_diagrams`, `sdd_generate_diagram` |
| 5 Tasks | `sdd_write_tasks`, `sdd_checklist` |
| 6 Analyze | `sdd_run_analysis`, `sdd_cross_analyze`, `sdd_compliance_check`, `sdd_check_sync` |
| 7 Implement | `sdd_implement`, `sdd_generate_tests`, `sdd_generate_pbt`, `sdd_generate_iac`, `sdd_generate_dockerfile`, `sdd_generate_devcontainer` |
| 8 Verify | `sdd_verify_tests`, `sdd_verify_tasks`, `sdd_check_sync`, `sdd_validate_ears` |
| 9 Release | `sdd_create_pr`, `sdd_generate_all_docs`, `sdd_export_work_items` |
| Any | `sdd_get_status`, `sdd_advance_phase`, `sdd_checkpoint`, `sdd_restore`, `sdd_metrics`, `sdd_model_routing` |

## Agent Routing

| Phase | Agent | Recommended Class |
|-------|-------|-------------------|
| Pre | @specky-onboarding | Fast |
| All | @specky-orchestrator | Balanced |
| 0 | @specky-sdd-init | Fast |
| 1 | @specky-research-analyst | Balanced |
| 2 | @specky-spec-engineer | Reasoning-focused |
| 3 | @specky-sdd-clarify | Reasoning-focused |
| 4 | @specky-design-architect | Reasoning-focused |
| 5 | @specky-task-planner | Balanced |
| 6 | @specky-quality-reviewer | Balanced |
| 7 | @specky-implementer | Balanced |
| 8 | @specky-test-verifier | Reasoning-focused |
| 9 | @specky-release-engineer | Fast |
