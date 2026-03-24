/**
 * Testing Schemas — sdd_generate_tests.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const generateTestsInputSchema = z.object({
  framework: z
    .enum(["vitest", "jest", "playwright", "pytest", "junit", "xunit"])
    .describe("Test framework to generate stubs for"),
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  output_dir: z
    .string()
    .min(1)
    .default("tests")
    .describe("Output directory for generated test files (e.g. 'tests', 'src/__tests__')"),
}).strict().describe("Generate test stubs from acceptance criteria in SPECIFICATION.md and TASKS.md. Each stub traces to a requirement.");

export const verifyTestsInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  test_results_json: z
    .string()
    .min(2)
    .describe("JSON string containing test results. Supports formats: [{name, status}], {testResults: [{name, status}]}, or {tests: [{name, status}]}. Status values: 'passed'/'pass' or 'failed'/'fail'."),
}).strict().describe("Verify test results against specification requirements. Reports requirement coverage and traceability.");
