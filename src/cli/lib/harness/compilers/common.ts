/**
 * harness/compilers/common.ts — shared frontmatter/tool-line helpers used by
 * every harness compiler.
 */

import type { AgentCapability, HarnessCompileOptions, HarnessTarget } from "../types.js";
import { capabilityToNative, isAgentCapability, mapTool } from "../tool-map.js";

export function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

export function normalizeNewlines(text: string): string {
    return text.replaceAll("\r\n", "\n");
}

function frontmatterValue(content: string, key: string): string | undefined {
    const prefix = `${key}:`;
    return normalizeNewlines(content)
        .split("\n")
        .find((line) => line.startsWith(prefix))
        ?.slice(prefix.length)
        .trim();
}

function replaceFrontmatterLine(content: string, key: string, replacement: string): string {
    const prefix = `${key}:`;
    let replaced = false;
    return normalizeNewlines(content)
        .split("\n")
        .map((line) => {
            if (!replaced && line.startsWith(prefix)) {
                replaced = true;
                return replacement;
            }
            return line;
        })
        .join("\n");
}

export function stripYamlFrontmatter(content: string): string {
    return normalizeNewlines(content).replace(/^---\n[\s\S]*?\n---\n/, "");
}

/** Parse a frontmatter `tools:` value that is a JSON array or a comma list. */
export function parseToolArray(tools: string): string[] {
    const trimmed = tools.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
            // Fall through to the comma parser below.
        }
    }
    return trimmed
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((token) => token.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
}

/** Parse the canonical `capabilities:` frontmatter value. */
export function parseCapabilityArray(capabilities: string): AgentCapability[] {
    const values = parseToolArray(capabilities);
    const unknown = values.filter((value) => !isAgentCapability(value));
    if (unknown.length > 0) {
        throw new Error(`Unknown agent capability: ${unknown.join(", ")}`);
    }
    return values as AgentCapability[];
}

/** Extract canonical capabilities from an agent source file, if present. */
export function agentCapabilities(content: string): AgentCapability[] {
    const rawCapabilities = frontmatterValue(content, "capabilities");
    if (rawCapabilities === undefined) return [];
    if (frontmatterValue(content, "tools") !== undefined) {
        throw new Error("Canonical agent frontmatter must declare either capabilities or tools, not both.");
    }
    return parseCapabilityArray(rawCapabilities);
}

/**
 * Rewrite the `tools:` frontmatter line for a target harness, mapping each
 * source token to its native token(s) and serializing in the harness's format.
 */
export function transformToolsLine(
    content: string,
    target: HarnessTarget,
    format: "json-array" | "comma-list",
): string {
    const rawTools = frontmatterValue(content, "tools");
    if (rawTools === undefined) return content;
    const mapped = unique(
        parseToolArray(rawTools).flatMap((token) => mapTool(token, target)),
    );
    const tools = format === "comma-list"
        ? `tools: ${mapped.join(", ")}`
        : `tools: ${JSON.stringify(mapped)}`;
    return replaceFrontmatterLine(content, "tools", tools);
}

/**
 * Compile canonical `capabilities:` into a target-native `tools:` line.
 * Legacy canonical `tools:` remains supported while agents migrate.
 */
export function transformAgentTools(
    content: string,
    target: HarnessTarget,
    format: "json-array" | "comma-list",
    opts: HarnessCompileOptions = {},
): string {
    const capabilities = agentCapabilities(content);
    if (capabilities.length === 0) return transformToolsLine(content, target, format);
    if (target === "agent-skills") {
        throw new Error("Agent Skills is a skills-only target and cannot compile agents.");
    }
    const enabledIntegrations = new Set(opts.integrations ?? []);
    const mapped = unique(
        capabilities
            .filter((capability) =>
                !capability.startsWith("mcp.github.") || enabledIntegrations.has("github"),
            )
            .flatMap((capability) =>
                capabilityToNative(capability, target),
            ),
    );
    const tools = format === "comma-list"
        ? `tools: ${mapped.join(", ")}`
        : `tools: ${JSON.stringify(mapped)}`;
    return replaceFrontmatterLine(content, "capabilities", tools);
}
