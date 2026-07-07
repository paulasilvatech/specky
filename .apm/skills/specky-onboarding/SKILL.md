---
name: specky-onboarding
description: "This skill should be used when the user asks 'help me with specky', 'what is specky', 'how to use specky', 'specky onboarding', 'get started', or needs guidance on project setup, work modes, or available agents/tools/prompts. Also trigger on '@specky', 'specky help', or 'show me specky commands'."
---

# Specky SDD Onboarding Guide

## Overview

Specky SDD is a Spec-Driven Development CLI toolkit with 58 MCP tools, 13 agents, 22 prompts, 8 skills, and 16 hook scripts. It enforces a 10-phase pipeline from requirements through release.

## 5-Step Wizard Flow

### Step 1: Detect Context
Check for:
- `.specs/` directory → existing pipeline, offer resume
- `.sdd-state.json` → current phase state
- `*.vtt`, `*.srt` files → meeting transcripts available
- `src/`, `package.json`, `*.py` → existing codebase
- Empty workspace → fresh start

### Step 2: Project Type
- **Greenfield** → New project from scratch → /specky-greenfield
- **Brownfield** → Add features to existing code → /specky-brownfield
- **Modernization** → Migrate/upgrade existing system → /specky-migration
- **API Design** → Design an API specification → /specky-api

### Step 3: Input Source
- **Documents** → sdd_import_document, sdd_batch_import
- **Transcripts** → sdd_import_transcript, sdd_auto_pipeline (end-to-end)
- **Figma** → sdd_figma_to_spec
- **Nothing** → sdd_discover (7 guided questions)

### Step 4: Work Mode
- **Full Pipeline** → @specky-orchestrator coordinates all 10 phases
- **Agent-by-agent** → User picks agents manually
- **Direct MCP tools** → User calls sdd_* tools directly

### Step 5: Branch Setup
- **Auto** → `git checkout develop && git checkout -b spec/NNN-feature`
- **Manual** → Show git commands
- **Skip** → No branching (solo/prototype work)

## All 13 Agents

| Agent | Phase | Purpose |
|-------|-------|---------|
| @specky-onboarding | Pre | Interactive wizard and help |
| @specky-orchestrator | All | Full pipeline coordinator |
| @specky-sdd-init | 0 | Initialize pipeline + create spec branch |
| @specky-research-analyst | 1 | Codebase scan + discovery |
| @specky-spec-engineer | 2 | Write SPECIFICATION.md with EARS |
| @specky-sdd-clarify | 3 | Resolve ambiguities + EARS validation |
| @specky-design-architect | 4 | Write DESIGN.md + diagrams |
| @specky-task-planner | 5 | Write TASKS.md + CHECKLIST.md |
| @specky-quality-reviewer | 6 | Completeness audit + compliance |
| @specky-implementer | 7 | Implementation plan + test stubs + IaC |
| @specky-test-verifier | 8 | Coverage + drift + phantom detection |
| @specky-requirements-engineer | Pre | FRD + NFRD from raw input |
| @specky-release-engineer | 9 | Gates + PR + docs + work items |

## All 22 Prompts

**Quick Start:**
- /specky-onboarding — Interactive wizard
- /specky-orchestrate — Full pipeline
- /specky-greenfield — New project
- /specky-brownfield — Existing codebase
- /specky-migration — System migration
- /specky-api — API design

**Pipeline Phases:**
- /specky-research — Phase 1 (Discover)
- /specky-specify — Phase 2 (Specify)
- /specky-clarify — Phase 3 (Clarify)
- /specky-design — Phase 4
- /specky-tasks — Phase 5
- /specky-implement — Phase 7 (Implement)
- /specky-verify — Phase 8 (Verify)
- /specky-release — Phase 9
- /specky-deploy — Deployment artifacts

**Special:**
- /specky-from-figma — Import Figma designs
- /specky-from-meeting — Import meeting transcripts
- /specky-check-drift — Detect spec-code drift
- /specky-resolve-conflict — Resolve spec conflicts

**Debug:**
- /specky-debug-hook — Debug hook execution
- /specky-pipeline-status — Check pipeline status
- /specky-reset-phase — Reset a pipeline phase

## All 8 Skills

| Skill | Triggers On |
|-------|-------------|
| specky-sdd-pipeline | "specky", "SDD pipeline", "EARS notation", "pipeline phases" |
| specky-orchestrator | "orchestrate", "run full pipeline", "advance phase" |
| specky-onboarding | "help", "get started", "what is specky" |
| implementer | "implementation plan", "test stubs", "IaC generation" |
| test-verifier | "verify tests", "check coverage", "phantom detection" |
| release-engineer | "prepare release", "create PR", "release gates" |
| research-analyst | "research codebase", "scan tech stack", "import documents" |
| specky-sdd-markdown-standard | "artifact format", "spec formatting" |

## 58 MCP Tools by Category

**Pipeline Core (8):** sdd_init, sdd_discover, sdd_write_spec, sdd_clarify, sdd_write_design, sdd_write_tasks, sdd_run_analysis, sdd_advance_phase

**Input/Conversion (6):** sdd_import_transcript, sdd_auto_pipeline, sdd_batch_transcripts, sdd_import_document, sdd_batch_import, sdd_figma_to_spec

**Quality/Validation (5):** sdd_checklist, sdd_verify_tasks, sdd_compliance_check, sdd_cross_analyze, sdd_validate_ears

**Visualization (4):** sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram

**Infrastructure (3):** sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile

**Environment (3):** sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer

**Integration/Export (5):** sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research

**Documentation (5):** sdd_generate_docs, sdd_generate_api_docs, sdd_generate_runbook, sdd_generate_onboarding, sdd_generate_all_docs

**Testing (3):** sdd_generate_tests, sdd_verify_tests, sdd_generate_pbt

**Turnkey (1):** sdd_turnkey_spec

**Checkpointing (3):** sdd_checkpoint, sdd_restore, sdd_list_checkpoints

**Utility (8):** sdd_get_status, sdd_get_template, sdd_write_bugfix, sdd_scan_codebase, sdd_amend, sdd_check_ecosystem, sdd_check_sync, sdd_metrics

**Governance (4):** sdd_model_routing, sdd_context_status, sdd_check_access, sdd_verify_audit

## 16 Hook Scripts

**Blocking (exit 2 = halt):**
- specky-artifact-validator.sh — Prerequisite .md files exist
- specky-phase-gate.sh — Output artifact created with quality
- specky-security-scan.sh — OWASP + secrets scan
- specky-release-gate.sh — 90% pass rate + artifact checks

**Advisory (exit 0 = warn):**
- specky-branch-validator.sh — Branch matches phase expectations
- specky-pipeline-guard.sh — Pipeline ordering / phase-skip guard
- specky-lgtm-gate.sh — Human review reminder at Phases 2/4/5
- specky-session-banner.sh — Session start pipeline-status banner
- specky-spec-sync.sh — Detect spec-code drift
- specky-auto-checkpoint.sh — Suggest checkpoint after writes
- specky-spec-quality.sh — Specification quality metrics
- specky-ears-validator.sh — EARS pattern compliance
- specky-task-tracer.sh — Task dependency graph
- specky-drift-monitor.sh — CONSTITUTION drift detection
- specky-cognitive-debt-alert.sh — Cognitive surrender detection
- specky-metrics-dashboard.sh — Quality metrics collection
