/**
 * FileManager — All disk I/O goes through here.
 * Path sanitization, atomic writes, directory scanning.
 */

import { mkdir, readFile, writeFile, readdir, stat, rename, access, unlink } from "node:fs/promises";
import { join, resolve, relative, basename, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_SPEC_DIR, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_SCAN_DEPTH, MAX_SCAN_DEPTH } from "../constants.js";
import type { DirectoryTree, FeatureInfo } from "../types.js";

export class FileManager {
  private readonly root: string;

  constructor(workspaceRoot: string) {
    this.root = resolve(workspaceRoot);
  }

  get workspaceRoot(): string {
    return this.root;
  }

  /**
   * Sanitize a relative path — rejects ".." traversal and absolute paths.
   * Returns resolved absolute path within workspace.
   */
  sanitizePath(relativePath: string): string {
    if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
      throw new Error(`Absolute paths are not allowed: ${relativePath}`);
    }
    if (relativePath.includes("..")) {
      throw new Error(`Path traversal is not allowed: ${relativePath}`);
    }
    const resolved = resolve(this.root, relativePath);
    if (!resolved.startsWith(this.root)) {
      throw new Error(`Path escapes workspace root: ${relativePath}`);
    }
    return resolved;
  }

  /**
   * Ensure the spec directory exists, creating it if needed.
   */
  async ensureSpecDir(specDir: string = DEFAULT_SPEC_DIR): Promise<string> {
    const absPath = this.sanitizePath(specDir);
    await mkdir(absPath, { recursive: true });
    return absPath;
  }

  /**
   * Write a spec file atomically (temp file + rename).
   * Creates parent directories as needed.
   * Refuses to overwrite unless force=true.
   */
  async writeSpecFile(
    featureDir: string,
    fileName: string,
    content: string,
    force: boolean = false
  ): Promise<string> {
    const absPath = this.sanitizePath(join(featureDir, fileName));

    if (!force) {
      const exists = await this.pathExists(absPath);
      if (exists) {
        throw new Error(
          `File already exists: ${relative(this.root, absPath)}. Use force: true to overwrite.`
        );
      }
    }

    // Ensure parent directory exists
    await mkdir(dirname(absPath), { recursive: true });

    // Atomic write: write to temp, then rename
    const tempPath = `${absPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, content, "utf-8");
      await rename(tempPath, absPath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }

    return absPath;
  }

  /**
   * Read a spec file from a feature directory.
   */
  async readSpecFile(featureDir: string, fileName: string): Promise<string> {
    const absPath = this.sanitizePath(join(featureDir, fileName));
    return readFile(absPath, "utf-8");
  }

  /**
   * Check if a relative path exists.
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const absPath = this.sanitizePath(relativePath);
    return this.pathExists(absPath);
  }

  /**
   * List all files in a feature directory.
   */
  async listSpecFiles(featureDir: string): Promise<string[]> {
    const absPath = this.sanitizePath(featureDir);
    try {
      const entries = await readdir(absPath);
      return entries.filter((e) => !e.startsWith("."));
    } catch {
      return [];
    }
  }

  /**
   * List all feature directories in a spec dir.
   */
  async listFeatures(specDir: string = DEFAULT_SPEC_DIR): Promise<FeatureInfo[]> {
    const absPath = this.sanitizePath(specDir);
    const features: FeatureInfo[] = [];

    try {
      const entries = await readdir(absPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && /^\d{3}-/.test(entry.name)) {
          const featureDir = join(specDir, entry.name);
          const match = entry.name.match(/^(\d{3})-(.+)$/);
          if (match) {
            const files = await this.listSpecFiles(featureDir);
            features.push({
              number: match[1],
              name: match[2],
              directory: featureDir,
              files,
            });
          }
        }
      }
    } catch {
      // Spec dir doesn't exist yet
    }

    return features.sort((a, b) => a.number.localeCompare(b.number));
  }

  /**
   * Scan a directory recursively up to a depth limit.
   */
  async scanDirectory(
    dir: string = ".",
    depth: number = DEFAULT_SCAN_DEPTH,
    exclude: readonly string[] = DEFAULT_EXCLUDE_PATTERNS
  ): Promise<DirectoryTree> {
    const clampedDepth = Math.min(depth, MAX_SCAN_DEPTH);
    const absPath = this.sanitizePath(dir);
    return this.scanRecursive(absPath, basename(absPath) || ".", clampedDepth, exclude);
  }

  /**
   * Read a project file by relative path.
   */
  async readProjectFile(relativePath: string): Promise<string> {
    const absPath = this.sanitizePath(relativePath);
    return readFile(absPath, "utf-8");
  }

  /**
   * List files in a directory matching given extensions.
   */
  async listFilesByExtension(
    dir: string,
    extensions: readonly string[]
  ): Promise<string[]> {
    const absPath = this.sanitizePath(dir);
    try {
      const entries = await readdir(absPath, { withFileTypes: true });
      const matched: string[] = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (extensions.some((ext) => lower.endsWith(ext))) {
            matched.push(join(dir, entry.name));
          }
        }
      }
      return matched.sort();
    } catch {
      return [];
    }
  }

  // --- Private helpers ---

  private async pathExists(absPath: string): Promise<boolean> {
    try {
      await access(absPath);
      return true;
    } catch {
      return false;
    }
  }

  private async scanRecursive(
    absPath: string,
    name: string,
    depth: number,
    exclude: readonly string[]
  ): Promise<DirectoryTree> {
    const stats = await stat(absPath);

    if (!stats.isDirectory()) {
      return { name, type: "file" };
    }

    if (depth <= 0) {
      return { name, type: "directory" };
    }

    const entries = await readdir(absPath, { withFileTypes: true });
    const children: DirectoryTree[] = [];

    for (const entry of entries) {
      if (exclude.includes(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      const childPath = join(absPath, entry.name);
      children.push(
        await this.scanRecursive(childPath, entry.name, depth - 1, exclude)
      );
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { name, type: "directory", children };
  }
}
