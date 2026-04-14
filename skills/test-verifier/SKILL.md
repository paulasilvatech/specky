---
name: Test Verification Specialist
description: "This skill should be used when the user asks to 'verify tests', 'check coverage', 'detect phantom completions', 'check spec drift', or needs guidance on Phase 7 verification. Also trigger on 'sdd test', 'test traceability', 'verification report', or 'gate criteria'."
---

# Test Verification Specialist (Phase 7)

## Overview

Phase 7 systematically verifies that implementation matches specification, achieves required test coverage, detects phantom completions, and identifies spec-code drift.

## Verification Workflow

Execute tests against implementation and generate comprehensive verification report:

1. **Test Execution** — Run full test suite (unit, integration, E2E)
2. **Coverage Analysis** — Generate coverage reports by module and feature
3. **Traceability Check** — Map test cases to SPECIFICATION.md requirements
4. **Phantom Detection** — Identify tests passing without validating requirements
5. **Drift Analysis** — Compare implemented behavior to SPECIFICATION.md
6. **Gate Validation** — Confirm all gate criteria met

## Verification Gate Criteria

All four criteria must pass to advance to Phase 8:

### Gate 1: Test Pass Rate
- Minimum 90% of all tests passing
- 100% of P0 (critical) tests passing
- Zero skipped tests in main branch
- Flaky tests identified and documented

### Gate 2: Coverage Requirements
- Minimum 80% line coverage overall
- Minimum 90% coverage for security-critical modules
- All SPECIFICATION.md requirements have associated tests
- Coverage report includes branch coverage metrics

### Gate 3: Phantom Completion Detection
Zero phantom completions. A phantom completion is a test that passes without validating the intended requirement:

Common patterns (detect and fix):
- Mocked external service returning hardcoded success
- Test bypassing validation logic via direct database insert
- Assertion checking only response code, not data correctness
- Skip-decorated tests counted as passing
- Tests that don't execute the requirement implementation path

Use mutation testing and requirement traceability to identify phantoms.

### Gate 4: Spec-Code Drift
Maximum 20% acceptable drift. Drift occurs when:
- Implementation differs from SPECIFICATION.md requirement
- SPECIFICATION.md requirement not implemented
- Code implements undocumented features not in SPECIFICATION.md
- Performance metrics miss DESIGN.md NFR targets

Drift analysis output:
```
Total requirements: 150
Implemented as-spec: 130 (86.7%)
Minor drift: 15 (10%)
Major drift: 5 (3.3%)
Drift ratio: 13% ✓ PASS (≤20%)
```

## Phantom Completion Detection

Systematic approach to identifying false-positive tests:

### 1. Requirement Traceability
Link each test to specific SPECIFICATION.md requirement:
```
Test: test_user_login_with_invalid_password
Requirement: REQ-AUTH-001 (System shall validate password strength)
Coverage: Test validates lowercase-only password rejected
Status: ✓ VALID (tests actual requirement)
```

### 2. Mutation Testing
Introduce deliberate code changes and verify tests catch them:
- Remove validation logic → test should fail
- Change conditional operator → test should fail
- Comment out critical line → test should fail

If tests pass after mutation, mark as phantom.

### 3. Mocking Audit
Review all mocks and stubs:
- Mocks returning hardcoded success without validation → PHANTOM
- External service calls properly stubbed with realistic responses → VALID
- Database operations actually executed, not just stubbed → VALID

### 4. Assertion Audit
Verify test assertions validate actual behavior:
- `assert response.status == 200` alone → Partial (adds Gate 2)
- `assert response.status == 200 AND response.data.id is not None` → Better
- `assert response.status == 200 AND response.data == expected_user` → VALID

## Spec-Code Drift Analysis

Perform bidirectional analysis comparing SPECIFICATION.md to implementation:

### Direction 1: Code Coverage of Spec
For each requirement in SPECIFICATION.md:
- Is it implemented? (yes/no)
- Is implementation correct? (match specification)
- Are there tests validating it? (yes/no)
- Test coverage adequate? (80%+ pass rate)

### Direction 2: Spec Coverage of Code
For each implementation feature:
- Is it described in SPECIFICATION.md? (yes/no)
- If no, is it documented elsewhere? (design doc/ADR)
- Is undocumented feature acceptable? (yes/no/risk)

### Drift Report Format

```
## Spec-Code Drift Analysis

### SPECIFICATION.md Coverage: 86.7%
#### Unimplemented Requirements (4)
- REQ-PAYMENT-005: Multi-currency support → STATUS: Deferred to v2
- REQ-ADMIN-002: Bulk user export → STATUS: In progress
- REQ-REPORT-001: Custom reports → STATUS: Not started
- REQ-MOBILE-001: Native mobile app → STATUS: Out of scope

#### Partially Implemented (8)
- REQ-AUTH-001: Password reset → Missing email verification step
- REQ-SEARCH-002: Advanced filters → Partial (date filter missing)

### Implementation Coverage: 95%
#### Undocumented Features (5)
- CSV import from settings menu → Added QA request
- Automatic backup on deploy → Config-driven
- Rate limiting on APIs → Security measure, documented in DESIGN.md

### Drift Ratio: 13% PASS
```

## VERIFICATION.md Format

Produce standardized verification artifact:

```markdown
# Verification Report
**Date:** [Date]
**Version:** [spec version]
**Prepared by:** [automation/analyst]

## Executive Summary
- Tests executed: [count]
- Pass rate: [%]
- Coverage: [%]
- Drift: [%]
- Gate status: [PASS/FAIL]

## Test Results
### Unit Tests
- Executed: [count]
- Passed: [count]
- Failed: [count]
- Skipped: [count]

### Integration Tests
[similar structure]

### End-to-End Tests
[similar structure]

## Coverage Analysis
[by module with percentages]

## Phantom Completions
- Detected: [count]
- Resolved: [count]
- Status: [VERIFIED CLEAN]

## Spec-Code Drift
[drift analysis with table]

## Gate Criteria Status
- [ ] ≥90% test pass rate
- [ ] ≥80% code coverage
- [ ] Zero phantom completions
- [ ] Drift ≤20%

**Overall Gate Status:** PASS / CONDITIONAL / FAIL

## Recommendations
[Items for Phase 8 review]
```

## Verification Commands

```
/specky:verify --full         # Complete verification
/specky:verify --coverage     # Coverage report only
/specky:verify --drift        # Spec-code drift analysis
/specky:verify --phantoms     # Phantom detection only
/specky:verify --gates        # Gate criteria check
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `sdd_verify_tests` | Parse test results, map to REQ-IDs, build coverage report |
| `sdd_verify_tasks` | Detect phantom completions (tasks done but tests failing) |
| `sdd_check_sync` | Detect spec-code drift (requirements vs implementation) |
| `sdd_validate_ears` | Re-validate EARS pattern integrity |
| `sdd_get_status` | Check pipeline state and current phase |

## Companion Agent

**@test-verifier** — Phase 7 agent that calls these tools in sequence. Load this skill as first step.
