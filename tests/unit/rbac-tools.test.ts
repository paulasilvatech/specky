/**
 * rbac-tools.test.ts — MCP-level coverage for sdd_check_access
 * (src/tools/rbac.ts). The tool is stateless, so it is registered directly on
 * an in-memory MCP server. Role precedence under test:
 * role_override > authenticated token role > SDD_ROLE env > config default.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { RbacEngine, type RbacRole } from "../../src/services/rbac-engine.js";
import { registerRbacTools } from "../../src/tools/rbac.js";

async function buildHarness(
  enabled: boolean,
  defaultRole: RbacRole,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: "rbac-test", version: "0.0.0" });
  registerRbacTools(server, new RbacEngine(enabled, defaultRole));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "rbac-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function callCheckAccess(client: Client, args: Record<string, unknown> = {}) {
  const response = await client.callTool({ name: "sdd_check_access", arguments: args });
  const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
  return {
    isError: response.isError === true,
    payload: JSON.parse(text) as Record<string, unknown>,
    raw: text,
  };
}

describe("sdd_check_access MCP tool", () => {
  const closes: Array<() => Promise<void>> = [];
  const originalSddRole = process.env["SDD_ROLE"];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
    if (originalSddRole === undefined) delete process.env["SDD_ROLE"];
    else process.env["SDD_ROLE"] = originalSddRole;
  });

  it("denies the release gate for viewer role_override and explains why", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(true, "admin");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client, {
      role_override: "viewer",
      tool_name: "sdd_create_pr",
    });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      rbac_enabled: true,
      active_role: "viewer",
      default_role: "admin",
      role_source: "role_override parameter",
    });
    expect(result.payload["tool_check"]).toMatchObject({ tool: "sdd_create_pr", allowed: false });
    expect((result.payload["tool_check"] as Record<string, unknown>)["reason"]).toContain(
      "admin role",
    );
  });

  it("allows the release gate for admin role_override", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(true, "viewer");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client, {
      role_override: "admin",
      tool_name: "sdd_create_pr",
    });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({ active_role: "admin", default_role: "viewer" });
    expect(result.payload["tool_check"]).toEqual({ tool: "sdd_create_pr", allowed: true });
  });

  it("falls back to the configured default role when no override or env is set", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(true, "contributor");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client, { tool_name: "sdd_write_spec" });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      active_role: "contributor",
      role_source: "config default_role",
    });
    expect(result.payload["tool_check"]).toEqual({ tool: "sdd_write_spec", allowed: true });
    // No authenticated principal over stdio, so the field stays absent.
    expect("principal" in result.payload).toBe(false);
  });

  it("prefers the SDD_ROLE environment variable over the configured default", async () => {
    process.env["SDD_ROLE"] = "viewer";
    const harness = await buildHarness(true, "admin");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client, { tool_name: "sdd_metrics" });
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      active_role: "viewer",
      role_source: "SDD_ROLE environment variable",
    });
    expect(result.payload["tool_check"]).toEqual({ tool: "sdd_metrics", allowed: true });
  });

  it("omits tool_check when no tool_name is requested and summarizes all roles", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(true, "viewer");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client);
    expect(result.isError).toBe(false);
    expect("tool_check" in result.payload).toBe(false);

    const summary = result.payload["role_summary"] as Record<string, Record<string, unknown>>;
    expect(summary["viewer"]?.["allowed_tools"]).toEqual(
      expect.arrayContaining(["sdd_get_status", "sdd_model_routing", "sdd_verify_audit"]),
    );
    expect(summary["contributor"]?.["blocked_tools"]).toEqual(["sdd_create_pr"]);
    expect(summary["admin"]?.["blocked_tools"]).toEqual([]);
  });

  it("reports that a disabled engine permits every tool", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(false, "contributor");
    closes.push(harness.close);

    const result = await callCheckAccess(harness.client, {
      role_override: "viewer",
      tool_name: "sdd_create_pr",
    });
    expect(result.isError).toBe(false);
    expect(result.payload["rbac_enabled"]).toBe(false);
    expect(result.payload["tool_check"]).toEqual({ tool: "sdd_create_pr", allowed: true });
    expect(result.payload["next_steps"]).toContain("RBAC is disabled");
  });

  it("rejects an unknown role_override at the schema boundary", async () => {
    delete process.env["SDD_ROLE"];
    const harness = await buildHarness(true, "admin");
    closes.push(harness.close);

    const response = await harness.client.callTool({
      name: "sdd_check_access",
      arguments: { role_override: "superuser" },
    });
    expect(response.isError).toBe(true);
    const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("Invalid arguments for tool sdd_check_access");
  });
});
