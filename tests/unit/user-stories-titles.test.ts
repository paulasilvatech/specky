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
import { AuditLogger } from "../../src/services/audit-logger.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";

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
    writeFileSync(
      join(ws, ".specs/001-checkout/DESIGN.md"),
      "# Design\n\n## UI State Model\nCheckout form states.\n\n## Web Container Architecture\nBrowser and API containers.\n",
      "utf8",
    );

    const fileManager = new FileManager(ws);
    const stateMachine = new StateMachine(fileManager, ws);
    const stateDir = ".specs/001-checkout";
    const state = stateMachine.createFeatureState({
      projectName: "checkout",
      feature: { number: "001", name: "checkout", directory: stateDir },
      contract: resolveUseCaseContract({
        lifecycle: "greenfield",
        workload: "web-application",
        execution_mode: "full",
        capabilities: [],
        capability_config: {},
      }),
    });
    await stateMachine.saveState(stateDir, state);
    const diagramGenerator = new DiagramGenerator();
    const server = new McpServer({ name: "specky-test", version: "0.0.0" });
    installToolEnforcement(server, {
      auditLogger: new AuditLogger(ws, false),
      rbacEngine: new RbacEngine(false, "contributor"),
      stateMachine,
      contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
    });
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
      arguments: {
        feature_number: "001",
        spec_dir: ".specs",
        stories: [{
          requirement_id: "REQ-CORE-001",
          role: "a checkout customer",
          goal: "validate card input before payment",
          benefit: "invalid payment details are corrected before submission",
          priority: "P1",
          acceptance_criteria: ["Invalid card input is rejected with a field-specific message"],
          independent_test: "Submit invalid card data and verify the field-specific validation result.",
          flow_steps: ["Enter card details", "Validate fields", "Show validation result"],
        }],
      },
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

    const grounded = await client.callTool({
      name: "sdd_generate_diagram",
      arguments: {
        feature_number: "001",
        spec_dir: ".specs",
        diagram_type: "activity",
        mermaid_code: "flowchart LR\nSubmit[Submit payment] --> Validate[Validate card input]",
        evidence_refs: ["REQ-CORE-001"],
      },
    });
    expect(grounded.isError).not.toBe(true);

    const irrelevant = await client.callTool({
      name: "sdd_generate_diagram",
      arguments: {
        feature_number: "001",
        spec_dir: ".specs",
        diagram_type: "er",
        mermaid_code: "erDiagram\nCARD ||--o{ PAYMENT : funds",
        evidence_refs: ["REQ-CORE-001"],
      },
    });
    expect(String((irrelevant.content as Array<{ text?: string }>)[0]?.text)).toContain(
      "is not required by greenfield-web-application-full",
    );
  });
});
