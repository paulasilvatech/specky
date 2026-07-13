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
import { basename, resolve, relative, sep } from "node:path";
import type { Targets } from "./paths.js";
import { sourcePaths } from "./paths.js";
import { getCompiler } from "./harness/index.js";

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
    } else if (transformer) {
      copyTextFile(srcPath, destPath, opts, result, transformer);
    } else {
      copyFile(srcPath, destPath, opts, result);
    }
  }
}

function chmodHookScripts(dir: string, opts: CopyOptions): void {
  if (opts.dryRun || process.platform === "win32" || !existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".sh") || f.endsWith(".mjs")) {
      try {
        chmodSync(resolve(dir, f), 0o755);
      } catch {
        // ignore
      }
    }
  }
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
  const claude = getCompiler("claude");

  copyDir(src.agentsDir, targets.claude.agents, opts, result, claude.renameAgent, claude.compileAgent);
  copyDir(src.promptsDir, targets.claude.commands, opts, result, claude.renamePrompt, claude.compilePrompt);
  copyDir(src.skillsDir, targets.claude.skills, opts, result);
  copyDir(src.hookScriptsDir, targets.claude.hooksScripts, opts, result);

  chmodHookScripts(targets.claude.hooksScripts, opts);

  // Install the Specky rule to .claude/rules/. Prefer the dedicated Claude
  // instruction primitive; fall back to the Copilot one only if it is absent.
  const staleClaudeRule = resolve(targets.claude.rules, "copilot-instructions.md");
  if (!opts.dryRun && existsSync(staleClaudeRule)) {
    try { unlinkSync(staleClaudeRule); } catch { /* ignore — might be read-only */ }
  }

  const claudeInstructionSrc = resolve(src.instructionsDir, "claude-instructions.instructions.md");
  const fallbackInstructionSrc = resolve(src.instructionsDir, "copilot-instructions.instructions.md");
  const instructionSrc = existsSync(claudeInstructionSrc) ? claudeInstructionSrc : fallbackInstructionSrc;
  if (existsSync(instructionSrc)) {
    copyFile(
      instructionSrc,
      resolve(targets.claude.rules, "specky-sdd.md"),
      opts,
      result,
      claude.compileInstruction,
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
  const copilot = getCompiler("copilot");

  copyDir(src.agentsDir, targets.copilot.agents, opts, result, copilot.renameAgent, copilot.compileAgent);
  copyDir(src.promptsDir, targets.copilot.prompts, opts, result, copilot.renamePrompt, copilot.compilePrompt);
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
  // Install ONLY the Copilot instruction primitive. Never copy the whole
  // instructions dir — it also contains cursor/claude primitives that would
  // leak non-Copilot naming (and stray applyTo files) into .github/instructions/.
  for (const stale of ["cursor-instructions.instructions.md", "claude-instructions.instructions.md"]) {
    const stalePath = resolve(targets.copilot.instructions, stale);
    if (!opts.dryRun && existsSync(stalePath)) {
      try { unlinkSync(stalePath); } catch { /* ignore — might be read-only */ }
    }
  }
  const copilotInstruction = resolve(src.instructionsDir, "copilot-instructions.instructions.md");
  if (existsSync(copilotInstruction)) {
    copyFile(
      copilotInstruction,
      resolve(targets.copilot.instructions, "copilot-instructions.instructions.md"),
      opts,
      result,
      copilot.compileInstruction,
    );
  }

  chmodHookScripts(targets.copilot.hooksScripts, opts);

  return result;
}

/**
 * Copy assets to Cursor `.cursor/` layout.
 */
export function copyToCursor(
  pkgRoot: string,
  targets: Targets,
  opts: CopyOptions,
): CopyResult {
  const src = sourcePaths(pkgRoot);
  const result: CopyResult = { written: [], skipped: [] };
  const cursor = getCompiler("cursor");

  copyDir(src.agentsDir, targets.cursor.agents, opts, result, cursor.renameAgent, cursor.compileAgent);
  copyDir(src.promptsDir, targets.cursor.commands, opts, result, cursor.renamePrompt, cursor.compilePrompt);
  copyDir(src.skillsDir, targets.shared.agentSkills, opts, result);

  const staleRule = resolve(targets.cursor.rules, "copilot-instructions.mdc");
  if (!opts.dryRun && existsSync(staleRule)) {
    try { unlinkSync(staleRule); } catch { /* ignore — might be read-only */ }
  }

  const cursorInstructionSrc = resolve(src.instructionsDir, "cursor-instructions.instructions.md");
  const fallbackInstructionSrc = resolve(src.instructionsDir, "copilot-instructions.instructions.md");
  const instructionSrc = existsSync(cursorInstructionSrc) ? cursorInstructionSrc : fallbackInstructionSrc;
  if (existsSync(instructionSrc)) {
    copyFile(
      instructionSrc,
      resolve(targets.cursor.rules, "specky-sdd.mdc"),
      opts,
      result,
      cursor.compileInstruction,
    );
  }

  copyDir(src.hookScriptsDir, targets.cursor.hooksScripts, opts, result);
  if (existsSync(src.speckyRunScript)) {
    copyFile(src.speckyRunScript, targets.cursor.hooksRunner, opts, result);
  }
  if (existsSync(src.cursorHooksManifest)) {
    copyFile(src.cursorHooksManifest, targets.cursor.hooksManifest, opts, result);
  } else {
    result.skipped.push(targets.cursor.hooksManifest);
    if (!opts.dryRun) {
      console.warn(
        "[specky] Skipped Cursor hooks manifest: dist/cursor-hooks.json is missing. " +
        "Run `npm run build` to generate it; Cursor hook automation stays disabled until then.",
      );
    }
  }

  chmodHookScripts(targets.cursor.hooksScripts, opts);
  chmodHookScripts(resolve(targets.cursor.hooksRunner, ".."), opts);

  return result;
}

/**
 * Copy assets to OpenCode `.opencode/` layout. OpenCode has no hooks concept,
 * so Specky hook primitives are intentionally skipped for this target.
 */
export function copyToOpenCode(
  pkgRoot: string,
  targets: Targets,
  opts: CopyOptions,
): CopyResult {
  const src = sourcePaths(pkgRoot);
  const result: CopyResult = { written: [], skipped: [] };
  const opencode = getCompiler("opencode");

  copyDir(src.agentsDir, targets.opencode.agents, opts, result, opencode.renameAgent, opencode.compileAgent);
  copyDir(src.promptsDir, targets.opencode.commands, opts, result, opencode.renamePrompt, opencode.compilePrompt);
  copyDir(src.skillsDir, targets.shared.agentSkills, opts, result);

  return result;
}

/**
 * Copy neutral Agent Skills to the cross-client `.agents/skills/` directory.
 */
export function copyToAgentSkills(
  pkgRoot: string,
  targets: Targets,
  opts: CopyOptions,
): CopyResult {
  const src = sourcePaths(pkgRoot);
  const result: CopyResult = { written: [], skipped: [] };

  copyDir(src.skillsDir, targets.shared.agentSkills, opts, result);

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
          entries[relative(targets.shared.specky, p).split(sep).join("/")] = hashFile(p);
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
