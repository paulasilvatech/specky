---
name: Pipeline Orchestrator
description: "This skill should be used when the user asks to 'orchestrate pipeline', 'run full pipeline', 'coordinate phases', 'advance phase', or needs guidance on end-to-end pipeline execution. Also trigger on 'specky orchestrate', 'phase transition', 'LGTM gate', 'pipeline status', or 'which agent for this phase'."
---

# Pipeline Orchestrator

## Overview

The orchestrator coordinates the full 10-phase SDD pipeline, routing to the correct agent per phase, validating artifacts between transitions, and enforcing LGTM gates.

## Agent Routing Table

| Phase | Agent | Model | MCP Tools | Required Input | Output Artifact |
|-------|-------|-------|-----------|----------------|-----------------|
| 0 Init | @sdd-init | Haiku | sdd_init, sdd_scan_codebase | — | CONSTITUTION.md, .sdd-state.json |
| 1 Research | @research-analyst | Sonnet | sdd_discover, sdd_research, sdd_import_document, sdd_import_transcript, sdd_check_ecosystem | CONSTITUTION.md | RESEARCH.md |
| 2 Clarify | @sdd-clarify | Opus | sdd_clarify, sdd_validate_ears, sdd_turnkey_spec | CONSTITUTION.md | Updates to RESEARCH.md |
| 3 Specify | @spec-engineer | Opus | sdd_write_spec, sdd_turnkey_spec, sdd_validate_ears, sdd_figma_to_spec | RESEARCH.md | SPECIFICATION.md |
| 4 Design | @design-architect | Opus | sdd_write_design, sdd_generate_all_diagrams, sdd_generate_diagram | SPECIFICATION.md | DESIGN.md |
| 5 Tasks | @task-planner | Sonnet | sdd_write_tasks, sdd_checklist | DESIGN.md | TASKS.md, CHECKLIST.md |
| 6 Implement | @implementer | Sonnet | sdd_implement, sdd_generate_tests, sdd_generate_pbt, sdd_generate_iac, sdd_generate_dockerfile | TASKS.md, CHECKLIST.md | Code scaffolding, test stubs |
| 7 Verify | @test-verifier | Sonnet | sdd_verify_tests, sdd_verify_tasks, sdd_check_sync, sdd_validate_ears | SPECIFICATION.md, TASKS.md | VERIFICATION.md, CROSS_ANALYSIS.md |
| 8 Review | @quality-reviewer | Opus | sdd_run_analysis, sdd_cross_analyze, sdd_compliance_check, sdd_check_sync | All artifacts | ANALYSIS.md, COMPLIANCE.md |
| 9 Release | @release-engineer | Haiku | sdd_create_pr, sdd_generate_all_docs, sdd_export_work_items | ANALYSIS.md (APPROVE) | PR, docs, work items |

## Hook Enforcement Matrix

### Pre-Phase Hooks (validate before tool runs)

| Tool Matcher | Hooks | Type |
|-------------|-------|------|
| sdd_init | branch-validator | Advisory |
| sdd_discover, sdd_research, sdd_import_* | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_write_spec, sdd_turnkey_spec, sdd_figma_to_spec | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_write_design, sdd_generate_all_diagrams | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_write_tasks, sdd_checklist | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_implement, sdd_generate_tests | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_verify_tests, sdd_verify_tasks | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_run_analysis, sdd_cross_analyze | artifact-validator, branch-validator | Blocking + Advisory |
| sdd_create_pr | artifact-validator, branch-validator, security-scan, release-gate | All Blocking |

### Post-Phase Hooks (validate after tool runs)

| Tool Matcher | Hooks | Type |
|-------------|-------|------|
| sdd_init | phase-gate, auto-checkpoint | Blocking + Advisory |
| sdd_write_spec, sdd_turnkey_spec | phase-gate, spec-quality, ears-validator, lgtm-gate, spec-sync, auto-checkpoint | Mixed |
| sdd_write_design | phase-gate, spec-sync, lgtm-gate, auto-checkpoint | Mixed |
| sdd_write_tasks | phase-gate, task-tracer, lgtm-gate, spec-sync, auto-checkpoint | Mixed |
| sdd_implement, sdd_generate_tests | spec-sync, auto-checkpoint | Advisory |
| sdd_verify_tests, sdd_verify_tasks | phase-gate, drift-monitor | Mixed |
| sdd_run_analysis, sdd_cross_analyze | phase-gate, cognitive-debt-alert, metrics-dashboard, drift-monitor | Mixed |

## LGTM Gate Protocol

Phases 3 (Specify), 4 (Design), and 5 (Tasks) require human LGTM before advancing:

1. Phase agent completes and writes artifact
2. lgtm-gate.sh runs → prints artifact summary
3. Orchestrator asks: "Review [ARTIFACT]. Reply 'LGTM' to proceed."
4. If LGTM → call sdd_advance_phase → next agent
5. If feedback → route back to phase agent for revision
6. Loop until LGTM received

## Branch Validation per Phase

| Phase | Expected Branch | Action |
|-------|----------------|--------|
| 0 (Init) | develop | Create spec/NNN-* from develop |
| 1-7 | spec/NNN-* | All spec work on feature branch |
| 8 (Review) | develop | After merge from spec branch |
| 9 (Release) | stage | After merge from develop |
| Production | main | After PR merge from stage |

## Phase Transition Checklist

Before calling sdd_advance_phase, verify:
1. ✅ Required artifact exists (PHASE_REQUIRED_FILES)
2. ✅ Artifact has minimum quality (phase-gate.sh passed)
3. ✅ LGTM received (if phase 3, 4, or 5)
4. ✅ Branch matches expectations
5. ✅ Checkpoint created (sdd_checkpoint)
6. ✅ No blocking hook failures
