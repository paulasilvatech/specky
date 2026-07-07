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

    it("renders logical ids into Cursor-native tokens", () => {
        expect(logicalToNative("workspace.search", "cursor")).toEqual([
            "Read",
            "Glob",
            "Grep",
        ]);
        expect(logicalToNative("agent.delegate", "cursor")).toEqual(["Task"]);
        expect(logicalToNative("mcp.specky.sdd_get_status", "cursor")).toEqual([
            "mcp__specky__sdd_get_status",
        ]);
    });

    it("renders logical ids into OpenCode-native tokens", () => {
        expect(logicalToNative("workspace.search", "opencode")).toEqual(["read"]);
        expect(logicalToNative("workspace.command", "opencode")).toEqual(["bash"]);
        expect(logicalToNative("mcp.specky.sdd_get_status", "opencode")).toEqual([
            "specky/sdd_get_status",
        ]);
    });

    it("renders logical ids into Agent Skills-neutral tokens", () => {
        expect(logicalToNative("workspace.search", "agent-skills")).toEqual([
            "workspace.search",
        ]);
        expect(logicalToNative("mcp.specky.sdd_get_status", "agent-skills")).toEqual([
            "sdd_get_status",
        ]);
    });

    it("passes unknown tokens through unchanged", () => {
        expect(mapTool("something_custom", "copilot")).toEqual(["something_custom"]);
        expect(mapTool("something_custom", "claude")).toEqual(["something_custom"]);
        expect(mapTool("something_custom", "cursor")).toEqual(["something_custom"]);
        expect(mapTool("something_custom", "opencode")).toEqual(["something_custom"]);
        expect(mapTool("something_custom", "agent-skills")).toEqual(["something_custom"]);
    });
});

describe("harness compiler registry", () => {
    it("exposes Wave 1 harness compilers", () => {
        expect(SUPPORTED_TARGETS).toContain("copilot");
        expect(SUPPORTED_TARGETS).toContain("claude");
        expect(SUPPORTED_TARGETS).toContain("cursor");
        expect(SUPPORTED_TARGETS).toContain("opencode");
        expect(SUPPORTED_TARGETS).toContain("agent-skills");
        expect(getCompiler("copilot").target).toBe("copilot");
        expect(getCompiler("claude").target).toBe("claude");
        expect(getCompiler("cursor").target).toBe("cursor");
        expect(getCompiler("opencode").target).toBe("opencode");
        expect(getCompiler("agent-skills").target).toBe("agent-skills");
    });

    it("compiles an agent tools line per harness", () => {
        const source = 'tools: ["search", "agent", "specky/sdd_get_status"]\n';
        expect(getCompiler("copilot").compileAgent(source)).toBe(
            'tools: ["search","agent","specky/sdd_get_status"]\n',
        );
        expect(getCompiler("claude").compileAgent(source)).toBe(
            "tools: Read, Glob, Grep, Task, mcp__specky__sdd_get_status\n",
        );
        expect(getCompiler("cursor").compileAgent(source)).toBe(
            "tools: Read, Glob, Grep, Task, mcp__specky__sdd_get_status\n",
        );
        expect(getCompiler("opencode").compileAgent(source)).toBe(
            "tools: read, agent, specky/sdd_get_status\n",
        );
        expect(getCompiler("agent-skills").compileAgent(source)).toBe(source);
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
