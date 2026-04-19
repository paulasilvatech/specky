/**
 * settings-merger.ts — Deep-merge Claude Code hooks into .claude/settings.json.
 *
 * Claude Code reads `.claude/settings.json` for hooks, permissions, etc.
 * We must merge (not overwrite) since users may have their own hooks/permissions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Targets } from "./paths.js";

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface HooksSection {
  [event: string]: HookGroup[];
}

interface ClaudeSettings {
  hooks?: HooksSection;
  permissions?: unknown;
  [k: string]: unknown;
}

function readSettings(path: string): ClaudeSettings {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    throw new Error(
      `[specky] Failed to parse ${path}: ${(err as Error).message}`,
    );
  }
}

/**
 * Merge strategy: for each event (PreToolUse/PostToolUse/Stop),
 *   - find existing groups by matcher; if matcher already exists with identical
 *     command set, skip. Otherwise append.
 *   - never delete user-authored groups.
 */
function mergeHooks(existing: HooksSection, incoming: HooksSection): HooksSection {
  const merged: HooksSection = { ...existing };
  for (const [event, groups] of Object.entries(incoming)) {
    const existingGroups = merged[event] ?? [];
    const out: HookGroup[] = [...existingGroups];

    for (const g of groups) {
      const match = out.find((e) => e.matcher === g.matcher);
      if (!match) {
        out.push(g);
        continue;
      }
      // Append any hook commands not already present
      for (const h of g.hooks) {
        const exists = match.hooks.some(
          (x) => x.type === h.type && x.command === h.command,
        );
        if (!exists) match.hooks.push(h);
      }
    }
    merged[event] = out;
  }
  return merged;
}

export interface MergeResult {
  written: boolean;
  path: string;
  addedEvents: string[];
}

export function mergeClaudeHooks(
  targets: Targets,
  claudeHooks: HooksSection,
  opts: { dryRun: boolean },
): MergeResult {
  const path = targets.claude.settingsJson;
  const existing = readSettings(path);
  const merged = mergeHooks(existing.hooks ?? {}, claudeHooks);
  const addedEvents = Object.keys(merged).filter(
    (k) => !existing.hooks || !existing.hooks[k],
  );
  const final: ClaudeSettings = { ...existing, hooks: merged };
  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(final, null, 2) + "\n", "utf8");
  }
  return { written: !opts.dryRun, path, addedEvents };
}

export function loadClaudeHooksManifest(manifestPath: string): HooksSection {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[specky] claude-hooks.json not found at ${manifestPath}. ` +
        `Did the build step run? (npm run build)`,
    );
  }
  const raw = readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as HooksSection;
}

export { resolve };
