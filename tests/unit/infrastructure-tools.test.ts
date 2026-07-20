import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { type CapabilityConfig, resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { FileManager } from "../../src/services/file-manager.js";
import { IacGenerator } from "../../src/services/iac-generator.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { registerInfrastructureTools } from "../../src/tools/infrastructure.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import type { GateDecision } from "../../src/types.js";

const FEATURE_DIR = ".specs/001-api";

const APPROVE_GATE: GateDecision = {
  decision: "APPROVE",
  reasons: ["Fixture evidence is complete"],
  coverage_percent: 100,
  gaps: [],
  decided_at: "2026-07-15T00:00:00.000Z",
};

const DESIGN = `## System Context

A named client calls the API.

## Infrastructure & Deployment

The API runs as a reviewed container image on TypeScript and Express.
`;

const CAPABILITY_CONFIG: CapabilityConfig = {
  iac: {
    provider: "terraform",
    cloud: "azure",
    resources: [
      { module: "networking", service: "network" },
      { module: "database", service: "postgres" },
    ],
    state_backend: "azurerm",
    region_policy: "eastus2",
  },
  "dev-environment": {
    language: "TypeScript",
    framework: "Express",
    runtime: "node22",
    package_manager: "npm",
    port: 3000,
    services: ["postgres"],
    codespaces_machine: "basicLinux32gb",
    extensions: ["dbaeumer.vscode-eslint"],
    base_image: "mcr.microsoft.com/devcontainers/typescript-node:22",
    features: [],
    include_compose: true,
    multi_stage: true,
  },
};

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

interface HarnessOptions {
  phase?: Phase;
  gate?: GateDecision | null;
  design?: string;
}

async function buildHarness(workspace: string, options: HarnessOptions = {}): Promise<Harness> {
  mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
  if (options.design !== undefined)
    writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), options.design);

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const state = stateMachine.createFeatureState({
    projectName: "api",
    feature: { number: "001", name: "api", directory: FEATURE_DIR },
    contract: resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "api",
      execution_mode: "full",
      capabilities: ["dev-environment", "iac"],
      capability_config: CAPABILITY_CONFIG,
    }),
  });
  const phase = options.phase ?? Phase.Analyze;
  state.current_phase = phase;
  state.phases[phase] = { status: "in_progress", started_at: "2026-07-15T00:00:00.000Z" };
  state.gate_decision = options.gate === undefined ? APPROVE_GATE : options.gate;
  await stateMachine.saveState(FEATURE_DIR, state);

  const server = new McpServer({ name: "infrastructure-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerInfrastructureTools(server, fileManager, stateMachine, new IacGenerator(fileManager));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "infrastructure-test", version: "0.0.0" });
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

async function callTool(client: Client, name: string) {
  const response = await client.callTool({
    name,
    arguments: { spec_dir: ".specs", feature_number: "001" },
  });
  const text = (response.content as Array<{ text?: string }>)[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }
  return { isError: response.isError === true, payload, raw: text };
}

describe("infrastructure MCP tools", () => {
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

  describe("sdd_generate_iac", () => {
    it("generates Terraform for the contracted Azure resources and writes the files", async () => {
      const ws = workspace("specky-infra-iac-");
      const harness = await buildHarness(ws, { design: DESIGN });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_iac");
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        provider: "terraform",
        cloud: "azure",
        state_backend: "azurerm",
        region_policy: "eastus2",
      });
      expect(result.payload["contract_resources"]).toEqual([
        { module: "networking", service: "network" },
        { module: "database", service: "postgres" },
      ]);
      const files = result.payload["files"] as Array<Record<string, unknown>>;
      expect(files.map((file) => file["path"])).toEqual([
        "terraform/main.tf",
        "terraform/variables.tf",
        "terraform/outputs.tf",
        "terraform/terraform.tfvars.example",
      ]);
      const writtenPaths = result.payload["written_paths"] as string[];
      expect(writtenPaths).toHaveLength(4);
      const mainTf = readFileSync(join(ws, FEATURE_DIR, "terraform/main.tf"), "utf8");
      expect(mainTf).toContain('provider "azurerm"');
      expect(mainTf).toContain('resource "azurerm_virtual_network" "network"');
      expect(mainTf).toContain('resource "azurerm_postgresql_flexible_server" "postgres"');
      const variables = result.payload["variables"] as Array<Record<string, unknown>>;
      const dbPassword = variables.find((variable) => variable["name"] === "db_admin_password");
      expect(dbPassword).toMatchObject({ type: "string", required: true });
      expect(String(result.payload["diagram"])).toContain("flowchart TD");
      expect(String(result.payload["diagram"])).toContain("database: postgres");
      expect(String(result.payload["explanation"])).toContain("Generated Terraform for azure");
    });

    it("adds a renderable resource declared in the DESIGN infrastructure section", async () => {
      const ws = workspace("specky-infra-iac-design-");
      const harness = await buildHarness(ws, { design: DESIGN });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_iac");
      expect(result.isError).toBe(false);
      // Contract stays authoritative and unchanged.
      expect(result.payload["contract_resources"]).toEqual([
        { module: "networking", service: "network" },
        { module: "database", service: "postgres" },
      ]);
      // DESIGN contributes the container resource on top of the contract.
      expect(result.payload["design_resources"]).toContainEqual({
        module: "compute",
        service: "container",
      });
      expect(result.payload["resolved_resources"]).toContainEqual({
        module: "compute",
        service: "container",
      });
      const mainTf = readFileSync(join(ws, FEATURE_DIR, "terraform/main.tf"), "utf8");
      expect(mainTf).toContain('resource "azurerm_container_app" "app"');
    });

    it("produces different Terraform for different designs (content-driven)", async () => {
      const redisDesign = `## Infrastructure & Deployment\nThe API uses a Redis cache.`;
      const storageDesign = `## Infrastructure & Deployment\nThe API uses Blob Storage.`;

      const wsRedis = workspace("specky-infra-iac-redis-");
      const redisHarness = await buildHarness(wsRedis, { design: redisDesign });
      closes.push(redisHarness.close);
      await callTool(redisHarness.client, "sdd_generate_iac");
      const redisTf = readFileSync(join(wsRedis, FEATURE_DIR, "terraform/main.tf"), "utf8");

      const wsStorage = workspace("specky-infra-iac-storage-");
      const storageHarness = await buildHarness(wsStorage, { design: storageDesign });
      closes.push(storageHarness.close);
      await callTool(storageHarness.client, "sdd_generate_iac");
      const storageTf = readFileSync(join(wsStorage, FEATURE_DIR, "terraform/main.tf"), "utf8");

      expect(redisTf).not.toEqual(storageTf);
      expect(redisTf).toContain("azurerm_redis_cache");
      expect(storageTf).toContain("azurerm_storage_account");
    });

    it("reports recognized-but-unrenderable resources without rendering them", async () => {
      const ws = workspace("specky-infra-iac-unsupported-");
      const harness = await buildHarness(ws, {
        design: `## Infrastructure & Deployment\nThe API runs in a container and reads secrets from Key Vault.`,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_iac");
      expect(result.isError).toBe(false);
      expect(result.payload["unsupported_resources"]).toContain("key-vault");
      const mainTf = readFileSync(join(ws, FEATURE_DIR, "terraform/main.tf"), "utf8");
      expect(mainTf).not.toContain("key_vault");
    });

    it("does not persist inferred resources into the signed contract", async () => {
      const ws = workspace("specky-infra-iac-nopersist-");
      const harness = await buildHarness(ws, { design: DESIGN });
      closes.push(harness.close);
      await callTool(harness.client, "sdd_generate_iac");
      // A second call sees the same contract resources — inference was not persisted.
      const second = await callTool(harness.client, "sdd_generate_iac");
      expect(second.payload["contract_resources"]).toEqual([
        { module: "networking", service: "network" },
        { module: "database", service: "postgres" },
      ]);
    });

    it("requires DESIGN.md as evidence", async () => {
      const harness = await buildHarness(workspace("specky-infra-iac-nodesign-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_iac");
      expect(result.isError).toBe(true);
      expect(result.raw).toContain(
        `DESIGN.md is required as evidence for the IaC contract in ${FEATURE_DIR}.`,
      );
    });

    it("is blocked when no APPROVE gate decision is recorded at Analyze", async () => {
      const harness = await buildHarness(workspace("specky-infra-iac-gate-"), {
        design: DESIGN,
        gate: null,
      });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_iac");
      expect(result.isError).toBe(true);
      expect(result.payload["error"]).toBe("gate_blocked");
    });
  });

  describe("sdd_validate_iac", () => {
    it("builds the Terraform MCP validation payload for the feature directory", async () => {
      const harness = await buildHarness(workspace("specky-infra-validate-"), { design: DESIGN });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_validate_iac");
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        provider: "terraform",
        cloud: "azure",
      });
      expect(result.payload["payload"]).toEqual({
        action: "validate",
        provider: "terraform",
        cloud: "azure",
        directory: join(FEATURE_DIR, "terraform"),
      });
      expect(result.payload["routing_instructions"]).toMatchObject({
        mcp_server: "terraform",
        tool_name: "plan",
      });
      expect(String(result.payload["explanation"])).toContain("terraform on azure");
      expect(result.payload["phase_context"]).toMatchObject({ current_phase: Phase.Analyze });
    });
  });

  describe("sdd_generate_dockerfile", () => {
    it("writes a multi-stage Dockerfile and compose stack from the dev-environment contract", async () => {
      const ws = workspace("specky-infra-docker-");
      const harness = await buildHarness(ws, { design: DESIGN });
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_dockerfile");
      expect(result.isError).toBe(false);
      expect(result.payload).toMatchObject({
        type: "docker",
        tech_stack: { language: "TypeScript", framework: "Express", runtime: "node22" },
      });
      const files = result.payload["files"] as Array<Record<string, unknown>>;
      expect(files.map((file) => file["path"])).toEqual([
        "Dockerfile",
        "docker-compose.yml",
        ".dockerignore",
      ]);
      const dockerfile = files.find((file) => file["path"] === "Dockerfile");
      expect(String(dockerfile?.["content"])).toContain("FROM node:22-slim AS builder");
      expect(String(dockerfile?.["content"])).toContain('CMD ["node", "dist/index.js"]');
      const writtenPaths = result.payload["written_paths"] as string[];
      expect(writtenPaths).toHaveLength(3);
      const compose = readFileSync(join(ws, FEATURE_DIR, "docker-compose.yml"), "utf8");
      expect(compose).toContain("depends_on:");
      expect(compose).toContain("postgres:");
      expect(compose).toContain("image: postgres:16-alpine");
      expect(String(result.payload["explanation"])).toContain(
        "multi-stage Dockerfile for TypeScript (Express)",
      );
    });

    it("requires DESIGN.md as evidence", async () => {
      const harness = await buildHarness(workspace("specky-infra-docker-nodesign-"));
      closes.push(harness.close);
      const result = await callTool(harness.client, "sdd_generate_dockerfile");
      expect(result.isError).toBe(true);
      expect(result.raw).toContain(
        `DESIGN.md is required as evidence for the development-environment contract in ${FEATURE_DIR}.`,
      );
    });
  });
});
