/**
 * Zod schemas for transcript automation tools.
 */

import { z } from "zod";
import { featureNumberSchema, specDirSchema } from "./common.js";
import { useCaseSelectionSchema } from "../contracts/use-case.js";
import {
  architectureContentSchema,
  constitutionContentSchema,
  preImplementationGateSchema,
  requirementContentSchema,
  taskContentSchema,
} from "./feature-content.js";

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
    .describe("Explicit transcript format; auto is an intentional detection mode"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
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
  feature_number: featureNumberSchema,
  use_case: useCaseSelectionSchema,
  constitution: constitutionContentSchema,
  requirements: z.array(requirementContentSchema).min(1),
  architecture: architectureContentSchema,
  tasks: z.array(taskContentSchema).min(1),
  pre_impl_gates: z.array(preImplementationGateSchema),
  format: z
    .enum(["vtt", "srt", "txt", "md", "auto"])
    .describe("Transcript format"),
  spec_dir: specDirSchema,
  force: z
    .boolean()
    .describe("Explicit overwrite decision"),
}).strict();

export const batchTranscriptsInputSchema = z.object({
  transcripts_dir: z
    .string()
    .min(1)
    .describe("Path to folder containing transcript files (.vtt, .srt, .txt, .md) relative to workspace root. Example: 'transcripts' or 'OneDrive/Meeting Transcripts'"),
  spec_dir: specDirSchema,
  use_case: useCaseSelectionSchema,
  features: z.array(z.object({
    file_name: z.string().min(1),
    project_name: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/),
    feature_number: featureNumberSchema,
    constitution: constitutionContentSchema,
    requirements: z.array(requirementContentSchema).min(1),
    architecture: architectureContentSchema,
    tasks: z.array(taskContentSchema).min(1),
    pre_impl_gates: z.array(preImplementationGateSchema),
  }).strict()).min(1),
  force: z
    .boolean()
    .describe("Explicit overwrite decision"),
}).strict();
