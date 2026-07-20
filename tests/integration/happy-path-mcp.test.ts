/**
 * happy-path-mcp.test.ts — end-to-end regression for the feature-identity fix.
 *
 * Reproduces the exact break: sdd_init registers `001-user-auth`, then
 * sdd_write_spec is called with a DIFFERENT display name ("User Authentication").
 * Before the fix the spec was written into `001-user-authentication`, the state
 * still pointed at `001-user-auth`, and sdd_advance_phase failed with
 * "missing SPECIFICATION.md". The whole init→discover→specify→advance flow must
 * now land in a single directory and advance cleanly.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeTestWorkspaceConfig } from "../helpers/runtime-workspace.js";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");

interface Rpc {
  id?: number;
  result?: { content?: Array<{ text?: string }> };
  error?: unknown;
}

/**
 * Drive an ordered tool sequence through one server process the way a real
 * MCP client does: send a request, await its response, then send the next.
 */
async function driveSequence(
  cwd: string,
  calls: Array<{ name: string; args: Record<string, unknown> }>,
): Promise<Record<string, unknown>[]> {
  const server = spawn("node", [SERVER], {
    cwd,
    env: {
      ...process.env,
      SDD_WORKSPACE: cwd,
      SDD_ROLE: "admin",
      SDD_FIXED_NOW: "2026-06-17T12:00:00.000Z",
    },
  });
  let buf = "";
  const pending = new Map<number, (r: Rpc) => void>();
  server.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString();
    let idx = buf.indexOf("\n");
    while (idx >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      idx = buf.indexOf("\n");
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as Rpc;
        if (typeof parsed.id === "number" && pending.has(parsed.id)) {
          pending.get(parsed.id)!(parsed);
          pending.delete(parsed.id);
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  });
  const rpc = (id: number, method: string, params: unknown): Promise<Rpc> =>
    new Promise((res) => {
      pending.set(id, res);
      server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });

  try {
    await rpc(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "happy-path", version: "1" },
    });
    server.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < calls.length; i++) {
      const r = await rpc(100 + i, "tools/call", { name: calls[i].name, arguments: calls[i].args });
      out.push(r as Record<string, unknown>);
    }
    return out;
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      await new Promise<void>((resolveClose) => {
        server.once("close", () => resolveClose());
        server.stdin.end();
        server.kill();
      });
    }
  }
}

function payload(response: Record<string, unknown>): Record<string, unknown> {
  const result = response["result"] as { content?: Array<{ text?: string }> } | undefined;
  const text = result?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { _raw: text };
  }
}

describe("happy path through MCP with a mismatched display name", () => {
  let ws: string;

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-happy-path-"));
    spawnSync("git", ["init", "-q"], { cwd: ws });
    writeTestWorkspaceConfig(ws);
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("writes the spec into the init directory and advances past specify", async () => {
    const [, , , writeSpec, advance] = await driveSequence(ws, [
      {
        name: "sdd_init",
        args: {
          project_name: "user-auth",
          spec_dir: ".specs",
          feature_number: "001",
          use_case: {
            lifecycle: "greenfield",
            workload: "service",
            execution_mode: "full",
            capabilities: [],
            capability_config: {},
          },
        },
      },
      {
        name: "sdd_discover",
        args: {
          spec_dir: ".specs",
          feature_number: "001",
          project_idea: "Email/password auth with JWT sessions",
        },
      },
      { name: "sdd_advance_phase", args: { spec_dir: ".specs", feature_number: "001" } },
      {
        name: "sdd_write_spec",
        args: {
          feature_name: "User Authentication", // deliberately different from "user-auth"
          feature_number: "001",
          spec_dir: ".specs",
          force: false,
          discovery_answers: { Q1: "v1 login" },
          requirements: [
            {
              id: "REQ-AUTH-001",
              ears_pattern: "event_driven",
              text: "When a user submits valid credentials, the system shall issue a JWT within 500ms.",
              acceptance_criteria: ["JWT issued on valid login"],
            },
          ],
        },
      },
      { name: "sdd_advance_phase", args: { spec_dir: ".specs", feature_number: "001" } },
    ]);

    // Spec written into the SAME directory init created — no fork.
    expect(payload(writeSpec).status).toBe("specification_written");
    const specDirs = readdirSync(resolve(ws, ".specs")).filter((n) => /^\d{3}-/.test(n));
    expect(specDirs).toEqual(["001-user-auth"]);
    expect(existsSync(resolve(ws, ".specs", "001-user-auth", "SPECIFICATION.md"))).toBe(true);

    // The advance that previously failed with "missing SPECIFICATION.md".
    const adv = payload(advance);
    expect(adv.status).toBe("phase_advanced");
    expect(adv.current_phase).toBe("clarify");
  });
});
