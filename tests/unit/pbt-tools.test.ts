/**
 * pbt-tools.test.ts — MCP-level coverage for sdd_generate_pbt
 * (src/tools/pbt.ts). The tool is feature-scoped, phase-restricted
 * (implement/verify), capability-gated (tdd), and gate-sensitive
 * (requires an APPROVE gate decision once the pipeline reaches analyze).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { PbtGenerator } from "../../src/services/pbt-generator.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerPbtTools } from "../../src/tools/pbt.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import type { SddState } from "../../src/types.js";

const SPEC_DIR = ".specs";
const FEATURE_DIR = ".specs/001-api";

const SPEC = `### REQ-CORE-001: Create item

When a client submits an item, the system shall persist it and return it with the submitted name.
`;

const TWO_REQ_SPEC = `${SPEC}
### REQ-CORE-002: Delete item

When a client deletes an item, the system shall remove it from storage.
`;

const PROPERTY_BODY = [
  'it("REQ-CORE-001: creation preserves the submitted name", () => {',
  "  fc.assert(fc.property(fc.string(), (name) => {",
  "    expect(createItem({ name }).name).toBe(name);",
  "  }));",
  "});",
].join("\n");

function tddContract(
  options: { propertyFramework?: "fast-check" | "hypothesis"; propertyBody?: string } = {},
) {
  const propertyFramework = options.propertyFramework ?? "fast-check";
  const propertyImports =
    propertyFramework === "hypothesis"
      ? "from hypothesis import given, strategies as st"
      : 'import fc from "fast-check";\nimport { expect, it } from "vitest";';
  return resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "service",
    execution_mode: "full",
    capabilities: ["tdd"],
    capability_config: {
      tdd: {
        framework: "vitest",
        property_framework: propertyFramework,
        output_dir: "tests",
        coverage_threshold: 90,
        trace_marker: "REQ-",
        imports: 'import { describe, it, expect } from "vitest";',
        bindings: [
          {
            requirement_id: "REQ-CORE-001",
            test_name: "returns the persisted item",
            body: "const created = createItem({ name: 'a' });\nexpect(created.name).toBe('a');",
          },
        ],
        property_imports: propertyImports,
        property_bindings: [
          {
            requirement_id: "REQ-CORE-001",
            property_name: "creation preserves the submitted name",
            property_type: "invariant",
            body: options.propertyBody ?? PROPERTY_BODY,
          },
        ],
      },
    },
  });
}

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  options: {
    spec?: string;
    phase?: Phase;
    approve?: boolean;
    propertyFramework?: "fast-check" | "hypothesis";
    propertyBody?: string;
  } = {},
): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), options.spec ?? SPEC);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state: SddState = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: tddContract({
      propertyFramework: options.propertyFramework,
      propertyBody: options.propertyBody,
    }),
  });
  state.current_phase = options.phase ?? Phase.Implement;
  if (options.approve ?? true) {
    state.gate_decision = {
      decision: "APPROVE",
      reasons: ["Fixture evidence is complete"],
      coverage_percent: 100,
      gaps: [],
      decided_at: "2026-07-15T00:00:00.000Z",
    };
  }
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "pbt-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerPbtTools(server, fileManager, stateMachine, new PbtGenerator(fileManager));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "pbt-test", version: "0.0.0" });
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

async function callGeneratePbt(client: Client) {
  const response = await client.callTool({
    name: "sdd_generate_pbt",
    arguments: { spec_dir: SPEC_DIR, feature_number: "001" },
  });
  const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }
  return { isError: response.isError === true, payload, raw: text };
}

describe("sdd_generate_pbt MCP tool", () => {
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

  it("assembles executable fast-check properties from persisted bindings", async () => {
    const harness = await buildHarness(workspace("specky-pbt-"));
    closes.push(harness.close);

    const result = await callGeneratePbt(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "pbt_generated",
      framework: "fast-check",
      total_properties: 1,
      property_types: { invariant: 1 },
      output_file: "tests/api.pbt.test.ts",
    });
    expect(result.payload["traceability"]).toEqual([
      {
        prop_id: "PROP-001",
        requirement: "REQ-CORE-001",
        type: "invariant",
        description: "creation preserves the submitted name",
      },
    ]);

    const outputPath = join(harness.workspace, "tests", "api.pbt.test.ts");
    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("REQ-CORE-001");
    expect(content).toContain('import fc from "fast-check";');
    expect(content).toContain("fc.assert(fc.property");
  });

  it("rejects bindings that do not cover every specification requirement", async () => {
    const harness = await buildHarness(workspace("specky-pbt-mismatch-"), { spec: TWO_REQ_SPEC });
    closes.push(harness.close);

    const result = await callGeneratePbt(harness.client);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Property bindings mismatch");
    expect(result.raw).toContain("REQ-CORE-002");
    expect(existsSync(join(harness.workspace, "tests", "api.pbt.test.ts"))).toBe(false);
  });

  it("is denied outside the implement/verify phases", async () => {
    const harness = await buildHarness(workspace("specky-pbt-phase-"), { phase: Phase.Specify });
    closes.push(harness.close);

    const result = await callGeneratePbt(harness.client);
    expect(result.isError).toBe(true);
    expect(result.payload["error"]).toBe("phase_validation_failed");
    expect(result.payload["current_phase"]).toBe("specify");
    expect(result.payload["expected_phases"]).toEqual(["implement", "verify"]);
  });

  it("is denied without an APPROVE gate decision in a gate-sensitive phase", async () => {
    const harness = await buildHarness(workspace("specky-pbt-gate-"), { approve: false });
    closes.push(harness.close);

    const result = await callGeneratePbt(harness.client);
    expect(result.isError).toBe(true);
    expect(result.payload["error"]).toBe("gate_blocked");
    expect(result.raw).toContain("sdd_run_analysis");
  });

  it("generates hypothesis-flavored python properties for the hypothesis framework", async () => {
    const hypothesisBody = [
      "# REQ-CORE-001: creation preserves the submitted name",
      "@given(name=st.text())",
      "def test_create_item_preserves_name(name):",
      "    assert create_item(name).name == name",
    ].join("\n");
    const harness = await buildHarness(workspace("specky-pbt-hypothesis-"), {
      phase: Phase.Verify,
      propertyFramework: "hypothesis",
      propertyBody: hypothesisBody,
    });
    closes.push(harness.close);

    const result = await callGeneratePbt(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "pbt_generated",
      framework: "hypothesis",
      total_properties: 1,
      output_file: "tests/api_pbt_test.py",
    });
    const outputPath = join(harness.workspace, "tests", "api_pbt_test.py");
    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("REQ-CORE-001");
    expect(content).toContain("from hypothesis import");
  });
});
