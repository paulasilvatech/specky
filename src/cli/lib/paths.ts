/**
 * paths.ts — Resolve the installed package root and asset paths.
 *
 * When Specky is installed via npm, assets live in the package directory:
 *   node_modules/specky-sdd/.apm/...
 *   node_modules/specky-sdd/templates/...
 *
 * When running from the Specky source repo (e.g., during development):
 *   <repo-root>/.apm/...
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the package root by walking up from the compiled CLI location.
 * After build, this file lives at `<package>/dist/cli/lib/paths.js`.
 * Before build (dev), at `<package>/src/cli/lib/paths.ts`.
 */
export function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // Walk up until we find package.json
  let cur = here;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(cur, "package.json"))) return cur;
    cur = resolve(cur, "..");
  }
  throw new Error("[specky] Could not locate package root from " + here);
}

export function sourcePaths(pkgRoot: string): {
  apmDir: string;
  agentsDir: string;
  promptsDir: string;
  skillsDir: string;
  hookScriptsDir: string;
  hooksManifest: string;
  instructionsDir: string;
  templatesDir: string;
  claudeHooksManifest: string;
  copilotHooksManifest: string;
  cursorHooksManifest: string;
  speckyRunScript: string;
  configYml: string;
  apmYml: string;
  apmPolicyYml: string;
} {
  return {
    apmDir: resolve(pkgRoot, ".apm"),
    agentsDir: resolve(pkgRoot, ".apm/agents"),
    promptsDir: resolve(pkgRoot, ".apm/prompts"),
    skillsDir: resolve(pkgRoot, ".apm/skills"),
    hookScriptsDir: resolve(pkgRoot, ".apm/hooks/scripts"),
    hooksManifest: resolve(pkgRoot, ".apm/hooks/sdd-hooks.json"),
    instructionsDir: resolve(pkgRoot, ".apm/instructions"),
    templatesDir: resolve(pkgRoot, "templates"),
    claudeHooksManifest: resolve(pkgRoot, "dist/claude-hooks.json"),
    copilotHooksManifest: resolve(pkgRoot, "dist/copilot-hooks.json"),
    cursorHooksManifest: resolve(pkgRoot, "dist/cursor-hooks.json"),
    speckyRunScript: resolve(pkgRoot, ".apm/hooks/specky-run.sh"),
    configYml: resolve(pkgRoot, "config.yml"),
    apmYml: resolve(pkgRoot, "apm.yml"),
    apmPolicyYml: resolve(pkgRoot, "apm-policy.yml"),
  };
}

export interface Targets {
  claude: {
    root: string;
    agents: string;
    commands: string;
    skills: string;
    hooksScripts: string;
    rules: string;
    settingsJson: string;
  };
  copilot: {
    agents: string;
    prompts: string;
    skills: string;
    hooksRoot: string;
    hooksScripts: string;
    hooksManifest: string;
    instructions: string;
  };
  cursor: {
    root: string;
    agents: string;
    commands: string;
    rules: string;
    hooksScripts: string;
    hooksRunner: string;
    hooksManifest: string;
    mcp: string;
  };
  opencode: {
    root: string;
    agents: string;
    commands: string;
    mcp: string;
  };
  shared: {
    specky: string;
    specs: string;
    agentSkills: string;
    vscodeMcp: string;
    claudeMcp: string;
  };
}

export function targetPaths(workspace: string): Targets {
  const claude = resolve(workspace, ".claude");
  const github = resolve(workspace, ".github");
  const cursor = resolve(workspace, ".cursor");
  const opencode = resolve(workspace, ".opencode");
  return {
    claude: {
      root: claude,
      agents: resolve(claude, "agents"),
      commands: resolve(claude, "commands"),
      skills: resolve(claude, "skills"),
      hooksScripts: resolve(claude, "hooks/scripts"),
      rules: resolve(claude, "rules"),
      settingsJson: resolve(claude, "settings.json"),
    },
    copilot: {
      agents: resolve(github, "agents"),
      prompts: resolve(github, "prompts"),
      skills: resolve(github, "skills"),
      hooksRoot: resolve(github, "hooks/specky"),
      hooksScripts: resolve(github, "hooks/specky/scripts"),
      hooksManifest: resolve(github, "hooks/specky/sdd-hooks.json"),
      instructions: resolve(github, "instructions"),
    },
    cursor: {
      root: cursor,
      agents: resolve(cursor, "agents"),
      commands: resolve(cursor, "commands"),
      rules: resolve(cursor, "rules"),
      hooksScripts: resolve(cursor, "hooks/scripts"),
      hooksRunner: resolve(cursor, "hooks/specky-run.sh"),
      hooksManifest: resolve(cursor, "hooks.json"),
      mcp: resolve(cursor, "mcp.json"),
    },
    opencode: {
      root: opencode,
      agents: resolve(opencode, "agents"),
      commands: resolve(opencode, "commands"),
      mcp: resolve(workspace, "opencode.json"),
    },
    shared: {
      specky: resolve(workspace, ".specky"),
      specs: resolve(workspace, ".specs"),
      agentSkills: resolve(workspace, ".agents/skills"),
      vscodeMcp: resolve(workspace, ".vscode/mcp.json"),
      claudeMcp: resolve(workspace, ".mcp.json"),
    },
  };
}
