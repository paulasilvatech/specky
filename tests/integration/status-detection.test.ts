/**
 * status-detection.test.ts — regression test for the feature-detection bug.
 *
 * Bug (pre-rc.8): sdd_get_status loaded root .specs/.sdd-state.json which
 * never exists under normal use (state lives per-feature at
 * .specs/<NNN-name>/.sdd-state.json). Tool returned features=[] and
 * current_phase="init" even when features were clearly in progress on disk.
 *
 * Fix: scan .specs/ for feature directories, load each feature's state,
 * and aggregate. This test pins that behavior.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");

function writeValidState(featureDir: string, currentPhase: string, completed: string[]): void {
  mkdirSync(featureDir, { recursive: true });
  const phases: Record<string, { status: string }> = {};
  for (const p of ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement", "verify", "release"]) {
    phases[p] = { status: completed.includes(p) ? "completed" : p === currentPhase ? "in_progress" : "pending" };
  }
  writeFileSync(
    resolve(featureDir, ".sdd-state.json"),
    JSON.stringify({
      version: "4.0.0",
      feature_number: "001",
      feature_name: "test",
      current_phase: currentPhase,
      phases,
      features: [],
      gate_decision: null,
    }, null, 2),
  );
}

function callGetStatus(cwd: string, featureNumber?: string): Record<string, unknown> {
  const args = featureNumber ? { feature_number: featureNumber } : {};
  const input =
    JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    }) + "\n" +
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
    JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "sdd_get_status", arguments: args },
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
      // skip non-JSON lines
    }
  }
  throw new Error(`No valid response; stderr=${res.stderr?.slice(0, 500)}`);
}

describe("sdd_get_status — feature detection regression (rc.8 fix)", () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-status-"));
    spawnSync("git", ["init", "-q"], { cwd: ws });
  });
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it("returns features:[] when no .specs/ exists (greenfield)", () => {
    const res = callGetStatus(ws);
    expect(res["features"]).toEqual([]);
    expect(res["active_feature"]).toBeNull();
    expect(res["current_phase"]).toBe("init");
  });

  it("detects a feature with state file and reports its phase", () => {
    writeValidState(
      resolve(ws, ".specs/001-sifap"),
      "implement",
      ["init", "discover", "specify", "clarify", "design", "tasks", "analyze"],
    );

    const res = callGetStatus(ws);
    expect(Array.isArray(res["features"])).toBe(true);
    const features = res["features"] as Array<Record<string, unknown>>;
    expect(features.length).toBe(1);
    expect(features[0]!["number"]).toBe("001");
    expect(features[0]!["phase"]).toBe("implement");
    expect(features[0]!["phase_progress"]).toBe("7/10");

    expect(res["active_feature"]).toMatchObject({
      number: "001",
      name: "sifap",
      phase: "implement",
    });
    expect(res["current_phase"]).toBe("implement");
    expect(res["completion_percent"]).toBe(70);
  });

  it("aggregates multiple features independently", () => {
    writeValidState(resolve(ws, ".specs/001-foo"), "design", ["init", "discover", "specify", "clarify"]);
    writeValidState(resolve(ws, ".specs/002-bar"), "verify", ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement"]);

    const res = callGetStatus(ws);
    const features = res["features"] as Array<Record<string, unknown>>;
    expect(features.length).toBe(2);

    const foo = features.find((f) => f["number"] === "001");
    const bar = features.find((f) => f["number"] === "002");
    expect(foo?.["phase"]).toBe("design");
    expect(bar?.["phase"]).toBe("verify");
    expect(bar?.["phase_progress"]).toBe("8/10");
  });

  it("selects specific feature when feature_number provided", () => {
    writeValidState(resolve(ws, ".specs/001-foo"), "design", ["init", "discover", "specify", "clarify"]);
    writeValidState(resolve(ws, ".specs/002-bar"), "verify", ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement"]);

    const res = callGetStatus(ws, "001");
    expect(res["active_feature"]).toMatchObject({ number: "001", phase: "design" });
    expect(res["current_phase"]).toBe("design");
  });
});
