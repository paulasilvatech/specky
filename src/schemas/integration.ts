/**
 * Integration & Export Schemas — sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const createBranchInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  branch_prefix: z
    .string()
    .default("feature/")
    .describe("Branch name prefix (e.g., 'feature/', 'feat/', 'spec/')"),
  base_branch: z
    .string()
    .default("main")
    .describe("Base branch to create from"),
}).strict();

export const exportWorkItemsInputSchema = z.object({
  platform: z
    .enum(["github", "azure_boards", "jira"])
    .describe("Target platform for work item export"),
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  include_subtasks: z
    .boolean()
    .default(true)
    .describe("Include subtasks for each top-level work item"),
  project_key: z
    .string()
    .optional()
    .describe("Jira project key (required for Jira platform)"),
  area_path: z
    .string()
    .optional()
    .describe("Azure DevOps area path (optional for Azure Boards)"),
  iteration_path: z
    .string()
    .optional()
    .describe("Azure DevOps iteration path (optional for Azure Boards)"),
}).strict();

export const createPrInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  base_branch: z
    .string()
    .default("main")
    .describe("Target branch for the PR"),
  head_branch: z
    .string()
    .optional()
    .describe("Source branch for the PR. Auto-generated from feature number if omitted"),
  draft: z
    .boolean()
    .default(false)
    .describe("Create as draft PR"),
}).strict();

export const implementInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  task_ids: z
    .array(z.string().min(1))
    .optional()
    .describe("Specific task IDs to implement. If omitted, generates plan for all tasks"),
  checkpoint: z
    .boolean()
    .default(true)
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
