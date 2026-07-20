/**
 * checkpoint-tools.test.ts — MCP-level coverage for sdd_checkpoint,
 * sdd_restore, and sdd_list_checkpoints (src/tools/checkpoint.ts).
 * Uses the in-memory MCP harness with tool enforcement installed, matching
 * documentation-tools.test.ts.
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
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerCheckpointTools } from "../../src/tools/checkpoint.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";

const SPEC_DIR = ".specs";

const SPEC = `### REQ-API-001: Create item

When a client submits an item, the system shall persist and return it.
`;

const DESIGN = `## System Context

A named client calls the API.
`;

interface Harness {
  workspace: string;
  client: Client;
  stateMachine: StateMachine;
  close: () => Promise<void>;
}

async function writeFeature(
  workspace: string,
  number: string,
  name: string,
  phase: Phase = Phase.Implement,
): Promise<{ featureDir: string; stateMachine: StateMachine }> {
  const featureDir = `${SPEC_DIR}/${number}-${name}`;
  mkdirSync(join(workspace, featureDir), { recursive: true });
  writeFileSync(join(workspace, featureDir, "SPECIFICATION.md"), SPEC);
  writeFileSync(join(workspace, featureDir, "DESIGN.md"), DESIGN);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: name,
    feature: { number, name, directory: featureDir },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: [],
      capability_config: {},
    }),
  });
  state.current_phase = phase;
  await stateMachine.saveState(featureDir, state);
  return { featureDir, stateMachine };
}

async function buildHarness(workspace: string, phase: Phase = Phase.Implement): Promise<Harness> {
  const { stateMachine } = await writeFeature(workspace, "001", "api", phase);
  const fileManager = new FileManager(workspace);

  const server = new McpServer({ name: "checkpoint-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerCheckpointTools(server, fileManager, stateMachine);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "checkpoint-test", version: "0.0.0" });
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

function baseArgs(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { spec_dir: SPEC_DIR, feature_number: "001", ...extra };
}

describe("checkpoint MCP tools", () => {
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

  it("creates a checkpoint capturing artifact contents and pipeline state", async () => {
    const harness = await buildHarness(workspace("specky-cp-create-"));
    closes.push(harness.close);

    const result = await callTool(
      harness.client,
      "sdd_checkpoint",
      baseArgs({ label: "before-redesign" }),
    );
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "checkpoint_created",
      checkpoint_id: "CP-001",
      label: "before-redesign",
      phase: "implement",
    });
    expect(result.payload["artifacts_saved"]).toEqual(
      expect.arrayContaining(["SPECIFICATION.md", "DESIGN.md"]),
    );

    const checkpointPath = join(
      harness.workspace,
      SPEC_DIR,
      "001-api",
      ".checkpoints",
      "CP-001.json",
    );
    expect(existsSync(checkpointPath)).toBe(true);
    const persisted = JSON.parse(readFileSync(checkpointPath, "utf8")) as Record<string, unknown>;
    expect(persisted["id"]).toBe("CP-001");
    expect(persisted["label"]).toBe("before-redesign");
    expect(persisted["phase"]).toBe("implement");
    expect(persisted["contract_id"]).toBe("greenfield-api-full");
    expect((persisted["artifact_contents"] as Record<string, string>)["SPECIFICATION.md"]).toBe(
      SPEC,
    );
    expect((persisted["artifact_contents"] as Record<string, string>)["DESIGN.md"]).toBe(DESIGN);
  });

  it("assigns a default label and increments checkpoint ids", async () => {
    const harness = await buildHarness(workspace("specky-cp-sequence-"));
    closes.push(harness.close);

    const first = await callTool(harness.client, "sdd_checkpoint", baseArgs());
    const second = await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "v2" }));
    expect(first.payload).toMatchObject({ checkpoint_id: "CP-001", label: "Checkpoint 1" });
    expect(second.payload).toMatchObject({ checkpoint_id: "CP-002", label: "v2" });
  });

  it("restores artifact contents and pipeline phase from a checkpoint", async () => {
    const harness = await buildHarness(workspace("specky-cp-restore-"));
    closes.push(harness.close);
    const featureDir = join(harness.workspace, SPEC_DIR, "001-api");

    await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "v1-approved" }));

    // Diverge: rewrite the spec and move the pipeline phase forward.
    const rewrittenSpec = `${SPEC}\n### REQ-API-002: Delete item\n\nWhen asked, the system shall delete items.\n`;
    writeFileSync(join(featureDir, "SPECIFICATION.md"), rewrittenSpec);
    const diverged = await harness.stateMachine.loadState(`${SPEC_DIR}/001-api`);
    diverged.current_phase = Phase.Verify;
    await harness.stateMachine.saveState(`${SPEC_DIR}/001-api`, diverged);

    const result = await callTool(
      harness.client,
      "sdd_restore",
      baseArgs({ checkpoint_id: "CP-001" }),
    );
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "checkpoint_restored",
      checkpoint_id: "CP-001",
      checkpoint_label: "v1-approved",
      restored_phase: "implement",
      auto_backup: "CP-AUTO-BACKUP",
    });
    expect(result.payload["restored_artifacts"]).toEqual(
      expect.arrayContaining(["SPECIFICATION.md", "DESIGN.md"]),
    );

    // Artifact bytes and pipeline phase return to the checkpoint snapshot.
    expect(readFileSync(join(featureDir, "SPECIFICATION.md"), "utf8")).toBe(SPEC);
    const restored = await harness.stateMachine.loadState(`${SPEC_DIR}/001-api`);
    expect(restored.current_phase).toBe(Phase.Implement);

    // The diverged state was preserved as an automatic backup checkpoint.
    const backup = JSON.parse(
      readFileSync(join(featureDir, ".checkpoints", "CP-AUTO-BACKUP.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(backup["id"]).toBe("CP-AUTO-BACKUP");
    expect((backup["artifact_contents"] as Record<string, string>)["SPECIFICATION.md"]).toBe(
      rewrittenSpec,
    );
  });

  it("restores a checkpoint addressed by label instead of id", async () => {
    const harness = await buildHarness(workspace("specky-cp-restore-label-"));
    closes.push(harness.close);

    await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "stable-baseline" }));
    const result = await callTool(
      harness.client,
      "sdd_restore",
      baseArgs({ checkpoint_id: "stable-baseline" }),
    );
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "checkpoint_restored",
      checkpoint_id: "CP-001",
      checkpoint_label: "stable-baseline",
    });
  });

  it("rejects restoring a checkpoint id that does not exist", async () => {
    const harness = await buildHarness(workspace("specky-cp-restore-missing-"));
    closes.push(harness.close);

    const result = await callTool(
      harness.client,
      "sdd_restore",
      baseArgs({ checkpoint_id: "CP-999" }),
    );
    expect(result.isError).toBe(true);
    expect(result.raw).toContain('Checkpoint "CP-999" not found');
  });

  it("rejects restoring a checkpoint that belongs to a different feature", async () => {
    const harness = await buildHarness(workspace("specky-cp-foreign-"));
    closes.push(harness.close);

    await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "feature-one" }));

    // A second feature with its own state receives a copy of feature 001's checkpoint.
    await writeFeature(harness.workspace, "002", "shop");
    const foreignCheckpointsDir = join(harness.workspace, SPEC_DIR, "002-shop", ".checkpoints");
    mkdirSync(foreignCheckpointsDir, { recursive: true });
    const checkpoint = readFileSync(
      join(harness.workspace, SPEC_DIR, "001-api", ".checkpoints", "CP-001.json"),
      "utf8",
    );
    writeFileSync(join(foreignCheckpointsDir, "CP-001.json"), checkpoint);

    const result = await callTool(harness.client, "sdd_restore", {
      spec_dir: SPEC_DIR,
      feature_number: "002",
      checkpoint_id: "CP-001",
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("does not belong to feature 002");
  });

  it("reports an empty checkpoint list before the first checkpoint", async () => {
    const harness = await buildHarness(workspace("specky-cp-list-empty-"));
    closes.push(harness.close);

    // NOTE: FileManager.listSpecFiles swallows readdir errors and returns
    // [], so the tool's "no_checkpoints" branch is unreachable; an empty
    // list surfaces as "checkpoints_listed" with total 0.
    const result = await callTool(harness.client, "sdd_list_checkpoints", baseArgs());
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "checkpoints_listed",
      total: 0,
      checkpoints: [],
    });
    expect(result.raw).toContain("No checkpoints yet");
  });

  it("lists created checkpoints with id, label, phase, and artifacts", async () => {
    const harness = await buildHarness(workspace("specky-cp-list-"));
    closes.push(harness.close);

    await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "first" }));
    await callTool(harness.client, "sdd_checkpoint", baseArgs({ label: "second" }));

    const result = await callTool(harness.client, "sdd_list_checkpoints", baseArgs());
    expect(result.isError).toBe(false);
    expect(result.payload["status"]).toBe("checkpoints_listed");
    expect(result.payload["total"]).toBe(2);
    const checkpoints = result.payload["checkpoints"] as Array<Record<string, unknown>>;
    expect(checkpoints.map((cp) => cp["id"]).sort()).toEqual(["CP-001", "CP-002"]);
    for (const cp of checkpoints) {
      expect(cp["phase"]).toBe("implement");
      expect(cp["artifacts"]).toEqual(expect.arrayContaining(["SPECIFICATION.md", "DESIGN.md"]));
      expect(typeof cp["created_at"]).toBe("string");
    }
    expect(checkpoints.map((cp) => cp["label"]).sort()).toEqual(["first", "second"]);
  });

  it("denies checkpoint listing for an unregistered feature number", async () => {
    const harness = await buildHarness(workspace("specky-cp-list-unknown-"));
    closes.push(harness.close);

    const result = await callTool(harness.client, "sdd_list_checkpoints", {
      spec_dir: SPEC_DIR,
      feature_number: "009",
    });
    expect(result.isError).toBe(true);
    expect(result.payload["error"]).toBe("feature_not_found");
  });
});
