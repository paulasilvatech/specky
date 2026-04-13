---
name: Research Analyst
description: "This skill should be used when the user asks to 'research codebase', 'scan tech stack', 'import documents', 'discovery questions', or needs guidance on Phase 1 research. Also trigger on 'sdd research', 'brownfield scan', 'import transcript', or 'check ecosystem'."
---

# Research Analyst (Phase 1)

## Overview

Phase 1 systematically analyzes existing technology, codebase, and organizational context to establish the knowledge baseline for specification and design decisions.

## Research Workflow

Execute structured research in this sequence:

1. **Brownfield/Greenfield Assessment** — Determine if building new or extending existing
2. **Technology Stack Scan** — Catalog languages, frameworks, databases, tools
3. **Document Import** — Gather requirements docs, designs, transcripts, compliance materials
4. **Ecosystem Check** — Map dependencies, integrations, and third-party services
5. **Discovery Questions** — Interview stakeholders to fill knowledge gaps
6. **RESEARCH.md Generation** — Synthesize findings into structured artifact

## Brownfield vs Greenfield

### Greenfield Assessment
New project with no existing codebase. Characteristics:
- Zero implementation debt
- Full technology stack choice freedom
- Complete architecture design needed
- Higher timeline risk (more unknowns)
- Compliance requirements from scratch

Actions:
- Focus research on requirements analysis
- Investigate relevant open-source alternatives
- Benchmark similar products for feature baseline
- Plan tech stack based purely on requirements fit

### Brownfield Assessment
Extending existing codebase. Characteristics:
- Technology stack constraints (existing tools/languages)
- Integration points to existing systems
- Organizational technology standards to respect
- Some business logic already implemented
- Technical debt to consider

Actions:
- Scan existing codebase structure and patterns
- Document current tech stack and versions
- Map existing data models and APIs
- Identify performance bottlenecks
- Review existing test coverage

## Technology Stack Scan

For brownfield projects, automatically catalog:

**Languages & Runtime**
- Primary language(s) with versions
- Runtime environment (Node 18.x, Python 3.11, Java 17, etc.)
- Package managers and registries

**Web Frameworks**
- Frontend: React, Vue, Angular, or none
- Backend: Express, FastAPI, Spring, Django
- ORM/query builders (Sequelize, SQLAlchemy, Hibernate)

**Databases**
- Primary: PostgreSQL, MySQL, MongoDB, etc.
- Caches: Redis, Memcached
- Search: Elasticsearch, Algolia
- Queues: RabbitMQ, Kafka, SQS

**Infrastructure**
- Container runtime: Docker, Podman
- Orchestration: Kubernetes, Docker Compose
- Cloud provider: AWS, GCP, Azure, on-prem
- CI/CD: GitHub Actions, GitLab CI, Jenkins

**DevOps & Quality**
- Testing frameworks and coverage tools
- Code quality: SonarQube, Prettier, ESLint
- Monitoring: DataDog, New Relic, Prometheus
- Logging: ELK, Splunk, CloudWatch

**Security & Compliance**
- Authentication: OAuth, JWT, SAML
- Data encryption standards
- Regulatory requirements: GDPR, HIPAA, SOC2
- Secrets management: Vault, AWS Secrets Manager

Generate tech stack report with version matrix and compatibility notes.

## Document Import

Aggregate all existing documentation and project history:

**Specification Documents**
- Requirements documents (RFP, PRD, specification)
- User stories and acceptance criteria
- Functional specifications
- Non-functional requirements

**Design & Architecture**
- Architecture Decision Records (ADRs)
- System design documents
- Database schema documentation
- API specifications (Swagger, Postman)

**Process & Compliance**
- Incident postmortems
- Security assessments and audit reports
- Compliance documentation
- Standard operating procedures

**Communications**
- Meeting transcripts and notes
- Email threads on key decisions
- Slack/Teams channel exports
- Stakeholder feedback collection

**Code & Artifacts**
- README files and documentation
- Code comments explaining business logic
- Deployment guides
- Known issues and limitations list

Import strategy:
- Scan repository for documentation files
- Extract from Wiki systems (Confluence, GitHub Wiki)
- Transcribe audio/video of requirements meetings
- Parse spreadsheets with requirement lists
- Consolidate into unified RESEARCH.md

## Discovery Questions (7 Core Areas)

Interview stakeholders to fill gaps using seven categories:

### 1. Business Context (5 questions)
- What business problem does this solve?
- How will success be measured?
- Who are the primary users?
- What's the competitive landscape?
- What's the timeline and budget constraint?

### 2. Current State (5 questions)
- How are users currently solving this (if at all)?
- What pain points exist with current approach?
- What works well that should be preserved?
- How many users/transactions currently?
- What's acceptable downtime/SLA?

### 3. Technical Constraints (4 questions)
- Must integrate with specific systems? Which ones?
- Technology standards to follow?
- Performance targets (response time, throughput)?
- Data residency or infrastructure constraints?

### 4. Functional Scope (3 questions)
- What's in scope for MVP?
- What's explicitly out of scope?
- What's nice-to-have for future?

### 5. Non-Functional Requirements (4 questions)
- Availability target (99%, 99.9%, 99.99%)?
- Expected growth (users, data volume)?
- Compliance requirements (GDPR, HIPAA, SOC2)?
- Security sensitivity (public data vs confidential)?

### 6. Dependencies & Integrations (3 questions)
- What external services must integrate?
- Existing APIs to consume or expose?
- Data sharing agreements needed?

### 7. Organizational Context (3 questions)
- Who are decision makers and stakeholders?
- What organizational changes needed?
- Training and adoption plan?

Document all answers in RESEARCH.md.

## Ecosystem Check

Map the project's external dependencies and integrations:

**Outbound Integrations** (services this system calls)
- Payment processor (Stripe, Square)
- Email service (SendGrid, AWS SES)
- Analytics (Mixpanel, Amplitude)
- Cloud services (AWS S3, Google Cloud Storage)

**Inbound Integrations** (services that call this system)
- Mobile apps consuming APIs
- Third-party reporting tools
- Legacy system migrations
- Partner integrations

**Data Flow Map**
- Source systems for data ingestion
- Destination systems for data export
- Real-time vs batch sync requirements
- Data transformation rules

**Compliance Ecosystem**
- Audit requirements and standards
- Data governance policies
- Breach notification procedures
- Vendor security assessment

Generate dependency graph and assess risk of each integration.

## RESEARCH.md Format

Structure the research artifact as:

```markdown
# Research Phase Report
**Project:** [name]
**Date:** [YYYY-MM-DD]
**Phase:** 1 - Research
**Status:** Complete

## Executive Summary
[1-paragraph overview of key findings]

## Greenfield vs Brownfield Assessment
**Classification:** [Greenfield | Brownfield]
[2-3 paragraphs explaining rationale]

## Technology Stack (Brownfield)
[Catalog of existing tech with versions]

### Current Performance Metrics
[Uptime, response times, throughput]

## Imported Documents
- [Document 1]: [Summary]
- [Document 2]: [Summary]

## Ecosystem Integrations
### Outbound
[List with brief description]

### Inbound
[List with brief description]

## Discovery Findings
[Answers to 7 discovery question categories]

## Risk Assessment
- Technical risks: [list with mitigation]
- Organizational risks: [list]
- External dependency risks: [list]

## Recommendations
[Next phase readiness assessment]

## Appendix: Full Tech Stack
[Detailed technology inventory]
```

## Research Commands

```
/specky:research --greenfield          # Start new project
/specky:research --brownfield          # Analyze existing code
/specky:research --tech-scan           # Technology stack only
/specky:research --import-docs         # Document aggregation
/specky:research --discovery           # Stakeholder interviews
```
