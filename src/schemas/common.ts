/**
 * Shared Zod schemas used across multiple tools.
 */

import { z } from "zod";

export const specDirSchema = z
  .string()
  .default(".specs")
  .describe("Spec directory path (relative to workspace root)");

export const featureNumberSchema = z
  .string()
  .regex(/^\d{3}$/, "Feature number must be 3 digits, e.g. '001'")
  .default("001")
  .describe("Feature number (zero-padded, e.g. '001')");

export const forceSchema = z
  .boolean()
  .default(false)
  .describe("Overwrite existing files if true");
