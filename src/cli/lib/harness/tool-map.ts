/**
 * harness/tool-map.ts — logical↔native tool vocabulary.
 *
 * A single source of truth for how Specky's canonical tool ids map to each
 * harness's native tool tokens. Copilot and Claude outputs produced here are
 * byte-for-byte identical to the legacy inline transforms in asset-copier.ts.
 */

import type { HarnessTarget, LogicalTool } from "./types.js";

const MCP_PREFIX = "mcp.specky.";
const RAW_PREFIX = "raw:";

/** Fold any known native/source token into a canonical logical tool id. */
export function normalizeToLogical(token: string): LogicalTool {
    if (token.startsWith("specky/")) {
        return `${MCP_PREFIX}${token.slice("specky/".length)}`;
    }
    if (token.startsWith("mcp__specky__")) {
        return `${MCP_PREFIX}${token.slice("mcp__specky__".length)}`;
    }
    if (token.startsWith("sdd_")) {
        return `${MCP_PREFIX}${token}`;
    }

    switch (token) {
        case "Read":
        case "Glob":
        case "Grep":
        case "search":
            return "workspace.search";
        case "Edit":
        case "Write":
        case "MultiEdit":
        case "edit":
            return "workspace.edit";
        case "Bash":
        case "runCommands":
            return "workspace.command";
        case "WebFetch":
        case "WebSearch":
        case "fetch":
            return "web.fetch";
        case "Task":
        case "agent":
            return "agent.delegate";
        case "TodoWrite":
        case "todos":
            return "todo.write";
        default:
            return `${RAW_PREFIX}${token}`;
    }
}

type PlainLogicalTool = Exclude<
    LogicalTool,
    `mcp.specky.${string}` | `raw:${string}`
>;

const NATIVE: Record<PlainLogicalTool, Record<HarnessTarget, string[]>> = {
    "workspace.search": {
        copilot: ["search"],
        claude: ["Read", "Glob", "Grep"],
    },
    "workspace.edit": {
        copilot: ["edit"],
        claude: ["Edit", "Write"],
    },
    "workspace.command": {
        copilot: ["runCommands"],
        claude: ["Bash"],
    },
    "web.fetch": {
        copilot: ["fetch"],
        claude: ["WebFetch", "WebSearch"],
    },
    "agent.delegate": {
        copilot: ["agent"],
        claude: ["Task"],
    },
    "todo.write": {
        copilot: ["todos"],
        claude: ["TodoWrite"],
    },
};

function speckyMcpToken(tool: string, target: HarnessTarget): string {
    return target === "claude" ? `mcp__specky__${tool}` : `specky/${tool}`;
}

/** Render a logical tool id into the native token(s) for a harness. */
export function logicalToNative(
    logical: LogicalTool,
    target: HarnessTarget,
): string[] {
    if (logical.startsWith(MCP_PREFIX)) {
        return [speckyMcpToken(logical.slice(MCP_PREFIX.length), target)];
    }
    if (logical.startsWith(RAW_PREFIX)) {
        return [logical.slice(RAW_PREFIX.length)];
    }
    return NATIVE[logical as PlainLogicalTool][target];
}

/** Map a single source/native token to the native token(s) for a harness. */
export function mapTool(token: string, target: HarnessTarget): string[] {
    return logicalToNative(normalizeToLogical(token), target);
}
