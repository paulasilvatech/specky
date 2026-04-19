/**
 * doctor.ts — `specky doctor` — validate install integrity against install.lock.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { hashFile } from "../lib/asset-copier.js";
import { targetPaths } from "../lib/paths.js";

export interface DoctorOptions {
  fix: boolean;
  verbose: boolean;
  workspace?: string;
}

interface InstallLock {
  version: string;
  generated_at: string;
  files: Record<string, string>;
}

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const targets = targetPaths(workspace);
  const lockPath = resolve(targets.shared.specky, "install.lock");

  console.log(`[specky doctor] Workspace: ${workspace}`);

  if (!existsSync(lockPath)) {
    console.error(`[specky doctor] ❌ No install.lock at ${lockPath}`);
    console.error(`[specky doctor]    Run \`npx specky init\` to bootstrap.`);
    return 2;
  }

  const lock: InstallLock = JSON.parse(readFileSync(lockPath, "utf8")) as InstallLock;
  console.log(`[specky doctor] Lock version: ${lock.version} (generated ${lock.generated_at})`);
  console.log(`[specky doctor] Files tracked: ${Object.keys(lock.files).length}`);

  const missing: string[] = [];
  const modified: string[] = [];
  const ok: string[] = [];

  for (const [rel, expected] of Object.entries(lock.files)) {
    const abs = resolve(targets.shared.specky, rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    try {
      if (!statSync(abs).isFile()) continue;
      const actual = hashFile(abs);
      if (actual !== expected) modified.push(rel);
      else ok.push(rel);
    } catch {
      missing.push(rel);
    }
  }

  console.log("");
  console.log(`  ✅ OK:       ${ok.length}`);
  console.log(`  ✏️  Modified: ${modified.length}`);
  console.log(`  ❌ Missing:  ${missing.length}`);

  if (opts.verbose || missing.length > 0 || modified.length > 0) {
    if (missing.length) {
      console.log("");
      console.log("Missing files:");
      for (const m of missing) console.log(`  - ${m}`);
    }
    if (modified.length) {
      console.log("");
      console.log("Modified files (local edits detected):");
      for (const m of modified) console.log(`  - ${m}`);
    }
  }

  if (missing.length === 0 && modified.length === 0) {
    console.log("");
    console.log("[specky doctor] ✅ Install is healthy.");
    return 0;
  }

  console.log("");
  if (opts.fix) {
    console.log("[specky doctor] --fix requested — re-running init with --force to restore missing files.");
    const init = await import("./init.js");
    return init.runInit({ force: true, dryRun: false, ide: "auto", workspace });
  }

  console.log("[specky doctor] ⚠️  To repair: `npx specky init --force` (overwrites) or `npx specky doctor --fix`");
  return 1;
}
