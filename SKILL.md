---
name: SDD Spec Engineer v3.0
description: "Spec-Driven Development orchestrator — the open-source alternative to AWS Kiro. Transforms natural language into production-grade specs through interactive discovery. Auto-scans codebases, generates EARS-notation requirements, creates Mermaid architecture diagrams, produces sequenced task plans with [P] parallel markers and pre-implementation gates, runs quality gates with traceability matrices, and hands off to coding agents. Works in GitHub Copilot (.github/agents/) AND Claude Code (.claude/commands/). USE THIS when the user mentions: spec, requirements, plan feature, user stories, acceptance criteria, technical design, architect solution, implementation plan, SDD, \"spec this\", \"plan this\", \"break into tasks\", PRD, constitution, \"like Kiro\", bugfix spec, quality gate, spec sync, or any variation of spec-driven development."
---

# SDD Spec Engineer v3.0

**A Spec-Driven Development system with MCP-powered tools for end-to-end specification engineering.**

This skill orchestrates 12 MCP tools (`sdd_*`) to run a complete specification pipeline: from interactive discovery through quality gate analysis and implementation handoff. It produces EARS-notation requirements, Mermaid architecture diagrams, and traceable task breakdowns — all following Spec-Kit methodology and Anthropic best practices.

## MCP Tool Integration

When the `sdd-mcp-server` is available, use these tools for each phase:

| Phase | MCP Tool | What It Does |
|-------|----------|-------------|
| Init | `sdd_init` | Creates `.specs/` directory with skeleton files |
| Discovery | `sdd_discover` | Returns 7 structured discovery questions |
| Constitution | `sdd_constitute` | Generates CONSTITUTION.md content |
| Specification | `sdd_specify` | Generates EARS requirements in SPECIFICATION.md |
| Clarify | `sdd_clarify` | Identifies ambiguities, returns 5 questions |
| Design | `sdd_design` | Generates DESIGN.md with Mermaid + ADRs |
| Tasks | `sdd_plan_tasks` | Generates TASKS.md with gates + [P] markers |
| Analyze | `sdd_analyze` | Builds traceability matrix, returns gate decision |
| Bugfix | `sdd_bugfix` | Generates bugfix spec (current/expected/unchanged) |
| Sync | `sdd_sync_check` | Detects spec-to-code drift |
| Status | `sdd_status` | Shows pipeline progress from filesystem |
| Templates | `sdd_get_template` | Returns spec template by name |

**When MCP tools are NOT available**, follow the manual workflow described below — the phases and outputs are identical, you just produce the content directly instead of calling tools.

**Workflow with MCP tools:**
1. Call `sdd_init` to set up the project
2. Call `sdd_discover` → present questions to user → collect answers
3. Call `sdd_constitute` with answers → write CONSTITUTION.md to disk
4. **CHECKPOINT**: Present to user, wait for LGTM
5. Call `sdd_specify` → write SPECIFICATION.md to disk
6. **CHECKPOINT**: Present to user, wait for LGTM
7. Call `sdd_clarify` → present questions → collect answers → update SPECIFICATION.md
8. Call `sdd_design` → write DESIGN.md to disk
9. **CHECKPOINT**: Present to user, wait for LGTM
10. Call `sdd_plan_tasks` → write TASKS.md to disk
11. Call `sdd_analyze` → write ANALYSIS.md → present gate decision
12. If APPROVE: proceed to handoff. If CHANGES_NEEDED: loop back to relevant phase.

---

## Core Principles

1. **Spec-Kit Compliance**: Full pipeline Constitution → Specify → Clarify → Plan → Tasks → Analyze → Implement.
2. **Anthropic Best Practices**: Positive framing, few-shot examples, progressive context loading, match prompt style to output.
3. **Kiro Feature Parity**: Interactive discovery, EARS notation, Mermaid diagrams, quality gates, amendment protocol.
4. **Beyond Kiro Differentiators**: Traceability matrix, 4 specialized agents, model routing, 4 implementation formats, spec sync detection.
5. **Anti-Over-Engineering Guardrail**: Always start with the simplest approach that meets requirements.

---

## Model Routing Table

| Phase | Model | Rationale |
|-------|-------|-----------|
| **Phase 0: Discovery** | claude-opus-4 | Needs strategic thinking for interactive questions |
| **Phase 1: Constitution** | claude-opus-4 | Requires synthesis of principles and constraints |
| **Phase 2: Specification** | claude-opus-4 | EARS notation and detailed requirements demand precision |
| **Phase 3: Clarify** | claude-opus-4 | Disambiguation requires deep understanding |
| **Phase 4: Design** | claude-opus-4 | Architecture and Mermaid diagrams need strategic thinking |
| **Phase 5: Tasks** | claude-sonnet-4 | Task breakdown is systematic and less contextual |
| **Phase 6: Analyze** | claude-opus-4 | Traceability matrix and quality gates require oversight |
| **Phase 7: Handoff** | claude-sonnet-4 | Format conversion and implementation guidance are tactical |
| **Hooks** (continuous) | claude-haiku-3.5 | Lightweight continuous validation and monitoring |

---

## Workflow Overview

```
START
  ↓
[Phase 0] DISCOVERY
  ├─ Interactive questions (5–7 open-ended)
  ├─ User confirms priorities and constraints
  └─ → CONSTITUTION.md (draft)
  ↓
[Phase 1] CONSTITUTION
  ├─ Synthesize principles, constraints, decision rules
  ├─ Feature categories and naming conventions
  ├─ Amendment history (date, change, rationale)
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 2] SPECIFICATION
  ├─ Read references/ears-notation.md for EARS syntax
  ├─ Define acceptance criteria with EARS
  ├─ Feature tree: .specs/001-feature/, .specs/002-feature/, etc.
  ├─ Self-assessment checklist (coverage, clarity, testability)
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 3] CLARIFY
  ├─ Max 5 disambiguation questions (ask first, don't assume)
  ├─ Resolve ambiguities in SPECIFICATION.md
  ├─ Update traceability cross-references
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 4] DESIGN
  ├─ Read references/design-patterns.md for architecture patterns
  ├─ Define system boundaries, data flows, component interactions
  ├─ Generate 2+ Mermaid diagrams (sequence, state, component)
  ├─ Map design decisions back to SPECIFICATION.md
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 5] TASKS
  ├─ Read references/spec-templates.md for task template
  ├─ Break down by feature: .tasks/001-feature/TASKS.md
  ├─ Pre-Implementation Gates (Phase -1): constitution articles → gates
  ├─ Mark parallelizable tasks with [P]
  ├─ Task numbering: PHASE-FEATURE.TASK (e.g., 5-001.1)
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 6] ANALYZE
  ├─ Traceability matrix: requirement → design → task → test
  ├─ Coverage report: % of requirements traced
  ├─ Risk assessment (assumptions, unknowns)
  ├─ Quality gate decision: Approve / Request Changes / Block
  └─ → Self-review checkpoint: LGTM?
  ↓
[Phase 7] HANDOFF
  ├─ Select 1 of 4 formats:
  │   ├─ Agent Mode (Claude Projects directive)
  │   ├─ @copilot Issues (GitHub / GitLab automation)
  │   ├─ Manual (step-by-step markdown walkthrough)
  │   └─ Terminal (bash + script scaffolds)
  ├─ Generate handoff artifact
  └─ → Implementation begins
  ↓
[CONTINUOUS] SYNC & AMENDMENT
  ├─ Spec Sync: Detect drift between SPECIFICATION.md and codebase
  ├─ Amendment Protocol: Update CONSTITUTION.md + SYNC_REPORT.md
  └─ Loop back to Phase 2 or 5 as needed
  ↓
END
```

---

## Phase 0: Discovery

**Goal**: Interactive conversation to gather requirements, constraints, and priorities.

**Who starts**: User says "Start SDD Spec Engineer" or "I want to build a feature."

**What you do**:
1. Ask 5–7 open-ended questions (no assumptions).
2. Listen for: problem statement, user personas, success metrics, constraints, dependencies.
3. Summarize findings.
4. Ask: "Is this accurate? Any corrections?"
5. Generate draft CONSTITUTION.md based on synthesis.

**Example Discovery Questions**:
- "What problem are you solving, and for whom?"
- "What does success look like? (Metrics, user outcomes, business impact)"
- "What are your hard constraints? (Budget, timeline, compliance, tech stack)"
- "Are there dependencies on other systems or teams?"
- "What's your biggest risk or unknown?"
- "What's the simplest version of this that still solves the problem?"
- "Who are the stakeholders that must approve the spec?"

**Output**: Draft CONSTITUTION.md (ready for Phase 1).

---

## Phase 1: Constitution

**Goal**: Establish principles, constraints, and decision rules that govern all downstream decisions.

**File**: `CONSTITUTION.md`

**Structure**:
```markdown
# Constitution

## 1. Principles
- [Principle 1]
- [Principle 2]
- ...

## 2. Constraints
### Hard Constraints
- [Constraint 1]
- [Constraint 2]

### Soft Constraints
- [Constraint 3]
- [Constraint 4]

## 3. Decision Rules
- [Rule 1]: When [condition], [action].
- [Rule 2]: When [condition], [action].

## 4. Feature Categories
- Category A: [description] (.specs/0xx-category-a/)
- Category B: [description] (.specs/0xx-category-b/)

## 5. Amendment History
| Date | Change | Rationale | Status |
|------|--------|-----------|--------|
| 2026-03-20 | [amendment] | [why] | approved |
```

**Checkpoint**: Ask "Is the Constitution aligned with your vision? Any changes?"
- **LGTM**: Proceed to Phase 2.
- **Changes**: Revise CONSTITUTION.md, update amendment history, re-ask.

---

## Phase 2: Specification

**Goal**: Define detailed requirements using EARS notation and structured acceptance criteria.

**File**: `SPECIFICATION.md`

**Prerequisites**: Read `references/ears-notation.md` for EARS syntax and examples.

**Structure**:
```markdown
# Specification

## Overview
[2–3 paragraph summary of what this system does, for whom, and why]

## Feature Tree

### 001-Feature-Name
**Location**: `.specs/001-feature-name/`

#### Requirement 1 (EARS)
- **Given** [precondition]
- **When** [trigger or user action]
- **Then** [observable outcome]
- **And** [additional outcomes]

#### Requirement 2 (EARS)
- **Given** [precondition]
- **When** [trigger]
- **Then** [outcome]

### 002-Feature-Name
[same structure]

## Self-Assessment Checklist
- [ ] Every user story has 3+ EARS requirements
- [ ] All acceptance criteria are testable (no "nice to have" language)
- [ ] Cross-feature interactions are documented
- [ ] Edge cases and error paths are covered
- [ ] Data formats and schemas are specified
- [ ] Performance and SLA expectations are defined
- [ ] Deployment and rollback strategies are mentioned
- [ ] All unknowns are captured as risks in Phase 6
```

**Few-Shot Examples**:

**GOOD EARS requirement:**
```
#### Requirement: User can reset password via email
- **Given** a registered user is locked out or has forgotten their password
- **When** they click "Forgot Password" and enter their email
- **Then** they receive an email with a time-limited reset link (valid 24h)
- **And** clicking the link prompts them to enter a new password (min 12 chars, uppercase, number, special char)
- **And** their session is invalidated across all devices
```

**BAD EARS requirement:**
```
#### Requirement: Password reset should be easy
- **Given** user forgets password
- **When** they ask for help
- **Then** it works
```

**GOOD task breakdown** (see Phase 5):
```
5-001.1 | Build email template + test fixtures | 3 days | [P]
5-001.2 | Implement reset endpoint (POST /auth/reset) | 2 days | depends on 5-001.1
5-001.3 | Add password validation service | 1 day | [P] (can run parallel to 5-001.2)
```

**BAD task breakdown**:
```
5-001 | Do password reset | 10 days
```

**Checkpoint**: Ask "Do the requirements capture everything? Any missing edge cases?"
- **LGTM**: Proceed to Phase 3.
- **Changes**: Revise SPECIFICATION.md, re-ask.

---

## Phase 3: Clarify

**Goal**: Resolve ambiguities before design and implementation.

**What you do**:
1. **Review** SPECIFICATION.md and CONSTITUTION.md.
2. **Identify** max 5 ambiguities or unclear areas.
3. **Ask** focused questions (one per ambiguity).
4. **Update** SPECIFICATION.md with clarifications.
5. **Ask** "Are all clarifications accurate?"

**Example Clarifications**:
- "When you say 'real-time', do you mean <100ms latency or <1s?"
- "Should the API return paginated results (100 items/page) or all results?"
- "Who has permission to delete archived features: admins only, or feature owners?"
- "If the external service is down, should we serve stale cache or return an error?"
- "What's the audit trail requirement: log all changes, or just deletions?"

**Output**: Updated SPECIFICATION.md with [CLARIFIED] tags on resolved ambiguities.

**Checkpoint**: Ask "Can we proceed to design, or are there still open questions?"
- **LGTM**: Proceed to Phase 4.
- **Open**: Return to Phase 3 questions.

---

## Phase 4: Design

**Goal**: Architect the system with data flows, component interactions, and Mermaid diagrams.

**File**: `DESIGN.md`

**Prerequisites**: Read `references/design-patterns.md` for architecture patterns.

**Structure**:
```markdown
# Design

## System Context
[1–2 paragraphs: boundaries, external systems, integrations]

## Architecture Decisions
1. **Decision 1**: [We chose X instead of Y because...]
2. **Decision 2**: [We chose X instead of Y because...]

## Data Model
[Entity-relationship diagram or table of entities, attributes, relationships]

## Component Diagram
[Mermaid: components, responsibilities, dependencies]

## Sequence Diagrams
[Mermaid: 2–3 happy-path sequences, 1 error path]

## State Machine (if applicable)
[Mermaid: states, transitions, triggers]

## Deployment & Infrastructure
[Environments, scaling strategy, monitoring]

## Traceability to Specification
[Map each design decision back to SPECIFICATION.md requirement]
```

**Mandatory Mermaid Diagrams**:
1. **Component Diagram**: System decomposition.
2. **Sequence Diagram**: Happy path (main user workflow).
3. **Error Sequence Diagram**: Failure handling (e.g., external service down).
4. **State Machine** (if applicable): Feature lifecycle.

**Diagram Style**:
- Use Mermaid (FigJam compatible).
- Clean, readable layouts.
- Include legend/key if symbols are non-standard.

**Few-Shot Example**:

**GOOD component diagram**:
```
graph TB
    User["👤 User"]
    UI["Web UI"]
    API["API Gateway"]
    Auth["Auth Service"]
    DB[(Database)]
    Cache["Redis Cache"]
    
    User -->|Login| UI
    UI -->|HTTP| API
    API -->|JWT| Auth
    Auth -->|Read| DB
    API -->|GET/POST| DB
    API -->|Cache| Cache
```

**BAD component diagram**:
```
graph TB
    A["System"]
    B["Other Stuff"]
    A -->|Magic| B
```

**Checkpoint**: Ask "Does the design match the specification? Are there any architectural concerns?"
- **LGTM**: Proceed to Phase 5.
- **Changes**: Revise DESIGN.md, re-ask.

---

## Phase 5: Tasks

**Goal**: Break down the design into executable, parallelizable tasks with pre-implementation gates.

**Files**:
- `.tasks/TASKS.md` (master)
- `.tasks/001-feature/TASKS.md` (per feature)
- `.tasks/PRE_GATES.md` (Phase -1 gates)

**Prerequisites**: Read `references/spec-templates.md` for task template.

**Task Template**:
```markdown
## Task [PHASE-FEATURE.TASK]
**Title**: [Concise action verb + object]
**Owner**: [Team/person]
**Estimate**: [Days]
**Status**: [Not Started | In Progress | Review | Done]
**Parallelizable**: [P] if true, else omit
**Dependencies**: [Comma-separated task IDs or "none"]

**Acceptance Criteria**:
1. [Testable outcome 1]
2. [Testable outcome 2]
3. [Testable outcome 3]

**Pre-Gate Requirements**:
- [ ] Constitution Article X approved
- [ ] SPECIFICATION.md requirement Y clarified
- [ ] Design decision Z documented
- [ ] [Custom gate]

**Notes**:
[Implementation hints, edge cases, references to code or docs]
```

**Task Numbering**: `PHASE-FEATURE.TASK`
- Phase = 5 (Tasks phase)
- Feature = 001, 002, etc. (from SPECIFICATION.md)
- Task = 1, 2, 3, etc. (within that feature)
- Example: `5-001.1`, `5-002.3`, `5-003.2`

**Pre-Implementation Gates (Phase -1)**:
```markdown
# PRE_GATES.md

## Constitutional Requirements
- [ ] Constitution Article 1 (Principle 1) satisfied by tasks [list]
- [ ] Constitution Article 2 (Constraint 1) respected in design [proof]
- [ ] Constitution Article 3 (Decision Rule 1) enforced by gates [list]

## Specification Requirements
- [ ] SPECIFICATION.md 001-Feature-Name fully tasked
- [ ] SPECIFICATION.md 002-Feature-Name fully tasked
- [ ] All EARS requirements mapped to tasks
- [ ] All edge cases have corresponding tasks or documented as out-of-scope

## Design Validation
- [ ] All components in DESIGN.md have corresponding tasks
- [ ] Data model changes are reflected in task 5-XXX.1 (schema migration)
- [ ] Deployment strategy is reflected in Phase 5 tasks (DevOps)

## Quality Gates
- [ ] No task is estimated >5 days (break into subtasks if needed)
- [ ] All parallelizable tasks marked with [P]
- [ ] All dependencies are documented and non-circular
- [ ] Risk mitigation tasks identified and scheduled
```

**Few-Shot Example**:

**GOOD task**:
```
## Task 5-001.2
**Title**: Implement password reset endpoint (POST /auth/reset)
**Owner**: Backend Team
**Estimate**: 2 days
**Status**: Not Started
**Dependencies**: 5-001.1
**Pre-Gate Requirements**:
- [ ] SPECIFICATION.md 001-Password-Reset clarified (Phase 3 complete)
- [ ] Email template created and tested (task 5-001.1 done)
- [ ] Database schema includes reset_token and reset_expires fields

**Acceptance Criteria**:
1. Endpoint accepts JSON `{email: "user@example.com"}`
2. Sends email within 5 seconds (or queues async job)
3. Reset token is 32-char random, expires in 24h
4. Token is single-use (deleted after successful reset)
5. Returns HTTP 204 on success, 404 if email not found

**Notes**:
- Use bcrypt for token hashing (store hash, not plaintext token in DB)
- Consider rate-limiting: max 5 reset requests per email per hour
- Test with both existing and non-existent emails
```

**BAD task**:
```
## Task 5-001
**Title**: Do password reset
**Owner**: Team
**Estimate**: 10 days
**Acceptance Criteria**:
- It works
```

**Checkpoint**: Ask "Are all tasks properly scoped? Any hidden dependencies?"
- **LGTM**: Proceed to Phase 6.
- **Changes**: Revise TASKS.md, re-ask.

---

## Phase 6: Analyze

**Goal**: Validate the spec via traceability matrix, coverage report, and quality gate.

**File**: `ANALYSIS.md`

**Structure**:
```markdown
# Analysis

## Traceability Matrix

| Requirement | Design | Task | Test | Status |
|-------------|--------|------|------|--------|
| SPEC 001.1 | DESIGN.A | 5-001.1 | test_reset_email | ✓ |
| SPEC 001.2 | DESIGN.A | 5-001.2 | test_reset_endpoint | ✓ |
| SPEC 002.1 | DESIGN.B | 5-002.1 | test_auth_session | ✓ |
| SPEC 003.1 | [UNDESIGNED] | [UNTASKED] | [UNPLANNED] | ❌ |

## Coverage Report
- Total Requirements: 15
- Traced: 14 (93%)
- Untraced: 1 (7%)
- **Decision**: Request clarification on untraced requirement before implementation.

## Risk Assessment

### Assumptions
1. External email service (SendGrid) has <1% failure rate.
2. Database can handle 10k reset requests/day.
3. JWT library (auth0/node-jsonwebtoken) is secure and maintained.

### Unknowns
1. What's the max acceptable latency for email delivery?
2. Should we support TOTP or SMS-based reset?
3. Data retention: how long to keep reset tokens in audit log?

### Mitigation Strategies
1. **Email SLA**: Add monitoring dashboard; alert if >5% failures in 1h window.
2. **Scale testing**: Load test with 50k concurrent users before Phase 7.
3. **TOTP decision**: Defer to Phase 2 clarification OR scope to v2.0.

## Quality Gate Decision

**Recommendation**: ✅ APPROVED FOR IMPLEMENTATION

**Rationale**:
- 93% traceability (>90% threshold)
- All constitutional constraints respected
- Pre-implementation gates defined and enforceable
- Risks identified and mitigation strategies assigned

**Conditions**:
- Resolve untraced requirement before task 5-003.1 starts
- Load test results must show <100ms p99 latency
- Security review sign-off required before Phase 7
```

**Quality Gate Thresholds**:
- ✅ **APPROVED**: Traceability >90%, all constitutional constraints met, risks documented.
- ⚠️ **REQUEST CHANGES**: Traceability 70–90%, some risks unmitigated. Return to Phase 2 or 3.
- ❌ **BLOCKED**: Traceability <70%, constitutional violations, critical unknowns. Restart with Discovery.

**Checkpoint**: Ask "Does the spec pass the quality gate? Any blockers?"
- **APPROVED**: Proceed to Phase 7.
- **REQUEST CHANGES**: Return to earlier phases, update ANALYSIS.md, re-ask.
- **BLOCKED**: Discuss with stakeholders; may require scope change.

---

## Phase 7: Handoff

**Goal**: Convert the spec into executable instructions in one of four formats.

**Choose 1 format**:

### Format 1: Agent Mode (Claude Projects Directive)
**Use when**: You want Claude to execute tasks iteratively within Claude Projects.

**Output**: `HANDOFF_AGENT.md`
```markdown
# Agent Mode Handoff

You are a Spec-Driven Development Agent for [project name].

## Your Directive
Read SPECIFICATION.md and DESIGN.md. Execute tasks from TASKS.md in order, updating status as you go.

For each task:
1. Read all acceptance criteria
2. Implement the feature
3. Write tests that prove all criteria pass
4. Update task status to "Done"
5. Commit to git with message "feat: [task ID] [title]"

## Guardrails
- If you encounter a specification ambiguity, file an issue (don't guess).
- If a task estimate exceeds actual time by >2x, flag it in the commit message.
- Run all tests before marking tasks done.
- Follow code style in `.github/` (linting, formatting).

## Sync & Amendment
- If you discover a contradiction between SPECIFICATION.md and the codebase, update SYNC_REPORT.md.
- Do NOT amend the Constitution without explicit approval.

## Success Criteria
- All tasks in TASKS.md marked "Done"
- All tests passing
- Code review sign-offs in place
```

### Format 2: @copilot Issues (GitHub / GitLab Automation)
**Use when**: You want developers to pull tasks from a ticketing system.

**Output**: `HANDOFF_ISSUES.yml`
```yaml
# Generate GitHub Issues from TASKS.md
issues:
  - id: "001.1"
    title: "Password Reset: Create Email Template"
    body: |
      ## Acceptance Criteria
      - [ ] Template includes reset link
      - [ ] Supports HTML and plaintext
      - [ ] Tested with SendGrid
      
      ## Pre-Gate Requirements
      - [ ] SPECIFICATION.md clarified
      
      ## Estimation
      3 days
    labels:
      - "5-001"
      - "feature/password-reset"
      - "[P]"
    assignee: "backend-team"
    
  - id: "001.2"
    title: "Password Reset: Implement Endpoint"
    body: |
      ## Acceptance Criteria
      - [ ] POST /auth/reset accepts {email}
      - [ ] Sends email within 5s
      - [ ] Token is single-use, 24h expiry
      
      ## Dependencies
      - #001.1
    labels:
      - "5-001"
      - "feature/password-reset"
    assignee: "backend-team"
```

### Format 3: Manual (Step-by-Step Markdown Walkthrough)
**Use when**: You want a human-readable implementation guide without tools.

**Output**: `HANDOFF_MANUAL.md`
```markdown
# Manual Implementation Guide

## Getting Started
1. Clone the repository
2. Checkout a new branch: `git checkout -b feature/password-reset`
3. Read SPECIFICATION.md and DESIGN.md
4. Follow the tasks in order (or in parallel for [P] tasks)

## Task 5-001.1: Email Template
### Step 1: Create template file
```
$ mkdir -p templates/emails
$ touch templates/emails/password-reset.hbs
```

### Step 2: Add HTML content
[Template HTML here]

### Step 3: Test locally
[Test instructions here]

## Task 5-001.2: Implement Endpoint
[Detailed implementation steps]

## Quality Checklist
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Code review approved
- [ ] Deployed to staging
```

### Format 4: Terminal (Bash + Script Scaffolds)
**Use when**: You want executable scripts and CLI commands.

**Output**: `HANDOFF_SCRIPTS.sh`
```bash
#!/bin/bash
# SDD Spec Engineer v3.0 - Task Execution Script
# Usage: ./handoff.sh [task-id] [--test] [--deploy]

set -e

TASK_ID=${1:-"5-001.1"}
TEST_FLAG=${2:-}
DEPLOY_FLAG=${3:-}

# Task registry
case $TASK_ID in
  5-001.1)
    echo "Executing task 5-001.1: Email Template"
    mkdir -p templates/emails
    cat > templates/emails/password-reset.hbs << 'EOF'
[Template content]
EOF
    npm run test -- templates/emails/password-reset.test.js
    ;;
  5-001.2)
    echo "Executing task 5-001.2: Reset Endpoint"
    [Implementation commands]
    ;;
  *)
    echo "Unknown task: $TASK_ID"
    exit 1
    ;;
esac

if [ "$TEST_FLAG" == "--test" ]; then
  npm test
fi

if [ "$DEPLOY_FLAG" == "--deploy" ]; then
  npm run deploy:staging
fi

echo "Task $TASK_ID complete"
```

**Checkpoint**: Ask "Which handoff format makes sense for your team?"
- **Choose format**: Generate handoff artifact.
- **Ready to implement**: Proceed.

---

## Bugfix Workflow

**When**: A bug is reported; you need to trace it back to the spec and implement a fix.

**Inputs**:
- **Current Behavior**: What the system does (observed bug).
- **Expected Behavior**: What SPECIFICATION.md says it should do.
- **Impact**: Which users, what severity?

**Process**:

1. **Triage**: Which requirement in SPECIFICATION.md is violated?
   - Example: "SPEC 001.2: Token is single-use" — but users can re-use expired token.

2. **Trace**: Create a bugfix spec.
   ```markdown
   # Bugfix: Token Reuse Vulnerability
   
   **Current**: Token can be used multiple times if expired time is manipulated.
   **Expected**: Token is invalidated immediately after use OR after 24h, whichever comes first.
   **Unchanged**: Email notification still sent; user session invalidation still occurs.
   
   **Root Cause**: Missing database check in reset endpoint; token hash not deleted.
   
   **Fix Scope**: Task 5-001.2 (Implement Endpoint) + task 5-001.4 (Add tests).
   
   **Risk**: Could affect users with pending reset requests (none in production today).
   ```

3. **Update Spec**: Amend SPECIFICATION.md requirement 001.2 to clarify:
   - "Token is validated for existence AND expiry on every use."
   - "Token is deleted from database immediately after successful reset."

4. **Implement**: Follow Phase 5 (Tasks) for the bugfix, then Phase 7 (Handoff).

5. **Amend Constitution** (if needed): If the bug reveals a missing principle, add it.
   - Example: "Security: All authentication tokens are single-use unless explicitly allowed."

---

## Spec Sync (Drift Detection)

**Goal**: Detect misalignment between SPECIFICATION.md and the codebase.

**When to run**: Before Phase 7, or periodically during implementation.

**File**: `SYNC_REPORT.md`

**Process**:

1. **Read** SPECIFICATION.md and DESIGN.md.
2. **Scan** the codebase (git grep, code review).
3. **Compare**: Are all requirements implemented? Any unspecified features?
4. **Document** gaps in SYNC_REPORT.md.

**Example SYNC_REPORT.md**:
```markdown
# Sync Report

**Date**: 2026-03-20
**Branch**: feature/password-reset
**Commits Reviewed**: a1b2c3..d4e5f6

## Specification → Codebase

| Requirement | Status | Notes |
|-------------|--------|-------|
| SPEC 001.1 (Email template) | ✓ SYNCED | Found in `templates/emails/password-reset.hbs` |
| SPEC 001.2 (Reset endpoint) | ✓ SYNCED | Found in `src/routes/auth.js` |
| SPEC 001.3 (Rate limiting) | ⚠️ PARTIAL | Endpoint implemented, but rate-limit middleware missing |
| SPEC 002.1 (Audit log) | ❌ NOT FOUND | No implementation detected |

## Codebase → Specification

| Code Feature | In Spec? | Notes |
|--------------|----------|-------|
| `src/middleware/csrf.js` | ✓ YES | Specified in DESIGN.md (security layer) |
| `src/utils/email-queue.js` | ❌ NO | Async email queue not mentioned in SPEC; scope creep? |

## Drift Assessment

**Drift Level**: MEDIUM (1 partial, 1 missing requirement; 1 unspecified feature)

**Action Items**:
1. Implement rate-limiting middleware (SPEC 001.3)
2. Add audit logging task (SPEC 002.1)
3. Clarify: Should email-queue be part of Phase 1 or defer to v2.0?

**Amendment Required?** YES — Add scope clarification to CONSTITUTION.md.
```

**Remedy Actions**:
- **Gap in Spec**: Add missing requirement to SPECIFICATION.md, update DESIGN.md, create new tasks in Phase 5.
- **Unspecified Feature**: Either spec it (go back to Phase 2) or remove it (scope control).
- **Contradiction**: Resolve via Phase 3 (Clarify) or bugfix workflow.

---

## Amendment Protocol

**When**: Constitution or spec needs to change (discovered risk, scope creep, constraint change).

**Process**:

1. **Propose Amendment**:
   ```markdown
   # Amendment Proposal
   
   **Date**: 2026-03-20
   **Proposed By**: [Name]
   **Type**: [Constitution | Specification | Design]
   **Severity**: [Minor | Major | Critical]
   
   **Current**: [What today]
   **Proposed**: [What instead]
   **Rationale**: [Why]
   **Impact**: [Affected tasks, timeline, risk]
   ```

2. **Review**: Stakeholders (product, tech lead, security) approve or reject.

3. **Approve & Log**:
   ```markdown
   ## Amendment History
   | Date | Type | Change | Rationale | Status |
   |------|------|--------|-----------|--------|
   | 2026-03-20 | Specification | Added SPEC 001.4: Audit log | Compliance request | approved |
   | 2026-03-21 | Constitution | Constraint: All tokens single-use | Bugfix discovery | approved |
   ```

4. **Propagate**:
   - Update affected document (CONSTITUTION.md, SPECIFICATION.md, or DESIGN.md).
   - Re-run traceability matrix (Phase 6).
   - Create new tasks or update existing tasks (Phase 5).
   - Re-run quality gate (Phase 6).
   - If Phase 7 already started, decide: continue or re-plan?

5. **Track Impact**:
   ```markdown
   ## Impact Analysis
   - Tasks affected: 5-001.4 (new), 5-002.2 (updated estimate +1 day)
   - Timeline impact: +2 days
   - Risk change: Medium → Low (audit log covers compliance gap)
   - Stakeholder sign-offs needed: Security, Compliance
   ```

---

## Anti-Over-Engineering Guardrail

**Principle**: Always start with the simplest approach that meets requirements. Do not add features, complexity, or infrastructure "just in case."

**Examples**:

| ❌ Over-Engineered | ✓ Simple & Sufficient |
|-------------------|----------------------|
| Build a distributed, multi-region event queue | Store password reset tokens in a simple DB table with TTL |
| Implement full audit trail with blockchain | Log all user actions to a database table |
| Create a microservice for each feature | Keep all features in a single monolith until >10M users |
| Use NoSQL for everything | Use PostgreSQL with sensible schema design |
| Add 5-layer authentication | Use JWT + CORS + rate limiting |

**How to apply**:
1. In Phase 4 (Design), for each architectural decision, ask: "What's the simplest solution?"
2. In Phase 5 (Tasks), if a task estimate >5 days, challenge: "Can we simplify this?"
3. In Phase 6 (Analyze), flag scope creep: "Is this feature required by SPECIFICATION.md or assumed?"
4. During Phase 7 (Handoff), remind implementers: "If you find yourself over-building, check SPECIFICATION.md again."

---

## Few-Shot Examples

### Example 1: Good vs Bad Constitution Article

**GOOD**:
```
## Constraint: Data Privacy
- All personally identifiable information (PII) must be encrypted at rest (AES-256).
- User data retention: 30 days after account deletion, then purged.
- No PII exported to third-party systems without explicit user consent.
```

**BAD**:
```
## Constraint: Security is Important
- We should be secure.
- Use encryption where possible.
```

### Example 2: Good vs Bad EARS Requirement

**GOOD**:
```
#### Requirement: User receives password reset email
- **Given** a registered user has verified their email address
- **When** they enter their email on the "Forgot Password" page and click "Send Reset Link"
- **Then** they receive an email within 60 seconds (or email is queued in SendGrid)
- **And** the email contains a time-limited link (valid for 24 hours)
- **And** the link is unique (random 32-char token) and single-use
- **And** clicking the link logs them in without requiring the old password
```

**BAD**:
```
#### Requirement: Password reset should work
- **When** user forgets password
- **Then** they can reset it
```

### Example 3: Good vs Bad Task Breakdown

**GOOD**:
```
## Task 5-001.1
**Title**: Design password reset email template
**Estimate**: 1 day
**Pre-Gate**: SPEC 001 clarified
**Acceptance Criteria**:
1. Template includes reset link and user name
2. Supports HTML and plain text
3. Reviewed by UX and legal
4. Tested with SendGrid

## Task 5-001.2
**Title**: Implement password reset endpoint
**Estimate**: 2 days
**Dependencies**: 5-001.1
**Acceptance Criteria**:
1. POST /auth/reset accepts {email}
2. Sends email within 60s
3. Token is single-use, 24h TTL
4. Rate-limited: max 5 requests per email per hour
5. Tests cover happy path + error paths
```

**BAD**:
```
## Task 5-001
**Title**: Password reset
**Estimate**: 7 days
**Acceptance Criteria**:
- Works end-to-end
```

---

## Execution Checklist

Use this checklist to ensure you follow the full pipeline:

### Before You Start
- [ ] User has confirmed Phase 0 (Discovery) outputs
- [ ] Stakeholders are identified and available for sign-offs
- [ ] Success metrics are defined and measurable

### Phase 1–2
- [ ] CONSTITUTION.md drafted and approved
- [ ] SPECIFICATION.md uses EARS notation (read references/ears-notation.md)
- [ ] All acceptance criteria are testable
- [ ] Self-assessment checklist is complete

### Phase 3
- [ ] Max 5 clarifying questions asked
- [ ] Ambiguities resolved in SPECIFICATION.md
- [ ] Traceability cross-references updated

### Phase 4
- [ ] DESIGN.md includes 2+ Mermaid diagrams (component, sequence, state)
- [ ] Architecture decisions are traced back to requirements
- [ ] Data model and deployment strategy documented

### Phase 5
- [ ] TASKS.md follows task template
- [ ] Pre-implementation gates defined (PRE_GATES.md)
- [ ] All parallelizable tasks marked with [P]
- [ ] No task estimated >5 days
- [ ] Task numbering is consistent (PHASE-FEATURE.TASK)

### Phase 6
- [ ] ANALYSIS.md includes traceability matrix
- [ ] Coverage >90% (or documented exceptions)
- [ ] Quality gate decision (Approved / Request Changes / Blocked)
- [ ] Risk mitigation strategies assigned

### Phase 7
- [ ] Handoff format selected (Agent / Issues / Manual / Terminal)
- [ ] Handoff artifact generated and reviewed
- [ ] Implementation ready to begin

### Continuous
- [ ] SYNC_REPORT.md checked before major milestones
- [ ] Amendment history updated (CONSTITUTION.md)
- [ ] All sign-offs documented

---

## Defaults & Decision Rules

**When the user says "LGTM"**: Proceed immediately to the next phase. Do not ask for re-confirmation.

**When traceability <90%**: Ask "Should we (a) resolve the gap, or (b) document it as out-of-scope?"

**When you encounter a specification ambiguity**: In Phase 3, ask the user. Do NOT guess or assume.

**When a task estimate >5 days**: Break it into subtasks. Update the task tree.

**When a feature feels out-of-scope**: Ask Constitution Article 1 (Principles): "Does this align with our core mission?"

**When code contradicts spec**: File a sync issue (SYNC_REPORT.md). Do NOT update the spec without approval.

**Default implementation model**: Agent Mode (Claude Projects) — highest autonomy and iteration speed.

---

## References & Resources

- **EARS Notation**: Read `references/ears-notation.md` when generating SPECIFICATION.md.
- **Design Patterns**: Read `references/design-patterns.md` when generating DESIGN.md.
- **Task Templates**: Read `references/spec-templates.md` when generating TASKS.md.
- **Mermaid Syntax**: https://mermaid.live/ (test diagrams in real-time).
- **AWS Kiro**: This skill is inspired by Kiro; it adds EARS notation, amendment tracking, and 4-format handoff.

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 3.0.0 | 2026-03-20 | SDD Team | Full pipeline with Kiro parity + Anthropic best practices, EARS notation, model routing, 4-format handoff, bugfix workflow, spec sync, amendment protocol |

---

## Support & Feedback

Questions about the SDD Spec Engineer? Check AGENTS.md for specialized agents, or ask in discovery phase.

**Next steps**: Say "Start SDD Spec Engineer" or "I want to build a feature" to begin Phase 0 (Discovery).
