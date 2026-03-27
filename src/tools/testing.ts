/**
 * Testing Tools — sdd_generate_tests.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TestGenerator } from "../services/test-generator.js";
import { generateTestsInputSchema, verifyTestsInputSchema } from "../schemas/testing.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerTestingTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  testGenerator: TestGenerator,
): void {
  server.registerTool(
    "sdd_generate_tests",
    {
      title: "Generate Test Stubs",
      description:
        "Generate test stubs from acceptance criteria in SPECIFICATION.md and TASKS.md. " +
        "Supports 6 frameworks: vitest, jest, playwright, pytest, junit, xunit. " +
        "Each test stub traces to a requirement ID for full traceability.",
      inputSchema: generateTestsInputSchema,
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

        const genResult = await testGenerator.generate(
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

        const traceability = genResult.stubs.map((s) => ({
          test_id: s.id,
          requirement: s.requirement_id,
          description: s.description,
        }));

        const recommendedServers = framework === "playwright"
          ? [{
              id: "playwright-mcp",
              name: "Playwright MCP",
              purpose: "Execute generated Playwright tests directly from the AI client",
              install_command: "npx @anthropic/mcp-playwright",
              install_note: "Enables automated browser testing via MCP",
              required: false,
              status: "recommended" as const,
              enhances: ["sdd_generate_tests"],
            }]
          : [];

        const result = {
          status: "tests_generated",
          framework: genResult.framework,
          total_tests: genResult.total_tests,
          output_file: genResult.output_file,
          traceability,
          content: genResult.content,
          recommended_servers: recommendedServers.length > 0 ? recommendedServers : undefined,
          next_steps:
            framework === "playwright"
              ? "Run the generated Playwright tests using Playwright MCP or `npx playwright test`. Review each TODO stub and replace with real assertions. Use sdd_verify_tasks to check implementation coverage."
              : `Run the generated tests using your ${framework} runner. Review each TODO stub and replace with real assertions. Use sdd_verify_tasks to check implementation coverage.`,
          learning_note:
            "Test stubs trace directly to acceptance criteria from your specification. " +
            "Each test corresponds to a specific requirement, maintaining full traceability " +
            "from spec → test → code. Replace the TODO placeholders with real test logic.",
        };

        const enriched = await enrichResponse("sdd_generate_tests", result, stateMachine, spec_dir);
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
              text: formatError("sdd_generate_tests", error as Error),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ─── sdd_verify_tests ───
  server.registerTool(
    "sdd_verify_tests",
    {
      title: "Verify Test Coverage Against Requirements",
      description:
        "Reads test results JSON and cross-references with requirement IDs from SPECIFICATION.md. " +
        "Reports requirement coverage percentage, uncovered requirements, and a traceability matrix.",
      inputSchema: verifyTestsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, test_results_json }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`,
          );
        }

        const verification = await testGenerator.verifyTestResults(
          feature.directory,
          test_results_json,
        );

        const result = {
          status: verification.error ? "error" : "verified",
          ...verification,
          next_steps:
            verification.coverage_percentage === 100
              ? "All requirements are covered by tests. Proceed to sdd_advance_phase."
              : `${verification.uncovered_requirements.length} requirements lack test coverage. Write tests for: ${verification.uncovered_requirements.join(", ")}.`,
          learning_note:
            "Requirement-test traceability closes the quality loop. " +
            "Each requirement (REQ-XXX-NNN) should have at least one test that references it by ID. " +
            "100% requirement coverage means every spec item is verified by a test.",
        };

        const enriched = await enrichResponse("sdd_verify_tests", result, stateMachine, spec_dir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_verify_tests", error as Error) }],
          isError: true,
        };
      }
    },
  );
}
