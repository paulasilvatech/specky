/**
 * doctor.ts — `specky doctor` — validate install integrity + config health.
 *
 * Validates:
 *  - install.lock SHA256 matches every file on disk
 *  - .claude/settings.json has required permissions.allow entries
 *  - .vscode/settings.json has Copilot MCP discovery enabled
 *  - .mcp.json / .vscode/mcp.json register the specky server
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../../constants.js";
import { hashFile } from "../lib/asset-copier.js";
import { detectIde } from "../lib/ide-detect.js";
import type { HarnessTarget } from "../lib/harness/index.js";
import type { AgentCapability } from "../lib/harness/types.js";
import { targetPaths, type Targets } from "../lib/paths.js";
import {
  requiredClaudeAllows,
  SPECKY_REQUIRED_ALLOWS,
  type PermissionProfile,
} from "../lib/settings-merger.js";
import { SPECKY_VSCODE_SETTINGS } from "../lib/vscode-settings-writer.js";

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

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

type InstalledIde = "claude" | "copilot" | "both" | "auto";

interface InstallMeta {
  version: string;
  ide?: InstalledIde;
  targets?: HarnessTarget[];
  capabilities?: AgentCapability[];
  integrations?: string[];
  permission_profile?: PermissionProfile;
  installed_at: string;
}

interface TargetResolution {
  targets: HarnessTarget[];
  source: "install.json" | "workspace-signals" | "default";
  detail: string;
}

interface IntegrityReport {
  missing: string[];
  modified: string[];
  ok: string[];
}

function verifyIntegrity(
  lock: InstallLock,
  speckyRoot: string,
): IntegrityReport {
  const missing: string[] = [];
  const modified: string[] = [];
  const ok: string[] = [];

  for (const [rel, expected] of Object.entries(lock.files)) {
    const abs = resolve(speckyRoot, rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    try {
      if (!statSync(abs).isFile()) continue;
      const actual = hashFile(abs);
      if (actual === expected) ok.push(rel);
      else modified.push(rel);
    } catch {
      missing.push(rel);
    }
  }
  return { missing, modified, ok };
}

function readJsonSafe<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function checkClaudePermissions(
  targets: Targets,
  workspace: string,
  installMeta: InstallMeta | null,
): Check {
  const settings = readJsonSafe<{ permissions?: { allow?: string[] } }>(
    targets.claude.settingsJson,
  );
  if (!settings) {
    return {
      name: "Claude permissions",
      pass: false,
      detail: "settings.json missing or unreadable",
    };
  }
  const profile = installMeta?.permission_profile ?? "scoped";
  if (profile === "prompt") {
    return {
      name: "Claude permissions",
      pass: true,
      detail: "prompt profile: Claude Code manages confirmation for every action",
    };
  }
  const requiredAllows = installMeta?.capabilities
    ? requiredClaudeAllows(installMeta.capabilities, {
      profile,
      workspace,
      integrations: installMeta.integrations,
    })
    : SPECKY_REQUIRED_ALLOWS;
  const allow = new Set(settings.permissions?.allow ?? []);
  const missing = requiredAllows.filter((a) => !allow.has(a));
  return {
    name: "Claude permissions",
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `${allow.size} allow rules, all required present`
        : `missing ${missing.length}: ${missing.slice(0, 3).join(", ")}…`,
  };
}

function checkVscodeSettings(workspace: string): Check {
  const path = resolve(workspace, ".vscode/settings.json");
  const settings = readJsonSafe<Record<string, unknown>>(path);
  if (!settings) {
    return {
      name: "VS Code settings",
      pass: false,
      detail: "settings.json missing — Copilot tools may not auto-discover MCP",
    };
  }
  const missing = Object.keys(SPECKY_VSCODE_SETTINGS).filter(
    (k) => !(k in settings),
  );
  return {
    name: "VS Code settings",
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? "chat.mcp + agent settings present"
        : `missing keys: ${missing.join(", ")}`,
  };
}

function checkMcpRegistration(
  path: string,
  label: string,
  serverName: "specky" | "github" = "specky",
): Check {
  const cfg = readJsonSafe<{
    mcpServers?: Record<string, unknown>;
    servers?: Record<string, unknown>;
    mcp?: Record<string, unknown>;
  }>(path);
  if (!cfg) return { name: label, pass: false, detail: "file missing" };
  const hasServer =
    Boolean(cfg.mcpServers?.[serverName]) ||
    Boolean(cfg.servers?.[serverName]) ||
    Boolean(cfg.mcp?.[serverName]);
  let detail = `${serverName} entry missing`;
  if (hasServer) {
    detail = serverName === "github"
      ? "GitHub MCP registered; authentication is managed by the target runtime"
      : "specky server registered";
  }
  return {
    name: label,
    pass: hasServer,
    detail,
  };
}

function githubIntegrationCheck(
  path: string,
  installMeta: InstallMeta | null,
  label: string,
): Check[] {
  return installMeta?.integrations?.includes("github")
    ? [checkMcpRegistration(path, label, "github")]
    : [];
}

function checkFileExists(path: string, label: string): Check {
  return {
    name: label,
    pass: existsSync(path),
    detail: existsSync(path) ? "present" : "missing",
  };
}

function countEntries(dir: string, predicate: (name: string, path: string) => boolean): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((name) => predicate(name, resolve(dir, name))).length;
  } catch {
    return 0;
  }
}

function checkFileCount(
  dir: string,
  minCount: number,
  label: string,
  predicate: (name: string, path: string) => boolean = (name) => name.length > 0,
): Check {
  const count = countEntries(dir, predicate);
  return {
    name: label,
    pass: count >= minCount,
    detail: `${count}/${minCount} present`,
  };
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) files.push(...walkFiles(path));
    else if (st.isFile()) files.push(path);
  }
  return files;
}

function checkCursorRule(targets: Targets): Check {
  const path = resolve(targets.cursor.rules, "specky-sdd.mdc");
  if (!existsSync(path)) {
    return { name: "Cursor rule", pass: false, detail: "specky-sdd.mdc missing" };
  }
  const text = readFileSync(path, "utf8");
  const ruleLines = text.trimEnd().split(/\r?\n/);
  const hasDescription = ruleLines.some((line) => line.startsWith("description:") && line.trim() !== "description:");
  const hasAlwaysApply = ruleLines.some((line) => line.trim() === "alwaysApply: true");
  const hasSpeckyTitle = text.includes("Specky SDD");
  const noWorkspaceLeak = !text.includes("@workspace");
  const ok = hasDescription && hasAlwaysApply && hasSpeckyTitle && noWorkspaceLeak;
  const details = [
    hasDescription ? "description" : "missing description",
    hasAlwaysApply ? "alwaysApply" : "missing alwaysApply",
    hasSpeckyTitle ? "specky-sdd" : "missing title",
    noWorkspaceLeak ? "no @workspace" : "has @workspace leak",
  ];
  return { name: "Cursor rule", pass: ok, detail: details.join(", ") };
}

function checkNoCopilotLeak(root: string, workspace: string, label: string): Check {
  const needles = ["applyTo", "@workspace", ".vscode/mcp.json", "Copilot Instructions"];
  const hits: string[] = [];
  for (const file of walkFiles(root)) {
    const text = readFileSync(file, "utf8");
    if (needles.some((needle) => text.includes(needle))) {
      hits.push(file.replace(workspace + "/", ""));
    }
  }
  return {
    name: label,
    pass: hits.length === 0,
    detail: hits.length === 0 ? "no Copilot/.vscode tokens" : hits.slice(0, 3).join(", "),
  };
}

function checkCopilotHooksManifest(targets: Targets): Check {
  const manifest = readJsonSafe<Record<string, unknown>>(targets.copilot.hooksManifest);
  if (!manifest) {
    return { name: "Copilot hooks manifest", pass: false, detail: "sdd-hooks.json missing" };
  }
  const serialized = JSON.stringify(manifest);
  const hasSddMatcher = serialized.includes("sdd_");
  return {
    name: "Copilot hooks manifest",
    pass: hasSddMatcher,
    detail: hasSddMatcher ? "sdd-hooks.json with sdd_* matchers" : "no sdd_* matchers in manifest",
  };
}

function checkClaudeHooksInSettings(targets: Targets, installTargets: HarnessTarget[]): Check {
  if (installTargets.includes("copilot")) {
    return {
      name: "Claude hooks in settings",
      pass: true,
      detail: "intentionally omitted (Copilot co-install strips .claude hooks)",
    };
  }

  const settings = readJsonSafe<{ hooks?: Record<string, unknown> }>(targets.claude.settingsJson);
  if (!settings?.hooks) {
    return { name: "Claude hooks in settings", pass: false, detail: "no hooks key in .claude/settings.json" };
  }
  const serialized = JSON.stringify(settings.hooks);
  const hasSpecky = serialized.includes("specky");
  const hasLifecycle = serialized.includes("PreToolUse") || serialized.includes("preToolUse");
  return {
    name: "Claude hooks in settings",
    pass: hasSpecky && hasLifecycle,
    detail: hasSpecky && hasLifecycle ? "Specky hooks registered" : "Specky hooks missing from settings",
  };
}

function checkAgentsMd(workspace: string): Check {
  const path = resolve(workspace, "AGENTS.md");
  if (!existsSync(path)) {
    return {
      name: "AGENTS.md context",
      pass: true,
      detail: "recommended: run specky compile --target=opencode",
    };
  }
  const text = readFileSync(path, "utf8");
  const ok = text.includes("Specky SDD");
  return {
    name: "AGENTS.md context",
    pass: ok,
    detail: ok ? "contains Specky SDD guidance" : "missing Specky SDD section",
  };
}

function detectWorkspaceHarnessTargets(workspace: string): HarnessTarget[] {
  const found: HarnessTarget[] = [];
  if (existsSync(resolve(workspace, ".cursor/mcp.json")) || existsSync(resolve(workspace, ".cursor/rules"))) {
    found.push("cursor");
  }
  if (existsSync(resolve(workspace, "opencode.json"))) {
    found.push("opencode");
  }
  if (existsSync(resolve(workspace, ".agents/skills"))) {
    const skills = readdirSync(resolve(workspace, ".agents/skills"));
    if (skills.some((name) => name.startsWith("specky-"))) {
      found.push("agent-skills");
    }
  }
  const detected = detectIde(workspace);
  if (detected.claudeCode) found.push("claude");
  if (detected.copilot) found.push("copilot");
  return [...new Set(found)];
}

function checkCursorHooksManifest(targets: Targets): Check {
  const manifest = readJsonSafe<{ version?: number; hooks?: Record<string, unknown[]> }>(targets.cursor.hooksManifest);
  if (!manifest) {
    return { name: "Cursor hooks.json", pass: false, detail: "missing or unreadable" };
  }
  const hasMcpHooks = Boolean(manifest.hooks?.beforeMCPExecution?.length) && Boolean(manifest.hooks?.afterMCPExecution?.length);
  return {
    name: "Cursor hooks.json",
    pass: manifest.version === 1 && hasMcpHooks,
    detail: manifest.version === 1 && hasMcpHooks ? "version 1 with MCP hooks" : "missing version 1 or MCP hooks",
  };
}

function checkCursorInstall(targets: Targets, workspace: string, installMeta: InstallMeta | null): Check[] {
  return [
    checkMcpRegistration(targets.cursor.mcp, ".cursor/mcp.json"),
    ...githubIntegrationCheck(targets.cursor.mcp, installMeta, "Cursor GitHub MCP"),
    checkFileCount(targets.cursor.agents, 13, "Cursor agents", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.cursor.commands, 22, "Cursor commands", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.shared.agentSkills, 14, "Cursor skills", (name, path) => name.startsWith("specky-") && statSync(path).isDirectory()),
    checkCursorRule(targets),
    checkNoCopilotLeak(targets.cursor.root, workspace, "Cursor leakage"),
    checkCursorHooksManifest(targets),
    checkFileCount(targets.cursor.hooksScripts, 16, "Cursor hook scripts", (name) => name.endsWith(".sh") || name.endsWith(".mjs")),
    checkFileExists(targets.cursor.hooksRunner, "Cursor hook runner"),
  ];
}

function checkCopilotInstall(targets: Targets, workspace: string, installMeta: InstallMeta | null): Check[] {
  return [
    checkMcpRegistration(targets.shared.vscodeMcp, ".vscode/mcp.json"),
    ...githubIntegrationCheck(targets.shared.vscodeMcp, installMeta, "Copilot GitHub MCP"),
    checkVscodeSettings(workspace),
    checkFileCount(targets.copilot.agents, 13, "Copilot agents", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.copilot.prompts, 22, "Copilot prompts", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.copilot.skills, 14, "Copilot skills", (name, path) => name.startsWith("specky-") && statSync(path).isDirectory()),
    checkFileExists(resolve(targets.copilot.instructions, "copilot-instructions.instructions.md"), "Copilot instruction"),
    checkFileCount(targets.copilot.hooksScripts, 16, "Copilot hook scripts", (name) => name.endsWith(".sh") || name.endsWith(".mjs")),
    checkCopilotHooksManifest(targets),
  ];
}

function checkClaudeInstall(
  targets: Targets,
  workspace: string,
  installTargets: HarnessTarget[],
  installMeta: InstallMeta | null,
): Check[] {
  return [
    checkMcpRegistration(targets.shared.claudeMcp, ".mcp.json"),
    ...githubIntegrationCheck(targets.shared.claudeMcp, installMeta, "Claude GitHub MCP"),
    checkClaudePermissions(targets, workspace, installMeta),
    checkFileCount(targets.claude.agents, 13, "Claude agents", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.claude.commands, 22, "Claude commands", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.claude.skills, 14, "Claude skills", (name, path) => name.startsWith("specky-") && statSync(path).isDirectory()),
    checkFileExists(resolve(targets.claude.rules, "specky-sdd.md"), "Claude rule"),
    checkNoCopilotLeak(targets.claude.root, workspace, "Claude leakage"),
    checkFileCount(targets.claude.hooksScripts, 16, "Claude hook scripts", (name) => name.endsWith(".sh") || name.endsWith(".mjs")),
    checkClaudeHooksInSettings(targets, installTargets),
  ];
}

function checkOpenCodeInstall(targets: Targets, workspace: string, installMeta: InstallMeta | null): Check[] {
  return [
    checkMcpRegistration(targets.opencode.mcp, "opencode.json"),
    ...githubIntegrationCheck(targets.opencode.mcp, installMeta, "OpenCode GitHub MCP"),
    checkFileCount(targets.opencode.agents, 13, "OpenCode agents", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.opencode.commands, 22, "OpenCode commands", (name) => name.startsWith("specky-") && name.endsWith(".md")),
    checkFileCount(targets.shared.agentSkills, 14, "OpenCode skills", (name, path) => name.startsWith("specky-") && statSync(path).isDirectory()),
    checkNoCopilotLeak(targets.opencode.root, workspace, "OpenCode leakage"),
    checkAgentsMd(workspace),
  ];
}

function loadInstallMeta(path: string): InstallMeta | null {
  return readJsonSafe<InstallMeta>(path);
}

function targetsFromIde(ide: InstalledIde): HarnessTarget[] {
  if (ide === "claude") return ["claude"];
  if (ide === "copilot") return ["copilot"];
  return ["claude", "copilot"];
}

function resolveInstalledTargets(
  installMeta: InstallMeta | null,
  workspace: string,
): TargetResolution {
  if (Array.isArray(installMeta?.targets) && installMeta.targets.length > 0) {
    return {
      targets: installMeta.targets,
      source: "install.json",
      detail: "recorded as targets in .specky/install.json",
    };
  }

  if (installMeta?.ide) {
    return {
      targets: targetsFromIde(installMeta.ide),
      source: "install.json",
      detail: `recorded as legacy ide=${installMeta.ide} in .specky/install.json`,
    };
  }

  const detected = detectIde(workspace);
  const harnessTargets = detectWorkspaceHarnessTargets(workspace);
  if (harnessTargets.length > 0) {
    return {
      targets: harnessTargets,
      source: "workspace-signals",
      detail: `inferred from workspace signals: ${detected.signals.join(", ") || harnessTargets.join(", ")}`,
    };
  }

  return {
    targets: [],
    source: "default",
    detail: "no install metadata or IDE signals found; run specky install --target=<harness>",
  };
}

function runConfigChecks(
  targets: Targets,
  workspace: string,
  installTargets: HarnessTarget[],
  installMeta: InstallMeta | null,
): Check[] {
  const checks: Check[] = [];

  if (installTargets.includes("claude")) {
    checks.push(...checkClaudeInstall(targets, workspace, installTargets, installMeta));
  }

  if (installTargets.includes("copilot")) {
    checks.push(...checkCopilotInstall(targets, workspace, installMeta));
  }

  if (installTargets.includes("cursor")) {
    checks.push(...checkCursorInstall(targets, workspace, installMeta));
  }

  if (installTargets.includes("opencode")) {
    checks.push(...checkOpenCodeInstall(targets, workspace, installMeta));
  }

  if (installTargets.includes("agent-skills")) {
    checks.push(
      checkFileCount(
        targets.shared.agentSkills,
        14,
        "Agent skills bundle",
        (name, path) => name.startsWith("specky-") && statSync(path).isDirectory(),
      ),
    );
  }

  return checks;
}

function printIntegrity(report: IntegrityReport, verbose: boolean): void {
  console.log("");
  console.log(`  ✅ OK:       ${report.ok.length}`);
  console.log(`  ✏️  Modified: ${report.modified.length}`);
  console.log(`  ❌ Missing:  ${report.missing.length}`);

  const hasDrift = report.missing.length > 0 || report.modified.length > 0;
  if (verbose || hasDrift) {
    if (report.missing.length) {
      console.log("");
      console.log("Missing files:");
      for (const m of report.missing) console.log(`  - ${m}`);
    }
    if (report.modified.length) {
      console.log("");
      console.log("Modified files (local edits detected):");
      for (const m of report.modified) console.log(`  - ${m}`);
    }
  }
}

function printChecks(checks: Check[]): void {
  console.log("");
  console.log("Configuration checks:");
  for (const c of checks) {
    const icon = c.pass ? "✅" : "⚠️ ";
    console.log(`  ${icon} ${c.name.padEnd(22)} ${c.detail ?? ""}`);
  }
}

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const targets = targetPaths(workspace);
  const lockPath = resolve(targets.shared.specky, "install.lock");
  const installJsonPath = resolve(targets.shared.specky, "install.json");

  console.log(`[specky doctor] Workspace: ${workspace}`);

  if (!existsSync(lockPath)) {
    console.error(`[specky doctor] ❌ No install.lock at ${lockPath}`);
    console.error(`[specky doctor]    Run \`npx specky init\` to bootstrap.`);
    return 2;
  }

  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as InstallLock;
  const installMeta = loadInstallMeta(installJsonPath);
  const resolvedTargets = resolveInstalledTargets(installMeta, workspace);
  console.log(
    `[specky doctor] Lock version: ${lock.version} (generated ${lock.generated_at})`,
  );
  console.log(`[specky doctor] Files tracked: ${Object.keys(lock.files).length}`);
  console.log(
    `[specky doctor] Target scope: ${resolvedTargets.targets.join(", ")} (${resolvedTargets.detail})`,
  );

  // Version-drift advisory (zero network): installed assets vs running CLI.
  if (installMeta?.version && installMeta.version !== VERSION) {
    console.log(
      `[specky doctor] ⚠️  Version drift: installed assets are v${installMeta.version} but this CLI is v${VERSION} — run \`specky upgrade\` to refresh.`,
    );
  }

  const integrity = verifyIntegrity(lock, targets.shared.specky);
  printIntegrity(integrity, opts.verbose);

  const checks = runConfigChecks(
    targets,
    workspace,
    resolvedTargets.targets,
    installMeta,
  );
  printChecks(checks);

  const integrityOk =
    integrity.missing.length === 0 && integrity.modified.length === 0;
  const configOk = checks.every((c) => c.pass);

  if (integrityOk && configOk) {
    console.log("");
    console.log("[specky doctor] ✅ Install is healthy.");
    return 0;
  }

  console.log("");
  if (opts.fix) {
    console.log(
      "[specky doctor] --fix requested — re-running init with --force to restore.",
    );
    const init = await import("./init.js");
    return init.runInit({
      force: true,
      dryRun: false,
      target: resolvedTargets.targets.join(","),
      workspace,
    });
  }

  console.log(
    "[specky doctor] ⚠️  Repair: `npx specky init --force` or `npx specky doctor --fix`",
  );
  return 1;
}
