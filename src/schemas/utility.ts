/**
 * Zod schemas for all 6 utility tool inputs.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema, forceSchema } from "./common.js";
import { TEMPLATE_NAMES } from "../constants.js";

export const getStatusInputSchema = z.object({
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();

export const getTemplateInputSchema = z.object({
  template_name: z
    .enum(TEMPLATE_NAMES)
    .describe("Name of the template to retrieve"),
}).strict();

export const writeBugfixInputSchema = z.object({
  bug_title: z
    .string()
    .min(1)
    .max(200)
    .describe("Short title describing the bug"),
  current_behavior: z
    .string()
    .min(1)
    .describe("What currently happens (the bug)"),
  expected_behavior: z
    .string()
    .min(1)
    .describe("What should happen instead"),
  unchanged_behavior: z
    .array(z.string())
    .optional()
    .describe("Behaviors that must remain unchanged after the fix"),
  root_cause: z
    .string()
    .optional()
    .describe("Root cause analysis (if known)"),
  test_plan: z
    .string()
    .optional()
    .describe("How to verify the fix"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();

export const checkSyncInputSchema = z.object({
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
  code_paths: z
    .array(z.string())
    .optional()
    .describe("Paths to implementation files to check against spec"),
}).strict();

export const scanCodebaseInputSchema = z.object({
  depth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .describe("Scan depth (1-5, default 3)"),
  exclude: z
    .array(z.string())
    .optional()
    .describe("Glob patterns to exclude (defaults to node_modules, .git, dist)"),
}).strict();

export const amendInputSchema = z.object({
  rationale: z
    .string()
    .min(1)
    .describe("Why this amendment is needed"),
  articles_affected: z
    .array(z.string())
    .min(1)
    .describe("Which Constitution articles are affected"),
  changes_description: z
    .string()
    .min(1)
    .describe("Description of the changes"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();
