/**
 * audit-tools.test.ts — sdd_verify_audit MCP tool registration and handler.
 */
import { describe, expect, it, vi } from "vitest";
import type { AuditLogger } from "../../src/services/audit-logger.js";
import { registerAuditTools } from "../../src/tools/audit.js";

function createMockServer() {
  const registered = new Map<
    string,
    { handler: (args: { spec_dir: string }) => Promise<unknown> }
  >();
  return {
    registered,
    registerTool: vi.fn(
      (
        name: string,
        _schema: unknown,
        handler: (args: { spec_dir: string }) => Promise<unknown>,
      ) => {
        registered.set(name, { handler });
      },
    ),
  } as unknown as Parameters<typeof registerAuditTools>[0];
}

function createMockAuditLogger() {
  return {
    verifyChain: vi.fn(async (_specDir: string) => ({
      valid: true,
      entries: 5,
      current_hash: "abc123",
      hmac_checked: true,
      signed_entries: 5,
      mismatches: [],
    })),
  } as unknown as AuditLogger;
}

describe("registerAuditTools", () => {
  it("registers sdd_verify_audit on the server", () => {
    const server = createMockServer();
    const auditLogger = createMockAuditLogger();

    registerAuditTools(server, auditLogger);

    expect(server.registerTool).toHaveBeenCalledWith(
      "sdd_verify_audit",
      expect.objectContaining({ title: "Verify Audit Trail" }),
      expect.any(Function),
    );
  });

  it("returns verification JSON from the handler", async () => {
    const server = createMockServer();
    const auditLogger = createMockAuditLogger();
    registerAuditTools(server, auditLogger);

    const tool = (
      server as unknown as {
        registered: Map<
          string,
          {
            handler: (args: {
              spec_dir: string;
            }) => Promise<{ content: Array<{ type: string; text: string }> }>;
          }
        >;
      }
    ).registered.get("sdd_verify_audit");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ spec_dir: ".specs/001-api" });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.valid).toBe(true);
    expect(payload.entries).toBe(5);
    expect(auditLogger.verifyChain).toHaveBeenCalledWith(".specs/001-api");
  });
});
