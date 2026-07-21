/**
 * visualization-tools.test.ts — end-to-end coverage for the four MCP tools
 * registered by src/tools/visualization.ts:
 *   - sdd_generate_diagram        (single contracted Mermaid diagram)
 *   - sdd_generate_all_diagrams   (full contracted set -> DIAGRAMS.md)
 *   - sdd_generate_user_stories   (web-application story bindings + flows)
 *   - sdd_figma_diagram           (FigJam payload validation)
 *
 * The harness mirrors diagram-contracts.test.ts: a real MCP server over an
 * in-memory transport with tool enforcement installed, against a temp
 * workspace holding a canonical feature state.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { resolveUseCaseContract, type UseCaseSelection } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { registerVisualizationTools } from "../../src/tools/visualization.js";

const FEATURE_DIR = ".specs/001-app";

const DESIGN_MD = `# App Design

## System Context

The Order Client uses the Order API.

## Containers

The Web SPA calls the API Service, which persists to the session store.

## Request Flow

The Order Client submits an order and the Order API returns the created order.
`;

const SPEC_MD = `# App Specification

### REQ-UI-001: Browse products
When a shopper opens the catalog, the system shall list all in-stock products.

### REQ-UI-002: Checkout
When a shopper confirms the cart on the checkout page, the system shall process payment.
`;

const API_SELECTION: UseCaseSelection = {
  lifecycle: "greenfield",
  workload: "api",
  execution_mode: "full",
  capabilities: [],
  capability_config: {},
};

const WEB_SELECTION: UseCaseSelection = {
  ...API_SELECTION,
  workload: "web-application",
};

const FIGMA_SELECTION: UseCaseSelection = {
  ...WEB_SELECTION,
  capabilities: ["figma"],
  capability_config: {
    figma: {
      extraction_scope: "file",
      require_component_properties: true,
      diagram_types: ["architecture", "user_flow"],
    },
  },
};

/** The three diagrams the api workload contract requires (all sourced from DESIGN.md). */
const API_DIAGRAMS = [
  {
    diagram_type: "c4_context",
    mermaid_code:
      'C4Context\n  Person(client, "Order Client")\n  System(api, "Order API")\n  Rel(client, api, "uses")',
    evidence_refs: ["Order Client", "Order API"],
  },
  {
    diagram_type: "sequence",
    mermaid_code:
      "sequenceDiagram\n  participant Client\n  participant API\n  Client->>API: submits an order\n  API-->>Client: created order",
    evidence_refs: ["submits an order", "created order"],
  },
  {
    diagram_type: "er",
    mermaid_code: "erDiagram\n  ORDER {\n    string identifier\n    string status\n  }",
    evidence_refs: ["Order API"],
  },
];

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

interface HarnessOptions {
  selection: UseCaseSelection;
  files?: Record<string, string>;
}

async function buildHarness(workspace: string, options: HarnessOptions): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  for (const [fileName, content] of Object.entries(options.files ?? {})) {
    writeFileSync(join(workspace, FEATURE_DIR, fileName), content);
  }

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "app",
    feature: { number: "001", name: "app", directory: FEATURE_DIR },
    contract: resolveUseCaseContract(options.selection),
  });
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "visualization-tools-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerVisualizationTools(server, fileManager, stateMachine, new DiagramGenerator());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "visualization-tools-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    workspace,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

interface ToolOutcome {
  isError: boolean;
  raw: string;
}

/**
 * Call a tool and normalize the outcome. Schema-level rejections surface as a
 * thrown McpError; tool-level failures surface as isError results.
 */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  try {
    const response = await client.callTool({ name, arguments: args });
    const raw = (response.content as Array<{ text?: string }>)[0]?.text ?? "";
    return { isError: response.isError === true, raw };
  } catch (error) {
    return { isError: true, raw: error instanceof Error ? error.message : String(error) };
  }
}

const baseArgs = { spec_dir: ".specs", feature_number: "001" };

const workspaces: string[] = [];
const closes: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const close of closes.splice(0)) await close();
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

async function harness(options: HarnessOptions): Promise<Harness> {
  const workspace = mkdtempSync(join(tmpdir(), "specky-visualization-"));
  workspaces.push(workspace);
  const result = await buildHarness(workspace, options);
  closes.push(result.close);
  return result;
}

describe("sdd_generate_diagram", () => {
  it("validates a contracted C4 context diagram and echoes the payload", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      ...API_DIAGRAMS[0],
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"type": "c4_context"');
    expect(result.raw).toContain("API System Context");
    expect(result.raw).toContain('"contract_id": "greenfield-api-full"');
    // The caller-provided Mermaid code is preserved verbatim.
    expect(result.raw).toContain("C4Context");
    expect(result.raw).toContain("Order Client");
  });

  it("accepts the flowchart fallback header for c4_container (web-application workload)", async () => {
    const testHarness = await harness({
      selection: WEB_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      diagram_type: "c4_container",
      mermaid_code: "flowchart LR\n  spa[Web SPA] --> api[API Service]",
      evidence_refs: ["Web SPA", "API Service"],
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"type": "c4_container"');
    expect(result.raw).toContain("Web Container Architecture");
  });

  it("accepts an activity diagram grounded in the specification (spec source)", async () => {
    const testHarness = await harness({
      selection: WEB_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      diagram_type: "activity",
      mermaid_code: "flowchart TD\n  open[Open catalog] --> checkout[Checkout page]",
      evidence_refs: ["catalog", "checkout page"],
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"type": "activity"');
    expect(result.raw).toContain("User Journey");
  });

  it("rejects a diagram type the workload contract does not require", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      diagram_type: "gantt",
      mermaid_code: "gantt\n  title Plan\n  section S\n  Task: 2026-01-01, 1d",
      evidence_refs: ["Order API"],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Diagram gantt is not required by greenfield-api-full");
    expect(result.raw).toContain("c4_context, sequence, er");
  });

  it("rejects an incompatible Mermaid header for the contracted type", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      diagram_type: "sequence",
      mermaid_code: "flowchart TD\n  A[Order Client] --> B[Order API]",
      evidence_refs: ["Order Client", "Order API"],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Diagram sequence has an incompatible Mermaid header");
  });

  it("rejects evidence that is absent from the source artifact", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      diagram_type: "sequence",
      mermaid_code:
        "sequenceDiagram\n  participant Client\n  participant API\n  Client->>API: submits an order",
      evidence_refs: ["submits an order", "fabricated billing provider"],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("evidence is absent from its source: fabricated billing provider");
  });

  it("fails when the required source artifact does not exist", async () => {
    const testHarness = await harness({ selection: API_SELECTION, files: {} });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      ...API_DIAGRAMS[0],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain(`DESIGN.md is required as diagram evidence in ${FEATURE_DIR}`);
  });
});

/** DESIGN.md rich enough to auto-ground c4_context, sequence, and er. */
const AUTO_DESIGN_MD = `# App Design

## System Context
The Order Client uses the Order API.

## API
- GET /api/orders lists orders
- POST /api/orders creates an order

## Data Model
The Order entity has id and status.

## Infrastructure
Deploy with Docker containers.
`;

describe("sdd_generate_diagram (auto mode)", () => {
  it("synthesizes a c4_context diagram from design content", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": AUTO_DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      mode: "auto",
      diagram_type: "c4_context",
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"generation_mode": "auto"');
    expect(result.raw).toContain("C4Context");
    expect(result.raw).toContain("System Context");
  });

  it("rejects auto mode when mermaid_code is supplied (mixed input)", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": AUTO_DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      mode: "auto",
      diagram_type: "c4_context",
      mermaid_code: 'C4Context\n  Person(a, "A")',
      evidence_refs: ["Order Client"],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("mermaid_code must be omitted in auto mode");
  });

  it("rejects auto mode for a diagram type that cannot be synthesized", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": AUTO_DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      mode: "auto",
      diagram_type: "gantt",
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("auto mode supports only");
  });

  it("fails cleanly when the design lacks evidence for the diagram", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_diagram", {
      ...baseArgs,
      mode: "auto",
      diagram_type: "sequence",
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Cannot synthesize sequence diagram");
  });
});

describe("sdd_generate_all_diagrams (auto mode)", () => {
  it("synthesizes and writes the full contracted set from content", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": AUTO_DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      mode: "auto",
      force: true,
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"generation_mode": "auto"');
    expect(result.raw).toContain('"total_generated": 3');

    const diagramsPath = join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md");
    expect(existsSync(diagramsPath)).toBe(true);
    const written = readFileSync(diagramsPath, "utf8");
    expect(written).toContain("C4Context");
    expect(written).toContain("sequenceDiagram");
    expect(written).toContain("erDiagram");
  });

  it("rejects auto mode when a diagrams payload is supplied", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": AUTO_DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      mode: "auto",
      force: true,
      diagrams: API_DIAGRAMS,
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("diagrams must be omitted in auto mode");
  });

  it("writes nothing when one diagram in the set cannot be grounded", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      mode: "auto",
      force: true,
    });
    expect(result.isError).toBe(true);
    const diagramsPath = join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md");
    expect(existsSync(diagramsPath)).toBe(false);
  });
});

describe("sdd_generate_all_diagrams", () => {
  it("writes DIAGRAMS.md with every contracted Mermaid block", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [...API_DIAGRAMS],
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"total_generated": 3');

    const diagramsPath = join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md");
    expect(existsSync(diagramsPath)).toBe(true);
    const written = readFileSync(diagramsPath, "utf-8");
    expect(written).toContain("# app — Required Diagrams");
    expect(written).toContain("## API System Context");
    expect(written).toContain("## API Request Sequence");
    expect(written).toContain("## API Data Model");
    // Mermaid code is embedded verbatim inside fenced blocks.
    expect(written).toContain("```mermaid\nsequenceDiagram\n  participant Client");
    expect(written).toContain("```mermaid\nerDiagram");
    expect(written).toContain("**Evidence:** submits an order, created order");
  });

  it("refuses to overwrite DIAGRAMS.md without force and overwrites with force", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const first = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [...API_DIAGRAMS],
    });
    expect(first.isError, first.raw).toBe(false);

    const second = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [...API_DIAGRAMS],
    });
    expect(second.isError).toBe(true);
    expect(second.raw).toContain("Use force: true to overwrite");

    const third = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: true,
      diagrams: [...API_DIAGRAMS],
    });
    expect(third.isError, third.raw).toBe(false);
    expect(third.raw).toContain('"total_generated": 3');
  });

  it("rejects an empty diagram set at the schema boundary", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [],
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });

  it("rejects an invalid diagram type at the schema boundary", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [
        {
          diagram_type: "histogram",
          mermaid_code: "flowchart TD\nA --> B",
          evidence_refs: ["Order API"],
        },
      ],
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });

  it("rejects a partial diagram set naming every missing and extra type", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_all_diagrams", {
      ...baseArgs,
      force: false,
      diagrams: [
        API_DIAGRAMS[0],
        {
          diagram_type: "flowchart",
          mermaid_code: "flowchart TD\n  A[Order Client] --> B[Order API]",
          evidence_refs: ["Order Client"],
        },
      ],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("Missing: sequence, er");
    expect(result.raw).toContain("Extra: flowchart");
    expect(existsSync(join(testHarness.workspace, FEATURE_DIR, "DIAGRAMS.md"))).toBe(false);
  });
});

describe("sdd_generate_user_stories", () => {
  const STORY_BINDINGS = [
    {
      requirement_id: "REQ-UI-001",
      role: "shopper",
      goal: "browse the product catalog",
      benefit: "I can find items to buy",
      priority: "P1",
      acceptance_criteria: ["Catalog lists every in-stock product"],
      independent_test: "Open the catalog and verify in-stock products render",
      flow_steps: ["Open the catalog", "View the product list"],
    },
    {
      requirement_id: "REQ-UI-002",
      role: "shopper",
      goal: "complete checkout",
      benefit: "I can purchase the cart contents",
      priority: "P2",
      acceptance_criteria: ["Payment is processed for confirmed carts"],
      independent_test: "Confirm a cart and verify the payment succeeds",
      flow_steps: ["Review the cart", "Confirm checkout", "Receive confirmation"],
    },
  ];

  it("assembles one explicit story binding per specification requirement", async () => {
    const testHarness = await harness({
      selection: WEB_SELECTION,
      files: { "SPECIFICATION.md": SPEC_MD, "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_user_stories", {
      ...baseArgs,
      stories: STORY_BINDINGS,
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"total_count": 2');
    expect(result.raw).toContain(
      "As shopper, I want browse the product catalog so that I can find items to buy.",
    );
    // Each story carries an assembled Mermaid flowchart, as does the overview diagram.
    expect(result.raw).toContain("flowchart TD");
    expect(result.raw).toContain("S1 --> S2");
    expect(result.raw).toContain("Assembled 2 explicit story bindings for 2 requirements.");
  });

  it("rejects workloads other than web-application", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_user_stories", {
      ...baseArgs,
      stories: STORY_BINDINGS,
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain(
      "sdd_generate_user_stories requires workload web-application; received api",
    );
  });

  it("rejects bindings that miss a requirement or reference an unknown one", async () => {
    const testHarness = await harness({
      selection: WEB_SELECTION,
      files: { "SPECIFICATION.md": SPEC_MD, "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_generate_user_stories", {
      ...baseArgs,
      stories: [STORY_BINDINGS[0], { ...STORY_BINDINGS[1], requirement_id: "REQ-UI-999" }],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("User-story bindings mismatch");
    expect(result.raw).toContain("Missing: REQ-UI-002");
    expect(result.raw).toContain("Unknown: REQ-UI-999");
  });
});

describe("sdd_figma_diagram", () => {
  const FIGJAM_INPUT = {
    diagram_type: "architecture",
    nodes: [
      { id: "spa", label: "Web SPA", type: "component" },
      { id: "api", label: "API Service", type: "service" },
    ],
    connections: [{ from: "spa", to: "api", label: "calls" }],
    evidence_refs: ["Web SPA", "API Service"],
  };

  it("returns a validated FigJam payload with routing instructions", async () => {
    const testHarness = await harness({
      selection: FIGMA_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_figma_diagram", {
      ...baseArgs,
      ...FIGJAM_INPUT,
    });
    expect(result.isError, result.raw).toBe(false);
    expect(result.raw).toContain('"figjam_structure"');
    expect(result.raw).toContain('"routing_instructions"');
    expect(result.raw).toContain("Figma MCP generate_diagram");
    expect(result.raw).toContain('"diagram_type": "architecture"');
    expect(result.raw).toContain("app — architecture");
  });

  it("rejects a FigJam type not enabled by the capability config", async () => {
    const testHarness = await harness({
      selection: FIGMA_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_figma_diagram", {
      ...baseArgs,
      ...FIGJAM_INPUT,
      diagram_type: "data_flow",
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain(
      "FigJam diagram data_flow is not enabled by greenfield-web-application-full",
    );
    expect(result.raw).toContain("architecture, user_flow");
  });

  it("rejects connections whose endpoints are not declared nodes", async () => {
    const testHarness = await harness({
      selection: FIGMA_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_figma_diagram", {
      ...baseArgs,
      ...FIGJAM_INPUT,
      connections: [{ from: "spa", to: "ghost", label: "calls" }],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain(
      "Every FigJam connection endpoint must reference a declared node ID",
    );
  });

  it("rejects evidence that is absent from DESIGN.md", async () => {
    const testHarness = await harness({
      selection: FIGMA_SELECTION,
      files: { "DESIGN.md": DESIGN_MD, "SPECIFICATION.md": SPEC_MD },
    });
    const result = await call(testHarness.client, "sdd_figma_diagram", {
      ...baseArgs,
      ...FIGJAM_INPUT,
      evidence_refs: ["Web SPA", "fabricated edge cache"],
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("FigJam evidence is absent from DESIGN.md: fabricated edge cache");
  });

  it("denies the tool when the figma capability is not part of the contract", async () => {
    const testHarness = await harness({
      selection: API_SELECTION,
      files: { "DESIGN.md": DESIGN_MD },
    });
    const result = await call(testHarness.client, "sdd_figma_diagram", {
      ...baseArgs,
      ...FIGJAM_INPUT,
    });
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("capability_disabled");
    expect(result.raw).toContain("requires capability figma");
  });
});
