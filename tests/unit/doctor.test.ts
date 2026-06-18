import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDoctor } from "../../src/cli/commands/doctor.js";
import { runInit } from "../../src/cli/commands/init.js";

function makeWorkspace(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

describe("specky doctor IDE scope", () => {
  let workspaces: string[] = [];

  beforeEach(() => {
    workspaces = [];
  });

  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("validates only Copilot files for copilot-only installs", async () => {
    const workspace = makeWorkspace("specky-doctor-copilot-");
    workspaces.push(workspace);

    await expect(runInit({ ide: "copilot", force: false, dryRun: false, workspace })).resolves.toBe(0);
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);

    expect(existsSync(resolve(workspace, ".vscode/mcp.json"))).toBe(true);
    expect(existsSync(resolve(workspace, ".mcp.json"))).toBe(false);
  });

  it("validates only Claude files for claude-only installs", async () => {
    const workspace = makeWorkspace("specky-doctor-claude-");
    workspaces.push(workspace);

    await expect(runInit({ ide: "claude", force: false, dryRun: false, workspace })).resolves.toBe(0);
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);

    expect(existsSync(resolve(workspace, ".mcp.json"))).toBe(true);
    expect(existsSync(resolve(workspace, ".vscode/mcp.json"))).toBe(false);
  });
});
