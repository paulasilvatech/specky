/**
 * routing-tools.test.ts — MCP-level coverage for sdd_model_routing
 * (src/tools/routing.ts). The tool is stateless, so it is registered directly
 * on an in-memory MCP server without tool enforcement.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { ModelRoutingEngine } from "../../src/services/model-routing-engine.js";
import { registerRoutingTools } from "../../src/tools/routing.js";

interface RoutingRow {
  phase: string;
  model: string;
  mode: string;
  thinking: boolean;
  premium_multiplier: string;
  rationale: string;
  evidence_id: string;
  fallback_chain: string[];
}

async function buildHarness(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: "routing-test", version: "0.0.0" });
  registerRoutingTools(server, new ModelRoutingEngine());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "routing-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("sdd_model_routing MCP tool", () => {
  const closes: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
  });

  async function callModelRouting(client: Client, teamSize: number, requestsPerDay: number) {
    const response = await client.callTool({
      name: "sdd_model_routing",
      arguments: { team_size: teamSize, requests_per_day: requestsPerDay },
    });
    const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
    return {
      isError: response.isError === true,
      payload: JSON.parse(text) as Record<string, unknown>,
    };
  }

  it("returns the 10-phase routing table with model, mode, and thinking settings", async () => {
    const harness = await buildHarness();
    closes.push(harness.close);

    const result = await callModelRouting(harness.client, 5, 20);
    expect(result.isError).toBe(false);
    expect(result.payload["status"]).toBe("routing_table_returned");

    const table = result.payload["routing_table"] as RoutingRow[];
    expect(table.map((row) => row.phase)).toEqual([
      "init",
      "discover",
      "specify",
      "clarify",
      "design",
      "tasks",
      "analyze",
      "implement",
      "verify",
      "release",
    ]);

    const byPhase = Object.fromEntries(table.map((row) => [row.phase, row]));
    // Ambiguous, open-ended phases route to deep reasoning with thinking on.
    expect(byPhase["specify"]).toMatchObject({
      model: "claude-opus-4-7",
      mode: "ask",
      thinking: true,
      premium_multiplier: "3x",
    });
    expect(byPhase["analyze"]).toMatchObject({ model: "claude-opus-4-7", thinking: true });
    // Iterative phases with executable feedback loops avoid extended thinking.
    expect(byPhase["implement"]).toMatchObject({
      model: "claude-sonnet-4-6",
      mode: "agent",
      thinking: false,
      premium_multiplier: "1x",
    });
    // Structured bookend phases use the fast, cheap tier.
    expect(byPhase["init"]).toMatchObject({
      model: "claude-haiku-4-5",
      mode: "ask",
      thinking: false,
      premium_multiplier: "0.33x",
    });
    expect(byPhase["release"]).toMatchObject({
      model: "claude-haiku-4-5",
      premium_multiplier: "0.33x",
    });

    for (const row of table) {
      expect(row.fallback_chain.length).toBeGreaterThan(0);
      expect(row.evidence_id).toMatch(/^arXiv:/);
    }
  });

  it("computes cost savings that scale with team size and request volume", async () => {
    const harness = await buildHarness();
    closes.push(harness.close);

    const result = await callModelRouting(harness.client, 5, 20);
    // correct = round(5*20*(0.6*1 + 0.3*3 + 0.1*0.33)) = 153; opus-only = 5*20*3 = 300.
    expect(result.payload["cost_analysis"]).toEqual({
      team_size: 5,
      requests_per_day: 20,
      correct_routing_units: 153,
      opus_only_units: 300,
      savings_percent: 49,
      savings_label: "Correct routing saves ~49% of premium spend vs Opus-for-everything.",
    });
  });

  it("embeds a mermaid diagram chaining all pipeline phases", async () => {
    const harness = await buildHarness();
    closes.push(harness.close);

    const result = await callModelRouting(harness.client, 1, 1);
    const diagram = result.payload["diagram"] as string;
    expect(diagram).toContain("```mermaid");
    expect(diagram).toContain("graph TD");
    expect(diagram).toContain("init --> discover");
    expect(diagram).toContain("verify --> release");
    expect(diagram).toContain("claude-opus-4-7");
    // Thinking phases are flagged in the node labels.
    expect(diagram).toContain("+ thinking");
  });

  it("rejects out-of-range team sizes at the schema boundary", async () => {
    const harness = await buildHarness();
    closes.push(harness.close);

    const response = await harness.client.callTool({
      name: "sdd_model_routing",
      arguments: { team_size: 0, requests_per_day: 10 },
    });
    expect(response.isError).toBe(true);
    const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("Invalid arguments for tool sdd_model_routing");
    expect(text).toContain("team_size");
  });
});
