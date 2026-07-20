import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { MCP_ECOSYSTEM, Phase, TOTAL_TOOLS, VERSION } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { CodebaseScanner } from "../../src/services/codebase-scanner.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { IntentDriftEngine } from "../../src/services/intent-drift-engine.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { registerUtilityTools } from "../../src/tools/utility.js";
import type { GateDecision, SddState } from "../../src/types.js";

const REPO = resolve(import.meta.dirname, "../..");
const FEATURE_DIR = ".specs/001-api";

const APPROVE_GATE: GateDecision = {
  decision: "APPROVE",
  reasons: ["Fixture evidence is complete"],
  coverage_percent: 100,
  gaps: [],
  decided_at: "2026-07-15T00:00:00.000Z",
};

interface Harness {
  workspace: string;
  client: Client;
  stateMachine: StateMachine;
  close: () => Promise<void>;
}

interface FeatureStateOptions {
  phase?: Phase;
  completedPhases?: Phase[];
  gate?: GateDecision | null;
  driftHistory?: SddState["drift_history"];
}

async function writeFeatureState(
  stateMachine: StateMachine,
  workspace: string,
  options: FeatureStateOptions = {},
): Promise<SddState> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "service",
      execution_mode: "full",
      capabilities: [],
      capability_config: {},
    }),
  });
  const phase = options.phase ?? Phase.Specify;
  for (const completed of options.completedPhases ?? []) {
    state.phases[completed] = { status: "completed", completed_at: "2026-07-14T00:00:00.000Z" };
  }
  state.current_phase = phase;
  state.phases[phase] = { status: "in_progress", started_at: "2026-07-15T00:00:00.000Z" };
  state.gate_decision = options.gate === undefined ? APPROVE_GATE : options.gate;
  if (options.driftHistory) state.drift_history = options.driftHistory;
  await stateMachine.saveState(FEATURE_DIR, state);
  return state;
}

async function buildHarness(
  workspace: string,
  options: { intentDrift?: boolean } = {},
): Promise<Harness> {
  cpSync(join(REPO, "templates"), join(workspace, "templates"), { recursive: true });
  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const templateEngine = new TemplateEngine(fileManager, "templates");
  const codebaseScanner = new CodebaseScanner(fileManager);

  const server = new McpServer({ name: "utility-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerUtilityTools(
    server,
    fileManager,
    stateMachine,
    templateEngine,
    codebaseScanner,
    options.intentDrift ? new IntentDriftEngine() : undefined,
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "utility-test", version: "0.0.0" });
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

// ─── Direct-handler harness (FakeServer pattern from tool-enforcement.test.ts) ───
// sdd_scan_codebase and sdd_check_ecosystem declare workspace scope, so the
// enforcement resolver requires spec_dir — but their strict input schemas omit
// it, which makes them unreachable through real MCP validation. The handler
// logic is exercised directly here instead.

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

type Handler = (...args: unknown[]) => Promise<ToolResult> | ToolResult;

class FakeServer {
  readonly handlers = new Map<string, Handler>();
  registerTool(name: string, _config: unknown, handler: Handler): void {
    this.handlers.set(name, handler);
  }
}

function getHandler(server: FakeServer, name: string): Handler {
  const handler = server.handlers.get(name);
  if (!handler) throw new Error(`Missing registered handler: ${name}`);
  return handler;
}

function buildDirectHarness(workspace: string) {
  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const server = new FakeServer();
  installToolEnforcement(server as unknown as McpServer, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerUtilityTools(
    server as unknown as McpServer,
    fileManager,
    stateMachine,
    new TemplateEngine(fileManager),
    new CodebaseScanner(fileManager),
  );
  return server;
}

async function callDirect(server: FakeServer, name: string, input: Record<string, unknown>) {
  const result = await getHandler(server, name)(input);
  const text = result.content[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }
  return { isError: result.isError === true, payload, raw: text };
}

const CONSTITUTION = `---
title: "Constitution"
amendment_count: 0
---

# Constitution

## Article I — Core Principles

### Evidence-Based Changes

All changes cite reviewed evidence.

## Amendment Log

| # | Date | Author | Rationale | Articles |
| — | — | — | Initial version | All |
`;

describe("utility MCP tools", () => {
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

  describe("sdd_get_status", () => {
    it("reports an empty workspace when no features exist", async () => {
      const harness = await buildHarness(workspace("specky-util-status-empty-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "workspace",
        spec_dir: ".specs",
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "workspace_status",
        view: "workspace",
        spec_directory: ".specs",
        feature_count: 0,
        ready_features: 0,
        features_requiring_attention: 0,
        active_feature: null,
      });
    });

    it("summarizes ready, invalid, and missing feature states in workspace view", async () => {
      const ws = workspace("specky-util-status-mixed-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws, {
        phase: Phase.Specify,
        completedPhases: [Phase.Init, Phase.Discover],
      });
      // Invalid state: unparsable JSON.
      mkdirSync(join(ws, ".specs/002-broken"), { recursive: true });
      writeFileSync(join(ws, ".specs/002-broken/.sdd-state.json"), "{ not json");
      // Missing state: directory with artifacts but no canonical state file.
      mkdirSync(join(ws, ".specs/003-ghost"), { recursive: true });
      writeFileSync(join(ws, ".specs/003-ghost/SPECIFICATION.md"), "### REQ-GHO-001: Ghost\n");

      const result = await callTool(harness.client, "sdd_get_status", {
        view: "workspace",
        spec_dir: ".specs",
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        feature_count: 3,
        ready_features: 1,
        features_requiring_attention: 2,
      });
      const features = result.payload["features"] as Array<Record<string, unknown>>;
      const ready = features.find((feature) => feature["number"] === "001");
      const broken = features.find((feature) => feature["number"] === "002");
      const ghost = features.find((feature) => feature["number"] === "003");
      expect(ready).toMatchObject({
        state_status: "ready",
        phase: Phase.Specify,
        phase_progress: "2/10",
      });
      expect(ready?.["contract_id"]).toBe("greenfield-service-full");
      expect(String(ready?.["contract_fingerprint"])).toMatch(/^[a-f0-9]{64}$/);
      expect("state" in (ready ?? {})).toBe(false);
      expect(broken).toMatchObject({ state_status: "invalid" });
      expect(String(broken?.["state_error"])).toContain("Invalid JSON");
      expect(ghost).toMatchObject({ state_status: "missing" });
      expect(String(ghost?.["state_error"])).toContain("Canonical state is missing");
    });

    it("returns feature view with completion math and the next action", async () => {
      const ws = workspace("specky-util-status-feature-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws, {
        phase: Phase.Specify,
        completedPhases: [Phase.Init, Phase.Discover],
      });
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "feature",
        spec_dir: ".specs",
        feature_number: "001",
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "feature_status",
        view: "feature",
        current_phase: Phase.Specify,
        completion_percent: 20,
        next_action: "Complete specify, then advance to clarify.",
      });
      expect(result.payload["next_action"]).toBe("Complete specify, then advance to clarify.");
      const active = result.payload["active_feature"] as Record<string, unknown>;
      expect(active).toMatchObject({ number: "001", name: "api", state_status: "ready" });
      expect("state" in active).toBe(false);
      const contract = result.payload["contract"] as Record<string, unknown>;
      expect(contract["id"]).toBe("greenfield-service-full");
      // buildToolResponse enrichment.
      expect(result.payload["phase_context"]).toMatchObject({ current_phase: Phase.Specify });
    });

    it("reports pipeline completion for a terminal-phase feature", async () => {
      const ws = workspace("specky-util-status-terminal-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws, {
        phase: Phase.Release,
        completedPhases: [
          Phase.Init,
          Phase.Discover,
          Phase.Specify,
          Phase.Clarify,
          Phase.Design,
          Phase.Tasks,
          Phase.Analyze,
          Phase.Implement,
          Phase.Verify,
        ],
      });
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "feature",
        spec_dir: ".specs",
        feature_number: "001",
      });
      expect(result.isError).toBe(false);
      expect(result.payload["completion_percent"]).toBe(90);
      expect(result.payload["next_action"]).toBe("The contracted pipeline is complete.");
    });

    it("fails feature view for an unknown feature number", async () => {
      const harness = await buildHarness(workspace("specky-util-status-unknown-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "feature",
        spec_dir: ".specs",
        feature_number: "999",
      });
      expect(result.isError).toBe(true);
      expect(result.raw).toContain("Feature 999 not found in .specs.");
    });

    it("reports feature_state_unavailable with an sdd_init fix when state is missing", async () => {
      const ws = workspace("specky-util-status-nostate-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      mkdirSync(join(ws, ".specs/001-api"), { recursive: true });
      writeFileSync(join(ws, ".specs/001-api/SPECIFICATION.md"), "### REQ-API-001: Create\n");
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "feature",
        spec_dir: ".specs",
        feature_number: "001",
      });
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("feature_state_unavailable");
      expect(String(result.payload["fix"])).toContain("sdd_init");
    });

    it("reports feature_state_unavailable with a migration fix when state is invalid", async () => {
      const ws = workspace("specky-util-status-badstate-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      mkdirSync(join(ws, ".specs/001-api"), { recursive: true });
      writeFileSync(join(ws, ".specs/001-api/.sdd-state.json"), "{ corrupted");
      const result = await callTool(harness.client, "sdd_get_status", {
        view: "feature",
        spec_dir: ".specs",
        feature_number: "001",
      });
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("feature_state_unavailable");
      expect(String(result.payload["fix"])).toContain("migrate-contracts");
      const feature = result.payload["feature"] as Record<string, unknown>;
      expect(feature["state_status"]).toBe("invalid");
    });
  });

  describe("sdd_get_template", () => {
    it("returns the raw template with placeholders intact", async () => {
      const harness = await buildHarness(workspace("specky-util-template-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_get_template", {
        template_name: "bugfix",
      });
      expect(result.isError).toBe(false);
      expect(result.payload["status"]).toBe("template_retrieved");
      expect(result.payload["template_name"]).toBe("bugfix");
      const content = String(result.payload["content"]);
      expect(content).toContain("{{bug_title}}");
      expect(content).toContain("{{#each unchanged_behavior}}");
      expect(typeof result.payload["educational_note"]).toBe("string");
    });
  });

  describe("sdd_write_bugfix", () => {
    const BUGFIX_INPUT = {
      bug_title: "Items vanish after restart",
      current_behavior: "Persisted items are not reloaded when the service restarts.",
      expected_behavior: "Items survive a service restart.",
      unchanged_behavior: ["Item creation keeps returning 201", "Listing keeps its ordering"],
      root_cause: "The repository only writes to an in-memory map; no reload path exists.",
      test_plan: "Restart the service after creating an item and assert it is still listed.",
      severity: "High",
      related_requirements: ["REQ-API-001"],
    };

    it("writes BUGFIX_SPEC.md from the bugfix template", async () => {
      const ws = workspace("specky-util-bugfix-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      const result = await callTool(harness.client, "sdd_write_bugfix", {
        ...BUGFIX_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        force: false,
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "bugfix_spec_written",
        bug_title: "Items vanish after restart",
        sections: [
          "Current Behavior",
          "Expected Behavior",
          "Unchanged Behavior",
          "Root Cause Analysis",
          "Test Plan",
        ],
      });
      const written = readFileSync(join(ws, FEATURE_DIR, "BUGFIX_SPEC.md"), "utf8");
      expect(written).toContain("# Bugfix Spec: Items vanish after restart");
      expect(written).toContain("- Item creation keeps returning 201");
      expect(written).toContain("**Severity:** High");
      expect(written).toContain("**Related Requirements:** REQ-API-001");
      expect(written).toContain('feature_id: "001-api"');
    });

    it("refuses to overwrite an existing BUGFIX_SPEC.md without force", async () => {
      const ws = workspace("specky-util-bugfix-conflict-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      writeFileSync(join(ws, FEATURE_DIR, "BUGFIX_SPEC.md"), "reviewed bugfix\n");
      const result = await callTool(harness.client, "sdd_write_bugfix", {
        ...BUGFIX_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        force: false,
      });
      expect(result.isError).toBe(true);
      expect(result.raw).toContain("File already exists");
      expect(readFileSync(join(ws, FEATURE_DIR, "BUGFIX_SPEC.md"), "utf8")).toBe(
        "reviewed bugfix\n",
      );
    });
  });

  describe("sdd_amend", () => {
    const AMEND_INPUT = {
      rationale: "Require contract tests for every endpoint",
      articles_affected: ["Article II"],
      changes_description: "Adds the contract-testing obligation to the quality article.",
    };

    it("appends an amendment row after the initial-version marker and bumps the count", async () => {
      const ws = workspace("specky-util-amend-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      writeFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), CONSTITUTION);

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "amendment_added",
        amendment_number: 1,
        rationale: AMEND_INPUT.rationale,
        articles_affected: ["Article II"],
      });
      const updated = readFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), "utf8");
      expect(updated).toContain("amendment_count: 1");
      expect(updated).toMatch(
        /\| — \| — \| — \| Initial version \| All \|\n\| 1 \| \d{4}-\d{2}-\d{2} \| SDD Pipeline \| Require contract tests for every endpoint \| Article II \|/,
      );
      const state = await harness.stateMachine.loadState(FEATURE_DIR);
      expect(state.amendments).toHaveLength(1);
      expect(state.amendments[0]).toMatchObject({
        number: 1,
        author: "SDD Pipeline",
        rationale: AMEND_INPUT.rationale,
        articles_affected: ["Article II"],
      });
    });

    it("numbers the next amendment from existing table rows", async () => {
      const ws = workspace("specky-util-amend-second-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      const withPrior = CONSTITUTION.replace("amendment_count: 0", "amendment_count: 1").replace(
        "| — | — | — | Initial version | All |",
        "| — | — | — | Initial version | All |\n| 1 | 2026-01-01 | SDD Pipeline | Prior change | Article I |",
      );
      writeFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), withPrior);

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(false);
      expect(result.payload["amendment_number"]).toBe(2);
      const updated = readFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), "utf8");
      expect(updated).toContain("amendment_count: 2");
      expect(updated).toMatch(/\| 2 \| \d{4}-\d{2}-\d{2} \| SDD Pipeline \|/);
    });

    it("appends the amendment row at the end when the marker is absent", async () => {
      const ws = workspace("specky-util-amend-nomarker-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      const noMarker = CONSTITUTION.replace("\n| — | — | — | Initial version | All |", "");
      writeFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), noMarker);

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(false);
      const updated = readFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), "utf8");
      expect(
        updated
          .trimEnd()
          .endsWith(
            "| 1 | " +
              updated.match(/\| 1 \| (\d{4}-\d{2}-\d{2}) \|/)?.[1] +
              " | SDD Pipeline | Require contract tests for every endpoint | Article II |",
          ),
      ).toBe(true);
    });

    it("inserts amendment_count into frontmatter when it is missing", async () => {
      const ws = workspace("specky-util-amend-nofrontmatter-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);
      const noCount = CONSTITUTION.replace("amendment_count: 0\n", "");
      writeFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), noCount);

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(false);
      const updated = readFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), "utf8");
      expect(updated.startsWith("---\namendment_count: 1\ntitle:")).toBe(true);
    });

    it("fails with an sdd_init fix when CONSTITUTION.md is missing", async () => {
      const ws = workspace("specky-util-amend-missing-");
      const harness = await buildHarness(ws);
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws);

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(true);
      expect(result.raw).toContain(`CONSTITUTION.md not found in ${FEATURE_DIR}.`);
      expect(result.raw).toContain("Run sdd_init first.");
    });

    it("adds a drift amendment suggestion when the last drift score exceeds 40", async () => {
      const ws = workspace("specky-util-amend-drift-");
      const harness = await buildHarness(ws, { intentDrift: true });
      closes.push(harness.close);
      await writeFeatureState(harness.stateMachine, ws, {
        driftHistory: [{ timestamp: "2026-07-15T00:00:00.000Z", score: 80, orphaned_count: 2 }],
      });
      const driftConstitution = CONSTITUTION.replace(
        "### Evidence-Based Changes",
        "### Observability Through Structured Telemetry",
      );
      writeFileSync(join(ws, FEATURE_DIR, "CONSTITUTION.md"), driftConstitution);
      writeFileSync(
        join(ws, FEATURE_DIR, "SPECIFICATION.md"),
        "### REQ-API-001: Create item\n\nThe system shall persist items.\n",
      );
      writeFileSync(
        join(ws, FEATURE_DIR, "TASKS.md"),
        "| T-001 | Implement POST /items | No | M | — | REQ-API-001 |\n",
      );

      const result = await callTool(harness.client, "sdd_amend", {
        ...AMEND_INPUT,
        spec_dir: ".specs",
        feature_number: "001",
        // sdd_amend rewrites the existing CONSTITUTION.md, so force is required.
        force: true,
      });
      expect(result.isError).toBe(false);
      const suggestion = result.payload["drift_amendment_suggestion"] as Record<string, unknown>;
      expect(suggestion).toBeDefined();
      expect(suggestion["current_drift_score"]).toBe(80);
      expect(suggestion["drift_label"]).toBe("significant_drift");
      expect(suggestion["orphaned_principles"]).toEqual([
        "Observability Through Structured Telemetry",
      ]);
      expect(suggestion["recommended_actions"]).toEqual([
        'Add requirement referencing "Observability Through Structured Telemetry" to SPECIFICATION.md',
      ]);
    });
  });

  describe("sdd_scan_codebase", () => {
    it("detects the tech stack and counts tree nodes, honoring excludes", async () => {
      const ws = workspace("specky-util-scan-");
      const server = buildDirectHarness(ws);
      writeFileSync(
        join(ws, "package.json"),
        JSON.stringify({
          name: "sample",
          dependencies: { express: "^4.0.0" },
          devDependencies: { typescript: "^5.0.0" },
        }),
      );
      mkdirSync(join(ws, "src"), { recursive: true });
      writeFileSync(join(ws, "src/index.ts"), "export {};\n");
      mkdirSync(join(ws, "excluded"), { recursive: true });
      writeFileSync(join(ws, "excluded/secret.txt"), "nope\n");

      const result = await callDirect(server, "sdd_scan_codebase", {
        depth: 3,
        exclude: ["excluded"],
        spec_dir: ".specs",
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        total_files: 2,
        total_dirs: 2,
      });
      expect(result.payload["tech_stack"]).toEqual({
        language: "TypeScript",
        framework: "Express",
        package_manager: "npm",
        runtime: "Node.js",
      });
      const tree = result.payload["tree"] as { name: string; children?: Array<{ name: string }> };
      const childNames = (tree.children ?? []).map((child) => child.name);
      expect(childNames).toContain("src");
      expect(childNames).toContain("package.json");
      expect(childNames).not.toContain("excluded");
      expect(typeof result.payload["educational_note"]).toBe("string");
    });
  });

  describe("sdd_check_ecosystem", () => {
    it("reports the full recommended MCP server catalog", async () => {
      const ws = workspace("specky-util-ecosystem-");
      const server = buildDirectHarness(ws);
      const result = await callDirect(server, "sdd_check_ecosystem", { spec_dir: ".specs" });
      expect(result.isError).toBe(false);
      expect(result.payload["specky_version"]).toBe(VERSION);
      expect(result.payload["total_tools"]).toBe(TOTAL_TOOLS);
      const servers = result.payload["recommended_servers"] as Array<Record<string, unknown>>;
      expect(servers).toHaveLength(MCP_ECOSYSTEM.length);
      const github = servers.find((server) => server["id"] === "github");
      expect(github).toMatchObject({
        name: "GitHub MCP Server",
        required: false,
        status: "recommended",
      });
      expect(github?.["enhances"]).toContain("sdd_create_pr");
      for (const serverEntry of servers) {
        expect(typeof serverEntry["install_command"]).toBe("string");
        expect(Array.isArray(serverEntry["enhances"])).toBe(true);
      }
      expect(String(result.payload["explanation"])).toContain(`${TOTAL_TOOLS} tools`);
      expect(result.payload["sdd_context"]).toContain("utility tool");
    });
  });
});
