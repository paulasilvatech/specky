---
title: "Specky — Verified Test Loop — Project Constitution"
feature_id: "006-verified-test-loop"
project_id: specky-verified-test-loop
version: 1.0.0
date: 2026-04-12
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Approved
last_amended: 2026-04-12
amendment_count: 0
---

# Specky — Verified Test Loop — Project Constitution

> Close the gap between test stub generation and test execution: `sdd_verify_tests` must execute generated tests via MCP and report pass/fail per acceptance criteria — not just check text file contents.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Specky closes the TDD loop. Test stubs are generated, executed via MCP test runner, and results mapped back to acceptance criteria — giving developers a verified pass/fail signal per requirement, not just a file listing.

### 1.2 Problem Statement

The current `sdd_verify_tests` detects "phantom completions" by analyzing task file text. The paper arXiv:2604.03196 shows CRA merge rate is 45.20% vs 68.37% for humans — code review agentivo still fails in ~55% of cases. Text analysis of task files without execution produces false positives. The paper arXiv:2404.10100 shows +20% pass@1 with TDD interactive loop — executing tests and feeding results back closes the loop.

### 1.3 Success Criteria

- **SC-001:** `sdd_verify_tests` calls the test runner via MCP and receives structured pass/fail results
- **SC-002:** Results are mapped to acceptance criteria IDs from SPECIFICATION.md
- **SC-003:** Coverage report shows which requirements have passing tests and which do not
- **SC-004:** Failed test output is included in the response for agent debugging
- **SC-005:** Works with Vitest, Jest, pytest, JUnit, xUnit via their MCP servers or CLI output parsing
- **SC-006:** Falls back to text analysis if no test runner MCP is available

### 1.4 Constraints

| Constraint | Detail |
|------------|--------|
| MCP-optional | Test execution via MCP is preferred; CLI fallback always available |
| No test modification | sdd_verify_tests reads and executes — never writes test files |
| Framework detection | Uses sdd_scan_codebase results to select correct runner |

---

## References

- arXiv:2404.10100 — LLMTCG: TDD interactive loop, +20% pass@1
- arXiv:2604.03196 — CRA Reality: 45.20% merge vs 68.37% human
- arXiv:2509.14745 — Agentic PRs: 83.8% accepted, 54.9% unmodified
