/**
 * User-story titles must come from EARS prose, not the "(event_driven)" heading suffix.
 */
import { mkdirSync, mkdtempSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { registerVisualizationTools } from "../../src/tools/visualization.js";

const REPO = resolve(import.meta.dirname, "../..");
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";

describe("sdd_generate_user_stories titles", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const workspaces: string[] = [];

  afterEach(async () => {
    for (const close of cleanups.splice(0)) await close();
    for (const ws of workspaces.splice(0)) rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("does not use (event_driven) as the user-story title", async () => {
    const ws = mkdtempSync(join(tmpdir(), "specky-stories-"));
    workspaces.push(ws);
    cpSync(TEMPLATES_SRC, join(ws, CUSTOM_TEMPLATES), { recursive: true });
    mkdirSync(join(ws, ".specs/001-checkout"), { recursive: true });
    writeFileSync(
      join(ws, ".specs/001-checkout/SPECIFICATION.md"),
      [
        "# Spec",
        "",
        "### REQ-CORE-001: (event_driven)",
        "",
        "When a customer submits the payment form, the system shall validate the card input.",
        "",
      ].join("\n"),
      "utf8",
    );

    const fileManager = new FileManager(ws);
    const stateMachine = new StateMachine(fileManager, ws);
    const diagramGenerator = new DiagramGenerator();
    const server = new McpServer({ name: "specky-test", version: "0.0.0" });
    registerVisualizationTools(server, fileManager, stateMachine, diagramGenerator);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "stories", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    cleanups.push(async () => {
      await client.close();
      await server.close();
    });

    const raw = await client.callTool({
      name: "sdd_generate_user_stories",
      arguments: { feature_number: "001", spec_dir: ".specs", max_stories: 5 },
    });
    const text = (raw.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("");
    const payload = JSON.parse(text) as {
      stories?: Array<{ title?: string; as_a?: string; i_want?: string }>;
      user_stories?: Array<{ title?: string }>;
    };
    const stories = payload.stories ?? payload.user_stories ?? [];
    expect(stories.length).toBeGreaterThan(0);
    const titles = stories.map((s) => s.title ?? "").join(" | ");
    expect(titles).not.toMatch(/\(event_driven\)/);
    expect(titles.toLowerCase()).toMatch(/payment|card|validate|customer/);
  });
});
