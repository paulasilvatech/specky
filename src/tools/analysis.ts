/**
 * Analysis Tools — sdd_run_analysis is in pipeline.ts.
 * This file contains sdd_check_sync.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkSyncInputSchema } from "../schemas/utility.js";
import { requireExecutionContext } from "../services/execution-context.js";
import type { FileManager } from "../services/file-manager.js";
import type { IntentDriftEngine } from "../services/intent-drift-engine.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import { REQUIREMENT_HEADING_PATTERN } from "../utils/id-contracts.js";
import { enrichResponse } from "./response-builder.js";
import { errorResult, truncate } from "./tool-result.js";

export function registerAnalysisTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  _templateEngine: TemplateEngine,
  intentDriftEngine?: IntentDriftEngine,
): void {
  // ─── sdd_check_sync ───
  server.registerTool(
    "sdd_check_sync",
    {
      title: "Check Spec-Code Sync",
      description:
        "Compares specification requirements against implementation files and returns a drift report showing which requirements are implemented and which are missing.",
      inputSchema: checkSyncInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ code_paths }) => {
      try {
        const context = requireExecutionContext("sdd_check_sync");
        const feature = context.feature!;
        const stateDir = context.stateDir!;

        // Read specification
        let specContent: string;
        try {
          specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md");
        } catch {
          throw new Error(
            `SPECIFICATION.md not found in ${feature.directory}.\n→ Fix: Run sdd_write_spec first.`,
          );
        }

        // Extract requirement IDs
        const reqIds = [...specContent.matchAll(REQUIREMENT_HEADING_PATTERN)].map((m) => m[1]);

        // Check code files for requirement references
        const driftItems: Array<{ requirement_id: string; status: string }> = [];
        const implementedReqs = new Set<string>();

        if (code_paths && code_paths.length > 0) {
          for (const codePath of code_paths) {
            try {
              const codeContent = await fileManager.readProjectFile(codePath);
              for (const reqId of reqIds) {
                if (codeContent.includes(reqId)) {
                  implementedReqs.add(reqId);
                }
              }
            } catch {
              // File doesn't exist, skip
            }
          }
        }

        for (const reqId of reqIds) {
          driftItems.push({
            requirement_id: reqId,
            status: implementedReqs.has(reqId) ? "implemented" : "not_found_in_code",
          });
        }

        const inSync = driftItems.every((d) => d.status === "implemented");

        // Intent drift detection
        let intentDrift: Record<string, unknown> | undefined;
        if (intentDriftEngine) {
          try {
            const constitutionContent = await fileManager
              .readSpecFile(feature.directory, "CONSTITUTION.md")
              .catch(() => "");
            let tasksContent = "";
            try {
              tasksContent = await fileManager.readSpecFile(feature.directory, "TASKS.md");
            } catch {
              /* not yet written */
            }
            const principles = intentDriftEngine.extractPrinciples(constitutionContent);
            const driftReport = intentDriftEngine.computeCoverage(
              principles,
              specContent,
              tasksContent,
            );

            // Store drift snapshot in state
            const state = await stateMachine.loadState(stateDir);
            const MAX_DRIFT = 100;
            const snapshot = {
              timestamp: new Date().toISOString(),
              score: driftReport.intent_drift_score,
              orphaned_count: driftReport.orphaned_principles.length,
            };
            state.drift_history = [...(state.drift_history ?? []), snapshot].slice(-MAX_DRIFT);
            await stateMachine.saveState(stateDir, state);

            const trend = intentDriftEngine.computeTrend(state.drift_history ?? []);
            intentDrift = { ...driftReport, drift_trend: trend };
          } catch {
            /* non-critical */
          }
        }

        const result: Record<string, unknown> = {
          in_sync: inSync,
          total_requirements: reqIds.length,
          implemented: implementedReqs.size,
          missing: reqIds.length - implementedReqs.size,
          drift_items: driftItems,
          last_sync_check: new Date().toISOString(),
          recommendation: inSync
            ? "All requirements are referenced in code. Spec and implementation are in sync."
            : `${reqIds.length - implementedReqs.size} requirements not found in code. Review implementation coverage.`,
          ...(intentDrift ? { intent_drift: intentDrift } : {}),
        };

        const enriched = await enrichResponse("sdd_check_sync", result, stateMachine, stateDir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return errorResult("sdd_check_sync", error);
      }
    },
  );
}
