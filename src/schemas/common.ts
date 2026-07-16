/**
 * Shared Zod schemas used across multiple tools.
 */

import { z } from "zod";

/** Reject absolute paths and any parent-directory traversal. */
const isSafeRelativePath = (p: string): boolean =>
  p.length > 0 &&
  !p.startsWith("/") &&
  !p.startsWith("\\") &&
  !/^[a-zA-Z]:/.test(p) && // Windows drive-absolute (C:...)
  !p.split(/[/\\]/).includes("..") &&
  !p.includes("\0");

export const specDirSchema = z
  .string()
  .refine(isSafeRelativePath, {
    message: "spec_dir must be a workspace-relative path (no absolute paths, no '..').",
  })
  .describe("Spec directory path (relative to workspace root)");

export const featureNumberSchema = z
  .string()
  .regex(/^\d{3}$/, "Feature number must be 3 digits, e.g. '001'")
  .describe("Feature number (zero-padded, e.g. '001')");

export const forceSchema = z
  .boolean()
  .describe("Explicit overwrite decision");
