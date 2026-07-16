/**
 * Routing Schemas — sdd_model_routing.
 */

import { z } from "zod";

export const modelRoutingInputSchema = z.object({
  team_size: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe("Explicit number of developers for cost analysis"),
  requests_per_day: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .describe("Explicit tool calls per developer per day"),
}).strict().describe("Return the full model routing decision table for all 10 SDD pipeline phases, cost savings analysis, and a Mermaid diagram.");
