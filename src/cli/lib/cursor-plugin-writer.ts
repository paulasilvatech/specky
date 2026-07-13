/**
 * cursor-plugin-writer.ts — Write .cursor-plugin/plugin.json so Cursor shows
 * the Specky logo in Agent Plugins (stdio MCP icons alone are often ignored).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { VERSION } from "../../constants.js";

const PLUGIN_NAME = "specky";
/** Relative to workspace root; copied from the npm package on install. */
export const CURSOR_PLUGIN_LOGO = ".cursor/assets/specky-icon.png";

export function buildCursorPluginManifest(logoPath: string = CURSOR_PLUGIN_LOGO): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    version: VERSION,
    description:
      "Specky — Spec-Driven Development plugin (58 MCP tools, 13 agents, 10-phase pipeline).",
    logo: logoPath,
    rules: ".cursor/rules",
    agents: ".cursor/agents",
    commands: ".cursor/commands",
    skills: ".agents/skills",
    hooks: ".cursor/hooks.json",
    mcpServers: ".cursor/mcp.json",
    homepage: "https://getspecky.ai",
    repository: "https://github.com/paulasilvatech/specky",
    license: "MIT",
    keywords: ["specky", "sdd", "spec-driven-development", "mcp"],
  };
}

export function writeCursorPluginManifest(
  workspace: string,
  pkgRoot: string,
  opts: { dryRun: boolean },
): { path: string; action: "created" | "merged" | "unchanged" } {
  const pluginDir = resolve(workspace, ".cursor-plugin");
  const manifestPath = resolve(pluginDir, "plugin.json");
  const logoDest = resolve(workspace, CURSOR_PLUGIN_LOGO);
  const manifest = buildCursorPluginManifest();
  const after = JSON.stringify(manifest, null, 2) + "\n";

  if (!opts.dryRun) {
    const iconSrc = join(pkgRoot, "site", "specky-icon.png");
    if (existsSync(iconSrc)) {
      mkdirSync(dirname(logoDest), { recursive: true });
      copyFileSync(iconSrc, logoDest);
    }
  }

  const before = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
  if (before === after) {
    return { path: manifestPath, action: "unchanged" };
  }
  const action = before ? "merged" : "created";
  if (!opts.dryRun) {
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(manifestPath, after, "utf8");
  }
  return { path: manifestPath, action };
}
