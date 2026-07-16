---
name: specky-test-verifier
description: "This skill should be used when the user asks to 'verify tests', 'check coverage', 'detect phantom completions', 'check spec drift', or needs guidance on Phase 8 verification. Also trigger on 'sdd test', 'test traceability', 'verification report', or 'gate criteria'."
---

# Test Verification — Contracted Evidence

## Preconditions

The feature must enable `tdd`. Read these persisted values before running anything:

- framework and property framework
- output directory and trace marker
- coverage threshold
- executable example-test and property bindings

Specky does not generate TODO tests or in-file fake system models. A binding must cover every requirement ID and contain executable, nontrivial assertions.

## Workflow

1. Run the configured framework and capture machine-readable results.
2. Call `sdd_verify_tests` with `spec_dir`, `feature_number`, and `test_results_json`.
3. Compare `effectiveCoverage` to the response’s contracted `coverage_threshold` and `meets_threshold`; do not assume 80%, 90%, or 100% globally.
4. Call `sdd_verify_tasks` with explicit `code_paths` to identify task evidence and phantom completions.
5. Call `sdd_check_sync` with explicit code paths to identify requirement drift.
6. Re-run EARS validation against the selected feature.

## Evidence Rules

- Test names or trace comments carry real `REQ-*` IDs.
- Passing status without a requirement trace does not count as coverage.
- Placeholder assertions (`expect(true)`, `assert True`, TODO bodies) are rejected by contract validation.
- Property bindings must include their requirement ID in executable code and may not use generated model stubs.
- Every claimed task completion points to implementation evidence in the supplied code paths.

## Output

Present coverage by requirement, failing and untested IDs, threshold result, task verification, and drift evidence. The server computes the gate; do not manufacture PASS/FAIL from prose.
