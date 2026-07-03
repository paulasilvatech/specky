/**
 * analysis-gate.test.ts — validates semantic sdd_run_analysis evidence gates.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");
const PHASES = ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement", "verify", "release"];

function writeFeature(workspace: string, mapped: boolean): void {
  const specsDir = resolve(workspace, ".specs");
  const featureDir = resolve(workspace, ".specs", "001-analysis-gate");
  mkdirSync(featureDir, { recursive: true });
  const pendingPhases = new Set(["analyze", "implement", "verify", "release"]);
  const phases = Object.fromEntries(PHASES.map((phase) => {
    let status = "completed";
    if (phase === "tasks") {
      status = "in_progress";
    } else if (pendingPhases.has(phase)) {
      status = "pending";
    }
    return [phase, { status }];
  }));
  const state = JSON.stringify({
    version: "4.0.0",
    project_name: "analysis-gate",
    current_phase: "tasks",
    phases,
    features: [".specs/001-analysis-gate"],
    amendments: [],
    gate_decision: null,
  }, null, 2);
  writeFileSync(resolve(specsDir, ".sdd-state.json"), state);
  writeFileSync(resolve(featureDir, ".sdd-state.json"), state);
  writeFileSync(resolve(featureDir, "CONSTITUTION.md"), "# Constitution\n", "utf8");
  writeFileSync(resolve(featureDir, "SPECIFICATION.md"), [
    "# Specification",
    "",
    "### REQ-CORE-001: Requirement",
    "",
    "The system shall enforce semantic gates.",
    "",
    "**Acceptance Criteria:**",
    "- Confirm gate output is evidence-based.",
    "",
  ].join("\n"), "utf8");
  writeFileSync(resolve(featureDir, "DESIGN.md"), mapped ? "# Design\n\nREQ-CORE-001 maps to GateEngine.\n" : "# Design\n\nNo mapping.\n", "utf8");
  writeFileSync(resolve(featureDir, "TASKS.md"), mapped ? "# Tasks\n\n- [ ] T-001: Implement gate REQ-CORE-001\n" : "# Tasks\n\n- [ ] T-001: Implement gate\n", "utf8");
}

function callRunAnalysis(cwd: string): Record<string, unknown> {
  const input =
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "analysis-gate", version: "1" } },
    }) + "\n" +
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "sdd_run_analysis", arguments: { spec_dir: ".specs", feature_number: "001", force: true } },
    }) + "\n";

  const res = spawnSync("node", [SERVER], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, SDD_WORKSPACE: cwd },
    timeout: 10000,
  });

  const lines = (res.stdout ?? "").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { id?: number; result?: { content?: Array<{ text?: string }> } };
      if (parsed.id === 2 && parsed.result?.content?.[0]?.text) {
        return JSON.parse(parsed.result.content[0].text) as Record<string, unknown>;
      }
    } catch {
      // Ignore non-JSON lines.
    }
  }
  throw new Error(`No analysis response. status=${res.status}; stderr=${res.stderr?.slice(0, 500)}`);
}

describe("sdd_run_analysis semantic gate", () => {
  let ws: string;

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-analysis-gate-"));
    spawnSync("git", ["init", "-q"], { cwd: ws });
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("approves when requirements have EARS, design mapping, and task mapping", () => {
    writeFeature(ws, true);

    const result = callRunAnalysis(ws);
    const gateDecision = result["gate_decision"] as { decision: string; coverage_percent: number; gaps: string[] };

    expect(gateDecision.decision).toBe("APPROVE");
    expect(gateDecision.coverage_percent).toBe(100);
    expect(gateDecision.gaps).toEqual([]);
  });

  it("blocks or requests changes when design/task mappings are missing", () => {
    writeFeature(ws, false);

    const result = callRunAnalysis(ws);
    const gateDecision = result["gate_decision"] as { decision: string; gaps: string[] };

    expect(gateDecision.decision).not.toBe("APPROVE");
    expect(gateDecision.gaps.join("\n")).toContain("Design mapping missing for: REQ-CORE-001");
    expect(gateDecision.gaps.join("\n")).toContain("Task mapping missing for: REQ-CORE-001");
  });
});
