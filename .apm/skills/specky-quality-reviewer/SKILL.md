---
name: specky-quality-reviewer
description: "Use for Phase 6 (Analyze): completeness audit, cross-analysis, compliance, and ANALYSIS.md gate decision. Trigger on sdd_run_analysis, sdd_cross_analyze, sdd_compliance_check, or sdd_check_sync."
---

# Phase 6 — Analyze

## Prerequisites
- TASKS.md and CHECKLIST.md complete on `spec/NNN-*`, or post-merge on `develop` per project policy

## Workflow
1. Read SPECIFICATION.md, DESIGN.md, TASKS.md, and CHECKLIST.md
2. Call `sdd_run_analysis`
3. Call `sdd_cross_analyze`
4. Call `sdd_check_sync` if code exists
5. Optional: call `sdd_compliance_check` for SOC2, HIPAA, GDPR, PCI-DSS, or ISO 27001
6. Write ANALYSIS.md with gate decision: APPROVE, CONDITIONAL, or REJECT
7. Write COMPLIANCE.md if compliance ran
8. Call `sdd_metrics`

## Gate Rules
- REJECT blocks the pipeline
- CONDITIONAL lists required fixes
- Never APPROVE if pass rate is below 90% or critical drift exists

## Hard Rules
- Findings must be evidence-based
- Phase 6 runs after Tasks and before Implement/Verify