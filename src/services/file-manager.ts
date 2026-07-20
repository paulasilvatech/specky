/**
 * FileManager — All disk I/O goes through here.
 * Path sanitization, atomic writes, directory scanning.
 */

import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { MAX_SCAN_DEPTH } from "../constants.js";
import type { DirectoryTree, FeatureInfo } from "../types.js";

interface BulkWriteTarget {
  directory: string;
  fileName: string;
  content: string;
  absolutePath: string;
}

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
    // Reject absolute paths on every OS: POSIX ("/…"), UNC/Windows-separator
    // ("\…"), and Windows drive-absolute ("C:\…"). The drive-letter form is not
    // caught by a "/" or "\" prefix check and slips through on POSIX runtimes
    // too, so guard it explicitly — mirrors the Zod specDirSchema guard.
    if (
      relativePath.startsWith("/") ||
      relativePath.startsWith("\\") ||
      /^[a-zA-Z]:/.test(relativePath)
    ) {
      throw new Error(`Absolute paths are not allowed: ${relativePath}`);
    }
    if (relativePath.includes("..")) {
      throw new Error(`Path traversal is not allowed: ${relativePath}`);
    }
    const resolved = resolve(this.root, relativePath);
    if (resolved !== this.root && !resolved.startsWith(this.root + sep)) {
      throw new Error(`Path escapes workspace root: ${relativePath}`);
    }
    return resolved;
  }

  /**
   * Ensure the spec directory exists, creating it if needed.
   */
  async ensureSpecDir(specDir: string): Promise<string> {
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
    force: boolean,
  ): Promise<string> {
    const absPath = this.sanitizePath(join(featureDir, fileName));

    if (!force) {
      const exists = await this.pathExists(absPath);
      if (exists) {
        throw new Error(
          `File already exists: ${relative(this.root, absPath)}. Use force: true to overwrite.`,
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
   * Write a set of files as one rollback-safe operation. All conflicts are
   * checked before writes; any failure restores the original bytes.
   */
  async writeSpecFiles(
    files: Array<{ directory: string; fileName: string; content: string }>,
    force: boolean,
  ): Promise<string[]> {
    const targets = files.map((file) => ({
      ...file,
      absolutePath: this.sanitizePath(join(file.directory, file.fileName)),
    }));
    if (new Set(targets.map((target) => target.absolutePath)).size !== targets.length) {
      throw new Error("Bulk write contains duplicate target paths.");
    }

    const snapshots = await this.preflightBulkWrite(targets, force);
    const temporaryPaths = await this.stageBulkWrite(targets);
    try {
      for (let index = 0; index < targets.length; index++) {
        await rename(temporaryPaths[index], targets[index].absolutePath);
      }
      return targets.map((target) => target.absolutePath);
    } catch (error) {
      await this.rollbackBulkWrite(temporaryPaths, snapshots);
      throw error;
    }
  }

  private async preflightBulkWrite(
    targets: BulkWriteTarget[],
    force: boolean,
  ): Promise<Map<string, Buffer | null>> {
    const snapshots = new Map<string, Buffer | null>();
    for (const target of targets) {
      const exists = await this.pathExists(target.absolutePath);
      if (exists && !force) {
        throw new Error(
          `File already exists: ${relative(this.root, target.absolutePath)}. Use force: true to overwrite.`,
        );
      }
      snapshots.set(target.absolutePath, exists ? await readFile(target.absolutePath) : null);
    }
    return snapshots;
  }

  private async stageBulkWrite(targets: BulkWriteTarget[]): Promise<string[]> {
    const temporaryPaths: string[] = [];
    try {
      for (const target of targets) {
        await mkdir(dirname(target.absolutePath), { recursive: true });
        const temporaryPath = `${target.absolutePath}.${randomUUID()}.tmp`;
        temporaryPaths.push(temporaryPath);
        await writeFile(temporaryPath, target.content, "utf-8");
      }
      return temporaryPaths;
    } catch (error) {
      for (const temporaryPath of temporaryPaths) {
        try {
          await unlink(temporaryPath);
        } catch {
          /* absent */
        }
      }
      throw error;
    }
  }

  private async rollbackBulkWrite(
    temporaryPaths: string[],
    snapshots: Map<string, Buffer | null>,
  ): Promise<void> {
    for (const temporaryPath of temporaryPaths) {
      try {
        await unlink(temporaryPath);
      } catch {
        /* already renamed or absent */
      }
    }
    for (const [absolutePath, original] of snapshots) {
      if (original === null) {
        try {
          await unlink(absolutePath);
        } catch {
          /* absent */
        }
        continue;
      }
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, original);
    }
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
      return entries.filter((e) => !e.startsWith(".")).sort();
    } catch {
      return [];
    }
  }

  /**
   * List all feature directories in a spec dir.
   */
  async listFeatures(specDir: string): Promise<FeatureInfo[]> {
    const absPath = this.sanitizePath(specDir);
    const features: FeatureInfo[] = [];

    try {
      const entries = await readdir(absPath, { withFileTypes: true });
      const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of sortedEntries) {
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
    dir: string,
    depth: number,
    exclude: readonly string[],
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
   * Read a project file as bytes by relative path.
   */
  async readProjectFileBuffer(relativePath: string): Promise<Buffer> {
    const absPath = this.sanitizePath(relativePath);
    return readFile(absPath);
  }

  /**
   * List files in a directory matching given extensions.
   */
  async listFilesByExtension(dir: string, extensions: readonly string[]): Promise<string[]> {
    const absPath = this.sanitizePath(dir);
    try {
      const entries = await readdir(absPath, { withFileTypes: true });
      const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
      const matched: string[] = [];
      for (const entry of sortedEntries) {
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
    exclude: readonly string[],
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
      children.push(await this.scanRecursive(childPath, entry.name, depth - 1, exclude));
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { name, type: "directory", children };
  }
}
