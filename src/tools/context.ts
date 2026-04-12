/**
 * Context Tools — sdd_context_status.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { ContextTieringEngine } from "../services/context-tiering-engine.js";
import { contextStatusInputSchema } from "../schemas/context.js";
import { enrichResponse } from "./response-builder.js";

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerContextTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  contextTieringEngine: ContextTieringEngine,
): void {
  server.registerTool(
    "sdd_context_status",
    {
      title: "Context Tier Status",
      description:
        "Return the context tier assignment (Hot/Domain/Cold) for all spec artifacts in the active feature. " +
        "Includes estimated token load for current session vs universal loading, and savings percentage.",
      inputSchema: contextStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`,
          );
        }

        const tierTable = contextTieringEngine.getTierTable();

        // Estimate tokens per tier by attempting to read each file
        let hotTokens = 0;
        let domainTokens = 0;
        let coldTokens = 0;

        for (const entry of tierTable) {
          try {
            const content = await fileManager.readSpecFile(feature.directory, entry.filename);
            const tokens = contextTieringEngine.estimateTokens(content);
            if (entry.tier === "hot") hotTokens += tokens;
            else if (entry.tier === "domain") domainTokens += tokens;
            else coldTokens += tokens;
          } catch {
            // file not yet written — skip
          }
        }

        const universalTokens = hotTokens + domainTokens + coldTokens;
        const sessionTokens = hotTokens + domainTokens; // Cold not loaded unless requested
        const savingsPercent = universalTokens > 0
          ? Math.round((1 - sessionTokens / universalTokens) * 100)
          : 0;

        const result = {
          status: "context_status_returned",
          feature_number,
          tier_table: tierTable,
          total_hot_tokens: hotTokens,
          total_domain_tokens: domainTokens,
          total_cold_tokens: coldTokens,
          universal_would_load_tokens: universalTokens,
          session_loads_tokens: sessionTokens,
          savings_percent: Math.max(0, savingsPercent),
          next_steps:
            "Hot tier (CONSTITUTION.md) loads on every call. " +
            "Domain tier (SPECIFICATION.md, DESIGN.md, TASKS.md) loads when spec_dir is provided. " +
            "Cold files (ANALYSIS.md, CHECKLIST.md, etc.) load only when a tool explicitly needs them.",
          learning_note:
            "Context tiering reduces token spend by loading only what each tool phase needs. " +
            "Universal loading wastes context window and increases cost. " +
            "Evidence: arXiv:2602.20478 — selective context loading improves accuracy by 8.3%.",
        };

        const enriched = await enrichResponse("sdd_context_status", result, stateMachine, spec_dir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `[sdd_context_status] Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
