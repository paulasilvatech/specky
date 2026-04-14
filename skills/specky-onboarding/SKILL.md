---
name: Specky Onboarding Guide
description: "This skill should be used when the user asks 'help me with specky', 'what is specky', 'how to use specky', 'specky onboarding', 'get started', or needs guidance on project setup, work modes, or available agents/tools/prompts. Also trigger on '@specky', 'specky help', or 'show me specky commands'."
---

# Specky SDD Onboarding Guide

## Overview

Specky SDD is a Spec-Driven Development plugin with 57 MCP tools, 13 agents, 22 prompts, 8 skills, and 14 hook scripts. It enforces a 10-phase pipeline from requirements through release.

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
| @sdd-init | 0 | Initialize pipeline + create spec branch |
| @research-analyst | 1 | Codebase scan + discovery |
| @sdd-clarify | 2 | Resolve ambiguities + EARS validation |
| @spec-engineer | 3 | Write SPECIFICATION.md with EARS |
| @design-architect | 4 | Write DESIGN.md + diagrams |
| @task-planner | 5 | Write TASKS.md + CHECKLIST.md |
| @implementer | 6 | Implementation plan + test stubs + IaC |
| @test-verifier | 7 | Coverage + drift + phantom detection |
| @quality-reviewer | 8 | Completeness audit + compliance |
| @requirements-engineer | Pre | FRD + NFRD from raw input |
| @release-engineer | 9 | Gates + PR + docs + work items |

## All 22 Prompts

**Quick Start:**
- /specky-onboarding — Interactive wizard
- /specky-orchestrate — Full pipeline
- /specky-greenfield — New project
- /specky-brownfield — Existing codebase
- /specky-migration — System migration
- /specky-api — API design

**Pipeline Phases:**
- /specky-research — Phase 1
- /specky-clarify — Phase 2
- /specky-specify — Phase 3
- /specky-design — Phase 4
- /specky-tasks — Phase 5
- /specky-implement — Phase 6
- /specky-verify — Phase 7
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
| sdd-pipeline | "specky", "SDD pipeline", "EARS notation", "pipeline phases" |
| specky-orchestrator | "orchestrate", "run full pipeline", "advance phase" |
| specky-onboarding | "help", "get started", "what is specky" |
| implementer | "implementation plan", "test stubs", "IaC generation" |
| test-verifier | "verify tests", "check coverage", "phantom detection" |
| release-engineer | "prepare release", "create PR", "release gates" |
| research-analyst | "research codebase", "scan tech stack", "import documents" |
| sdd-markdown-standard | "artifact format", "spec formatting" |

## 57 MCP Tools by Category

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

**Governance (3):** sdd_model_routing, sdd_context_status, sdd_check_access

## 14 Hook Scripts

**Blocking (exit 2 = halt):**
- artifact-validator.sh — Prerequisite .md files exist
- phase-gate.sh — Output artifact created with quality
- security-scan.sh — OWASP + secrets scan
- release-gate.sh — 90% pass rate + artifact checks

**Advisory (exit 0 = warn):**
- branch-validator.sh — Branch matches phase expectations
- lgtm-gate.sh — Human review reminder at Phases 3/4/5
- auto-checkpoint.sh — Suggest checkpoint after writes
- spec-sync.sh — Detect spec-code drift
- spec-quality.sh — Specification quality metrics
- ears-validator.sh — EARS pattern compliance
- task-tracer.sh — Task dependency graph
- drift-monitor.sh — CONSTITUTION drift detection
- cognitive-debt-alert.sh — Cognitive surrender detection
- metrics-dashboard.sh — Quality metrics collection
