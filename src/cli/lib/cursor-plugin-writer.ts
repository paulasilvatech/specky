/**
 * cursor-plugin-writer.ts — Write .cursor-plugin/plugin.json so Cursor shows
 * the Specky logo in Agent Plugins (stdio MCP icons alone are often ignored).
 */
import { closeSync, copyFileSync, existsSync, ftruncateSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
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

  if (opts.dryRun) {
    const before = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
    if (before === after) {
      return { path: manifestPath, action: "unchanged" };
    }
    return { path: manifestPath, action: before ? "merged" : "created" };
  }

  // Use a file descriptor throughout to avoid a TOCTOU race condition (CWE-367).
  mkdirSync(pluginDir, { recursive: true });
  let fd: number | undefined;
  try {
    try {
      fd = openSync(manifestPath, "r+");
    } catch (openErr: unknown) {
      const code = typeof openErr === "object" && openErr !== null && "code" in openErr ? openErr.code : undefined;
      if (code !== "ENOENT") throw openErr;
      // File does not yet exist; create it atomically.
      fd = openSync(manifestPath, "w");
      writeSync(fd, after, 0);
      return { path: manifestPath, action: "created" };
    }
    const before = readFileSync(fd, "utf8");
    if (before === after) {
      return { path: manifestPath, action: "unchanged" };
    }
    ftruncateSync(fd, 0);
    writeSync(fd, after, 0);
    return { path: manifestPath, action: "merged" };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
