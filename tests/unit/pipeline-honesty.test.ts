/**
 * pipeline-honesty.test.ts — promise-delivery regressions found by executing
 * the real server (audit wf_c703f5af-3d8):
 *
 *   1. sdd_auto_pipeline FABRICATED its analysis gate (hard-coded APPROVE/100%
 *      with a file-presence-only matrix) instead of running the shared
 *      AnalysisEngine like sdd_run_analysis / sdd_batch_transcripts.
 *   2. sdd_get_status preferred a per-feature .sdd-state.json that no pipeline
 *      tool writes and silently fell back to a fresh default, so the headline
 *      fields (current_phase, completion_percent, gate_decision, next_action)
 *      stayed frozen at init/0% for an entire pipeline run.
 *   3. sdd_advance_phase skipped ALL artifact checks when no feature was
 *      registered — 6 phases could be "completed" with zero artifacts on disk.
 *   4. "LGTM gates" were an agent-layer convention only; the opt-in
 *      pipeline.require_lgtm config now enforces them server-side.
 *
 * Tests drive the REAL tool handlers over an in-memory MCP transport against
 * temp workspaces — no mocking of the pipeline itself.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { EarsValidator } from "../../src/services/ears-validator.js";
import { CodebaseScanner } from "../../src/services/codebase-scanner.js";
import { TranscriptParser } from "../../src/services/transcript-parser.js";
import { AnalysisEngine } from "../../src/services/analysis-engine.js";
import { registerPipelineTools } from "../../src/tools/pipeline.js";
import { registerUtilityTools } from "../../src/tools/utility.js";
import { registerTranscriptTools } from "../../src/tools/transcript.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";

const REPO = resolve(import.meta.dirname, "../..");
// The built-in template dir resolves relative to dist/; when running from
// src/ it does not exist, so tests mirror the repo templates into each
// workspace and use the custom-templates path.
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";
const USE_CASE = {
  lifecycle: "greenfield" as const,
  workload: "service" as const,
  execution_mode: "full" as const,
  capabilities: [] as const,
  capability_config: {},
};
const TRANSCRIPT_USE_CASE = {
  ...USE_CASE,
  capabilities: ["transcript-import"] as const,
  capability_config: {
    "transcript-import": {
      formats: ["txt"] as const,
      require_speaker_attribution: true,
    },
  },
};
const FEATURE_INPUT = { spec_dir: ".specs", feature_number: "001" } as const;
const SERVICE_DESIGN = {
  type: "service" as const,
  protocols: "HTTPS JSON requests from the order service with a versioned event envelope.",
  dependencies: "PostgreSQL owns durable notification state; the email provider owns delivery.",
  failure_modes: "Timeouts use bounded retries and idempotency keys; exhausted delivery is quarantined.",
  operability: "The service deploys independently with health probes, autoscaling and rollback criteria.",
  observability: "Traces correlate order events to delivery attempts; alerts identify queue and provider failures.",
};
const TRANSCRIPT_CONSTITUTION = {
  author: "Notification platform team",
  description: "Source-backed charter for the notification service discussed in the planning transcript.",
  license: "MIT",
  scope_in: "Order-status email notifications and retention evidence",
  scope_out: "SMS, push notifications, and marketing campaigns",
  principles: ["Trace every requirement to a transcript quote", "Keep delivery behavior measurable"],
  constraints: ["Email delivery occurs within five minutes", "Notification evidence is retained for thirty days"],
};
const TRANSCRIPT_REQUIREMENTS = [
  {
    id: "REQ-FUNC-001",
    title: "Send order status notification",
    ears_pattern: "event_driven" as const,
    text: "When an order status changes, the system shall send an email notification within 5 minutes.",
    acceptance_criteria: ["A status change produces one email within five minutes"],
    source_quote: "send email notifications within 5 minutes of an order status change",
  },
  {
    id: "REQ-NFR-001",
    title: "Retain notification evidence",
    ears_pattern: "ubiquitous" as const,
    text: "The system shall retain notification evidence for 30 days.",
    acceptance_criteria: ["Evidence remains queryable for exactly thirty days"],
    source_quote: "comply with GDPR 30-day retention",
  },
];
const TRANSCRIPT_ARCHITECTURE = {
  architecture_overview: "An independently deployed notification service consumes order changes and sends email.",
  system_context: "The order service publishes status changes; operators inspect delivery evidence.",
  container_architecture: "A notification worker, PostgreSQL database, and email provider form the runtime boundary.",
  component_design: "EventConsumer validates changes, NotificationService sends mail, and EvidenceRepository stores outcomes.",
  code_level_design: "Typed interfaces isolate the event consumer, mail adapter, and evidence repository.",
  data_models: "NotificationEvidence contains order ID, status, recipient, delivery timestamp, and expiry timestamp.",
  infrastructure: "The worker scales from queue depth and uses managed PostgreSQL with encrypted backups.",
  security_architecture: "Managed identity protects dependencies; TLS protects events and email-provider calls.",
  error_handling: "Idempotency prevents duplicate mail; bounded retries quarantine exhausted deliveries.",
  cross_cutting: "Trace IDs, delivery metrics, structured logs, and retention jobs are mandatory.",
  workload_design: SERVICE_DESIGN,
  mermaid_diagrams: [{
    title: "Notification flow",
    type: "sequenceDiagram",
    code: "sequenceDiagram\nOrder->>Notifier: status changed\nNotifier->>Email: send\nNotifier->>DB: store evidence",
  }],
  adrs: [{
    title: "Persist delivery evidence",
    decision: "Store notification delivery evidence in PostgreSQL.",
    rationale: "Operators require queryable retention evidence for thirty days.",
    consequences: "A scheduled retention job must remove expired evidence deterministically.",
  }],
  api_contracts: [],
};
const TRANSCRIPT_TASKS = [{
  id: "T-001",
  title: "Implement order notification delivery",
  description: "Consume order status changes and send one idempotent email notification.",
  effort: "M" as const,
  dependencies: [],
  parallel: false,
  traces_to: ["REQ-FUNC-001"],
}];
const TRANSCRIPT_GATES = [{
  id: "G-001",
  check: "Review notification timing and idempotency evidence before implementation.",
  constitution_article: "Keep delivery behavior measurable",
}];

function initInput(projectName: string): Record<string, unknown> {
  return { project_name: projectName, ...FEATURE_INPUT, use_case: USE_CASE };
}

function featureInput(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...FEATURE_INPUT, ...extra };
}

function featureStatusInput(): Record<string, unknown> {
  return { view: "feature", ...FEATURE_INPUT };
}

interface Harness {
  workspace: string;
  client: Client;
  stateMachine: StateMachine;
  close: () => Promise<void>;
}

async function buildHarness(workspace: string): Promise<Harness> {
  cpSync(TEMPLATES_SRC, join(workspace, CUSTOM_TEMPLATES), { recursive: true });

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const templateEngine = new TemplateEngine(fileManager, CUSTOM_TEMPLATES);
  const earsValidator = new EarsValidator();
  const codebaseScanner = new CodebaseScanner(fileManager);
  const transcriptParser = new TranscriptParser(fileManager);

  const server = new McpServer({ name: "specky-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerPipelineTools(server, fileManager, stateMachine, templateEngine, earsValidator);
  registerUtilityTools(server, fileManager, stateMachine, templateEngine, codebaseScanner);
  registerTranscriptTools(server, fileManager, stateMachine, templateEngine, earsValidator, transcriptParser);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "pipeline-honesty", version: "0.0.0" });
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

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; payload: Record<string, unknown>; raw: string }> {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as Array<{ type: string; text?: string }>;
  const raw = content[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = { _raw: raw };
  }
  return { isError: res.isError === true, payload, raw };
}

describe("pipeline honesty regressions", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const workspaces: string[] = [];

  function makeWorkspace(prefix: string): string {
    const ws = mkdtempSync(join(tmpdir(), prefix));
    workspaces.push(ws);
    return ws;
  }

  afterEach(async () => {
    for (const close of cleanups.splice(0)) await close();
    for (const ws of workspaces.splice(0)) rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  // ── Fix 1: sdd_auto_pipeline computes its gate with the real engine ──
  it("sdd_auto_pipeline reports the AnalysisEngine verdict, not a fabricated APPROVE/100%", async () => {
    const ws = makeWorkspace("specky-honesty-auto-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    // Vague requirement language ("fast", "user-friendly") makes the honest
    // EARS coverage < 100%, so a hard-coded 100/APPROVE cannot masquerade as
    // a computed result.
    const transcript = [
      "Paula: Welcome everyone, let's plan the notifier service.",
      "John: The system must send email notifications within 5 minutes of an order status change.",
      "Maria: The system must be fast and user-friendly for the operations team.",
      "Paula: We decided to use PostgreSQL for the notification queue storage.",
      "John: One constraint: we must comply with GDPR 30-day retention.",
    ].join("\n");

    const { isError, payload } = await callTool(h.client, "sdd_auto_pipeline", {
      raw_text: transcript,
      project_name: "notify-service",
      ...FEATURE_INPUT,
      use_case: TRANSCRIPT_USE_CASE,
      constitution: TRANSCRIPT_CONSTITUTION,
      requirements: TRANSCRIPT_REQUIREMENTS,
      architecture: TRANSCRIPT_ARCHITECTURE,
      tasks: TRANSCRIPT_TASKS,
      pre_impl_gates: TRANSCRIPT_GATES,
      format: "txt",
      force: false,
    });
    expect(isError).toBe(false);
    expect(payload["status"]).toBe("auto_pipeline_complete");

    const featureDir = join(ws, ".specs", "001-notify-service");
    const specContent = readFileSync(join(featureDir, "SPECIFICATION.md"), "utf-8");
    const designContent = readFileSync(join(featureDir, "DESIGN.md"), "utf-8");
    const tasksContent = readFileSync(join(featureDir, "TASKS.md"), "utf-8");
    const analysisMd = readFileSync(join(featureDir, "ANALYSIS.md"), "utf-8");

    // Independently recompute the gate with the SAME engine over the on-disk
    // artifacts — the tool's reported gate must match it exactly.
    const expected = new AnalysisEngine(new EarsValidator()).analyze({
      hasConstitution: true,
      hasSpec: true,
      hasDesign: true,
      hasTasks: true,
      specContent,
      designContent,
      tasksContent,
    });

    // The crafted transcript must yield an imperfect gate; otherwise this
    // test could not distinguish computed from fabricated.
    expect(expected.coveragePercent).toBeLessThan(100);
    expect(expected.decision).not.toBe("APPROVE");

    const gateDecision = payload["gate_decision"] as {
      decision: string;
      coverage_percent: number;
      gaps: string[];
    };
    expect(gateDecision.decision).toBe(expected.decision);
    expect(gateDecision.coverage_percent).toBe(expected.coveragePercent);
    expect(gateDecision.gaps).toEqual(expected.gaps);

    // ANALYSIS.md carries the computed decision and a REQUIREMENT-LEVEL
    // traceability matrix, not a file-presence-only table.
    expect(analysisMd).toContain(`**Decision:** ${expected.decision}`);
    expect(analysisMd).toContain(`**Coverage:** ${expected.coveragePercent}%`);
    expect(analysisMd).toMatch(/\|\s*REQ-[A-Z]+-\d{3}\s*\|/);
    expect(analysisMd).not.toContain("| CONSTITUTION.md | Present |");

    // The persisted .sdd-state gate event carries the computed decision too.
    const state = await h.stateMachine.loadState(".specs/001-notify-service");
    expect(state.gate_decision?.decision).toBe(expected.decision);
    expect(state.gate_decision?.coverage_percent).toBe(expected.coveragePercent);
  });

  it("transcript orchestration rejects ungrounded source quotes before writing files", async () => {
    const ws = makeWorkspace("specky-honesty-transcript-source-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const result = await callTool(h.client, "sdd_auto_pipeline", {
      raw_text: "Paula: The service must send email after an order changes.",
      project_name: "ungrounded-notifier",
      ...FEATURE_INPUT,
      use_case: TRANSCRIPT_USE_CASE,
      constitution: TRANSCRIPT_CONSTITUTION,
      requirements: [{
        ...TRANSCRIPT_REQUIREMENTS[0],
        source_quote: "This sentence does not exist in the transcript",
      }],
      architecture: TRANSCRIPT_ARCHITECTURE,
      tasks: TRANSCRIPT_TASKS,
      pre_impl_gates: TRANSCRIPT_GATES,
      format: "txt",
      force: false,
    });

    expect(result.isError).toBe(true);
    expect(result.raw).toContain("source_quote is not present in the transcript");
    expect(existsSync(join(ws, ".specs/001-ungrounded-notifier"))).toBe(false);
  });

  it("batch transcript manifest mismatch fails before creating the specs root", async () => {
    const ws = makeWorkspace("specky-honesty-transcript-batch-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/meeting.txt"), "Paula: Send one email after an order changes.");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const result = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: ".specs",
      use_case: TRANSCRIPT_USE_CASE,
      features: [{
        file_name: "other.txt",
        project_name: "other",
        feature_number: "001",
        constitution: TRANSCRIPT_CONSTITUTION,
        requirements: TRANSCRIPT_REQUIREMENTS,
        architecture: TRANSCRIPT_ARCHITECTURE,
        tasks: TRANSCRIPT_TASKS,
        pre_impl_gates: TRANSCRIPT_GATES,
      }],
      force: false,
    });

    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Batch manifest mismatch");
    expect(existsSync(join(ws, ".specs"))).toBe(false);
  });

  // ── Fix 2: sdd_get_status reads canonical feature state ──
  it("sdd_get_status headline fields move with canonical feature state", async () => {
    const ws = makeWorkspace("specky-honesty-status-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const init = await callTool(h.client, "sdd_init", initInput("status-probe"));
    expect(init.isError).toBe(false);

    const statusAtInit = await callTool(h.client, "sdd_get_status", featureStatusInput());
    expect(statusAtInit.payload["current_phase"]).toBe("init");

    await callTool(h.client, "sdd_discover", featureInput({ project_idea: "A status probe service" }));
    const advance = await callTool(h.client, "sdd_advance_phase", featureInput());
    expect(advance.isError).toBe(false);
    expect(advance.payload["current_phase"]).toBe("specify");

    const status = await callTool(h.client, "sdd_get_status", featureStatusInput());
    expect(status.payload["current_phase"]).toBe("specify");
    expect(status.payload["completion_percent"]).toBe(20); // init + discover completed
    expect(String(status.payload["next_action"])).toContain("specify");

    const phases = status.payload["phases"] as Record<string, { status: string }>;
    expect(phases["init"]?.status).toBe("completed");
    expect(phases["discover"]?.status).toBe("completed");

    // The headline must agree with the phase_context enrichment — the audit
    // caught them contradicting each other (init/0% vs implement/70%).
    const phaseContext = status.payload["phase_context"] as { current_phase: string };
    expect(status.payload["current_phase"]).toBe(phaseContext.current_phase);

    // active_feature reflects the same resolved state.
    expect(status.payload["active_feature"]).toMatchObject({
      number: "001",
      phase: "specify",
      state_status: "ready",
    });
    expect(status.payload["contract"]).toMatchObject({ id: "greenfield-service-full" });
  });

  it("sdd_clarify reads and updates only the selected feature state", async () => {
    const ws = makeWorkspace("specky-honesty-clarify-state-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const featureDir = ".specs/001-clarify-context";
    mkdirSync(join(ws, featureDir), { recursive: true });
    const specification = [
      "# Clarify Context — Specification",
      "",
      "### REQ-API-001: Response contract",
      "",
      "When a client requests an item, the system shall return its representation.",
      "",
      "---",
    ].join("\n");
    writeFileSync(join(ws, featureDir, "SPECIFICATION.md"), specification);

    const staleRootState = JSON.stringify({ version: "4.0.0", current_phase: "init" }, null, 2);
    writeFileSync(join(ws, ".specs", ".sdd-state.json"), staleRootState);

    const featureState = h.stateMachine.createFeatureState({
      projectName: "clarify-context",
      feature: { number: "001", name: "clarify-context", directory: featureDir },
      contract: resolveUseCaseContract(USE_CASE),
    });
    featureState.current_phase = Phase.Specify;
    featureState.phases[Phase.Init] = { status: "completed" };
    featureState.phases[Phase.Discover] = { status: "completed" };
    featureState.phases[Phase.Specify] = { status: "completed" };
    await h.stateMachine.saveState(featureDir, featureState);

    const result = await callTool(h.client, "sdd_clarify", {
      spec_dir: ".specs",
      feature_number: "001",
    });

    expect(result.isError).toBe(false);
    expect(result.payload["status"]).toBe("clarification_questions");
    expect(result.payload["phase_context"]).toMatchObject({ current_phase: "clarify" });

    const updatedFeatureState = await h.stateMachine.loadState(featureDir);
    expect(updatedFeatureState.current_phase).toBe(Phase.Clarify);
    expect(updatedFeatureState.phases[Phase.Clarify]?.status).toBe("in_progress");

    expect(readFileSync(join(ws, ".specs", ".sdd-state.json"), "utf-8")).toBe(staleRootState);
    expect(readFileSync(join(ws, featureDir, "SPECIFICATION.md"), "utf-8")).toBe(specification);
  });

  it("sdd_write_design rejects incomplete evidence and renders a complete workload design", async () => {
    const ws = makeWorkspace("specky-honesty-design-contract-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);
    await callTool(h.client, "sdd_init", initInput("design-contract"));
    const stateDir = ".specs/001-design-contract";
    writeFileSync(
      join(ws, stateDir, "SPECIFICATION.md"),
      "### REQ-CORE-001: Service behavior\n\nThe system shall process requests.\n",
    );
    await h.stateMachine.mutateState(stateDir, (state) => {
      state.current_phase = Phase.Clarify;
      state.phases[Phase.Clarify] = { status: "completed" };
    });

    const incomplete = await callTool(h.client, "sdd_write_design", featureInput({
      architecture_overview: "A versioned request-processing service.",
      mermaid_diagrams: [{ title: "Context", type: "flowchart", code: "flowchart LR\nA-->B" }],
      workload_design: SERVICE_DESIGN,
      force: false,
    }));
    expect(incomplete.isError).toBe(true);

    const complete = await callTool(h.client, "sdd_write_design", featureInput({
      architecture_overview: "A versioned request-processing service with owned boundaries.",
      mermaid_diagrams: [{ title: "Context", type: "flowchart", code: "flowchart LR\nA-->B" }],
      workload_design: SERVICE_DESIGN,
      adrs: [{
        title: "Use synchronous HTTPS",
        decision: "Expose versioned HTTPS JSON operations.",
        rationale: "Named callers require request-response semantics.",
        consequences: "Timeout and retry budgets become public behavior.",
      }],
      system_context: "Order clients call the service; identity and telemetry systems are external.",
      container_architecture: "One API container owns request processing and one PostgreSQL database owns state.",
      component_design: "RequestController validates input and ProcessingService applies REQ-CORE-001.",
      code_level_design: "RequestController depends on ProcessingService through a typed interface.",
      data_models: "RequestRecord stores request ID, status, timestamps and idempotency key.",
      infrastructure: "The container is deployed with health probes, autoscaling and a managed database.",
      security_architecture: "OAuth tokens authorize operations; TLS and managed identity protect boundaries.",
      error_handling: "Typed errors map validation, dependency timeout and conflict outcomes.",
      cross_cutting: "Trace IDs, structured logs, metrics and configuration are mandatory.",
      force: false,
    }));
    expect(complete.isError).toBe(false);
    const design = readFileSync(join(ws, stateDir, "DESIGN.md"), "utf8");
    expect(design).toContain("## 13. Workload-Specific Design Contract");
    expect(design).toContain("### Protocols and caller contract");
    expect(design).toContain("REQ-CORE-001");
    expect(design).not.toContain("TODO");
  });

  // ── Fix 3: featureless advance loophole ──
  it("sdd_advance_phase refuses to advance when no feature is registered", async () => {
    const ws = makeWorkspace("specky-honesty-featureless-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    // No sdd_init — the audit walked 6 phases this way with zero artifacts.
    const first = await callTool(h.client, "sdd_advance_phase", featureInput());
    expect(first.isError).toBe(true);
    expect(first.raw).toContain("feature_not_found");
    expect(first.raw).toContain("Feature 001 not found");

    // Repeated attempts must not creep forward either.
    await callTool(h.client, "sdd_advance_phase", featureInput());
    await callTool(h.client, "sdd_advance_phase", featureInput());
    const status = await callTool(h.client, "sdd_get_status", {
      view: "workspace",
      spec_dir: ".specs",
    });
    expect(status.payload["feature_count"]).toBe(0);
    expect(status.payload["features"]).toEqual([]);
  });

  // ── Fix 4: opt-in server-side LGTM gate ──
  it("pipeline.require_lgtm blocks completing specify without lgtm:true and records approval", async () => {
    const ws = makeWorkspace("specky-honesty-lgtm-");
    mkdirSync(join(ws, ".specky"), { recursive: true });
    writeFileSync(
      join(ws, ".specky", "config.yml"),
      serializeWorkspaceConfig(createWorkspaceConfig({ requireLgtm: true })),
    );
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("lgtm-gate"));
    await callTool(h.client, "sdd_discover", featureInput({ project_idea: "LGTM gate probe" }));
    // init/discover completions are NOT LGTM gates — no approval needed.
    const toSpecify = await callTool(h.client, "sdd_advance_phase", featureInput());
    expect(toSpecify.isError).toBe(false);

    await callTool(h.client, "sdd_write_spec", {
      ...FEATURE_INPUT,
      feature_name: "lgtm-gate",
      force: false,
      discovery_answers: { Q1: "v1" },
      requirements: [
        {
          id: "REQ-CORE-001",
          ears_pattern: "event_driven",
          text: "When a user submits valid credentials, the system shall issue a token within 500ms.",
          acceptance_criteria: ["Token issued on valid login"],
        },
      ],
    });

    // Completing specify IS an LGTM gate: blocked without lgtm:true.
    const blocked = await callTool(h.client, "sdd_advance_phase", featureInput());
    expect(blocked.isError).toBe(true);
    expect(blocked.raw).toContain("lgtm_required");
    expect(blocked.raw).toContain("require_lgtm");

    const stillSpecify = await callTool(h.client, "sdd_get_status", featureStatusInput());
    expect(stillSpecify.payload["current_phase"]).toBe("specify");

    // With lgtm:true the gate opens and the approval is recorded in history.
    const approved = await callTool(h.client, "sdd_advance_phase", featureInput({ lgtm: true }));
    expect(approved.isError).toBe(false);
    expect(approved.payload["current_phase"]).toBe("clarify");

    const state = await h.stateMachine.loadState(".specs/001-lgtm-gate");
    const lastGate = (state.gate_history ?? []).at(-1) as
      | { phase: string; lgtm?: boolean }
      | undefined;
    expect(lastGate?.phase).toBe("specify");
    expect(lastGate?.lgtm).toBe(true);
  });

  it("require_lgtm defaults to OFF — advancing specify without lgtm keeps working", async () => {
    const ws = makeWorkspace("specky-honesty-lgtm-off-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("no-lgtm"));
    await callTool(h.client, "sdd_discover", featureInput({ project_idea: "Default behavior probe" }));
    await callTool(h.client, "sdd_advance_phase", featureInput());
    await callTool(h.client, "sdd_write_spec", {
      ...FEATURE_INPUT,
      feature_name: "no-lgtm",
      force: false,
      discovery_answers: { Q1: "v1" },
      requirements: [
        {
          id: "REQ-CORE-001",
          ears_pattern: "event_driven",
          text: "When a user submits valid credentials, the system shall issue a token within 500ms.",
          acceptance_criteria: ["Token issued on valid login"],
        },
      ],
    });

    const advance = await callTool(h.client, "sdd_advance_phase", featureInput());
    expect(advance.isError).toBe(false);
    expect(advance.payload["current_phase"]).toBe("clarify");

    // LGTM presence is still recorded (as false) for gate-history honesty.
    const state = await h.stateMachine.loadState(".specs/001-no-lgtm");
    const lastGate = (state.gate_history ?? []).at(-1) as
      | { phase: string; lgtm?: boolean }
      | undefined;
    expect(lastGate?.phase).toBe("specify");
    expect(lastGate?.lgtm).toBe(false);
  });

  it("ensurePhasesThrough completes discover when write_spec runs without advance", async () => {
    const ws = makeWorkspace("specky-honesty-orphan-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("orphan-phase"));
    await callTool(h.client, "sdd_discover", featureInput({ project_idea: "orphan probe" }));
    await callTool(h.client, "sdd_write_spec", {
      ...FEATURE_INPUT,
      feature_name: "orphan-phase",
      force: false,
      discovery_answers: { Q1: "scope answer" },
      requirements: [
        {
          id: "REQ-CORE-001",
          ears_pattern: "ubiquitous",
          text: "The system shall expose a health endpoint.",
          acceptance_criteria: ["GET /health returns 200"],
        },
      ],
    });

    const state = await h.stateMachine.loadState(".specs/001-orphan-phase");
    expect(state.phases.discover.status).toBe("completed");
    expect(state.phases.specify.status).toBe("completed");
  });

  it("discovery_answers are persisted in SPECIFICATION.md", async () => {
    const ws = makeWorkspace("specky-honesty-discovery-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("discovery-ctx"));
    await callTool(h.client, "sdd_discover", featureInput({ project_idea: "discovery context" }));
    await callTool(h.client, "sdd_write_spec", {
      ...FEATURE_INPUT,
      feature_name: "discovery-ctx",
      force: false,
      discovery_answers: { Q1: "Users are developers", Q2: "Must use TypeScript" },
      requirements: [
        {
          id: "REQ-CORE-001",
          ears_pattern: "ubiquitous",
          text: "The system shall provide a REST API.",
          acceptance_criteria: ["API responds to requests"],
        },
      ],
    });

    const spec = readFileSync(join(ws, ".specs/001-discovery-ctx/SPECIFICATION.md"), "utf8");
    expect(spec).toContain("## Discovery Context");
    expect(spec).toContain("Users are developers");
    expect(spec).toContain("Must use TypeScript");
  });

  it("sdd_run_analysis with BLOCK does not mark analyze phase completed", async () => {
    const ws = makeWorkspace("specky-honesty-block-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("block-gate"));
    const featureDir = join(ws, ".specs/001-block-gate");
    writeFileSync(join(featureDir, "SPECIFICATION.md"), [
      "### REQ-CORE-001: (ubiquitous)",
      "",
      "The system shall be fast and user-friendly.",
      "",
      "**Acceptance Criteria:**",
      "- It works well",
      "",
    ].join("\n"));
    writeFileSync(join(featureDir, "DESIGN.md"), "# Design\n");
    writeFileSync(join(featureDir, "TASKS.md"), "# Tasks\n| T-001 | Do thing | | 1h | | REQ-CORE-001 |\n");

    await h.stateMachine.mutateState(".specs/001-block-gate", (state) => {
      state.current_phase = Phase.Tasks;
      state.phases[Phase.Tasks] = { status: "completed", completed_at: new Date().toISOString() };
    });

    const analysis = await callTool(h.client, "sdd_run_analysis", featureInput({ force: false }));
    expect(analysis.isError).toBe(false);
    expect((analysis.payload["gate_decision"] as { decision: string }).decision).not.toBe("APPROVE");

    const state = await h.stateMachine.loadState(".specs/001-block-gate");
    expect(state.phases.analyze.status).not.toBe("completed");
  });

  it("Analyze+BLOCK allows write_design remediation but still gates implement", async () => {
    const ws = makeWorkspace("specky-honesty-remediate-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("remediate"));
    const stateDir = ".specs/001-remediate";
    await h.stateMachine.mutateState(stateDir, (state) => {
      state.current_phase = Phase.Analyze;
      state.gate_decision = {
        decision: "BLOCK",
        reasons: ["gaps"],
        coverage_percent: 40,
        gaps: ["REQ-001 untested"],
        decided_at: new Date().toISOString(),
      };
    });

    const writeDesign = await h.stateMachine.validatePhaseForTool(stateDir, "sdd_write_design");
    expect(writeDesign.allowed).toBe(true);

    const writeSpec = await h.stateMachine.validatePhaseForTool(stateDir, "sdd_write_spec");
    expect(writeSpec.allowed).toBe(true);

    const writeTasks = await h.stateMachine.validatePhaseForTool(stateDir, "sdd_write_tasks");
    expect(writeTasks.allowed).toBe(true);

    const gate = await h.stateMachine.validateGateForTool(stateDir, "sdd_implement");
    expect(gate.allowed).toBe(false);
    expect(gate.error_message).toContain("BLOCK");
  });

  it("validateGateForTool blocks implement-phase tools when gate is BLOCK", async () => {
    const ws = makeWorkspace("specky-honesty-gate-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", initInput("gate"));
    const stateDir = ".specs/001-gate";
    await h.stateMachine.mutateState(stateDir, (state) => {
      state.current_phase = Phase.Analyze;
      state.gate_decision = {
        decision: "BLOCK",
        reasons: ["gaps"],
        coverage_percent: 40,
        gaps: ["REQ-001 untested"],
        decided_at: new Date().toISOString(),
      };
    });

    const gate = await h.stateMachine.validateGateForTool(stateDir, "sdd_implement");
    expect(gate.allowed).toBe(false);
    expect(gate.error_message).toContain("BLOCK");
  });
});
