/**
 * Testing Schemas — sdd_generate_tests.
 */

import { specDirSchema, featureNumberSchema } from "./common.js";
import { z } from "zod";

export const generateTestsInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate executable tests from the feature's persisted TDD bindings.");

export const verifyTestsInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  test_results_json: z
    .string()
    .min(2)
    .describe("JSON string containing test results. Supports formats: [{name, status}], {testResults: [{name, status}]}, or {tests: [{name, status}]}. Status values: 'passed'/'pass' or 'failed'/'fail'."),
}).strict().describe("Verify test results against specification requirements. Reports requirement coverage and traceability.");
