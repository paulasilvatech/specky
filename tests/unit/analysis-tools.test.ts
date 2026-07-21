/**
 * analysis-tools.test.ts — MCP-level coverage for sdd_check_sync
 * (src/tools/analysis.ts), including the optional intent-drift engine path.
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
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { IntentDriftEngine } from "../../src/services/intent-drift-engine.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { registerAnalysisTools } from "../../src/tools/analysis.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";

const SPEC_DIR = ".specs";
const FEATURE_DIR = ".specs/001-api";

const SPEC = `### REQ-API-001: Create item

When a client submits an item, the system shall persist and return it.

### REQ-API-002: List items

When a client requests the collection, the system shall return every persisted item.
`;

const CONSTITUTION = `# Constitution

## Article I: Foundations

### Persist every item

Persistence outlives any single process.
`;

interface Harness {
  workspace: string;
  client: Client;
  stateMachine: StateMachine;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  options: { spec?: string | null; constitution?: string; intentDrift?: boolean } = {},
): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  if (options.spec !== null) {
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), options.spec ?? SPEC);
  }
  if (options.constitution) {
    writeFileSync(join(workspace, FEATURE_DIR, "CONSTITUTION.md"), options.constitution);
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

  const server = new McpServer({ name: "analysis-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerAnalysisTools(
    server,
    fileManager,
    stateMachine,
    new TemplateEngine(fileManager),
    options.intentDrift ? new IntentDriftEngine() : undefined,
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "analysis-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    workspace,
    client,
    stateMachine,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function callCheckSync(client: Client, args: Record<string, unknown> = {}) {
  const response = await client.callTool({
    name: "sdd_check_sync",
    arguments: { spec_dir: SPEC_DIR, feature_number: "001", ...args },
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

describe("sdd_check_sync MCP tool", () => {
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

  it("reports in_sync when every requirement is referenced in the given code paths", async () => {
    const harness = await buildHarness(workspace("specky-sync-"));
    closes.push(harness.close);
    mkdirSync(join(harness.workspace, "src"), { recursive: true });
    writeFileSync(
      join(harness.workspace, "src/items.ts"),
      "// Implements REQ-API-001 and REQ-API-002\nexport function createItem() { return { id: 1 }; }\n",
    );

    const result = await callCheckSync(harness.client, { code_paths: ["src/items.ts"] });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      in_sync: true,
      total_requirements: 2,
      implemented: 2,
      missing: 0,
      recommendation:
        "All requirements are referenced in code. Spec and implementation are in sync.",
    });
    expect(result.payload["drift_items"]).toEqual([
      { requirement_id: "REQ-API-001", status: "implemented" },
      { requirement_id: "REQ-API-002", status: "implemented" },
    ]);
    // No intent-drift engine was wired, so the report omits the section.
    expect("intent_drift" in result.payload).toBe(false);
  });

  it("flags requirements that are not referenced in any code path", async () => {
    const harness = await buildHarness(workspace("specky-sync-drift-"));
    closes.push(harness.close);
    mkdirSync(join(harness.workspace, "src"), { recursive: true });
    writeFileSync(
      join(harness.workspace, "src/items.ts"),
      "// Implements REQ-API-001 only\nexport function createItem() { return { id: 1 }; }\n",
    );

    const result = await callCheckSync(harness.client, { code_paths: ["src/items.ts"] });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({ in_sync: false, implemented: 1, missing: 1 });
    expect(result.payload["drift_items"]).toEqual([
      { requirement_id: "REQ-API-001", status: "implemented" },
      { requirement_id: "REQ-API-002", status: "not_found_in_code" },
    ]);
    expect(result.payload["recommendation"]).toContain("1 requirements not found in code");
  });

  it("marks every requirement as missing when no code paths are provided", async () => {
    const harness = await buildHarness(workspace("specky-sync-no-code-"));
    closes.push(harness.close);

    const result = await callCheckSync(harness.client);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      in_sync: false,
      total_requirements: 2,
      implemented: 0,
      missing: 2,
    });
  });

  it("skips unreadable code paths instead of failing the check", async () => {
    const harness = await buildHarness(workspace("specky-sync-missing-file-"));
    closes.push(harness.close);
    mkdirSync(join(harness.workspace, "src"), { recursive: true });
    writeFileSync(
      join(harness.workspace, "src/items.ts"),
      "// Implements REQ-API-001 and REQ-API-002\n",
    );

    const result = await callCheckSync(harness.client, {
      code_paths: ["src/does-not-exist.ts", "src/items.ts"],
    });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({ in_sync: true, implemented: 2, missing: 0 });
  });

  it("fails with a fix hint when SPECIFICATION.md is missing", async () => {
    const harness = await buildHarness(workspace("specky-sync-no-spec-"), { spec: null });
    closes.push(harness.close);

    const result = await callCheckSync(harness.client, { code_paths: ["src/items.ts"] });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("SPECIFICATION.md not found");
    expect(result.raw).toContain("Run sdd_write_spec first");
  });

  it("records an intent-drift snapshot in feature state when the engine is wired", async () => {
    const harness = await buildHarness(workspace("specky-sync-drift-engine-"), {
      constitution: CONSTITUTION,
      intentDrift: true,
    });
    closes.push(harness.close);
    mkdirSync(join(harness.workspace, "src"), { recursive: true });
    writeFileSync(join(harness.workspace, "src/items.ts"), "// REQ-API-001 REQ-API-002\n");

    const result = await callCheckSync(harness.client, { code_paths: ["src/items.ts"] });
    expect(result.isError).toBe(false);

    // The principle "Persist every item" (keywords: persist, every, item)
    // is covered by the spec, which mentions all three words, but there is
    // no TASKS.md, so it stays unimplemented:
    // score = (0 orphaned + 1 unimplemented) / 1 principle = 100.
    const intentDrift = result.payload["intent_drift"] as Record<string, unknown>;
    expect(intentDrift).toMatchObject({
      total_principles: 1,
      covered_principles: 1,
      intent_drift_score: 100,
      intent_drift_label: "significant_drift",
      drift_trend: "stable",
    });
    expect(intentDrift["orphaned_principles"]).toEqual([]);
    expect(intentDrift["unimplemented_principles"]).toHaveLength(1);

    const state = await harness.stateMachine.loadState(FEATURE_DIR);
    expect(state.drift_history).toHaveLength(1);
    expect(state.drift_history?.[0]).toMatchObject({ score: 100, orphaned_count: 0 });
  });

  it("appends to drift history across consecutive sync checks", async () => {
    const harness = await buildHarness(workspace("specky-sync-drift-history-"), {
      constitution: CONSTITUTION,
      intentDrift: true,
    });
    closes.push(harness.close);

    await callCheckSync(harness.client);
    await callCheckSync(harness.client);

    const state = await harness.stateMachine.loadState(FEATURE_DIR);
    expect(state.drift_history).toHaveLength(2);
    expect(state.drift_history?.every((snapshot) => snapshot.score === 100)).toBe(true);
  });
});
