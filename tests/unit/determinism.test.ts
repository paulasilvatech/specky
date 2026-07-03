import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocGenerator } from "../../src/services/doc-generator.js";
import { FileManager } from "../../src/services/file-manager.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { TestGenerator } from "../../src/services/test-generator.js";
import { currentDateString, currentTimestamp, formatTimestampForDisplay } from "../../src/utils/runtime-context.js";

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

    const frontmatter = templateEngine.generateFrontmatter({ title: "Stable" });

    expect(frontmatter).toContain('date: "2026-06-17"');
  });

  it("generates stable documentation timestamps", async () => {
    const featureDir = "001-stable-docs";
    mkdirSync(join(workspace, featureDir), { recursive: true });
    writeFileSync(join(workspace, featureDir, "SPECIFICATION.md"), "# Spec\n\nThe system shall be stable.", "utf8");
    const docGenerator = new DocGenerator(fileManager);

    const first = await docGenerator.generateFullDocs(featureDir, "001");
    const second = await docGenerator.generateFullDocs(featureDir, "001");

    expect(first.content).toBe(second.content);
    expect(first.content).toContain(`**Generated**: ${fixedNow}`);
  });

  it("generates stable test stub dates", async () => {
    const featureDir = "001-stable-tests";
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

    const first = await testGenerator.generate(featureDir, "vitest", "tests");
    const second = await testGenerator.generate(featureDir, "vitest", "tests");

    expect(first.content).toBe(second.content);
    expect(first.content).toContain("Generated: 2026-06-17");
  });
});
