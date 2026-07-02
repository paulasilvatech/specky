/**
 * Testing Tools — sdd_generate_tests.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import {} from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TestGenerator } from "../services/test-generator.js";
import type { TestResultParser } from "../services/test-result-parser.js";
import type { TestTraceabilityMapper } from "../services/test-traceability-mapper.js";
import { generateTestsInputSchema, verifyTestsInputSchema } from "../schemas/testing.js";
import { enrichResponse } from "./response-builder.js";

export function registerTestingTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  testGenerator: TestGenerator,
  testResultParser?: TestResultParser,
  testTraceabilityMapper?: TestTraceabilityMapper,
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

        // Enhanced traceability using TestResultParser + TestTraceabilityMapper
        let coverageReport: Record<string, unknown> | undefined;
        let failureDetails: unknown[] | undefined;
        if (testResultParser && testTraceabilityMapper) {
          try {
            const parsedResults = testResultParser.parse(test_results_json);
            let specContent = "";
            try { specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md"); } catch { /* ok */ }
            const reqIds = [...specContent.matchAll(/### (REQ-[A-Z]+-\d{3})/g)].map((r) => r[1]);

            const testFileContents: Record<string, string> = {};
            try {
              const testFiles = await fileManager.listSpecFiles(feature.directory);
              for (const tf of testFiles) {
                if (/\.(test|spec)\.(ts|js|py)$|_test\.py$/.test(tf)) {
                  try { testFileContents[tf] = await fileManager.readSpecFile(feature.directory, tf); } catch { /* skip */ }
                }
              }
            } catch { /* no test files yet */ }

            const report = testTraceabilityMapper.buildCoverageReport(testFileContents, parsedResults, reqIds);
            failureDetails = testTraceabilityMapper.buildFailureDetails(parsedResults, testFileContents);
            coverageReport = {
              overall_percent: report.overall_percent,
              failing_requirements: report.failing_requirements,
              untested_requirements: report.untested_requirements,
              per_requirement: report.per_requirement,
            };
          } catch { /* fall back to legacy result */ }
        }

        const effectiveCoverage = coverageReport
          ? (coverageReport["overall_percent"] as number)
          : verification.coverage_percentage;
        const uncoveredReqs: string[] = coverageReport
          ? (coverageReport["untested_requirements"] as string[])
          : verification.uncovered_requirements;

        const result = {
          status: verification.error ? "error" : "verified",
          ...verification,
          ...(coverageReport ? { enhanced_coverage: coverageReport } : {}),
          ...(failureDetails && failureDetails.length > 0 ? { failure_details: failureDetails } : {}),
          next_steps:
            effectiveCoverage === 100
              ? "All requirements are covered by tests. Proceed to sdd_advance_phase."
              : `${uncoveredReqs.length} requirements lack test coverage. Write tests for: ${uncoveredReqs.join(", ")}.`,
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
