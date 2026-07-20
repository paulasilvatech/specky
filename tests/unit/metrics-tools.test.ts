/**
 * metrics-tools.test.ts — MCP-level coverage for sdd_metrics
 * (src/tools/metrics.ts), including the optional cognitive-debt and
 * intent-drift enrichment paths.
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
import { CognitiveDebtEngine } from "../../src/services/cognitive-debt-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { IntentDriftEngine } from "../../src/services/intent-drift-engine.js";
import { MetricsGenerator } from "../../src/services/metrics-generator.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerMetricsTools } from "../../src/tools/metrics.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import type { GateHistoryEntry, SddState } from "../../src/types.js";

const SPEC_DIR = ".specs";
const FEATURE_DIR = ".specs/001-api";

const SPEC = `# API — Specification

## 1. Core Requirements

### REQ-API-001: (event_driven)

When a client sends POST /items, the system shall create an item.

### REQ-API-002: (ubiquitous)

The system shall persist items across restarts.

## Acceptance Criteria Summary

| ID | Requirement |
|----|-------------|
| REQ-API-001 | create item |
| REQ-API-002 | persist items |
`;

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  options: {
    cognitiveDebt?: boolean;
    intentDrift?: boolean;
    mutateState?: (state: SddState) => void;
  } = {},
): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), SPEC);

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
  state.current_phase = Phase.Verify;
  options.mutateState?.(state);
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "metrics-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerMetricsTools(
    server,
    fileManager,
    stateMachine,
    new MetricsGenerator(fileManager),
    options.cognitiveDebt ? new CognitiveDebtEngine() : undefined,
    options.intentDrift ? new IntentDriftEngine() : undefined,
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "metrics-test", version: "0.0.0" });
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

async function callMetrics(client: Client, force: boolean) {
  const response = await client.callTool({
    name: "sdd_metrics",
    arguments: { spec_dir: SPEC_DIR, feature_number: "001", force },
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

describe("sdd_metrics MCP tool", () => {
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

  it("generates the HTML dashboard and summarizes requirement metrics", async () => {
    const harness = await buildHarness(workspace("specky-metrics-tool-"));
    closes.push(harness.close);

    const result = await callMetrics(harness.client, false);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "metrics_generated",
      feature_dir: FEATURE_DIR,
      feature_number: "001",
      html_path: `${FEATURE_DIR}/metrics-dashboard.html`,
    });
    expect(result.payload["summary"]).toMatchObject({
      requirements_count: 2,
      compliance_score: 0,
      tasks_total: 0,
      test_coverage_percent: 0,
    });

    const dashboard = join(harness.workspace, FEATURE_DIR, "metrics-dashboard.html");
    expect(existsSync(dashboard)).toBe(true);
    expect(readFileSync(dashboard, "utf8")).toContain("Specky Metrics Dashboard");

    // No optional engines were wired, so the enrichment keys stay absent
    // (JSON.stringify drops undefined values).
    expect("cognitive_debt" in result.payload).toBe(false);
    expect("intent_drift" in result.payload).toBe(false);
  });

  it("refuses to overwrite an existing dashboard without force", async () => {
    const harness = await buildHarness(workspace("specky-metrics-conflict-"));
    closes.push(harness.close);
    writeFileSync(
      join(harness.workspace, FEATURE_DIR, "metrics-dashboard.html"),
      "stale dashboard\n",
    );

    const result = await callMetrics(harness.client, false);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("File already exists");
    expect(
      readFileSync(join(harness.workspace, FEATURE_DIR, "metrics-dashboard.html"), "utf8"),
    ).toBe("stale dashboard\n");
  });

  it("overwrites an existing dashboard when force is true", async () => {
    const harness = await buildHarness(workspace("specky-metrics-force-"));
    closes.push(harness.close);
    writeFileSync(
      join(harness.workspace, FEATURE_DIR, "metrics-dashboard.html"),
      "stale dashboard\n",
    );

    const result = await callMetrics(harness.client, true);
    expect(result.isError).toBe(false);
    expect(result.payload["status"]).toBe("metrics_generated");
    expect(
      readFileSync(join(harness.workspace, FEATURE_DIR, "metrics-dashboard.html"), "utf8"),
    ).toContain("Specky Metrics Dashboard");
  });

  it("includes cognitive-debt metrics computed from persisted gate history", async () => {
    const gateHistory: GateHistoryEntry[] = [
      {
        phase: "specify" as GateHistoryEntry["phase"],
        timestamp: "2026-07-15T00:00:00.000Z",
        artifact: "SPECIFICATION.md",
        was_modified: true,
      },
      {
        phase: "design" as GateHistoryEntry["phase"],
        timestamp: "2026-07-15T01:00:00.000Z",
        artifact: "DESIGN.md",
        was_modified: false,
      },
    ];
    const harness = await buildHarness(workspace("specky-metrics-debt-"), {
      cognitiveDebt: true,
      mutateState: (state) => {
        state.gate_history = gateHistory;
      },
    });
    closes.push(harness.close);

    const result = await callMetrics(harness.client, false);
    expect(result.isError).toBe(false);
    // 1 of 2 gates unmodified -> lgtm rate 50; no req_count delta ->
    // score = round(50 * 0.6) = 30 -> "healthy".
    expect(result.payload["cognitive_debt"]).toMatchObject({
      total_gates: 2,
      unmodified_gates: 1,
      lgtm_without_modification_rate: 50,
      cognitive_debt_score: 30,
      cognitive_debt_label: "healthy",
    });
  });

  it("includes the latest intent-drift snapshot when drift history exists", async () => {
    const harness = await buildHarness(workspace("specky-metrics-drift-"), {
      intentDrift: true,
      mutateState: (state) => {
        state.drift_history = [
          { timestamp: "2026-07-15T00:00:00.000Z", score: 42, orphaned_count: 1 },
        ];
      },
    });
    closes.push(harness.close);

    const result = await callMetrics(harness.client, false);
    expect(result.isError).toBe(false);
    expect(result.payload["intent_drift"]).toEqual({
      intent_drift_score: 42,
      drift_trend: "stable",
    });
  });

  it("omits the intent-drift section when the engine is wired but no snapshots exist", async () => {
    const harness = await buildHarness(workspace("specky-metrics-drift-empty-"), {
      intentDrift: true,
    });
    closes.push(harness.close);

    const result = await callMetrics(harness.client, false);
    expect(result.isError).toBe(false);
    expect("intent_drift" in result.payload).toBe(false);
  });
});
