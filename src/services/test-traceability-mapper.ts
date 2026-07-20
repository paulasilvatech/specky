/**
 * TestTraceabilityMapper — Reads generated test files and maps test names
 * to requirement IDs via // REQ-XXX-NNN comment convention.
 */

import type { TestResult } from "./test-result-parser.js";

export interface RequirementCoverage {
  status: "passing" | "failing" | "untested";
  test_count: number;
  passing_tests: string[];
  failing_tests: string[];
}

export interface CoverageReport {
  per_requirement: Record<string, RequirementCoverage>;
  overall_percent: number;
  failing_requirements: string[];
  untested_requirements: string[];
}

export interface FailureDetail {
  requirement_id: string;
  test_name: string;
  error_snippet: string;
  suggested_fix_prompt: string;
}

export class TestTraceabilityMapper {
  /**
   * Build a coverage report mapping test results to requirement IDs.
   * @param testFileContents - map of filename → file content (test files with REQ comments)
   * @param results - parsed test results
   * @param allRequirementIds - all requirement IDs from SPECIFICATION.md
   */
  buildCoverageReport(
    testFileContents: Record<string, string>,
    results: TestResult[],
    allRequirementIds: string[],
  ): CoverageReport {
    const testToReq = this.buildTestToReqMap(testFileContents);

    const coverage: Record<string, RequirementCoverage> = {};
    for (const reqId of allRequirementIds) {
      coverage[reqId] = { status: "untested", test_count: 0, passing_tests: [], failing_tests: [] };
    }

    for (const result of results) {
      const reqIds = this.findReqsForTest(result.test_name, testToReq);
      for (const reqId of reqIds) {
        if (!coverage[reqId]) {
          coverage[reqId] = {
            status: "untested",
            test_count: 0,
            passing_tests: [],
            failing_tests: [],
          };
        }
        const entry = coverage[reqId]!;
        entry.test_count++;
        if (result.passed) {
          entry.passing_tests.push(result.test_name);
        } else {
          entry.failing_tests.push(result.test_name);
        }
      }
    }

    // Resolve status
    for (const entry of Object.values(coverage)) {
      if (entry.failing_tests.length > 0) {
        entry.status = "failing";
      } else if (entry.passing_tests.length > 0) {
        entry.status = "passing";
      }
    }

    const total = Object.keys(coverage).length;
    const passing = Object.values(coverage).filter((e) => e.status === "passing").length;
    const overall_percent = total > 0 ? Math.round((passing / total) * 100) : 0;
    const failing_requirements = Object.entries(coverage)
      .filter(([, e]) => e.status === "failing")
      .map(([id]) => id);
    const untested_requirements = Object.entries(coverage)
      .filter(([, e]) => e.status === "untested")
      .map(([id]) => id);

    return {
      per_requirement: coverage,
      overall_percent,
      failing_requirements,
      untested_requirements,
    };
  }

  buildFailureDetails(
    results: TestResult[],
    testFileContents: Record<string, string>,
  ): FailureDetail[] {
    const testToReq = this.buildTestToReqMap(testFileContents);
    return results
      .filter((r) => !r.passed && r.error)
      .map((r) => {
        const reqIds = this.findReqsForTest(r.test_name, testToReq);
        const reqId = reqIds[0] ?? "UNKNOWN";
        return {
          requirement_id: reqId,
          test_name: r.test_name,
          error_snippet: (r.error ?? "").slice(0, 500),
          suggested_fix_prompt: `Fix the failing test "${r.test_name}" which traces to ${reqId}. Error: ${(r.error ?? "").slice(0, 200)}. Review the requirement in SPECIFICATION.md and update the implementation.`,
        };
      });
  }

  /** Build a map from test description fragments → requirement IDs */
  private buildTestToReqMap(testFileContents: Record<string, string>): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const content of Object.values(testFileContents)) {
      // Match patterns like: // REQ-001, // REQ-ROUTING-001, // Traces to: REQ-001
      const lines = content.split("\n");
      let currentReqs: string[] = [];
      for (const line of lines) {
        const reqMatches = [...line.matchAll(/\bREQ-[A-Z0-9-]+/g)].map((m) => m[0]);
        if (reqMatches.length > 0) {
          currentReqs = reqMatches;
        }
        // Test name line — JS/TS (it/test), Python (def test_x), Java/C# (void name()).
        const testNameMatch =
          line.match(/(?:it|test)\s*\(\s*["'`]([^"'`]+)["'`]/) ??
          line.match(/^\s*def\s+(test_\w+)\s*\(/) ??
          line.match(/^\s*(?:public\s+)?void\s+(\w+)\s*\(/);
        if (testNameMatch && currentReqs.length > 0) {
          const existing = map.get(testNameMatch[1]) ?? [];
          map.set(testNameMatch[1], [...existing, ...currentReqs]);
          currentReqs = [];
        }
      }
    }
    return map;
  }

  private findReqsForTest(testName: string, testToReq: Map<string, string[]>): string[] {
    // Direct match
    if (testToReq.has(testName)) return testToReq.get(testName)!;
    // Partial match
    for (const [key, reqs] of testToReq) {
      if (testName.includes(key) || key.includes(testName)) return reqs;
    }
    // Fall back to requirement IDs embedded in the test name itself — test
    // results routinely reference requirements by ID even when no test-file
    // source was scanned, and coverage must not report 0% in that case.
    return [...new Set([...testName.matchAll(/\bREQ-[A-Z]+-\d{3}\b/g)].map((m) => m[0]))];
  }
}
