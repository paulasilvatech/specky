/**
 * status.ts — `specky status` — show pipeline state and install summary.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { VERSION } from "../../constants.js";
import { targetPaths } from "../lib/paths.js";
import { loadConfig } from "../../config.js";
import type { SpeckyConfig } from "../../config.js";
import { FileManager } from "../../services/file-manager.js";
import { StateMachine, StateMigrationRequiredError } from "../../services/state-machine.js";

export interface StatusOptions {
  workspace?: string;
}

interface InstallStatusMeta {
  version?: string;
  ide?: string;
  installed_at?: string;
}

function printInstallStatus(installJson: string): void {
  let meta: InstallStatusMeta | null = null;
  if (existsSync(installJson)) {
    try {
      meta = JSON.parse(readFileSync(installJson, "utf8")) as InstallStatusMeta;
    } catch {
      meta = null;
    }
  }
  if (meta) {
    console.log(`Install: v${meta.version}, ide=${meta.ide}, at=${meta.installed_at}`);
    if (meta.version && meta.version !== VERSION) {
      console.log(`⚠️  Installed assets are v${meta.version} but this CLI is v${VERSION} — run \`specky upgrade\` to refresh.`);
    }
  } else if (existsSync(installJson)) {
    console.log("Install: metadata unreadable — run `npx specky doctor`");
  } else {
    console.log("Install: NOT DETECTED — run `npx specky init`");
  }
}

function printIdeStatus(workspace: string, targets: ReturnType<typeof targetPaths>): void {
  console.log("");
  console.log("IDE targets:");
  if (existsSync(targets.claude.root)) {
    console.log(
      `  .claude/      agents=${safeCount(targets.claude.agents)}, commands=${safeCount(targets.claude.commands)}, ` +
      `skills=${safeCountDirs(targets.claude.skills)}, hooks=${safeCount(targets.claude.hooksScripts)}`,
    );
  }
  if (existsSync(resolve(workspace, ".github/agents")) || existsSync(resolve(workspace, ".github/prompts"))) {
    console.log(
      `  .github/      agents=${safeCount(targets.copilot.agents)}, prompts=${safeCount(targets.copilot.prompts)}, ` +
      `skills=${safeCountDirs(targets.copilot.skills)}, hooks=${safeCount(targets.copilot.hooksScripts)}`,
    );
  }
}

async function printPipelineStatus(workspace: string, config: SpeckyConfig): Promise<void> {
  console.log("");
  console.log("Pipeline:");
  const specsRoot = resolve(workspace, config.spec_root);
  if (!existsSync(specsRoot)) {
    console.log(`  No ${config.spec_root}/ directory — no active pipeline.`);
    console.log("  Start: invoke @specky-onboarding (Copilot) or /specky-onboarding (Claude)");
    return;
  }
  if (existsSync(resolve(specsRoot, ".sdd-state.json"))) {
    console.log("  Legacy root state detected.");
    console.log(`  Run: specky migrate-contracts --spec-dir=${config.spec_root} --dry-run ...`);
  }

  const features = readdirSync(specsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (features.length === 0) {
    console.log(`  ${config.spec_root}/ exists but has no feature directories.`);
    return;
  }

  const stateMachine = new StateMachine(new FileManager(workspace), workspace);
  for (const feature of features) {
    await printFeatureStatus(stateMachine, config.spec_root, feature);
  }
}

async function printFeatureStatus(
  stateMachine: StateMachine,
  specRoot: string,
  feature: string,
): Promise<void> {
  try {
    const state = await stateMachine.loadState(join(specRoot, feature));
    const completed = state.contract.phases.filter(
      (phase) => state.phases[phase]?.status === "completed",
    ).length;
    const gate = state.gate_decision ? ` gate=${state.gate_decision.decision}` : "";
    console.log(
      `  ${feature}: phase=${state.current_phase} (${completed}/${state.contract.phases.length})` +
      ` contract=${state.contract.id}@${state.contract.version}${gate}`,
    );
  } catch (error) {
    const label = error instanceof StateMigrationRequiredError ? "migration required" : "invalid state";
    console.log(`  ${feature}: ${label} — ${(error as Error).message}`);
  }
}

export async function runStatus(opts: StatusOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const t = targetPaths(workspace);
  let config;
  try {
    config = loadConfig(workspace, { argv: [], env: {} });
  } catch (error) {
    console.error(`Workspace config: INVALID — ${(error as Error).message}`);
    return 1;
  }

  console.log(`Specky v${VERSION}`);
  console.log(`Workspace: ${workspace}`);
  console.log("");

  const installJson = resolve(t.shared.specky, "install.json");
  printInstallStatus(installJson);
  printIdeStatus(workspace, t);
  await printPipelineStatus(workspace, config);

  return 0;
}

function safeCount(dir: string): number {
  try {
    return existsSync(dir) ? readdirSync(dir).length : 0;
  } catch {
    return 0;
  }
}

function safeCountDirs(dir: string): number {
  try {
    if (!existsSync(dir)) return 0;
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}
