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

interface PermissionsSection {
  allow?: string[];
  deny?: string[];
  ask?: string[];
  defaultMode?: string;
  [k: string]: unknown;
}

interface ClaudeSettings {
  hooks?: HooksSection;
  permissions?: PermissionsSection;
  [k: string]: unknown;
}

/** Tools that Specky agents need pre-authorized (avoids per-invocation prompts). */
export const SPECKY_REQUIRED_ALLOWS: string[] = [
  // Native Claude tools used by agents
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Write",
  "MultiEdit",
  "Bash(git:*)",
  "Bash(npm:*)",
  "Bash(node:*)",
  "Bash(bash:*)",
  "Bash(ls:*)",
  "Bash(mkdir:*)",
  "Bash(cat:*)",
  "WebFetch",
  "WebSearch",
  "Task",
  // All Specky MCP tools
  "mcp__specky__*",
];

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
  addedPermissions: number;
}

/**
 * Merge permissions.allow — union with existing, dedupe.
 * Never removes user-authored entries.
 */
function mergePermissions(
  existing: PermissionsSection | undefined,
  requiredAllows: string[],
): { merged: PermissionsSection; added: number } {
  const base: PermissionsSection = existing ?? {};
  const currentAllow = Array.isArray(base.allow) ? base.allow : [];
  const set = new Set(currentAllow);
  let added = 0;
  for (const a of requiredAllows) {
    if (!set.has(a)) {
      set.add(a);
      added++;
    }
  }
  return {
    merged: { ...base, allow: [...set] },
    added,
  };
}

export function mergeClaudeHooks(
  targets: Targets,
  claudeHooks: HooksSection,
  opts: { dryRun: boolean },
): MergeResult {
  const path = targets.claude.settingsJson;
  const existing = readSettings(path);

  const mergedHooks = mergeHooks(existing.hooks ?? {}, claudeHooks);
  const addedEvents = Object.keys(mergedHooks).filter(
    (k) => !existing.hooks || !existing.hooks[k],
  );

  const { merged: mergedPerms, added: addedPermissions } = mergePermissions(
    existing.permissions,
    SPECKY_REQUIRED_ALLOWS,
  );

  const final: ClaudeSettings = {
    ...existing,
    hooks: mergedHooks,
    permissions: mergedPerms,
  };

  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(final, null, 2) + "\n", "utf8");
  }
  return { written: !opts.dryRun, path, addedEvents, addedPermissions };
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
