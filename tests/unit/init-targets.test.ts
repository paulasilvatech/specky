import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../src/cli/commands/init.js";

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("specky install target selection", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(resolve(tmpdir(), "specky-init-targets-"));
    });

    afterEach(() => {
        rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("installs Cursor assets and MCP config with --target=cursor", async () => {
        await expect(runInit({ target: "cursor", force: true, dryRun: false, workspace })).resolves.toBe(0);

        expect(existsSync(resolve(workspace, ".cursor/agents/specky-orchestrator.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".cursor/commands/specky-orchestrate.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".cursor/rules/copilot-instructions.mdc"))).toBe(true);
        expect(existsSync(resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"))).toBe(true);

        const mcp = readJson<{ mcpServers?: Record<string, unknown> }>(
            resolve(workspace, ".cursor/mcp.json"),
        );
        expect(mcp.mcpServers?.specky).toBeDefined();

        const meta = readJson<{ targets?: string[] }>(resolve(workspace, ".specky/install.json"));
        expect(meta.targets).toEqual(["cursor"]);
    });

    it("installs OpenCode assets and MCP config with --target=opencode", async () => {
        await expect(runInit({ target: "opencode", force: true, dryRun: false, workspace })).resolves.toBe(0);

        expect(existsSync(resolve(workspace, ".opencode/agents/specky-orchestrator.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".opencode/commands/specky-orchestrate.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"))).toBe(true);

        const mcp = readJson<{ mcp?: Record<string, unknown> }>(resolve(workspace, "opencode.json"));
        expect(mcp.mcp?.specky).toBeDefined();
    });

    it("installs only shared skills with --target=agent-skills", async () => {
        await expect(runInit({ target: "agent-skills", force: true, dryRun: false, workspace })).resolves.toBe(0);

        expect(existsSync(resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".github/agents/specky-orchestrator.agent.md"))).toBe(false);
        expect(existsSync(resolve(workspace, ".claude/agents/specky-orchestrator.md"))).toBe(false);
        expect(existsSync(resolve(workspace, ".cursor/agents/specky-orchestrator.md"))).toBe(false);
        expect(existsSync(resolve(workspace, "opencode.json"))).toBe(false);
    });

    it("strips Claude hooks whenever Copilot is installed in the same workspace", async () => {
        await expect(runInit({ target: "both", force: true, dryRun: false, workspace })).resolves.toBe(0);

        const settings = readJson<{ hooks?: unknown; permissions?: unknown }>(
            resolve(workspace, ".claude/settings.json"),
        );
        expect(settings.hooks).toBeUndefined();
        expect(settings.permissions).toBeDefined();
    });

    it("removes pre-existing Claude hooks from .claude/settings.json when Copilot is added to the same workspace", async () => {
        // Simulate a workspace that already has a Claude Code config with the
        // user's own hooks, permissions and unrelated settings.
        const claudeDir = resolve(workspace, ".claude");
        mkdirSync(claudeDir, { recursive: true });
        const settingsPath = resolve(claudeDir, "settings.json");
        writeFileSync(
            settingsPath,
            JSON.stringify(
                {
                    hooks: {
                        SessionStart: [
                            { matcher: "", hooks: [{ type: "command", command: "echo user-owned-hook" }] },
                        ],
                    },
                    permissions: { allow: ["Read(*)"] },
                    env: { USER_SETTING: "keep-me" },
                },
                null,
                2,
            ) + "\n",
            "utf8",
        );

        await expect(runInit({ target: "both", force: true, dryRun: false, workspace })).resolves.toBe(0);

        const settings = readJson<{
            hooks?: unknown;
            permissions?: { allow?: string[] };
            env?: Record<string, string>;
        }>(settingsPath);

        // Hooks (including the user's pre-existing ones) must be gone.
        expect(settings.hooks).toBeUndefined();
        // Non-hook user configuration must be preserved.
        expect(settings.env?.USER_SETTING).toBe("keep-me");
        expect(settings.permissions?.allow).toContain("Read(*)");
    });
});