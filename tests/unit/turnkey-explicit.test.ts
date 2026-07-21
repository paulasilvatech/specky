import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { EarsValidator } from "../../src/services/ears-validator.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { registerTurnkeyTools } from "../../src/tools/turnkey.js";

const REPO = resolve(import.meta.dirname, "../..");
const FEATURE_DIR = ".specs/001-orders";

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(workspace: string): Promise<Harness> {
  cpSync(join(REPO, "templates"), join(workspace, ".templates"), { recursive: true });
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "orders",
    feature: { number: "001", name: "orders", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "service",
      execution_mode: "full",
      capabilities: [],
      capability_config: {},
    }),
  });
  state.current_phase = Phase.Discover;
  state.phases[Phase.Init] = { status: "completed" };
  state.phases[Phase.Discover] = { status: "in_progress" };
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "turnkey-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerTurnkeyTools(
    server,
    fileManager,
    stateMachine,
    new TemplateEngine(fileManager, ".templates"),
    new EarsValidator(),
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "turnkey-test", version: "0.0.0" });
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

async function callTurnkey(client: Client, text: string, pattern: string) {
  const response = await client.callTool({
    name: "sdd_turnkey_spec",
    arguments: {
      spec_dir: ".specs",
      feature_number: "001",
      feature_name: "orders",
      force: false,
      discovery_context: "Order operators require a source-backed create-order service contract.",
      clarification_responses: { "CQ-001": "Order identifiers are UUID values." },
      requirements: [
        {
          id: "REQ-ORDER-001",
          ears_pattern: pattern,
          title: "Create order",
          text,
          acceptance_criteria: ["A valid create request returns the persisted order identifier"],
          source_evidence: "Reviewed order operations requirement ORD-17",
        },
      ],
    },
  });
  const raw = (response.content as Array<{ text?: string }>)[0]?.text ?? "";
  return { isError: response.isError === true, raw };
}

describe("explicit turnkey specification", () => {
  const workspaces: string[] = [];
  const closes: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  async function harness(): Promise<Harness> {
    const workspace = mkdtempSync(join(tmpdir(), "specky-turnkey-explicit-"));
    workspaces.push(workspace);
    const result = await buildHarness(workspace);
    closes.push(result.close);
    return result;
  }

  it("assembles only the caller-provided requirement and evidence", async () => {
    const testHarness = await harness();
    const result = await callTurnkey(
      testHarness.client,
      "When an operator submits a valid order, the system shall persist it and return its UUID.",
      "event_driven",
    );
    expect(result.isError, result.raw).toBe(false);
    const specPath = join(testHarness.workspace, FEATURE_DIR, "SPECIFICATION.md");
    expect(existsSync(specPath)).toBe(true);
    const content = await new FileManager(testHarness.workspace).readSpecFile(
      FEATURE_DIR,
      "SPECIFICATION.md",
    );
    expect(content).toContain("REQ-ORDER-001");
    expect(content).toContain("Reviewed order operations requirement ORD-17");
    expect(content).not.toContain("REQ-NFR-");
    expect(content).not.toContain("auto-generated");
  });

  it("rejects a mismatched EARS declaration before writing", async () => {
    const testHarness = await harness();
    const result = await callTurnkey(
      testHarness.client,
      "When an operator submits a valid order, the system shall persist it.",
      "ubiquitous",
    );
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("declares ubiquitous but the validator detects event_driven");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "SPECIFICATION.md"))).toBe(false);
  });
});
