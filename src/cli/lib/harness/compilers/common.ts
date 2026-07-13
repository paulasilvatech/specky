/**
 * harness/compilers/common.ts — shared frontmatter/tool-line helpers used by
 * every harness compiler.
 */

import type { HarnessTarget } from "../types.js";
import { mapTool } from "../tool-map.js";

export function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

export function normalizeNewlines(text: string): string {
    return text.replace(/\r\n/g, "\n");
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

/**
 * Rewrite the `tools:` frontmatter line for a target harness, mapping each
 * source token to its native token(s) and serializing in the harness's format.
 */
export function transformToolsLine(
    content: string,
    target: HarnessTarget,
    format: "json-array" | "comma-list",
): string {
    return content.replace(/^tools:\s*(.+)$/m, (_line, rawTools: string) => {
        const mapped = unique(
            parseToolArray(rawTools).flatMap((token) => mapTool(token, target)),
        );
        if (format === "comma-list") return `tools: ${mapped.join(", ")}`;
        return `tools: ${JSON.stringify(mapped)}`;
    });
}
