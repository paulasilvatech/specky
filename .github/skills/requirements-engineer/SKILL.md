---
name: requirements-engineer
description: "Analyze, complement, and validate FRD and NFRD as correct inputs for sdd_init. Use when: creating requirements, FRD, NFRD, analyzing specs, greenfield, brownfield, modernization, migration, API, SaaS, mobile, data platform, internal tool, CLI. Produces FRD (what system must do) and NFRD (quality constraints). DO NOT USE for code, implementation, or CONSTITUTION.md, that is sdd_init's job."
---

# Requirements Engineer Skill (GitHub Copilot)

---
**GitHub Copilot mode:** Ask or agent mode, depending on whether the user wants only requirements or a full repository update.
**Reasoning level:** High. Requirements writing has high ambiguity, no executable feedback, and errors cascade into design and implementation. Spend the thinking effort before any code is written.

---

This skill turns raw input into production-grade FRD and NFRD documents ready for `sdd_init`.
Input can be: raw notes, bullet points, PRD fragments, GitHub Copilot task notes, SDD fragments, user stories, or verbal description. Works for any project type and any tech stack.

The output is the correct and complete input for Specky's `sdd_init`.

---

## 0. GitHub Copilot routing

| Task | GitHub Copilot mode | Notes |
|------|---------------------|-------|
| Analyze gaps and write FRD/NFRD from scratch | Ask or agent mode | Use agent mode when files need to be created or updated. |
| Review or validate existing FRD/NFRD | Ask | Keep feedback concise and evidence-based. |
| Convert FRD/NFRD to Specky CONSTITUTION.md | Agent mode | Write files only after confirming scope. |
| Quick single-requirement check | Ask | Return one focused correction. |

---

## 1. Project Type Detection

Identify before writing. One of: `greenfield | brownfield | modernization | legacy-migration | api | mobile | data-platform | saas | internal-tool | cli | infrastructure`

| Type | Key Signal | Extra Mandatory Sections in FRD |
|------|-----------|--------------------------------|
| Greenfield | "new", "build from scratch", "new product" | Success criteria, Non-goals |
| Brownfield | "existing system", "add feature", "extend" | Current state, Delta scope, Backward compat |
| Modernization | "migrate", "rewrite", "modernize" | Source system, Parity req, Cutover, Rollback |
| Legacy Migration | "COBOL", "mainframe", "AS/400", "VB6" | Same + Data migration correctness NFR |
| API / Platform | "API", "SDK", "developer portal" | Consumer personas, Versioning, Rate limit NFR |
| Mobile | "iOS", "Android", "Flutter" | Online/offline, OS version floor |
| Data Platform | "pipeline", "ETL", "warehouse", "ML" | Data quality NFR, Lineage NFR, Schema evolution NFR |
| SaaS | "multi-tenant", "subscription" | Tenant isolation, Onboarding, Noisy neighbor NFR |
| Internal Tool | "internal", "admin panel", "employee" | SSO required?, Deployment context |
| CLI / DevTool | "CLI", "extension", "MCP server" | Distribution model, Install experience |

---

## 2. Gap Detector

Run every check. Mark: PRESENT / MISSING-CRITICAL / MISSING-HIGH / ASSUMED.

### Functional Gaps

| Check | Severity | Default Assumption if Not Asked |
|-------|----------|---------------------------------|
| User roles and permissions | CRITICAL | None, must ask |
| Primary user action | CRITICAL | None, must ask |
| Scope boundary (in/out of scope) | CRITICAL | None, must ask |
| Authentication strategy | HIGH | Local auth, JWT, 60-min expiration |
| State machine for key entities | HIGH | None unless entity implies lifecycle |
| External integrations | HIGH | None unless mentioned |
| Error handling for primary action | HIGH | Graceful failure with user message |
| Data ownership vs integration | HIGH | System owns all data unless stated |
| Notifications | LOW | None |
| Search and filter | LOW | None unless mentioned |
| Multi-tenancy | LOW | Single-org unless mentioned |

### NFR Gaps

| Check | Severity | Default Assumption |
|-------|----------|--------------------|
| Performance targets | HIGH | <200ms p95 API, <3s page load |
| Concurrent user count | HIGH | 50 cloud, 5 local |
| Deployment environments | HIGH | Production cloud + local Docker |
| Compliance (GDPR/LGPD/HIPAA/SOC2) | HIGH | Not applicable |
| Test coverage target | LOW | >80% on business logic |
| Localization | LOW | English only |
| Accessibility | LOW | WCAG 2.1 AA for user-facing UI |

**Rule:** Ask max 3 questions for CRITICAL gaps only. Document every assumption.

---

## 3. Core Writing Rules

### What-Not-How (mandatory on every FR)

No database names, no framework names, no algorithm names inside FR text.

| Wrong | Right |
|-------|-------|
| "Use bcrypt with cost factor 12" | "Passwords must use a brute-force-resistant cryptographic hash" |
| "Store sessions in Redis with 60-min TTL" | "User sessions must expire after 60 minutes of inactivity" |
| "Build with Next.js App Router" | "Frontend must support server-side rendering on initial page load" |

Technology decisions go in NFRD Technology Stack Constraints, not in FRs.

### Testability (mandatory on every FR)

Every FR has an observable acceptance signal. "How do I know this is done?" must have a concrete answer.

### Priority

| Priority | Launch impact if missing |
|----------|--------------------------|
| P0 | Launch blocked |
| P1 | Launch degraded, workaround exists |
| P2 | Launch acceptable |
| P3 | Launch fine without it |

P0 count: minimum 5, maximum 15. More than 15 = scope too large.

### Domain Organization

Organize by domain (vertical system slice). Never by feature or user story.
IDs: `FR-AUTH-01`, `FR-SCORING-03`, `FR-REPORTING-01`.

---

## 4. FRD Template

```markdown
---
title: "{Project Name}, Functional Requirements Document"
description: "What the system must do. Input for sdd_init."
author: "{Author}"
date: "{YYYY-MM-DD}"
version: "1.0.0"
status: "approved"
project_type: "{type}"
tags: ["FRD", "{project-name}"]
---

# {Project Name}, Functional Requirements Document
> {One sentence: what this system does and who it serves.}

## Change Log
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | {date} | {author} | Initial FRD |

## 1. System Overview
### 1.1 What This System Does
{2-3 sentences. Problem, users, output. No tech stack.}
### 1.2 Out of Scope (mandatory, ≥3 items)
- {Item}: {why excluded}
### 1.3 Documented Assumptions
| # | Assumption | Consequence if Wrong |
|---|-----------|---------------------|
| A1 | {text} | {impact} |

## 2. Stakeholder Roles
| Role | Who They Are | Key Permissions |
|------|-------------|----------------|

## 3. Domain 1, {Name}
### FR-{DOM}-01: {Title}, Priority P{n}
The system must {testable statement}.
1. {Behavior}
**Acceptance signal:** {one observable check}

## {N}. Functional Requirements Summary
| ID | Requirement | Domain | Priority | Phase |
|----|-------------|--------|----------|-------|
**P0={n}, P1={n}, P2={n}, P3={n}. Total={n}.**

## {N+1}. Implementation Phases
| Phase | Requirements | Objective | State After |
|-------|-------------|-----------|-------------|
| Phase 1, Foundation | FR-x, FR-y | {objective} | {outcome} |
```

---

## 5. NFRD Template

```markdown
---
title: "{Project Name}, Non-Functional Requirements Document"
description: "Quality constraints. Input for sdd_init."
author: "{Author}"
date: "{YYYY-MM-DD}"
version: "1.0.0"
status: "approved"
companion_document: "FRD_{ProjectName}_v1_0_0_{date}.md"
tags: ["NFRD", "{project-name}"]
---

# {Project Name}, Non-Functional Requirements Document

## 1. Deployment Contexts
| Context | Description | SLA Applies |
|---------|-------------|-------------|
| {Primary} | {desc} | Yes |
| {Secondary} | {desc} | No |

## 2. NFR-01: Performance, P0
| Metric | Primary | Secondary |
|--------|---------|-----------|
| API, simple query | <{X}ms p95 | <{Y}ms p95 |
| API, complex | <{X}s p95 | <{Y}s p95 |
| Page load | <{X}s | <{Y}s |
| Concurrent users | {N} | {N} |

## 3. NFR-02: Security, P0
Auth: {method, token expiration, MFA}
Authorization: {RBAC/ABAC, 401 vs 403}
Data protection: {encryption at rest, TLS, PII policy}
Rate limiting: {req/min per user}

## 4. NFR-03: Availability, P{n}
Uptime {X%}, RTO {Xh}, RPO {Xh}. Graceful degradation: {rules}.

## 5. NFR-04: Testability, P0
Business logic: >{X}% unit coverage on {module}.
E2E: {primary flow described}.

## 6. NFR-05: CI/CD, P0
On PR: {checks}. On merge: {deploy}. Migrations: {strategy}.

## 7. NFR-06: Observability, P{n}
Logging: {format, fields, PII policy}. Health: {endpoint}. Alerts: {thresholds}.

## 8. NFR-07: Accessibility, P{1|2|3}
WCAG 2.1 {AA|A}. Keyboard: {full|partial}. Contrast: 4.5:1 minimum.

## 9. NFR-08: Localization, P{1|2|3}
Languages: {en|es|pt-br|other}. Scope: {UI|content|emails|reports}.

## 10. NFR-09: Data Retention and Compliance, P{n}
Retention: {period}. Deletion: {soft|hard|anonymize}.
Compliance: {GDPR|LGPD|HIPAA|SOC2|Not applicable}.

## 11. Technology Stack Constraints
{Populated if decisions made. "No decisions made" if not.}
| Component | Technology | Why a Constraint |
|-----------|-----------|-----------------|

## 12. NFR Summary
| ID | Category | Requirement | Priority |
|----|----------|-------------|----------|
```

---

## 6. Validation (run all 24 before delivering)

### FRD (14 checks)
| # | Check |
|---|-------|
| V-01 | Every FR uses "must", never "should" |
| V-02 | No tech names (DB, framework, algorithm) in FR text |
| V-03 | Every FR has P0/P1/P2/P3 |
| V-04 | Every FR has acceptance signal |
| V-05 | Out of Scope: exists, ≥3 items |
| V-06 | Documented Assumptions: exists |
| V-07 | All roles in Section 2 referenced in ≥1 FR |
| V-08 | Phase 1: only P0 requirements |
| V-09 | Phase 1: ≤15 requirements |
| V-10 | Organized by domain, not feature |
| V-11 | Every domain has ≥2 requirements |
| V-12 | No duplicate requirements |
| V-13 | P0 count: 5–15 |
| V-14 | State machine present if entity has lifecycle |

### NFRD (10 checks)
| # | Check |
|---|-------|
| V-15 | NFR-01 Performance: numeric targets |
| V-16 | NFR-02 Security: auth method named |
| V-17 | NFR-04 Testability: coverage target named |
| V-18 | NFR-05 CI/CD: present |
| V-19 | Every NFR is measurable |
| V-20 | Dual targets per deployment context |
| V-21 | Technology Stack Constraints: populated or explicitly empty |
| V-22 | Localization: P3 or scoped explicitly |
| V-23 | Accessibility: P3 if no user-facing UI |
| V-24 | Compliance: stated as applicable or not |

**Report:**
```
FRD: {n}/14 PASS | NFRD: {n}/10 PASS
Failures: V-XX, {fix}
Assumptions: A{n}, {text}
Ready for sdd_init: YES / NO
```

---

## 7. Specky Handoff Block

Deliver after passing validation:

```
## Specky Handoff

FRD: FRD_{ProjectName}_v1_0_0_{date}.md
NFRD: NFRD_{ProjectName}_v1_0_0_{date}.md
Project type: {type}
FRs: {n} (P0={n} P1={n} P2={n} P3={n}) | NFRs: {n}
Phase 1: {FR-IDs}, {S|M|L|XL}

sdd_init input:
  feature name: {kebab-case}
  description: {sentence from FRD 1.1}
  key constraints: {NFRD stack + compliance}

Open questions (need confirmation before sdd_init):
  {HIGH assumptions not yet confirmed}
```

---

## 8. Anti-Patterns to Fix

| Found | Fix |
|-------|-----|
| GitHub Copilot prompt as requirement | Extract intent, rewrite as FR |
| "should" in FR | Replace with "must" |
| DB/framework name in FR | Move to NFRD constraints |
| "fast", "secure" without number | Add numeric target to NFRD |
| FR with >5 behaviors | Split |
| Missing failure path | Add unhappy path FR |
| "As a user I want..." | "The {role} must..." |
| Duplicate domain | Merge |
| P0 count >15 | Reduce scope |
