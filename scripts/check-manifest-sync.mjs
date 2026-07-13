#!/usr/bin/env node
/**
 * check-manifest-sync.mjs — fail the build if release metadata drifts.
 *
 * The APM manifest, project config, and plugin MCP registration must all
 * declare the same package version as package.json. This guard runs during
 * `npm run build` so a version bump can never ship stale runtime metadata.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function readYamlScalar(text, key) {
    const match = text.match(new RegExp(String.raw`^${key}:\s*(.+?)\s*$`, "m"));
    return match ? match[1].replace(/^["']|["']$/g, "") : null;
}

function main() {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const apm = readFileSync(join(ROOT, "apm.yml"), "utf8");
    const config = readFileSync(join(ROOT, "config.yml"), "utf8");
    const mcp = JSON.parse(readFileSync(join(ROOT, "mcp.json"), "utf8"));

    const apmName = readYamlScalar(apm, "name");
    const apmVersion = readYamlScalar(apm, "version");
    const configVersion = readYamlScalar(config, "version");
    const mcpArgs = mcp.mcpServers?.specky?.args;
    const mcpPackage = Array.isArray(mcpArgs)
        ? mcpArgs.find((arg) => typeof arg === "string" && arg.startsWith("specky-sdd@"))
        : undefined;
    const expectedRuntime = `specky-sdd@${pkg.version}`;

    const errors = [];
    if (apmName !== pkg.name) {
        errors.push(`apm.yml name "${apmName}" != package.json name "${pkg.name}"`);
    }
    if (apmVersion !== pkg.version) {
        errors.push(
            `apm.yml version "${apmVersion}" != package.json version "${pkg.version}"`,
        );
    }
    if (configVersion !== pkg.version) {
        errors.push(
            `config.yml version "${configVersion}" != package.json version "${pkg.version}"`,
        );
    }
    if (mcpPackage !== expectedRuntime) {
        errors.push(
            `mcp.json specky runtime "${mcpPackage ?? "missing"}" != "${expectedRuntime}"`,
        );
    }
    const apmRuntimePins = [...apm.matchAll(/specky-sdd@([^\s"\],]+)/g)].map((match) => match[1]);
    if (apmRuntimePins.length === 0) {
        errors.push("apm.yml must pin at least one specky-sdd runtime reference");
    }
    for (const pin of apmRuntimePins) {
        if (pin !== pkg.version) {
            errors.push(`apm.yml runtime pin "specky-sdd@${pin}" != "${expectedRuntime}"`);
        }
    }

    if (errors.length > 0) {
        console.error("Manifest sync check failed:");
        for (const error of errors) console.error(`- ${error}`);
        console.error(
            "Update package, APM, config, and MCP runtime metadata to the same version and rebuild.",
        );
        process.exit(2);
    }

    console.log(
        `Manifest sync check passed (${pkg.name}@${pkg.version} == APM/config/MCP metadata).`,
    );
}

main();
