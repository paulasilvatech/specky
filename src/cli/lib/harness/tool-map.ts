/**
 * harness/tool-map.ts — logical↔native tool vocabulary.
 *
 * A single source of truth for how Specky's canonical tool ids map to each
 * harness's native tool tokens. Copilot and Claude outputs produced here are
 * byte-for-byte identical to the legacy inline transforms in asset-copier.ts.
 */

import type { AgentCapability, HarnessTarget, LogicalTool } from "./types.js";

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
        cursor: ["Read", "Glob", "Grep"],
        opencode: ["read"],
        "agent-skills": ["workspace.search"],
    },
    "workspace.edit": {
        copilot: ["edit"],
        claude: ["Edit", "Write", "MultiEdit"],
        cursor: ["Edit", "Write", "MultiEdit"],
        opencode: ["edit"],
        "agent-skills": ["workspace.edit"],
    },
    "workspace.command": {
        copilot: ["runCommands"],
        claude: ["Bash"],
        cursor: ["Bash"],
        opencode: ["bash"],
        "agent-skills": ["workspace.command"],
    },
    "web.fetch": {
        copilot: ["fetch"],
        claude: ["WebFetch", "WebSearch"],
        cursor: ["WebFetch", "WebSearch"],
        opencode: ["fetch"],
        "agent-skills": ["web.fetch"],
    },
    "agent.delegate": {
        copilot: ["agent"],
        claude: ["Task"],
        cursor: ["Task"],
        opencode: ["agent"],
        "agent-skills": ["agent.delegate"],
    },
    "todo.write": {
        copilot: ["todos"],
        claude: ["TodoWrite"],
        cursor: ["TodoWrite"],
        opencode: ["todo"],
        "agent-skills": ["todo.write"],
    },
};

type PlainCapability = Exclude<
    AgentCapability,
    `mcp.specky.${string}` | `mcp.github.${string}`
>;

const CAPABILITY_NATIVE: Record<
    PlainCapability,
    Record<Exclude<HarnessTarget, "agent-skills">, string[]>
> = {
    "workspace.read": {
        copilot: ["search"],
        claude: ["Read", "Glob", "Grep"],
        cursor: ["Read", "Glob", "Grep"],
        opencode: ["read"],
    },
    "workspace.edit": {
        copilot: ["edit"],
        claude: ["Edit", "Write", "MultiEdit"],
        cursor: ["Edit", "Write", "MultiEdit"],
        opencode: ["edit"],
    },
    "workspace.command.git": {
        copilot: ["runCommands"],
        claude: ["Bash"],
        cursor: ["Bash"],
        opencode: ["bash"],
    },
    "workspace.command.test": {
        copilot: ["runCommands"],
        claude: ["Bash"],
        cursor: ["Bash"],
        opencode: ["bash"],
    },
    "workspace.command.release-gates": {
        copilot: ["runCommands"],
        claude: ["Bash"],
        cursor: ["Bash"],
        opencode: ["bash"],
    },
    "web.fetch": {
        copilot: ["fetch"],
        claude: ["WebFetch", "WebSearch"],
        cursor: ["WebFetch", "WebSearch"],
        opencode: ["fetch"],
    },
    "agent.delegate": {
        copilot: ["agent"],
        claude: ["Task"],
        cursor: ["Task"],
        opencode: ["agent"],
    },
    "todo.write": {
        copilot: ["todos"],
        claude: ["TodoWrite"],
        cursor: ["TodoWrite"],
        opencode: ["todo"],
    },
};

function speckyMcpToken(tool: string, target: HarnessTarget): string {
    if (target === "claude" || target === "cursor") return `mcp__specky__${tool}`;
    if (target === "agent-skills") return tool;
    return `specky/${tool}`;
}

function mcpToken(server: "specky" | "github", tool: string, target: Exclude<HarnessTarget, "agent-skills">): string {
    if (target === "claude" || target === "cursor") return `mcp__${server}__${tool}`;
    return `${server}/${tool}`;
}

/** Return whether a value is an allowed canonical agent capability. */
export function isAgentCapability(value: string): value is AgentCapability {
    return (
        value in CAPABILITY_NATIVE ||
        /^mcp\.(specky|github)\.[a-z][a-z0-9_]*$/.test(value)
    );
}

/**
 * Render a canonical agent capability to target-native tool tokens.
 * Agent Skills is intentionally excluded because it installs skills only.
 */
export function capabilityToNative(
    capability: AgentCapability,
    target: Exclude<HarnessTarget, "agent-skills">,
): string[] {
    if (!isAgentCapability(capability)) {
        throw new Error(`Unknown agent capability "${capability}".`);
    }

    if (capability.startsWith("mcp.")) {
        const [, server, ...toolParts] = capability.split(".");
        return [mcpToken(server as "specky" | "github", toolParts.join("."), target)];
    }

    return CAPABILITY_NATIVE[capability as PlainCapability][target];
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
