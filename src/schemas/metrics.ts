/**
 * Metrics Schemas — sdd_metrics.
 */

import { z } from "zod";
import { featureNumberSchema, forceSchema, specDirSchema } from "./common.js";

export const metricsInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    force: forceSchema,
  })
  .strict()
  .describe(
    "Generate an HTML metrics dashboard for a feature. Reads SPECIFICATION.md, ANALYSIS.md, VERIFICATION.md, CHECKLIST.md and .sdd-state.json to produce a self-contained local HTML report.",
  );
