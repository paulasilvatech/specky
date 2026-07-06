import { describe, expect, it } from "vitest";
import {
    logicalToNative,
    mapTool,
    normalizeToLogical,
} from "../../src/cli/lib/harness/tool-map.js";
import { getCompiler, SUPPORTED_TARGETS } from "../../src/cli/lib/harness/index.js";

describe("harness tool-map", () => {
    it("normalizes native and source tokens to logical ids", () => {
        expect(normalizeToLogical("search")).toBe("workspace.search");
        expect(normalizeToLogical("Read")).toBe("workspace.search");
        expect(normalizeToLogical("Grep")).toBe("workspace.search");
        expect(normalizeToLogical("edit")).toBe("workspace.edit");
        expect(normalizeToLogical("Write")).toBe("workspace.edit");
        expect(normalizeToLogical("agent")).toBe("agent.delegate");
        expect(normalizeToLogical("Task")).toBe("agent.delegate");
        expect(normalizeToLogical("specky/sdd_get_status")).toBe(
            "mcp.specky.sdd_get_status",
        );
        expect(normalizeToLogical("mcp__specky__sdd_get_status")).toBe(
            "mcp.specky.sdd_get_status",
        );
        expect(normalizeToLogical("sdd_get_status")).toBe(
            "mcp.specky.sdd_get_status",
        );
        expect(normalizeToLogical("something_custom")).toBe("raw:something_custom");
    });

    it("renders logical ids into Copilot-native tokens", () => {
        expect(logicalToNative("workspace.search", "copilot")).toEqual(["search"]);
        expect(logicalToNative("agent.delegate", "copilot")).toEqual(["agent"]);
        expect(logicalToNative("mcp.specky.sdd_get_status", "copilot")).toEqual([
            "specky/sdd_get_status",
        ]);
    });

    it("renders logical ids into Claude-native tokens", () => {
        expect(logicalToNative("workspace.search", "claude")).toEqual([
            "Read",
            "Glob",
            "Grep",
        ]);
        expect(logicalToNative("agent.delegate", "claude")).toEqual(["Task"]);
        expect(logicalToNative("mcp.specky.sdd_get_status", "claude")).toEqual([
            "mcp__specky__sdd_get_status",
        ]);
    });

    it("passes unknown tokens through unchanged", () => {
        expect(mapTool("something_custom", "copilot")).toEqual(["something_custom"]);
        expect(mapTool("something_custom", "claude")).toEqual(["something_custom"]);
    });
});

describe("harness compiler registry", () => {
    it("exposes copilot and claude compilers", () => {
        expect(SUPPORTED_TARGETS).toContain("copilot");
        expect(SUPPORTED_TARGETS).toContain("claude");
        expect(getCompiler("copilot").target).toBe("copilot");
        expect(getCompiler("claude").target).toBe("claude");
    });

    it("compiles an agent tools line per harness", () => {
        const source = 'tools: ["search", "agent", "specky/sdd_get_status"]\n';
        expect(getCompiler("copilot").compileAgent(source)).toBe(
            'tools: ["search","agent","specky/sdd_get_status"]\n',
        );
        expect(getCompiler("claude").compileAgent(source)).toBe(
            "tools: Read, Glob, Grep, Task, mcp__specky__sdd_get_status\n",
        );
    });

    it("compiles prompt frontmatter per harness", () => {
        const prompt = "---\ndescription: Run\nagent: agent\n---\nBody\n";
        expect(getCompiler("copilot").compilePrompt(prompt)).toContain("agent: agent");
        expect(getCompiler("claude").compilePrompt(prompt)).not.toContain(
            "agent: agent",
        );
    });

    it("compiles Claude rules to paths frontmatter", () => {
        const instruction = "---\napplyTo: '**'\n---\nRules\n";
        expect(getCompiler("claude").compileInstruction(instruction)).toContain(
            "paths: ['**']",
        );
        expect(getCompiler("copilot").compileInstruction(instruction)).toContain(
            "applyTo: '**'",
        );
    });
});
