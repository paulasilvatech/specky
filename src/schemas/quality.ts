/**
 * Quality & Validation Schemas — sdd_checklist, sdd_verify_tasks, sdd_compliance_check, sdd_cross_analyze.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema, forceSchema } from "./common.js";

export const checklistInputSchema = z.object({
  domain: z
    .enum(["security", "accessibility", "performance", "testing", "documentation", "deployment", "general"])
    .describe("Quality domain for the checklist"),
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  force: forceSchema,
}).strict().describe("Generate a mandatory quality checklist for the specified domain. Writes CHECKLIST.md.");

export const verifyTasksInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  code_paths: z
    .array(z.string().min(1))
    .min(1)
    .describe("Array of code file/directory paths to check for task implementation evidence"),
}).strict().describe("Verify task completions against actual code. Detects phantom completions (tasks marked done with no code evidence). Writes VERIFICATION.md.");

export const complianceCheckInputSchema = z.object({
  framework: z
    .enum(["hipaa", "soc2", "gdpr", "pci_dss", "iso27001", "general"])
    .describe("Compliance framework to validate against"),
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Validate specification and design against compliance framework controls. Writes COMPLIANCE.md.");

export const crossAnalyzeInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Cross-artifact consistency analysis: checks alignment between SPECIFICATION.md, DESIGN.md, and TASKS.md. Finds orphaned requirements, missing designs, and untraced tasks. Writes CROSS_ANALYSIS.md.");

export const validateEarsInputSchema = z.object({
  requirements: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe("Array of requirement statements to validate directly. If omitted, reads requirements from SPECIFICATION.md"),
  feature_number: z
    .string()
    .regex(/^\d{3}$/, "Feature number must be 3 digits, e.g. '001'")
    .optional()
    .describe("Feature number whose SPECIFICATION.md will be scanned for requirements (e.g. '001'). Required when requirements is not provided"),
  spec_dir: specDirSchema,
}).strict().describe("Validate requirement statements against EARS notation patterns. Returns per-requirement EARS compliance results with actionable suggestions for non-conforming statements.");
