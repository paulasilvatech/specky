/**
 * TestGenerator — Generates test stubs from SPECIFICATION.md and TASKS.md.
 * Reads acceptance criteria and produces framework-specific test files.
 */
import type { FileManager } from "./file-manager.js";

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

const FRAMEWORK_CONFIG: Record<TestFramework, { ext: string; imports: string; wrapper: (name: string, body: string) => string }> = {
  vitest: {
    ext: ".test.ts",
    imports: 'import { describe, it, expect } from "vitest";',
    wrapper: (name, body) => `describe("${name}", () => {\n${body}\n});`,
  },
  jest: {
    ext: ".test.ts",
    imports: '// Jest — no imports needed (globals)',
    wrapper: (name, body) => `describe("${name}", () => {\n${body}\n});`,
  },
  playwright: {
    ext: ".spec.ts",
    imports: 'import { test, expect } from "@playwright/test";',
    wrapper: (name, body) => `test.describe("${name}", () => {\n${body}\n});`,
  },
  pytest: {
    ext: "_test.py",
    imports: "import pytest",
    wrapper: (name, body) => `class Test${name.replace(/[^a-zA-Z0-9]/g, "")}:\n${body}`,
  },
  junit: {
    ext: "Test.java",
    imports: 'import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;',
    wrapper: (name, body) => `public class ${name.replace(/[^a-zA-Z0-9]/g, "")}Test {\n${body}\n}`,
  },
  xunit: {
    ext: "Tests.cs",
    imports: "using Xunit;",
    wrapper: (name, body) => `public class ${name.replace(/[^a-zA-Z0-9]/g, "")}Tests {\n${body}\n}`,
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
    const outputFile = `${outputDir}/${featureName}${cfg.ext}`;

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
    let currentReq = "REQ-000";

    for (const line of lines) {
      const reqMatch = line.match(/(REQ-\d+)/);
      if (reqMatch) currentReq = reqMatch[1];

      const acMatch = line.match(/[-*]\s*(?:AC[-_]?\d*[:.])?\s*(.+)/i);
      if (acMatch && (line.toLowerCase().includes("accept") || line.match(/^\s*[-*]\s+(Given|When|Then|Verify|Check|Ensure|Confirm)/i))) {
        results.push({ id: currentReq, criterion: acMatch[1].trim() });
      }
    }

    // Fallback: if no ACs found, generate from requirements themselves
    if (results.length === 0) {
      const reqLines = text.split("\n").filter(l => l.match(/(?:shall|must|should)\s/i));
      for (let i = 0; i < reqLines.length; i++) {
        results.push({ id: `REQ-${String(i + 1).padStart(3, "0")}`, criterion: reqLines[i].trim().replace(/^[-*#\d.)\s]+/, "") });
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
    return criteria.map((ac, i) => {
      const stubId = `TC-${String(i + 1).padStart(3, "0")}`;
      const desc = ac.criterion.length > 80
        ? ac.criterion.slice(0, 77) + "..."
        : ac.criterion;
      const testCode = this.generateTestBody(desc, framework);
      return {
        id: stubId,
        requirement_id: ac.id,
        description: desc,
        test_code: testCode,
      };
    });
  }

  private generateTestBody(description: string, framework: TestFramework): string {
    const safeDesc = description.replace(/"/g, '\\"');
    switch (framework) {
      case "vitest":
      case "jest":
        return `  it("${safeDesc}", () => {\n    // TODO: implement test\n    expect(true).toBe(true);\n  });`;
      case "playwright":
        return `  test("${safeDesc}", async ({ page }) => {\n    // TODO: implement E2E test\n    await expect(page).toBeTruthy();\n  });`;
      case "pytest":
        return `    def test_${this.snakeCase(description)}(self):\n        # TODO: implement test\n        assert True`;
      case "junit":
        return `    @Test\n    void ${this.camelCase(description)}() {\n        // TODO: implement test\n        assertTrue(true);\n    }`;
      case "xunit":
        return `    [Fact]\n    public void ${this.pascalCase(description)}() {\n        // TODO: implement test\n        Assert.True(true);\n    }`;
    }
  }

  private renderFile(stubs: TestStub[], framework: TestFramework, featureDir: string): string {
    const cfg = FRAMEWORK_CONFIG[framework];
    const featureName = featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9 -]/g, "") || "Feature";
    const body = stubs.map(s => s.test_code).join("\n\n");
    const header = `/**\n * Auto-generated test stubs from Specky SDD\n * Feature: ${featureName}\n * Framework: ${framework}\n * Generated: ${new Date().toISOString().split("T")[0]}\n *\n * Each test traces to an acceptance criterion from SPECIFICATION.md.\n * Replace the TODO placeholders with real assertions.\n */\n`;

    return `${header}\n${cfg.imports}\n\n${cfg.wrapper(featureName, body)}\n`;
  }

  private snakeCase(s: string): string {
    return s.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().slice(0, 60);
  }

  private camelCase(s: string): string {
    const words = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/);
    return words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  }

  private pascalCase(s: string): string {
    return s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 60);
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
}
