import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

  it("supports prompt-only Claude permissions and opt-in GitHub MCP", async () => {
    const workspace = makeWorkspace("specky-doctor-claude-github-");
    workspaces.push(workspace);

    await expect(runInit({
      target: "claude",
      force: false,
      dryRun: false,
      permissionProfile: "prompt",
      integration: "github",
      workspace,
    })).resolves.toBe(0);
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);

    const mcp = JSON.parse(readFileSync(resolve(workspace, ".mcp.json"), "utf8")) as {
      mcpServers?: { github?: { type?: string; url?: string } };
    };
    expect(mcp.mcpServers?.github).toEqual({
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    });
  });

  it.each([
    ["copilot", ".vscode/mcp.json", "servers"],
    ["claude", ".mcp.json", "mcpServers"],
    ["cursor", ".cursor/mcp.json", "mcpServers"],
    ["opencode", "opencode.json", "mcp"],
  ])("registers GitHub MCP for the %s target", async (target, configPath, section) => {
    const workspace = makeWorkspace(`specky-doctor-${target}-github-`);
    workspaces.push(workspace);

    await expect(runInit({
      target,
      force: false,
      dryRun: false,
      integration: "github",
      workspace,
    })).resolves.toBe(0);
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);

    const config = JSON.parse(readFileSync(resolve(workspace, configPath), "utf8")) as Record<
      string,
      Record<string, { github?: { type?: string; url?: string } }>
    >;
    expect(config[section]?.github).toEqual({
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    });
  });

  it.each([
    ["cursor", ".cursor/mcp.json"],
    ["opencode", "opencode.json"],
    ["agent-skills", ".agents/skills/specky-onboarding/SKILL.md"],
  ])("validates %s target installs", async (target, expectedPath) => {
    const workspace = makeWorkspace(`specky-doctor-${target}-`);
    workspaces.push(workspace);

    await expect(runInit({ target, force: false, dryRun: false, workspace })).resolves.toBe(0);
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);

    expect(existsSync(resolve(workspace, expectedPath))).toBe(true);
    expect(existsSync(resolve(workspace, ".vscode/mcp.json"))).toBe(false);
    expect(existsSync(resolve(workspace, ".mcp.json"))).toBe(false);
  });
});
