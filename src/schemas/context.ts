/**
 * Context Schemas — sdd_context_status.
 */

import { z } from "zod";
import { featureNumberSchema, specDirSchema } from "./common.js";

export const contextStatusInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
  })
  .strict()
  .describe(
    "Return the context tier assignment for all spec artifacts and token load estimates for the active feature.",
  );
