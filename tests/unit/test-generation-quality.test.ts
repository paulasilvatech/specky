/**
 * test-generation-quality.test.ts — regression coverage for the promise-delivery
 * audit findings on sdd_generate_tests / sdd_generate_pbt / sdd_verify_tests:
 *
 * 1. pytest output was a Python SyntaxError (JS-style comment header).
 * 2. junit class name never matched a javac-legal filename; duplicate methods.
 * 3. xunit emitted duplicate member definitions.
 * 4. Markdown noise (ToC links, "**Acceptance Criteria:**" labels, table rows)
 *    became tests, traced to nonexistent REQ-000, and truncated the REQ- prefix.
 * 5. fast-check PBT used a nonexistent `{ fc }` named export, TODO-only bodies
 *    calling undefined helpers, and fabricated REQ-GEN-00N trace IDs.
 * 6. hypothesis PBT called undefined helpers and fabricated REQ-GEN-00N IDs.
 * 7. sdd_verify_tests enhanced_coverage only scanned the .specs feature dir and
 *    reported 0% right after sdd_generate_tests wrote tests elsewhere.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileManager } from "../../src/services/file-manager.js";
import { TestGenerator, pascalIdentifier } from "../../src/services/test-generator.js";
import type { TestFramework } from "../../src/services/test-generator.js";
import { PbtGenerator } from "../../src/services/pbt-generator.js";
import { TestTraceabilityMapper } from "../../src/services/test-traceability-mapper.js";
import {
  GENERATED_TESTS_MANIFEST,
  collectTestFileContents,
  recordGeneratedTest,
} from "../../src/tools/testing.js";

const havePython = (() => {
  const probe = spawnSync("python3", ["--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
})();

/** Realistic SPECIFICATION.md as written by sdd_write_spec (ToC + headings + AC table). */
const SPEC_MD = [
  "# Todo API — Specification",
  "",
  "## Table of Contents",
  "",
  "- [1. Core Requirements](#1-core-requirements)",
  "- [Acceptance Criteria Summary](#acceptance-criteria-summary)",
  "",
  "---",
  "",
  "## 1. Core Requirements",
  "",
  "### REQ-API-001: (event_driven)",
  "",
  "When a client sends POST /todos, the system shall create a todo item.",
  "",
  "**Acceptance Criteria:**",
  "- Given a valid payload, when POST /todos is called, then a todo is created",
  "- The response includes the created todo id",
  "",
  "---",
  "",
  "### REQ-API-002: (ubiquitous)",
  "",
  "The system shall persist todo items across restarts.",
  "",
  "**Acceptance Criteria:**",
  "- Verify todos survive a service restart",
  "",
  "---",
  "",
  "### REQ-SEC-001: (unwanted_behavior)",
  "",
  "If a request is unauthenticated, then the system shall reject it with 401.",
  "",
  "**Acceptance Criteria:**",
  "- Ensure unauthenticated requests receive 401",
  "- Ensure unauthenticated requests receive 401",
  "",
  "---",
  "",
  "## Acceptance Criteria Summary",
  "",
  "| ID | Requirement | Test Method |",
  "|----|-------------|-------------|",
  "| REQ-API-001 | When a client sends POST /todos, the system shall create a to... | Acceptance test |",
  "| REQ-API-002 | The system shall persist todo items across restarts... | Acceptance test |",
  "| REQ-SEC-001 | If a request is unauthenticated, then the system shall reject... | Acceptance test |",
].join("\n");

const REAL_REQ_IDS = ["REQ-API-001", "REQ-API-002", "REQ-SEC-001"];
const FEATURE_DIR = ".specs/001-todo-api";

let workspace: string;
let fileManager: FileManager;
let testGenerator: TestGenerator;
let pbtGenerator: PbtGenerator;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "specky-testgen-quality-"));
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), SPEC_MD, "utf8");
  fileManager = new FileManager(workspace);
  testGenerator = new TestGenerator(fileManager);
  pbtGenerator = new PbtGenerator(fileManager);
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function pyCompile(content: string, name: string): { status: number | null; stderr: string } {
  const file = join(workspace, name);
  writeFileSync(file, content, "utf8");
  const res = spawnSync("python3", ["-m", "py_compile", file], { encoding: "utf8" });
  return { status: res.status, stderr: res.stderr ?? "" };
}

// ─── 1. pytest ───

describe("TestGenerator — pytest output is valid Python", () => {
  it("starts with a module docstring, not a JS comment header", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "pytest", "tests-pytest");
    expect(result.content.startsWith('"""')).toBe(true);
    expect(result.content).not.toContain("/**");
    expect(result.content).toContain("import pytest");
    expect(result.content).toMatch(/\n    def test_\w+\(self\):/);
  });

  it("uses an importable module filename (no hyphens)", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "pytest", "tests-pytest");
    const base = result.output_file.split("/").pop()!;
    expect(base.endsWith("_test.py")).toBe(true);
    expect(base).not.toContain("-");
  });

  it.skipIf(!havePython)("compiles under python3 -m py_compile", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "pytest", "tests-pytest");
    const { status, stderr } = pyCompile(result.content, "generated_pytest_test.py");
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });
});

// ─── 2. junit ───

describe("TestGenerator — junit output is javac-compatible", () => {
  it("filename matches the public class name exactly", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "junit", "tests-junit");
    const base = result.output_file.split("/").pop()!;
    const classMatch = result.content.match(/public class (\w+) \{/);
    expect(classMatch).not.toBeNull();
    expect(base).toBe(`${classMatch![1]}.java`);
    // PascalCase identifier — legal as both class name and filename.
    expect(classMatch![1]).toMatch(/^[A-Za-z]\w*$/);
    expect(base).toBe("TodoApiTest.java");
  });

  it("emits unique method names with @Test idioms", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "junit", "tests-junit");
    const methods = [...result.content.matchAll(/void (\w+)\(\)/g)].map((m) => m[1]);
    expect(methods.length).toBe(result.total_tests);
    expect(new Set(methods).size).toBe(methods.length);
    expect((result.content.match(/@Test/g) ?? []).length).toBe(result.total_tests);
    for (const method of methods) {
      expect(method).toMatch(/^[A-Za-z]\w*$/);
    }
  });
});

// ─── 3. xunit ───

describe("TestGenerator — xunit output has no duplicate members", () => {
  it("emits unique method names and keeps [Fact] idioms", async () => {
    const result = await testGenerator.generate(FEATURE_DIR, "xunit", "tests-xunit");
    const methods = [...result.content.matchAll(/public void (\w+)\(\)/g)].map((m) => m[1]);
    expect(methods.length).toBe(result.total_tests);
    expect(new Set(methods).size).toBe(methods.length);
    expect((result.content.match(/\[Fact\]/g) ?? []).length).toBe(result.total_tests);
    expect(result.content).toContain("using Xunit;");
    expect(result.content).toContain("Assert.True(true);");
  });
});

// ─── 4. markdown noise / REQ- prefix ───

describe("TestGenerator — acceptance-criteria parsing filters markdown noise", () => {
  it("extracts only the real criteria with their real requirement IDs", () => {
    const criteria = testGenerator.extractAcceptanceCriteria(SPEC_MD);
    expect(criteria).toEqual([
      { id: "REQ-API-001", criterion: "Given a valid payload, when POST /todos is called, then a todo is created" },
      { id: "REQ-API-001", criterion: "The response includes the created todo id" },
      { id: "REQ-API-002", criterion: "Verify todos survive a service restart" },
      { id: "REQ-SEC-001", criterion: "Ensure unauthenticated requests receive 401" },
      { id: "REQ-SEC-001", criterion: "Ensure unauthenticated requests receive 401" },
    ]);
  });

  it("never emits ToC links, label lines, table rows, or REQ-000 traces", async () => {
    const frameworks: TestFramework[] = ["vitest", "jest", "playwright", "pytest", "junit", "xunit"];
    for (const framework of frameworks) {
      const result = await testGenerator.generate(FEATURE_DIR, framework, `tests-${framework}`);
      expect(result.total_tests, framework).toBe(5);
      for (const stub of result.stubs) {
        expect(stub.requirement_id, framework).not.toBe("REQ-000");
        expect(REAL_REQ_IDS, framework).toContain(stub.requirement_id);
        expect(stub.description, framework).not.toMatch(/\]\(#/);
        expect(stub.description.toLowerCase(), framework).not.toMatch(/^\**acceptance criteria/);
        expect(stub.description, framework).not.toContain("| Acceptance test");
      }
    }
  });

  it("keeps the full REQ- prefix in generated test names", async () => {
    const vitest = await testGenerator.generate(FEATURE_DIR, "vitest", "tests");
    expect(vitest.content).toContain('it("REQ-API-001: Given a valid payload');
    expect(vitest.content).not.toContain('it("API-001');
    expect(vitest.content).toContain("// Traces to: REQ-SEC-001");

    const pytest = await testGenerator.generate(FEATURE_DIR, "pytest", "tests");
    expect(pytest.content).toMatch(/def test_req_api_001_\w+\(self\):/);

    const junit = await testGenerator.generate(FEATURE_DIR, "junit", "tests");
    expect(junit.content).toMatch(/void reqApi001\w*\(\)/);
  });
});

// ─── 5. fast-check PBT ───

describe("PbtGenerator — fast-check output is importable and self-contained", () => {
  it("imports the real default export, never the nonexistent named fc", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "fast-check", "pbt");
    expect(result.content).toContain('import fc from "fast-check";');
    expect(result.content).not.toContain('import { fc }');
    expect(result.content).toContain('import { describe, it, expect } from "vitest";');
  });

  it("defines every helper its property bodies call (no undefined placeholders)", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "fast-check", "pbt");
    const helpers = ["systemUnderTest", "transition", "serialize", "parse", "normalize", "combine", "scale", "handleUntrusted"];
    for (const helper of helpers) {
      if (new RegExp(`\\b${helper}\\(`).test(result.content)) {
        expect(result.content, `${helper} must be defined in-file`).toContain(`const ${helper} = `);
      }
    }
  });

  it("asserts something meaningful in every property (no TODO-only bodies)", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "fast-check", "pbt");
    expect(result.total_properties).toBeGreaterThan(0);
    const assertions = (result.content.match(/expect\(/g) ?? []).length;
    expect(assertions).toBeGreaterThanOrEqual(result.total_properties);
    expect(result.content).not.toMatch(/return true; \/\/ Replace/);
    expect((result.content.match(/fc\.assert\(/g) ?? []).length).toBe(result.total_properties);
  });

  it("traces every property to a REAL requirement ID from the spec", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "fast-check", "pbt");
    expect(result.total_properties).toBe(3);
    for (const prop of result.properties) {
      expect(REAL_REQ_IDS).toContain(prop.requirement_id);
      expect(prop.requirement_id).not.toMatch(/^REQ-GEN-/);
    }
    expect(result.content).toContain("[REQ-API-001]");
  });
});

// ─── 6. hypothesis PBT ───

describe("PbtGenerator — hypothesis output is runnable and traceable", () => {
  it("defines every helper its property bodies call (no undefined placeholders)", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "hypothesis", "pbt");
    const helpers = ["system_under_test", "transition", "serialize", "parse", "normalize", "combine", "scale", "handle_untrusted"];
    for (const helper of helpers) {
      if (new RegExp(`\\b${helper}\\(`).test(result.content)) {
        expect(result.content, `${helper} must be defined in-file`).toContain(`def ${helper}(`);
      }
    }
  });

  it("carries the real REQ IDs in metadata and docstrings", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "hypothesis", "pbt");
    expect(result.total_properties).toBe(3);
    for (const prop of result.properties) {
      expect(REAL_REQ_IDS).toContain(prop.requirement_id);
      expect(prop.requirement_id).not.toMatch(/^REQ-GEN-/);
    }
    expect(result.content).toContain("[REQ-API-001]");
    expect(result.content).toContain("[REQ-SEC-001]");
  });

  it.skipIf(!havePython)("compiles under python3 -m py_compile", async () => {
    const result = await pbtGenerator.generate(FEATURE_DIR, "hypothesis", "pbt");
    const { status, stderr } = pyCompile(result.content, "generated_hypothesis_pbt_test.py");
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });
});

// ─── 7. verify_tests coverage scanning ───

describe("collectTestFileContents — scans where sdd_generate_tests wrote", () => {
  it("finds generated tests via the manifest, outside the feature dir", async () => {
    const gen = await testGenerator.generate(FEATURE_DIR, "vitest", "generated-tests");
    const fileName = gen.output_file.split("/").pop()!;
    await fileManager.writeSpecFile("generated-tests", fileName, gen.content, true);
    await recordGeneratedTest(fileManager, FEATURE_DIR, "vitest", gen.output_file);

    const contents = await collectTestFileContents(fileManager, FEATURE_DIR);
    expect(Object.keys(contents)).toContain(`generated-tests/${fileName}`);
    expect(contents[`generated-tests/${fileName}`]).toContain("REQ-API-001");
  });

  it("scans the default tests/ directory even without a manifest", async () => {
    await fileManager.writeSpecFile("tests", "todo.test.ts", '// REQ-API-001\nit("REQ-API-001: works", () => {});\n', true);
    const contents = await collectTestFileContents(fileManager, FEATURE_DIR);
    expect(Object.keys(contents)).toContain("tests/todo.test.ts");
  });

  it("keeps the manifest hidden from the feature file listing", async () => {
    await recordGeneratedTest(fileManager, FEATURE_DIR, "vitest", "tests/x.test.ts");
    const files = await fileManager.listSpecFiles(FEATURE_DIR);
    expect(files).not.toContain(GENERATED_TESTS_MANIFEST);
  });
});

describe("TestTraceabilityMapper — coverage reflects generated tests", () => {
  const mapper = new TestTraceabilityMapper();

  it("no longer reports 0% when result names embed REQ IDs (audit repro)", () => {
    const report = mapper.buildCoverageReport(
      {},
      [
        { test_name: "REQ-API-001 | creates todo", passed: true },
        { test_name: "REQ-API-002 | persists todos", passed: true },
        { test_name: "REQ-SEC-001 | rejects unauthenticated", passed: false },
      ],
      REAL_REQ_IDS,
    );
    expect(report.overall_percent).toBe(67);
    expect(report.untested_requirements).toEqual([]);
    expect(report.failing_requirements).toEqual(["REQ-SEC-001"]);
  });

  it("maps generated vitest stubs end-to-end through the coverage report", async () => {
    const gen = await testGenerator.generate(FEATURE_DIR, "vitest", "generated-tests");
    const fileName = gen.output_file.split("/").pop()!;
    await fileManager.writeSpecFile("generated-tests", fileName, gen.content, true);
    await recordGeneratedTest(fileManager, FEATURE_DIR, "vitest", gen.output_file);

    const contents = await collectTestFileContents(fileManager, FEATURE_DIR);
    const titles = [...gen.content.matchAll(/it\("([^"]+)"/g)].map((m) => m[1]);
    const results = titles.map((t) => ({ test_name: t, passed: true }));

    const report = mapper.buildCoverageReport(contents, results, REAL_REQ_IDS);
    expect(report.overall_percent).toBe(100);
    expect(report.untested_requirements).toEqual([]);
  });

  it("maps pytest and junit test names via Traces-to comments", () => {
    const pytestFile = [
      "# Traces to: REQ-API-001",
      "def test_req_api_001_creates_todo(self):",
      "    assert True",
    ].join("\n");
    const junitFile = [
      "// Traces to: REQ-API-002",
      "@Test",
      "void reqApi002PersistsTodos() {",
      "}",
    ].join("\n");
    const report = mapper.buildCoverageReport(
      { "tests/a_test.py": pytestFile, "tests/BTest.java": junitFile },
      [
        { test_name: "test_req_api_001_creates_todo", passed: true },
        { test_name: "reqApi002PersistsTodos", passed: true },
      ],
      ["REQ-API-001", "REQ-API-002"],
    );
    expect(report.per_requirement["REQ-API-001"]!.status).toBe("passing");
    expect(report.per_requirement["REQ-API-002"]!.status).toBe("passing");
    expect(report.overall_percent).toBe(100);
  });
});

// ─── helpers ───

describe("pascalIdentifier", () => {
  it("produces javac-legal identifiers from arbitrary feature names", () => {
    expect(pascalIdentifier("todo-api-audit")).toBe("TodoApiAudit");
    expect(pascalIdentifier("2fa login")).toBe("Feature2faLogin");
    expect(pascalIdentifier("---")).toBe("Feature");
  });
});
