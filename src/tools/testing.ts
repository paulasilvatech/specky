/**
 * Testing Tools — sdd_generate_tests.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateTestsInputSchema, verifyTestsInputSchema } from "../schemas/testing.js";
import { requireCapabilityConfig, requireFeatureContext } from "../services/execution-context.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TestGenerator } from "../services/test-generator.js";
import type { TestResultParser } from "../services/test-result-parser.js";
import type { TestTraceabilityMapper } from "../services/test-traceability-mapper.js";
import { REQUIREMENT_HEADING_PATTERN } from "../utils/id-contracts.js";
import { enrichResponse } from "./response-builder.js";
import { errorResult, truncate } from "./tool-result.js";

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
      title: "Generate Executable Requirement Tests",
      description:
        "Assemble executable tests from the persisted TDD framework, imports, and requirement bindings. Every SPECIFICATION.md REQ-ID must have a nontrivial binding; TODO and trivial assertions are rejected.",
      inputSchema: generateTestsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const context = requireFeatureContext("sdd_generate_tests");
        const feature = context.feature;
        const stateDir = context.stateDir;
        const tdd = requireCapabilityConfig(context.state.contract.capability_config, "tdd");

        const genResult = await testGenerator.generate(
          feature.directory,
          tdd.framework,
          tdd.output_dir,
          tdd.imports,
          tdd.bindings,
        );

        const fileName = genResult.output_file.split("/").pop() || genResult.output_file;
        const dirPart = genResult.output_file.replace(/\/[^/]+$/, "");
        await fileManager.writeSpecFile(dirPart, fileName, genResult.content, true);

        // Record where the tests landed so sdd_verify_tests can scan the
        // same directory for its coverage mapping (best-effort).
        try {
          await recordGeneratedTest(
            fileManager,
            feature.directory,
            tdd.framework,
            genResult.output_file,
          );
        } catch {
          /* generation already succeeded — manifest is advisory */
        }

        const traceability = genResult.stubs.map((s) => ({
          test_id: s.id,
          requirement: s.requirement_id,
          description: s.description,
        }));

        const recommendedServers =
          tdd.framework === "playwright"
            ? [
                {
                  id: "playwright-mcp",
                  name: "Playwright MCP",
                  purpose: "Execute generated Playwright tests directly from the AI client",
                  install_command: "npx @anthropic/mcp-playwright",
                  install_note: "Enables automated browser testing via MCP",
                  required: false,
                  status: "recommended" as const,
                  enhances: ["sdd_generate_tests"],
                },
              ]
            : [];

        const result = {
          status: "tests_generated",
          framework: genResult.framework,
          coverage_threshold: tdd.coverage_threshold,
          trace_marker: tdd.trace_marker,
          total_tests: genResult.total_tests,
          output_file: genResult.output_file,
          traceability,
          content: genResult.content,
          recommended_servers: recommendedServers.length > 0 ? recommendedServers : undefined,
          next_steps:
            tdd.framework === "playwright"
              ? "Run the generated Playwright tests using Playwright MCP or `npx playwright test`. Review each TODO stub and replace with real assertions. Use sdd_verify_tasks to check implementation coverage."
              : `Run the generated tests using your ${tdd.framework} runner. Review each TODO stub and replace with real assertions. Use sdd_verify_tasks to check implementation coverage.`,
          learning_note:
            "Executable tests come from fingerprinted TDD bindings and preserve requirement traceability from spec to test to code.",
        };

        const enriched = await enrichResponse("sdd_generate_tests", result, stateMachine, stateDir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return errorResult("sdd_generate_tests", error);
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
    async ({ test_results_json }) => {
      try {
        const context = requireFeatureContext("sdd_verify_tests");
        const feature = context.feature;
        const stateDir = context.stateDir;
        const tdd = requireCapabilityConfig(context.state.contract.capability_config, "tdd");

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
            try {
              specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md");
            } catch {
              /* ok */
            }
            const reqIds = [...specContent.matchAll(REQUIREMENT_HEADING_PATTERN)].map((r) => r[1]);

            // Scan the feature dir PLUS the directories sdd_generate_tests
            // actually wrote to — otherwise coverage reports 0% for tests
            // that were just generated outside .specs.
            const testFileContents = await collectTestFileContents(fileManager, feature.directory);

            const report = testTraceabilityMapper.buildCoverageReport(
              testFileContents,
              parsedResults,
              reqIds,
            );
            failureDetails = testTraceabilityMapper.buildFailureDetails(
              parsedResults,
              testFileContents,
            );
            coverageReport = {
              overall_percent: report.overall_percent,
              failing_requirements: report.failing_requirements,
              untested_requirements: report.untested_requirements,
              per_requirement: report.per_requirement,
            };
          } catch {
            /* fall back to legacy result */
          }
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
          ...(failureDetails && failureDetails.length > 0
            ? { failure_details: failureDetails }
            : {}),
          coverage_threshold: tdd.coverage_threshold,
          meets_threshold: effectiveCoverage >= tdd.coverage_threshold,
          next_steps:
            effectiveCoverage >= tdd.coverage_threshold
              ? `Coverage ${effectiveCoverage}% meets the contracted ${tdd.coverage_threshold}% threshold.`
              : `Coverage ${effectiveCoverage}% is below the contracted ${tdd.coverage_threshold}% threshold. Uncovered: ${uncoveredReqs.join(", ")}.`,
          learning_note:
            "Requirement-test traceability closes the quality loop. " +
            "Each requirement (REQ-XXX-NNN) should have at least one test that references it by ID. " +
            "100% requirement coverage means every spec item is verified by a test.",
        };

        const enriched = await enrichResponse("sdd_verify_tests", result, stateMachine, stateDir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return errorResult("sdd_verify_tests", error);
      }
    },
  );
}

// ─── Generated-test bookkeeping (shared by generate/verify) ───

/** Manifest (inside the feature directory) recording where sdd_generate_tests wrote files. */
export const GENERATED_TESTS_MANIFEST = ".specky-generated-tests.json";

/** Default output directory of sdd_generate_tests — always scanned as a fallback. */
const DEFAULT_TEST_OUTPUT_DIR = "tests";

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.py$|Test\.java$|Tests\.cs$/;

interface GeneratedTestEntry {
  framework: string;
  file: string;
}

function parseManifest(raw: string): GeneratedTestEntry[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (entry): entry is GeneratedTestEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as GeneratedTestEntry).framework === "string" &&
      typeof (entry as GeneratedTestEntry).file === "string",
  );
}

/** Record a generated test file in the feature's manifest (idempotent per path). */
export async function recordGeneratedTest(
  fileManager: FileManager,
  featureDir: string,
  framework: string,
  outputFile: string,
): Promise<void> {
  let entries: GeneratedTestEntry[] = [];
  try {
    entries = parseManifest(await fileManager.readSpecFile(featureDir, GENERATED_TESTS_MANIFEST));
  } catch {
    /* first generation for this feature */
  }

  const next = entries.filter((entry) => entry.file !== outputFile);
  next.push({ framework, file: outputFile });
  await fileManager.writeSpecFile(
    featureDir,
    GENERATED_TESTS_MANIFEST,
    `${JSON.stringify(next, null, 2)}\n`,
    true,
  );
}

/**
 * Collect test-file contents for coverage mapping: the feature directory,
 * every directory recorded in the generated-tests manifest, and the default
 * "tests" output directory.
 */
export async function collectTestFileContents(
  fileManager: FileManager,
  featureDir: string,
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};

  const scanDirs = new Set<string>([featureDir, DEFAULT_TEST_OUTPUT_DIR]);
  try {
    const entries = parseManifest(
      await fileManager.readSpecFile(featureDir, GENERATED_TESTS_MANIFEST),
    );
    for (const entry of entries) {
      if (entry.file.includes("/")) {
        scanDirs.add(entry.file.slice(0, entry.file.lastIndexOf("/")));
      }
    }
  } catch {
    /* no manifest yet — scan the defaults */
  }

  for (const dir of scanDirs) {
    const files = await fileManager.listSpecFiles(dir);
    for (const name of files) {
      if (!TEST_FILE_PATTERN.test(name)) continue;
      try {
        contents[`${dir}/${name}`] = await fileManager.readSpecFile(dir, name);
      } catch {
        /* unreadable — skip */
      }
    }
  }

  return contents;
}
