/**
 * doctor.ts — `specky doctor` — validate install integrity + config health.
 *
 * Validates:
 *  - install.lock SHA256 matches every file on disk
 *  - .claude/settings.json has required permissions.allow entries
 *  - .vscode/settings.json has Copilot MCP discovery enabled
 *  - .mcp.json / .vscode/mcp.json register the specky server
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { hashFile } from "../lib/asset-copier.js";
import { targetPaths, type Targets } from "../lib/paths.js";
import { SPECKY_REQUIRED_ALLOWS } from "../lib/settings-merger.js";
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

function checkClaudePermissions(targets: Targets): Check {
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
  const allow = new Set(settings.permissions?.allow ?? []);
  const missing = SPECKY_REQUIRED_ALLOWS.filter((a) => !allow.has(a));
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

function checkMcpRegistration(path: string, label: string): Check {
  const cfg = readJsonSafe<{
    mcpServers?: Record<string, unknown>;
    servers?: Record<string, unknown>;
  }>(path);
  if (!cfg) return { name: label, pass: false, detail: "file missing" };
  const hasServer =
    Boolean(cfg.mcpServers?.["specky"]) || Boolean(cfg.servers?.["specky"]);
  return {
    name: label,
    pass: hasServer,
    detail: hasServer ? "specky server registered" : "specky entry missing",
  };
}

function runConfigChecks(targets: Targets, workspace: string): Check[] {
  return [
    checkClaudePermissions(targets),
    checkMcpRegistration(targets.shared.claudeMcp, ".mcp.json"),
    checkMcpRegistration(targets.shared.vscodeMcp, ".vscode/mcp.json"),
    checkVscodeSettings(workspace),
  ];
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

  console.log(`[specky doctor] Workspace: ${workspace}`);

  if (!existsSync(lockPath)) {
    console.error(`[specky doctor] ❌ No install.lock at ${lockPath}`);
    console.error(`[specky doctor]    Run \`npx specky init\` to bootstrap.`);
    return 2;
  }

  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as InstallLock;
  console.log(
    `[specky doctor] Lock version: ${lock.version} (generated ${lock.generated_at})`,
  );
  console.log(`[specky doctor] Files tracked: ${Object.keys(lock.files).length}`);

  const integrity = verifyIntegrity(lock, targets.shared.specky);
  printIntegrity(integrity, opts.verbose);

  const checks = runConfigChecks(targets, workspace);
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
      ide: "auto",
      workspace,
    });
  }

  console.log(
    "[specky doctor] ⚠️  Repair: `npx specky init --force` or `npx specky doctor --fix`",
  );
  return 1;
}
