/**
 * PBT Tools — sdd_generate_pbt.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { PbtGenerator } from "../services/pbt-generator.js";
import { generatePbtInputSchema } from "../schemas/pbt.js";
import { enrichResponse } from "./response-builder.js";
import { requireExecutionContext } from "../services/execution-context.js";

export function registerPbtTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  pbtGenerator: PbtGenerator,
): void {
  server.registerTool(
    "sdd_generate_pbt",
    {
      title: "Generate Property-Based Tests",
      description:
        "Assembles executable fast-check or Hypothesis properties from persisted requirement-bound property code. Specky validates complete REQ-ID coverage and rejects TODO, trivial, or generated system-model bodies.",
      inputSchema: generatePbtInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const context = requireExecutionContext("sdd_generate_pbt");
        const feature = context.feature!;
        const stateDir = context.stateDir!;
        const tdd = context.state!.contract.capability_config.tdd!;

        const genResult = await pbtGenerator.generate(
          feature.directory,
          tdd.property_framework,
          tdd.output_dir,
          tdd.property_imports,
          tdd.property_bindings,
        );

        const fileName = genResult.output_file.split("/").pop() || genResult.output_file;
        const dirPart = genResult.output_file.replace(/\/[^/]+$/, "");
        await fileManager.writeSpecFile(
          dirPart,
          fileName,
          genResult.content,
          true,
        );

        const traceability = genResult.properties.map((p) => ({
          prop_id: p.id,
          requirement: p.requirement_id,
          type: p.property_type,
          description: p.description,
        }));

        const frameworkLabel = tdd.property_framework;

        const result = {
          status: "pbt_generated" as const,
          framework: genResult.framework,
          total_properties: genResult.total_properties,
          property_types: genResult.property_types,
          output_file: genResult.output_file,
          content: genResult.content,
          traceability,
          next_steps:
            `Install ${frameworkLabel}, run the tests, and review failing properties. ` +
            "Each failure includes a minimal counterexample — this is the key advantage of PBT over example-based testing.",
          learning_note:
            "Property-based testing verifies universal truths about your system rather than specific examples. " +
            "EARS requirements map naturally to properties: ubiquitous requirements become invariants, " +
            "event-driven become state transitions, and unwanted behaviors become negative properties. " +
            "When a PBT fails, the framework 'shrinks' the input to the smallest example that triggers the failure.",
        };

        const enriched = await enrichResponse("sdd_generate_pbt", result, stateMachine, stateDir);
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
              text: formatError("sdd_generate_pbt", error as Error),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
