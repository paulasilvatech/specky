/**
 * safe-read.test.ts — tolerant reader for optional spec artifacts.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileManager } from "../../src/services/file-manager.js";
import { readSpecFileOrEmpty } from "../../src/utils/safe-read.js";

const FEATURE_DIR = ".specs/001-api";

const workspaces: string[] = [];

function setup(): { workspace: string; fileManager: FileManager } {
  const workspace = mkdtempSync(join(tmpdir(), "specky-safe-read-"));
  workspaces.push(workspace);
  return { workspace, fileManager: new FileManager(workspace) };
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("readSpecFileOrEmpty", () => {
  it("returns file content when the artifact exists", async () => {
    const { workspace, fileManager } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), "# Design");

    const content = await readSpecFileOrEmpty(fileManager, FEATURE_DIR, "DESIGN.md");

    expect(content).toBe("# Design");
  });

  it("returns an empty string when the artifact is missing", async () => {
    const { fileManager } = setup();

    const content = await readSpecFileOrEmpty(fileManager, FEATURE_DIR, "TASKS.md");

    expect(content).toBe("");
  });

  it("returns an empty string when the feature directory does not exist", async () => {
    const { fileManager } = setup();

    const content = await readSpecFileOrEmpty(fileManager, FEATURE_DIR, "CHECKLIST.md");

    expect(content).toBe("");
  });
});
