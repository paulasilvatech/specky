---
name: specky-orchestrator
description: "This skill should be used when the user asks to 'orchestrate pipeline', 'run full pipeline', 'coordinate phases', 'advance phase', or needs guidance on end-to-end pipeline execution. Also trigger on 'specky orchestrate', 'phase transition', 'LGTM gate', 'pipeline status', or 'which agent for this phase'."
---

# Contracted Pipeline Orchestrator

The orchestrator follows the selected feature’s signed phase graph. Full, rapid, and emergency modes have different graphs; the runtime, not a hardcoded table, determines the next phase.

Start every operation with:

```json
{"view":"feature","spec_dir":".specs","feature_number":"001"}
```

Never choose “latest,” “first,” or `001` implicitly.

## Agent Routing Table

| Phase | Agent | Recommended Class | MCP Tools | Required Input | Output Artifact |
|-------|-------|-------------------|-----------|----------------|-----------------|
| Init | @specky-sdd-init | Fast | `sdd_init`, `sdd_scan_codebase` | explicit use-case selection | Constitution + signed v5 feature state |
| Discover | @specky-research-analyst | Balanced | `sdd_discover`, import/research tools | lifecycle-specific evidence | Research/discovery evidence |
| Specify | @specky-spec-engineer | Reasoning-focused | write/validate spec | discovery answers | Specification |
| Clarify | @specky-sdd-clarify | Reasoning-focused | clarify/validate | Specification | questions and revisions |
| Design | @specky-design-architect | Reasoning-focused | design + grounded diagrams | complete common/workload design | Design + contracted diagrams |
| Tasks | @specky-task-planner | Balanced | tasks/checklists | Design | traced task graph |
| Analyze | @specky-quality-reviewer | Balanced | analysis/compliance/sync | task and evidence artifacts | computed gate |
| Implement | @specky-implementer | Balanced | implementation, executable tests, IaC/env | `APPROVE` gate and capabilities | implementation evidence |
| Verify | @specky-test-verifier | Reasoning-focused | verify tests/tasks/sync | machine results and code paths | Verification |
| Release | @specky-release-engineer | Fast | PR/docs/work items | release/work-item capabilities | release payloads |

Only route a phase if it appears in `contract.phases`. Only route capability tools when that capability and its complete parameter object are persisted.

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

When `.specky/config.yml` sets `pipeline.require_lgtm: true`, Specify, Design, and Tasks require `lgtm: true` on advancement:

1. Phase agent completes and writes artifact
2. specky-lgtm-gate.sh runs → prints artifact summary
3. Orchestrator asks: "Review [ARTIFACT]. Reply 'LGTM' to proceed."
4. If LGTM → call sdd_advance_phase → next agent
5. If feedback → route back to phase agent for revision
6. Loop until LGTM received

If the flag is false, do not fabricate an approval requirement. Approval evidence is still useful, but the server policy controls blocking.

## Branch and Checkpoint Policy

Branch prefix/base/draft and checkpoint policy come from `capability_config.release`. Branch tools are not available in Init. Do not assume `develop`, `stage`, `main`, or `spec/` unless persisted in the release contract.

## Phase Transition Checklist

Before calling sdd_advance_phase, verify:
1. ✅ Required artifact exists (PHASE_REQUIRED_FILES)
2. ✅ Artifact has minimum quality (specky-phase-gate.sh passed)
3. ✅ LGTM supplied when configuration requires it
4. ✅ Branch matches persisted release policy when release capability is enabled
5. ✅ Checkpoint created when persisted policy requires it
6. ✅ No blocking hook failures
