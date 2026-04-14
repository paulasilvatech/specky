---
name: Release Engineer
description: "This skill should be used when the user asks to 'prepare release', 'create PR', 'generate documentation', 'run release gates', or needs guidance on Phase 9 release. Also trigger on 'sdd release', 'blocking gates', 'security scan', 'release gate', or 'export work items'."
---

# Release Engineer (Phase 9)

## Overview

Phase 9 executes final release gates, creates deployment artifacts, generates user documentation, and publishes work items. It is the final verification before production deployment.

## Prerequisites for Release

Before Phase 9 begins, verify these mandatory conditions:

### From Phase 8 (Review)
- ANALYSIS.md exists and is marked APPROVE (not CONDITIONAL or REJECT)
- All P0 and P1 review items resolved
- Security scan completed with no critical findings
- Performance benchmarks validated
- Code review sign-off from 2+ maintainers

### From Phase 7 (Verify)
- VERIFICATION.md shows ≥90% test pass rate
- All P0 (critical) tests passing
- Coverage ≥80% overall, ≥90% for security modules
- Zero phantom completions verified
- Spec-code drift ≤20%

Missing prerequisites block release. Run `/specky:check-gates` to validate.

## Blocking Gates

Two sequential blocking gates must pass before release:

### Gate 1: Security Gate (security-scan.sh)

Execute security scanning:
```bash
./scripts/security-scan.sh --full
```

Checks performed:
- Dependency vulnerability scan (npm audit, pip check, cargo audit)
- Container image scanning (Trivy, Snyk)
- SAST analysis (SonarQube, Semgrep)
- Secrets detection (git-secrets, TruffleHog)
- License compliance (SBOM generation)

Pass criteria:
- Zero critical vulnerabilities in dependencies
- Zero high-severity secrets in codebase
- All open-source licenses approved
- Container images free of critical CVEs
- SAST findings resolved or accepted

Fail items block release completely.

### Gate 2: Release Gate (release-gate.sh)

Execute final release checklist:
```bash
./scripts/release-gate.sh --version=X.Y.Z
```

Verifies:
- Build succeeds on clean checkout
- All tests pass in CI/CD
- Deployment to staging succeeds
- Smoke tests pass in staging
- Documentation builds without errors
- Changelog is complete and accurate
- Version numbering follows semver
- Git tags created and pushed
- Release notes generated

Pass criteria:
- All checks return status 0
- No deployment rollback needed in staging
- Documentation publicly accessible

Either gate failure blocks release. Manual override requires CISO approval (security) or engineering director approval (release).

## Documentation Generation

Auto-generate deployment documentation from DESIGN.md and SPECIFICATION.md:

### User Documentation
Generate from SPECIFICATION.md user-facing requirements:
- Feature overview with screenshots
- User workflows and step-by-step guides
- FAQ addressing common questions
- Troubleshooting section
- Support contact information

Format: Markdown → PDF/HTML via doc pipeline

### API Documentation
Generate from DESIGN.md API contracts:
- Endpoint reference (method, path, parameters)
- Request/response schemas with examples
- Error codes and handling guidance
- Rate limiting and quotas
- SDK samples (curl, Python, JavaScript)

Format: OpenAPI spec → Swagger UI / Redoc

### Deployment Guide
From DESIGN.md deployment topology:
- Infrastructure requirements (CPU, memory, storage)
- Installation steps for supported platforms
- Configuration options and environment variables
- Database migration procedures
- Backup and recovery procedures
- Rollback procedures

Format: Markdown

### Runbook
From DESIGN.md and operational NFRs:
- Health check procedures
- Monitoring and alerting setup
- Common operational tasks
- Incident response procedures
- Performance tuning guidelines

## PR Creation

Create GitHub/GitLab PR with generated release description:

```
## Release v1.2.3

**Release Type:** [Major | Minor | Patch]
**Date:** [YYYY-MM-DD]

### Summary
[Auto-generated from SPECIFICATION.md summary]

### Features
- [REQ-FEAT-001] Feature description
- [REQ-FEAT-002] Feature description

### Fixes
- [REQ-BUG-001] Bug description
- [REQ-BUG-002] Bug description

### Breaking Changes
[If major version]
- [BREAKING-001] Description
- Migration guide: [link]

### Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Security scan clean
- [ ] Changelog complete
- [ ] Version bumped correctly
- [ ] Release notes reviewed

**Artifacts:**
- Binary/image: [link]
- Documentation: [link]
- Changelog: [link]

Approvals:
- [x] Code review
- [x] Security review
- [x] Product review
```

Set PR to merge following the Gitflow-SDD branching strategy:

- From `spec/NNN-*` branch → target `develop` (after Phase 7 verification)
- From `develop` → target `stage` (after integration review)
- From `stage` → target `main` (after all blocking gates pass)

Require 2+ approvals. Never merge a spec branch directly to main or stage.

## Work Item Export

Export implementation tracking to project management tool:

Generate from TASKS.md and implementation history:

```
Work Item Type: Release
Title: Release v1.2.3
Status: Ready for Release
Completion: 100%

Linked Tasks (completed):
- TASK-001: Feature A implementation (100%)
- TASK-002: Feature B implementation (100%)
- TASK-003: Bug C fix (100%)

Related PRs:
- PR-#451: Implement feature A
- PR-#452: Implement feature B
- PR-#453: Fix bug C

Metrics:
- Tasks completed: 20 of 20
- Lines of code: [count]
- Test coverage: 87%
- Cycle time: 14 days

Artifacts:
- Release binary: [link]
- Release notes: [link]
- Deployment guide: [link]
```

Export to Jira, Linear, Azure DevOps, or Asana via REST API.

## Changelog Format

Generate from commit history, SPECIFICATION.md, and VERIFICATION.md:

```markdown
# Changelog - v1.2.3

**Released:** 2026-04-13

## [1.2.3] - 2026-04-13

### Added
- REQ-FEAT-001: User dashboard with real-time metrics
- REQ-FEAT-002: Bulk operations via CSV import
- REQ-FEAT-003: Advanced search with filters

### Fixed
- REQ-BUG-001: Login timeout on slow networks
- REQ-BUG-002: Export function truncating long values

### Changed
- REQ-ENHANCEMENT-001: Improved search performance by 40%
- REQ-ENHANCEMENT-002: Redesigned settings UI

### Deprecated
- Old reporting API (use Analytics API instead)
- CSV export format v1 (migrate to v2)

### Removed
- Legacy authentication method (deprecated in v1.1.0)

### Security
- Fixed XSS vulnerability in rich text editor
- Updated dependencies with security patches

### Performance
- Reduced API response time by 35% (REQ-NFR-001)
- Optimized database queries for large datasets

## [1.2.2] - 2026-03-30
[previous release notes...]
```

## Release Commands

```
/specky:release --version=X.Y.Z          # Full release workflow
/specky:release --security-scan          # Run security gate only
/specky:release --generate-docs          # Generate docs only
/specky:release --create-pr --no-merge   # Create PR, don't merge
/specky:release --export-items            # Export to project mgmt
```

## Release Rollback Procedure

If post-release issues detected:

1. Trigger rollback: `/specky:rollback --version=X.Y.Z`
2. Revert to previous stable version
3. Create incident report in ANALYSIS.md
4. Schedule post-mortem
5. Update release procedures to prevent recurrence

## MCP Tools

| Tool | Purpose |
|------|---------|
| `sdd_create_pr` | Generate PR payload with spec summary and correct branch target |
| `sdd_generate_all_docs` | Parallel generation of all documentation types |
| `sdd_generate_docs` | Generate user documentation from SPECIFICATION.md |
| `sdd_generate_api_docs` | Generate API reference from DESIGN.md |
| `sdd_generate_runbook` | Generate operational runbook from DESIGN.md |
| `sdd_generate_onboarding` | Generate developer onboarding guide |
| `sdd_export_work_items` | Export tasks to GitHub Issues / Azure DevOps / Jira |

## Companion Agent

**@release-engineer** — Phase 9 agent that runs blocking gates and calls these tools. Load this skill as first step.
