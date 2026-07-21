/**
 * design-completeness.test.ts — the DESIGN.md section-heading heuristic:
 * scoring, found/missing section lists, and keyword matching.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateDesignCompleteness } from "../../src/services/design-completeness.js";
import { FileManager } from "../../src/services/file-manager.js";

const FEATURE_DIR = ".specs/001-api";

const ALL_SECTIONS = [
  "System Context",
  "Container",
  "Component",
  "Data Model",
  "API Contract",
  "Infrastructure",
  "Security",
  "Architecture Decision",
  "Error Handling",
  "Diagrams",
  "Cross-Cutting",
  "Code-Level",
];

const FULL_DESIGN = [
  "## System Context",
  "Actors and external systems.",
  "## Container Architecture",
  "An API container and a worker container.",
  "## Component Design",
  "Components own behavior.",
  "## Data Model",
  "Entities and relations.",
  "## API Contract",
  "Endpoints and schemas.",
  "## Infrastructure & Deployment",
  "Containers on a cluster.",
  "## Security",
  "Authentication and authorization.",
  "## Architecture Decisions",
  "ADR-001 recorded.",
  "## Error Handling",
  "Errors map to problem details.",
  "## Diagrams",
  "System diagrams.",
  "## Cross-Cutting Concerns",
  "Logging and monitoring.",
  "## Code-Level Design",
  "Classes and interfaces.",
].join("\n");

const workspaces: string[] = [];

function setup(): { workspace: string; fileManager: FileManager } {
  const workspace = mkdtempSync(join(tmpdir(), "specky-design-completeness-"));
  workspaces.push(workspace);
  return { workspace, fileManager: new FileManager(workspace) };
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("validateDesignCompleteness", () => {
  it("scores 0 with every section missing when DESIGN.md does not exist", async () => {
    const { fileManager } = setup();

    const result = await validateDesignCompleteness(fileManager, FEATURE_DIR);

    expect(result).toEqual({
      score: 0,
      total_sections: 12,
      found_sections: [],
      missing_sections: ALL_SECTIONS,
    });
  });

  it("scores 100 when all twelve sections are present", async () => {
    const { workspace, fileManager } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), FULL_DESIGN);

    const result = await validateDesignCompleteness(fileManager, FEATURE_DIR);

    expect(result.score).toBe(100);
    expect(result.total_sections).toBe(12);
    expect(result.found_sections).toEqual(ALL_SECTIONS);
    expect(result.missing_sections).toEqual([]);
  });

  it("reports a single found section with the rounded score", async () => {
    const { workspace, fileManager } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(
      join(workspace, FEATURE_DIR, "DESIGN.md"),
      "## System Context\n\nActors interact with the platform.\n",
    );

    const result = await validateDesignCompleteness(fileManager, FEATURE_DIR);

    expect(result.score).toBe(8); // round(1/12 * 100)
    expect(result.found_sections).toEqual(["System Context"]);
    expect(result.missing_sections).toEqual(ALL_SECTIONS.filter((s) => s !== "System Context"));
  });

  it("matches alternative keywords case-insensitively", async () => {
    const { workspace, fileManager } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(
      join(workspace, FEATURE_DIR, "DESIGN.md"),
      "C4 LEVEL 1 overview.\n\nThe endpoint returns an entity.\n\nDeployment uses structured logging.\n",
    );

    const result = await validateDesignCompleteness(fileManager, FEATURE_DIR);

    expect(result.found_sections).toEqual([
      "System Context",
      "Data Model",
      "API Contract",
      "Infrastructure",
      "Cross-Cutting",
    ]);
    expect(result.missing_sections).toEqual([
      "Container",
      "Component",
      "Security",
      "Architecture Decision",
      "Error Handling",
      "Diagrams",
      "Code-Level",
    ]);
    expect(result.score).toBe(42); // round(5/12 * 100)
  });
});
