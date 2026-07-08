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

function readClaudeManifest(): Record<string, HookGroup[]> {
    return JSON.parse(
        readFileSync(resolve(REPO, "dist/claude-hooks.json"), "utf8"),
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

describe("claude target hook manifest", () => {
    it("generates dist/claude-hooks.json", () => {
        expect(existsSync(resolve(REPO, "dist/claude-hooks.json"))).toBe(true);
    });

    it("prefixes MCP matchers and keeps native tools unprefixed", () => {
        const manifest = readClaudeManifest();
        const groups = Object.values(manifest).flat();
        const matchers = groups.map((g) => g.matcher ?? "");
        expect(matchers.some((m) => m.includes("mcp__specky__sdd_write_spec"))).toBe(true);
        // Native write tools must remain unprefixed
        const nativeWrite = matchers.find((m) => /^(Write|Edit|MultiEdit)/.test(m));
        if (nativeWrite) {
            expect(nativeWrite).not.toContain("mcp__specky__");
        }
        const commands = groups.flatMap((g) => (g.hooks ?? []).map((h) => h.command ?? ""));
        expect(commands.every((c) => c.includes(".claude/hooks/scripts/"))).toBe(true);
    });
});

describe("claude target install", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(resolve(tmpdir(), "specky-claude-"));
    });

    afterEach(() => {
        rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("installs full Claude primitive set with a neutral rule and no Copilot leakage", async () => {
        await expect(runInit({ target: "claude", force: true, dryRun: false, workspace })).resolves.toBe(0);

        expect(countFiles(resolve(workspace, ".claude/agents"), (n) => n.startsWith("specky-") && n.endsWith(".md"))).toBe(13);
        expect(countFiles(resolve(workspace, ".claude/commands"), (n) => n.startsWith("specky-") && n.endsWith(".md"))).toBe(22);
        expect(countDirs(resolve(workspace, ".claude/skills"), "specky-")).toBe(14);
        expect(countFiles(resolve(workspace, ".claude/hooks/scripts"), (n) => n.endsWith(".sh") || n.endsWith(".mjs"))).toBe(16);

        // Dedicated neutral rule — not the Copilot-named one
        expect(existsSync(resolve(workspace, ".claude/rules/specky-sdd.md"))).toBe(true);
        expect(existsSync(resolve(workspace, ".claude/rules/copilot-instructions.md"))).toBe(false);

        const rule = readFileSync(resolve(workspace, ".claude/rules/specky-sdd.md"), "utf8");
        expect(rule).toContain("paths: ['**']");
        expect(rule).not.toContain("applyTo:");
        expect(rule).not.toContain("@workspace");
        expect(rule).not.toContain("Copilot Instructions");
        expect(rule).toContain(".mcp.json");

        // Hooks + permissions registered in settings.json
        const settings = JSON.parse(
            readFileSync(resolve(workspace, ".claude/settings.json"), "utf8"),
        ) as { hooks?: unknown; permissions?: { allow?: string[] } };
        expect(settings.hooks).toBeDefined();
        expect(settings.permissions?.allow?.length ?? 0).toBeGreaterThan(0);
    });
});
