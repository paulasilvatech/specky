---
title: SDD Specification Templates - Complete Reference
version: 1.0.0
date: 2026-03-20
author: Claude
description: Production-ready templates for all SDD artifacts
---

# SDD Specification Templates

This reference provides complete, ready-to-use templates for all seven SDD artifacts. Each template includes YAML frontmatter, section structure, placeholder content, and formatting guidelines.

---

## Template 1: CONSTITUTION.md

**Purpose:** Establish project governance, naming conventions, amendment protocol, and decision-making authority

**Usage:** Generated first in Phase 0; referenced throughout project lifecycle

```markdown
---
title: Project Constitution
project_id: [PROJECT_ID]
version: 1.0.0
date: 2026-03-20
author: Claude (SDD Constitution Generator)
status: Approved
last_amended: 2026-03-20
amendment_count: 0
---

# [PROJECT_NAME] Constitution

## Article 1: Project Charter

### 1.1 Vision Statement
[1-2 sentences describing the transformational impact of the project]

Example:
"Enable enterprises to manage payroll and compliance in a single platform, 
reducing HR administrative overhead by 70%."

### 1.2 Mission Statement
[1 sentence describing what the project accomplishes]

Example:
"Build a cloud-native, scalable payroll and HR management system with 
comprehensive compliance reporting for mid-market enterprises."

### 1.3 Success Criteria
- [Measurable goal 1: e.g., "Support 1,000+ enterprise customers by year 1"]
- [Measurable goal 2: e.g., "99.9% uptime SLA in production"]
- [Measurable goal 3: e.g., "Process 1M+ payroll transactions per month"]

### 1.4 Constraints & Assumptions
- **Budget:** [Total project budget or cost constraint]
- **Timeline:** [Launch date or delivery milestone]
- **Team:** [Team size, key roles]
- **Regulatory:** [GDPR, SOC2, PCI compliance requirements]

---

## Article 2: Naming Conventions

### 2.1 Artifact Naming
All specification artifacts follow the naming pattern: `[ARTIFACT_TYPE].md`

| Artifact | Filename | Purpose |
|----------|----------|---------|
| Constitution | CONSTITUTION.md | Governance & charter |
| Specification | SPECIFICATION.md | Requirements in EARS notation |
| Clarification | CLARIFICATION.md | Ambiguity resolution (optional) |
| Design | DESIGN.md | Architecture & design decisions |
| Tasks | TASKS.md | Implementation task breakdown |
| Analysis | ANALYSIS.md | Quality assurance & traceability |
| Sync Report | SYNC_REPORT.md | Drift detection & consistency |

**Example:** `/project-root/SPECIFICATION.md`, `/project-root/DESIGN.md`

### 2.2 Requirement ID Format
Format: `REQ-[CATEGORY]-[SEQUENCE]`

- **CATEGORY:** AUTH (authentication), PAYMENT (payment), USER (user management), etc.
- **SEQUENCE:** 001, 002, 003, ...

**Examples:**
- REQ-AUTH-001: "The system shall authenticate users via email and password"
- REQ-PAYMENT-005: "The system shall process payments via Stripe"
- REQ-USER-012: "System shall support user profile customization"

### 2.3 Feature ID Format
Format: `Feature [SEQUENCE]: [Feature Name]`

**Examples:**
- Feature 001: User Authentication & JWT
- Feature 002: User Management
- Feature 003: Payment Integration

### 2.4 Task ID Format
Format: `[FEATURE_SEQUENCE].[TASK_SEQUENCE]`

**Examples:**
- 001.1: User Login Endpoint (under Feature 001)
- 002.3: User Profile Update (under Feature 002)
- 003.2: Stripe Webhook Handler (under Feature 003)

### 2.5 ADR (Architecture Decision Record) Format
Format: `ADR-[SEQUENCE]: [Decision Title]`

**Examples:**
- ADR-001: Use JWT for Stateless Authentication
- ADR-002: Redis for Token Caching
- ADR-003: Kubernetes for Orchestration

---

## Article 3: Amendment Protocol

### 3.1 Change Request Process

**Step 1: Identify Issue**
- Issue type: Missing requirement? Unclear specification? Inconsistency?
- Create GitHub issue with template:
  ```
  Title: [Amendment Type] - [Brief Description]
  Body:
    ## Issue
    [What is wrong or missing?]
    
    ## Affected Artifact(s)
    - SPECIFICATION.md (REQ-AUTH-001)
    - DESIGN.md (Section 2.3)
    
    ## Proposed Resolution
    [How should it be fixed?]
    
    ## Justification
    [Why is this change necessary?]
  ```

**Step 2: Propose Amendment**
- Author: Submitter of the issue
- Reviewer: Tech Lead, Architecture Lead, or Project Manager
- Discussion: Comment thread in GitHub issue

**Step 3: Approval**
- Minimum: 1 approval (Tech Lead)
- Complex changes (affecting >2 artifacts): 2 approvals required
- Approval comment: "Approved for amendment"

**Step 4: Implementation**
- Update artifact(s) with change marker:
  ```markdown
  <!-- [AMENDED 2026-03-20 by @reviewer, Issue #42] -->
  ```
- Update version: X.Y.Z → X.Y.(Z+1) for patches, X.(Y+1).0 for minor
- Update "last_amended" date in YAML frontmatter
- Increment "amendment_count" in YAML frontmatter
- Create commit: `chore: amend [ARTIFACT] - [brief description]`

**Step 5: Communication**
- Post amendment summary to Slack #engineering channel
- Link to amendment in artifact table of contents

### 3.2 Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR (X.0.0):** Affects scope, requirements, or architecture fundamentally
  - Example: Add entire new feature category
  
- **MINOR (1.X.0):** Adds new requirement or modifies existing one
  - Example: Add new user authentication method
  
- **PATCH (1.0.X):** Clarification, bug fix, wording improvement
  - Example: Clarify ambiguous requirement wording

**All artifacts maintain same version** (Constitutional requirement)

### 3.3 Emergency Amendment (Hot-fix)

For critical issues affecting production:

1. File emergency amendment with "URGENT" label
2. Tech Lead can approve unilaterally (within 30 minutes)
3. Update artifact immediately with [EMERGENCY AMENDED] marker
4. Announce to team immediately
5. Follow normal process in next daily standup

### 3.4 Amendment Log

| Date | Issue | Artifact | Type | Approved By | Version |
|------|-------|----------|------|-------------|---------|
| 2026-03-20 | #001 | SPECIFICATION | Clarification | @tech-lead | 1.0.1 |
| 2026-03-21 | #005 | DESIGN | Feature | @arch-lead | 1.1.0 |

---

## Article 4: Decision-Making Authority

### 4.1 Decision Matrix

| Decision | Authority | Timeline | Approval |
|----------|-----------|----------|----------|
| Small amendments (wording, clarification) | Tech Lead | 1 day | 1 approval |
| Requirement addition/modification | Tech Lead + Project Manager | 2 days | 2 approvals |
| Architecture change (new component) | Architecture Lead | 3 days | 1 approval + design review |
| Scope change (new feature) | Project Manager + Product Lead | 5 days | 2+ approvals |
| Critical hot-fix (production issue) | Tech Lead | 30 minutes | 1 approval |

### 4.2 Escalation Path
- Issue disputed: Escalate to Tech Lead
- Tech Lead disagreement: Escalate to Architecture Lead
- Architecture Lead disagreement: Escalate to Project Manager
- Final authority: Project Manager (with stakeholder input)

---

## Article 5: Project Metadata

| Field | Value |
|-------|-------|
| Project ID | [PROJECT_ID] |
| Project Name | [PROJECT_NAME] |
| Team Size | [X engineers] |
| Start Date | [DATE] |
| Target Launch | [DATE] |
| Regulatory Scope | [GDPR, SOC2, PCI, etc.] |
| Primary Users | [User personas] |
| Scale Target | [X users, Y transactions/month] |

---

## Signatures

**Approved by:**
- [ ] Tech Lead: _________________________ Date: _________
- [ ] Project Manager: _________________________ Date: _________
- [ ] Architecture Lead: _________________________ Date: _________

---
```

---

## Template 2: SPECIFICATION.md

**Purpose:** Comprehensive requirements in EARS notation with acceptance criteria

**Usage:** Central artifact; referenced by Design and Tasks

```markdown
---
title: System Specification
project_id: [PROJECT_ID]
version: 1.0.0
date: 2026-03-20
author: Claude (SDD Spec Generator)
based_on: CONSTITUTION.md
status: Draft
last_amended: 2026-03-20
amendment_count: 0
---

# System Specification

## Executive Summary

[2-3 paragraphs overview of system scope, primary capabilities, user personas, and success criteria]

Example:
"This document specifies a cloud-native payroll and HR management platform 
for mid-market enterprises (500-5000 employees). The system enables HR teams 
to manage payroll, benefits, compliance reporting, and employee lifecycle 
in a single platform, reducing manual overhead by 70%.

The system serves three primary user personas: HR Managers, Finance Directors, 
and Employees. The platform must support 10,000+ concurrent users, process 
1M+ payroll transactions monthly, and maintain 99.9% uptime.

Success is measured by customer acquisition (500+ customers in year 1), 
uptime SLA compliance (99.9%), and employee NPS (>45)."

---

## 1. Scope Definition

### 1.1 In-Scope Capabilities
- [Capability 1: User authentication and authorization]
- [Capability 2: Payroll calculation and processing]
- [Capability 3: Compliance reporting (tax, benefits, audit)]
- [Capability 4: Employee self-service portal]

### 1.2 Out-of-Scope (Explicitly NOT Included)
- Third-party payroll integration (e.g., ADP sync) → Future enhancement
- Time & attendance system → Separate product
- Talent acquisition (recruiting) → Out of scope
- Performance management → Future enhancement

### 1.3 Known Constraints
- Single-tenant SaaS (not multi-tenant in v1.0)
- US payroll rules only (not international)
- English language only (localization deferred)
- Browser-based only (no mobile app in v1.0)

---

## 2. User Personas & Use Cases

### 2.1 Primary Personas

**Persona 1: Sarah (HR Manager)**
- Role: Manages payroll for 500-employee company
- Tech comfort: Intermediate (uses spreadsheets, accounting software)
- Primary goal: Reduce manual payroll processing time from 16 hours to 2 hours/month
- Pain point: Current process is error-prone; no audit trail for compliance

**Persona 2: Mike (Finance Director)**
- Role: Oversees financial reporting and compliance
- Tech comfort: Advanced (data analysis, SQL)
- Primary goal: Real-time visibility into labor costs; automated tax compliance reporting
- Pain point: Spreadsheet-based reporting is slow and prone to errors

**Persona 3: Emma (Employee)**
- Role: Individual contributor
- Tech comfort: Basic (email, web browser)
- Primary goal: View pay stubs, request time off, update profile
- Pain point: Current process requires HR intervention for simple requests

### 2.2 Primary Use Cases

**Use Case 1: Monthly Payroll Run**
- Actor: Sarah (HR Manager)
- Precondition: Timesheets submitted and approved
- Steps:
  1. Log into system
  2. Review employee timesheets (hours, time-off requests)
  3. Run payroll calculation
  4. Review calculated amounts and deductions
  5. Approve and process
  6. Generate check runs and direct deposits
- Postcondition: Paychecks processed, employees notified

**Use Case 2: Compliance Reporting**
- Actor: Mike (Finance Director)
- Precondition: Payroll processed for period
- Steps:
  1. Access compliance reporting dashboard
  2. Generate tax reports (federal, state, local)
  3. Export reports for accountant/CPA
  4. Track compliance deadlines
- Postcondition: Compliance reports generated and exported

**Use Case 3: Employee Self-Service**
- Actor: Emma (Employee)
- Precondition: Active employee
- Steps:
  1. Log into employee portal
  2. View recent pay stub
  3. Request time off
  4. Update direct deposit information
- Postcondition: Time-off request submitted for approval; direct deposit updated

---

## 3. Functional Requirements (EARS Format)

### 3.1 Authentication & Authorization

**REQ-AUTH-001:** User Login
```
The system shall authenticate users via email address and password combination.

Acceptance Criteria:
- Valid credentials (email + correct password) → 200 OK + JWT token
- Invalid credentials (wrong password) → 401 Unauthorized
- Nonexistent email → 401 Unauthorized (no email enumeration)
- Response time <500ms (p99)

Test:
  GET /auth/login { email: "sarah@company.com", password: "correct123" }
  → 200 OK + token
```

**REQ-AUTH-002:** Session Timeout
```
When a user's token expires, the system shall invalidate the token 
and require re-authentication.

Acceptance Criteria:
- Token expiry: 15 minutes
- Expired token → 401 Unauthorized
- No automatic re-login; user must manually log in again

Test:
  Generate token → wait 15+ min → attempt API call
  → 401 Unauthorized
```

**REQ-AUTH-003:** Password Security
```
The system shall hash all passwords using bcryptjs (10+ salt rounds) 
and shall NOT store plaintext passwords.

Acceptance Criteria:
- All passwords in database are hashed
- Passwords not logged in any form
- bcryptjs configured with minimum 10 salt rounds

Test:
  Inspect database; verify all password columns contain hashes, not plaintext
```

**REQ-AUTH-004:** Role-Based Access Control (RBAC)
```
The system shall enforce role-based access control with roles: ADMIN, HR_MANAGER, FINANCE_DIRECTOR, EMPLOYEE.

Acceptance Criteria:
- ADMIN: Full system access
- HR_MANAGER: Payroll, employee data, reports
- FINANCE_DIRECTOR: Reports, compliance, audit logs
- EMPLOYEE: Own pay stub, profile, time-off request

Test:
  Log in as EMPLOYEE → attempt access /admin/payroll
  → 403 Forbidden
```

### 3.2 User Management

**REQ-USER-001:** User Registration
```
Where the account type is ENTERPRISE, the system shall require administrator 
to provision new user accounts (no self-signup).

Acceptance Criteria:
- ENTERPRISE accounts: No self-service signup
- ADMIN user can create new user with role assignment
- Confirmation email sent to new user
- New user inactive until email confirmed

Test:
  Attempt self-signup as ENTERPRISE user
  → Registration blocked; admin must provision
```

**REQ-USER-002:** Profile Management
```
The system shall allow users to view and update their own profile 
(name, email, phone, address) but shall NOT allow users to modify other users' profiles.

Acceptance Criteria:
- User can view own profile
- User can edit own name, email, phone, address
- User cannot access other users' profiles
- Admin can edit any user's profile
- Changes logged for audit trail

Test:
  Log in as User A → GET /profile/user-b → 403 Forbidden
  Log in as Admin → GET /profile/user-b → 200 OK + profile data
```

### 3.3 Payroll Processing

**REQ-PAYROLL-001:** Payroll Calculation
```
When an HR manager initiates payroll run, the system shall calculate 
gross pay, deductions, and net pay for all eligible employees.

Acceptance Criteria:
- Gross pay calculated from hours + rate
- Deductions applied: federal tax, state tax, FICA, benefits
- Net pay = gross - deductions
- Results available for review before processing
- Calculation accuracy: within $0.01 of manual calculation

Test:
  Run payroll for single employee with 40 hours @ $50/hr
  → Verify gross = $2000
  → Verify deductions calculated correctly
  → Verify net = gross - deductions
```

**REQ-PAYROLL-002:** Audit Trail
```
The system shall maintain immutable audit trail of all payroll changes 
for compliance and dispute resolution.

Acceptance Criteria:
- All payroll modifications logged (who, when, what changed)
- Audit logs non-editable
- Logs retained for minimum 7 years
- Finance director can view audit trail

Test:
  Modify payroll amount → verify change logged
  Attempt to delete audit log entry → operation blocked
```

### 3.4 Compliance Reporting

**REQ-COMPLIANCE-001:** Tax Report Generation
```
The system shall generate accurate federal, state, and local tax reports 
required by law for payroll compliance.

Acceptance Criteria:
- Federal tax reports (940, 941, 1099)
- State tax reports (varies by jurisdiction)
- Local tax reports (where applicable)
- Reports exportable as PDF or CSV
- Reports generated within 1 second

Test:
  Generate 941 report for Q1 → verify data accuracy
  → verify PDF/CSV export works
```

**REQ-COMPLIANCE-002:** Compliance Deadline Tracking
```
The system shall track compliance deadlines and notify administrators 
of upcoming filing deadlines.

Acceptance Criteria:
- Compliance calendar displays all filing deadlines
- Email notification sent 5 days before deadline
- Dashboard highlights overdue items
- Support for federal, state, local deadlines

Test:
  Create compliance deadline for 5 days from now
  → verify email notification sent
  → verify dashboard shows deadline
```

### 3.5 Employee Self-Service

**REQ-EMPLOYEE-001:** Pay Stub Access
```
The system shall allow employees to view and download their pay stubs.

Acceptance Criteria:
- Employee can access own pay stubs (current + historical)
- Pay stub downloadable as PDF
- Cannot access other employees' pay stubs
- Access logged for audit

Test:
  Log in as Employee A → view pay stub
  → download as PDF → verify contents match payroll data
```

**REQ-EMPLOYEE-002:** Time-Off Request
```
The system shall allow employees to request paid time off 
(vacation, sick leave, personal) with manager approval workflow.

Acceptance Criteria:
- Employee submits request (date, type)
- Manager receives notification
- Manager can approve or deny
- Employee notified of decision
- Approved time-off blocks future payroll calculations

Test:
  Employee requests 3 days vacation
  → Manager receives notification → Manager approves
  → Employee notified → Time-off appears in calendar
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

**REQ-PERF-001:** API Latency
```
When a user makes an API request, the system shall respond 
within 500ms (p99 latency) during normal load (100 concurrent users).

Target: p50 <100ms, p95 <300ms, p99 <500ms
Environment: Production AWS infrastructure
```

**REQ-PERF-002:** Payroll Processing Time
```
When an HR manager runs payroll for 1000 employees, the system 
shall complete calculation and make results available for review 
within 30 seconds.

Target: <30s for 1000 employees, <1s for 100 employees
```

**REQ-PERF-003:** Report Generation
```
When a user requests a compliance report, the system shall 
generate and return the report within 5 seconds.

Target: <5s for any report type
```

### 4.2 Reliability & Uptime

**REQ-RELIABILITY-001:** Availability
```
The system shall maintain 99.9% uptime SLA in production 
(maximum 43 minutes downtime per month).

Target: 99.9% uptime
Measurement: HTTP health check endpoint
Exclusions: Planned maintenance (max 4 hours/month)
```

**REQ-RELIABILITY-002:** Data Durability
```
The system shall implement automated backups and disaster recovery 
to prevent data loss from hardware failure.

Target: RPO (Recovery Point Objective) <15 minutes
Target: RTO (Recovery Time Objective) <1 hour
Backup frequency: Every 15 minutes
Backup locations: Multi-region (primary + standby)
```

### 4.3 Security

**REQ-SECURITY-001:** Data Encryption
```
The system shall encrypt all personally identifiable information (PII) 
at rest and in transit.

At rest: AES-256 encryption in database
In transit: HTTPS/TLS 1.3 for all API communication
Key management: AWS KMS
```

**REQ-SECURITY-002:** OWASP Compliance
```
The system shall be free of high-severity OWASP Top 10 vulnerabilities.

Target: Zero high-severity vulnerabilities in production
Validation: OWASP Dependency Check + annual penetration test
```

**REQ-SECURITY-003:** Access Control
```
The system shall implement principle of least privilege for all system access.

User roles: ADMIN, HR_MANAGER, FINANCE_DIRECTOR, EMPLOYEE
Default: EMPLOYEE (most restricted)
Access logs: Audit trail of all permission changes
```

### 4.4 Scalability

**REQ-SCALABILITY-001:** Concurrent Users
```
The system shall support 10,000 concurrent users without degradation 
in performance (response time <500ms p99).

Load test: 10,000 concurrent users, sustained for 1 hour
Auto-scaling: Kubernetes horizontal pod autoscaler
```

**REQ-SCALABILITY-002:** Data Volume
```
The system shall support 50 million historical payroll records without 
performance degradation (<500ms latency for queries).

Data retention: 7+ years of payroll history
Database: Partitioned by company_id and pay_period
Archival: Quarterly archival of old data to cold storage
```

### 4.5 Maintainability

**REQ-MAINTAINABILITY-001:** Code Quality
```
The system shall maintain >80% test coverage for business logic 
and code review checklist compliance for all changes.

Target: >80% unit test coverage
Target: >70% integration test coverage
Code review: 2+ approvals required for any production code
```

**REQ-MAINTAINABILITY-002:** Documentation
```
The system shall provide comprehensive documentation for 
developers, operators, and end-users.

Developer docs: Architecture, API contracts, data model
Operator docs: Deployment, scaling, troubleshooting
User docs: Feature guides, FAQs, video tutorials
```

---

## 5. Assumptions & Dependencies

### 5.1 Assumptions
- Customers have existing employee data (HRIS or spreadsheet)
- Customers have basic internet connectivity (broadband)
- Payroll accountant or bookkeeper available for setup assistance
- No requirement for integration with legacy systems (v1.0)

### 5.2 External Dependencies
- **Stripe:** Payment processing for subscription billing
- **SendGrid:** Email service for notifications and reports
- **AWS:** Cloud infrastructure (EC2, RDS, S3, KMS)
- **Auth0:** Optional third-party auth provider (future)

### 5.3 Technology Assumptions
- Target browsers: Chrome, Firefox, Safari (latest 2 versions)
- Target OS: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- Internet: Assumes stable internet (not for offline use)

---

## 6. Success Criteria & Acceptance Tests

### 6.1 User Acceptance Criteria
- [ ] All three user personas can complete primary use cases
- [ ] Payroll run for 100 employees takes <5 minutes (end-to-end)
- [ ] Compliance reports match manual calculations exactly
- [ ] Employee self-service doesn't require IT support

### 6.2 Technical Acceptance Criteria
- [ ] All acceptance tests pass
- [ ] Performance benchmarks met (p99 <500ms)
- [ ] Uptime target met (99.9% in staging for 1 week)
- [ ] Security scan clean (zero high-severity vulnerabilities)
- [ ] Load test: 10,000 concurrent users, zero errors

### 6.3 Deployment Acceptance Criteria
- [ ] All feature flags enabled in production
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Runbook created for common issues

---

## Self-Assessment Checklist

Before considering this specification complete, verify:

- [ ] **Completeness:** Every requirement has acceptance criteria
- [ ] **Clarity:** No ambiguous terms; all EARS patterns used correctly
- [ ] **Testability:** Every requirement can be tested automatically or manually
- [ ] **Traceability:** Every requirement links to at least one design component
- [ ] **Feasibility:** No requirements contradict each other
- [ ] **Scope:** Clear distinction between in-scope and out-of-scope
- [ ] **Measurability:** Performance targets include units (ms, %, GB)
- [ ] **RFC 2119:** All requirements use SHALL/SHOULD/MAY correctly
- [ ] **User Focus:** Requirements address user pain points
- [ ] **Compliance:** All regulatory requirements addressed

---
```

---

## Template 3: DESIGN.md

**Purpose:** Architecture decisions, components, API contracts, and ADRs

**Excerpt:** (Full template shown in sdd-design.md command file)

---

## Template 4: TASKS.md

**Purpose:** Implementation task breakdown with Phase -1 gates, sequencing, and status tracking

**Excerpt:** (Full template shown in sdd-tasks.md command file)

---

## Template 5: ANALYSIS.md

**Purpose:** Quality assurance, traceability matrix, coverage gaps

**Excerpt:** (Full template shown in sdd-analyze.md command file)

---

## Template 6: SYNC_REPORT.md

**Purpose:** Drift detection, consistency checks, amendment tracking

```markdown
---
title: Specification Synchronization Report
project_id: [PROJECT_ID]
version: 1.0.0
date: 2026-03-20
author: Claude (SDD Analyzer)
status: Complete
---

# Specification Synchronization Report

## Executive Summary
[Status of consistency across all artifacts, critical issues, recommendations]

---

## 1. Version Control

| Document | Version | Date | Author | Status |
|----------|---------|------|--------|--------|
| CONSTITUTION.md | 1.0.0 | 2026-03-19 | Claude | ✅ |
| SPECIFICATION.md | 1.0.0 | 2026-03-19 | Claude | ✅ |
| DESIGN.md | 1.0.0 | 2026-03-19 | Claude | ✅ |
| TASKS.md | 1.0.0 | 2026-03-19 | Claude | ✅ |

**Overall Status:** ✅ All documents at matching versions

---

## 2. Semantic Validation

[Issues detected, line-by-line inconsistencies, conflicts]

---

## 3. Amendment Tracking

| Date | Amendment | Artifact | Approved By | Status |
|------|-----------|----------|-------------|--------|
| [None yet] | | | | |

**Pending Amendments:** None

---

## 4. Consistency Checks

[Passing/failing checks with remediation]

---
```

---

## Template 7: BUGFIX_SPEC.md

**Purpose:** Bug fix specification with minimal change principle

**Excerpt:** (Full template shown in sdd-bugfix.md command file)

---

## Cross-Template Links

All templates use consistent YAML frontmatter:

```yaml
---
title: [Artifact Name]
project_id: [PROJECT_ID]
version: X.Y.Z
date: YYYY-MM-DD
author: [Author Name]
based_on: [Previous Artifact or None]
status: [Draft | Approved | Merged | Deployed]
last_amended: YYYY-MM-DD
amendment_count: 0
---
```

**Status Workflow:**
```
Draft → Reviewed → Approved → Merged → Deployed
```

---

## Version Numbering Across Artifacts

All seven artifacts maintain synchronized versioning:

| Phase | Constitution | Specification | Design | Tasks | Analysis |
|-------|---|---|---|---|---|
| Initial | 1.0.0 | 1.0.0 | 1.0.0 | 1.0.0 | 1.0.0 |
| Clarification | 1.0.0 | 1.0.1 | 1.0.0 | 1.0.0 | 1.0.0 |
| Feature Add | 1.0.0 | 1.1.0 | 1.1.0 | 1.1.0 | 1.1.0 |
| Scope Change | 2.0.0 | 2.0.0 | 2.0.0 | 2.0.0 | 2.0.0 |

---

## Formatting Standards

All templates use:

**Headings:** 
- H1 (`#`) for artifact title
- H2 (`##`) for major sections
- H3 (`###`) for subsections
- H4 (`####`) for details

**Emphasis:**
- **Bold** for key terms and decision points
- *Italic* for emphasis on cautions
- `Code` for file paths, variable names, commands

**Lists:**
- Bullet lists for unordered items
- Numbered lists for sequential steps
- Tables for comparisons and structured data

**Code Blocks:**
- Fenced code blocks with language identifier
- Example inputs/outputs shown explicitly

**Callout Blocks:**
- `> **Note:**` for additional information
- `> **Warning:**` for cautions
- `> **Example:**` for illustrations

---

## Quick Reference

| Template | When | Length | Audience | Key Sections |
|----------|------|--------|----------|--------------|
| CONSTITUTION | Phase 0 | 2-3 pages | All | Charter, naming, amendments, authority |
| SPECIFICATION | Phase 1 | 10-15 pages | Engineering + PM | Functional/non-functional req, use cases |
| DESIGN | Phase 3 | 15-20 pages | Engineering | Architecture, components, ADRs, APIs |
| TASKS | Phase 4 | 10-15 pages | Engineering | Gates, features, sequencing, status |
| ANALYSIS | Phase 5 | 8-12 pages | Engineering + QA | Traceability, coverage, gaps, risks |
| SYNC_REPORT | Phase 5 | 3-5 pages | Tech Lead | Consistency, versioning, amendments |
| BUGFIX_SPEC | Ad hoc | 5-10 pages | Engineering + QA | Root cause, fix, test plan |
