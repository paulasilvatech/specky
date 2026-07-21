import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import type { DocumentationConfig } from "../../src/contracts/use-case.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { DocGenerator } from "../../src/services/doc-generator.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerDocumentationTools } from "../../src/tools/documentation.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";

const FEATURE_DIR = ".specs/001-api";

const BASE_DOCUMENTATION: DocumentationConfig = {
  types: ["full", "api", "runbook", "onboarding"],
  version: "3.0.0",
  api_base_url: "https://api.example.test",
  deployment_steps: ["Deploy the reviewed image digest."],
  health_checks: ["GET /health returns the dependency status."],
  monitoring_checks: ["Alert on contracted latency and error thresholds."],
  troubleshooting: [
    {
      symptom: "API unavailable",
      cause: "Dependency outage",
      resolution: "Restore the dependency route",
    },
  ],
  rollback_steps: ["Restore the prior reviewed image digest."],
  support_contacts: ["API on-call: api@example.test"],
  onboarding_steps: ["Run the requirement-bound tests."],
};

const SPEC = `### REQ-API-001: Create item

When a client submits an item, the system shall persist and return it.

**Acceptance Criteria:**
- POST /items returns 201
`;

const COMPLETE_DESIGN = `## System Context

A named client calls the API.

## Container Architecture

An API container owns requests.

## Component Design

ItemService owns item behavior.

## Code-Level Design

Typed interfaces expose item operations.

## Data Model

Item has id and name.

## API Contracts

### POST /items

Create an item.

**Request:**
\`\`\`json
{ "name": "string" }
\`\`\`

**Response:**
\`\`\`json
{ "id": 1, "name": "string" }
\`\`\`

## Infrastructure & Deployment

The API runs as a reviewed container image.

## Security Architecture

OAuth scopes authorize requests.

## Architecture Decision Records

### ADR-001: Use relational storage

Relational storage owns item state.

## Workload-Specific Design Contract

Versioning and errors are explicit.
`;

const TASKS = `| T-001 | Implement POST /items | No | M | — | REQ-API-001 |\n`;
const ANALYSIS = "Decision: APPROVE\n";

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  documentation: DocumentationConfig,
  design = COMPLETE_DESIGN,
): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), SPEC);
  writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), design);
  writeFileSync(join(workspace, FEATURE_DIR, "TASKS.md"), TASKS);
  writeFileSync(join(workspace, FEATURE_DIR, "ANALYSIS.md"), ANALYSIS);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: ["release"],
      capability_config: {
        release: {
          branch_prefix: "spec/",
          base_branch: "develop",
          draft_pr: false,
          checkpoints: true,
          documentation,
        },
      },
    }),
  });
  state.current_phase = Phase.Verify;
  state.gate_decision = {
    decision: "APPROVE",
    reasons: ["Fixture evidence is complete"],
    coverage_percent: 100,
    gaps: [],
    decided_at: "2026-07-15T00:00:00.000Z",
  };
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "documentation-extended-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerDocumentationTools(
    server,
    fileManager,
    stateMachine,
    new DocGenerator(fileManager, stateMachine),
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "documentation-extended-test", version: "0.0.0" });
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

async function callTool(client: Client, name: string, force: boolean) {
  const response = await client.callTool({
    name,
    arguments: { spec_dir: ".specs", feature_number: "001", force },
  });
  const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }
  return {
    isError: response.isError === true,
    payload,
    raw: text,
  };
}

describe("documentation MCP tools — single-type generators", () => {
  const workspaces: string[] = [];
  const closes: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const close of closes.splice(0)) await close();
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  function workspace(prefix: string): string {
    const path = mkdtempSync(join(tmpdir(), prefix));
    workspaces.push(path);
    return path;
  }

  it("writes API documentation from the DESIGN.md endpoint contracts", async () => {
    const harness = await buildHarness(workspace("specky-docx-api-"), BASE_DOCUMENTATION);
    closes.push(harness.close);
    const result = await callTool(harness.client, "sdd_generate_api_docs", false);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "api_documentation_generated",
      type: "api",
      documentation_version: "3.0.0",
      contract_id: "greenfield-api-full",
      sections: ["POST /items"],
    });
    const written = readFileSync(join(harness.workspace, "docs/api-001.md"), "utf8");
    expect(written).toContain("# API Documentation: api");
    expect(written).toContain("**Base URL**: `https://api.example.test`");
    expect(written).toContain("## POST /items");
    expect(written).toContain('{ "name": "string" }');
  });

  it("rejects API documentation when DESIGN.md has no structured contract blocks", async () => {
    const designWithoutApi = COMPLETE_DESIGN.replace(
      /## API Contracts[\s\S]*?(?=## Infrastructure)/,
      "",
    );
    const harness = await buildHarness(
      workspace("specky-docx-api-missing-"),
      BASE_DOCUMENTATION,
      designWithoutApi,
    );
    closes.push(harness.close);
    const result = await callTool(harness.client, "sdd_generate_api_docs", false);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("DESIGN.md contains no structured API contract blocks.");
  });

  it("writes the operational runbook from release documentation parameters", async () => {
    const harness = await buildHarness(workspace("specky-docx-runbook-"), BASE_DOCUMENTATION);
    closes.push(harness.close);
    const result = await callTool(harness.client, "sdd_generate_runbook", false);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "runbook_documentation_generated",
      type: "runbook",
      sections: [
        "Design Evidence",
        "Deployment",
        "Health Checks",
        "Monitoring",
        "Troubleshooting",
        "Rollback",
        "Support Contacts",
      ],
    });
    const written = readFileSync(join(harness.workspace, "docs/runbook-001.md"), "utf8");
    expect(written).toContain("# Operational Runbook: api");
    expect(written).toContain("1. Deploy the reviewed image digest.");
    expect(written).toContain("- GET /health returns the dependency status.");
    expect(written).toContain(
      "| API unavailable | Dependency outage | Restore the dependency route |",
    );
    expect(written).toContain("1. Restore the prior reviewed image digest.");
    expect(written).toContain("- API on-call: api@example.test");
  });

  it("refuses to overwrite an existing runbook without force", async () => {
    const harness = await buildHarness(
      workspace("specky-docx-runbook-conflict-"),
      BASE_DOCUMENTATION,
    );
    closes.push(harness.close);
    mkdirSync(join(harness.workspace, "docs"), { recursive: true });
    writeFileSync(join(harness.workspace, "docs/runbook-001.md"), "reviewed runbook\n");
    const result = await callTool(harness.client, "sdd_generate_runbook", false);
    expect(result.isError).toBe(true);
    expect(result.raw).toContain("File already exists");
    expect(readFileSync(join(harness.workspace, "docs/runbook-001.md"), "utf8")).toBe(
      "reviewed runbook\n",
    );
  });

  it("writes developer onboarding from the feature contract and release steps", async () => {
    const harness = await buildHarness(workspace("specky-docx-onboarding-"), BASE_DOCUMENTATION);
    closes.push(harness.close);
    const result = await callTool(harness.client, "sdd_generate_onboarding", false);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "onboarding_documentation_generated",
      type: "onboarding",
      sections: [
        "Feature Contract",
        "Architecture Evidence",
        "Getting Started",
        "Traced Tasks",
        "Support Contacts",
      ],
    });
    const written = readFileSync(join(harness.workspace, "docs/onboarding-001.md"), "utf8");
    expect(written).toContain("# Developer Onboarding: api");
    expect(written).toContain("REQ-API-001");
    expect(written).toContain("1. Run the requirement-bound tests.");
    expect(written).toContain("- T-001");
  });

  it("writes every contracted documentation type atomically, including the journey", async () => {
    const documentation: DocumentationConfig = {
      ...BASE_DOCUMENTATION,
      types: ["full", "api", "runbook", "onboarding", "journey"],
    };
    const harness = await buildHarness(workspace("specky-docx-all-"), documentation);
    closes.push(harness.close);
    const result = await callTool(harness.client, "sdd_generate_all_docs", false);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      status: "all_contracted_documentation_generated",
      contract_id: "greenfield-api-full",
      documentation_version: "3.0.0",
      total_generated: 5,
    });
    expect(typeof result.payload["total_sections"]).toBe("number");
    const files = result.payload["files"] as Array<Record<string, unknown>>;
    expect(files.map((file) => file["type"])).toEqual([
      "full",
      "api",
      "runbook",
      "onboarding",
      "journey",
    ]);
    for (const file of files) {
      expect(String(file["path"])).toContain(join(harness.workspace, "docs"));
      expect(Array.isArray(file["sections"])).toBe(true);
    }
    const journey = readFileSync(join(harness.workspace, "docs/journey-001.md"), "utf8");
    expect(journey).toContain("## Analysis Gate");
    expect(journey).toContain("- Decision: APPROVE");
    expect(journey).toContain("- Use relational storage");
    expect(journey).toContain("- Requirements: 1 (REQ-API-001)");
    expect(journey).toContain("- Tasks: 1 (T-001)");
  });
});
