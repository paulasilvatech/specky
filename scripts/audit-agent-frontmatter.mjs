#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const AGENTS_DIR = join(ROOT, ".apm", "agents");

function listAgentFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".agent.md"))
    .map((name) => join(dir, name))
    .sort((a, b) => a.localeCompare(b));
}

function readFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : "";
}

function parseTools(frontmatter) {
  const match = frontmatter.match(/^tools:\s*\[(.*)\]\s*$/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((token) => token.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function parseSddTokens(text) {
  return [...new Set(text.match(/\bsdd_[a-z0-9_]+\b/g) ?? [])].sort((a, b) => a.localeCompare(b));
}

function main() {
  if (!statSync(AGENTS_DIR).isDirectory()) {
    console.error(`Missing agents directory: ${AGENTS_DIR}`);
    process.exit(1);
  }

  const files = listAgentFiles(AGENTS_DIR);
  const errors = [];

  for (const filePath of files) {
    const text = readFileSync(filePath, "utf8");
    const fm = readFrontmatter(text);
    const tools = parseTools(fm);
    const sddTokens = parseSddTokens(text);

    if (/^model:/m.test(fm)) {
      errors.push(`${filePath}: remove hardcoded model from frontmatter`);
    }
    if (/^model_fallback:/m.test(fm)) {
      errors.push(`${filePath}: remove model_fallback from frontmatter`);
    }

    const missingTools = sddTokens.filter((tool) => !tools.includes(tool));
    if (missingTools.length > 0) {
      errors.push(`${filePath}: missing tools in frontmatter -> ${missingTools.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    console.error("Agent frontmatter audit failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(2);
  }

  console.log(`Agent frontmatter audit passed for ${files.length} agent files.`);
}

main();
