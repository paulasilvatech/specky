/**
 * asset-copier.ts — Copy plugin assets from the package into a user workspace.
 *
 * Responsible for placing agents/prompts/skills/hooks/instructions into the
 * IDE-specific target directories (`.claude/` for Claude Code, `.github/` for
 * GitHub Copilot).
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { basename, resolve, relative } from "node:path";
import type { Targets } from "./paths.js";
import { sourcePaths } from "./paths.js";

export interface CopyResult {
  written: string[];
  skipped: string[];
}

export interface CopyOptions {
  force: boolean;
  dryRun: boolean;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function shouldWrite(dest: string, opts: CopyOptions): boolean {
  if (opts.force) return true;
  return !existsSync(dest);
}

function copyFile(
  src: string,
  dest: string,
  opts: CopyOptions,
  result: CopyResult,
  transformer?: FileTransformer,
): void {
  if (!shouldWrite(dest, opts)) {
    result.skipped.push(dest);
    return;
  }
  if (opts.dryRun) {
    result.written.push(dest);
    return;
  }
  ensureDir(resolve(dest, ".."));
  if (transformer) {
    const content = readFileSync(src, "utf8");
    writeFileSync(dest, transformer(content, src, dest), "utf8");
  } else {
    cpSync(src, dest);
  }
  result.written.push(dest);
}

type FileTransformer = (content: string, src: string, dest: string) => string;

function copyTextFile(
  src: string,
  dest: string,
  opts: CopyOptions,
  result: CopyResult,
  transformer: FileTransformer,
): void {
  if (!shouldWrite(dest, opts)) {
    result.skipped.push(dest);
    return;
  }
  if (opts.dryRun) {
    result.written.push(dest);
    return;
  }
  ensureDir(resolve(dest, ".."));
  const content = readFileSync(src, "utf8");
  writeFileSync(dest, transformer(content, src, dest), "utf8");
  result.written.push(dest);
}

function copyDir(
  src: string,
  dest: string,
  opts: CopyOptions,
  result: CopyResult,
  renamer?: (name: string) => string,
  transformer?: FileTransformer,
): void {
  if (!existsSync(src)) return;
  ensureDir(dest);
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const name = renamer ? renamer(entry) : entry;
    const destPath = resolve(dest, name);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copyDir(srcPath, destPath, opts, result, renamer, transformer);
    } else {
      if (transformer) copyTextFile(srcPath, destPath, opts, result, transformer);
      else copyFile(srcPath, destPath, opts, result);
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseToolArray(tools: string): string[] {
  const trimmed = tools.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Fall through to the comma parser below.
    }
  }
  return trimmed
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((token) => token.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function transformToolsLine(
  content: string,
  mapper: (tool: string) => string[],
  format: "json-array" | "comma-list",
): string {
  return content.replace(/^tools:\s*(.+)$/m, (_line, rawTools: string) => {
    const mapped = unique(parseToolArray(rawTools).flatMap(mapper));
    if (format === "comma-list") return `tools: ${mapped.join(", ")}`;
    return `tools: ${JSON.stringify(mapped)}`;
  });
}

function toCopilotTool(tool: string): string[] {
  if (tool.startsWith("specky/")) return [tool];
  if (tool.startsWith("mcp__specky__")) {
    return [`specky/${tool.slice("mcp__specky__".length)}`];
  }
  if (tool.startsWith("sdd_")) return [`specky/${tool}`];

  switch (tool) {
    case "Read":
    case "Glob":
    case "Grep":
    case "search":
      return ["search"];
    case "Edit":
    case "Write":
    case "MultiEdit":
    case "edit":
      return ["edit"];
    case "Bash":
    case "runCommands":
      return ["runCommands"];
    case "WebFetch":
    case "WebSearch":
    case "fetch":
      return ["fetch"];
    case "Task":
    case "agent":
      return ["agent"];
    case "TodoWrite":
    case "todos":
      return ["todos"];
    default:
      return [tool];
  }
}

function toClaudeTool(tool: string): string[] {
  if (tool.startsWith("mcp__specky__")) return [tool];
  if (tool.startsWith("specky/")) {
    return [`mcp__specky__${tool.slice("specky/".length)}`];
  }
  if (tool.startsWith("sdd_")) return [`mcp__specky__${tool}`];

  switch (tool) {
    case "search":
      return ["Read", "Glob", "Grep"];
    case "edit":
      return ["Edit", "Write"];
    case "runCommands":
      return ["Bash"];
    case "fetch":
      return ["WebFetch", "WebSearch"];
    case "agent":
      return ["Task"];
    case "todos":
      return ["TodoWrite"];
    default:
      return [tool];
  }
}

function toCopilotAgent(content: string): string {
  return transformToolsLine(content, toCopilotTool, "json-array");
}

function toClaudeAgent(content: string): string {
  return transformToolsLine(content, toClaudeTool, "comma-list");
}

function toCopilotPrompt(content: string): string {
  if (/^agent:/m.test(content)) return content.replace(/^mode:\s*agent\s*$/m, "");
  return content.replace(/^mode:\s*agent\s*$/m, "agent: agent");
}

function toClaudePrompt(content: string): string {
  return content
    .replace(/^agent:\s*agent\s*\n/m, "")
    .replace(/^mode:\s*agent\s*\n/m, "");
}

function toClaudeInstruction(content: string): string {
  return content.replace(/^applyTo:\s*['"]?\*\*['"]?\s*$/m, "paths: ['**']");
}

/**
 * Transform `.agent.md` (Copilot format) to `.md` (Claude Code format).
 */
function claudeAgentRenamer(fileName: string): string {
  return fileName.replace(/\.agent\.md$/, ".md");
}

function claudePromptRenamer(fileName: string): string {
  return fileName.replace(/\.prompt\.md$/, ".md");
}

/**
 * Copy assets to Claude Code `.claude/` layout.
 */
export function copyToClaude(
  pkgRoot: string,
  targets: Targets,
  opts: CopyOptions,
): CopyResult {
  const src = sourcePaths(pkgRoot);
  const result: CopyResult = { written: [], skipped: [] };

  copyDir(src.agentsDir, targets.claude.agents, opts, result, claudeAgentRenamer, toClaudeAgent);
  copyDir(src.promptsDir, targets.claude.commands, opts, result, claudePromptRenamer, toClaudePrompt);
  copyDir(src.skillsDir, targets.claude.skills, opts, result);
  copyDir(src.hookScriptsDir, targets.claude.hooksScripts, opts, result);

  // Make hook scripts executable (Unix only — Windows ignores mode)
  if (
    !opts.dryRun &&
    process.platform !== "win32" &&
    existsSync(targets.claude.hooksScripts)
  ) {
    for (const f of readdirSync(targets.claude.hooksScripts)) {
      if (f.endsWith(".sh") || f.endsWith(".mjs")) {
        try {
          chmodSync(resolve(targets.claude.hooksScripts, f), 0o755);
        } catch {
          // ignore
        }
      }
    }
  }

  // Copy copilot-instructions to .claude/rules/
  const instructionSrc = resolve(
    src.instructionsDir,
    "copilot-instructions.instructions.md",
  );
  if (existsSync(instructionSrc)) {
    copyFile(
      instructionSrc,
      resolve(targets.claude.rules, "copilot-instructions.md"),
      opts,
      result,
      toClaudeInstruction,
    );
  }

  return result;
}

/**
 * Copy assets to GitHub Copilot `.github/` layout.
 */
export function copyToCopilot(
  pkgRoot: string,
  targets: Targets,
  opts: CopyOptions,
): CopyResult {
  const src = sourcePaths(pkgRoot);
  const result: CopyResult = { written: [], skipped: [] };

  copyDir(src.agentsDir, targets.copilot.agents, opts, result, undefined, toCopilotAgent);
  copyDir(src.promptsDir, targets.copilot.prompts, opts, result, undefined, toCopilotPrompt);
  copyDir(src.skillsDir, targets.copilot.skills, opts, result);
  copyDir(src.hookScriptsDir, targets.copilot.hooksScripts, opts, result);

  // rc.14: Remove stale pre-rc.12 hooks manifest at .github/hooks/specky-sdd-hooks.json.
  // Old installs placed it there with broken ${CLAUDE_PLUGIN_ROOT} paths. Copilot loads
  // ALL .json files in .github/hooks/ so the broken one causes spurious blocks.
  const staleManifest = resolve(targets.copilot.hooksRoot, "..", "specky-sdd-hooks.json");
  if (!opts.dryRun && existsSync(staleManifest)) {
    try { unlinkSync(staleManifest); } catch { /* ignore — might be read-only */ }
  }

  // IMPORTANT: only ship the build-time copilot-hooks.json (paths already
  // resolved to .github/hooks/specky/scripts/). NEVER fall back to the raw
  // .apm/hooks/sdd-hooks.json — it still contains ${CLAUDE_PLUGIN_ROOT}, which
  // Copilot cannot resolve and which causes spurious hook blocks. See rc.12/rc.14.
  if (existsSync(src.copilotHooksManifest)) {
    copyFile(src.copilotHooksManifest, targets.copilot.hooksManifest, opts, result);
  } else {
    result.skipped.push(targets.copilot.hooksManifest);
    if (!opts.dryRun) {
      console.warn(
        "[specky] Skipped Copilot hooks manifest: dist/copilot-hooks.json is missing. " +
        "Run `npm run build` to generate it; SDD hook automation stays disabled until then.",
      );
    }
  }
  copyDir(src.instructionsDir, targets.copilot.instructions, opts, result);

  if (
    !opts.dryRun &&
    process.platform !== "win32" &&
    existsSync(targets.copilot.hooksScripts)
  ) {
    for (const f of readdirSync(targets.copilot.hooksScripts)) {
      if (f.endsWith(".sh") || f.endsWith(".mjs")) {
        try {
          chmodSync(resolve(targets.copilot.hooksScripts, f), 0o755);
        } catch {
          // ignore
        }
      }
    }
  }

  return result;
}

/**
 * Compute SHA256 of every copied file so `specky doctor` can detect drift.
 */
export function hashFile(path: string): string {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

export function writeInstallLock(
  targets: Targets,
  copied: CopyResult[],
  version: string,
  opts: CopyOptions,
): string {
  const entries: Record<string, string> = {};
  for (const r of copied) {
    for (const p of r.written) {
      try {
        if (statSync(p).isFile()) {
          entries[relative(targets.shared.specky, p)] = hashFile(p);
        }
      } catch {
        // ignore
      }
    }
  }
  const lock = {
    version,
    generated_at: new Date().toISOString(),
    files: entries,
  };
  const lockPath = resolve(targets.shared.specky, "install.lock");
  if (!opts.dryRun) {
    ensureDir(targets.shared.specky);
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
  }
  return lockPath;
}

export function summarizeCopy(name: string, r: CopyResult): string {
  return `  ${name}: ${r.written.length} written, ${r.skipped.length} skipped`;
}

// Re-export basename for callers
export { basename };
