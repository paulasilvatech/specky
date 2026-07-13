/**
 * settings-merger.ts — Deep-merge Claude Code hooks into .claude/settings.json.
 *
 * Claude Code reads `.claude/settings.json` for hooks, permissions, etc.
 * We must merge (not overwrite) since users may have their own hooks/permissions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AgentCapability } from "./harness/types.js";
import type { Targets } from "./paths.js";

export type PermissionProfile = "prompt" | "scoped";

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

/**
 * Tools Specky pre-authorizes so the SDD workflow does not prompt on every
 * step. This list is deliberately MINIMAL and least-privilege:
 *
 *   - It does NOT pre-authorize arbitrary code execution — no `Bash(bash:*)`,
 *     `Bash(sh:*)`, `Bash(node:*)`, `Bash(python:*)`, no `Bash(rm:*)`/`chmod`,
 *     and no `WebFetch`/`WebSearch`. Those each amount to unattended RCE or
 *     network egress after a one-time install, and pre-approving them would
 *     silently disable Claude Code's human-in-the-loop safety and contradict
 *     Specky's "no outbound network" posture. They still work — they just
 *     prompt for confirmation, as they should.
 *   - Hooks are NOT gated by this list (they run from the settings `hooks`
 *     section), so removing shell wildcards does not affect them.
 *
 * If a team genuinely wants the broader grant, they can add it to their own
 * `.claude/settings.json` explicitly.
 */
export const SPECKY_REQUIRED_ALLOWS: string[] = [
  // Read-only inspection
  "Read",
  "Glob",
  "Grep",
  // File authoring for the implement phase (workspace edits, not shell)
  "Edit",
  "Write",
  "MultiEdit",
  // Subagent orchestration
  "Task",
  // The specific, scoped commands the SDD flow runs (not arbitrary shell)
  "Bash(git:*)",
  "Bash(npm:*)",
  "Bash(npx:*)",
  // All Specky MCP tools
  "mcp__specky__*",
];

function testRunnerAllows(workspace: string): string[] {
  const allows = ["Bash(npm:*)", "Bash(npx:*)"];
  if (existsSync(resolve(workspace, "pnpm-lock.yaml"))) allows.push("Bash(pnpm:*)");
  if (existsSync(resolve(workspace, "yarn.lock"))) allows.push("Bash(yarn:*)");
  if (existsSync(resolve(workspace, "bun.lockb")) || existsSync(resolve(workspace, "bun.lock"))) {
    allows.push("Bash(bun:*)");
  }
  return allows;
}

/**
 * Compute the narrowest Claude allowlist that can satisfy installed agent
 * capabilities. The prompt profile deliberately leaves host confirmation on.
 */
export function requiredClaudeAllows(
  capabilities: Iterable<AgentCapability>,
  opts: {
    profile: PermissionProfile;
    workspace: string;
    integrations?: readonly string[];
  },
): string[] {
  if (opts.profile === "prompt") return [];

  const allows = new Set<string>();
  const integrations = new Set(opts.integrations ?? []);
  for (const capability of capabilities) {
    switch (capability) {
      case "workspace.read":
        allows.add("Read");
        allows.add("Glob");
        allows.add("Grep");
        break;
      case "workspace.edit":
        allows.add("Edit");
        allows.add("Write");
        allows.add("MultiEdit");
        break;
      case "agent.delegate":
        allows.add("Task");
        break;
      case "workspace.command.git":
        allows.add("Bash(git:*)");
        break;
      case "workspace.command.test":
        for (const allow of testRunnerAllows(opts.workspace)) allows.add(allow);
        break;
      case "workspace.command.release-gates":
        allows.add("Bash(.claude/hooks/scripts/specky-security-scan.sh:*)");
        allows.add("Bash(.claude/hooks/scripts/specky-release-gate.sh:*)");
        break;
      default:
        if (capability.startsWith("mcp.specky.")) {
          allows.add(`mcp__specky__${capability.slice("mcp.specky.".length)}`);
        }
        if (
          integrations.has("github") &&
          capability.startsWith("mcp.github.")
        ) {
          allows.add(`mcp__github__${capability.slice("mcp.github.".length)}`);
        }
    }
  }
  return [...allows].sort((left, right) => left.localeCompare(right));
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
  opts: {
    dryRun: boolean;
    capabilities?: Iterable<AgentCapability>;
    integrations?: readonly string[];
    permissionProfile?: PermissionProfile;
    workspace?: string;
  },
): MergeResult {
  const path = targets.claude.settingsJson;
  const existing = readSettings(path);

  const mergedHooks = mergeHooks(existing.hooks ?? {}, claudeHooks);
  const addedEvents = Object.keys(mergedHooks).filter(
    (k) => !existing.hooks || !existing.hooks[k],
  );

  const requiredAllows = opts.capabilities
    ? requiredClaudeAllows(opts.capabilities, {
      profile: opts.permissionProfile ?? "scoped",
      workspace: opts.workspace ?? process.cwd(),
      integrations: opts.integrations,
    })
    : SPECKY_REQUIRED_ALLOWS;
  const { merged: mergedPerms, added: addedPermissions } = mergePermissions(
    existing.permissions,
    requiredAllows,
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
