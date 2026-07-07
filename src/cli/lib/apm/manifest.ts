/**
 * apm/manifest.ts — load and validate the APM manifest (apm.yml).
 *
 * The manifest is the enterprise contract for the package: it declares the
 * canonical primitive source, the harness targets the package compiles to, and
 * the MCP servers that back the primitives' tool ids. `apm validate` checks the
 * manifest against the on-disk primitives and the npm manifest (package.json).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { sourcePaths } from "../paths.js";

export interface ApmMcpServer {
    name: string;
    transport?: string;
    command?: string;
    args?: string[];
    tools?: string[];
    registry?: boolean;
}

export interface ApmManifest {
    name: string;
    version: string;
    description?: string;
    targets: string[];
    primitives: Record<string, string>;
    mcp?: { servers?: ApmMcpServer[] };
}

export function loadManifest(pkgRoot: string): ApmManifest {
    const { apmYml } = sourcePaths(pkgRoot);
    if (!existsSync(apmYml)) {
        throw new Error(`[specky] apm.yml not found at ${apmYml}`);
    }
    return parse(readFileSync(apmYml, "utf8")) as ApmManifest;
}

export interface ValidationResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate the APM manifest: required fields, version parity with
 * package.json, declared primitive paths exist, targets are non-empty, and at
 * least one MCP server is declared.
 */
export function validateManifest(pkgRoot: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let manifest: ApmManifest;
    try {
        manifest = loadManifest(pkgRoot);
    } catch (err) {
        return { ok: false, errors: [(err as Error).message], warnings };
    }

    const pkg = JSON.parse(
        readFileSync(resolve(pkgRoot, "package.json"), "utf8"),
    ) as { name: string; version: string };

    if (!manifest.name) errors.push("apm.yml: missing 'name'");
    else if (manifest.name !== pkg.name) {
        errors.push(
            `apm.yml name "${manifest.name}" != package.json name "${pkg.name}"`,
        );
    }

    if (!manifest.version) errors.push("apm.yml: missing 'version'");
    else if (manifest.version !== pkg.version) {
        errors.push(
            `apm.yml version "${manifest.version}" != package.json version "${pkg.version}"`,
        );
    }

    if (!Array.isArray(manifest.targets) || manifest.targets.length === 0) {
        errors.push("apm.yml: 'targets' must list at least one harness target");
    }

    if (!manifest.primitives || typeof manifest.primitives !== "object") {
        errors.push("apm.yml: missing 'primitives' map");
    } else {
        for (const [kind, relPath] of Object.entries(manifest.primitives)) {
            if (!existsSync(resolve(pkgRoot, relPath))) {
                errors.push(
                    `apm.yml: primitive '${kind}' path does not exist: ${relPath}`,
                );
            }
        }
    }

    const servers = manifest.mcp?.servers ?? [];
    if (servers.length === 0) {
        warnings.push("apm.yml: no MCP servers declared under 'mcp.servers'");
    }

    return { ok: errors.length === 0, errors, warnings };
}
