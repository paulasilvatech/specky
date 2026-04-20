#!/usr/bin/env node
/**
 * release.mjs — Pre-flight validation before `npm publish`.
 *
 * Runs the full quality gate locally so we never publish a broken package:
 *   1. Git working tree clean + up to date with remote
 *   2. Clean build
 *   3. All tests pass
 *   4. `npm pack --dry-run` includes required assets (agents, hooks, etc.)
 *   5. Fresh install + `specky init` + `specky doctor` works end-to-end
 *   6. Version is valid semver; dist-tag matches prerelease/stable
 *
 * Usage:
 *   node scripts/release.mjs [--tag=next|latest]
 *
 * This script does NOT run `npm publish` — that's a separate manual step
 * requiring 2FA. See PUBLISH.md for the full release procedure.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");

const EXPECTED = {
  agents: 13,
  prompts: 22,
  skills: 8,
  hooks: 16,
  templates: 23,
};

let failed = 0;

function step(name, fn) {
  process.stdout.write(`[release]  ${name}... `);
  try {
    fn();
    console.log("✅");
  } catch (err) {
    console.log("❌");
    console.error(`           ${err.message}`);
    failed++;
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: opts.silent ? "pipe" : "inherit",
    cwd: opts.cwd ?? REPO,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${res.status}`);
  }
  return res.stdout ?? "";
}

function runSilent(cmd, args, opts = {}) {
  return run(cmd, args, { ...opts, silent: true });
}

function countFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

function countDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

// ── 1. Git state ─────────────────────────────────────────
step("git working tree clean", () => {
  const out = runSilent("git", ["status", "--porcelain"]);
  if (out.trim()) throw new Error("uncommitted changes present");
});

step("git branch up to date with remote", () => {
  runSilent("git", ["fetch", "origin"]);
  const branch = runSilent("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const local = runSilent("git", ["rev-parse", "HEAD"]).trim();
  const remote = runSilent("git", ["rev-parse", `origin/${branch}`]).trim();
  if (local !== remote) {
    throw new Error(`local ${local.slice(0, 7)} != origin/${branch} ${remote.slice(0, 7)}`);
  }
});

// ── 2. Build + tests ─────────────────────────────────────
step("clean build", () => {
  runSilent("npm", ["run", "clean"]);
  runSilent("npm", ["run", "build"]);
});

step("unit + integration tests", () => {
  runSilent("npm", ["test"]);
});

// ── 3. Package contents ──────────────────────────────────
step("npm pack includes all assets", () => {
  // npm writes its notices to stderr, not stdout
  const res = spawnSync("npm", ["pack", "--dry-run"], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`npm pack --dry-run exited ${res.status}`);
  const out = (res.stdout ?? "") + (res.stderr ?? "");

  const counts = {
    agents: (out.match(/\.apm\/agents\/.+\.agent\.md/g) ?? []).length,
    prompts: (out.match(/\.apm\/prompts\/.+\.prompt\.md/g) ?? []).length,
    skills: (out.match(/\.apm\/skills\/.+\/SKILL\.md/g) ?? []).length,
    hooks: (out.match(/\.apm\/hooks\/scripts\/.+\.sh/g) ?? []).length,
    // Count only root templates/*.md, not dist/templates/*.md
    templates: (out.match(/^npm notice\s+\S+\s+templates\/[^/]+\.md$/gm) ?? []).length,
  };

  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      throw new Error(`${key}: expected ${expected}, got ${counts[key]}`);
    }
  }

  if (!out.includes("dist/cli/index.js")) throw new Error("CLI missing from tarball");
  if (!out.includes("dist/claude-hooks.json")) throw new Error("claude-hooks.json missing");
  if (!out.includes(".claude-plugin/plugin.json")) throw new Error(".claude-plugin/plugin.json missing");
});

// ── 4. Fresh install smoke test ──────────────────────────
step("fresh-install smoke test", () => {
  const packOut = runSilent("npm", ["pack"]).trim().split("\n");
  const tarball = packOut[packOut.length - 1];
  const fresh = mkdtempSync(resolve(tmpdir(), "specky-release-"));
  try {
    runSilent("git", ["init", "-q"], { cwd: fresh });
    runSilent("git", ["config", "user.email", "r@r.com"], { cwd: fresh });
    runSilent("git", ["config", "user.name", "r"], { cwd: fresh });
    runSilent("npm", ["init", "-y"], { cwd: fresh });
    runSilent("npm", ["install", resolve(REPO, tarball), "--silent"], { cwd: fresh });
    runSilent("npx", ["specky", "init", "--ide=both"], { cwd: fresh });

    const counts = {
      ".claude/agents":               { expected: EXPECTED.agents,   got: countFiles(resolve(fresh, ".claude/agents")) },
      ".claude/commands":             { expected: EXPECTED.prompts,  got: countFiles(resolve(fresh, ".claude/commands")) },
      ".claude/skills":               { expected: EXPECTED.skills,   got: countDirs(resolve(fresh, ".claude/skills")) },
      ".claude/hooks/scripts":        { expected: EXPECTED.hooks,    got: countFiles(resolve(fresh, ".claude/hooks/scripts")) },
      ".github/agents":               { expected: EXPECTED.agents,   got: countFiles(resolve(fresh, ".github/agents")) },
      ".github/prompts":              { expected: EXPECTED.prompts,  got: countFiles(resolve(fresh, ".github/prompts")) },
      ".github/hooks/specky/scripts": { expected: EXPECTED.hooks,    got: countFiles(resolve(fresh, ".github/hooks/specky/scripts")) },
    };
    for (const [dir, { expected, got }] of Object.entries(counts)) {
      if (got !== expected) throw new Error(`${dir}: ${got} ≠ ${expected}`);
    }

    const requiredFiles = [
      ".claude/settings.json",
      ".mcp.json",
      ".vscode/mcp.json",
      ".vscode/settings.json",
      ".specky/install.lock",
    ];
    for (const f of requiredFiles) {
      if (!existsSync(resolve(fresh, f))) throw new Error(`missing ${f}`);
    }

    runSilent("npx", ["specky", "doctor"], { cwd: fresh });
  } finally {
    rmSync(fresh, { recursive: true, force: true });
    rmSync(resolve(REPO, tarball), { force: true });
  }
});

// ── 5. Version sanity ────────────────────────────────────
step("package.json version is valid semver", () => {
  const pkg = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i.test(pkg.version)) {
    throw new Error(`version "${pkg.version}" is not valid semver`);
  }

  const tagArg = process.argv.find((a) => a.startsWith("--tag="));
  const isPrerelease = pkg.version.includes("-");
  const defaultTag = isPrerelease ? "next" : "latest";
  const tag = tagArg ? tagArg.slice("--tag=".length) : defaultTag;

  if (isPrerelease && tag === "latest") {
    throw new Error(`version "${pkg.version}" is a prerelease — use --tag=next, not latest`);
  }

  console.log(`\n           version ${pkg.version} → dist-tag "${tag}"`);
});

// ── Summary ──────────────────────────────────────────────
console.log("");
if (failed === 0) {
  console.log("[release]  ✅ All checks passed. Ready to publish.");
  console.log("[release]  Next step: npm publish --tag <next|latest>  (requires 2FA)");
  process.exit(0);
} else {
  console.error(`[release]  ❌ ${failed} check(s) failed. Do not publish.`);
  process.exit(1);
}
