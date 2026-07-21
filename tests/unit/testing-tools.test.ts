import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { type CapabilityConfig, resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TestGenerator } from "../../src/services/test-generator.js";
import { TestResultParser } from "../../src/services/test-result-parser.js";
import { TestTraceabilityMapper } from "../../src/services/test-traceability-mapper.js";
import { registerTestingTools } from "../../src/tools/testing.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import type { GateDecision } from "../../src/types.js";

const FEATURE_DIR = ".specs/001-api";

const APPROVE_GATE: GateDecision = {
  decision: "APPROVE",
  reasons: ["Fixture evidence is complete"],
  coverage_percent: 100,
  gaps: [],
  decided_at: "2026-07-15T00:00:00.000Z",
};

const SPEC = `### REQ-API-001: Create item

When a client submits an item, the system shall persist and return it.

**Acceptance Criteria:**
- POST /items returns 201
`;

const SPEC_TWO_REQS = `${SPEC}
### REQ-API-002: Delete item

When a client deletes an item, the system shall remove it.

**Acceptance Criteria:**
- DELETE /items/:id returns 204
`;

function tddConfig(framework: "vitest" | "playwright"): CapabilityConfig["tdd"] {
  return {
    framework,
    property_framework: "fast-check",
    output_dir: "tests",
    coverage_threshold: 80,
    trace_marker: "Traces to:",
    imports:
      framework === "playwright"
        ? `import { test, expect } from "@playwright/test";`
        : `import { describe, expect, it } from "vitest";\nimport { createItem } from "../src/item.js";`,
    bindings: [
      {
        requirement_id: "REQ-API-001",
        test_name: "creates an item",
        body: `const created = createItem({ name: "widget" });\nexpect(created.name).toBe("widget");`,
      },
    ],
    property_imports: `import fc from "fast-check";`,
    property_bindings: [
      {
        requirement_id: "REQ-API-001",
        property_name: "item payload round-trips",
        property_type: "round_trip",
        body: `fc.assert(fc.property(fc.string(), (value) => { expect(value).toBe(value); /* REQ-API-001 */ }));`,
      },
    ],
  };
}

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

interface HarnessOptions {
  framework: "vitest" | "playwright";
  phase?: Phase;
  gate?: GateDecision | null;
  spec?: string;
}

async function buildHarness(workspace: string, options: HarnessOptions): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), options.spec ?? SPEC);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const tdd = tddConfig(options.framework);
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: ["tdd"],
      capability_config: { tdd },
    }),
  });
  const phase = options.phase ?? Phase.Implement;
  state.current_phase = phase;
  state.phases[phase] = { status: "in_progress", started_at: "2026-07-15T00:00:00.000Z" };
  state.gate_decision = options.gate === undefined ? APPROVE_GATE : options.gate;
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "testing-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerTestingTools(
    server,
    fileManager,
    stateMachine,
    new TestGenerator(fileManager),
    new TestResultParser(),
    new TestTraceabilityMapper(),
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "testing-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    workspace,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const response = await client.callTool({ name, arguments: args });
  const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }
  return { isError: response.isError === true, payload, raw: text };
}

const FEATURE_ARGS = { spec_dir: ".specs", feature_number: "001" };

describe("testing MCP tools", () => {
  const workspaces: string[] = [];
  const closes: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  function workspace(prefix: string): string {
    const path = mkdtempSync(join(tmpdir(), prefix));
    workspaces.push(path);
    return path;
  }

  describe("sdd_generate_tests", () => {
    it("assembles a vitest file from the persisted bindings and records the manifest", async () => {
      const ws = workspace("specky-test-gen-vitest-");
      const harness = await buildHarness(ws, { framework: "vitest" });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_tests", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "tests_generated",
        framework: "vitest",
        coverage_threshold: 80,
        trace_marker: "Traces to:",
        total_tests: 1,
        output_file: "tests/api.test.ts",
      });
      expect(result.payload["traceability"]).toEqual([
        {
          test_id: "TC-001",
          requirement: "REQ-API-001",
          description: "creates an item",
        },
      ]);
      const content = String(result.payload["content"]);
      expect(content).toContain("// Traces to: REQ-API-001");
      expect(content).toContain('it("REQ-API-001: creates an item", async () => {');
      expect(content).toContain('expect(created.name).toBe("widget");');
      expect(result.payload["recommended_servers"]).toBeUndefined();
      expect(String(result.payload["next_steps"])).toContain("vitest runner");

      const written = readFileSync(join(ws, "tests/api.test.ts"), "utf8");
      expect(written).toBe(content);
      const manifest = JSON.parse(
        readFileSync(join(ws, FEATURE_DIR, ".specky-generated-tests.json"), "utf8"),
      ) as Array<Record<string, unknown>>;
      expect(manifest).toEqual([{ framework: "vitest", file: "tests/api.test.ts" }]);
    });

    it("recommends Playwright MCP and a .spec.ts output for the playwright framework", async () => {
      const ws = workspace("specky-test-gen-playwright-");
      const harness = await buildHarness(ws, { framework: "playwright" });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_tests", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "tests_generated",
        framework: "playwright",
        output_file: "tests/api.spec.ts",
      });
      const recommended = result.payload["recommended_servers"] as Array<Record<string, unknown>>;
      expect(recommended).toHaveLength(1);
      expect(recommended[0]).toMatchObject({
        id: "playwright-mcp",
        status: "recommended",
        enhances: ["sdd_generate_tests"],
      });
      expect(String(result.payload["next_steps"])).toContain("Playwright MCP");
      const content = String(result.payload["content"]);
      expect(content).toContain('test("REQ-API-001: creates an item", async ({ page }) => {');
      expect(existsSync(join(ws, "tests/api.spec.ts"))).toBe(true);
    });

    it("rejects bindings that do not cover every specification requirement", async () => {
      const ws = workspace("specky-test-gen-mismatch-");
      const harness = await buildHarness(ws, { framework: "vitest", spec: SPEC_TWO_REQS });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_tests", FEATURE_ARGS);
      expect(result.isError).toBe(true);
      expect(result.raw).toContain("TDD bindings mismatch. Missing: REQ-API-002. Unknown: none.");
      expect(existsSync(join(ws, "tests/api.test.ts"))).toBe(false);
    });

    it("is blocked when no APPROVE gate decision is recorded at Implement", async () => {
      const harness = await buildHarness(workspace("specky-test-gen-gate-"), {
        framework: "vitest",
        gate: null,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_tests", FEATURE_ARGS);
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("gate_blocked");
    });
  });

  describe("sdd_verify_tests", () => {
    const GENERATED_TEST_FILE = `/**
 * Executable tests generated from explicit Specky TDD bindings
 */
import { describe, expect, it } from "vitest";

describe("api", () => {
  // Traces to: REQ-API-001
  it("REQ-API-001: creates an item", async () => {
    expect(true).toBe(false);
  });
});
`;

    it("reports enhanced coverage that meets the contracted threshold", async () => {
      const ws = workspace("specky-test-verify-pass-");
      const harness = await buildHarness(ws, { framework: "vitest" });
      closes.push(harness.close);
      mkdirSync(join(ws, "custom-tests"), { recursive: true });
      writeFileSync(join(ws, "custom-tests/api.test.ts"), GENERATED_TEST_FILE);
      writeFileSync(
        join(ws, FEATURE_DIR, ".specky-generated-tests.json"),
        JSON.stringify([{ framework: "vitest", file: "custom-tests/api.test.ts" }]),
      );

      const result = await callTool(harness.client, "sdd_verify_tests", {
        ...FEATURE_ARGS,
        test_results_json: JSON.stringify([
          { name: "REQ-API-001: creates an item", status: "passed" },
        ]),
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "verified",
        coverage_percentage: 100,
        total_requirements: 1,
        covered_requirements: ["REQ-API-001"],
        coverage_threshold: 80,
        meets_threshold: true,
      });
      const enhanced = result.payload["enhanced_coverage"] as Record<string, unknown>;
      expect(enhanced["overall_percent"]).toBe(100);
      expect(enhanced["untested_requirements"]).toEqual([]);
      expect(enhanced["failing_requirements"]).toEqual([]);
      expect(String(result.payload["next_steps"])).toContain("meets the contracted 80% threshold");
    });

    it("reports uncovered requirements below the threshold", async () => {
      const harness = await buildHarness(workspace("specky-test-verify-uncovered-"), {
        framework: "vitest",
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_verify_tests", {
        ...FEATURE_ARGS,
        test_results_json: JSON.stringify([{ name: "unrelated suite passes", status: "passed" }]),
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "verified",
        coverage_percentage: 0,
        uncovered_requirements: ["REQ-API-001"],
        meets_threshold: false,
      });
      const enhanced = result.payload["enhanced_coverage"] as Record<string, unknown>;
      expect(enhanced["overall_percent"]).toBe(0);
      expect(enhanced["untested_requirements"]).toEqual(["REQ-API-001"]);
      expect(String(result.payload["next_steps"])).toContain(
        "below the contracted 80% threshold. Uncovered: REQ-API-001",
      );
    });

    it("surfaces failure details for failing requirement-bound tests", async () => {
      const ws = workspace("specky-test-verify-failing-");
      const harness = await buildHarness(ws, { framework: "vitest" });
      closes.push(harness.close);
      mkdirSync(join(ws, "tests"), { recursive: true });
      writeFileSync(join(ws, "tests/api.test.ts"), GENERATED_TEST_FILE);

      const result = await callTool(harness.client, "sdd_verify_tests", {
        ...FEATURE_ARGS,
        test_results_json: JSON.stringify([
          {
            name: "REQ-API-001: creates an item",
            status: "failed",
            message: "expected 201 got 500",
          },
        ]),
      });
      expect(result.isError).toBe(false);
      expect(result.payload["status"]).toBe("verified");
      const enhanced = result.payload["enhanced_coverage"] as Record<string, unknown>;
      expect(enhanced["overall_percent"]).toBe(0);
      expect(enhanced["failing_requirements"]).toEqual(["REQ-API-001"]);
      const failures = result.payload["failure_details"] as Array<Record<string, unknown>>;
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({
        requirement_id: "REQ-API-001",
        test_name: "REQ-API-001: creates an item",
      });
      expect(String(failures[0]?.["error_snippet"])).toContain("expected 201 got 500");
      expect(String(failures[0]?.["suggested_fix_prompt"])).toContain("REQ-API-001");
      const matrix = result.payload["traceability_matrix"] as Array<Record<string, unknown>>;
      expect(matrix[0]).toMatchObject({ requirement: "REQ-API-001", status: "failing" });
    });

    it("returns an error status for unparseable test results JSON", async () => {
      const harness = await buildHarness(workspace("specky-test-verify-badjson-"), {
        framework: "vitest",
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_verify_tests", {
        ...FEATURE_ARGS,
        test_results_json: "not-json{{",
      });
      expect(result.isError).toBe(false);
      expect(result.payload["status"]).toBe("error");
      expect(String(result.payload["error"])).toContain(
        "Invalid JSON: could not parse test results.",
      );
      expect(result.payload["meets_threshold"]).toBe(false);
    });
  });
});
