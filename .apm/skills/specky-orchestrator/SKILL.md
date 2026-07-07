---
name: specky-orchestrator
description: "This skill should be used when the user asks to 'orchestrate pipeline', 'run full pipeline', 'coordinate phases', 'advance phase', or needs guidance on end-to-end pipeline execution. Also trigger on 'specky orchestrate', 'phase transition', 'LGTM gate', 'pipeline status', or 'which agent for this phase'."
---

# Pipeline Orchestrator

## Overview

The orchestrator coordinates the full 10-phase SDD pipeline, routing to the correct agent per phase, validating artifacts between transitions, and enforcing LGTM gates.

Model guidance is capability-based: fast, balanced, and reasoning-focused. Do not hardcode vendor-specific model IDs. Let the user choose any available model.

## Agent Routing Table

| Phase | Agent | Recommended Class | MCP Tools | Required Input | Output Artifact |
|-------|-------|-------------------|-----------|----------------|-----------------|
| 0 Init | @specky-sdd-init | Fast | sdd_init, sdd_scan_codebase | — | CONSTITUTION.md, .sdd-state.json |
| 1 Discover | @specky-research-analyst | Balanced | sdd_discover, sdd_research, sdd_import_document, sdd_import_transcript, sdd_check_ecosystem | CONSTITUTION.md | RESEARCH.md |
| 2 Specify | @specky-spec-engineer | Reasoning-focused | sdd_write_spec, sdd_turnkey_spec, sdd_validate_ears, sdd_figma_to_spec | RESEARCH.md | SPECIFICATION.md |
| 3 Clarify | @specky-sdd-clarify | Reasoning-focused | sdd_clarify, sdd_validate_ears, sdd_turnkey_spec | SPECIFICATION.md | Updates to SPECIFICATION.md |
| 4 Design | @specky-design-architect | Reasoning-focused | sdd_write_design, sdd_generate_all_diagrams, sdd_generate_diagram | SPECIFICATION.md | DESIGN.md |
| 5 Tasks | @specky-task-planner | Balanced | sdd_write_tasks, sdd_checklist | DESIGN.md | TASKS.md, CHECKLIST.md |
| 6 Analyze | @specky-quality-reviewer | Balanced | sdd_run_analysis, sdd_cross_analyze, sdd_compliance_check, sdd_check_sync | TASKS.md, CHECKLIST.md | ANALYSIS.md, COMPLIANCE.md |
| 7 Implement | @specky-implementer | Balanced | sdd_implement, sdd_generate_tests, sdd_generate_pbt, sdd_generate_iac, sdd_generate_dockerfile | ANALYSIS.md | Code scaffolding, test stubs |
| 8 Verify | @specky-test-verifier | Reasoning-focused | sdd_verify_tests, sdd_verify_tasks, sdd_check_sync, sdd_validate_ears | SPECIFICATION.md, TASKS.md | VERIFICATION.md, CROSS_ANALYSIS.md |
| 9 Release | @specky-release-engineer | Fast | sdd_create_pr, sdd_generate_all_docs, sdd_export_work_items | ANALYSIS.md (APPROVE) | PR, docs, work items |

## Hook Enforcement Matrix

### Pre-Phase Hooks (validate before tool runs)

| Tool Matcher | Hooks | Type |
|-------------|-------|------|
| sdd_init | specky-branch-validator | Advisory |
| sdd_discover, sdd_research, sdd_import_* | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_write_spec, sdd_turnkey_spec, sdd_figma_to_spec | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_write_design, sdd_generate_all_diagrams | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_write_tasks, sdd_checklist | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_implement, sdd_generate_tests | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_verify_tests, sdd_verify_tasks | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_run_analysis, sdd_cross_analyze | specky-artifact-validator, specky-branch-validator | Blocking + Advisory |
| sdd_create_pr | specky-artifact-validator, specky-branch-validator, specky-security-scan, specky-release-gate | All Blocking |

### Post-Phase Hooks (validate after tool runs)

| Tool Matcher | Hooks | Type |
|-------------|-------|------|
| sdd_init | specky-phase-gate, specky-auto-checkpoint | Blocking + Advisory |
| sdd_write_spec, sdd_turnkey_spec | specky-phase-gate, specky-spec-quality, specky-ears-validator, specky-lgtm-gate, specky-spec-sync, specky-auto-checkpoint | Mixed |
| sdd_write_design | specky-phase-gate, specky-spec-sync, specky-lgtm-gate, specky-auto-checkpoint | Mixed |
| sdd_write_tasks | specky-phase-gate, specky-task-tracer, specky-lgtm-gate, specky-spec-sync, specky-auto-checkpoint | Mixed |
| sdd_implement, sdd_generate_tests | specky-spec-sync, specky-auto-checkpoint | Advisory |
| sdd_verify_tests, sdd_verify_tasks | specky-phase-gate, specky-drift-monitor | Mixed |
| sdd_run_analysis, sdd_cross_analyze | specky-phase-gate, specky-cognitive-debt-alert, specky-metrics-dashboard, specky-drift-monitor | Mixed |

## LGTM Gate Protocol

Phases 2 (Specify), 4 (Design), and 5 (Tasks) require human LGTM before advancing:

1. Phase agent completes and writes artifact
2. specky-lgtm-gate.sh runs → prints artifact summary
3. Orchestrator asks: "Review [ARTIFACT]. Reply 'LGTM' to proceed."
4. If LGTM → call sdd_advance_phase → next agent
5. If feedback → route back to phase agent for revision
6. Loop until LGTM received

## Branch Validation per Phase

| Phase | Expected Branch | Action |
|-------|----------------|--------|
| 0 (Init) | develop | Create spec/NNN-* from develop |
| 1-7 | spec/NNN-* | All spec work on feature branch |
| 8 (Verify) | develop | After merge from spec branch |
| 9 (Release) | stage | After merge from develop |
| Production | main | After PR merge from stage |

## Phase Transition Checklist

Before calling sdd_advance_phase, verify:
1. ✅ Required artifact exists (PHASE_REQUIRED_FILES)
2. ✅ Artifact has minimum quality (specky-phase-gate.sh passed)
3. ✅ LGTM received (if phase 2, 4, or 5)
4. ✅ Branch matches expectations
5. ✅ Checkpoint created (sdd_checkpoint)
6. ✅ No blocking hook failures
