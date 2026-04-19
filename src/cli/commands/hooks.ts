/**
 * hooks.ts — `specky hooks [list|test|run NAME]`
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { targetPaths } from "../lib/paths.js";

export interface HooksOptions {
  action: "list" | "test" | "run";
  name?: string;
  workspace?: string;
}

export async function runHooks(opts: HooksOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const t = targetPaths(workspace);

  // Prefer .claude/hooks/scripts; fall back to .github/hooks/specky/scripts
  const candidates = [t.claude.hooksScripts, t.copilot.hooksScripts];
  const hooksDir = candidates.find((d) => existsSync(d));
  if (!hooksDir) {
    console.error("[specky hooks] No hooks directory found. Run `npx specky init` first.");
    return 2;
  }
  console.log(`[specky hooks] Using ${hooksDir}`);

  const scripts = readdirSync(hooksDir).filter((f) => f.endsWith(".sh") || f.endsWith(".mjs"));

  if (opts.action === "list") {
    console.log(`${scripts.length} hook(s):`);
    for (const s of scripts) console.log(`  ${s}`);
    return 0;
  }

  if (opts.action === "run") {
    if (!opts.name) {
      console.error("[specky hooks run] Missing hook name.");
      return 2;
    }
    const file = scripts.find((s) => s === opts.name || s === opts.name + ".sh" || s === opts.name + ".mjs");
    if (!file) {
      console.error(`[specky hooks run] Hook not found: ${opts.name}`);
      return 2;
    }
    return executeHook(resolve(hooksDir, file));
  }

  // action === "test" — run all
  let failures = 0;
  for (const s of scripts) {
    const code = executeHook(resolve(hooksDir, s));
    // Blocking hooks may legitimately exit 2; we treat exit > 2 or crash as failure
    if (code > 2) failures++;
  }
  console.log("");
  console.log(failures === 0 ? "[specky hooks test] ✅ All hooks ran without crashes" : `[specky hooks test] ❌ ${failures} crashed`);
  return failures === 0 ? 0 : 1;
}

function executeHook(path: string): number {
  const isMjs = path.endsWith(".mjs");
  const cmd = isMjs ? process.execPath : "bash";
  const args = [path];
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  const code = res.status ?? -1;
  console.log(`  ${path} → exit ${code}`);
  return code;
}
