import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    troubleshooting: [{ symptom: "API unavailable", cause: "Dependency outage", resolution: "Restore the dependency route" }],
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

    const server = new McpServer({ name: "documentation-test", version: "0.0.0" });
    installToolEnforcement(server, {
        auditLogger: new AuditLogger(workspace, false),
        rbacEngine: new RbacEngine(false, "contributor"),
        stateMachine,
        contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
    });
    registerDocumentationTools(server, fileManager, stateMachine, new DocGenerator(fileManager, stateMachine));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "documentation-test", version: "0.0.0" });
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

describe("contracted documentation MCP tools", () => {
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

    it("writes an enabled documentation type from the persisted release contract", async () => {
        const harness = await buildHarness(workspace("specky-doc-tool-single-"), BASE_DOCUMENTATION);
        closes.push(harness.close);
        const result = await callTool(harness.client, "sdd_generate_docs", false);
        expect(result.isError).toBe(false);
        expect(result.payload).toMatchObject({
            status: "full_documentation_generated",
            documentation_version: "3.0.0",
            contract_id: "greenfield-api-full",
        });
        expect(readFileSync(join(harness.workspace, "docs/001-api.md"), "utf8")).toContain("REQ-API-001");
    });

    it("rejects an individual documentation type not enabled by the release contract", async () => {
        const documentation = { ...BASE_DOCUMENTATION, types: ["runbook"] as DocumentationConfig["types"] };
        const harness = await buildHarness(workspace("specky-doc-tool-disabled-"), documentation);
        closes.push(harness.close);
        const result = await callTool(harness.client, "sdd_generate_docs", false);
        expect(result.isError).toBe(true);
        expect(result.raw).toContain("Documentation type full is not enabled");
        expect(existsSync(join(harness.workspace, "docs/001-api.md"))).toBe(false);
    });

    it("does not write any batch document when one enabled generator lacks evidence", async () => {
        const documentation = { ...BASE_DOCUMENTATION, types: ["full", "api"] as DocumentationConfig["types"] };
        const designWithoutApi = COMPLETE_DESIGN.replace(/## API Contracts[\s\S]*?(?=## Infrastructure)/, "");
        const harness = await buildHarness(
            workspace("specky-doc-tool-generation-failure-"),
            documentation,
            designWithoutApi,
        );
        closes.push(harness.close);
        const result = await callTool(harness.client, "sdd_generate_all_docs", false);
        expect(result.isError).toBe(true);
        expect(existsSync(join(harness.workspace, "docs/001-api.md"))).toBe(false);
        expect(existsSync(join(harness.workspace, "docs/api-001.md"))).toBe(false);
    });

    it("preflights all output conflicts before an atomic batch write", async () => {
        const documentation = { ...BASE_DOCUMENTATION, types: ["full", "runbook"] as DocumentationConfig["types"] };
        const harness = await buildHarness(workspace("specky-doc-tool-write-conflict-"), documentation);
        closes.push(harness.close);
        mkdirSync(join(harness.workspace, "docs"), { recursive: true });
        writeFileSync(join(harness.workspace, "docs/001-api.md"), "existing reviewed doc\n");

        const result = await callTool(harness.client, "sdd_generate_all_docs", false);
        expect(result.isError).toBe(true);
        expect(readFileSync(join(harness.workspace, "docs/001-api.md"), "utf8")).toBe("existing reviewed doc\n");
        expect(existsSync(join(harness.workspace, "docs/runbook-001.md"))).toBe(false);
    });
});
