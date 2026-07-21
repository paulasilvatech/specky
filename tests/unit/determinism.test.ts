import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DocumentationConfig } from "../../src/contracts/use-case.js";
import { DocGenerator } from "../../src/services/doc-generator.js";
import { FileManager } from "../../src/services/file-manager.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { TestGenerator } from "../../src/services/test-generator.js";
import {
  currentDateString,
  currentTimestamp,
  formatTimestampForDisplay,
} from "../../src/utils/runtime-context.js";

const DOCUMENTATION: DocumentationConfig = {
  types: ["full"],
  version: "1.0.0",
  deployment_steps: ["Deploy the reviewed artifact."],
  health_checks: ["Verify the health contract."],
  monitoring_checks: ["Verify the monitoring contract."],
  troubleshooting: [{ symptom: "Failure", cause: "Known cause", resolution: "Known resolution" }],
  rollback_steps: ["Restore the reviewed artifact."],
  support_contacts: ["team@example.test"],
  onboarding_steps: ["Read the feature contract."],
};

describe("deterministic runtime context", () => {
  const fixedNow = "2026-06-17T12:34:56.000Z";
  let previousFixedNow: string | undefined;
  let workspace: string;
  let fileManager: FileManager;

  beforeEach(() => {
    previousFixedNow = process.env["SDD_FIXED_NOW"];
    process.env["SDD_FIXED_NOW"] = fixedNow;
    workspace = mkdtempSync(join(tmpdir(), "specky-determinism-"));
    fileManager = new FileManager(workspace);
  });

  afterEach(() => {
    if (previousFixedNow === undefined) {
      delete process.env["SDD_FIXED_NOW"];
    } else {
      process.env["SDD_FIXED_NOW"] = previousFixedNow;
    }
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("uses the fixed timestamp for runtime date helpers", () => {
    expect(currentTimestamp()).toBe(fixedNow);
    expect(currentDateString()).toBe("2026-06-17");
    expect(formatTimestampForDisplay()).toBe("6/17/26, 12:34:56 PM");
  });

  it("uses the fixed date in template frontmatter", () => {
    const templateEngine = new TemplateEngine(fileManager);

    const frontmatter = templateEngine.generateFrontmatter({
      title: "Stable",
      feature_id: "001-stable",
      version: "1.0.0",
      date: currentDateString(),
      author: "determinism-test",
      status: "Draft",
    });

    expect(frontmatter).toContain('date: "2026-06-17"');
  });

  it("generates stable documentation timestamps", async () => {
    const featureDir = "001-stable-docs";
    mkdirSync(join(workspace, featureDir), { recursive: true });
    writeFileSync(
      join(workspace, featureDir, "SPECIFICATION.md"),
      [
        "### REQ-CORE-001: Stable behavior",
        "",
        "The system shall keep documentation stable.",
        "",
        "**Acceptance Criteria:**",
        "- Repeated generation is byte-identical",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(workspace, featureDir, "DESIGN.md"),
      [
        "## System Context",
        "Stable user context.",
        "## Container Architecture",
        "Stable container context.",
        "## Component Design",
        "Stable component context.",
        "## Data Model",
        "Stable data context.",
        "## Infrastructure",
        "Stable infrastructure context.",
      ].join("\n\n"),
      "utf8",
    );
    writeFileSync(
      join(workspace, featureDir, "TASKS.md"),
      "| T-001 | Generate docs | No | S | — | REQ-CORE-001 |\n",
      "utf8",
    );
    writeFileSync(join(workspace, featureDir, "ANALYSIS.md"), "Decision: APPROVE\n", "utf8");
    const docGenerator = new DocGenerator(fileManager);

    const first = await docGenerator.generateFullDocs(featureDir, "001", DOCUMENTATION);
    const second = await docGenerator.generateFullDocs(featureDir, "001", DOCUMENTATION);

    expect(first.content).toBe(second.content);
    expect(first.content).toContain(`**Generated**: ${fixedNow}`);
  });

  it("generates stable test stub dates", async () => {
    const featureDir = ".specs/001-stable-tests";
    mkdirSync(join(workspace, featureDir), { recursive: true });
    writeFileSync(
      join(workspace, featureDir, "SPECIFICATION.md"),
      [
        "### REQ-CORE-001: Stable behavior",
        "",
        "The system shall keep generated dates stable.",
        "",
        "**Acceptance Criteria:**",
        "- Ensure deterministic output",
        "",
      ].join("\n"),
      "utf8",
    );
    const testGenerator = new TestGenerator(fileManager);
    const imports = 'import { describe, it, expect } from "vitest";';
    const bindings = [
      {
        requirement_id: "REQ-CORE-001",
        test_name: "keeps generated dates stable",
        body: 'const generated = "2026-06-17";\nexpect(generated).toBe("2026-06-17");',
      },
    ];

    const first = await testGenerator.generate(featureDir, "vitest", "tests", imports, bindings);
    const second = await testGenerator.generate(featureDir, "vitest", "tests", imports, bindings);

    expect(first.content).toBe(second.content);
    expect(first.content).toContain("Generated: 2026-06-17");
  });
});
