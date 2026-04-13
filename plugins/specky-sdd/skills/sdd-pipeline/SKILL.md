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
