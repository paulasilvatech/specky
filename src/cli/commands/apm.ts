/**
 * commands/apm.ts — `specky apm <subcommand>` governance surface.
 *
 * Subcommands:
 *   validate     Validate apm.yml against on-disk primitives + package.json.
 *   lock         Write apm.lock.yaml with a sha256 for every primitive.
 *   verify-lock  Recompute hashes and diff against apm.lock.yaml.
 *   policy       Enforce apm-policy.yml (MCP allowlist, hooks, tool isolation).
 *   audit        Run the primitive frontmatter audit.
 *   sbom         Emit a CycloneDX SBOM of the packaged primitives.
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { packageRoot } from "../lib/paths.js";
import { validateManifest, loadManifest } from "../lib/apm/manifest.js";
import {
    generateLock,
    serializeLock,
    lockPath,
    verifyLock,
} from "../lib/apm/lock.js";
import { checkPolicy } from "../lib/apm/policy.js";

function print(result: { errors: string[]; warnings: string[] }): void {
    for (const w of result.warnings) console.warn(`  ⚠️  ${w}`);
    for (const e of result.errors) console.error(`  ❌ ${e}`);
}

function runValidate(pkgRoot: string): number {
    const result = validateManifest(pkgRoot);
    print(result);
    if (result.ok) {
        const m = loadManifest(pkgRoot);
        console.log(`✅ apm.yml valid — ${m.name}@${m.version}, targets: ${m.targets.join(", ")}`);
        return 0;
    }
    return 2;
}

function runLock(pkgRoot: string, dryRun: boolean): number {
    const lock = generateLock(pkgRoot);
    const count = Object.keys(lock.primitives).length;
    if (dryRun) {
        console.log(`ℹ️  apm lock (dry-run): ${count} primitives would be hashed`);
        return 0;
    }
    writeFileSync(lockPath(pkgRoot), serializeLock(lock), "utf8");
    console.log(`✅ Wrote apm.lock.yaml — ${count} primitives (${lock.package.name}@${lock.package.version})`);
    return 0;
}

function runVerifyLock(pkgRoot: string): number {
    const result = verifyLock(pkgRoot);
    if (result.error) {
        console.error(`  ❌ ${result.error}`);
        return 2;
    }
    if (result.ok) {
        console.log("✅ apm.lock.yaml matches the primitive source");
        return 0;
    }
    for (const f of result.changed) console.error(`  ✏️  changed: ${f}`);
    for (const f of result.missing) console.error(`  ➖ missing: ${f}`);
    for (const f of result.extra) console.error(`  ➕ untracked: ${f}`);
    console.error("❌ Lock verification failed — run `specky apm lock` to update");
    return 2;
}

function runPolicy(pkgRoot: string): number {
    const result = checkPolicy(pkgRoot);
    print(result);
    if (result.ok) {
        console.log("✅ apm-policy.yml checks passed");
        return 0;
    }
    return 2;
}

function runAudit(pkgRoot: string): number {
    const res = spawnSync(
        process.execPath,
        [resolve(pkgRoot, "scripts/audit-agent-frontmatter.mjs")],
        { stdio: "inherit", cwd: pkgRoot },
    );
    return res.status ?? 1;
}

function runSbom(pkgRoot: string): number {
    const lock = generateLock(pkgRoot);
    const sbom = {
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        version: 1,
        metadata: {
            timestamp: new Date().toISOString(),
            component: {
                type: "application",
                name: lock.package.name,
                version: lock.package.version,
            },
        },
        components: Object.entries(lock.primitives).map(([path, hash]) => ({
            type: "file",
            name: path,
            hashes: [{ alg: "SHA-256", content: hash.replace(/^sha256:/, "") }],
        })),
    };
    console.log(JSON.stringify(sbom, null, 2));
    return 0;
}

export function apmCommand(argv: string[]): number {
    const pkgRoot = packageRoot();
    const sub = argv[0];
    const rest = argv.slice(1);
    const dryRun = rest.includes("--dry-run");

    switch (sub) {
        case "validate":
            return runValidate(pkgRoot);
        case "lock":
            return runLock(pkgRoot, dryRun);
        case "verify-lock":
            return runVerifyLock(pkgRoot);
        case "policy":
            // `specky apm policy` or `specky apm policy check`
            return runPolicy(pkgRoot);
        case "audit":
            return runAudit(pkgRoot);
        case "sbom":
            return runSbom(pkgRoot);
        case "help":
        case undefined:
            console.log(
                [
                    "specky apm <subcommand>",
                    "",
                    "  validate      Validate apm.yml against primitives + package.json",
                    "  lock          Write apm.lock.yaml (sha256 per primitive)",
                    "  verify-lock   Diff the primitive source against apm.lock.yaml",
                    "  policy        Enforce apm-policy.yml (MCP, hooks, tool isolation)",
                    "  audit         Run the primitive frontmatter audit",
                    "  sbom          Emit a CycloneDX SBOM of packaged primitives",
                ].join("\n"),
            );
            return 0;
        default:
            console.error(`Unknown apm subcommand: ${sub}`);
            console.error("Run `specky apm help` for usage.");
            return 1;
    }
}
