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

function copyFile(src: string, dest: string, opts: CopyOptions, result: CopyResult): void {
  if (!shouldWrite(dest, opts)) {
    result.skipped.push(dest);
    return;
  }
  if (opts.dryRun) {
    result.written.push(dest);
    return;
  }
  ensureDir(resolve(dest, ".."));
  cpSync(src, dest);
  result.written.push(dest);
}

function copyDir(
  src: string,
  dest: string,
  opts: CopyOptions,
  result: CopyResult,
  renamer?: (name: string) => string,
): void {
  if (!existsSync(src)) return;
  ensureDir(dest);
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const name = renamer ? renamer(entry) : entry;
    const destPath = resolve(dest, name);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copyDir(srcPath, destPath, opts, result, renamer);
    } else {
      copyFile(srcPath, destPath, opts, result);
    }
  }
}

/**
 * Transform `.agent.md` (Copilot format) to `.md` (Claude Code format) and
 * strip Copilot-specific frontmatter markers. For now we just rename.
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

  copyDir(src.agentsDir, targets.claude.agents, opts, result, claudeAgentRenamer);
  copyDir(src.promptsDir, targets.claude.commands, opts, result, claudePromptRenamer);
  copyDir(src.skillsDir, targets.claude.skills, opts, result);
  copyDir(src.hookScriptsDir, targets.claude.hooksScripts, opts, result);

  // Make hook scripts executable (Unix only — Windows ignores mode)
  if (!opts.dryRun && process.platform !== "win32") {
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

  copyDir(src.agentsDir, targets.copilot.agents, opts, result);
  copyDir(src.promptsDir, targets.copilot.prompts, opts, result);
  copyDir(src.skillsDir, targets.copilot.skills, opts, result);
  copyDir(src.hookScriptsDir, targets.copilot.hooksScripts, opts, result);
  copyFile(src.hooksManifest, targets.copilot.hooksManifest, opts, result);
  copyDir(src.instructionsDir, targets.copilot.instructions, opts, result);

  if (!opts.dryRun && process.platform !== "win32") {
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
