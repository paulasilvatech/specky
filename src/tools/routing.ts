/**
 * Routing Tools — sdd_model_routing.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { truncate } from "./tool-result.js";
import {} from "../constants.js";
import type { ModelRoutingEngine } from "../services/model-routing-engine.js";
import { modelRoutingInputSchema } from "../schemas/routing.js";

function buildMermaidDiagram(table: Array<{ phase: string; model: string; mode: string; thinking: boolean; premium_multiplier: string }>): string {
  const lines = [
    "```mermaid",
    "graph TD",
    '  subgraph "SDD Pipeline — Model Routing"',
  ];
  for (const row of table) {
    const thinking = row.thinking ? " + thinking" : "";
    const label = `${row.phase}\\n${row.model}\\n${row.mode}${thinking}\\n${row.premium_multiplier}`;
    lines.push(`    ${row.phase}["${label}"]`);
  }
  // Chain phases
  const phases = table.map((r) => r.phase);
  for (let i = 0; i < phases.length - 1; i++) {
    lines.push(`    ${phases[i]} --> ${phases[i + 1]}`);
  }
  lines.push("  end", "```");
  return lines.join("\n");
}

export function registerRoutingTools(
  server: McpServer,
  routingEngine: ModelRoutingEngine,
): void {
  server.registerTool(
    "sdd_model_routing",
    {
      title: "Model Routing Decision Table",
      description:
        "Return the full model routing decision table for all 10 SDD pipeline phases. " +
        "Includes the optimal model, chat mode, extended thinking setting, rationale, " +
        "evidence arXiv ID, and cost savings vs Opus-for-everything for your team size.",
      inputSchema: modelRoutingInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ team_size, requests_per_day }) => {
      const table = routingEngine.getTable();
      const costAnalysis = routingEngine.calculateCostSavings(team_size, requests_per_day);
      const diagram = buildMermaidDiagram(table);

      const result = {
        status: "routing_table_returned",
        routing_table: table,
        cost_analysis: costAnalysis,
        diagram,
        next_steps:
          "Use this table to select the right model for each phase in your SDD workflow. " +
          "Extended thinking (thinking: true) is only beneficial for ambiguous, open-ended phases. " +
          "For iterative phases like implement and verify, thinking adds latency with no quality gain.",
        learning_note:
          "Model routing is not about capability — all tiers can complete the task. " +
          "It is about matching reasoning overhead to task structure. " +
          "Phases with executable feedback loops (implement, verify) do not benefit from extended thinking. " +
          "Phases with high ambiguity and no feedback (specify, clarify, design) do.",
      };

      return {
        content: [
          { type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) },
        ],
      };
    },
  );
}
