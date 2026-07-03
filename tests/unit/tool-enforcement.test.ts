import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";

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

function readAuditEntries(workspace: string): Array<Record<string, unknown>> {
  const raw = readFileSync(join(workspace, ".specs", ".audit.jsonl"), "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

function getHandler(server: FakeServer, name: string): Handler {
  const handler = server.handlers.get(name);
  if (!handler) throw new Error(`Missing registered handler: ${name}`);
  return handler;
}

describe("installToolEnforcement", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-tool-enforcement-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("blocks write tools for viewer role before handler execution", async () => {
    const server = new FakeServer();
    let executed = false;

    installToolEnforcement(server as unknown as McpServer, {
      auditLogger: new AuditLogger(workspace, true),
      rbacEngine: new RbacEngine(true, "viewer"),
      stateMachine: new StateMachine(new FileManager(workspace), workspace),
    });

    server.registerTool("sdd_write_spec", {}, async () => {
      executed = true;
      return { content: [{ type: "text", text: "should not run" }] };
    });

    const result = await getHandler(server, "sdd_write_spec")({ spec_dir: ".specs" });
    const payload = JSON.parse(result.content[0].text) as { error: string; active_role: string };

    expect(executed).toBe(false);
    expect(result.isError).toBe(true);
    expect(payload.error).toBe("access_denied");
    expect(payload.active_role).toBe("viewer");

    const entries = readAuditEntries(workspace);
    expect(entries).toHaveLength(1);
    expect(entries[0].result).toBe("error");
    expect(entries[0].role).toBe("viewer");
    expect(entries[0].input_hash).toEqual(expect.any(String));
  });

  it("blocks tools that are not allowed in the current phase", async () => {
    const server = new FakeServer();
    let executed = false;

    installToolEnforcement(server as unknown as McpServer, {
      auditLogger: new AuditLogger(workspace, true),
      rbacEngine: new RbacEngine(false, "contributor"),
      stateMachine: new StateMachine(new FileManager(workspace), workspace),
    });

    server.registerTool("sdd_write_design", {}, async () => {
      executed = true;
      return { content: [{ type: "text", text: "should not run" }] };
    });

    const result = await getHandler(server, "sdd_write_design")({ spec_dir: ".specs" });
    const payload = JSON.parse(result.content[0].text) as { error: string; current_phase: string };

    expect(executed).toBe(false);
    expect(result.isError).toBe(true);
    expect(payload.error).toBe("phase_validation_failed");
    expect(payload.current_phase).toBe("init");

    const entries = readAuditEntries(workspace);
    expect(entries).toHaveLength(1);
    expect(entries[0].result).toBe("error");
    expect(entries[0].phase).toBe("init");
  });

  it("executes allowed tools and records start and completion audit entries", async () => {
    const server = new FakeServer();
    let extraArg: unknown;

    installToolEnforcement(server as unknown as McpServer, {
      auditLogger: new AuditLogger(workspace, true),
      rbacEngine: new RbacEngine(true, "viewer"),
      stateMachine: new StateMachine(new FileManager(workspace), workspace),
    });

    server.registerTool("sdd_get_status", {}, async (_input, extra) => {
      extraArg = extra;
      return {
      content: [{ type: "text", text: "ok" }],
      };
    });

    const result = await getHandler(server, "sdd_get_status")({ spec_dir: ".specs" }, { marker: "extra" });

    expect(result.content[0].text).toBe("ok");
    expect(extraArg).toEqual({ marker: "extra" });

    const entries = readAuditEntries(workspace);
    expect(entries).toHaveLength(2);
    expect(entries[0].summary).toBe("Execution started");
    expect(entries[1].summary).toBe("Execution completed");
    expect(entries[0].input_hash).toEqual(entries[1].input_hash);
    expect(entries[1].output_hash).toEqual(expect.any(String));
    expect(entries[1].previous_hash).toEqual(expect.any(String));
  });
});

describe("identity-based RBAC (authInfo from the HTTP token table)", () => {
  let workspace: string;
  let savedRole: string | undefined;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-tool-identity-"));
    savedRole = process.env["SDD_ROLE"];
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (savedRole === undefined) delete process.env["SDD_ROLE"];
    else process.env["SDD_ROLE"] = savedRole;
  });

  function installedServer(auditLogger?: AuditLogger): FakeServer {
    const server = new FakeServer();
    installToolEnforcement(server as unknown as McpServer, {
      auditLogger: auditLogger ?? new AuditLogger(workspace, true),
      rbacEngine: new RbacEngine(true, "contributor"),
      stateMachine: new StateMachine(new FileManager(workspace), workspace),
    });
    return server;
  }

  function viewerExtra(principal: string): Record<string, unknown> {
    return { authInfo: { token: "fp", clientId: principal, scopes: ["role:viewer"], extra: { principal, role: "viewer" } } };
  }

  it("authenticated token role wins over SDD_ROLE env", async () => {
    process.env["SDD_ROLE"] = "admin"; // a remote caller must not out-vote its token
    const server = installedServer();
    let executed = false;
    server.registerTool("sdd_write_spec", {}, async () => {
      executed = true;
      return { content: [{ type: "text", text: "ran" }] };
    });

    const result = await getHandler(server, "sdd_write_spec")(
      { spec_dir: ".specs" },
      viewerExtra("alice"),
    );
    const payload = JSON.parse(result.content[0].text) as {
      error: string;
      active_role: string;
      principal: string;
    };

    expect(executed).toBe(false);
    expect(payload.error).toBe("access_denied");
    expect(payload.active_role).toBe("viewer");
    expect(payload.principal).toBe("alice");
  });

  it("records the authenticated principal in audit entries", async () => {
    const server = installedServer();
    server.registerTool("sdd_get_status", {}, async () => ({
      content: [{ type: "text", text: "ok" }],
    }));

    await getHandler(server, "sdd_get_status")({ spec_dir: ".specs" }, viewerExtra("alice"));

    const entries = readAuditEntries(workspace);
    expect(entries).toHaveLength(2);
    expect(entries[0].principal).toBe("alice");
    expect(entries[0].role).toBe("viewer");
    expect(entries[1].principal).toBe("alice");
  });

  it("falls back to SDD_ROLE, then default_role, when unauthenticated (stdio)", async () => {
    process.env["SDD_ROLE"] = "viewer";
    const server = installedServer();
    let executed = false;
    server.registerTool("sdd_write_spec", {}, async () => {
      executed = true;
      return { content: [{ type: "text", text: "ran" }] };
    });

    const denied = await getHandler(server, "sdd_write_spec")({ spec_dir: ".specs" });
    expect(executed).toBe(false);
    expect((JSON.parse(denied.content[0].text) as { active_role: string }).active_role).toBe(
      "viewer",
    );
  });

  it("fail-closed audit refuses to execute when the start entry cannot be written", async () => {
    // Make `.specs` a regular FILE so the audit write fails.
    writeFileSync(join(workspace, ".specs"), "not a directory", "utf8");
    const server = installedServer(
      new AuditLogger(workspace, true, { failClosed: true }),
    );
    let executed = false;
    server.registerTool("sdd_get_status", {}, async () => {
      executed = true;
      return { content: [{ type: "text", text: "ok" }] };
    });

    const result = await getHandler(server, "sdd_get_status")({ spec_dir: ".specs" });
    const payload = JSON.parse(result.content[0].text) as { error: string };

    expect(executed).toBe(false);
    expect(result.isError).toBe(true);
    expect(payload.error).toBe("audit_unavailable");
  });
});
