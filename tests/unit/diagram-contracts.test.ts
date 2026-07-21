import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { registerVisualizationTools } from "../../src/tools/visualization.js";

const FEATURE_DIR = ".specs/001-api";
const DESIGN = `# API Design

## System Context

The Order Client uses the Order API.

## Request Flow

The Order Client submits an order and the Order API returns the created order.

## Data Model

Order has an identifier and status.
`;

const REQUIRED_DIAGRAMS = [
  {
    diagram_type: "c4_context",
    mermaid_code:
      'C4Context\n  Person(client, "Order Client")\n  System(api, "Order API")\n  Rel(client, api, "uses")',
    evidence_refs: ["Order Client", "Order API"],
  },
  {
    diagram_type: "sequence",
    mermaid_code:
      "sequenceDiagram\n  participant Client\n  participant API\n  Client->>API: submits an order\n  API-->>Client: created order",
    evidence_refs: ["submits an order", "created order"],
  },
  {
    diagram_type: "er",
    mermaid_code: "erDiagram\n  ORDER {\n    string identifier\n    string status\n  }",
    evidence_refs: ["Order", "identifier", "status"],
  },
] as const;

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(workspace: string): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), DESIGN);
  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: [],
      capability_config: {},
    }),
  });
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "diagram-contract-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerVisualizationTools(server, fileManager, stateMachine, new DiagramGenerator());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "diagram-contract-test", version: "0.0.0" });
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

async function callAll(client: Client, diagrams: unknown[]) {
  const response = await client.callTool({
    name: "sdd_generate_all_diagrams",
    arguments: { spec_dir: ".specs", feature_number: "001", force: false, diagrams },
  });
  const raw = (response.content as Array<{ text?: string }>)[0]?.text ?? "";
  return { isError: response.isError === true, raw };
}

describe("workload diagram contracts", () => {
  const workspaces: string[] = [];
  const closes: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  async function harness(): Promise<Harness> {
    const workspace = mkdtempSync(join(tmpdir(), "specky-diagram-contract-"));
    workspaces.push(workspace);
    const result = await buildHarness(workspace);
    closes.push(result.close);
    return result;
  }

  it("writes exactly the three diagrams required by the API workload", async () => {
    const testHarness = await harness();
    const result = await callAll(testHarness.client, [...REQUIRED_DIAGRAMS]);
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"total_generated": 3');
    expect(result.raw).toContain("API System Context");
    expect(result.raw).toContain("API Request Sequence");
    expect(result.raw).toContain("API Data Model");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(true);
  });

  it("rejects missing, extra, and duplicate diagram types before writing", async () => {
    const testHarness = await harness();
    const mismatched = [
      REQUIRED_DIAGRAMS[0],
      REQUIRED_DIAGRAMS[0],
      {
        diagram_type: "flowchart",
        mermaid_code: "flowchart TD\nA[Order] --> B[API]",
        evidence_refs: ["Order API"],
      },
    ];
    const result = await callAll(testHarness.client, mismatched);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Diagram set mismatch");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });

  it("rejects ungrounded evidence before writing the diagram set", async () => {
    const testHarness = await harness();
    const ungrounded = REQUIRED_DIAGRAMS.map((diagram) => ({ ...diagram }));
    ungrounded[1] = { ...ungrounded[1], evidence_refs: ["fabricated payment provider"] };
    const result = await callAll(testHarness.client, ungrounded);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("evidence is absent from its source");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });

  it("rejects incompatible Mermaid syntax for the contracted type", async () => {
    const testHarness = await harness();
    const invalid = REQUIRED_DIAGRAMS.map((diagram) => ({ ...diagram }));
    invalid[2] = { ...invalid[2], mermaid_code: "flowchart TD\nA[Order] --> B[Status]" };
    const result = await callAll(testHarness.client, invalid);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("incompatible Mermaid header");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });
});
