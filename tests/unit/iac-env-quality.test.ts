/**
 * iac-env-quality.test.ts — promise-delivery regressions found by executing
 * the real server (audit wf_c703f5af-3d8, IaC/environment batch):
 *
 *   1. sdd_generate_iac emitted a provider-only skeleton ("# TODO: Add …
 *      resources") with the same 4 generic modules regardless of DESIGN.md —
 *      the Redis cache and Container Apps named in the design never appeared.
 *      It now parses DESIGN.md and emits real resource blocks per provider.
 *   2. sdd_generate_devcontainer / sdd_setup_codespaces promised detection
 *      "from DESIGN.md tech stack" but only scanned code manifests, so a
 *      DESIGN-only workspace degraded to a generic ubuntu image with zero
 *      extensions. DESIGN.md prose is now the fallback.
 *   3. sdd_setup_local_env always returned additional_services: [] although
 *      the schema promises auto-detection from DESIGN.md; postgres/redis/…
 *      are now detected from DESIGN.md + package.json and emitted as compose
 *      services.
 *   4. sdd_setup_codespaces routed to a GitHub MCP tool ("create_codespace")
 *      that does not exist in the official server; the payload now routes to
 *      real tools (create_or_update_file/push_files) plus UI/CLI/API steps.
 *   5. The ears-validator.sh hook crashed (exit 1) on any spec missing one of
 *      the 6 EARS pattern types (grep -c prints "0" AND exits 1, so the old
 *      `|| echo "0"` produced a two-line value that broke the arithmetic).
 *      It now prints a per-pattern coverage report and exits 0, reserving
 *      exit 1 for a missing/unreadable SPECIFICATION.md.
 *
 * Tests drive the REAL tool handlers over an in-memory MCP transport against
 * temp workspaces, and execute the real hook script under both sh and bash.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { CodebaseScanner } from "../../src/services/codebase-scanner.js";
import {
  IacGenerator,
  detectServicesFromDesign,
  detectTechStackFromDesign,
} from "../../src/services/iac-generator.js";
import { registerInfrastructureTools } from "../../src/tools/infrastructure.js";
import { registerEnvironmentTools } from "../../src/tools/environment.js";
import { AuditLogger } from "../../src/services/audit-logger.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { Phase } from "../../src/constants.js";

const REPO = resolve(import.meta.dirname, "../..");
const HOOK = join(REPO, ".apm/hooks/scripts/specky-ears-validator.sh");

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  cloud: "azure" | "aws" | "gcp" = "azure",
  services: string[] = ["postgres", "redis"],
): Promise<Harness> {
  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const codebaseScanner = new CodebaseScanner(fileManager);
  const iacGenerator = new IacGenerator(fileManager);
  const resources = cloud === "aws"
    ? [
      { module: "compute" as const, service: "serverless" },
      { module: "database" as const, service: "nosql" },
      { module: "storage" as const, service: "object" },
    ]
    : [
      { module: "compute" as const, service: "container" },
      { module: "database" as const, service: "postgres" },
      { module: "cache" as const, service: "redis" },
      { module: "networking" as const, service: "network" },
    ];
  const contract = resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "infrastructure",
    execution_mode: "full",
    capabilities: ["iac", "dev-environment"],
    capability_config: {
      iac: {
        provider: "terraform",
        cloud,
        resources,
        state_backend: "remote encrypted state with locking",
        region_policy: "Use only regions approved by the workload owner",
      },
      "dev-environment": {
        language: "TypeScript",
        framework: "Express",
        runtime: "node22",
        package_manager: "npm",
        port: 3000,
        services,
        codespaces_machine: "standardLinux32gb",
        extensions: ["dbaeumer.vscode-eslint"],
        base_image: "mcr.microsoft.com/devcontainers/typescript-node:22",
        features: [],
        include_compose: true,
        multi_stage: true,
      },
    },
  });
  for (const feature of await fileManager.listFeatures(".specs")) {
    const state = stateMachine.createFeatureState({
      projectName: feature.name,
      feature: {
        number: feature.number,
        name: feature.name,
        directory: feature.directory,
      },
      contract,
    });
    state.current_phase = Phase.Analyze;
    state.phases[Phase.Analyze] = { status: "in_progress" };
    state.gate_decision = {
      decision: "APPROVE",
      reasons: ["Test fixture"],
      coverage_percent: 100,
      gaps: [],
      decided_at: new Date().toISOString(),
    };
    await stateMachine.saveState(feature.directory, state);
  }

  const server = new McpServer({ name: "specky-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
  registerInfrastructureTools(server, fileManager, stateMachine, iacGenerator);
  registerEnvironmentTools(server, fileManager, stateMachine, iacGenerator, codebaseScanner);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "iac-env-quality", version: "0.0.0" });
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

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; payload: Record<string, unknown>; raw: string }> {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as Array<{ type: string; text?: string }>;
  const raw = content[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = { _raw: raw };
  }
  return { isError: res.isError === true, payload, raw };
}

describe("IaC / environment promise-delivery regressions", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const workspaces: string[] = [];

  function makeWorkspace(prefix: string): string {
    const ws = mkdtempSync(join(tmpdir(), prefix));
    workspaces.push(ws);
    return ws;
  }

  function seedFeature(ws: string, design?: string): void {
    const dir = join(ws, ".specs", "001-shop");
    mkdirSync(dir, { recursive: true });
    if (design !== undefined) writeFileSync(join(dir, "DESIGN.md"), design);
  }

  afterEach(async () => {
    for (const close of cleanups.splice(0)) await close();
    for (const ws of workspaces.splice(0)) rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  // ── Fix 1: sdd_generate_iac emits real resources for what DESIGN.md names ──

  const DESIGN_AZURE = [
    "# Design",
    "",
    "## Tech Stack",
    "- TypeScript with Express on Node.js 22",
    "- Azure Container Apps for hosting",
    "- PostgreSQL Flexible Server for persistence",
    "- Redis for session caching",
  ].join("\n");

  it("azure design naming Redis + Postgres + Container Apps yields real resource blocks for them (no TODO skeleton)", async () => {
    const ws = makeWorkspace("specky-iac-azure-");
    seedFeature(ws, DESIGN_AZURE);
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_generate_iac", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);

    const mainTf = readFileSync(join(ws, ".specs/001-shop/terraform/main.tf"), "utf8");
    // The audit found ZERO `resource` blocks — only provider boilerplate plus
    // "# TODO: Add compute resources" x4 regardless of the design.
    expect(mainTf).toContain('resource "azurerm_postgresql_flexible_server" "postgres"');
    expect(mainTf).toContain('resource "azurerm_redis_cache" "redis"');
    expect(mainTf).toContain('resource "azurerm_container_app" "app"');
    expect(mainTf).not.toContain("TODO");

    // variables.tf grows with the detected components (db credentials, image).
    const variablesTf = readFileSync(join(ws, ".specs/001-shop/terraform/variables.tf"), "utf8");
    expect(variablesTf).toContain('variable "db_admin_password"');
    expect(variablesTf).toContain("sensitive   = true");
    expect(variablesTf).toContain('variable "container_image"');

    // outputs.tf references the real resources instead of `value = "" # TODO`.
    const outputsTf = readFileSync(join(ws, ".specs/001-shop/terraform/outputs.tf"), "utf8");
    expect(outputsTf).toContain("azurerm_redis_cache.redis");
    expect(outputsTf).not.toContain('value       = ""');

    // The explanation names the detected components, not a fixed module list.
    const explanation = String(payload.explanation);
    expect(explanation).toContain("database (postgres)");
    expect(explanation).toContain("cache (redis)");
  });

  it("a different design yields different resources (aws: Lambda + DynamoDB + S3, no redis/postgres)", async () => {
    const ws = makeWorkspace("specky-iac-aws-");
    seedFeature(ws, [
      "# Design",
      "",
      "- Python FastAPI service",
      "- AWS Lambda for compute",
      "- DynamoDB table for orders",
      "- S3 bucket for report storage",
    ].join("\n"));
    const h = await buildHarness(ws, "aws");
    cleanups.push(h.close);

    const { isError } = await callTool(h.client, "sdd_generate_iac", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);

    const mainTf = readFileSync(join(ws, ".specs/001-shop/terraform/main.tf"), "utf8");
    expect(mainTf).toContain('resource "aws_lambda_function" "app"');
    expect(mainTf).toContain('resource "aws_dynamodb_table" "nosql"');
    expect(mainTf).toContain('resource "aws_s3_bucket" "storage"');
    // The audit found IDENTICAL output for azure and aws and for any design.
    expect(mainTf).not.toContain("azurerm_");
    expect(mainTf).not.toContain("redis");
    expect(mainTf).not.toContain("postgres");
    expect(mainTf).not.toContain("TODO");
  });

  it("without DESIGN.md the tool fails instead of generating inferred infrastructure", async () => {
    const ws = makeWorkspace("specky-iac-fallback-");
    seedFeature(ws); // feature dir exists, no DESIGN.md
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError } = await callTool(h.client, "sdd_generate_iac", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(true);
    expect(existsSync(join(ws, ".specs/001-shop/terraform/main.tf"))).toBe(false);
  });

  // ── Fix 2: DESIGN.md tech-stack fallback for devcontainer generation ──

  it("sdd_generate_devcontainer on a DESIGN-only workspace uses the DESIGN.md tech stack (node image + extensions, not ubuntu)", async () => {
    const ws = makeWorkspace("specky-devc-");
    seedFeature(ws, "## Tech Stack\n\nTypeScript Express API on Node.js 22.\n");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_generate_devcontainer", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);

    // The audit run on a DESIGN-only workspace returned tech_stack "unknown"
    // and wrote a generic ubuntu image with zero extensions.
    const techStack = payload.tech_stack as Record<string, unknown>;
    expect(techStack.language).toBe("TypeScript");
    expect(payload.tech_stack_source).toBe("feature contract");

    const config = JSON.parse(readFileSync(join(ws, ".devcontainer/devcontainer.json"), "utf8")) as {
      image: string;
      customizations: { vscode: { extensions: string[] } };
    };
    expect(config.image).toContain("typescript-node");
    expect(config.image).not.toContain("ubuntu");
    expect(config.customizations.vscode.extensions).toContain("dbaeumer.vscode-eslint");
  });

  it("devcontainer rejects an unconfigured stack instead of emitting generic Ubuntu", () => {
    const gen = new IacGenerator(new FileManager(REPO));
    expect(() => gen.generateDevcontainer({ language: "unknown" })).toThrow(
      /Unsupported devcontainer capability language/,
    );
  });

  // ── Fix 3: sdd_setup_local_env auto-detects additional_services ──

  it("detects postgres + redis from DESIGN.md and emits them as compose services", async () => {
    const ws = makeWorkspace("specky-lenv-design-");
    seedFeature(ws, "TypeScript Express API. PostgreSQL for orders. Redis for session caching.\n");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_setup_local_env", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);

    // The audit found additional_services ALWAYS [] even with DESIGN.md naming
    // PostgreSQL and Redis.
    expect(payload.additional_services).toEqual(["postgres", "redis"]);
    expect(payload.services_source).toBe("feature contract");

    const files = payload.files as Array<{ path: string; content: string }>;
    const compose = files.find((f) => f.path === "docker-compose.yml");
    expect(compose).toBeDefined();
    expect(compose!.content).toContain("postgres:16-alpine");
    expect(compose!.content).toContain("redis:7-alpine");
    expect(compose!.content).toContain("depends_on");
  });

  it("detects services from package.json dependencies (pg + ioredis) when DESIGN.md does not name them", async () => {
    const ws = makeWorkspace("specky-lenv-pkg-");
    seedFeature(ws, "A REST API for orders.\n");
    writeFileSync(
      join(ws, "package.json"),
      JSON.stringify({ name: "orders", dependencies: { express: "^4.19.0", pg: "^8.11.0", ioredis: "^5.4.0" } }),
    );
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_setup_local_env", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);
    expect(payload.additional_services).toEqual(["postgres", "redis"]);
    expect(payload.tech_stack_source).toBe("feature contract");
  });

  it("an explicit services list overrides auto-detection", async () => {
    const ws = makeWorkspace("specky-lenv-explicit-");
    seedFeature(ws, "PostgreSQL everywhere.\n");
    const h = await buildHarness(ws, "azure", ["rabbitmq"]);
    cleanups.push(h.close);

    const { isError, payload } = await callTool(h.client, "sdd_setup_local_env", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);
    expect(payload.additional_services).toEqual(["rabbitmq"]);
    expect(payload.services_source).toBe("feature contract");

    const files = payload.files as Array<{ path: string; content: string }>;
    const compose = files.find((f) => f.path === "docker-compose.yml");
    expect(compose!.content).toContain("rabbitmq:3-management-alpine");
  });

  // ── Fix 4: sdd_setup_codespaces routes to real GitHub MCP tools ──

  it("codespaces payload no longer routes to the nonexistent 'create_codespace' tool and gives actionable steps", async () => {
    const ws = makeWorkspace("specky-codespaces-");
    seedFeature(ws, "## Tech Stack\n\nTypeScript Express API on Node.js 22.\n");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const { isError, payload, raw } = await callTool(h.client, "sdd_setup_codespaces", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(isError).toBe(false);

    // The official GitHub MCP has no create_codespace tool — the old payload
    // could not be routed anywhere as written.
    expect(raw).not.toContain("create_codespace");
    const routing = payload.routing_instructions as Record<string, unknown>;
    expect(routing.mcp_server).toBe("github");
    expect(routing.tool_name).toBe("create_or_update_file");
    expect(String(routing.note)).toContain(".devcontainer/devcontainer.json");

    const nextSteps = String(payload.next_steps);
    expect(nextSteps).toContain("gh codespace create");
    expect(nextSteps).toContain("standardLinux32gb");
    expect(nextSteps).toContain("POST /repos/{owner}/{repo}/codespaces");

    // DESIGN-aware detection is reused: DESIGN-only workspace still gets the
    // typescript-node image, not ubuntu/unknown.
    const files = payload.files as Array<{ path: string; content: string }>;
    expect(files[0].content).toContain("typescript-node");
  });

  // ── Detection helpers (shared by fixes 2-4) ──

  it("detectTechStackFromDesign recognizes stacks and returns undefined for signal-free prose", () => {
    expect(detectTechStackFromDesign("Python FastAPI backend")?.language).toBe("Python");
    expect(detectTechStackFromDesign("A Golang microservice with Gin")?.framework).toBe("Gin");
    expect(detectTechStackFromDesign("TypeScript Express API")?.framework).toBe("Express");
    expect(detectTechStackFromDesign("")).toBeUndefined();
    expect(detectTechStackFromDesign("A design that names no stack at all.")).toBeUndefined();
  });

  it("detectServicesFromDesign merges DESIGN.md keywords with package.json deps", () => {
    expect(detectServicesFromDesign("PostgreSQL and Redis", undefined)).toEqual(["postgres", "redis"]);
    expect(detectServicesFromDesign("", JSON.stringify({ dependencies: { mongoose: "^8.0.0", amqplib: "^0.10.0" } })))
      .toEqual(["mongodb", "rabbitmq"]);
    expect(detectServicesFromDesign("nothing here", "{not json")).toEqual([]);
  });
});

// ── Fix 5: ears-validator.sh hook ──

describe("ears-validator.sh hook", () => {
  const dirs: string[] = [];

  function makeDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function runHook(cwd: string, shell: string): { status: number | null; stdout: string; stderr: string } {
    const res = spawnSync(shell, [HOOK], { cwd, encoding: "utf8" });
    return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  }

  const PARTIAL_SPEC = [
    "# Spec",
    "- REQ-API-001: The system shall store todos.",
    "- REQ-API-002: When a todo is created, the system shall return 201.",
    "- REQ-API-003: The system shall expose a health endpoint.",
  ].join("\n");

  for (const shell of ["sh", "bash"]) {
    it(`(${shell}) exits 0 with a per-pattern coverage report when a spec lacks some EARS pattern types`, () => {
      const d = makeDir("specky-ears-partial-");
      mkdirSync(join(d, ".specs/001-x"), { recursive: true });
      writeFileSync(join(d, ".specs/001-x/SPECIFICATION.md"), PARTIAL_SPEC);

      // The original hook crashed here: grep -c printed "0" AND exited 1, so
      // `|| echo "0"` appended a second line and $((...)) blew up → exit 1,
      // no coverage report on virtually every real spec.
      const res = runHook(d, shell);
      expect(res.stderr).toBe("");
      expect(res.status).toBe(0);
      expect(res.stdout).toMatch(/Ubiquitous:\s+2/);
      expect(res.stdout).toMatch(/Event-driven:\s+1/);
      expect(res.stdout).toMatch(/State-driven:\s+0/);
      expect(res.stdout).toContain("Pattern coverage: 2/6");
      expect(res.stdout).toContain("EARS total:   3 / 3");
      expect(res.stdout).toContain("Pattern types with zero requirements");
    });
  }

  it("reports 6/6 without warnings when every pattern type is present", () => {
    const d = makeDir("specky-ears-full-");
    mkdirSync(join(d, ".specs/001-x"), { recursive: true });
    writeFileSync(join(d, ".specs/001-x/SPECIFICATION.md"), [
      "- REQ-A-001: The system shall log all requests.",
      "- REQ-A-002: When a user logs in, the system shall issue a token.",
      "- REQ-A-003: While offline, the system shall queue requests.",
      "- REQ-A-004: Where 2FA is enabled, the system shall require an OTP.",
      "- REQ-A-005: If the session expires, then the system shall redirect to login.",
      "- REQ-A-006: While in maintenance mode, when a request arrives, the system shall queue it.",
    ].join("\n"));

    const res = runHook(d, "sh");
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Pattern coverage: 6/6");
    expect(res.stdout).not.toContain("Pattern types with zero requirements");
  });

  it("exits 1 only for a real failure: latest feature dir has no SPECIFICATION.md", () => {
    const d = makeDir("specky-ears-missing-");
    mkdirSync(join(d, ".specs/001-x"), { recursive: true });

    const res = runHook(d, "sh");
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("missing or unreadable");
  });

  it("exits 0 quietly when there is no .specs workspace at all", () => {
    const d = makeDir("specky-ears-empty-");
    const res = runHook(d, "sh");
    expect(res.status).toBe(0);
  });
});
