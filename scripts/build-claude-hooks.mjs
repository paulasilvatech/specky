#!/usr/bin/env node
/**
 * build-claude-hooks.mjs — Generate dist/claude-hooks.json for Claude Code
 *
 * Transforms .apm/hooks/sdd-hooks.json (Copilot format) into the Claude Code
 * hook manifest by:
 *   1. Prefixing MCP tool matchers with `mcp__specky__` (Claude's tool namespace)
 *   2. Replacing `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/` with `.claude/hooks/scripts/`
 *      (Claude Code does not expand ${CLAUDE_PLUGIN_ROOT}; relative paths are required)
 *
 * Output: dist/claude-hooks.json — consumed by `specky init` to deep-merge into
 * `.claude/settings.json`'s `hooks` section.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INPUT = resolve(ROOT, ".apm/hooks/sdd-hooks.json");
const OUTPUT = resolve(ROOT, "dist/claude-hooks.json");

// Native Claude Code tools that must NOT be prefixed.
const NATIVE_TOOLS = new Set([
  "Write", "Edit", "MultiEdit", "Read", "Bash", "Glob", "Grep",
  "WebFetch", "WebSearch", "Task", "TodoWrite", "NotebookEdit",
]);

const MCP_PREFIX = "mcp__specky__";
const PLUGIN_ROOT_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/scripts\//g;
const CLAUDE_SCRIPTS_PATH = ".claude/hooks/scripts/";

function prefixMatcher(matcher) {
  if (!matcher) return matcher;
  // Split by | (pipe), prefix each token, rejoin.
  return matcher
    .split("|")
    .map((token) => {
      const t = token.trim();
      if (!t) return t;
      if (NATIVE_TOOLS.has(t)) return t;
      if (t.startsWith(MCP_PREFIX)) return t;
      return MCP_PREFIX + t;
    })
    .join("|");
}

function transformCommand(cmd) {
  if (typeof cmd !== "string") return cmd;
  return cmd.replace(PLUGIN_ROOT_RE, CLAUDE_SCRIPTS_PATH);
}

function transformHookGroup(group) {
  return {
    matcher: prefixMatcher(group.matcher),
    hooks: (group.hooks ?? []).map((h) => ({
      ...h,
      command: transformCommand(h.command),
    })),
  };
}

function transformManifest(src) {
  const out = {};
  for (const [event, groups] of Object.entries(src)) {
    if (!Array.isArray(groups)) continue;
    out[event] = groups.map(transformHookGroup);
  }
  return out;
}

async function main() {
  const raw = await readFile(INPUT, "utf8");
  const src = JSON.parse(raw);
  const claudeHooks = transformManifest(src);

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(claudeHooks, null, 2) + "\n", "utf8");

  const counts = Object.fromEntries(
    Object.entries(claudeHooks).map(([k, v]) => [k, v.length]),
  );
  console.log(`[build-claude-hooks] wrote ${OUTPUT}`);
  console.log(`[build-claude-hooks] groups:`, counts);
}

main().catch((err) => {
  console.error("[build-claude-hooks] ERROR:", err);
  process.exit(1);
});
