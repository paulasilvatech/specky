/**
 * Utility Tools — sdd_get_status, sdd_get_template, sdd_write_bugfix, sdd_scan_codebase, sdd_amend.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { z } from "zod";
import { CHARACTER_LIMIT, PHASE_ORDER, DEFAULT_EXCLUDE_PATTERNS, VERSION, MCP_ECOSYSTEM, TOTAL_TOOLS } from "../constants.js";
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

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerUtilityTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  codebaseScanner: CodebaseScanner
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
    async ({ spec_dir, feature_number }) => {
      try {
        const state = await stateMachine.loadState(spec_dir);
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);

        const filesFound = feature ? feature.files : [];
        const completedPhases = PHASE_ORDER.filter(
          (p) => state.phases[p]?.status === "completed"
        );
        const completionPercent = Math.round(
          (completedPhases.length / PHASE_ORDER.length) * 100
        );

        // Determine next action
        const currentIndex = PHASE_ORDER.indexOf(state.current_phase);
        const nextPhase =
          currentIndex < PHASE_ORDER.length - 1
            ? PHASE_ORDER[currentIndex + 1]
            : null;

        let nextAction: string;
        if (state.current_phase === "init" && state.phases.init?.status === "completed") {
          nextAction = "Call sdd_discover with your project idea.";
        } else if (nextPhase) {
          nextAction = `Complete ${state.current_phase} phase, then advance to ${nextPhase}.`;
        } else {
          nextAction = "Pipeline complete. Proceed to implementation.";
        }

        const result = {
          current_phase: state.current_phase,
          phases: state.phases,
          features: state.features,
          files_found: filesFound,
          completion_percent: completionPercent,
          gate_decision: state.gate_decision,
          next_action: nextAction,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
        return { content: [{ type: "text" as const, text: truncate(template) }] };
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
    async ({ bug_title, current_behavior, expected_behavior, unchanged_behavior, root_cause, test_plan, spec_dir, feature_number }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        const featureDir = feature?.directory || join(spec_dir, `${feature_number}-bugfix`);

        const content = await templateEngine.renderWithFrontmatter("bugfix", {
          title: `Bugfix: ${bug_title}`,
          feature_id: feature?.name || "bugfix",
          bug_title,
          current_behavior,
          expected_behavior,
          unchanged_behavior: unchanged_behavior || ["No regressions in existing functionality"],
          root_cause: root_cause || "[TODO: Investigate root cause]",
          test_plan: test_plan || "[TODO: Define test plan]",
          severity: "Medium",
          related_requirements: "[TODO: Link to affected requirements]",
        });

        const filePath = await fileManager.writeSpecFile(featureDir, "BUGFIX_SPEC.md", content, true);

        const result = {
          status: "bugfix_spec_written",
          file: filePath,
          bug_title,
          sections: ["Current Behavior", "Expected Behavior", "Unchanged Behavior", "Root Cause Analysis", "Test Plan"],
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
        const excludePatterns = exclude || [...DEFAULT_EXCLUDE_PATTERNS];
        const summary = await codebaseScanner.scan(depth, excludePatterns);

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(summary, null, 2)) }] };
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
    async ({ rationale, articles_affected, changes_description, spec_dir, feature_number }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }

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
        const state = await stateMachine.loadState(spec_dir);
        state.amendments.push({
          number: nextNumber,
          date: today,
          author: "SDD Pipeline",
          rationale,
          articles_affected,
        });
        await stateMachine.saveState(spec_dir, state);

        const result = {
          status: "amendment_added",
          amendment_number: nextNumber,
          rationale,
          articles_affected,
          changes_description,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
