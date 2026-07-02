/**
 * Metrics Tools — sdd_metrics.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import {} from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { MetricsGenerator } from "../services/metrics-generator.js";
import type { CognitiveDebtEngine } from "../services/cognitive-debt-engine.js";
import type { IntentDriftEngine } from "../services/intent-drift-engine.js";
import { metricsInputSchema } from "../schemas/metrics.js";
import { enrichResponse } from "./response-builder.js";

export function registerMetricsTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  metricsGenerator: MetricsGenerator,
  cognitiveDebtEngine?: CognitiveDebtEngine,
  intentDriftEngine?: IntentDriftEngine,
): void {
  server.registerTool(
    "sdd_metrics",
    {
      title: "Generate Metrics Dashboard",
      description:
        "Generate a self-contained HTML metrics dashboard for a feature. " +
        "Reads SPECIFICATION.md, ANALYSIS.md, VERIFICATION.md, CHECKLIST.md and .sdd-state.json. " +
        "Produces metrics-dashboard.html with: requirement count, task coverage, compliance score, " +
        "checklist pass rate, and a phase timeline with durations.",
      inputSchema: metricsInputSchema,
      annotations: {
        readOnlyHint: false,
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

        const metricsResult = await metricsGenerator.generateMetrics(
          feature.directory,
          feature_number,
        );

        const result = {
          status: "metrics_generated",
          feature_dir: metricsResult.feature_dir,
          feature_number: metricsResult.feature_number,
          generated_at: metricsResult.generated_at,
          html_path: metricsResult.html_path,
          summary: {
            requirements_count: metricsResult.requirements_count,
            acceptance_criteria_count: metricsResult.acceptance_criteria_count,
            compliance_score: metricsResult.compliance_score,
            test_coverage_percent: metricsResult.test_coverage_percent,
            tasks_total: metricsResult.tasks_total,
            tasks_verified: metricsResult.tasks_verified,
            checklist_pass_rate: metricsResult.test_coverage_percent,
          },
          phases: metricsResult.phases,
          cognitive_debt: await (async () => {
            if (!cognitiveDebtEngine) return undefined;
            try {
              const state = await stateMachine.loadState(spec_dir);
              return cognitiveDebtEngine.computeMetrics(state.gate_history ?? []);
            } catch { return undefined; }
          })(),
          intent_drift: await (async () => {
            if (!intentDriftEngine) return undefined;
            try {
              const state = await stateMachine.loadState(spec_dir);
              const lastSnapshot = (state.drift_history ?? []).at(-1);
              const trend = intentDriftEngine.computeTrend(state.drift_history ?? []);
              return lastSnapshot
                ? { intent_drift_score: lastSnapshot.score, drift_trend: trend }
                : undefined;
            } catch { return undefined; }
          })(),
          next_steps:
            `Open ${metricsResult.html_path} in a browser to view the metrics dashboard. ` +
            "Share with stakeholders as a standalone HTML file — it requires no external dependencies.",
          learning_note:
            "The metrics dashboard aggregates all spec artifacts into a single view. " +
            "Compliance score comes from ANALYSIS.md, task coverage from VERIFICATION.md, " +
            "and checklist pass rate from CHECKLIST.md. Phase durations are read from .sdd-state.json.",
        };

        const enriched = await enrichResponse("sdd_metrics", result, stateMachine, spec_dir);
        return {
          content: [
            { type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_metrics", error as Error),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
