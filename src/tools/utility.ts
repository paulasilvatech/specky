/**
 * Utility Tools — sdd_get_status, sdd_get_template, sdd_write_bugfix, sdd_scan_codebase, sdd_amend.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import { join } from "node:path";
import { z } from "zod";
import { STATE_FILE, VERSION, MCP_ECOSYSTEM, TOTAL_TOOLS } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { CodebaseScanner } from "../services/codebase-scanner.js";
import {
  getStatusInputSchema,
  getTemplateInputSchema,
  writeBugfixInputSchema,
  scanCodebaseInputSchema,
  amendInputSchema,
} from "../schemas/utility.js";
import { buildToolResponse, enrichResponse, enrichStateless } from "./response-builder.js";
import type { IntentDriftEngine } from "../services/intent-drift-engine.js";
import type { FeatureInfo, SddState } from "../types.js";
import { requireExecutionContext } from "../services/execution-context.js";
import { artifactMetadata } from "../utils/artifact-metadata.js";

interface FeatureStatus {
  number: string;
  name: string;
  directory: string;
  files: string[];
  state_status: "ready" | "missing" | "invalid";
  phase?: string;
  phase_progress?: string;
  gate_decision?: SddState["gate_decision"];
  contract_id?: string;
  contract_version?: string;
  contract_fingerprint?: string;
  state_error?: string;
  state?: SddState;
}

async function resolveFeatureStatus(
  fileManager: FileManager,
  stateMachine: StateMachine,
  feature: FeatureInfo,
): Promise<FeatureStatus> {
  const base = {
    number: feature.number,
    name: feature.name,
    directory: feature.directory,
    files: feature.files,
  };
  if (!(await fileManager.fileExists(join(feature.directory, STATE_FILE)))) {
    return {
      ...base,
      state_status: "missing",
      state_error: `Canonical state is missing at ${join(feature.directory, STATE_FILE)}.`,
    };
  }

  try {
    const state = await stateMachine.loadState(feature.directory);
    const completed = state.contract.phases.filter(
      (phase) => state.phases[phase]?.status === "completed",
    ).length;
    return {
      ...base,
      state_status: "ready",
      phase: state.current_phase,
      phase_progress: `${completed}/${state.contract.phases.length}`,
      gate_decision: state.gate_decision,
      contract_id: state.contract.id,
      contract_version: state.contract.version,
      contract_fingerprint: state.contract.fingerprint,
      state,
    };
  } catch (error) {
    return {
      ...base,
      state_status: "invalid",
      state_error: error instanceof Error ? error.message : String(error),
    };
  }
}

function publicFeatureStatus(status: FeatureStatus): Omit<FeatureStatus, "state"> {
  const { state: _state, ...summary } = status;
  return summary;
}

export function registerUtilityTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  codebaseScanner: CodebaseScanner,
  intentDriftEngine?: IntentDriftEngine,
): void {
  // ─── sdd_get_status ───
  server.registerTool(
    "sdd_get_status",
    {
      title: "Get Pipeline Status",
      description:
        "Returns the current pipeline status including: current phase, completed phases, files on disk, completion percentage, and recommended next action.",
      inputSchema: getStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const featuresOnDisk = await fileManager.listFeatures(input.spec_dir);
        const statuses = await Promise.all(
          featuresOnDisk.map((feature) => resolveFeatureStatus(fileManager, stateMachine, feature)),
        );
        const featureSummaries = statuses.map(publicFeatureStatus);

        if (input.view === "workspace") {
          const result = {
            status: "workspace_status",
            view: "workspace",
            spec_directory: input.spec_dir,
            feature_count: featureSummaries.length,
            ready_features: featureSummaries.filter((feature) => feature.state_status === "ready").length,
            features_requiring_attention: featureSummaries.filter((feature) => feature.state_status !== "ready").length,
            features: featureSummaries,
            active_feature: null,
          };
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        }

        const target = statuses.find((feature) => feature.number === input.feature_number);
        if (!target) {
          throw new Error(`Feature ${input.feature_number} not found in ${input.spec_dir}.`);
        }
        if (!target.state) {
          return {
            content: [{
              type: "text" as const, text: JSON.stringify({
                error: "feature_state_unavailable",
                feature: publicFeatureStatus(target),
                fix: target.state_status === "invalid"
                  ? "Run specky migrate-contracts for legacy state, or restore a valid signed v5 state."
                  : "Initialize this feature with sdd_init before invoking feature tools.",
              }, null, 2)
            }],
            isError: true,
          };
        }

        const state = target.state;
        const completed = state.contract.phases.filter(
          (phase) => state.phases[phase]?.status === "completed",
        ).length;
        const currentIndex = state.contract.phases.indexOf(state.current_phase);
        const nextPhase = currentIndex < state.contract.phases.length - 1
          ? state.contract.phases[currentIndex + 1]
          : null;
        const result = {
          status: "feature_status",
          view: "feature",
          current_phase: state.current_phase,
          phases: state.phases,
          active_feature: publicFeatureStatus(target),
          files_found: target.files,
          completion_percent: Math.round((completed / state.contract.phases.length) * 100),
          gate_decision: state.gate_decision,
          contract: state.contract,
          next_action: nextPhase
            ? `Complete ${state.current_phase}, then advance to ${nextPhase}.`
            : "The contracted pipeline is complete.",
        };
        const enriched = buildToolResponse(
          "sdd_get_status",
          result,
          state.current_phase,
          state.phases,
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_get_status", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_get_template ───
  server.registerTool(
    "sdd_get_template",
    {
      title: "Get Raw Template",
      description:
        "Returns the raw Markdown template for a given artifact type with {{placeholder}} variables intact. Does not write any files.",
      inputSchema: getTemplateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ template_name }) => {
      try {
        const template = await templateEngine.getTemplate(template_name);
        const enriched = enrichStateless("sdd_get_template", { status: "template_retrieved", template_name, content: template });
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_get_template", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_write_bugfix ───
  server.registerTool(
    "sdd_write_bugfix",
    {
      title: "Write Bugfix Specification",
      description:
        "Generates and writes BUGFIX_SPEC.md with current behavior, expected behavior, unchanged behavior, root cause analysis, and test plan. Not gated by the state machine.",
      inputSchema: writeBugfixInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ bug_title, current_behavior, expected_behavior, unchanged_behavior, root_cause, test_plan, severity, related_requirements }) => {
      try {
        const context = requireExecutionContext("sdd_write_bugfix");
        const feature = context.feature!;
        const featureDir = feature.directory;

        const content = await templateEngine.renderWithFrontmatter("bugfix", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_write_bugfix", status: "Draft" }),
          title: `Bugfix: ${bug_title}`,
          feature_id: `${feature.number}-${feature.name}`,
          bug_title,
          current_behavior,
          expected_behavior,
          unchanged_behavior,
          root_cause,
          test_plan,
          severity,
          related_requirements: related_requirements.join(", "),
        });

        const filePath = await fileManager.writeSpecFile(featureDir, "BUGFIX_SPEC.md", content, true);

        const result = {
          status: "bugfix_spec_written",
          file: filePath,
          bug_title,
          sections: ["Current Behavior", "Expected Behavior", "Unchanged Behavior", "Root Cause Analysis", "Test Plan"],
        };

        const enriched = await enrichResponse("sdd_write_bugfix", result, stateMachine, context.stateDir!);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_write_bugfix", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_scan_codebase ───
  server.registerTool(
    "sdd_scan_codebase",
    {
      title: "Scan Codebase",
      description:
        "Scans the workspace project structure and returns auto-steering context: detected language, framework, package manager, folder structure, and key files.",
      inputSchema: scanCodebaseInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ depth, exclude }) => {
      try {
        const summary = await codebaseScanner.scan(depth, exclude);
        const enriched = enrichStateless("sdd_scan_codebase", summary as unknown as Record<string, unknown>);

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_scan_codebase", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_amend ───
  server.registerTool(
    "sdd_amend",
    {
      title: "Amend Constitution",
      description:
        "Appends an amendment entry to CONSTITUTION.md's changelog and updates the amendment_count in frontmatter.",
      inputSchema: amendInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ rationale, articles_affected, changes_description }) => {
      try {
        const context = requireExecutionContext("sdd_amend");
        const feature = context.feature!;
        const stateDir = context.stateDir!;

        // Read existing constitution
        let constitution: string;
        try {
          constitution = await fileManager.readSpecFile(feature.directory, "CONSTITUTION.md");
        } catch {
          throw new Error(
            `CONSTITUTION.md not found in ${feature.directory}.\n→ Fix: Run sdd_init first.`
          );
        }

        // Count existing amendments
        const amendmentRegex = /^\| \d+ \|/gm;
        const existingAmendments = constitution.match(amendmentRegex) || [];
        const nextNumber = existingAmendments.length + 1;

        // Build amendment row
        const today = new Date().toISOString().split("T")[0];
        const amendmentRow = `| ${nextNumber} | ${today} | SDD Pipeline | ${rationale} | ${articles_affected.join(", ")} |`;

        // Append to amendment log
        const amendmentLogMarker = "| — | — | — | Initial version | All |";
        let updatedConstitution: string;

        if (constitution.includes(amendmentLogMarker)) {
          updatedConstitution = constitution.replace(
            amendmentLogMarker,
            `${amendmentLogMarker}\n${amendmentRow}`
          );
        } else {
          // Append to the end
          updatedConstitution = constitution + `\n${amendmentRow}\n`;
        }

        // Update amendment_count in frontmatter
        const countRegex = /amendment_count:\s*(\d+)/;
        if (countRegex.test(updatedConstitution)) {
          updatedConstitution = updatedConstitution.replace(
            countRegex,
            `amendment_count: ${nextNumber}`
          );
        } else {
          // Add amendment_count to frontmatter
          updatedConstitution = updatedConstitution.replace(
            /^(---\n)/m,
            `---\namendment_count: ${nextNumber}\n`
          );
        }

        await fileManager.writeSpecFile(feature.directory, "CONSTITUTION.md", updatedConstitution, true);

        // Update state
        const state = await stateMachine.loadState(stateDir);
        state.amendments.push({
          number: nextNumber,
          date: today,
          author: "SDD Pipeline",
          rationale,
          articles_affected,
        });
        await stateMachine.saveState(stateDir, state);

        // Drift-aware amendment suggestion
        let driftAmendmentSuggestion: Record<string, unknown> | undefined;
        if (intentDriftEngine) {
          try {
            const freshState = await stateMachine.loadState(stateDir);
            const lastSnapshot = (freshState.drift_history ?? []).at(-1);
            if (lastSnapshot && lastSnapshot.score > 40) {
              const principles = intentDriftEngine.extractPrinciples(constitution);
              let specContent = "";
              try { specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md"); } catch { /* ok */ }
              let tasksContent = "";
              try { tasksContent = await fileManager.readSpecFile(feature.directory, "TASKS.md"); } catch { /* ok */ }
              const driftReport = intentDriftEngine.computeCoverage(principles, specContent, tasksContent);
              driftAmendmentSuggestion = {
                current_drift_score: lastSnapshot.score,
                drift_label: driftReport.intent_drift_label,
                orphaned_principles: driftReport.orphaned_principles.map((p) => p.heading),
                recommended_actions: driftReport.orphaned_principles.map((p) =>
                  `Add requirement referencing "${p.heading}" to SPECIFICATION.md`
                ),
                note: "High intent drift detected. Consider adding requirements that address orphaned constitutional principles.",
              };
            }
          } catch { /* non-critical */ }
        }

        const result = {
          status: "amendment_added",
          amendment_number: nextNumber,
          rationale,
          articles_affected,
          changes_description,
          ...(driftAmendmentSuggestion ? { drift_amendment_suggestion: driftAmendmentSuggestion } : {}),
        };

        const enriched = await enrichResponse("sdd_amend", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_amend", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_check_ecosystem ───
  server.registerTool(
    "sdd_check_ecosystem",
    {
      title: "Check MCP Ecosystem",
      description:
        "Reports which external MCP servers are recommended for the full Specky experience. Shows what each server does, which Specky tools it enhances, and how to install it. Run this first to understand what integrations are available.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const ecosystem = MCP_ECOSYSTEM.map((srv) => ({
        id: srv.id,
        name: srv.name,
        purpose: srv.purpose,
        install_command: srv.install_command,
        install_note: srv.install_note,
        required: srv.required,
        status: srv.status,
        enhances: [...srv.enhances],
      }));

      const result = {
        specky_version: VERSION,
        total_tools: TOTAL_TOOLS,
        recommended_servers: ecosystem,
        explanation: `Specky v${VERSION} has ${TOTAL_TOOLS} tools that work standalone. For the full experience, ${ecosystem.length} external MCP servers are recommended. Each server unlocks additional integrations — none are required, but they transform Specky from a spec engine into a complete development platform.`,
        next_steps: "Review the list above. Install the servers relevant to your workflow. GitHub MCP and Azure DevOps MCP are the most commonly used. MarkItDown MCP is recommended for document import (PDF/DOCX/PPTX).",
        learning_note: "MCP (Model Context Protocol) allows AI clients to orchestrate between multiple servers. Specky produces structured payloads with routing_instructions that tell the AI client which external MCP server to call. This MCP-to-MCP pattern means Specky never needs API keys or credentials for external services — the AI client handles routing.",
      };

      const enriched = enrichStateless("sdd_check_ecosystem", result);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }],
      };
    }
  );
}
