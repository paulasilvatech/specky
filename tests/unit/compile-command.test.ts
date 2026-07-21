import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCompile } from "../../src/cli/commands/compile.js";

describe("specky compile", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-compile-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it.each([
    ["copilot", ".github/copilot-instructions.md"],
    ["claude", "CLAUDE.md"],
    ["cursor", "AGENTS.md"],
    ["opencode", "AGENTS.md"],
  ])("writes %s root instructions", async (target, outputPath) => {
    await expect(runCompile({ target, dryRun: false, workspace })).resolves.toBe(0);

    const path = resolve(workspace, outputPath);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("# Specky SDD");
  });

  it("treats agent-skills as a compile no-op", async () => {
    await expect(runCompile({ target: "agent-skills", dryRun: false, workspace })).resolves.toBe(0);

    expect(existsSync(resolve(workspace, "AGENTS.md"))).toBe(false);
  });
});
