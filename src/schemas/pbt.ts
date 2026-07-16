/**
 * PBT Schemas — sdd_generate_pbt.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const generatePbtInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate executable property tests from persisted requirement-bound property bindings.");
