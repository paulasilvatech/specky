#!/usr/bin/env node
/**
 * generate-api-reference.mjs — regenerate docs/API_REFERENCE.md from the live
 * MCP server's tools/list, so the reference can never drift from the code.
 *
 * Usage: node scripts/generate-api-reference.mjs        (writes the file)
 *        node scripts/generate-api-reference.mjs --check (fails if out of date)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = resolve(ROOT, "dist/index.js");
const OUT = resolve(ROOT, "docs/API_REFERENCE.md");

function listTools() {
  const input =
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "api-ref", version: "1" } } }) + "\n" +
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n";
  const res = spawnSync("node", [SERVER], { input, encoding: "utf8", timeout: 20000 });
  for (const line of (res.stdout ?? "").split("\n").filter(Boolean)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 2) return parsed.result.tools;
    } catch { /* ignore */ }
  }
  throw new Error(`tools/list failed. stderr=${res.stderr?.slice(0, 400)}`);
}

function render(tools) {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sorted.map((t) => {
    const required = Array.isArray(t.inputSchema?.required) ? t.inputSchema.required : [];
    const inputs = required.length ? required.map((r) => `\`${r}\``).join(", ") : "—";
    const desc = (t.description ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
    return `| \`${t.name}\` | ${t.title ?? ""} | ${desc} | ${inputs} |`;
  });
  return [
    "# Specky MCP Server — API Reference",
    "",
    "> Generated from the live MCP server by `scripts/generate-api-reference.mjs`.",
    "> Do not edit by hand — run `node scripts/generate-api-reference.mjs` after changing tools.",
    "",
    `**Total tools: ${sorted.length}**`,
    "",
    "| Tool | Title | Description | Required inputs |",
    "|------|-------|-------------|-----------------|",
    ...rows,
    "",
  ].join("\n");
}

const content = render(listTools());
const check = process.argv.includes("--check");

if (check) {
  const current = readFileSync(OUT, "utf8");
  if (current.trim() !== content.trim()) {
    console.error("[api-reference] docs/API_REFERENCE.md is out of date. Run: node scripts/generate-api-reference.mjs");
    process.exit(1);
  }
  console.log("[api-reference] up to date.");
} else {
  writeFileSync(OUT, content, "utf8");
  console.log(`[api-reference] wrote ${OUT} (${content.split("\n").length} lines).`);
}
