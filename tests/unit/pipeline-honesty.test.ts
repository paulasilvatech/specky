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
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
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

const REPO = resolve(import.meta.dirname, "../..");
// The built-in template dir resolves relative to dist/; when running from
// src/ it does not exist, so tests mirror the repo templates into each
// workspace and use the custom-templates path.
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";

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
      format: "txt",
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
    const state = await h.stateMachine.loadState(".specs");
    expect(state.gate_decision?.decision).toBe(expected.decision);
    expect(state.gate_decision?.coverage_percent).toBe(expected.coveragePercent);
  });

  // ── Fix 2: sdd_get_status reads the state the pipeline actually persists ──
  it("sdd_get_status headline fields move with the root pipeline state (init → advance)", async () => {
    const ws = makeWorkspace("specky-honesty-status-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const init = await callTool(h.client, "sdd_init", { project_name: "status-probe" });
    expect(init.isError).toBe(false);

    const statusAtInit = await callTool(h.client, "sdd_get_status", {});
    expect(statusAtInit.payload["current_phase"]).toBe("init");

    await callTool(h.client, "sdd_discover", { project_idea: "A status probe service" });
    const advance = await callTool(h.client, "sdd_advance_phase", {});
    expect(advance.isError).toBe(false);
    expect(advance.payload["current_phase"]).toBe("specify");

    // No per-feature .sdd-state.json exists (pipeline tools persist root
    // state only) — the headline fields must still reflect the advance.
    const status = await callTool(h.client, "sdd_get_status", {});
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
    });

    // A per-feature state file, when present, still wins (batch flows).
    const featureState = h.stateMachine.createDefaultState("status-probe");
    featureState.current_phase = "verify" as typeof featureState.current_phase;
    writeFileSync(
      join(ws, ".specs", "001-status-probe", ".sdd-state.json"),
      JSON.stringify(featureState, null, 2),
    );
    const statusPerFeature = await callTool(h.client, "sdd_get_status", {});
    expect(statusPerFeature.payload["current_phase"]).toBe("verify");
  });

  // ── Fix 3: featureless advance loophole ──
  it("sdd_advance_phase refuses to advance when no feature is registered", async () => {
    const ws = makeWorkspace("specky-honesty-featureless-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    // No sdd_init — the audit walked 6 phases this way with zero artifacts.
    const first = await callTool(h.client, "sdd_advance_phase", {});
    expect(first.isError).toBe(true);
    expect(first.raw).toContain("no feature registered");
    expect(first.raw).toContain("sdd_init");

    // Repeated attempts must not creep forward either.
    await callTool(h.client, "sdd_advance_phase", {});
    await callTool(h.client, "sdd_advance_phase", {});
    const status = await callTool(h.client, "sdd_get_status", {});
    expect(status.payload["current_phase"]).toBe("init");
    expect(status.payload["completion_percent"]).toBe(0);
  });

  // ── Fix 4: opt-in server-side LGTM gate ──
  it("pipeline.require_lgtm blocks completing specify without lgtm:true and records approval", async () => {
    const ws = makeWorkspace("specky-honesty-lgtm-");
    mkdirSync(join(ws, ".specky"), { recursive: true });
    writeFileSync(join(ws, ".specky", "config.yml"), "pipeline:\n  require_lgtm: true\n");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    await callTool(h.client, "sdd_init", { project_name: "lgtm-gate" });
    await callTool(h.client, "sdd_discover", { project_idea: "LGTM gate probe" });
    // init/discover completions are NOT LGTM gates — no approval needed.
    const toSpecify = await callTool(h.client, "sdd_advance_phase", {});
    expect(toSpecify.isError).toBe(false);

    await callTool(h.client, "sdd_write_spec", {
      feature_name: "lgtm-gate",
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
    const blocked = await callTool(h.client, "sdd_advance_phase", {});
    expect(blocked.isError).toBe(true);
    expect(blocked.raw).toContain("lgtm_required");
    expect(blocked.raw).toContain("require_lgtm");

    const stillSpecify = await callTool(h.client, "sdd_get_status", {});
    expect(stillSpecify.payload["current_phase"]).toBe("specify");

    // With lgtm:true the gate opens and the approval is recorded in history.
    const approved = await callTool(h.client, "sdd_advance_phase", { lgtm: true });
    expect(approved.isError).toBe(false);
    expect(approved.payload["current_phase"]).toBe("clarify");

    const state = await h.stateMachine.loadState(".specs");
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

    await callTool(h.client, "sdd_init", { project_name: "no-lgtm" });
    await callTool(h.client, "sdd_discover", { project_idea: "Default behavior probe" });
    await callTool(h.client, "sdd_advance_phase", {});
    await callTool(h.client, "sdd_write_spec", {
      feature_name: "no-lgtm",
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

    const advance = await callTool(h.client, "sdd_advance_phase", {});
    expect(advance.isError).toBe(false);
    expect(advance.payload["current_phase"]).toBe("clarify");

    // LGTM presence is still recorded (as false) for gate-history honesty.
    const state = await h.stateMachine.loadState(".specs");
    const lastGate = (state.gate_history ?? []).at(-1) as
      | { phase: string; lgtm?: boolean }
      | undefined;
    expect(lastGate?.phase).toBe("specify");
    expect(lastGate?.lgtm).toBe(false);
  });
});
