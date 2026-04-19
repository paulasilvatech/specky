/**
 * status.ts — `specky status` — show pipeline state and install summary.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../../constants.js";
import { targetPaths } from "../lib/paths.js";

export interface StatusOptions {
  workspace?: string;
}

export async function runStatus(opts: StatusOptions): Promise<number> {
  const workspace = opts.workspace ?? process.cwd();
  const t = targetPaths(workspace);

  console.log(`Specky v${VERSION}`);
  console.log(`Workspace: ${workspace}`);
  console.log("");

  // Install info
  const installJson = resolve(t.shared.specky, "install.json");
  if (existsSync(installJson)) {
    const meta = JSON.parse(readFileSync(installJson, "utf8")) as {
      version: string;
      ide: string;
      installed_at: string;
    };
    console.log(`Install: v${meta.version}, ide=${meta.ide}, at=${meta.installed_at}`);
  } else {
    console.log("Install: NOT DETECTED — run `npx specky init`");
  }

  // IDE presence
  console.log("");
  console.log("IDE targets:");
  if (existsSync(t.claude.root)) {
    const agents = safeCount(t.claude.agents);
    const commands = safeCount(t.claude.commands);
    const skills = safeCountDirs(t.claude.skills);
    const hooks = safeCount(t.claude.hooksScripts);
    console.log(`  .claude/      agents=${agents}, commands=${commands}, skills=${skills}, hooks=${hooks}`);
  }
  if (existsSync(resolve(workspace, ".github/agents")) || existsSync(resolve(workspace, ".github/prompts"))) {
    const agents = safeCount(t.copilot.agents);
    const prompts = safeCount(t.copilot.prompts);
    const skills = safeCountDirs(t.copilot.skills);
    const hooks = safeCount(t.copilot.hooksScripts);
    console.log(`  .github/      agents=${agents}, prompts=${prompts}, skills=${skills}, hooks=${hooks}`);
  }

  // Pipeline state
  console.log("");
  console.log("Pipeline:");
  if (!existsSync(t.shared.specs)) {
    console.log("  No .specs/ directory — no active pipeline.");
    console.log("  Start: invoke @specky-onboarding (Copilot) or /specky-onboarding (Claude)");
    return 0;
  }

  const features = readdirSync(t.shared.specs).filter((d) => {
    const p = resolve(t.shared.specs, d);
    return existsSync(resolve(p, ".sdd-state.json"));
  });

  if (features.length === 0) {
    console.log("  .specs/ exists but no active features.");
    return 0;
  }

  for (const feat of features) {
    const statePath = resolve(t.shared.specs, feat, ".sdd-state.json");
    try {
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        phase?: number | string;
        feature?: string;
      };
      console.log(`  ${feat}: phase=${state.phase ?? "?"}`);
    } catch {
      console.log(`  ${feat}: (unreadable state)`);
    }
  }

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
