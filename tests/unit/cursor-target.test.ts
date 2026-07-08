import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
        expect(entries.every((entry) => entry.command?.startsWith(".cursor/hooks/specky-run.sh"))).toBe(true);
        expect(entries.some((entry) => entry.matcher?.includes("mcp__specky__sdd_write_spec"))).toBe(true);
    });
});
