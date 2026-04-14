---
name: SDD Pipeline Guide
description: "This skill should be used when the user asks about 'spec-driven development', 'SDD pipeline', 'specky', 'pipeline phases', 'EARS notation', 'requirements engineering', 'model routing', or needs guidance on the 10-phase SDD workflow (Init → Research → Clarify → Specify → Design → Tasks → Implement → Verify → Review → Release). Also trigger on 'spec this', 'plan this feature', 'break into tasks', 'quality gate', 'constitution', or 'spec sync'."
---

# Spec-Driven Development (SDD) Pipeline

## 10-Phase Pipeline Overview

The SDD pipeline consists of 10 sequential phases designed to transform feature requests into production-ready code with comprehensive specification artifacts:

**Phase 0: Init** — Project initialization, scope definition, stakeholder identification, and initial artifact setup (CONSTITUTION.md).

**Phase 1: Research** — Brownfield/greenfield analysis, technology stack discovery, document import, and ecosystem investigation. Produces RESEARCH.md.

**Phase 2: Clarify** — Refinement of ambiguous requirements, stakeholder interviews, discovery questions, and context enrichment. Prepares input for specification phase.

**Phase 3: Specify** — Detailed requirements capture using EARS notation, acceptance criteria definition, and constraint documentation. Produces SPECIFICATION.md.

**Phase 4: Design** — System architecture, data flow diagrams, API contracts, and technical approach documentation. Produces DESIGN.md.

**Phase 5: Tasks** — Work breakdown structure, task dependencies, story points estimation, and implementation sequencing. Produces TASKS.md.

**Phase 6: Implement** — Code generation, infrastructure setup, test scaffolding, and quality checklist generation based on specifications.

**Phase 7: Verify** — Test execution, coverage analysis, phantom completion detection, and spec-code drift verification. Produces VERIFICATION.md.

**Phase 8: Review** — Code review, security scanning, performance validation, and compliance checks.

**Phase 9: Release** — Release gate execution, documentation generation, PR creation, work item export, and changelog preparation.

## EARS Notation (Extended Requirements)

EARS (Easy Approach to Requirements Syntax) provides five core patterns plus a complex pattern for unambiguous requirement capture:

1. **Shall** — Mandatory requirements. Format: "The system shall [action]."
   - Example: "The system shall validate email format before submission."

2. **Should** — Desired but not mandatory. Format: "The system should [action]."
   - Example: "The system should display results within 2 seconds."

3. **May** — Optional enhancements. Format: "The system may [action]."
   - Example: "The system may support bulk import operations."

4. **If...Then...** — Conditional requirements. Format: "If [condition] then [action]."
   - Example: "If user is admin then system shall grant access to configuration panel."

5. **When...Then...** — Trigger-based requirements. Format: "When [event] then [action]."
   - Example: "When form is submitted then system shall validate all required fields."

6. **Complex** — Combination patterns for intricate business logic.
   - Example: "If user role is editor, when publish button is clicked, then system shall validate content and if valid shall queue for approval."

## Model Routing Table

Route specification and implementation tasks to models based on phase complexity:

| Phase | Model | Reasoning |
|-------|-------|-----------|
| 0 (Init) | Haiku | Basic scope definition, lightweight |
| 1 (Research) | Sonnet | Multi-source synthesis, ecosystem analysis |
| 2 (Clarify) | Sonnet | Interactive refinement, stakeholder context |
| 3 (Specify) | Opus | Complex requirement formalization, EARS patterns |
| 4 (Design) | Opus | Architecture decisions, multi-component systems |
| 5 (Tasks) | Sonnet | Work breakdown, dependency mapping |
| 6 (Implement) | Sonnet | Code scaffolding, quality checklists |
| 7 (Verify) | Opus | Coverage analysis, drift detection |
| 8 (Review) | Opus | Complex security/performance validation |
| 9 (Release) | Haiku | Final gates, documentation assembly |

## Extended Thinking Impact

Reference: **arXiv:2502.08235** — "Extended Thinking and Specification Quality in Large Language Models"

Key finding for Phase 6 (Implementation): Enabling extended thinking (chain-of-thought) reduces quality by 30% while increasing cost by 43% in code generation tasks. Recommendation: Use standard inference for Phase 6 scaffolding; reserve extended thinking for Phase 7 verification and Phase 8 review gates.

## Hook System

The pipeline includes 10 integration hooks for customization:

**Blocking Hooks** (workflow stops if hook fails):
- `init-hook` — Pre-initialization validation
- `release-gate-hook` — Final release approval gate

**Advisory Hooks** (workflow continues; failures logged):
1. `research-hook` — Post-research artifact enrichment
2. `clarify-hook` — Post-clarification refinement
3. `specify-hook` — Post-specification validation
4. `design-hook` — Post-design review
5. `tasks-hook` — Post-task breakdown
6. `implement-hook` — Post-implementation scaffolding
7. `verify-hook` — Post-verification analysis
8. `review-hook` — Post-code-review collection

Hooks can trigger external tools, log metrics, or invoke custom CI/CD pipelines.

## Key Artifacts per Phase

- **CONSTITUTION.md** (Phase 0) — Project charter, scope boundaries, success criteria, stakeholder register
- **RESEARCH.md** (Phase 1) — Technology scan, document inventory, ecosystem analysis, discovery findings
- **SPECIFICATION.md** (Phase 3) — Requirements in EARS notation, acceptance criteria, constraints, compliance matrix
- **DESIGN.md** (Phase 4) — Architecture diagrams, API contracts, data schema, deployment topology
- **TASKS.md** (Phase 5) — WBS, task cards, dependencies, story points, implementation sequence
- **VERIFICATION.md** (Phase 7) — Test results, coverage report, drift analysis, gate status
- **ANALYSIS.md** (Phase 8) — Review findings, security scan results, performance metrics, approval status

## Invocation Methods

**Direct CLI:**
```
/specky:init
/specky:research
/specky:clarify
/specky:specify
/specky:design
/specky:tasks
/specky:implement
/specky:verify
/specky:review
/specky:release
```

**Agent-based:**
```
@specky-sdd-agent init feature-name
@specky-sdd-agent specify --input=RESEARCH.md
@specky-sdd-agent implement --model=sonnet
```

## Workflow Entry Points

- **Greenfield** — Start at Phase 0 with new project initialization
- **Brownfield** — Start at Phase 1 to analyze existing codebase, then Phase 3 to specify new work
- **Rapid** — Skip Phase 2 if requirements are pre-clarified; proceed directly to Phase 3
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
| `develop` | 8 (Review) | ANALYSIS.md, COMPLIANCE.md | After integration review |
| `stage` | 8-9 (QA + Gates) | Release docs, changelog | After blocking gates pass |
| `main` | Production | — | Protected; deploy-ready |

### Rules

1. Each spec MUST have its own branch: `spec/NNN-feature-name`
2. Create spec branch from `develop`, never from `main`
3. All `.specs/` artifacts are created on the spec branch (Phases 0-7)
4. Merge to `develop` only after Phase 7 (verify) passes
5. Merge to `stage` only after integration review on develop
6. Merge to `main` only after blocking gates pass on stage
7. Delete spec branch after successful merge to develop

### Git Commands

**Starting a new spec:**
```bash
git checkout develop
git pull origin develop
git checkout -b spec/001-user-authentication
# Run @sdd-init / /specky-greenfield
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
# Run @release-engineer for blocking gates
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
| 1 Research | `sdd_discover`, `sdd_research`, `sdd_import_document`, `sdd_import_transcript`, `sdd_batch_import`, `sdd_check_ecosystem` |
| 2 Clarify | `sdd_clarify`, `sdd_validate_ears`, `sdd_turnkey_spec` |
| 3 Specify | `sdd_write_spec`, `sdd_turnkey_spec`, `sdd_validate_ears`, `sdd_figma_to_spec` |
| 4 Design | `sdd_write_design`, `sdd_generate_all_diagrams`, `sdd_generate_diagram` |
| 5 Tasks | `sdd_write_tasks`, `sdd_checklist` |
| 6 Implement | `sdd_implement`, `sdd_generate_tests`, `sdd_generate_pbt`, `sdd_generate_iac`, `sdd_generate_dockerfile`, `sdd_generate_devcontainer` |
| 7 Verify | `sdd_verify_tests`, `sdd_verify_tasks`, `sdd_check_sync`, `sdd_validate_ears` |
| 8 Review | `sdd_run_analysis`, `sdd_cross_analyze`, `sdd_compliance_check`, `sdd_check_sync` |
| 9 Release | `sdd_create_pr`, `sdd_generate_all_docs`, `sdd_export_work_items` |
| Any | `sdd_get_status`, `sdd_advance_phase`, `sdd_checkpoint`, `sdd_restore`, `sdd_metrics`, `sdd_model_routing` |

## Agent Routing

| Phase | Agent | Model |
|-------|-------|-------|
| Pre | @specky-onboarding | Haiku |
| All | @specky-orchestrator | Sonnet |
| 0 | @sdd-init | Haiku |
| 1 | @research-analyst | Sonnet |
| 2 | @sdd-clarify | Opus |
| 3 | @spec-engineer | Opus |
| 4 | @design-architect | Opus |
| 5 | @task-planner | Sonnet |
| 6 | @implementer | Sonnet |
| 7 | @test-verifier | Sonnet |
| 8 | @quality-reviewer | Opus |
| 9 | @release-engineer | Haiku |
