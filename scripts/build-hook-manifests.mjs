#!/usr/bin/env node
/**
 * build-hook-manifests.mjs — Generate Claude, Copilot, and Cursor hook manifests.
 *
 * Source: .apm/hooks/sdd-hooks.json uses `${CLAUDE_PLUGIN_ROOT}`, which only
 * exists inside plugin assets. Build resolves those paths and adapts matchers
 * for each client runtime.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INPUT = resolve(ROOT, ".apm/hooks/sdd-hooks.json");
const CLAUDE_OUTPUT = resolve(ROOT, "dist/claude-hooks.json");
const COPILOT_OUTPUT = resolve(ROOT, "dist/copilot-hooks.json");
const CURSOR_OUTPUT = resolve(ROOT, "dist/cursor-hooks.json");

// Native Claude/Cursor tools that must NOT be MCP-prefixed.
const NATIVE_TOOLS = new Set([
  "Write", "Edit", "MultiEdit", "Read", "Bash", "Glob", "Grep",
  "WebFetch", "WebSearch", "Task", "TodoWrite", "NotebookEdit",
]);

const MCP_PREFIX = "mcp__specky__";
const PLUGIN_ROOT_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/scripts\//g;
const CLAUDE_SCRIPTS_PATH = ".claude/hooks/scripts/";
const COPILOT_SCRIPTS_PATH = ".github/hooks/specky/scripts/";
const CURSOR_RUNNER = ".cursor/hooks/specky-run.sh";
const NATIVE_ONLY_MATCHER = /^(Write|Edit|MultiEdit)(\|(Write|Edit|MultiEdit))*$/;

const BLOCKING_SCRIPTS = new Set([
  "specky-artifact-validator.sh",
  "specky-phase-gate.sh",
  "specky-security-scan.sh",
  "specky-release-gate.sh",
]);

const CURSOR_EVENT_MAP = {
  SessionStart: "sessionStart",
  UserPromptSubmit: "beforeSubmitPrompt",
  Stop: "stop",
};

function prefixMatcher(matcher) {
  if (!matcher) return matcher;
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
    hooks: (group.hooks ?? []).map((hook) => ({
      ...hook,
      command: transformCommand(hook.command, opts.scriptsPath),
    })),
  };
}

function transformManifest(src, opts) {
  const out = {};
  for (const [event, groups] of Object.entries(src)) {
    if (!Array.isArray(groups)) continue;
    out[event] = groups.map((group) => transformHookGroup(group, opts));
  }
  return out;
}

function scriptNameFromCommand(command) {
  const match = String(command ?? "").match(/\/(specky-[^/\s]+\.sh)/);
  return match ? match[1] : null;
}

function cursorHookEntries(group, event) {
  const matcher = group.matcher ?? "";
  const isNativeWrite = NATIVE_ONLY_MATCHER.test(matcher);
  const bucket = event === "PreToolUse"
    ? (isNativeWrite ? "preToolUse" : "beforeMCPExecution")
    : event === "PostToolUse"
      ? (isNativeWrite ? "postToolUse" : "afterMCPExecution")
      : CURSOR_EVENT_MAP[event];

  if (!bucket) return [];

  return (group.hooks ?? [])
    .map((hook) => {
      const script = scriptNameFromCommand(hook.command);
      if (!script) return null;
      const blocking = BLOCKING_SCRIPTS.has(script);
      const entry = {
        command: `${CURSOR_RUNNER} ${script}${blocking ? " --blocking" : ""}`,
        timeout: hook.timeout ?? 10,
      };
      if (matcher) entry.matcher = isNativeWrite ? "Write|Edit" : matcher;
      if (blocking) entry.failClosed = true;
      return { bucket, entry };
    })
    .filter(Boolean);
}

function buildCursorManifest(claudeManifest) {
  const hooks = {};
  for (const [event, groups] of Object.entries(claudeManifest)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      for (const mapped of cursorHookEntries(group, event)) {
        hooks[mapped.bucket] ??= [];
        hooks[mapped.bucket].push(mapped.entry);
      }
    }
  }
  return { version: 1, hooks };
}

async function writeManifest(outPath, manifest, label) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const counts = Object.fromEntries(
    Object.entries(manifest.hooks ?? manifest).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]),
  );
  console.log(`[${label}] wrote ${outPath}`);
  console.log(`[${label}] groups:`, counts);
}

async function main() {
  const raw = await readFile(INPUT, "utf8");
  const src = JSON.parse(raw);

  const claudeHooks = transformManifest(src, {
    prefixMatchers: true,
    scriptsPath: CLAUDE_SCRIPTS_PATH,
  });
  await writeManifest(CLAUDE_OUTPUT, claudeHooks, "build-claude-hooks");

  const copilotHooks = transformManifest(src, {
    prefixMatchers: false,
    scriptsPath: COPILOT_SCRIPTS_PATH,
  });

  // Copilot treats all hooks as PreToolUse, so lifecycle and native-write
  // matchers are stripped to prevent spurious blocks/timeouts.
  delete copilotHooks.SessionStart;
  delete copilotHooks.UserPromptSubmit;
  for (const event of Object.keys(copilotHooks)) {
    if (!Array.isArray(copilotHooks[event])) continue;
    copilotHooks[event] = copilotHooks[event].filter(
      (group) => !NATIVE_ONLY_MATCHER.test(group.matcher ?? ""),
    );
  }
  await writeManifest(COPILOT_OUTPUT, copilotHooks, "build-copilot-hooks");

  const cursorManifest = buildCursorManifest(claudeHooks);
  await writeManifest(CURSOR_OUTPUT, cursorManifest, "build-cursor-hooks");
}

main().catch((err) => {
  console.error("[build-hooks] ERROR:", err);
  process.exit(1);
});