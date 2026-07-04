#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const APM_DIR = join(ROOT, ".apm");
const AGENTS_DIR = join(APM_DIR, "agents");
const PROMPTS_DIR = join(APM_DIR, "prompts");
const SKILLS_DIR = join(APM_DIR, "skills");
const INSTRUCTIONS_DIR = join(APM_DIR, "instructions");
const HOOK_SCRIPTS_DIR = join(APM_DIR, "hooks", "scripts");
const SRC_DIR = join(ROOT, "src");

function walk(dir, filterFn) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, filterFn));
    else if (filterFn(full)) out.push(full);
  }
  return out;
}

function listFiles(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => join(dir, name))
    .sort((a, b) => a.localeCompare(b));
}

function readFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

function fmValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(String.raw`^${key}:\s*(.+?)\s*$`, "m"));
  return match ? match[1].replace(/^["']|["']$/g, "") : null;
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
  return [...new Set(text.match(/\bsdd_[a-z0-9_]+\b/g) ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
}

// Build the authoritative set of real sdd_* tool names from the source tree.
// Any sdd_* token that appears nowhere in src/ is treated as nonexistent.
function knownToolSet() {
  const set = new Set();
  for (const file of walk(SRC_DIR, (f) => f.endsWith(".ts"))) {
    const text = readFileSync(file, "utf8");
    for (const tok of text.match(/\bsdd_[a-z0-9_]+\b/g) ?? []) set.add(tok);
  }
  return set;
}

function main() {
  const errors = [];
  const known = knownToolSet();
  if (known.size === 0) {
    console.error("Could not extract any sdd_* tools from src/ — aborting audit.");
    process.exit(1);
  }

  const checkUnknownTools = (filePath, text) => {
    for (const tok of parseSddTokens(text)) {
      // Skip wildcard/glob notation used in docs (e.g. sdd_import_*, sdd_*).
      // Real tool names never end in an underscore.
      if (tok.endsWith("_")) continue;
      if (!known.has(tok)) {
        errors.push(`${filePath}: references nonexistent tool "${tok}"`);
      }
    }
  };

  // Agents
  const agentFiles = listFiles(AGENTS_DIR, ".agent.md");
  for (const filePath of agentFiles) {
    const text = readFileSync(filePath, "utf8");
    const fm = readFrontmatter(text);
    const tools = parseTools(fm);
    const sddTokens = parseSddTokens(text);

    if (/^model:/m.test(fm))
      errors.push(`${filePath}: remove hardcoded model from frontmatter`);
    if (/^model_fallback:/m.test(fm))
      errors.push(`${filePath}: remove model_fallback from frontmatter`);
    if (!fmValue(fm, "name"))
      errors.push(`${filePath}: missing 'name' in frontmatter`);
    if (!fmValue(fm, "description"))
      errors.push(`${filePath}: missing 'description' in frontmatter`);

    const missingTools = sddTokens.filter((tool) => !tools.includes(tool));
    if (missingTools.length > 0)
      errors.push(
        `${filePath}: missing tools in frontmatter -> ${missingTools.join(", ")}`,
      );
    checkUnknownTools(filePath, text);
  }

  // Skills
  if (existsSync(SKILLS_DIR)) {
    for (const dirName of readdirSync(SKILLS_DIR)) {
      const skillDir = join(SKILLS_DIR, dirName);
      if (!statSync(skillDir).isDirectory()) continue;
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) {
        errors.push(`${skillDir}: missing SKILL.md`);
        continue;
      }
      const text = readFileSync(skillFile, "utf8");
      const fm = readFrontmatter(text);
      const name = fmValue(fm, "name");
      const description = fmValue(fm, "description");
      if (!name) {
        errors.push(`${skillFile}: missing 'name' in frontmatter`);
      } else {
        if (name !== dirName)
          errors.push(
            `${skillFile}: name "${name}" must equal folder name "${dirName}"`,
          );
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))
          errors.push(`${skillFile}: name "${name}" must be lowercase kebab-case`);
      }
      if (!description) errors.push(`${skillFile}: missing 'description'`);
      else if (description.length > 1024)
        errors.push(`${skillFile}: description exceeds 1024 chars`);
      checkUnknownTools(skillFile, text);
    }
  }

  // Prompts
  for (const filePath of listFiles(PROMPTS_DIR, ".prompt.md")) {
    const text = readFileSync(filePath, "utf8");
    const fm = readFrontmatter(text);
    if (!fm) {
      errors.push(`${filePath}: missing frontmatter`);
    } else {
      if (!fmValue(fm, "description"))
        errors.push(`${filePath}: missing 'description' in frontmatter`);
      const mode = fmValue(fm, "mode");
      if (!mode)
        errors.push(`${filePath}: missing 'mode' in frontmatter (expected agent)`);
      else if (!["agent", "ask", "edit"].includes(mode))
        errors.push(`${filePath}: invalid mode "${mode}"`);
    }
    checkUnknownTools(filePath, text);
  }

  // Instructions
  for (const filePath of listFiles(INSTRUCTIONS_DIR, ".instructions.md")) {
    const text = readFileSync(filePath, "utf8");
    const fm = readFrontmatter(text);
    if (!fmValue(fm, "applyTo"))
      errors.push(`${filePath}: missing 'applyTo' in frontmatter`);
    checkUnknownTools(filePath, text);
  }

  // Hook scripts
  for (const filePath of walk(HOOK_SCRIPTS_DIR, (f) => f.endsWith(".sh"))) {
    checkUnknownTools(filePath, readFileSync(filePath, "utf8"));
  }

  const skillCount = existsSync(SKILLS_DIR)
    ? readdirSync(SKILLS_DIR).filter((d) =>
      statSync(join(SKILLS_DIR, d)).isDirectory(),
    ).length
    : 0;
  const counts = `${agentFiles.length} agents, ${listFiles(PROMPTS_DIR, ".prompt.md").length} prompts, ${skillCount} skills`;

  if (errors.length > 0) {
    console.error("Specky primitive audit failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(2);
  }

  console.log(
    `Specky primitive audit passed (${counts}, ${known.size} known tools).`,
  );
}

main();
