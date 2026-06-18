import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FeaturePackageGenerator, SPECKY_SCAFFOLD_MARKER } from "../../src/services/feature-package-generator.js";
import { FileManager } from "../../src/services/file-manager.js";

describe("FeaturePackageGenerator", () => {
  let workspace: string;
  let fileManager: FileManager;
  let generator: FeaturePackageGenerator;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-feature-package-"));
    fileManager = new FileManager(workspace);
    generator = new FeaturePackageGenerator(fileManager);
    process.env["SDD_FIXED_NOW"] = "2026-06-17T12:00:00.000Z";
  });

  afterEach(() => {
    delete process.env["SDD_FIXED_NOW"];
    rmSync(workspace, { recursive: true, force: true });
  });

  it("creates the complete companion package for a specification", async () => {
    const featureDir = ".specs/001-complete-package";
    mkdirSync(join(workspace, featureDir), { recursive: true });
    const specContent = [
      "# Specification",
      "",
      "### REQ-CORE-001: Complete package",
      "",
      "The system shall create all companion artifacts.",
      "",
    ].join("\n");
    writeFileSync(join(workspace, featureDir, "SPECIFICATION.md"), specContent, "utf8");

    const result = await generator.ensureFeaturePackage({
      featureDir,
      featureNumber: "001",
      featureName: "complete-package",
      specContent,
      sourceTool: "test",
    });

    expect(result.created).toEqual([
      "README.md",
      "DESIGN.md",
      "TASKS.md",
      "ADR.md",
      "PLAYBOOK.md",
      "DIAGRAMS.md",
      "TDD_STATUS.md",
      "EVIDENCE.md",
      "SPEC_PACKAGE.json",
    ]);

    expect(await fileManager.readSpecFile(featureDir, "DESIGN.md")).toContain(SPECKY_SCAFFOLD_MARKER);
    expect(await fileManager.readSpecFile(featureDir, "TASKS.md")).toContain(SPECKY_SCAFFOLD_MARKER);
    expect(await fileManager.readSpecFile(featureDir, "TDD_STATUS.md")).toContain("REQ-CORE-001");
    expect(JSON.parse(await fileManager.readSpecFile(featureDir, "SPEC_PACKAGE.json"))).toMatchObject({
      feature_number: "001",
      feature_name: "complete-package",
      source_tool: "test",
      requirements: ["REQ-CORE-001"],
    });
  });

  it("does not overwrite existing companion artifacts", async () => {
    const featureDir = ".specs/001-existing-package";
    mkdirSync(join(workspace, featureDir), { recursive: true });
    writeFileSync(join(workspace, featureDir, "ADR.md"), "# Existing ADR\n", "utf8");

    const result = await generator.ensureFeaturePackage({
      featureDir,
      featureNumber: "001",
      featureName: "existing-package",
      specContent: "### REQ-CORE-001\n\nThe system shall preserve ADRs.",
      sourceTool: "test",
    });

    expect(result.existing).toContain("ADR.md");
    expect(await fileManager.readSpecFile(featureDir, "ADR.md")).toBe("# Existing ADR\n");
  });
});
