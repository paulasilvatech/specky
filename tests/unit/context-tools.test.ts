/**
 * context-tools.test.ts — MCP-level coverage for sdd_context_status
 * (src/tools/context.ts). Token estimates are deterministic:
 * ContextTieringEngine.estimateTokens = ceil(chars / 4).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { ContextTieringEngine } from "../../src/services/context-tiering-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerContextTools } from "../../src/tools/context.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";

const SPEC_DIR = ".specs";
const FEATURE_DIR = ".specs/001-api";

interface Harness {
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  artifacts: Record<string, string>,
): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  for (const [name, content] of Object.entries(artifacts)) {
    writeFileSync(join(workspace, FEATURE_DIR, name), content);
  }

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
  state.current_phase = Phase.Implement;
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "context-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerContextTools(server, fileManager, stateMachine, new ContextTieringEngine());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "context-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("sdd_context_status MCP tool", () => {
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

  async function callContextStatus(client: Client) {
    const response = await client.callTool({
      name: "sdd_context_status",
      arguments: { spec_dir: SPEC_DIR, feature_number: "001" },
    });
    const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
    return {
      isError: response.isError === true,
      payload: JSON.parse(text) as Record<string, unknown>,
    };
  }

  it("aggregates token estimates per tier and computes session savings", async () => {
    // Hot: 400 chars -> 100 tokens; domain: 800 -> 200; cold: 200 -> 50.
    const harness = await buildHarness(workspace("specky-ctx-tiers-"), {
      "CONSTITUTION.md": "c".repeat(400),
      "SPECIFICATION.md": "s".repeat(800),
      "ANALYSIS.md": "a".repeat(200),
    });
    closes.push(harness.close);

    const result = await callContextStatus(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "context_status_returned",
      feature_number: "001",
      total_hot_tokens: 100,
      total_domain_tokens: 200,
      total_cold_tokens: 50,
      universal_would_load_tokens: 350,
      session_loads_tokens: 300,
      // 1 - 300/350 = 14.28...% -> rounds to 14.
      savings_percent: 14,
    });

    const tierTable = result.payload["tier_table"] as Array<{ filename: string; tier: string }>;
    expect(tierTable).toHaveLength(10);
    const tierOf = (filename: string) =>
      tierTable.find((entry) => entry.filename === filename)?.tier;
    expect(tierOf("CONSTITUTION.md")).toBe("hot");
    expect(tierOf("SPECIFICATION.md")).toBe("domain");
    expect(tierOf("TASKS.md")).toBe("domain");
    expect(tierOf("ANALYSIS.md")).toBe("cold");
    expect(tierOf("VERIFICATION.md")).toBe("cold");
  });

  it("reports zero load and zero savings when no tier artifacts exist", async () => {
    const harness = await buildHarness(workspace("specky-ctx-empty-"), {});
    closes.push(harness.close);

    const result = await callContextStatus(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "context_status_returned",
      total_hot_tokens: 0,
      total_domain_tokens: 0,
      total_cold_tokens: 0,
      universal_would_load_tokens: 0,
      session_loads_tokens: 0,
      savings_percent: 0,
    });
  });

  it("ignores artifacts that are not part of the tier table", async () => {
    // 400 hot chars (100 tokens) + a non-tier file that must not be counted.
    const harness = await buildHarness(workspace("specky-ctx-extra-"), {
      "CONSTITUTION.md": "c".repeat(400),
      "NOTES.md": "n".repeat(4000),
    });
    closes.push(harness.close);

    const result = await callContextStatus(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      total_hot_tokens: 100,
      total_domain_tokens: 0,
      total_cold_tokens: 0,
      universal_would_load_tokens: 100,
      session_loads_tokens: 100,
      savings_percent: 0,
    });
  });
});
