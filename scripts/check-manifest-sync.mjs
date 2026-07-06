#!/usr/bin/env node
/**
 * check-manifest-sync.mjs — fail the build if apm.yml and package.json drift.
 *
 * The APM manifest (apm.yml) and the npm manifest (package.json) must always
 * declare the same package name and version. This guard runs during
 * `npm run build` so a version bump can never ship a stale APM manifest.
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

    const apmName = readYamlScalar(apm, "name");
    const apmVersion = readYamlScalar(apm, "version");

    const errors = [];
    if (apmName !== pkg.name) {
        errors.push(`apm.yml name "${apmName}" != package.json name "${pkg.name}"`);
    }
    if (apmVersion !== pkg.version) {
        errors.push(
            `apm.yml version "${apmVersion}" != package.json version "${pkg.version}"`,
        );
    }

    if (errors.length > 0) {
        console.error("Manifest sync check failed:");
        for (const error of errors) console.error(`- ${error}`);
        console.error(
            "Update apm.yml to match package.json (name + version) and rebuild.",
        );
        process.exit(2);
    }

    console.log(
        `Manifest sync check passed (${pkg.name}@${pkg.version} == apm.yml).`,
    );
}

main();
