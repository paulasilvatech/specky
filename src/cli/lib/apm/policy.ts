/**
 * apm/policy.ts — enforce the enterprise governance policy (apm-policy.yml).
 *
 * Checks that: declared MCP servers are allow-listed, hook manifests only
 * register allowed events, and each harness target's compiled tool tokens stay
 * isolated (no foreign harness tokens leak across targets).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { sourcePaths } from "../paths.js";
import { loadManifest } from "./manifest.js";
import { getCompiler } from "../harness/index.js";
import type { HarnessTarget } from "../harness/types.js";

export interface ApmPolicy {
    schemaVersion?: number;
    allowedSources?: string[];
    mcp?: { allowTransitive?: boolean; allowedServers?: string[] };
    hooks?: { allowedEvents?: string[] };
    targets?: Record<string, { forbidToolTokens?: string[] }>;
}

const TARGET_ALIASES: Record<string, HarnessTarget> = {
    "github-copilot": "copilot",
    copilot: "copilot",
    "claude-code": "claude",
    claude: "claude",
};

export function policyPath(pkgRoot: string): string {
    return resolve(pkgRoot, "apm-policy.yml");
}

export function loadPolicy(pkgRoot: string): ApmPolicy {
    const path = policyPath(pkgRoot);
    if (!existsSync(path)) return {};
    return (parse(readFileSync(path, "utf8")) as ApmPolicy) ?? {};
}

export interface PolicyResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
}

function toolsLine(content: string): string {
    return content.split("\n").find((line) => line.startsWith("tools:")) ?? "";
}

export function checkPolicy(pkgRoot: string): PolicyResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const policy = loadPolicy(pkgRoot);
    if (!existsSync(policyPath(pkgRoot))) {
        warnings.push("apm-policy.yml not found — governance checks are skipped");
        return { ok: true, errors, warnings };
    }

    const { agentsDir, hooksManifest } = sourcePaths(pkgRoot);

    // 1. MCP allowlist.
    const allowedServers = policy.mcp?.allowedServers ?? [];
    const manifest = loadManifest(pkgRoot);
    for (const server of manifest.mcp?.servers ?? []) {
        if (!allowedServers.includes(server.name)) {
            errors.push(`MCP server "${server.name}" is not in policy allowedServers`);
        }
    }

    // 2. Hook event allowlist.
    const allowedEvents = policy.hooks?.allowedEvents;
    if (allowedEvents && existsSync(hooksManifest)) {
        const manifestJson = JSON.parse(readFileSync(hooksManifest, "utf8")) as Record<
            string,
            unknown
        >;
        for (const event of Object.keys(manifestJson)) {
            if (!allowedEvents.includes(event)) {
                errors.push(`Hook manifest registers disallowed event "${event}"`);
            }
        }
    }

    // 3. Per-target tool-name isolation.
    const agentFiles = existsSync(agentsDir)
        ? readdirSync(agentsDir).filter((f) => f.endsWith(".agent.md"))
        : [];

    for (const [targetName, rules] of Object.entries(policy.targets ?? {})) {
        const target = TARGET_ALIASES[targetName];
        if (!target) {
            warnings.push(`policy targets: unknown target "${targetName}"`);
            continue;
        }
        const forbidden = rules.forbidToolTokens ?? [];
        if (forbidden.length === 0) continue;
        const compiler = getCompiler(target);

        for (const file of agentFiles) {
            const source = readFileSync(resolve(agentsDir, file), "utf8");
            const line = toolsLine(compiler.compileAgent(source));
            for (const token of forbidden) {
                if (line.includes(token)) {
                    errors.push(
                        `${targetName}: agent "${file}" compiles to a forbidden tool token "${token}"`,
                    );
                }
            }
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}
