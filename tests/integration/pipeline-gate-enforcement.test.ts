/**
 * pipeline-gate-enforcement.test.ts — MCP integration gate blocking via tool enforcement.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");

function callTool(cwd: string, toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const input =
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "gate-test", version: "1" } },
    }) + "\n" +
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }) + "\n";

  const res = spawnSync("node", [SERVER], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, SDD_WORKSPACE: cwd },
    timeout: 15000,
  });

  const lines = (res.stdout ?? "").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed["id"] === 2) return parsed;
    } catch {
      // ignore
    }
  }
  throw new Error(`No tool response. status=${res.status}; stderr=${res.stderr?.slice(0, 500)}`);
}

function extractText(response: Record<string, unknown>): string {
  const result = response["result"] as { content?: Array<{ text?: string }>; isError?: boolean } | undefined;
  return result?.content?.[0]?.text ?? "";
}

function isToolError(response: Record<string, unknown>): boolean {
  const result = response["result"] as { isError?: boolean } | undefined;
  return result?.isError === true;
}

describe("pipeline gate enforcement via MCP", () => {
  let ws: string;

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-gate-mcp-"));
    mkdirSync(resolve(ws, ".specs"), { recursive: true });
    writeFileSync(
      resolve(ws, ".specs", ".sdd-state.json"),
      JSON.stringify({
        version: "4.0.0",
        project_name: "gate-mcp",
        current_phase: "analyze",
        phases: {
          init: { status: "completed" },
          discover: { status: "completed" },
          specify: { status: "completed" },
          clarify: { status: "completed" },
          design: { status: "completed" },
          tasks: { status: "completed" },
          analyze: { status: "in_progress", started_at: new Date().toISOString() },
          implement: { status: "pending" },
          verify: { status: "pending" },
          release: { status: "pending" },
        },
        features: [".specs/001-gate"],
        amendments: [],
        gate_decision: {
          decision: "BLOCK",
          reasons: ["gaps"],
          coverage_percent: 40,
          gaps: ["REQ-001"],
          decided_at: new Date().toISOString(),
        },
      }, null, 2),
    );
    mkdirSync(resolve(ws, ".specs/001-gate"), { recursive: true });
    writeFileSync(resolve(ws, ".specs/001-gate/TASKS.md"), "# Tasks\n");
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("blocks sdd_implement when analysis gate is BLOCK", () => {
    const response = callTool(ws, "sdd_implement", { feature_number: "001", spec_dir: ".specs" });
    expect(isToolError(response)).toBe(true);
    const text = extractText(response);
    expect(text).toContain("gate_blocked");
    expect(text).toContain("BLOCK");
  });
});
