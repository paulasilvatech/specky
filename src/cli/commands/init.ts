/**
 * init.ts — `specky init` — install Specky assets into the current workspace.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../../constants.js";
import {
  copyToClaude,
  copyToCopilot,
  summarizeCopy,
  writeInstallLock,
} from "../lib/asset-copier.js";
import { detectIde, type IdeTarget } from "../lib/ide-detect.js";
import { packageRoot, sourcePaths, targetPaths } from "../lib/paths.js";
import { loadClaudeHooksManifest, mergeClaudeHooks } from "../lib/settings-merger.js";
import { writeMcpRegistration } from "../lib/mcp-writer.js";

export interface InitOptions {
  ide?: IdeTarget | "auto";
  force: boolean;
  dryRun: boolean;
  workspace?: string;
}

export async function runInit(opts: InitOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const pkg = packageRoot();
  const targets = targetPaths(workspace);
  const src = sourcePaths(pkg);

  const detected = detectIde(workspace);
  const resolvedIde: IdeTarget =
    !opts.ide || opts.ide === "auto" ? detected.recommendation : opts.ide;

  const copyOpts = { force: opts.force, dryRun: opts.dryRun };

  console.log(`[specky init] Version ${VERSION}`);
  console.log(`[specky init] Workspace: ${workspace}`);
  console.log(`[specky init] IDE target: ${resolvedIde}${opts.ide === "auto" || !opts.ide ? " (auto-detected)" : ""}`);
  if (detected.signals.length) {
    console.log(`[specky init] Detected signals: ${detected.signals.join(", ")}`);
  }
  if (opts.dryRun) console.log(`[specky init] DRY RUN — no files will be written`);
  console.log("");

  const results = [];

  // Claude Code install
  if (resolvedIde === "claude" || resolvedIde === "both") {
    console.log("[specky init] Installing to .claude/ …");
    const r = copyToClaude(pkg, targets, copyOpts);
    console.log(summarizeCopy(".claude", r));
    results.push(r);

    // Merge hooks into settings.json
    try {
      const hooks = loadClaudeHooksManifest(src.claudeHooksManifest);
      const merge = mergeClaudeHooks(targets, hooks, { dryRun: opts.dryRun });
      console.log(`  settings.json: ${merge.written ? "merged" : "dry-run"} at ${merge.path}`);
    } catch (err) {
      console.warn(`  ⚠️  ${(err as Error).message}`);
    }

    // Write .mcp.json
    const mcp = writeMcpRegistration(targets.shared.claudeMcp, {
      dryRun: opts.dryRun,
      serverName: "specky",
      useVscodeSchema: false,
    });
    console.log(`  .mcp.json: ${mcp.action}`);
    console.log("");
  }

  // GitHub Copilot install
  if (resolvedIde === "copilot" || resolvedIde === "both") {
    console.log("[specky init] Installing to .github/ …");
    const r = copyToCopilot(pkg, targets, copyOpts);
    console.log(summarizeCopy(".github", r));
    results.push(r);

    // Write .vscode/mcp.json
    const mcp = writeMcpRegistration(targets.shared.vscodeMcp, {
      dryRun: opts.dryRun,
      serverName: "specky",
      useVscodeSchema: true,
    });
    console.log(`  .vscode/mcp.json: ${mcp.action}`);
    console.log("");
  }

  // Write .specky/config.yml (canonical project config)
  if (!opts.dryRun) {
    mkdirSync(targets.shared.specky, { recursive: true });
    const dest = resolve(targets.shared.specky, "config.yml");
    if (!existsSync(dest) && existsSync(src.configYml)) {
      copyFileSync(src.configYml, dest);
      console.log(`[specky init] Wrote ${dest}`);
    }
  }

  // Write install.lock
  const lockPath = writeInstallLock(targets, results, VERSION, copyOpts);
  console.log(`[specky init] Integrity manifest: ${lockPath}`);

  // Write meta marker for `specky doctor` and upgrades
  if (!opts.dryRun) {
    const meta = {
      version: VERSION,
      ide: resolvedIde,
      installed_at: new Date().toISOString(),
    };
    writeFileSync(
      resolve(targets.shared.specky, "install.json"),
      JSON.stringify(meta, null, 2) + "\n",
      "utf8",
    );
  }

  console.log("");
  console.log("[specky init] ✅ Done. Next steps:");
  console.log("  • In Claude Code or VS Code: restart the session to activate MCP + hooks");
  console.log("  • Start the pipeline: invoke @specky-onboarding (Copilot) or /specky-onboarding (Claude)");
  console.log("  • Run `npx specky doctor` anytime to validate install integrity");

  return 0;
}
