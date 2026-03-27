/**
 * PBT Tools — sdd_generate_pbt.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { PbtGenerator } from "../services/pbt-generator.js";
import { generatePbtInputSchema } from "../schemas/pbt.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

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
        "Extracts universal properties (invariants, round-trips, idempotence) from EARS requirements " +
        "and generates property-based tests using fast-check (TypeScript) or hypothesis (Python). " +
        "Unlike example-based tests, PBT uses random input generation to discover edge cases that manual tests miss.",
      inputSchema: generatePbtInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ framework, feature_number, spec_dir, output_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`,
          );
        }

        const genResult = await pbtGenerator.generate(
          feature.directory,
          framework,
          output_dir,
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

        const frameworkLabel = framework === "fast-check" ? "fast-check" : "hypothesis";

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

        const enriched = await enrichResponse("sdd_generate_pbt", result, stateMachine, spec_dir);
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
