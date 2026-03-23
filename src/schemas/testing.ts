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
