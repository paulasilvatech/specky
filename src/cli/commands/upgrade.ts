/**
 * upgrade.ts — `specky upgrade` — refresh installed assets, preserve user state.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../../constants.js";
import { targetPaths } from "../lib/paths.js";
import { runInit } from "./init.js";

export interface UpgradeOptions {
  keepSpecs: boolean;
  workspace?: string;
}

export async function runUpgrade(opts: UpgradeOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const t = targetPaths(workspace);
  const installJson = resolve(t.shared.specky, "install.json");

  console.log(`[specky upgrade] to v${VERSION}`);

  if (existsSync(installJson)) {
    try {
      const meta = JSON.parse(readFileSync(installJson, "utf8")) as {
        version: string;
        ide: string;
      };
      console.log(`[specky upgrade] Previous version: v${meta.version}, ide=${meta.ide}`);
    } catch {
      console.log(`[specky upgrade] Previous install metadata unreadable`);
    }
  } else {
    console.log(`[specky upgrade] No previous install detected — running init instead`);
  }

  // Upgrade = init with --force, re-detect IDE from existing install
  let ide: "claude" | "copilot" | "both" | "auto" = "auto";
  if (existsSync(installJson)) {
    try {
      const meta = JSON.parse(readFileSync(installJson, "utf8")) as {
        ide?: "claude" | "copilot" | "both";
      };
      if (meta.ide) ide = meta.ide;
    } catch {
      // ignore
    }
  }

  console.log(`[specky upgrade] .specs/ and .specky/profile.json will be preserved.`);
  return runInit({ force: true, dryRun: false, ide, workspace });
}
