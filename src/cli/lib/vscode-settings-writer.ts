/**
 * vscode-settings-writer.ts — Merge Specky-required settings into .vscode/settings.json.
 *
 * Context: GitHub Copilot in VS Code requires MCP servers and their tools to be
 * explicitly enabled via workspace settings. Without this, users see the error
 * reported in the field ("tool_search returns no results, MCP specky-sdd not
 * loaded") even though `.vscode/mcp.json` is correct.
 *
 * This writer deep-merges the required keys without touching unrelated settings.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface VscodeSettings {
  "chat.mcp.enabled"?: boolean;
  "chat.mcp.discovery.enabled"?: boolean;
  "chat.agent.enabled"?: boolean;
  "github.copilot.chat.codeGeneration.useInstructionFiles"?: boolean;
  "github.copilot.chat.agent.autoFix"?: boolean;
  [k: string]: unknown;
}

/** Settings that help Copilot + MCP work out of the box for Specky. */
export const SPECKY_VSCODE_SETTINGS: VscodeSettings = {
  // Enable MCP server support in Copilot Chat
  "chat.mcp.enabled": true,
  // Enable auto-discovery of .vscode/mcp.json
  "chat.mcp.discovery.enabled": true,
  // Enable agent mode (required for sub-agent invocations like @specky-orchestrator)
  "chat.agent.enabled": true,
  // Honor .github/copilot-instructions.md
  "github.copilot.chat.codeGeneration.useInstructionFiles": true,
};

function readJsoncStripComments(raw: string): string {
  // VS Code settings.json is JSONC — allow // line comments and /* */ block comments.
  // Strip them BEFORE JSON.parse. Do not mutate strings that LOOK like comments
  // (naive but sufficient for typical settings.json files).
  let out = "";
  let i = 0;
  const n = raw.length;
  let inString = false;
  let stringChar = "";
  while (i < n) {
    const c = raw[i];
    const next = raw[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < n) {
        out += raw[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c!;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      // line comment
      while (i < n && raw[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function readSettings(path: string): VscodeSettings {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return {};
    const stripped = readJsoncStripComments(raw);
    return JSON.parse(stripped) as VscodeSettings;
  } catch (err) {
    throw new Error(
      `[specky] Cannot parse ${path} (preserving as-is): ${(err as Error).message}`,
    );
  }
}

export interface VsResult {
  path: string;
  written: boolean;
  addedKeys: string[];
}

/**
 * Merge Specky-required keys into .vscode/settings.json.
 * Only adds missing keys; never overwrites user-authored values.
 */
export function writeVscodeSettings(
  path: string,
  opts: { dryRun: boolean },
): VsResult {
  let existing: VscodeSettings = {};
  try {
    existing = readSettings(path);
  } catch (err) {
    // If we can't parse the user's settings.json (e.g., complex JSONC with
    // trailing commas), don't touch it — emit a warning upstream.
    return { path, written: false, addedKeys: [] };
  }

  const addedKeys: string[] = [];
  const merged: VscodeSettings = { ...existing };
  for (const [key, value] of Object.entries(SPECKY_VSCODE_SETTINGS)) {
    if (!(key in merged)) {
      merged[key] = value;
      addedKeys.push(key);
    }
  }

  if (addedKeys.length === 0) {
    return { path, written: false, addedKeys };
  }

  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf8");
  }
  return { path, written: !opts.dryRun, addedKeys };
}
