import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../src/cli/commands/init.js";

function countDirs(dir: string, prefix: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(
    (name) => name.startsWith(prefix) && statSync(resolve(dir, name)).isDirectory(),
  ).length;
}

function countFiles(dir: string, predicate: (name: string) => boolean): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(predicate).length;
}

describe("opencode target install", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-opencode-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("installs full OpenCode primitive set with no cross-target leakage", async () => {
    await expect(
      runInit({ target: "opencode", force: true, dryRun: false, workspace }),
    ).resolves.toBe(0);

    expect(
      countFiles(
        resolve(workspace, ".opencode/agents"),
        (n) => n.startsWith("specky-") && n.endsWith(".md"),
      ),
    ).toBe(13);
    expect(
      countFiles(
        resolve(workspace, ".opencode/commands"),
        (n) => n.startsWith("specky-") && n.endsWith(".md"),
      ),
    ).toBe(22);
    // OpenCode shares the canonical skills path with Cursor
    expect(countDirs(resolve(workspace, ".agents/skills"), "specky-")).toBe(14);

    // MCP registered under the opencode.json `mcp` key
    const mcp = JSON.parse(readFileSync(resolve(workspace, "opencode.json"), "utf8")) as {
      mcp?: Record<string, unknown>;
    };
    expect(mcp.mcp?.specky).toBeDefined();

    // OpenCode has no hook or rule destinations
    expect(existsSync(resolve(workspace, ".opencode/hooks"))).toBe(false);
    expect(existsSync(resolve(workspace, ".opencode/rules"))).toBe(false);
  });

  it("emits native OpenCode tool tokens without cross-target leakage", async () => {
    await expect(
      runInit({ target: "opencode", force: true, dryRun: false, workspace }),
    ).resolves.toBe(0);

    const agent = readFileSync(
      resolve(workspace, ".opencode/agents/specky-orchestrator.md"),
      "utf8",
    );
    // OpenCode uses the `server/tool` native MCP format, not the mcp__specky__ prefix
    expect(agent).toContain("specky/sdd_get_status");
    expect(agent).not.toContain("mcp__specky__");
    // Copilot leak needles must never appear
    expect(agent).not.toContain("@workspace");
    expect(agent).not.toContain("applyTo:");
  });
});
