---
name: Implementation Orchestrator
description: "This skill should be used when the user asks to 'generate implementation plan', 'create test stubs', 'set up infrastructure', 'generate quality checklists', 'transition from spec to code', or needs guidance on Phase 6 implementation scaffolding. Also trigger on 'sdd implement', 'implementation handoff', 'IaC generation', or 'test framework selection'."
---

# Implementation Orchestrator (Phase 6)

## Overview

Phase 6 transforms specification and design artifacts into a structured implementation plan with code scaffolding, infrastructure definitions, and quality assurance frameworks.

## Prerequisites Check

Before starting implementation, verify:
- SPECIFICATION.md is complete with EARS notation requirements
- DESIGN.md includes architecture, API contracts, and data schema
- TASKS.md has work breakdown structure with dependencies
- All stakeholders have approved DESIGN.md
- Technical team has reviewed and confirmed feasibility
- Infrastructure resources are allocated and accessible

Run `/specky:check-phase-5` to validate prerequisites.

## Implementation Plan Generation

Generate a phased implementation plan with four distinct stages:

### Foundation Stage
Set up project skeleton, CI/CD pipelines, database migrations, and authentication framework. Duration typically 15-20% of total effort. Outputs:
- Empty project structure matching DESIGN.md architecture
- Docker/container definitions for local and production
- Database migration system initialized
- GitHub Actions/CI configuration from DESIGN.md

### Core Stage
Implement core business logic per TASKS.md sequencing. Focus on entities, APIs, and critical paths. Duration 40-50% of effort. Outputs:
- Data models and ORM definitions
- REST/GraphQL APIs matching DESIGN.md contracts
- Business logic implementation
- Unit test stubs for all modules

### Integration Stage
Connect subsystems, external APIs, and third-party services. Duration 20-25% of effort. Outputs:
- Third-party integrations (payment, auth, analytics)
- Message queue/event system setup
- Cross-module integration tests
- API gateway configuration

### Polish Stage
Performance optimization, error handling, logging, and observability. Duration 10-15% of effort. Outputs:
- Caching strategy implementation
- Comprehensive error handling
- Structured logging framework
- Monitoring and alerting setup

## Quality Checklist Generation

Generate domain-specific quality checklists from SPECIFICATION.md:

**Security Domain:**
- OWASP Top 10 items applicable to architecture
- Data encryption requirements (in-transit, at-rest)
- Authentication and authorization mechanisms
- Input validation and sanitization rules
- Audit logging and compliance tracking

**Testing Domain:**
- Unit test coverage targets (default 80% minimum)
- Integration test scenarios per SPECIFICATION.md
- End-to-end test paths for critical user flows
- Performance benchmarks from DESIGN.md NFRs
- Security test cases (SQL injection, XSS, CSRF)

**Conditional NFRs:**
If SPECIFICATION.md includes scalability requirements:
- Load testing strategy with target RPS
- Database query optimization checklist
- Caching strategy validation
- Horizontal scaling test scenarios

If high availability required:
- Failover test procedures
- Data consistency verification
- Recovery time objectives (RTO) validation
- Backup and restore procedures

## Test Framework Auto-Detection

Analyze technology stack from DESIGN.md and recommend test frameworks:

**Python projects** → pytest + pytest-cov
**Node.js projects** → Jest + Vitest for unit, Playwright for E2E
**Go projects** → testing package + testify
**Java projects** → JUnit 5 + Mockito + TestContainers
**C#/.NET projects** → xUnit + Moq + SpecFlow
**Rust projects** → built-in testing + proptest

Generate starter test configuration files and example test templates.

## Infrastructure Decision Tree

From DESIGN.md deployment topology, auto-generate infrastructure choices:

1. **Container Runtime** — Docker recommended; Podman alternative
2. **Orchestration** — Kubernetes if multi-replica; Docker Compose if single-node dev
3. **Database** — SQL (PostgreSQL) vs NoSQL per DESIGN.md data schema
4. **Caching Layer** — Redis for session/cache, memcached alternative
5. **Message Queue** — RabbitMQ/Kafka per event volume in SPECIFICATION.md
6. **Monitoring** — Prometheus + Grafana stack
7. **Log Aggregation** — ELK (Elasticsearch) or Loki

Generate Terraform/CloudFormation/Helm templates matching selections.

## Spec-Sync During Implementation

Continuous synchronization between SPECIFICATION.md and implementation:

- When code deviates from SPECIFICATION.md, flag as spec drift
- When implementation discovers missing requirement, update SPECIFICATION.md
- If design changes needed mid-implementation, update DESIGN.md and notify stakeholders
- Daily spec-sync report comparing implemented features to SPECIFICATION.md

## Implementation Handoff Template

When Phase 6 completes, provide handoff document including:

```
## Implementation Status
- Artifacts generated: [list]
- Scaffolding complete: [yes/no]
- Quality checklist items: [count]
- Framework selections validated: [yes/no]
- Infrastructure templates generated: [yes/no]

## Next Phase Entry Criteria
All Phase 6 outputs ready for Phase 7 (Verify):
- Code compiles without errors
- All test stubs created
- CI/CD pipeline functional
- Infrastructure definitions validated

## Known Gaps
- [List of incomplete items, if any]
- Estimated effort to complete: [hours]

## Recommendations
- [Technical notes for implementation team]
```

Reference: **arXiv:2502.08235** — Use standard inference (no extended thinking) for Phase 6 scaffolding to optimize quality-cost tradeoff. Extended thinking adds 43% cost with 30% quality reduction in code generation.
