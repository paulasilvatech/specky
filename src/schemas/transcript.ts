/**
 * Zod schemas for transcript automation tools.
 */

import { z } from "zod";
import { specDirSchema } from "./common.js";

export const importTranscriptInputSchema = z.object({
  file_path: z
    .string()
    .min(1)
    .describe("Path to transcript file (.vtt, .srt, .txt, .md) relative to workspace root"),
  raw_text: z
    .string()
    .optional()
    .describe("Raw transcript text (alternative to file_path — paste directly)"),
  format: z
    .enum(["vtt", "srt", "txt", "md", "auto"])
    .default("auto")
    .describe("Transcript format. Use 'auto' to detect from file extension or content."),
  spec_dir: specDirSchema,
}).strict();

export const autoPipelineInputSchema = z.object({
  file_path: z
    .string()
    .optional()
    .describe("Path to transcript file (.vtt, .srt, .txt, .md) relative to workspace root"),
  raw_text: z
    .string()
    .optional()
    .describe("Raw transcript text (alternative to file_path — paste directly)"),
  project_name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "Must be kebab-case")
    .describe("Project name in kebab-case"),
  format: z
    .enum(["vtt", "srt", "txt", "md", "auto"])
    .default("auto")
    .describe("Transcript format"),
  spec_dir: specDirSchema,
  principles: z
    .array(z.string())
    .optional()
    .describe("Override project principles (auto-extracted from transcript if omitted)"),
  force: z
    .boolean()
    .default(false)
    .describe("Overwrite existing spec files"),
}).strict();

export const batchTranscriptsInputSchema = z.object({
  transcripts_dir: z
    .string()
    .min(1)
    .describe("Path to folder containing transcript files (.vtt, .srt, .txt, .md) relative to workspace root. Example: 'transcripts' or 'OneDrive/Meeting Transcripts'"),
  spec_dir: specDirSchema,
  force: z
    .boolean()
    .default(false)
    .describe("Overwrite existing spec files if true"),
}).strict();
