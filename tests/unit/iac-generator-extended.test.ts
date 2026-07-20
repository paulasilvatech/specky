/**
 * iac-generator-extended.test.ts — unit tests for IacGenerator covering
 * paths not exercised by the tool-level regressions in iac-env-quality.test.ts:
 *
 *   - generateTerraform across all three clouds (azure/aws/gcp), every
 *     supported module:service component, unsupported components, and the
 *     empty-contract error.
 *   - Output file structure (main.tf / variables.tf / outputs.tf /
 *     terraform.tfvars.example) written into temp workspaces.
 *   - Variable derivation (container vars, db credentials, sensitive flags,
 *     aws subnet_ids, gcp project_id).
 *   - generateValidationPayload routing for terraform vs bicep providers.
 *   - generateDockerfile / generateDevcontainer per stack, compose services,
 *     and unsupported-language errors.
 *   - detectTechStackFromDesign / detectServicesFromDesign edge cases.
 *
 * The generator never touches the filesystem itself (the FileManager
 * constructor arg is unused), so tests pass a mocked FileManager and write
 * results into real temp workspaces only when verifying on-disk structure.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileManager } from "../../src/services/file-manager.js";
import {
  detectServicesFromDesign,
  detectTechStackFromDesign,
  IacGenerator,
  type InfraComponent,
} from "../../src/services/iac-generator.js";
import type { IacResult } from "../../src/types.js";

const workspaces: string[] = [];

function makeWorkspace(prefix: string): string {
  const ws = mkdtempSync(join(tmpdir(), prefix));
  workspaces.push(ws);
  return ws;
}

afterEach(() => {
  for (const ws of workspaces.splice(0))
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** The generator ignores its FileManager — a stub documents that contract. */
function makeGenerator(workspace: string): IacGenerator {
  const fileManager = {
    root: workspace,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  } as unknown as FileManager;
  return new IacGenerator(fileManager);
}

function fileByPath(result: IacResult, path: string): string {
  const file = result.files.find((f) => f.path === path);
  expect(file, `expected generated file ${path}`).toBeDefined();
  return file!.content;
}

/** Materialize a result into a temp workspace and return its directory. */
function writeResult(
  ws: string,
  result: { files: Array<{ path: string; content: string }> },
): string {
  const outDir = join(ws, "iac-out");
  for (const file of result.files) {
    const target = join(outDir, file.path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, file.content);
  }
  return outDir;
}

const AZURE_ALL: InfraComponent[] = [
  { module: "networking", service: "network" },
  { module: "compute", service: "container" },
  { module: "compute", service: "kubernetes" },
  { module: "compute", service: "serverless" },
  { module: "database", service: "postgres" },
  { module: "database", service: "mysql" },
  { module: "database", service: "nosql" },
  { module: "database", service: "sqlserver" },
  { module: "cache", service: "redis" },
  { module: "storage", service: "object" },
  { module: "messaging", service: "queue" },
  { module: "identity", service: "identity" },
  { module: "monitoring", service: "logs" },
];

describe("generateTerraform — azure components", () => {
  it("renders a resource block for every supported azure component", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-azure-all-"));
    const result = await gen.generateTerraform("azure", AZURE_ALL);

    const mainTf = fileByPath(result, "terraform/main.tf");
    const expectedResources = [
      'resource "azurerm_resource_group" "main"',
      'resource "azurerm_virtual_network" "network"',
      'resource "azurerm_subnet" "app"',
      'resource "azurerm_container_app_environment" "main"',
      'resource "azurerm_container_app" "app"',
      'resource "azurerm_kubernetes_cluster" "k8s"',
      'resource "azurerm_linux_function_app" "app"',
      'resource "azurerm_postgresql_flexible_server" "postgres"',
      'resource "azurerm_mysql_flexible_server" "mysql"',
      'resource "azurerm_cosmosdb_account" "nosql"',
      'resource "azurerm_mssql_server" "mssql"',
      'resource "azurerm_redis_cache" "redis"',
      'resource "azurerm_storage_account" "storage"',
      'resource "azurerm_servicebus_namespace" "queue"',
      'resource "azurerm_user_assigned_identity" "app"',
      'resource "azurerm_log_analytics_workspace" "logs"',
      'resource "azurerm_application_insights" "app"',
    ];
    for (const block of expectedResources) expect(mainTf).toContain(block);
    expect(mainTf).toContain('source = "hashicorp/azurerm"');
    expect(mainTf).toContain('provider "azurerm"');
    expect(mainTf).not.toContain("TODO");
  });

  it("exposes one output per component plus the resource group", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-azure-out-"));
    const result = await gen.generateTerraform("azure", AZURE_ALL);

    const outputsTf = fileByPath(result, "terraform/outputs.tf");
    const expectedOutputs = [
      "resource_group_name",
      "network_id",
      "app_fqdn",
      "kubernetes_cluster_name",
      "function_app_name",
      "postgres_fqdn",
      "mysql_fqdn",
      "nosql_endpoint",
      "sqlserver_fqdn",
      "redis_hostname",
      "storage_account_id",
      "servicebus_namespace_id",
      "identity_client_id",
      "log_analytics_workspace_id",
    ];
    for (const name of expectedOutputs) expect(outputsTf).toContain(`output "${name}"`);
    // Outputs reference real resources, never empty placeholders.
    expect(outputsTf).not.toContain('value       = ""');
  });

  it("throws (no placeholder) for unsupported components", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-azure-unsup-"));
    await expect(
      gen.generateTerraform("azure", [
        { module: "compute", service: "container" },
        { module: "dns", service: "zone" },
      ]),
    ).rejects.toThrow(/no template exists for dns:zone/);
  });
});

describe("generateTerraform — aws components", () => {
  it("renders aws-native resources for every supported component", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-aws-all-"));
    const result = await gen.generateTerraform("aws", AZURE_ALL);

    const mainTf = fileByPath(result, "terraform/main.tf");
    const expectedResources = [
      'resource "aws_vpc" "network"',
      'resource "aws_ecs_cluster" "app"',
      'resource "aws_eks_cluster" "k8s"',
      'resource "aws_lambda_function" "app"',
      'resource "aws_db_instance" "postgres"',
      'resource "aws_db_instance" "mysql"',
      'resource "aws_dynamodb_table" "nosql"',
      'resource "aws_db_instance" "mssql"',
      'resource "aws_elasticache_cluster" "redis"',
      'resource "aws_s3_bucket" "storage"',
      'resource "aws_sqs_queue" "queue"',
      'resource "aws_iam_role" "app"',
      'resource "aws_cloudwatch_log_group" "logs"',
    ];
    for (const block of expectedResources) expect(mainTf).toContain(block);
    expect(mainTf).toContain('source = "hashicorp/aws"');
    expect(mainTf).not.toContain("azurerm_");
    expect(mainTf).not.toContain("google_");
  });

  it("adds the required subnet_ids variable only when EKS is present", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-aws-eks-"));

    const withEks = await gen.generateTerraform("aws", [
      { module: "compute", service: "kubernetes" },
    ]);
    expect(fileByPath(withEks, "terraform/variables.tf")).toContain('variable "subnet_ids"');
    expect(fileByPath(withEks, "terraform/variables.tf")).toContain("type        = list(string)");

    const withoutEks = await gen.generateTerraform("aws", [
      { module: "storage", service: "object" },
    ]);
    expect(fileByPath(withoutEks, "terraform/variables.tf")).not.toContain('variable "subnet_ids"');
  });
});

describe("generateTerraform — gcp components", () => {
  it("renders google-native resources including the project_id variable", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-gcp-all-"));
    const result = await gen.generateTerraform("gcp", AZURE_ALL);

    const mainTf = fileByPath(result, "terraform/main.tf");
    const expectedResources = [
      'resource "google_compute_network" "network"',
      'resource "google_cloud_run_v2_service" "app"',
      'resource "google_container_cluster" "k8s"',
      'resource "google_sql_database_instance" "postgres"',
      'resource "google_sql_database_instance" "mysql"',
      'resource "google_firestore_database" "nosql"',
      'resource "google_sql_database_instance" "mssql"',
      'resource "google_redis_instance" "redis"',
      'resource "google_storage_bucket" "storage"',
      'resource "google_pubsub_topic" "queue"',
      'resource "google_service_account" "app"',
      'resource "google_logging_metric" "logs"',
    ];
    for (const block of expectedResources) expect(mainTf).toContain(block);
    expect(mainTf).toContain('source = "hashicorp/google"');
    expect(mainTf).toContain("project = var.project_id");

    const variablesTf = fileByPath(result, "terraform/variables.tf");
    expect(variablesTf).toContain('variable "project_id"');
    const projectId = result.variables.find((v) => v.name === "project_id");
    expect(projectId?.required).toBe(true);
  });

  it("maps both compute:container and compute:serverless to Cloud Run", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-gcp-run-"));
    for (const service of ["container", "serverless"]) {
      const result = await gen.generateTerraform("gcp", [{ module: "compute", service }]);
      expect(fileByPath(result, "terraform/main.tf")).toContain(
        'resource "google_cloud_run_v2_service" "app"',
      );
    }
  });
});

describe("generateTerraform — file structure and variables", () => {
  it("produces the canonical four-file terraform layout in a temp workspace", async () => {
    const ws = makeWorkspace("specky-iacx-layout-");
    const gen = makeGenerator(ws);
    const result = await gen.generateTerraform("azure", [
      { module: "compute", service: "container" },
      { module: "database", service: "postgres" },
    ]);

    expect(result.provider).toBe("terraform");
    expect(result.files.map((f) => f.path)).toEqual([
      "terraform/main.tf",
      "terraform/variables.tf",
      "terraform/outputs.tf",
      "terraform/terraform.tfvars.example",
    ]);

    const outDir = writeResult(ws, result);
    const mainTf = readFileSync(join(outDir, "terraform/main.tf"), "utf8");
    expect(mainTf).toContain('resource "azurerm_container_app" "app"');
    expect(readFileSync(join(outDir, "terraform/variables.tf"), "utf8")).toContain(
      'variable "db_admin_password"',
    );
    expect(readFileSync(join(outDir, "terraform/outputs.tf"), "utf8")).toContain(
      'output "postgres_fqdn"',
    );
    const tfvars = readFileSync(join(outDir, "terraform/terraform.tfvars.example"), "utf8");
    expect(tfvars).toContain('project_name = "<project_name>"');
    expect(tfvars).toContain('environment = "dev"');
    expect(tfvars).toContain('db_admin_password = "<db_admin_password>"');
  });

  it("marks password variables sensitive and derives vars from the component set", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-vars-"));

    const dbOnly = await gen.generateTerraform("azure", [
      { module: "database", service: "postgres" },
    ]);
    const dbVars = fileByPath(dbOnly, "terraform/variables.tf");
    expect(dbVars).toContain('variable "db_admin_username"');
    expect(dbVars).toContain('variable "db_admin_password"');
    expect(dbVars).toContain("sensitive   = true");
    // No container workload → no container variables.
    expect(dbVars).not.toContain('variable "container_image"');
    expect(dbVars).not.toContain('variable "container_port"');

    const containerOnly = await gen.generateTerraform("azure", [
      { module: "compute", service: "container" },
    ]);
    const containerVars = fileByPath(containerOnly, "terraform/variables.tf");
    expect(containerVars).toContain('variable "container_image"');
    expect(containerVars).toContain("type        = number");
    // No database workload → no db credentials.
    expect(containerVars).not.toContain('variable "db_admin_password"');
  });

  it("skips container vars for azure serverless (Functions) but keeps them for aws/gcp", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-sl-vars-"));

    const azureFn = await gen.generateTerraform("azure", [
      { module: "compute", service: "serverless" },
    ]);
    expect(fileByPath(azureFn, "terraform/variables.tf")).not.toContain(
      'variable "container_image"',
    );

    for (const cloud of ["aws", "gcp"] as const) {
      const result = await gen.generateTerraform(cloud, [
        { module: "compute", service: "serverless" },
      ]);
      expect(fileByPath(result, "terraform/variables.tf")).toContain('variable "container_image"');
    }
  });

  it("reports the real resource-block count and component list in the explanation", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-explain-"));
    const components: InfraComponent[] = [
      { module: "compute", service: "container" },
      { module: "database", service: "postgres" },
    ];
    const result = await gen.generateTerraform("azure", components);

    const mainTf = fileByPath(result, "terraform/main.tf");
    const actualCount = (mainTf.match(/^resource "/gm) || []).length;
    expect(result.explanation).toContain(`with ${actualCount} resource blocks`);
    expect(result.explanation).toContain("across 2 contract resources");
    expect(result.explanation).toContain("compute (container)");
    expect(result.explanation).toContain("database (postgres)");
    expect(result.next_steps).toContain("sdd_validate_iac");
  });

  it("builds a mermaid diagram with one edge per contract component", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-diagram-"));
    const result = await gen.generateTerraform("aws", [
      { module: "compute", service: "serverless" },
      { module: "database", service: "nosql" },
    ]);

    expect(result.diagram).toContain("flowchart TD");
    expect(result.diagram).toContain("TF[Terraform: aws]");
    expect(result.diagram).toContain("M0[compute: serverless]");
    expect(result.diagram).toContain("M1[database: nosql]");
  });

  it("rejects unrenderable components before writing any output (aws/gcp)", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-noout-"));
    await expect(
      gen.generateTerraform("aws", [{ module: "dns", service: "zone" }]),
    ).rejects.toThrow(/no template exists for dns:zone/);
  });

  it("throws when the contract carries no resources", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-empty-"));
    await expect(gen.generateTerraform("azure", [])).rejects.toThrow(
      /requires at least one resource/,
    );
  });

  it("is deterministic — identical inputs produce identical results", async () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-det-"));
    const components: InfraComponent[] = [
      { module: "networking", service: "network" },
      { module: "compute", service: "container" },
      { module: "cache", service: "redis" },
    ];
    const first = await gen.generateTerraform("azure", components);
    const second = await gen.generateTerraform("azure", components);
    expect(second).toEqual(first);
  });
});

describe("generateValidationPayload", () => {
  it("routes terraform validation to the terraform MCP plan tool", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-val-tf-"));
    const result = gen.generateValidationPayload("terraform", "azure");

    expect(result.routing_instructions.mcp_server).toBe("terraform");
    expect(result.routing_instructions.tool_name).toBe("plan");
    expect(result.payload).toMatchObject({
      action: "validate",
      provider: "terraform",
      cloud: "azure",
      directory: "terraform/",
    });
    expect(result.explanation).toContain("terraform MCP");
  });

  it("routes bicep validation to the azure MCP validate_template tool", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-val-bicep-"));
    const result = gen.generateValidationPayload("bicep", "azure", "infra/bicep/");

    expect(result.routing_instructions.mcp_server).toBe("azure");
    expect(result.routing_instructions.tool_name).toBe("validate_template");
    expect(result.payload).toMatchObject({ provider: "bicep", directory: "infra/bicep/" });
  });
});

describe("generateDockerfile", () => {
  it("renders a multi-stage node Dockerfile with compose services and volumes", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-docker-node-"));
    const result = gen.generateDockerfile(
      { language: "TypeScript", framework: "Express", runtime: "node22" },
      true,
      true,
      ["postgres", "mongodb"],
    );

    expect(result.type).toBe("docker");
    expect(result.files.map((f) => f.path)).toEqual([
      "Dockerfile",
      "docker-compose.yml",
      ".dockerignore",
    ]);

    const dockerfile = fileByPath(result, "Dockerfile");
    expect(dockerfile).toContain("FROM node:22-slim AS builder");
    expect(dockerfile).toContain("COPY --from=builder");

    const compose = fileByPath(result, "docker-compose.yml");
    expect(compose).toContain("postgres:16-alpine");
    expect(compose).toContain("mongo:7");
    expect(compose).toContain("depends_on");
    // Both stateful services declare named volumes.
    expect(compose).toContain("postgres-data:/var/lib/postgresql/data");
    expect(compose).toContain("mongo-data:/data/db");
    expect(compose).toContain("volumes:");

    expect(result.explanation).toContain("multi-stage Dockerfile for TypeScript (Express)");
    expect(result.explanation).toContain("services: app, postgres, mongodb");
  });

  it("renders single-stage python and go Dockerfiles without compose when disabled", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-docker-mono-"));

    const python = gen.generateDockerfile(
      { language: "Python", framework: "FastAPI", runtime: "python3.12" },
      false,
      false,
    );
    expect(python.files.map((f) => f.path)).toEqual(["Dockerfile", ".dockerignore"]);
    expect(fileByPath(python, "Dockerfile")).toContain("FROM python:3.12-slim");
    expect(fileByPath(python, "Dockerfile")).not.toContain("AS builder");

    const go = gen.generateDockerfile({ language: "Go", runtime: "go1.22" }, false, true);
    const goDockerfile = fileByPath(go, "Dockerfile");
    expect(goDockerfile).toContain("FROM golang:1.22 AS builder");
    expect(goDockerfile).toContain("FROM debian:bookworm-slim");
  });

  it("sanitizes compose service names and falls back to <name>:latest for unknown services", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-docker-san-"));
    const result = gen.generateDockerfile(
      { language: "TypeScript", runtime: "node22" },
      true,
      false,
      ["Custom DB!", ""],
    );

    const compose = fileByPath(result, "docker-compose.yml");
    // Non-YAML characters become dashes; the empty name is dropped entirely.
    expect(compose).toContain("  custom-db-:");
    expect(compose).toContain("image: custom-db-:latest");
    expect(compose).toContain("depends_on:\n      - custom-db-\n");
  });

  it("throws for an unsupported language", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-docker-rust-"));
    expect(() =>
      gen.generateDockerfile({ language: "Rust", runtime: "rust1.80" }, false, false),
    ).toThrow(/Unsupported Docker capability language: Rust/);
  });
});

describe("generateDevcontainer", () => {
  it("merges custom extensions and features into the node devcontainer", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-devc-node-"));
    const result = gen.generateDevcontainer(
      { language: "TypeScript", framework: "Next.js" },
      ["ghcr.io/devcontainers/features/docker-in-docker:2"],
      ["ms-azuretools.vscode-docker"],
    );

    const config = JSON.parse(fileByPath(result, ".devcontainer/devcontainer.json")) as {
      image: string;
      features: Record<string, unknown>;
      customizations: { vscode: { extensions: string[] } };
      postCreateCommand?: string;
    };
    expect(config.image).toBe("mcr.microsoft.com/devcontainers/typescript-node:22");
    expect(config.customizations.vscode.extensions).toEqual([
      "ms-azuretools.vscode-docker",
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode",
    ]);
    expect(config.features).toHaveProperty("ghcr.io/devcontainers/features/docker-in-docker:2");
    expect(config.postCreateCommand).toBe("npm install");
    expect(result.explanation).toContain("TypeScript");
  });

  it("renders parseable python and go devcontainer configs on disk", () => {
    const ws = makeWorkspace("specky-iacx-devc-stacks-");
    const gen = makeGenerator(ws);

    const python = gen.generateDevcontainer({ language: "Python" });
    const outDir = writeResult(ws, python);
    const pythonConfig = JSON.parse(
      readFileSync(join(outDir, ".devcontainer/devcontainer.json"), "utf8"),
    ) as { image: string; postCreateCommand?: string };
    expect(pythonConfig.image).toBe("mcr.microsoft.com/devcontainers/python:3.12");
    expect(pythonConfig.postCreateCommand).toBe("pip install -r requirements.txt");

    const go = gen.generateDevcontainer({ language: "Go" });
    const goConfig = JSON.parse(go.files[0].content) as {
      image: string;
      customizations: { vscode: { extensions: string[] } };
    };
    expect(goConfig.image).toBe("mcr.microsoft.com/devcontainers/go:1.22");
    expect(goConfig.customizations.vscode.extensions).toContain("golang.go");
  });

  it("throws for an unsupported language", () => {
    const gen = makeGenerator(makeWorkspace("specky-iacx-devc-rust-"));
    expect(() => gen.generateDevcontainer({ language: "Rust" })).toThrow(
      /Unsupported devcontainer capability language: Rust/,
    );
  });
});

describe("detectTechStackFromDesign — edge cases", () => {
  it("distinguishes Java from JavaScript and detects Spring Boot", () => {
    expect(detectTechStackFromDesign("A Java service built with Spring")).toEqual({
      language: "Java",
      framework: "Spring Boot",
      runtime: "java21",
    });
    // "javascript" contains "java" but must resolve to the JS stack.
    expect(detectTechStackFromDesign("Plain javascript frontend")?.language).toBe("TypeScript");
  });

  it("only treats bare 'go' as Golang when no other language is named", () => {
    // "go" as English prose alongside node — the JS stack wins.
    expect(detectTechStackFromDesign("We will go with Node.js 22")?.language).toBe("TypeScript");
    // Explicit golang always wins.
    expect(detectTechStackFromDesign("A golang worker with Echo")?.framework).toBe("Echo");
    // Bare "go" alone is treated as Golang.
    expect(detectTechStackFromDesign("Built in go, no frameworks")?.language).toBe("Go");
  });

  it("detects python frameworks and returns undefined for whitespace-only input", () => {
    expect(detectTechStackFromDesign("A Python Django monolith")?.framework).toBe("Django");
    expect(detectTechStackFromDesign("Python Flask API")?.framework).toBe("Flask");
    expect(detectTechStackFromDesign("   \n\t  ")).toBeUndefined();
  });
});

describe("detectServicesFromDesign — edge cases", () => {
  it("detects mysql/mariadb, kafka and keeps the canonical service order", () => {
    expect(detectServicesFromDesign("Kafka streams feeding MariaDB and Redis", undefined)).toEqual([
      "mysql",
      "redis",
      "kafka",
    ]);
  });

  it("scans devDependencies as well as dependencies", () => {
    const pkg = JSON.stringify({ devDependencies: { kafkajs: "^2.2.0" } });
    expect(detectServicesFromDesign("no services named here", pkg)).toEqual(["kafka"]);
  });

  it("ignores an unparseable package.json and falls back to design keywords", () => {
    expect(detectServicesFromDesign("Uses MongoDB for documents", "{not json")).toEqual([
      "mongodb",
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(detectServicesFromDesign("A plain static site.", undefined)).toEqual([]);
  });
});
