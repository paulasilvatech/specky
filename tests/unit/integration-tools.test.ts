import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import {
  type Capability,
  type CapabilityConfig,
  resolveUseCaseContract,
} from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { GitManager } from "../../src/services/git-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { WorkItemExporter } from "../../src/services/work-item-exporter.js";
import { registerIntegrationTools } from "../../src/tools/integration.js";
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

const RELEASE_CONFIG: CapabilityConfig["release"] = {
  branch_prefix: "spec/",
  base_branch: "develop",
  draft_pr: false,
  checkpoints: true,
  documentation: {
    types: ["full", "runbook"],
    version: "1.0.0",
    deployment_steps: ["Deploy the reviewed image digest."],
    health_checks: ["GET /health returns the dependency status."],
    monitoring_checks: ["Alert on contracted latency and error thresholds."],
    troubleshooting: [
      {
        symptom: "API unavailable",
        cause: "Dependency outage",
        resolution: "Restore the dependency route",
      },
    ],
    rollback_steps: ["Restore the prior reviewed image digest."],
    support_contacts: ["API on-call: api@example.test"],
    onboarding_steps: ["Run the requirement-bound tests."],
  },
};

const SPEC = `### REQ-API-001: Create item

When a client submits an item, the system shall persist and return it.

**Acceptance Criteria:**
- POST /items returns 201
`;

const TABLE_TASKS = `| ID | Title | Parallel | Effort | Depends | Traces |
| --- | --- | --- | --- | --- | --- |
| T-001 | Create item endpoint | [P] | M | — | REQ-API-001 |
| T-002 | Add item persistence | No | S | T-001 | REQ-API-001 |
| T-003 | Wire item routes | [P] | S | — | REQ-API-001 |
`;

const CHECKBOX_TASKS = `- [ ] T-001: Create item endpoint REQ-API-001
  - Add the route handler
  - Validate the request body
`;

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

interface HarnessOptions {
  capabilities: Capability[];
  capabilityConfig: CapabilityConfig;
  phase: Phase;
  gate?: GateDecision | null;
  spec?: string;
  tasks?: string;
}

async function buildHarness(workspace: string, options: HarnessOptions): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  if (options.spec !== undefined)
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), options.spec);
  if (options.tasks !== undefined)
    writeFileSync(join(workspace, FEATURE_DIR, "TASKS.md"), options.tasks);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: options.capabilities,
      capability_config: options.capabilityConfig,
    }),
  });
  state.current_phase = options.phase;
  state.phases[options.phase] = { status: "in_progress", started_at: "2026-07-15T00:00:00.000Z" };
  state.gate_decision = options.gate === undefined ? APPROVE_GATE : options.gate;
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "integration-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerIntegrationTools(
    server,
    fileManager,
    stateMachine,
    new TemplateEngine(fileManager),
    new GitManager(fileManager),
    new WorkItemExporter(fileManager),
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "integration-test", version: "0.0.0" });
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

describe("integration MCP tools", () => {
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

  describe("sdd_create_branch", () => {
    function releaseHarness(ws: string, overrides: Partial<HarnessOptions> = {}) {
      return buildHarness(ws, {
        capabilities: ["release"],
        capabilityConfig: { release: RELEASE_CONFIG },
        phase: Phase.Analyze,
        ...overrides,
      });
    }

    it("generates the contracted branch name and command hint", async () => {
      const harness = await releaseHarness(workspace("specky-int-branch-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_create_branch", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "branch_info_generated",
        name: "spec/001-api",
        feature_number: "001",
        convention: "spec/<number>-<kebab-case-name>",
        command_hint: "git checkout -b spec/001-api develop",
      });
      expect(String(result.payload["next_steps"])).toContain(
        "git checkout -b spec/001-api develop",
      );
      expect(result.payload["phase_context"]).toMatchObject({ current_phase: Phase.Analyze });
    });

    it("is blocked when no APPROVE gate decision is recorded at Analyze", async () => {
      const harness = await releaseHarness(workspace("specky-int-branch-gate-"), { gate: null });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_create_branch", FEATURE_ARGS);
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("gate_blocked");
      expect(String(result.payload["message"])).toContain("sdd_run_analysis");
    });

    it("is rejected outside the Analyze/Implement phases", async () => {
      const harness = await releaseHarness(workspace("specky-int-branch-phase-"), {
        phase: Phase.Specify,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_create_branch", FEATURE_ARGS);
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("phase_validation_failed");
      expect(String(result.payload["message"])).toContain('not allowed in phase "specify"');
    });
  });

  describe("sdd_export_work_items", () => {
    function workItemsHarness(ws: string, workItems: CapabilityConfig["work-items"]) {
      return buildHarness(ws, {
        capabilities: ["work-items"],
        capabilityConfig: { "work-items": workItems },
        phase: Phase.Verify,
        spec: SPEC,
        tasks: CHECKBOX_TASKS,
      });
    }

    it("exports GitHub issue payloads with subtasks and traceability", async () => {
      const harness = await workItemsHarness(workspace("specky-int-export-gh-"), {
        platform: "github",
        include_subtasks: true,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_export_work_items", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "work_items_exported",
        platform: "github",
      });
      const items = result.payload["items"] as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        task_id: "T-001",
        traces_to: ["REQ-API-001"],
        title: "[T-001] Create item endpoint",
        labels: ["sdd", "feature/001", "REQ-API-001"],
      });
      const body = String(items[0]?.["body"]);
      expect(body).toContain("## Subtasks");
      expect(body).toContain("- [ ] Add the route handler");
      expect(body).toContain("## Traces To\nREQ-API-001");
      expect(result.payload["routing_instructions"]).toMatchObject({
        mcp_server: "github",
        tool_name: "create_issue",
      });
      const recommended = result.payload["recommended_servers"] as Array<Record<string, unknown>>;
      expect(recommended).toHaveLength(1);
      expect(recommended[0]?.["id"]).toBe("github");
      expect(result.payload["metadata"]).toMatchObject({
        feature_number: "001",
        total_items: 1,
        include_subtasks: true,
      });
    });

    it("exports Jira payloads carrying the contracted project key", async () => {
      const harness = await workItemsHarness(workspace("specky-int-export-jira-"), {
        platform: "jira",
        include_subtasks: false,
        project_key: "CHK",
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_export_work_items", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      const items = result.payload["items"] as Array<Record<string, unknown>>;
      const fields = items[0]?.["fields"] as Record<string, unknown>;
      expect(fields).toMatchObject({
        summary: "[T-001] Create item endpoint",
        issuetype: { name: "Task" },
      });
      expect(fields?.["project"]).toEqual({ key: "CHK" });
      expect(String(fields?.["description"])).not.toContain("Subtasks");
      expect(result.payload["routing_instructions"]).toMatchObject({ mcp_server: "jira" });
      expect(result.payload["metadata"]).toMatchObject({ project_key: "CHK" });
      const recommended = result.payload["recommended_servers"] as Array<Record<string, unknown>>;
      expect(recommended[0]?.["id"]).toBe("jira");
    });

    it("exports Azure Boards payloads with area and iteration paths", async () => {
      const harness = await workItemsHarness(workspace("specky-int-export-az-"), {
        platform: "azure_boards",
        include_subtasks: true,
        area_path: "Contoso\\Api",
        iteration_path: "Contoso\\Sprint 1",
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_export_work_items", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      const items = result.payload["items"] as Array<Record<string, unknown>>;
      expect(items[0]?.["work_item_type"]).toBe("Task");
      const fields = items[0]?.["fields"] as Record<string, unknown>;
      expect(fields).toMatchObject({
        "System.Title": "[T-001] Create item endpoint",
        "System.AreaPath": "Contoso\\Api",
        "System.IterationPath": "Contoso\\Sprint 1",
      });
      expect(String(fields?.["System.Tags"])).toContain("sdd; feature/001; REQ-API-001");
      expect(String(fields?.["System.Description"])).toContain("<h2>Subtasks</h2>");
      expect(result.payload["routing_instructions"]).toMatchObject({
        mcp_server: "azure-devops",
        tool_name: "create_work_item",
      });
      const recommended = result.payload["recommended_servers"] as Array<Record<string, unknown>>;
      expect(recommended[0]?.["id"]).toBe("azure-devops");
    });
  });

  describe("sdd_create_pr", () => {
    it("builds a PR payload with requirement coverage and routing instructions", async () => {
      const harness = await buildHarness(workspace("specky-int-pr-"), {
        capabilities: ["release"],
        capabilityConfig: { release: RELEASE_CONFIG },
        phase: Phase.Verify,
        spec: SPEC,
        tasks: TABLE_TASKS,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_create_pr", FEATURE_ARGS);
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "pr_payload_generated",
        title: "[001] api",
        base_branch: "develop",
        head_branch: "spec/001-api",
        labels: ["sdd", "feature/001"],
        draft: false,
        requirements_covered: ["REQ-API-001"],
      });
      expect(String(result.payload["body"])).toContain("## Tasks: 0/3 completed");
      expect(String(result.payload["body"])).toContain("- REQ-API-001");
      expect(String(result.payload["spec_summary"])).toContain("REQ-API-001");
      expect(result.payload["routing_instructions"]).toMatchObject({
        mcp_server: "github",
        tool_name: "create_pull_request",
      });
    });
  });

  describe("sdd_implement", () => {
    function implementHarness(ws: string, overrides: Partial<HarnessOptions> = {}) {
      return buildHarness(ws, {
        capabilities: [],
        capabilityConfig: {},
        phase: Phase.Analyze,
        tasks: TABLE_TASKS,
        ...overrides,
      });
    }

    it("orders tasks into dependency phases with parallel groups and a Gantt diagram", async () => {
      const harness = await implementHarness(workspace("specky-int-implement-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_implement", {
        ...FEATURE_ARGS,
        task_ids: [],
        checkpoint: true,
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "implementation_plan_generated",
        feature_number: "001",
        total_tasks: 3,
        estimated_checkpoints: 2,
      });
      // The plan's numeric parallel_opportunities count is clobbered by the
      // response-builder's ParallelHint object of the same key; the count only
      // survives in the explanation text.
      expect(String(result.payload["explanation"])).toContain("1 parallel opportunities detected");
      expect(result.payload["parallel_opportunities"]).toMatchObject({ can_run_now: [] });
      const phases = result.payload["phases"] as Array<Record<string, unknown>>;
      expect(phases).toHaveLength(2);
      expect(phases[0]?.["name"]).toBe("Phase 1");
      const phaseOneTasks = phases[0]!["tasks"] as Array<Record<string, unknown>>;
      const phaseOneIds = phaseOneTasks.map((task) => task["id"]);
      expect(phaseOneIds).toEqual(["T-001", "T-003"]);
      expect(phaseOneTasks.every((task) => task["parallel"] === true)).toBe(true);
      expect(phases[0]?.["checkpoint"]).toBe(true);
      expect(phases[1]?.["name"]).toBe("Phase 2");
      const phaseTwoTasks = phases[1]?.["tasks"] as Array<Record<string, unknown>>;
      expect(phaseTwoTasks[0]).toMatchObject({
        id: "T-002",
        parallel: false,
        dependencies: ["T-001"],
      });
      const diagram = String(result.payload["diagram"]);
      expect(diagram).toContain("gantt");
      expect(diagram).toContain("section Phase 1");
      expect(diagram).toContain("Checkpoint :milestone, 0d");
      expect(diagram).toContain("T-002 Add item persistence :T-002, after T-001, 1d");
    });

    it("puts filtered tasks with unsatisfied dependencies into an unresolved phase", async () => {
      const harness = await implementHarness(workspace("specky-int-implement-unresolved-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_implement", {
        ...FEATURE_ARGS,
        task_ids: ["T-002"],
        checkpoint: false,
      });
      expect(result.isError).toBe(false);
      const phases = result.payload["phases"] as Array<Record<string, unknown>>;
      expect(phases).toHaveLength(1);
      expect(phases[0]?.["name"]).toBe("Phase 1 (unresolved dependencies)");
      const tasks = phases[0]?.["tasks"] as Array<Record<string, unknown>>;
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ id: "T-002", parallel: false });
      expect(phases[0]?.["checkpoint"]).toBe(false);
      expect(String(result.payload["diagram"])).not.toContain("milestone");
    });

    it("fails when TASKS.md contains no parseable tasks", async () => {
      const harness = await implementHarness(workspace("specky-int-implement-empty-"), {
        tasks: "# Tasks\n\nNo task table or checkboxes here.\n",
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_implement", {
        ...FEATURE_ARGS,
        task_ids: [],
        checkpoint: false,
      });
      expect(result.isError).toBe(true);
      expect(result.raw).toContain(
        "No tasks found. Ensure TASKS.md contains a Task Breakdown table",
      );
    });
  });

  describe("sdd_research", () => {
    const ENTRIES = [
      {
        id: "RQ-001",
        question: "Which storage engine fits the item workload?",
        context: "The feature contract requires durable item storage.",
        findings:
          "Reviewed the candidate engines; the embedded engine covers the contracted item volume.",
        sources: ["https://example.test/storage-benchmark"],
        recommendation: "Use the embedded storage engine for item persistence.",
        status: "resolved",
      },
      {
        id: "RQ-002",
        question: "Which cache invalidation policy applies?",
        context: "Caching is deferred to a later iteration.",
        findings:
          "No cache layer exists in this feature; the policy choice is explicitly deferred.",
        sources: ["https://example.test/cache-policies"],
        recommendation: "Defer the cache policy decision to the caching feature.",
        status: "deferred",
      },
    ];

    function researchHarness(ws: string) {
      return buildHarness(ws, {
        capabilities: [],
        capabilityConfig: {},
        phase: Phase.Specify,
        gate: null,
      });
    }

    it("writes RESEARCH.md with resolved and deferred entries", async () => {
      const ws = workspace("specky-int-research-");
      const harness = await researchHarness(ws);
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_research", {
        ...FEATURE_ARGS,
        entries: ENTRIES,
        force: false,
      });
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        status: "research_created",
        feature_number: "001",
        total_entries: 2,
        resolved_count: 1,
        deferred_count: 1,
      });
      const written = readFileSync(join(ws, FEATURE_DIR, "RESEARCH.md"), "utf8");
      expect(written).toContain("# Research Log — Feature 001");
      expect(written).toContain("status: complete");
      expect(written).toContain("## RQ-001: Which storage engine fits the item workload?");
      expect(written).toContain("**Status**: deferred");
      expect(written).toContain("- https://example.test/cache-policies");
      expect(written).toContain("### Recommendation\n\nDefer the cache policy decision");
    });

    it("refuses to overwrite an existing RESEARCH.md without force", async () => {
      const ws = workspace("specky-int-research-conflict-");
      const harness = await researchHarness(ws);
      closes.push(harness.close);
      writeFileSync(join(ws, FEATURE_DIR, "RESEARCH.md"), "reviewed research\n");
      const result = await callTool(harness.client, "sdd_research", {
        ...FEATURE_ARGS,
        entries: ENTRIES,
        force: false,
      });
      expect(result.isError).toBe(true);
      expect(result.raw).toContain("File already exists");
      expect(readFileSync(join(ws, FEATURE_DIR, "RESEARCH.md"), "utf8")).toBe(
        "reviewed research\n",
      );
    });
  });
});
