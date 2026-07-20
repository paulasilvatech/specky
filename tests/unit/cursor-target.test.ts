import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../src/cli/commands/init.js";

const REPO = resolve(import.meta.dirname, "../..");

interface CursorHookEntry {
  command?: string;
  failClosed?: boolean;
  matcher?: string;
}

interface CursorHooksManifest {
  version: number;
  hooks: Record<string, CursorHookEntry[]>;
}

function readCursorManifest(): CursorHooksManifest {
  return JSON.parse(
    readFileSync(resolve(REPO, "dist/cursor-hooks.json"), "utf8"),
  ) as CursorHooksManifest;
}

describe("cursor target hook manifest", () => {
  it("generates dist/cursor-hooks.json", () => {
    expect(existsSync(resolve(REPO, "dist/cursor-hooks.json"))).toBe(true);
  });

  it("uses Cursor schema version 1 with MCP lifecycle buckets", () => {
    const manifest = readCursorManifest();
    expect(manifest.version).toBe(1);
    expect(manifest.hooks.beforeMCPExecution.length).toBeGreaterThan(0);
    expect(manifest.hooks.afterMCPExecution.length).toBeGreaterThan(0);
    expect(manifest.hooks.preToolUse.length).toBeGreaterThan(0);
    expect(manifest.hooks.postToolUse.length).toBeGreaterThan(0);
  });

  it("marks every blocking hook failClosed", () => {
    const manifest = readCursorManifest();
    const entries = Object.values(manifest.hooks).flat();
    const blocking = entries.filter((entry) => entry.command?.includes("--blocking"));
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((entry) => entry.failClosed === true)).toBe(true);
  });

  it("uses the Cursor adapter instead of direct Claude or Copilot script paths", () => {
    const manifest = readCursorManifest();
    const entries = Object.values(manifest.hooks).flat();
    expect(entries.every((entry) => entry.command?.startsWith(".cursor/hooks/specky-run.sh"))).toBe(
      true,
    );
    expect(entries.some((entry) => entry.matcher?.includes("mcp__specky__sdd_write_spec"))).toBe(
      true,
    );
  });
});

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

describe("cursor target install", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-cursor-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("installs full Cursor primitive set with no cross-target leakage", async () => {
    await expect(
      runInit({ target: "cursor", force: true, dryRun: false, workspace }),
    ).resolves.toBe(0);

    expect(
      countFiles(
        resolve(workspace, ".cursor/agents"),
        (n) => n.startsWith("specky-") && n.endsWith(".md"),
      ),
    ).toBe(13);
    expect(
      countFiles(
        resolve(workspace, ".cursor/commands"),
        (n) => n.startsWith("specky-") && n.endsWith(".md"),
      ),
    ).toBe(22);
    expect(countDirs(resolve(workspace, ".agents/skills"), "specky-")).toBe(14);
    expect(
      countFiles(
        resolve(workspace, ".cursor/hooks/scripts"),
        (n) => n.endsWith(".sh") || n.endsWith(".mjs"),
      ),
    ).toBe(17);
    expect(
      existsSync(resolve(workspace, ".cursor/hooks/scripts/specky-contract-context.bash")),
    ).toBe(true);

    const rule = readFileSync(resolve(workspace, ".cursor/rules/specky-sdd.mdc"), "utf8");
    expect(rule).toContain("alwaysApply: true");
    expect(rule).toContain("Specky SDD");
    expect(rule).not.toContain("@workspace");

    expect(
      existsSync(resolve(workspace, ".github/instructions/copilot-instructions.instructions.md")),
    ).toBe(false);
    expect(existsSync(resolve(workspace, ".cursor/mcp.json"))).toBe(true);
  });
});
