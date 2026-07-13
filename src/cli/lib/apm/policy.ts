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
    mcp?: {
        allowTransitive?: boolean;
        allowedServers?: string[];
        optionalCapabilityServers?: string[];
    };
    hooks?: { allowedEvents?: string[] };
    targets?: Record<string, { forbidToolTokens?: string[] }>;
}

const TARGET_ALIASES: Record<string, HarnessTarget> = {
    "github-copilot": "copilot",
    copilot: "copilot",
    "claude-code": "claude",
    claude: "claude",
    cursor: "cursor",
    opencode: "opencode",
    "agent-skills": "agent-skills",
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

function checkMcpAllowlist(pkgRoot: string, policy: ApmPolicy, errors: string[]): void {
    const allowedServers = policy.mcp?.allowedServers ?? [];
    const manifest = loadManifest(pkgRoot);
    for (const server of manifest.mcp?.servers ?? []) {
        if (!allowedServers.includes(server.name)) {
            errors.push(`MCP server "${server.name}" is not in policy allowedServers`);
        }
    }
}

function checkOptionalCapabilityServers(
    policy: ApmPolicy,
    agentsDir: string,
    errors: string[],
): void {
    const allowedServers = new Set(policy.mcp?.optionalCapabilityServers ?? []);
    for (const file of policyAgentFiles(agentsDir)) {
        const content = readFileSync(resolve(agentsDir, file), "utf8");
        const declaredServers = [
            ...content.matchAll(/\bmcp\.([a-z][a-z0-9-]*)\.[a-z][a-z0-9_]*\b/g),
        ].map((match) => match[1]);
        for (const server of declaredServers) {
            if (server !== "specky" && !allowedServers.has(server)) {
                errors.push(
                    `agent "${file}" references optional MCP server "${server}" outside policy`,
                );
            }
        }
    }
}

function checkHookEvents(policy: ApmPolicy, hooksManifest: string, errors: string[]): void {
    const allowedEvents = policy.hooks?.allowedEvents;
    if (!allowedEvents || !existsSync(hooksManifest)) return;

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

function policyAgentFiles(agentsDir: string): string[] {
    return existsSync(agentsDir)
        ? readdirSync(agentsDir).filter((file) => file.endsWith(".agent.md"))
        : [];
}

function checkForbiddenTokens(
    targetName: string,
    target: HarnessTarget,
    forbidden: string[],
    agentsDir: string,
    agentFiles: string[],
    errors: string[],
): void {
    if (forbidden.length === 0) return;
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

function checkTargetIsolation(
    policy: ApmPolicy,
    agentsDir: string,
    errors: string[],
    warnings: string[],
): void {
    const agentFiles = policyAgentFiles(agentsDir);
    for (const [targetName, rules] of Object.entries(policy.targets ?? {})) {
        const target = TARGET_ALIASES[targetName];
        if (!target) {
            warnings.push(`policy targets: unknown target "${targetName}"`);
            continue;
        }
        checkForbiddenTokens(
            targetName,
            target,
            rules.forbidToolTokens ?? [],
            agentsDir,
            agentFiles,
            errors,
        );
    }
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

    checkMcpAllowlist(pkgRoot, policy, errors);
    checkOptionalCapabilityServers(policy, agentsDir, errors);
    checkHookEvents(policy, hooksManifest, errors);
    checkTargetIsolation(policy, agentsDir, errors, warnings);

    return { ok: errors.length === 0, errors, warnings };
}
