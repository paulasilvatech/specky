import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../src/cli/commands/init.js";

const REPO = resolve(import.meta.dirname, "../..");

interface HookGroup {
    matcher?: string;
    hooks?: { command?: string }[];
}

function readCopilotManifest(): Record<string, HookGroup[]> {
    return JSON.parse(
        readFileSync(resolve(REPO, "dist/copilot-hooks.json"), "utf8"),
    ) as Record<string, HookGroup[]>;
}

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

describe("copilot target hook manifest", () => {
    it("generates dist/copilot-hooks.json", () => {
        expect(existsSync(resolve(REPO, "dist/copilot-hooks.json"))).toBe(true);
    });

    it("strips lifecycle events Copilot cannot run", () => {
        const manifest = readCopilotManifest();
        expect(manifest.SessionStart).toBeUndefined();
        expect(manifest.UserPromptSubmit).toBeUndefined();
    });

    it("uses unprefixed sdd_ matchers and Copilot script paths", () => {
        const manifest = readCopilotManifest();
        const groups = Object.values(manifest).flat();
        const commands = groups.flatMap((g) => (g.hooks ?? []).map((h) => h.command ?? ""));
        expect(commands.length).toBeGreaterThan(0);
        expect(commands.every((c) => c.includes(".github/hooks/specky/scripts/"))).toBe(true);
        // Copilot matchers must NOT be MCP-prefixed
        const matchers = groups.map((g) => g.matcher ?? "");
        expect(matchers.some((m) => m.includes("sdd_write_spec"))).toBe(true);
        expect(matchers.every((m) => !m.includes("mcp__specky__"))).toBe(true);
    });
});

describe("copilot target install", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(resolve(tmpdir(), "specky-copilot-"));
    });

    afterEach(() => {
        rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("installs full Copilot primitive set with no cross-target leakage", async () => {
        await expect(runInit({ target: "copilot", force: true, dryRun: false, workspace })).resolves.toBe(0);

        expect(countFiles(resolve(workspace, ".github/agents"), (n) => n.startsWith("specky-") && n.endsWith(".md"))).toBe(13);
        expect(countFiles(resolve(workspace, ".github/prompts"), (n) => n.startsWith("specky-") && n.endsWith(".md"))).toBe(22);
        expect(countDirs(resolve(workspace, ".github/skills"), "specky-")).toBe(14);
        expect(countFiles(resolve(workspace, ".github/hooks/specky/scripts"), (n) => n.endsWith(".sh") || n.endsWith(".mjs"))).toBe(17);
        expect(existsSync(resolve(workspace, ".github/hooks/specky/scripts/specky-contract-context.bash"))).toBe(true);

        // Only the Copilot instruction is installed
        const instructionDir = resolve(workspace, ".github/instructions");
        expect(existsSync(resolve(instructionDir, "copilot-instructions.instructions.md"))).toBe(true);
        expect(existsSync(resolve(instructionDir, "cursor-instructions.instructions.md"))).toBe(false);
        expect(existsSync(resolve(instructionDir, "claude-instructions.instructions.md"))).toBe(false);

        const instruction = readFileSync(resolve(instructionDir, "copilot-instructions.instructions.md"), "utf8");
        expect(instruction).toContain("applyTo:");
        // Content bug fixes: no outdated @workspace invocation, no orphaned rule headings
        expect(instruction).not.toContain("@workspace /prompt-name");
        expect(instruction).not.toContain("## Rule #7");
        expect(instruction).not.toContain("## Rule #8");
    });
});
