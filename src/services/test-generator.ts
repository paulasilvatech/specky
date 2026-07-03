/**
 * TestGenerator — Generates test stubs from SPECIFICATION.md and TASKS.md.
 * Reads acceptance criteria and produces framework-specific test files.
 */
import type { FileManager } from "./file-manager.js";
import { currentDateString } from "../utils/runtime-context.js";
import { extractRequirementIds } from "../utils/id-contracts.js";

export type TestFramework = "vitest" | "jest" | "playwright" | "pytest" | "junit" | "xunit";

export interface TestStub {
  id: string;
  requirement_id: string;
  description: string;
  test_code: string;
}

export interface TestGenerationResult {
  framework: TestFramework;
  stubs: TestStub[];
  output_file: string;
  content: string;
  total_tests: number;
}

/**
 * Convert an arbitrary feature name into a PascalCase identifier that is
 * legal as a Java/C#/Python class name (and therefore as a javac filename).
 * Never returns an empty string or one that starts with a digit.
 */
export function pascalIdentifier(s: string): string {
  const words = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const pascal = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  if (pascal.length === 0) return "Feature";
  return /^\d/.test(pascal) ? `Feature${pascal}` : pascal;
}

const FRAMEWORK_CONFIG: Record<TestFramework, { fileBase: (featureName: string) => string; imports: string; wrapper: (name: string, body: string) => string }> = {
  vitest: {
    fileBase: (f) => `${f || "feature"}.test.ts`,
    imports: 'import { describe, it, expect } from "vitest";',
    wrapper: (name, body) => `describe("${name}", () => {\n${body}\n});`,
  },
  jest: {
    fileBase: (f) => `${f || "feature"}.test.ts`,
    imports: '// Jest — no imports needed (globals)',
    wrapper: (name, body) => `describe("${name}", () => {\n${body}\n});`,
  },
  playwright: {
    fileBase: (f) => `${f || "feature"}.spec.ts`,
    imports: 'import { test, expect } from "@playwright/test";',
    wrapper: (name, body) => `test.describe("${name}", () => {\n${body}\n});`,
  },
  pytest: {
    // Hyphens are illegal in Python module names — pytest cannot import them.
    fileBase: (f) => `${(f || "feature").replace(/-+/g, "_").toLowerCase()}_test.py`,
    imports: "import pytest",
    wrapper: (name, body) =>
      `class Test${pascalIdentifier(name)}:\n    """Test stubs generated from acceptance criteria."""\n\n${body}`,
  },
  junit: {
    // javac requires the filename to match the public class name exactly.
    fileBase: (f) => `${pascalIdentifier(f)}Test.java`,
    imports: 'import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;',
    wrapper: (name, body) => `public class ${pascalIdentifier(name)}Test {\n${body}\n}`,
  },
  xunit: {
    fileBase: (f) => `${pascalIdentifier(f)}Tests.cs`,
    imports: "using Xunit;",
    wrapper: (name, body) => `public class ${pascalIdentifier(name)}Tests {\n${body}\n}`,
  },
};

export class TestGenerator {
  constructor(private fileManager: FileManager) {}

  async generate(
    featureDir: string,
    framework: TestFramework,
    outputDir: string,
  ): Promise<TestGenerationResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const tasks = await this.safeRead(featureDir, "TASKS.md");
    const combined = [spec, tasks].filter(Boolean).join("\n");

    const criteria = this.extractAcceptanceCriteria(combined);
    const reqs = this.extractRequirements(combined);

    const stubs = this.buildStubs(criteria, reqs, framework);
    const content = this.renderFile(stubs, framework, featureDir);
    const featureName = featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9-]/g, "");
    const cfg = FRAMEWORK_CONFIG[framework];
    const outputFile = `${outputDir}/${cfg.fileBase(featureName)}`;

    return {
      framework,
      stubs,
      output_file: outputFile,
      content,
      total_tests: stubs.length,
    };
  }

  extractAcceptanceCriteria(text: string): Array<{ id: string; criterion: string }> {
    const results: Array<{ id: string; criterion: string }> = [];
    const lines = text.split("\n");
    let currentReq: string | null = null;
    let inCriteriaBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Structural markdown is never an acceptance criterion and closes any
      // open criteria block: headings, table rows, horizontal rules. Headings
      // still update the current requirement ("### REQ-XXX-NNN: ...").
      if (line.startsWith("#") || line.startsWith("|") || /^-{3,}$/.test(line)) {
        if (line.startsWith("#")) {
          const headingReq = extractRequirementIds(line)[0];
          if (headingReq) currentReq = headingReq;
        }
        inCriteriaBlock = false;
        continue;
      }

      // An "**Acceptance Criteria:**" label opens a criteria block; the label
      // itself is markdown noise, not a criterion.
      if (/^[-*\s]*\**\s*acceptance criteria\s*:?\s*\**$/i.test(line)) {
        inCriteriaBlock = true;
        continue;
      }

      if (line === "") continue;

      const reqId = extractRequirementIds(line)[0];
      if (reqId) currentReq = reqId;

      const bulletMatch = line.match(/^[-*]\s+(?:AC[-_]?\d*[:.]\s*)?(.+)$/i);
      if (!bulletMatch) {
        // Plain prose (requirement sentences, "**Source:** ..." trailers)
        // ends the criteria block.
        inCriteriaBlock = false;
        continue;
      }

      const criterion = bulletMatch[1].trim();
      // Table-of-contents entries and other pure anchor links are noise.
      if (/^\[[^\]]*\]\(#[^)]*\)$/.test(criterion)) continue;

      const isBddStyle = /^(Given|When|Then|Verify|Check|Ensure|Confirm)\b/i.test(criterion);
      // Only emit criteria that trace to a real requirement — never fabricate
      // a nonexistent REQ-000.
      if ((inCriteriaBlock || isBddStyle) && currentReq) {
        results.push({ id: currentReq, criterion });
      }
    }

    // Fallback: if no ACs found, generate from requirements themselves
    if (results.length === 0) {
      const reqLines = lines.filter(
        (l) =>
          /(?:shall|must|should)\s/i.test(l) &&
          !l.trim().startsWith("|") &&
          !l.trim().startsWith("#") &&
          !/\]\(#/.test(l),
      );
      for (let i = 0; i < reqLines.length; i++) {
        const inlineId = extractRequirementIds(reqLines[i])[0];
        results.push({
          id: inlineId ?? `REQ-${String(i + 1).padStart(3, "0")}`,
          criterion: reqLines[i].trim().replace(/^[-*#\d.)\s]+/, ""),
        });
      }
    }

    return results;
  }

  extractRequirements(text: string): string[] {
    return text
      .split("\n")
      .filter(l => l.match(/(?:shall|must)\s/i) && l.trim().length > 15)
      .map(l => l.trim().replace(/^[-*#\d.)\s]+/, ""));
  }

  buildStubs(
    criteria: Array<{ id: string; criterion: string }>,
    _reqs: string[],
    framework: TestFramework,
  ): TestStub[] {
    const usedNames = new Set<string>();
    return criteria.map((ac, i) => {
      const stubId = `TC-${String(i + 1).padStart(3, "0")}`;
      const desc = ac.criterion.length > 80
        ? ac.criterion.slice(0, 77) + "..."
        : ac.criterion;
      const testCode = this.generateTestBody(desc, ac.id, framework, usedNames);
      return {
        id: stubId,
        requirement_id: ac.id,
        description: desc,
        test_code: testCode,
      };
    });
  }

  private generateTestBody(
    description: string,
    requirementId: string,
    framework: TestFramework,
    usedNames: Set<string>,
  ): string {
    // Test names carry the FULL requirement ID (e.g. "REQ-API-001") so that
    // name-based traceability in sdd_verify_tests works on the stubs as-is.
    const title = description.startsWith(requirementId)
      ? description
      : `${requirementId}: ${description}`;
    const safeTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    switch (framework) {
      case "vitest":
      case "jest":
        return `  // Traces to: ${requirementId}\n  it("${safeTitle}", () => {\n    // TODO: implement test\n    expect(true).toBe(true);\n  });`;
      case "playwright":
        return `  // Traces to: ${requirementId}\n  test("${safeTitle}", async ({ page }) => {\n    // TODO: implement E2E test\n    await expect(page).toBeTruthy();\n  });`;
      case "pytest": {
        const name = this.uniqueName(`test_${this.snakeCase(title)}`, usedNames, "_");
        const docstring = title.replace(/\\/g, "/").replace(/"/g, "'");
        return `    # Traces to: ${requirementId}\n    def ${name}(self):\n        """${docstring}"""\n        # TODO: implement test\n        assert True`;
      }
      case "junit": {
        const name = this.uniqueName(this.camelCase(title) || "requirement", usedNames, "");
        return `    // Traces to: ${requirementId}\n    @Test\n    void ${name}() {\n        // TODO: implement test\n        assertTrue(true);\n    }`;
      }
      case "xunit": {
        const name = this.uniqueName(this.pascalCase(title) || "Requirement", usedNames, "");
        return `    // Traces to: ${requirementId}\n    [Fact]\n    public void ${name}() {\n        // TODO: implement test\n        Assert.True(true);\n    }`;
      }
    }
  }

  /** Deduplicate generated identifiers — javac/C# reject duplicate members. */
  private uniqueName(base: string, used: Set<string>, separator: string): string {
    let candidate = base;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${base}${separator}${counter}`;
      counter++;
    }
    used.add(candidate);
    return candidate;
  }

  private renderFile(stubs: TestStub[], framework: TestFramework, featureDir: string): string {
    const cfg = FRAMEWORK_CONFIG[framework];
    const featureName = featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9 -]/g, "") || "Feature";
    const body = stubs.map(s => s.test_code).join("\n\n");
    const date = currentDateString();

    if (framework === "pytest") {
      // Python: a JS-style block comment is a SyntaxError. Emit a module
      // docstring instead, mirroring the hypothesis PBT generator.
      const header = [
        `"""`,
        `Auto-generated test stubs from Specky SDD`,
        `Feature: ${featureName}`,
        `Framework: pytest`,
        `Generated: ${date}`,
        ``,
        `Each test traces to an acceptance criterion from SPECIFICATION.md.`,
        `Replace the TODO placeholders with real assertions.`,
        `"""`,
      ].join("\n");
      return `${header}\n\n${cfg.imports}\n\n\n${cfg.wrapper(featureName, body)}\n`;
    }

    const header = `/**\n * Auto-generated test stubs from Specky SDD\n * Feature: ${featureName}\n * Framework: ${framework}\n * Generated: ${date}\n *\n * Each test traces to an acceptance criterion from SPECIFICATION.md.\n * Replace the TODO placeholders with real assertions.\n */\n`;

    return `${header}\n${cfg.imports}\n\n${cfg.wrapper(featureName, body)}\n`;
  }

  private snakeCase(s: string): string {
    return s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().slice(0, 60).replace(/^_+|_+$/g, "");
  }

  private camelCase(s: string): string {
    const words = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    const name = (words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("")).slice(0, 60);
    return /^\d/.test(name) ? `test${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  }

  private pascalCase(s: string): string {
    const name = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 60);
    return /^\d/.test(name) ? `Test${name}` : name;
  }

  private async safeRead(featureDir: string, file: string): Promise<string> {
    try {
      const parts = featureDir.split("/");
      const specDir = parts.slice(0, -1).join("/") || ".specs";
      return await this.fileManager.readSpecFile(specDir, `${parts[parts.length - 1]}/${file}`);
    } catch {
      return "";
    }
  }

  // ── Test Verification ─────────────────────────────────────────────────

  /**
   * Verify test results against specification requirements.
   * Accepts a JSON string of test results and cross-references with requirement IDs.
   */
  async verifyTestResults(
    featureDir: string,
    testResultsJson: string,
  ): Promise<TestVerificationResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const reqIds = this.extractRequirementIds(spec);

    let testResults: Array<{ name: string; status: string }>;
    try {
      const parsed = JSON.parse(testResultsJson);
      testResults = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.testResults)
          ? parsed.testResults
          : Array.isArray(parsed.tests)
            ? parsed.tests
            : [];
    } catch {
      return {
        total_requirements: reqIds.length,
        covered_requirements: [],
        uncovered_requirements: reqIds,
        coverage_percentage: 0,
        total_tests: 0,
        passed_tests: 0,
        failed_tests: 0,
        traceability_matrix: [],
        error: "Invalid JSON: could not parse test results.",
      };
    }

    const passedTests = testResults.filter(t => t.status === "passed" || t.status === "pass");
    const failedTests = testResults.filter(t => t.status === "failed" || t.status === "fail");

    // Match: a requirement is "covered" if any test name contains its ID
    const covered: string[] = [];
    const uncovered: string[] = [];
    const matrix: Array<{ requirement: string; tests: string[]; status: string }> = [];

    for (const reqId of reqIds) {
      const matchingTests = testResults.filter(t =>
        t.name.includes(reqId) || t.name.toLowerCase().includes(reqId.toLowerCase()),
      );
      if (matchingTests.length > 0) {
        covered.push(reqId);
        const allPassed = matchingTests.every(t => t.status === "passed" || t.status === "pass");
        matrix.push({ requirement: reqId, tests: matchingTests.map(t => t.name), status: allPassed ? "covered" : "failing" });
      } else {
        uncovered.push(reqId);
        matrix.push({ requirement: reqId, tests: [], status: "uncovered" });
      }
    }

    const coveragePercentage = reqIds.length > 0
      ? Math.round((covered.length / reqIds.length) * 100)
      : 100;

    return {
      total_requirements: reqIds.length,
      covered_requirements: covered,
      uncovered_requirements: uncovered,
      coverage_percentage: coveragePercentage,
      total_tests: testResults.length,
      passed_tests: passedTests.length,
      failed_tests: failedTests.length,
      traceability_matrix: matrix,
    };
  }

  private extractRequirementIds(text: string): string[] {
    const ids = new Set<string>();
    const regex = /REQ-(?:[A-Z]+-)?\d{3}/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      ids.add(match[0]);
    }
    return [...ids].sort();
  }
}

export interface TestVerificationResult {
  total_requirements: number;
  covered_requirements: string[];
  uncovered_requirements: string[];
  coverage_percentage: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  traceability_matrix: Array<{ requirement: string; tests: string[]; status: string }>;
  error?: string;
}
