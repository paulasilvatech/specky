/**
 * Zod schemas for all 6 utility tool inputs.
 */

import { z } from "zod";
import { TEMPLATE_NAMES } from "../constants.js";
import { featureNumberSchema, forceSchema, specDirSchema } from "./common.js";

const tddBindingSchema = z
  .object({
    requirement_id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
    test_name: z.string().min(1),
    body: z.string().min(10),
  })
  .strict();

const tddPropertyBindingSchema = z
  .object({
    requirement_id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
    property_name: z.string().min(1),
    property_type: z.enum([
      "invariant",
      "state_transition",
      "conditional",
      "negative",
      "round_trip",
      "idempotence",
      "commutativity",
      "monotonicity",
    ]),
    body: z.string().min(20),
  })
  .strict();

export const tddAmendmentSchema = z
  .object({
    imports: z.string().min(1).optional(),
    bindings: z.array(tddBindingSchema).min(1).optional(),
    property_imports: z.string().min(1).optional(),
    property_bindings: z.array(tddPropertyBindingSchema).min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "TDD amendment must replace at least one configured field.",
  });

export const getStatusInputSchema = z.discriminatedUnion("view", [
  z
    .object({
      view: z.literal("workspace"),
      spec_dir: specDirSchema,
    })
    .strict(),
  z
    .object({
      view: z.literal("feature"),
      spec_dir: specDirSchema,
      feature_number: featureNumberSchema,
    })
    .strict(),
]);

export const getTemplateInputSchema = z
  .object({
    template_name: z.enum(TEMPLATE_NAMES).describe("Name of the template to retrieve"),
  })
  .strict();

export const writeBugfixInputSchema = z
  .object({
    bug_title: z.string().min(1).max(200).describe("Short title describing the bug"),
    current_behavior: z.string().min(1).describe("What currently happens (the bug)"),
    expected_behavior: z.string().min(1).describe("What should happen instead"),
    unchanged_behavior: z
      .array(z.string().min(1))
      .min(1)
      .describe("Behaviors that must remain unchanged after the fix"),
    root_cause: z.string().min(1).describe("Evidence-based root cause analysis"),
    test_plan: z.string().min(1).describe("How to verify the fix"),
    severity: z.enum(["Low", "Medium", "High", "Critical"]),
    related_requirements: z.array(z.string().regex(/^REQ-[A-Z]+-\d{3}$/)).min(1),
    spec_dir: specDirSchema,
    feature_number: featureNumberSchema,
    force: forceSchema,
  })
  .strict();

export const checkSyncInputSchema = z
  .object({
    spec_dir: specDirSchema,
    feature_number: featureNumberSchema,
    code_paths: z
      .array(z.string())
      .optional()
      .describe("Paths to implementation files to check against spec"),
  })
  .strict();

export const scanCodebaseInputSchema = z
  .object({
    depth: z.number().int().min(1).max(5).describe("Explicit scan depth (1-5)"),
    exclude: z.array(z.string()).describe("Explicit exclusion patterns; use [] for none"),
  })
  .strict();

export const amendInputSchema = z
  .object({
    rationale: z.string().min(1).describe("Why this amendment is needed"),
    articles_affected: z
      .array(z.string())
      .min(1)
      .describe("Which Constitution articles are affected"),
    changes_description: z.string().min(1).describe("Description of the changes"),
    tdd_amendment: tddAmendmentSchema
      .optional()
      .describe("Optional replacement imports/bindings for the enabled TDD capability"),
    spec_dir: specDirSchema,
    feature_number: featureNumberSchema,
    force: forceSchema,
  })
  .strict();
