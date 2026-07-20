/**
 * transcript-tools.test.ts — MCP-level coverage for src/tools/transcript.ts:
 *
 *   - sdd_import_transcript (feature-scoped: raw_text / file_path / errors)
 *   - sdd_auto_pipeline (batch-scoped: full pipeline, validation error paths)
 *   - sdd_batch_transcripts (batch-scoped: manifest checks, happy path,
 *     per-feature failure isolation)
 *
 * Tests drive the real tool handlers over an in-memory MCP transport against
 * temp workspaces (mirroring tests/unit/pipeline-honesty.test.ts). The batch
 * per-feature failure test invokes the captured handler directly so a stubbed
 * FileManager can fail one feature mid-write.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { EarsValidator } from "../../src/services/ears-validator.js";
import {
  ExecutionContextResolver,
  runWithExecutionContext,
} from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { TranscriptParser } from "../../src/services/transcript-parser.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { registerTranscriptTools } from "../../src/tools/transcript.js";

const REPO = resolve(import.meta.dirname, "../..");
// The built-in template dir resolves relative to dist/; when running from
// src/ it does not exist, so tests mirror the repo templates into each
// workspace and use the custom-templates path.
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";
const SPEC_DIR = ".specs";

const TRANSCRIPT_USE_CASE = {
  lifecycle: "greenfield" as const,
  workload: "service" as const,
  execution_mode: "full" as const,
  capabilities: ["transcript-import"] as const,
  capability_config: {
    "transcript-import": {
      formats: ["txt"] as const,
      require_speaker_attribution: true,
    },
  },
};

const RAPID_USE_CASE = { ...TRANSCRIPT_USE_CASE, execution_mode: "rapid" as const };

const API_USE_CASE = {
  ...TRANSCRIPT_USE_CASE,
  workload: "api" as const,
};

const SERVICE_DESIGN = {
  type: "service" as const,
  protocols: "HTTPS JSON requests from the order service with a versioned event envelope.",
  dependencies: "PostgreSQL owns durable notification state; the email provider owns delivery.",
  failure_modes:
    "Timeouts use bounded retries and idempotency keys; exhausted delivery is quarantined.",
  operability:
    "The service deploys independently with health probes, autoscaling and rollback criteria.",
  observability:
    "Traces correlate order events to delivery attempts; alerts identify queue and provider failures.",
};

const API_DESIGN = {
  type: "api" as const,
  versioning_strategy: "URI version prefix with a twelve-month deprecation window.",
  error_model: "RFC 9457 problem details with stable machine-readable error codes.",
  authentication: "OAuth 2.0 client credentials with scoped bearer tokens.",
  rate_limits: "Fixed-window quotas per consumer with 429 responses and retry hints.",
};

const TRANSCRIPT_CONSTITUTION = {
  author: "Notification platform team",
  description:
    "Source-backed charter for the notification service discussed in the planning transcript.",
  license: "MIT",
  scope_in: "Order-status email notifications and retention evidence",
  scope_out: "SMS, push notifications, and marketing campaigns",
  principles: [
    "Trace every requirement to a transcript quote",
    "Keep delivery behavior measurable",
  ],
  constraints: [
    "Email delivery occurs within five minutes",
    "Notification evidence is retained for thirty days",
  ],
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

const TRANSCRIPT_TEXT = [
  "Paula: Welcome everyone, let's plan the notifier service.",
  "John: The system must send email notifications within 5 minutes of an order status change.",
  "Paula: We decided to use PostgreSQL for the notification queue storage.",
  "John: One constraint: we must comply with GDPR 30-day retention.",
  "Maria: What is the rollout timeline for the first beta tenants?",
].join("\n");

const TRANSCRIPT_ARCHITECTURE = {
  architecture_overview:
    "An independently deployed notification service consumes order changes and sends email.",
  system_context:
    "The order service publishes status changes; operators inspect delivery evidence.",
  container_architecture:
    "A notification worker, PostgreSQL database, and email provider form the runtime boundary.",
  component_design:
    "EventConsumer validates changes, NotificationService sends mail, and EvidenceRepository stores outcomes.",
  code_level_design:
    "Typed interfaces isolate the event consumer, mail adapter, and evidence repository.",
  data_models:
    "NotificationEvidence contains order ID, status, recipient, delivery timestamp, and expiry timestamp.",
  infrastructure:
    "The worker scales from queue depth and uses managed PostgreSQL with encrypted backups.",
  security_architecture:
    "Managed identity protects dependencies; TLS protects events and email-provider calls.",
  error_handling:
    "Idempotency prevents duplicate mail; bounded retries quarantine exhausted deliveries.",
  cross_cutting: "Trace IDs, delivery metrics, structured logs, and retention jobs are mandatory.",
  workload_design: SERVICE_DESIGN,
  mermaid_diagrams: [
    {
      title: "Notification flow",
      type: "sequenceDiagram",
      code: "sequenceDiagram\nOrder->>Notifier: status changed\nNotifier->>Email: send\nNotifier->>DB: store evidence",
    },
  ],
  adrs: [
    {
      title: "Persist delivery evidence",
      decision: "Store notification delivery evidence in PostgreSQL.",
      rationale: "Operators require queryable retention evidence for thirty days.",
      consequences: "A scheduled retention job must remove expired evidence deterministically.",
    },
  ],
  api_contracts: [],
};

const TRANSCRIPT_TASKS = [
  {
    id: "T-001",
    title: "Implement order notification delivery",
    description: "Consume order status changes and send one idempotent email notification.",
    effort: "M" as const,
    dependencies: [],
    parallel: false,
    traces_to: ["REQ-FUNC-001"],
  },
  {
    id: "T-002",
    title: "Implement evidence retention job",
    description: "Persist notification evidence and expire records after thirty days.",
    effort: "S" as const,
    dependencies: ["T-001"],
    parallel: false,
    traces_to: ["REQ-NFR-001"],
  },
];

const TRANSCRIPT_GATES = [
  {
    id: "G-001",
    check: "Review notification timing and idempotency evidence before implementation.",
    constitution_article: "Keep delivery behavior measurable",
  },
];

function autoPipelineInput(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    raw_text: TRANSCRIPT_TEXT,
    project_name: "notify-service",
    feature_number: "001",
    spec_dir: SPEC_DIR,
    use_case: TRANSCRIPT_USE_CASE,
    constitution: TRANSCRIPT_CONSTITUTION,
    requirements: TRANSCRIPT_REQUIREMENTS,
    architecture: TRANSCRIPT_ARCHITECTURE,
    tasks: TRANSCRIPT_TASKS,
    pre_impl_gates: TRANSCRIPT_GATES,
    format: "txt",
    force: false,
    ...extra,
  };
}

function batchFeatureInput(
  fileName: string,
  projectName: string,
  featureNumber: string,
): Record<string, unknown> {
  return {
    file_name: fileName,
    project_name: projectName,
    feature_number: featureNumber,
    constitution: TRANSCRIPT_CONSTITUTION,
    requirements: TRANSCRIPT_REQUIREMENTS,
    architecture: TRANSCRIPT_ARCHITECTURE,
    tasks: TRANSCRIPT_TASKS,
    pre_impl_gates: TRANSCRIPT_GATES,
  };
}

interface Harness {
  workspace: string;
  client: Client;
  fileManager: FileManager;
  stateMachine: StateMachine;
  close: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];
const workspaces: string[] = [];

function makeWorkspace(prefix: string): string {
  const ws = mkdtempSync(join(tmpdir(), prefix));
  workspaces.push(ws);
  return ws;
}

afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
  for (const ws of workspaces.splice(0)) {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function provisionWorkspace(workspace: string): {
  fileManager: FileManager;
  stateMachine: StateMachine;
  templateEngine: TemplateEngine;
  earsValidator: EarsValidator;
  transcriptParser: TranscriptParser;
} {
  cpSync(TEMPLATES_SRC, join(workspace, CUSTOM_TEMPLATES), { recursive: true });
  const configDir = join(workspace, ".specky");
  if (!existsSync(join(configDir, "config.yml"))) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.yml"), serializeWorkspaceConfig(createWorkspaceConfig()));
  }
  const fileManager = new FileManager(workspace);
  return {
    fileManager,
    stateMachine: new StateMachine(fileManager, workspace),
    templateEngine: new TemplateEngine(fileManager, CUSTOM_TEMPLATES),
    earsValidator: new EarsValidator(),
    transcriptParser: new TranscriptParser(fileManager),
  };
}

async function buildHarness(workspace: string): Promise<Harness> {
  const { fileManager, stateMachine, templateEngine, earsValidator, transcriptParser } =
    provisionWorkspace(workspace);

  const server = new McpServer({ name: "transcript-tools-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerTranscriptTools(
    server,
    fileManager,
    stateMachine,
    templateEngine,
    earsValidator,
    transcriptParser,
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "transcript-tools-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    workspace,
    client,
    fileManager,
    stateMachine,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** Register a Discover-phase feature so feature-scoped tools resolve context. */
async function registerDiscoverFeature(
  stateMachine: StateMachine,
  workspace: string,
  directory = `${SPEC_DIR}/001-imports`,
): Promise<void> {
  mkdirSync(join(workspace, directory), { recursive: true });
  const name = directory.split("-").slice(1).join("-");
  const state = stateMachine.createFeatureState({
    projectName: name,
    feature: { number: directory.match(/(\d{3})-/)?.[1] ?? "001", name, directory },
    contract: resolveUseCaseContract(TRANSCRIPT_USE_CASE),
  });
  state.current_phase = Phase.Discover;
  await stateMachine.saveState(directory, state);
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

// ─── sdd_import_transcript ───

describe("sdd_import_transcript", () => {
  it("parses raw transcript text and returns the structured extraction", async () => {
    const ws = makeWorkspace("specky-import-raw-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);
    await registerDiscoverFeature(h.stateMachine, ws);

    const { isError, payload } = await callTool(h.client, "sdd_import_transcript", {
      file_path: "ignored-when-raw-text.txt",
      raw_text: TRANSCRIPT_TEXT,
      format: "auto",
      spec_dir: SPEC_DIR,
      feature_number: "001",
    });

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("transcript_parsed");
    expect(payload["participants"]).toEqual(["John", "Maria", "Paula"]);

    const stats = payload["stats"] as Record<string, number>;
    expect(stats["segments"]).toBe(5);
    expect(stats["decisions"]).toBeGreaterThanOrEqual(1);
    expect(stats["open_questions"]).toBeGreaterThanOrEqual(1);
    expect(stats["requirements_identified"]).toBeGreaterThanOrEqual(1);

    expect(String(payload["next_action"])).toContain("sdd_auto_pipeline");
    // ResponseBuilder enrichment is attached for feature-scoped tools.
    expect(payload["phase_context"]).toBeDefined();
  });

  it("parses a VTT transcript file via file_path with format detection", async () => {
    const ws = makeWorkspace("specky-import-vtt-");
    writeFileSync(
      join(ws, "meeting.vtt"),
      [
        "WEBVTT",
        "",
        "00:00:01.000 --> 00:00:04.000",
        "<v Paula>We decided to ship the notifier service this quarter.</v>",
        "",
        "00:00:05.000 --> 00:00:09.000",
        "<v John>The system must send email notifications within 5 minutes of an order status change.</v>",
        "",
      ].join("\n"),
    );
    const h = await buildHarness(ws);
    cleanups.push(h.close);
    await registerDiscoverFeature(h.stateMachine, ws);

    const { isError, payload } = await callTool(h.client, "sdd_import_transcript", {
      file_path: "meeting.vtt",
      format: "auto",
      spec_dir: SPEC_DIR,
      feature_number: "001",
    });

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("transcript_parsed");
    expect(payload["participants"]).toEqual(["John", "Paula"]);
    const stats = payload["stats"] as Record<string, number>;
    expect(stats["segments"]).toBe(2);
    expect(String(payload["duration"])).toContain("minute");
  });

  it("returns an error result when the transcript file does not exist", async () => {
    const ws = makeWorkspace("specky-import-missing-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);
    await registerDiscoverFeature(h.stateMachine, ws);

    const { isError, raw } = await callTool(h.client, "sdd_import_transcript", {
      file_path: "no-such-file.txt",
      format: "auto",
      spec_dir: SPEC_DIR,
      feature_number: "001",
    });

    expect(isError).toBe(true);
    expect(raw).toContain("[sdd_import_transcript] Error:");
  });

  it("is denied when the target feature is not registered", async () => {
    const ws = makeWorkspace("specky-import-nofeature-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_import_transcript", {
      file_path: "meeting.txt",
      raw_text: TRANSCRIPT_TEXT,
      format: "txt",
      spec_dir: SPEC_DIR,
      feature_number: "001",
    });

    expect(isError).toBe(true);
    expect(payload["error"]).toBe("feature_not_found");
  });
});

// ─── sdd_auto_pipeline ───

describe("sdd_auto_pipeline", () => {
  it("runs the full pipeline from raw_text and writes every artifact", async () => {
    const ws = makeWorkspace("specky-auto-happy-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_auto_pipeline", autoPipelineInput());

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("auto_pipeline_complete");
    expect(payload["transcript_source"]).toBe("inline-paste");

    const filesCreated = payload["files_created"] as string[];
    for (const file of [
      "CONSTITUTION.md",
      "SPECIFICATION.md",
      "DESIGN.md",
      "TASKS.md",
      "ANALYSIS.md",
      "TRANSCRIPT.md",
    ]) {
      expect(filesCreated).toContain(file);
    }

    const featureDir = join(ws, SPEC_DIR, "001-notify-service");
    for (const file of [
      "CONSTITUTION.md",
      "SPECIFICATION.md",
      "DESIGN.md",
      "TASKS.md",
      "ANALYSIS.md",
      "TRANSCRIPT.md",
    ]) {
      expect(existsSync(join(featureDir, file))).toBe(true);
    }

    // The transcript is preserved verbatim as a reference artifact.
    const transcriptMd = readFileSync(join(featureDir, "TRANSCRIPT.md"), "utf-8");
    expect(transcriptMd).toContain("order status change");
    // Discovery context extracted from the meeting lands in the specification.
    const specMd = readFileSync(join(featureDir, "SPECIFICATION.md"), "utf-8");
    expect(specMd).toContain("Discovery Context");
    expect(specMd).toContain("REQ-FUNC-001");

    const gate = payload["gate_decision"] as { decision: string; coverage_percent: number };
    expect(typeof gate.decision).toBe("string");
    expect(typeof gate.coverage_percent).toBe("number");
    expect(String(payload["next_action"])).toContain("Review SPECIFICATION.md");

    // The computed gate decision is persisted into the feature state.
    const state = await h.stateMachine.loadState(`${SPEC_DIR}/001-notify-service`);
    expect(state.gate_decision?.decision).toBe(gate.decision);
    expect(state.current_phase).toBe(Phase.Analyze);
  });

  it("runs the full pipeline from a transcript file", async () => {
    const ws = makeWorkspace("specky-auto-file-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/planning.txt"), TRANSCRIPT_TEXT);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({ raw_text: undefined, file_path: "transcripts/planning.txt" }),
    );

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("auto_pipeline_complete");
    expect(payload["transcript_source"]).toBe("transcripts/planning.txt");
  });

  it("rejects when neither file_path nor raw_text is provided", async () => {
    const ws = makeWorkspace("specky-auto-nosource-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({ raw_text: undefined, file_path: undefined }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("Provide either file_path or raw_text");
  });

  it("rejects a non-full execution-mode contract before writing files", async () => {
    const ws = makeWorkspace("specky-auto-rapid-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({ use_case: RAPID_USE_CASE }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("requires a full execution-mode contract");
    expect(raw).toContain("greenfield-service-rapid");
    expect(existsSync(join(ws, SPEC_DIR, "001-notify-service"))).toBe(false);
  });

  it("rejects an API workload without an explicit API contract", async () => {
    const ws = makeWorkspace("specky-auto-apicontract-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        use_case: API_USE_CASE,
        architecture: { ...TRANSCRIPT_ARCHITECTURE, workload_design: API_DESIGN },
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("requires at least one explicit API contract");
    expect(existsSync(join(ws, SPEC_DIR, "001-notify-service"))).toBe(false);
  });

  it("rejects duplicate requirement IDs", async () => {
    const ws = makeWorkspace("specky-auto-dupreq-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        requirements: [TRANSCRIPT_REQUIREMENTS[0], TRANSCRIPT_REQUIREMENTS[0]],
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("Duplicate requirement ID REQ-FUNC-001");
  });

  it("rejects a requirement whose source_quote is absent from the transcript", async () => {
    const ws = makeWorkspace("specky-auto-ungrounded-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        requirements: [
          {
            ...TRANSCRIPT_REQUIREMENTS[0],
            source_quote: "This sentence was never said in the meeting",
          },
        ],
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("source_quote is not present in the transcript");
    expect(existsSync(join(ws, SPEC_DIR, "001-notify-service"))).toBe(false);
  });

  it("rejects a requirement that is not valid EARS", async () => {
    const ws = makeWorkspace("specky-auto-notears-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        requirements: [
          {
            ...TRANSCRIPT_REQUIREMENTS[0],
            text: "The system quickly handles notifications in a nice way.",
          },
        ],
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("is not valid EARS");
  });

  it("rejects a task that traces to an unknown requirement", async () => {
    const ws = makeWorkspace("specky-auto-badtrace-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        tasks: [{ ...TRANSCRIPT_TASKS[0], traces_to: ["REQ-FUNC-099"] }],
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("traces to unknown requirements: REQ-FUNC-099");
  });

  it("rejects a task that depends on an unknown task", async () => {
    const ws = makeWorkspace("specky-auto-baddep-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({
        tasks: [{ ...TRANSCRIPT_TASKS[0], dependencies: ["T-099"] }],
      }),
    );

    expect(isError).toBe(true);
    expect(raw).toContain("depends on unknown tasks: T-099");
  });

  it("rejects a feature number that is already assigned", async () => {
    const ws = makeWorkspace("specky-auto-collision-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const first = await callTool(h.client, "sdd_auto_pipeline", autoPipelineInput());
    expect(first.isError).toBe(false);

    const second = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({ project_name: "other-service" }),
    );

    expect(second.isError).toBe(true);
    expect(second.raw).toContain("Feature number 001 is already assigned to");
  });

  it("rejects input that fails schema validation", async () => {
    const ws = makeWorkspace("specky-auto-schema-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError } = await callTool(
      h.client,
      "sdd_auto_pipeline",
      autoPipelineInput({ format: "yaml" }),
    );

    expect(isError).toBe(true);
  });
});

// ─── sdd_batch_transcripts ───

describe("sdd_batch_transcripts", () => {
  it("reports no_transcripts_found for an empty folder", async () => {
    const ws = makeWorkspace("specky-batch-empty-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [batchFeatureInput("meeting.txt", "alpha", "001")],
      force: false,
    });

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("no_transcripts_found");
    expect(String(payload["message"])).toContain("No transcript files found");
  });

  it("rejects when a transcript file has no manifest entry", async () => {
    const ws = makeWorkspace("specky-batch-unconfigured-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/meeting.txt"), TRANSCRIPT_TEXT);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [batchFeatureInput("other.txt", "alpha", "001")],
      force: false,
    });

    expect(isError).toBe(true);
    expect(raw).toContain("Batch manifest mismatch");
    expect(raw).toContain("Unconfigured files: meeting.txt");
    expect(raw).toContain("Missing files: other.txt");
  });

  it("rejects duplicate feature numbers in the manifest", async () => {
    const ws = makeWorkspace("specky-batch-dupnum-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/a.txt"), TRANSCRIPT_TEXT);
    writeFileSync(join(ws, "transcripts/b.txt"), TRANSCRIPT_TEXT);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [
        batchFeatureInput("a.txt", "alpha", "001"),
        batchFeatureInput("b.txt", "beta", "001"),
      ],
      force: false,
    });

    expect(isError).toBe(true);
    expect(raw).toContain("Batch feature number conflict");
    expect(raw).toContain("Duplicates: 001");
  });

  it("rejects feature numbers that collide with existing features", async () => {
    const ws = makeWorkspace("specky-batch-collision-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/a.txt"), TRANSCRIPT_TEXT);
    mkdirSync(join(ws, SPEC_DIR, "001-existing"), { recursive: true });
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [batchFeatureInput("a.txt", "alpha", "001")],
      force: false,
    });

    expect(isError).toBe(true);
    expect(raw).toContain("Batch feature number conflict");
    expect(raw).toContain("Existing: 001");
  });

  it("rejects a non-full execution-mode contract", async () => {
    const ws = makeWorkspace("specky-batch-rapid-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/a.txt"), TRANSCRIPT_TEXT);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, raw } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: RAPID_USE_CASE,
      features: [batchFeatureInput("a.txt", "alpha", "001")],
      force: false,
    });

    expect(isError).toBe(true);
    expect(raw).toContain("requires a full execution-mode contract");
  });

  it("processes a two-feature manifest and writes both feature packages", async () => {
    const ws = makeWorkspace("specky-batch-happy-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/a.txt"), TRANSCRIPT_TEXT);
    writeFileSync(join(ws, "transcripts/b.txt"), TRANSCRIPT_TEXT);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_batch_transcripts", {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [
        batchFeatureInput("a.txt", "alpha", "001"),
        batchFeatureInput("b.txt", "beta", "002"),
      ],
      force: false,
    });

    expect(isError).toBe(false);
    expect(payload["status"]).toBe("batch_complete");
    expect(payload["total_files"]).toBe(2);
    expect(payload["succeeded"]).toBe(2);
    expect(payload["failed"]).toBe(0);
    expect(payload["total_requirements"]).toBe(4);
    expect(payload["contract_id"]).toBe("greenfield-service-full");
    expect(String(payload["next_action"])).toContain("processed successfully");

    const results = payload["results"] as Array<Record<string, unknown>>;
    expect(results.map((r) => r["status"])).toEqual(["completed", "completed"]);

    for (const dir of ["001-alpha", "002-beta"]) {
      const featureDir = join(ws, SPEC_DIR, dir);
      for (const file of [
        "CONSTITUTION.md",
        "SPECIFICATION.md",
        "DESIGN.md",
        "TASKS.md",
        "ANALYSIS.md",
        "TRANSCRIPT.md",
      ]) {
        expect(existsSync(join(featureDir, file))).toBe(true);
      }
      const state = await h.stateMachine.loadState(`${SPEC_DIR}/${dir}`);
      expect(state.current_phase).toBe(Phase.Analyze);
      expect(state.gate_decision?.decision).toBeDefined();
    }
  });

  it("isolates a per-feature write failure and still completes the batch", async () => {
    const ws = makeWorkspace("specky-batch-partial-");
    mkdirSync(join(ws, "transcripts"), { recursive: true });
    writeFileSync(join(ws, "transcripts/a.txt"), TRANSCRIPT_TEXT);
    writeFileSync(join(ws, "transcripts/b.txt"), TRANSCRIPT_TEXT);

    // Register the tools on a bare server stub so the handler can be invoked
    // directly with a stubbed FileManager and a manually resolved context.
    const { fileManager, stateMachine, templateEngine, earsValidator, transcriptParser } =
      provisionWorkspace(ws);
    const handlers = new Map<
      string,
      (args: Record<string, unknown>) => Promise<{
        content: Array<{ text: string }>;
        isError?: boolean;
      }>
    >();
    const stubServer = {
      registerTool: (
        name: string,
        _config: unknown,
        handler: (args: Record<string, unknown>) => Promise<unknown>,
      ) => {
        handlers.set(
          name,
          handler as (args: Record<string, unknown>) => Promise<{
            content: Array<{ text: string }>;
            isError?: boolean;
          }>,
        );
      },
    };
    registerTranscriptTools(
      stubServer as unknown as McpServer,
      fileManager,
      stateMachine,
      templateEngine,
      earsValidator,
      transcriptParser,
    );
    const handler = handlers.get("sdd_batch_transcripts");
    expect(handler).toBeDefined();

    // Fail the DESIGN.md write for the second feature only.
    const originalWrite = fileManager.writeSpecFile.bind(fileManager);
    fileManager.writeSpecFile = async (featureDir, fileName, content, force) => {
      if (featureDir.endsWith("002-beta") && fileName === "DESIGN.md") {
        throw new Error("simulated write failure");
      }
      return originalWrite(featureDir, fileName, content, force);
    };

    const input: Record<string, unknown> = {
      transcripts_dir: "transcripts",
      spec_dir: SPEC_DIR,
      use_case: TRANSCRIPT_USE_CASE,
      features: [
        batchFeatureInput("a.txt", "alpha", "001"),
        batchFeatureInput("b.txt", "beta", "002"),
      ],
      force: false,
    };
    const context = await new ExecutionContextResolver(fileManager, stateMachine).resolve(
      "sdd_batch_transcripts",
      input,
    );
    const result = await runWithExecutionContext(context, () => handler!(input));

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(payload["status"]).toBe("batch_complete");
    expect(payload["succeeded"]).toBe(1);
    expect(payload["failed"]).toBe(1);

    const results = payload["results"] as Array<Record<string, unknown>>;
    const failed = results.find((r) => r["status"] === "error");
    expect(failed?.["file"]).toBe("b.txt");
    expect(String(failed?.["error"])).toContain("simulated write failure");
    expect(String(payload["next_action"])).toContain("1 transcript feature(s) failed");

    // The successful feature still has its full artifact set.
    expect(existsSync(join(ws, SPEC_DIR, "001-alpha", "ANALYSIS.md"))).toBe(true);
  });
});
