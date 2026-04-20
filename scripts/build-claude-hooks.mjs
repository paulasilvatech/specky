#!/usr/bin/env node
/**
 * build-claude-hooks.mjs — Generate both Claude and Copilot hook manifests.
 *
 * Source: .apm/hooks/sdd-hooks.json uses `${CLAUDE_PLUGIN_ROOT}` which is a
 * Claude-Code plugin variable that does NOT resolve in either Claude Code
 * settings.json or VS Code Copilot. We produce two resolved variants:
 *
 *   dist/claude-hooks.json   — Claude Code format
 *     - Matchers prefixed: `sdd_init` → `mcp__specky__sdd_init`
 *     - Paths resolved: `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/` → `.claude/hooks/scripts/`
 *
 *   dist/copilot-hooks.json  — GitHub Copilot / VS Code format
 *     - Matchers unchanged (Copilot uses raw tool names)
 *     - Paths resolved: `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/` → `.github/hooks/specky/scripts/`
 *
 * WHY THIS MATTERS: shipping the unresolved source `sdd-hooks.json` into
 * `.github/hooks/specky/` caused Copilot's PreToolUse hook executor to fail on
 * every tool call (unresolved `${CLAUDE_PLUGIN_ROOT}` → script not found →
 * generic "unexpected error" denial for every tool). Fixed in rc.12.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INPUT = resolve(ROOT, ".apm/hooks/sdd-hooks.json");
const CLAUDE_OUTPUT = resolve(ROOT, "dist/claude-hooks.json");
const COPILOT_OUTPUT = resolve(ROOT, "dist/copilot-hooks.json");

// Native Claude Code tools that must NOT be prefixed.
const NATIVE_TOOLS = new Set([
  "Write", "Edit", "MultiEdit", "Read", "Bash", "Glob", "Grep",
  "WebFetch", "WebSearch", "Task", "TodoWrite", "NotebookEdit",
]);

const MCP_PREFIX = "mcp__specky__";
const PLUGIN_ROOT_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/scripts\//g;
const CLAUDE_SCRIPTS_PATH = ".claude/hooks/scripts/";
const COPILOT_SCRIPTS_PATH = ".github/hooks/specky/scripts/";

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

function transformCommand(cmd, scriptsPath) {
  if (typeof cmd !== "string") return cmd;
  return cmd.replace(PLUGIN_ROOT_RE, scriptsPath);
}

function transformHookGroup(group, opts) {
  return {
    matcher: opts.prefixMatchers ? prefixMatcher(group.matcher) : group.matcher,
    hooks: (group.hooks ?? []).map((h) => ({
      ...h,
      command: transformCommand(h.command, opts.scriptsPath),
    })),
  };
}

function transformManifest(src, opts) {
  const out = {};
  for (const [event, groups] of Object.entries(src)) {
    if (!Array.isArray(groups)) continue;
    out[event] = groups.map((g) => transformHookGroup(g, opts));
  }
  return out;
}

async function writeManifest(outPath, manifest, label) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const counts = Object.fromEntries(
    Object.entries(manifest).map(([k, v]) => [k, v.length]),
  );
  console.log(`[${label}] wrote ${outPath}`);
  console.log(`[${label}] groups:`, counts);
}

async function main() {
  const raw = await readFile(INPUT, "utf8");
  const src = JSON.parse(raw);

  // Claude Code: prefix MCP matchers with mcp__specky__ + resolve paths to .claude/
  const claudeHooks = transformManifest(src, {
    prefixMatchers: true,
    scriptsPath: CLAUDE_SCRIPTS_PATH,
  });
  await writeManifest(CLAUDE_OUTPUT, claudeHooks, "build-claude-hooks");

  // Copilot: keep raw matcher names (Copilot uses unprefixed tool names) + resolve paths to .github/
  const copilotHooks = transformManifest(src, {
    prefixMatchers: false,
    scriptsPath: COPILOT_SCRIPTS_PATH,
  });

  // rc.14: Strip lifecycle events Copilot doesn't support.
  // Copilot's hook executor treats ALL hooks as PreToolUse. SessionStart
  // (session-banner.sh) and UserPromptSubmit (pipeline-guard.sh with matcher:"")
  // fire on every tool call in Copilot. pipeline-guard.sh reads stdin to parse
  // the user prompt; Copilot provides tool-call data instead → jq parse failure
  // → cat hangs → 5s timeout → "Blocked by Pre-Tool Use hook".
  delete copilotHooks.SessionStart;
  delete copilotHooks.UserPromptSubmit;

  // rc.14: Strip Write|Edit|MultiEdit matcher — these are Claude Code native
  // tool names that don't exist in Copilot. Copilot's matcher may still fire
  // branch-validator.sh for unrelated tools, causing spurious blocks.
  if (Array.isArray(copilotHooks.PreToolUse)) {
    copilotHooks.PreToolUse = copilotHooks.PreToolUse.filter(
      (g) => !/^(Write|Edit|MultiEdit)(\|(Write|Edit|MultiEdit))*$/.test(g.matcher ?? ""),
    );
  }

  await writeManifest(COPILOT_OUTPUT, copilotHooks, "build-copilot-hooks");
}

main().catch((err) => {
  console.error("[build-hooks] ERROR:", err);
  process.exit(1);
});
