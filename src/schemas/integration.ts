/**
 * Integration & Export Schemas — sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const createBranchInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict();

export const exportWorkItemsInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict();

export const createPrInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict();

export const implementInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  task_ids: z
    .array(z.string().min(1))
    .describe("Specific task IDs to implement; an explicit empty array selects all tasks"),
  checkpoint: z
    .boolean()
    .describe("Insert checkpoints between user story phases for manual review"),
}).strict();

export const researchInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  questions: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .describe("Unique question ID (e.g., 'RQ-001')"),
        question: z
          .string()
          .min(10)
          .describe("The research question to resolve"),
        context: z
          .string()
          .optional()
          .describe("Additional context about why this question matters"),
      }).strict()
    )
    .min(1)
    .describe("Array of research questions to investigate and resolve"),
}).strict();
