/**
 * init.ts — `specky init` — install Specky assets into the current workspace.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../../constants.js";
import {
  copyToAgentSkills,
  copyToClaude,
  copyToCopilot,
  copyToCursor,
  copyToOpenCode,
  summarizeCopy,
  writeInstallLock,
  type CopyResult,
} from "../lib/asset-copier.js";
import { detectIde, type IdeTarget } from "../lib/ide-detect.js";
import { SUPPORTED_TARGETS, type HarnessTarget } from "../lib/harness/index.js";
import { packageRoot, sourcePaths, targetPaths, type Targets } from "../lib/paths.js";
import { loadClaudeHooksManifest, mergeClaudeHooks } from "../lib/settings-merger.js";
import { writeMcpRegistration } from "../lib/mcp-writer.js";
import { writeCursorPluginManifest } from "../lib/cursor-plugin-writer.js";
import { writeVscodeSettings } from "../lib/vscode-settings-writer.js";
import { writeGitignoreBlock } from "../lib/gitignore-writer.js";

export interface InitOptions {
  ide?: IdeTarget | "auto";
  target?: string;
  force: boolean;
  dryRun: boolean;
  workspace?: string;
}

interface Ctx {
  workspace: string;
  pkg: string;
  targets: Targets;
  src: ReturnType<typeof sourcePaths>;
  copyOpts: { force: boolean; dryRun: boolean };
  dryRun: boolean;
}

const TARGET_ALIASES: Record<string, HarnessTarget | "both" | "all" | "auto"> = {
  "github-copilot": "copilot",
  vscode: "copilot",
  "claude-code": "claude",
  both: "both",
  all: "all",
  auto: "auto",
};

function uniqueTargets(targets: HarnessTarget[]): HarnessTarget[] {
  return [...new Set(targets)];
}

function targetsFromLegacyIde(ide: IdeTarget | "auto", detected: ReturnType<typeof detectIde>): HarnessTarget[] {
  const resolved = ide === "auto" ? detected.recommendation : ide;
  if (resolved === "both") return ["claude", "copilot"];
  return [resolved];
}

function parseTargetToken(token: string, detected: ReturnType<typeof detectIde>): HarnessTarget[] {
  const normalized = token.trim().toLowerCase();
  const aliased = TARGET_ALIASES[normalized] ?? normalized;
  if (aliased === "auto") return targetsFromLegacyIde("auto", detected);
  if (aliased === "both") return ["claude", "copilot"];
  if (aliased === "all") return SUPPORTED_TARGETS.filter((target) => target !== "agent-skills");
  if (SUPPORTED_TARGETS.includes(aliased as HarnessTarget)) return [aliased as HarnessTarget];
  throw new Error(
    `[specky init] Unknown target "${token}". Supported targets: ${SUPPORTED_TARGETS.join(", ")}, both, all`,
  );
}

function resolveInstallTargets(opts: InitOptions, detected: ReturnType<typeof detectIde>): HarnessTarget[] {
  if (opts.target) {
    return uniqueTargets(
      opts.target
        .split(",")
        .flatMap((token) => parseTargetToken(token, detected)),
    );
  }
  return targetsFromLegacyIde(opts.ide ?? "auto", detected);
}

function legacyIdeFromTargets(targets: HarnessTarget[]): IdeTarget | "auto" {
  const set = new Set(targets);
  if (set.size === 1 && set.has("claude")) return "claude";
  if (set.size === 1 && set.has("copilot")) return "copilot";
  if (set.size === 2 && set.has("claude") && set.has("copilot")) return "both";
  return "auto";
}

function installClaude(ctx: Ctx): CopyResult {
  console.log("[specky init] Installing to .claude/ …");
  const r = copyToClaude(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".claude", r));

  try {
    const hooks = loadClaudeHooksManifest(ctx.src.claudeHooksManifest);
    const merge = mergeClaudeHooks(ctx.targets, hooks, { dryRun: ctx.dryRun });
    console.log(`  settings.json: ${merge.written ? "merged" : "dry-run"} at ${merge.path}`);
    if (merge.addedPermissions > 0) {
      console.log(`  permissions:   ${merge.addedPermissions} allow rules added (specky MCP + native tools)`);
    }
  } catch (err) {
    console.warn(`  ⚠️  ${(err as Error).message}`);
  }

  const mcp = writeMcpRegistration(ctx.targets.shared.claudeMcp, {
    dryRun: ctx.dryRun,
    serverName: "specky",
    useVscodeSchema: false,
  });
  console.log(`  .mcp.json: ${mcp.action}`);
  console.log("");
  return r;
}

function installCopilot(ctx: Ctx): CopyResult {
  console.log("[specky init] Installing to .github/ …");
  const r = copyToCopilot(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".github", r));

  const mcp = writeMcpRegistration(ctx.targets.shared.vscodeMcp, {
    dryRun: ctx.dryRun,
    serverName: "specky",
    useVscodeSchema: true,
  });
  console.log(`  .vscode/mcp.json: ${mcp.action}`);

  const vscodeSettingsPath = resolve(ctx.workspace, ".vscode/settings.json");
  const vs = writeVscodeSettings(vscodeSettingsPath, { dryRun: ctx.dryRun });
  if (vs.addedKeys.length > 0) {
    console.log(`  .vscode/settings.json: +${vs.addedKeys.length} key(s) (${vs.addedKeys.join(", ")})`);
  } else {
    console.log(`  .vscode/settings.json: already configured`);
  }
  console.log("");
  return r;
}

function installCursor(ctx: Ctx): CopyResult {
  console.log("[specky init] Installing to .cursor/ …");
  const r = copyToCursor(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".cursor", r));

  const mcp = writeMcpRegistration(ctx.targets.cursor.mcp, {
    dryRun: ctx.dryRun,
    serverName: "specky",
  });
  console.log(`  .cursor/mcp.json: ${mcp.action}`);

  const plugin = writeCursorPluginManifest(ctx.workspace, ctx.pkg, { dryRun: ctx.dryRun });
  console.log(`  .cursor-plugin/plugin.json: ${plugin.action}`);

  console.log(`  .cursor/hooks.json: ${existsSync(ctx.targets.cursor.hooksManifest) ? "installed" : "skipped"}`);
  console.log("");
  return r;
}

function installOpenCode(ctx: Ctx): CopyResult {
  console.log("[specky init] Installing to .opencode/ …");
  const r = copyToOpenCode(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".opencode", r));

  const mcp = writeMcpRegistration(ctx.targets.opencode.mcp, {
    dryRun: ctx.dryRun,
    serverName: "specky",
    useOpenCodeSchema: true,
  });
  console.log(`  opencode.json: ${mcp.action}`);
  console.log("  hooks: skipped (OpenCode has no hooks concept)");
  console.log("");
  return r;
}

function installAgentSkills(ctx: Ctx): CopyResult {
  console.log("[specky init] Installing to .agents/skills/ …");
  const r = copyToAgentSkills(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".agents/skills", r));
  console.log("");
  return r;
}

function writeSpeckyMeta(ctx: Ctx, resolvedIde: IdeTarget | "auto", resolvedTargets: HarnessTarget[]): void {
  if (ctx.dryRun) return;
  mkdirSync(ctx.targets.shared.specky, { recursive: true });

  const configDest = resolve(ctx.targets.shared.specky, "config.yml");
  if (!existsSync(configDest) && existsSync(ctx.src.configYml)) {
    copyFileSync(ctx.src.configYml, configDest);
    console.log(`[specky init] Wrote ${configDest}`);
  }

  const meta = {
    version: VERSION,
    ide: resolvedIde,
    targets: resolvedTargets,
    installed_at: new Date().toISOString(),
  };
  writeFileSync(
    resolve(ctx.targets.shared.specky, "install.json"),
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );
}

function formatGitignoreAction(action: "created" | "updated" | "already-present"): string {
  if (action === "created") return "created";
  if (action === "updated") return "updated";
  return "already present";
}

function ensureGitignore(ctx: Ctx): void {
  // Add/refresh the Specky-managed block in .gitignore so vendored assets
  // (agents, prompts, skills, hooks regenerated by `specky install`) aren't
  // committed. Idempotent — safe to call on every install/upgrade.
  const r = writeGitignoreBlock(ctx.workspace, { dryRun: ctx.dryRun });
  const verb = formatGitignoreAction(r.action);
  const suffix = r.linesAdded > 0 ? `+${r.linesAdded} lines` : "no changes";
  console.log(`[specky init] .gitignore: ${verb} (${suffix})`);
}

function printHeader(opts: InitOptions, workspace: string, resolvedTargets: HarnessTarget[], resolvedIde: IdeTarget | "auto", detected: ReturnType<typeof detectIde>): void {
  const autoNote = !opts.target && (opts.ide === "auto" || !opts.ide) ? " (auto-detected)" : "";
  console.log(`[specky init] Version ${VERSION}`);
  console.log(`[specky init] Workspace: ${workspace}`);
  console.log(`[specky init] Target(s): ${resolvedTargets.join(", ")}${autoNote}`);
  if (opts.ide && opts.ide !== "auto") {
    console.log(`[specky init] --ide is deprecated; prefer --target=${resolvedTargets.join(",")}`);
  }
  if (resolvedIde !== "auto") console.log(`[specky init] Legacy IDE metadata: ${resolvedIde}`);
  if (detected.signals.length) {
    console.log(`[specky init] Detected signals: ${detected.signals.join(", ")}`);
  }
  if (opts.dryRun) console.log(`[specky init] DRY RUN — no files will be written`);
  console.log("");
}

function printFooter(resolvedTargets: HarnessTarget[]): void {
  console.log("");
  console.log("[specky init] ✅ Done. Next steps:");
  console.log("  • Restart or reload your target IDE session to activate MCP + hooks");
  if (resolvedTargets.includes("cursor")) {
    console.log("  • Cursor: confirm the specky MCP server is enabled in Settings → MCP");
  }
  console.log("  • Start the pipeline: invoke @specky-onboarding or /specky-onboarding");
  console.log("  • Run `npx specky doctor` anytime to validate install integrity");
}

export async function runInit(opts: InitOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const pkg = packageRoot();
  const ctx: Ctx = {
    workspace,
    pkg,
    targets: targetPaths(workspace),
    src: sourcePaths(pkg),
    copyOpts: { force: opts.force, dryRun: opts.dryRun },
    dryRun: opts.dryRun,
  };

  const detected = detectIde(workspace);
  const resolvedTargets = resolveInstallTargets(opts, detected);
  const resolvedIde = legacyIdeFromTargets(resolvedTargets);

  printHeader(opts, workspace, resolvedTargets, resolvedIde, detected);

  const results: CopyResult[] = [];
  if (resolvedTargets.includes("claude")) {
    results.push(installClaude(ctx));
  }
  if (resolvedTargets.includes("copilot")) {
    results.push(installCopilot(ctx));
  }
  if (resolvedTargets.includes("cursor")) {
    results.push(installCursor(ctx));
  }
  if (resolvedTargets.includes("opencode")) {
    results.push(installOpenCode(ctx));
  }
  if (resolvedTargets.includes("agent-skills")) {
    results.push(installAgentSkills(ctx));
  }

  // rc.14+: When Copilot is installed in this workspace, strip hooks from
  // .claude/settings.json to prevent Copilot from cross-reading Claude Code
  // lifecycle hooks. Users that need Claude hooks should run a Claude-only
  // install in a separate workspace.
  if (resolvedTargets.includes("copilot") && !ctx.dryRun) {
    const claudeSettings = ctx.targets.claude.settingsJson;
    if (existsSync(claudeSettings)) {
      try {
        const raw = readFileSync(claudeSettings, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.hooks) {
          delete parsed.hooks;
          writeFileSync(claudeSettings, JSON.stringify(parsed, null, 2) + "\n", "utf8");
          console.log("  .claude/settings.json: stripped hooks (Copilot cross-read fix)");
        }
      } catch {
        // ignore — user may have non-JSON content
      }
    }
  }

  writeSpeckyMeta(ctx, resolvedIde, resolvedTargets);
  ensureGitignore(ctx);

  const lockPath = writeInstallLock(ctx.targets, results, VERSION, ctx.copyOpts);
  console.log(`[specky init] Integrity manifest: ${lockPath}`);

  printFooter(resolvedTargets);
  return 0;
}
