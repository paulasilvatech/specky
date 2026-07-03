/**
 * tool-enforcement-mcp.test.ts — validates global MCP tool enforcement.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");

function callTool(cwd: string, toolName: string, args: Record<string, unknown>, role: string): Record<string, unknown> {
  const input =
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "enforcement-test", version: "1" } },
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
    env: { ...process.env, SDD_WORKSPACE: cwd, SDD_ROLE: role },
    timeout: 10000,
  });

  const lines = (res.stdout ?? "").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed["id"] === 2) return parsed;
    } catch {
      // Ignore non-JSON lines.
    }
  }

  throw new Error(`No tool response. status=${res.status}; stderr=${res.stderr?.slice(0, 500)}`);
}

function extractText(response: Record<string, unknown>): string {
  const result = response["result"] as { content?: Array<{ text?: string }> } | undefined;
  return result?.content?.[0]?.text ?? "";
}

function readAuditEntries(workspace: string): Array<Record<string, unknown>> {
  const raw = readFileSync(resolve(workspace, ".specs", ".audit.jsonl"), "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("MCP tool enforcement", () => {
  let ws: string;

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-mcp-enforcement-"));
    spawnSync("git", ["init", "-q"], { cwd: ws });
    mkdirSync(resolve(ws, ".specky"), { recursive: true });
    writeFileSync(
      resolve(ws, ".specky", "config.yml"),
      [
        "audit_enabled: true",
        "rbac:",
        "  enabled: true",
        "  default_role: viewer",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("allows viewer read-only tools and writes audit entries", () => {
    const response = callTool(ws, "sdd_get_status", { spec_dir: ".specs" }, "viewer");
    const text = extractText(response);

    expect(text).toContain("current_phase");
    expect(existsSync(resolve(ws, ".specs", ".audit.jsonl"))).toBe(true);

    const entries = readAuditEntries(ws);
    expect(entries).toHaveLength(2);
    expect(entries[0].tool).toBe("sdd_get_status");
    expect(entries[0].role).toBe("viewer");
    expect(entries[0].input_hash).toEqual(expect.any(String));
    expect(entries[1].output_hash).toEqual(expect.any(String));

    const verifyResponse = callTool(ws, "sdd_verify_audit", { spec_dir: ".specs" }, "viewer");
    const verification = JSON.parse(extractText(verifyResponse)) as { valid: boolean; total_entries: number };
    expect(verification.valid).toBe(true);
    expect(verification.total_entries).toBeGreaterThanOrEqual(3);
  });

  it("blocks viewer write tools before execution and records denial", () => {
    const response = callTool(ws, "sdd_init", { project_name: "demo", spec_dir: ".specs" }, "viewer");
    const payload = JSON.parse(extractText(response)) as { error: string; active_role: string };

    expect(payload.error).toBe("access_denied");
    expect(payload.active_role).toBe("viewer");
    expect(existsSync(resolve(ws, ".specs", "001-demo", "CONSTITUTION.md"))).toBe(false);

    const entries = readAuditEntries(ws);
    expect(entries).toHaveLength(1);
    expect(entries[0].tool).toBe("sdd_init");
    expect(entries[0].result).toBe("error");
    expect(entries[0].role).toBe("viewer");
  });
});
