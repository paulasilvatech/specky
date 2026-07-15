/**
 * PBT Schemas — sdd_generate_pbt.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const generatePbtInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate property-based tests from EARS requirements. Extracts invariants, round-trip properties, and idempotence checks.");
