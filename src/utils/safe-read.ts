/**
 * Shared tolerant reader for optional spec artifacts (DESIGN.md, TASKS.md,
 * CHECKLIST.md, ...). Generators and analyzers treat a missing or unreadable
 * artifact as absent rather than fatal, so they all used to carry a local
 * safeRead copy — this is the single home for that behavior.
 */
import type { FileManager } from "../services/file-manager.js";

/** Read a spec artifact, returning an empty string when it cannot be read. */
export async function readSpecFileOrEmpty(
  fileManager: FileManager,
  featureDir: string,
  fileName: string,
): Promise<string> {
  try {
    return await fileManager.readSpecFile(featureDir, fileName);
  } catch {
    return "";
  }
}
