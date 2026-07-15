/**
 * IacGenerator — Generates Terraform/Bicep and Dockerfile from DESIGN.md.
 * Deterministic template-based generation.
 */
import type { FileManager } from "./file-manager.js";
import type { IacResult, IacFile, IacVariable, IacValidationResult, DevEnvironmentResult, RoutingInstructions, IacProvider, CloudProvider } from "../types.js";

/** Tech stack named in DESIGN.md prose (as opposed to detected from code manifests). */
export interface DesignTechStack {
  language: string;
  framework?: string;
  runtime: string;
}

/**
 * Detect the tech stack named in DESIGN.md prose. Returns undefined when the
 * design names no recognizable language/runtime so callers can pick their own
 * fallback (codebase scan result, generic image, TypeScript default, ...).
 */
export function detectTechStackFromDesign(designContent: string): DesignTechStack | undefined {
  const lower = designContent.toLowerCase();
  if (!lower.trim()) return undefined;

  if (/\bpython\b/.test(lower)) {
    const framework = /\bdjango\b/.test(lower)
      ? "Django"
      : /\bfastapi\b/.test(lower)
        ? "FastAPI"
        : /\bflask\b/.test(lower)
          ? "Flask"
          : undefined;
    return { language: "Python", framework, runtime: "python3.12" };
  }

  const namesJsRuntime =
    /\btypescript\b|\bjavascript\b|\bnode(\.js)?\b|\bdeno\b|\bbun\b|\bexpress\b|\bfastify\b|\bnext\.?js\b|\breact\b|\bnpm\b/.test(lower);

  // Bare "go" is common English prose; only treat it as Go when no other
  // language is named (or when "golang" is explicit).
  if (/\bgolang\b/.test(lower) || (/\bgo\b/.test(lower) && !namesJsRuntime && !/\bjava\b/.test(lower))) {
    const framework = /\bgin\b/.test(lower) ? "Gin" : /\becho\b/.test(lower) ? "Echo" : undefined;
    return { language: "Go", framework, runtime: "go1.22" };
  }

  if (/\bjava\b/.test(lower) && !/\bjavascript\b/.test(lower)) {
    const framework = /\bspring\b/.test(lower) ? "Spring Boot" : undefined;
    return { language: "Java", framework, runtime: "java21" };
  }

  if (namesJsRuntime) {
    const framework = /\bnext\.?js\b/.test(lower)
      ? "Next.js"
      : /\bexpress\b/.test(lower)
        ? "Express"
        : /\bfastify\b/.test(lower)
          ? "Fastify"
          : undefined;
    return { language: "TypeScript", framework, runtime: "node22" };
  }

  return undefined;
}

/**
 * Detect docker-compose sidecar services from DESIGN.md prose and package.json
 * dependencies (dependencies + devDependencies). Deterministic keyword scan.
 */
export function detectServicesFromDesign(designContent: string, packageJsonContent?: string): string[] {
  const lower = designContent.toLowerCase();
  let deps: Record<string, string> = {};
  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent) as Record<string, unknown>;
      deps = {
        ...(pkg["dependencies"] as Record<string, string> | undefined),
        ...(pkg["devDependencies"] as Record<string, string> | undefined),
      };
    } catch {
      // Unparseable package.json — fall back to design keywords only
    }
  }
  const hasDep = (name: string): boolean => name in deps;

  const services: string[] = [];
  if (/\bpostgres(ql)?\b/.test(lower) || hasDep("pg") || hasDep("postgres") || hasDep("pg-promise")) services.push("postgres");
  if (/\b(mysql|mariadb)\b/.test(lower) || hasDep("mysql") || hasDep("mysql2") || hasDep("mariadb")) services.push("mysql");
  if (/\bmongo(db)?\b/.test(lower) || hasDep("mongodb") || hasDep("mongoose")) services.push("mongodb");
  if (/\bredis\b/.test(lower) || hasDep("redis") || hasDep("ioredis")) services.push("redis");
  if (/\b(rabbitmq|amqp)\b/.test(lower) || hasDep("amqplib")) services.push("rabbitmq");
  if (/\bkafka\b/.test(lower) || hasDep("kafkajs")) services.push("kafka");
  return services;
}

/** A concrete infrastructure component detected in DESIGN.md. */
export interface InfraComponent {
  /** Module/category the component belongs to (networking, compute, database, ...). */
  module: string;
  /** Specific service flavor (postgres, redis, container, kubernetes, ...). */
  service: string;
}

/** A Terraform output produced alongside a resource block. */
interface TfOutput {
  name: string;
  description: string;
  value: string;
}

/** Rendered HCL for one component: resource blocks + the outputs they expose. */
interface RenderedComponent {
  hcl: string;
  outputs: TfOutput[];
}

/** Compose sidecar templates for the services detectServicesFromDesign can emit. */
const COMPOSE_SERVICES: Record<string, { image: string; ports: string[]; environment?: string[]; volume?: { name: string; mountPath: string } }> = {
  postgres: {
    image: "postgres:16-alpine",
    ports: ["5432:5432"],
    environment: ["POSTGRES_USER=app", "POSTGRES_PASSWORD=app", "POSTGRES_DB=app"],
    volume: { name: "postgres-data", mountPath: "/var/lib/postgresql/data" },
  },
  mysql: {
    image: "mysql:8",
    ports: ["3306:3306"],
    environment: ["MYSQL_ROOT_PASSWORD=app", "MYSQL_DATABASE=app"],
    volume: { name: "mysql-data", mountPath: "/var/lib/mysql" },
  },
  mongodb: { image: "mongo:7", ports: ["27017:27017"], volume: { name: "mongo-data", mountPath: "/data/db" } },
  redis: { image: "redis:7-alpine", ports: ["6379:6379"] },
  rabbitmq: { image: "rabbitmq:3-management-alpine", ports: ["5672:5672", "15672:15672"] },
  kafka: { image: "apache/kafka:3.7.0", ports: ["9092:9092"] },
};

function renderDockerfile(language: string, multiStage: boolean): string {
  const normalized = language.toLowerCase();
  if (normalized.includes("typescript") || normalized.includes("javascript")) {
    return multiStage
      ? `FROM node:22-slim AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-slim\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY --from=builder /app/package.json ./\nEXPOSE 3000\nCMD ["node", "dist/index.js"]`
      : `FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["node", "dist/index.js"]`;
  }
  if (normalized.includes("python")) {
    return multiStage
      ? `FROM python:3.12-slim AS builder\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\n\nFROM python:3.12-slim\nWORKDIR /app\nCOPY --from=builder /app .\nEXPOSE 8000\nCMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]`
      : `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]`;
  }
  if (normalized === "go" || normalized.includes("golang")) {
    return multiStage
      ? `FROM golang:1.22 AS builder\nWORKDIR /app\nCOPY go.mod go.sum ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/service ./...\n\nFROM debian:bookworm-slim\nWORKDIR /app\nCOPY --from=builder /app/service ./service\nEXPOSE 3000\nCMD ["./service"]`
      : `FROM golang:1.22\nWORKDIR /app\nCOPY go.mod go.sum ./\nRUN go mod download\nCOPY . .\nRUN go build -o service ./...\nEXPOSE 3000\nCMD ["./service"]`;
  }
  throw new Error(`Unsupported Docker capability language: ${language}`);
}

export class IacGenerator {
  constructor(_fileManager: FileManager) { }

  async generateTerraform(cloud: CloudProvider, components: InfraComponent[]): Promise<IacResult> {
    if (components.length === 0) {
      throw new Error("Terraform generation requires at least one resource in the IaC capability contract.");
    }
    const files: IacFile[] = [];

    const { mainTf, outputs } = this.renderCloud(cloud, components);
    files.push({ path: "terraform/main.tf", content: mainTf, description: "Main Terraform configuration" });

    const vars = this.generateVariables(cloud, components);
    files.push({ path: "terraform/variables.tf", content: this.generateVariablesTf(vars), description: "Terraform variable definitions" });
    files.push({ path: "terraform/outputs.tf", content: this.generateOutputsTf(outputs), description: "Terraform output definitions" });
    files.push({ path: "terraform/terraform.tfvars.example", content: vars.map(v => `${v.name} = ${v.default || `"<${v.name}>"`}`).join("\n"), description: "Example variable values" });

    const diagramEdges = components
      .map((component, index) => `  TF --> M${index}[${component.module}: ${component.service}]`)
      .join("\n");
    const diagram = `flowchart TD\n  TF[Terraform: ${cloud}]\n${diagramEdges}`;

    const resourceCount = (mainTf.match(/^resource "/gm) || []).length;
    const componentList = components.map(c => `${c.module} (${c.service})`).join(", ");

    return {
      provider: "terraform",
      files,
      variables: vars,
      explanation: `Generated Terraform for ${cloud} with ${resourceCount} resource blocks across ${components.length} contract resources: ${componentList}.`,
      next_steps: "Set required variables (see terraform.tfvars.example), then run sdd_validate_iac to validate the configuration via Terraform MCP.",
      diagram,
    };
  }

  generateValidationPayload(provider: IacProvider, cloud: CloudProvider, iacDir?: string): IacValidationResult {
    const routing: RoutingInstructions = provider === "terraform"
      ? { mcp_server: "terraform", tool_name: "plan", note: "Call Terraform MCP plan/validate with the generated files" }
      : { mcp_server: "azure", tool_name: "validate_template", note: "Call Azure MCP to validate Bicep/ARM template" };
    return {
      provider, cloud,
      payload: { action: "validate", provider, cloud, directory: iacDir || "terraform/" },
      routing_instructions: routing,
      explanation: `Validation payload ready for ${provider} on ${cloud}. Route to ${routing.mcp_server} MCP.`,
    };
  }

  generateDockerfile(
    techStack: { language: string; framework?: string; runtime: string },
    includeCompose: boolean,
    multiStage: boolean,
    services: string[] = []
  ): DevEnvironmentResult {
    const files: IacFile[] = [];
    const dockerfile = renderDockerfile(techStack.language, multiStage);

    files.push({ path: "Dockerfile", content: dockerfile, description: "Application Dockerfile" });

    if (includeCompose) {
      files.push({ path: "docker-compose.yml", content: this.generateCompose(services), description: "Docker Compose configuration" });
    }

    files.push({ path: ".dockerignore", content: "node_modules\ndist\n.git\n*.md\n.specs\n.env*\ncoverage", description: "Docker ignore file" });

    const serviceNote = includeCompose && services.length > 0 ? ` (services: app, ${services.join(", ")})` : "";
    const frameworkLabel = techStack.framework ? ` (${techStack.framework})` : "";
    const composeLabel = includeCompose ? ` with docker-compose.yml${serviceNote}` : "";
    return {
      type: "docker",
      files,
      explanation: `Generated ${multiStage ? "multi-stage " : ""}Dockerfile for ${techStack.language}${frameworkLabel}${composeLabel}.`,
      next_steps: "Run docker build to test the image, or use sdd_setup_local_env to create a full dev environment.",
    };
  }

  generateDevcontainer(techStack: { language: string; framework?: string }, features?: string[], extensions?: string[]): DevEnvironmentResult {
    const lang = techStack.language.toLowerCase();
    let image: string;
    const devFeatures: Record<string, Record<string, string>> = {};
    const devExtensions: string[] = extensions || [];
    let postCreateCommand: string | undefined;

    if (lang.includes("typescript") || lang.includes("javascript")) {
      image = "mcr.microsoft.com/devcontainers/typescript-node:22";
      devExtensions.push("dbaeumer.vscode-eslint", "esbenp.prettier-vscode");
      postCreateCommand = "npm install";
    } else if (lang.includes("python")) {
      image = "mcr.microsoft.com/devcontainers/python:3.12";
      devExtensions.push("ms-python.python", "ms-python.vscode-pylance");
      postCreateCommand = "pip install -r requirements.txt";
    } else if (lang.includes("go")) {
      image = "mcr.microsoft.com/devcontainers/go:1.22";
      devExtensions.push("golang.go");
      postCreateCommand = "go mod download";
    } else {
      throw new Error(`Unsupported devcontainer capability language: ${techStack.language}`);
    }

    if (features) {
      for (const f of features) devFeatures[f] = {};
    }

    const config: Record<string, unknown> = {
      name: "Dev Environment",
      image,
      features: devFeatures,
      customizations: { vscode: { extensions: devExtensions } },
      forwardPorts: [3000],
    };
    // Only known stacks get a package-manager bootstrap; the generic ubuntu
    // image must not hardcode "npm install".
    if (postCreateCommand) config.postCreateCommand = postCreateCommand;

    return {
      type: "devcontainer",
      files: [{ path: ".devcontainer/devcontainer.json", content: JSON.stringify(config, null, 2), description: "Dev container configuration" }],
      explanation: `Generated devcontainer for ${techStack.language}. Open in VS Code or GitHub Codespaces.`,
      next_steps: "Use sdd_setup_codespaces to create a cloud environment, or open locally with 'Dev Containers: Reopen in Container'.",
    };
  }

  // ─── Private helpers ───

  private generateCompose(services: string[]): string {
    // Sanitize service names — they end up as YAML keys.
    const names = services.map(s => s.toLowerCase().replace(/[^a-z0-9_-]/g, "-")).filter(s => s.length > 0);
    const lines: string[] = [
      'version: "3.8"',
      "services:",
      "  app:",
      "    build: .",
      "    ports:",
      '      - "3000:3000"',
      "    environment:",
      "      - NODE_ENV=production",
    ];
    if (names.length > 0) {
      lines.push("    depends_on:");
      for (const name of names) lines.push(`      - ${name}`);
    }
    lines.push("    restart: unless-stopped");

    const volumes: string[] = [];
    for (const name of names) {
      const svc = COMPOSE_SERVICES[name] ?? { image: `${name}:latest`, ports: [] };
      lines.push(`  ${name}:`);
      lines.push(`    image: ${svc.image}`);
      if (svc.environment && svc.environment.length > 0) {
        lines.push("    environment:");
        for (const e of svc.environment) lines.push(`      - ${e}`);
      }
      if (svc.ports.length > 0) {
        lines.push("    ports:");
        for (const p of svc.ports) lines.push(`      - "${p}"`);
      }
      if (svc.volume) {
        lines.push("    volumes:");
        lines.push(`      - ${svc.volume.name}:${svc.volume.mountPath}`);
        volumes.push(svc.volume.name);
      }
      lines.push("    restart: unless-stopped");
    }
    if (volumes.length > 0) {
      lines.push("volumes:");
      for (const v of volumes) lines.push(`  ${v}:`);
    }
    return lines.join("\n");
  }

  private renderCloud(cloud: CloudProvider, components: InfraComponent[]): { mainTf: string; outputs: TfOutput[] } {
    const providerName = cloud === "azure" ? "azurerm" : cloud === "aws" ? "aws" : "google";
    const providerSource = cloud === "azure" ? "hashicorp/azurerm" : cloud === "aws" ? "hashicorp/aws" : "hashicorp/google";
    const providerBlock = cloud === "azure"
      ? 'provider "azurerm" {\n  features {}\n}'
      : cloud === "aws"
        ? 'provider "aws" {\n  region = var.region\n}'
        : 'provider "google" {\n  project = var.project_id\n  region  = var.region\n}';

    const blocks: string[] = [];
    const outputs: TfOutput[] = [];

    if (cloud === "azure") {
      blocks.push(`resource "azurerm_resource_group" "main" {\n  name     = "\${var.project_name}-\${var.environment}-rg"\n  location = var.location\n}`);
      outputs.push({ name: "resource_group_name", description: "Resource group name", value: "azurerm_resource_group.main.name" });
    }

    for (const component of components) {
      const rendered = this.componentResources(cloud, component);
      if (rendered) {
        blocks.push(`# ── Module: ${component.module} (${component.service}) ──\n\n${rendered.hcl}`);
        outputs.push(...rendered.outputs);
      } else {
        blocks.push(`# ── Module: ${component.module} ──\n# No ${cloud} template exists for module "${component.module}" — define its resources in a dedicated .tf file.`);
      }
    }

    const mainTf = `terraform {\n  required_version = ">= 1.5"\n  required_providers {\n    ${providerName} = {\n      source = "${providerSource}"\n    }\n  }\n}\n\n${providerBlock}\n\n${blocks.join("\n\n")}`;
    return { mainTf, outputs };
  }

  private componentResources(cloud: CloudProvider, c: InfraComponent): RenderedComponent | null {
    const key = `${c.module}:${c.service}`;
    if (cloud === "azure") return this.azureComponent(key);
    if (cloud === "aws") return this.awsComponent(key);
    return this.gcpComponent(key);
  }

  private azureComponent(key: string): RenderedComponent | null {
    switch (key) {
      case "networking:network":
        return {
          hcl: `resource "azurerm_virtual_network" "network" {\n  name                = "\${var.project_name}-\${var.environment}-vnet"\n  address_space       = ["10.0.0.0/16"]\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n}\n\nresource "azurerm_subnet" "app" {\n  name                 = "app"\n  resource_group_name  = azurerm_resource_group.main.name\n  virtual_network_name = azurerm_virtual_network.network.name\n  address_prefixes     = ["10.0.1.0/24"]\n}`,
          outputs: [{ name: "network_id", description: "Virtual network ID", value: "azurerm_virtual_network.network.id" }],
        };
      case "compute:container":
        return {
          hcl: `resource "azurerm_container_app_environment" "main" {\n  name                = "\${var.project_name}-\${var.environment}-cae"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n}\n\nresource "azurerm_container_app" "app" {\n  name                         = "\${var.project_name}-\${var.environment}-app"\n  container_app_environment_id = azurerm_container_app_environment.main.id\n  resource_group_name          = azurerm_resource_group.main.name\n  revision_mode                = "Single"\n\n  template {\n    container {\n      name   = var.project_name\n      image  = var.container_image\n      cpu    = 0.25\n      memory = "0.5Gi"\n    }\n  }\n\n  ingress {\n    external_enabled = true\n    target_port      = var.container_port\n  }\n}`,
          outputs: [{ name: "app_fqdn", description: "Container app FQDN", value: "azurerm_container_app.app.latest_revision_fqdn" }],
        };
      case "compute:kubernetes":
        return {
          hcl: `resource "azurerm_kubernetes_cluster" "k8s" {\n  name                = "\${var.project_name}-\${var.environment}-aks"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  dns_prefix          = var.project_name\n\n  default_node_pool {\n    name       = "default"\n    node_count = 1\n    vm_size    = "Standard_B2s"\n  }\n\n  identity {\n    type = "SystemAssigned"\n  }\n}`,
          outputs: [{ name: "kubernetes_cluster_name", description: "AKS cluster name", value: "azurerm_kubernetes_cluster.k8s.name" }],
        };
      case "compute:serverless":
        return {
          hcl: `resource "azurerm_storage_account" "function" {\n  name                     = replace("\${var.project_name}\${var.environment}fn", "-", "")\n  resource_group_name      = azurerm_resource_group.main.name\n  location                 = azurerm_resource_group.main.location\n  account_tier             = "Standard"\n  account_replication_type = "LRS"\n}\n\nresource "azurerm_service_plan" "function" {\n  name                = "\${var.project_name}-\${var.environment}-plan"\n  resource_group_name = azurerm_resource_group.main.name\n  location            = azurerm_resource_group.main.location\n  os_type             = "Linux"\n  sku_name            = "Y1"\n}\n\nresource "azurerm_linux_function_app" "app" {\n  name                       = "\${var.project_name}-\${var.environment}-func"\n  resource_group_name        = azurerm_resource_group.main.name\n  location                   = azurerm_resource_group.main.location\n  service_plan_id            = azurerm_service_plan.function.id\n  storage_account_name       = azurerm_storage_account.function.name\n  storage_account_access_key = azurerm_storage_account.function.primary_access_key\n\n  site_config {}\n}`,
          outputs: [{ name: "function_app_name", description: "Function app name", value: "azurerm_linux_function_app.app.name" }],
        };
      case "database:postgres":
        return {
          hcl: `resource "azurerm_postgresql_flexible_server" "postgres" {\n  name                   = "\${var.project_name}-\${var.environment}-pg"\n  resource_group_name    = azurerm_resource_group.main.name\n  location               = azurerm_resource_group.main.location\n  version                = "16"\n  administrator_login    = var.db_admin_username\n  administrator_password = var.db_admin_password\n  storage_mb             = 32768\n  sku_name               = "B_Standard_B1ms"\n}\n\nresource "azurerm_postgresql_flexible_server_database" "app" {\n  name      = var.project_name\n  server_id = azurerm_postgresql_flexible_server.postgres.id\n}`,
          outputs: [{ name: "postgres_fqdn", description: "PostgreSQL server FQDN", value: "azurerm_postgresql_flexible_server.postgres.fqdn" }],
        };
      case "database:mysql":
        return {
          hcl: `resource "azurerm_mysql_flexible_server" "mysql" {\n  name                   = "\${var.project_name}-\${var.environment}-mysql"\n  resource_group_name    = azurerm_resource_group.main.name\n  location               = azurerm_resource_group.main.location\n  administrator_login    = var.db_admin_username\n  administrator_password = var.db_admin_password\n  sku_name               = "B_Standard_B1ms"\n}`,
          outputs: [{ name: "mysql_fqdn", description: "MySQL server FQDN", value: "azurerm_mysql_flexible_server.mysql.fqdn" }],
        };
      case "database:nosql":
        return {
          hcl: `resource "azurerm_cosmosdb_account" "nosql" {\n  name                = "\${var.project_name}-\${var.environment}-cosmos"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  offer_type          = "Standard"\n  kind                = "GlobalDocumentDB"\n\n  consistency_policy {\n    consistency_level = "Session"\n  }\n\n  geo_location {\n    location          = azurerm_resource_group.main.location\n    failover_priority = 0\n  }\n}`,
          outputs: [{ name: "nosql_endpoint", description: "Cosmos DB endpoint", value: "azurerm_cosmosdb_account.nosql.endpoint" }],
        };
      case "database:sqlserver":
        return {
          hcl: `resource "azurerm_mssql_server" "mssql" {\n  name                         = "\${var.project_name}-\${var.environment}-sql"\n  resource_group_name          = azurerm_resource_group.main.name\n  location                     = azurerm_resource_group.main.location\n  version                      = "12.0"\n  administrator_login          = var.db_admin_username\n  administrator_login_password = var.db_admin_password\n}\n\nresource "azurerm_mssql_database" "app" {\n  name      = var.project_name\n  server_id = azurerm_mssql_server.mssql.id\n  sku_name  = "Basic"\n}`,
          outputs: [{ name: "sqlserver_fqdn", description: "SQL Server FQDN", value: "azurerm_mssql_server.mssql.fully_qualified_domain_name" }],
        };
      case "cache:redis":
        return {
          hcl: `resource "azurerm_redis_cache" "redis" {\n  name                = "\${var.project_name}-\${var.environment}-redis"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  capacity            = 0\n  family              = "C"\n  sku_name            = "Basic"\n  minimum_tls_version = "1.2"\n}`,
          outputs: [{ name: "redis_hostname", description: "Redis cache hostname", value: "azurerm_redis_cache.redis.hostname" }],
        };
      case "storage:object":
        return {
          hcl: `resource "azurerm_storage_account" "storage" {\n  name                     = replace("\${var.project_name}\${var.environment}st", "-", "")\n  resource_group_name      = azurerm_resource_group.main.name\n  location                 = azurerm_resource_group.main.location\n  account_tier             = "Standard"\n  account_replication_type = "LRS"\n}\n\nresource "azurerm_storage_container" "app" {\n  name                  = "app-data"\n  storage_account_name  = azurerm_storage_account.storage.name\n  container_access_type = "private"\n}`,
          outputs: [{ name: "storage_account_id", description: "Storage account ID", value: "azurerm_storage_account.storage.id" }],
        };
      case "messaging:queue":
        return {
          hcl: `resource "azurerm_servicebus_namespace" "queue" {\n  name                = "\${var.project_name}-\${var.environment}-bus"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  sku                 = "Basic"\n}\n\nresource "azurerm_servicebus_queue" "app" {\n  name         = "\${var.project_name}-queue"\n  namespace_id = azurerm_servicebus_namespace.queue.id\n}`,
          outputs: [{ name: "servicebus_namespace_id", description: "Service Bus namespace ID", value: "azurerm_servicebus_namespace.queue.id" }],
        };
      case "identity:identity":
        return {
          hcl: `resource "azurerm_user_assigned_identity" "app" {\n  name                = "\${var.project_name}-\${var.environment}-id"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n}`,
          outputs: [{ name: "identity_client_id", description: "Managed identity client ID", value: "azurerm_user_assigned_identity.app.client_id" }],
        };
      case "monitoring:logs":
        return {
          hcl: `resource "azurerm_log_analytics_workspace" "logs" {\n  name                = "\${var.project_name}-\${var.environment}-logs"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  sku                 = "PerGB2018"\n  retention_in_days   = 30\n}\n\nresource "azurerm_application_insights" "app" {\n  name                = "\${var.project_name}-\${var.environment}-appi"\n  location            = azurerm_resource_group.main.location\n  resource_group_name = azurerm_resource_group.main.name\n  workspace_id        = azurerm_log_analytics_workspace.logs.id\n  application_type    = "web"\n}`,
          outputs: [{ name: "log_analytics_workspace_id", description: "Log Analytics workspace ID", value: "azurerm_log_analytics_workspace.logs.id" }],
        };
      default:
        return null;
    }
  }

  private awsComponent(key: string): RenderedComponent | null {
    switch (key) {
      case "networking:network":
        return {
          hcl: `resource "aws_vpc" "network" {\n  cidr_block           = "10.0.0.0/16"\n  enable_dns_support   = true\n  enable_dns_hostnames = true\n\n  tags = {\n    Name = "\${var.project_name}-\${var.environment}"\n  }\n}\n\nresource "aws_subnet" "app" {\n  vpc_id     = aws_vpc.network.id\n  cidr_block = "10.0.1.0/24"\n\n  tags = {\n    Name = "\${var.project_name}-\${var.environment}-app"\n  }\n}`,
          outputs: [{ name: "vpc_id", description: "VPC ID", value: "aws_vpc.network.id" }],
        };
      case "compute:container":
        return {
          hcl: `resource "aws_ecs_cluster" "app" {\n  name = "\${var.project_name}-\${var.environment}"\n}\n\nresource "aws_ecs_task_definition" "app" {\n  family                   = "\${var.project_name}-\${var.environment}"\n  requires_compatibilities = ["FARGATE"]\n  network_mode             = "awsvpc"\n  cpu                      = "256"\n  memory                   = "512"\n\n  container_definitions = jsonencode([\n    {\n      name      = var.project_name\n      image     = var.container_image\n      essential = true\n      portMappings = [\n        {\n          containerPort = var.container_port\n        }\n      ]\n    }\n  ])\n}`,
          outputs: [{ name: "ecs_cluster_arn", description: "ECS cluster ARN", value: "aws_ecs_cluster.app.arn" }],
        };
      case "compute:kubernetes":
        return {
          hcl: `resource "aws_iam_role" "eks" {\n  name = "\${var.project_name}-\${var.environment}-eks"\n\n  assume_role_policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [\n      {\n        Action    = "sts:AssumeRole"\n        Effect    = "Allow"\n        Principal = { Service = "eks.amazonaws.com" }\n      }\n    ]\n  })\n}\n\nresource "aws_eks_cluster" "k8s" {\n  name     = "\${var.project_name}-\${var.environment}"\n  role_arn = aws_iam_role.eks.arn\n\n  vpc_config {\n    subnet_ids = var.subnet_ids\n  }\n}`,
          outputs: [{ name: "kubernetes_cluster_name", description: "EKS cluster name", value: "aws_eks_cluster.k8s.name" }],
        };
      case "compute:serverless":
        return {
          hcl: `resource "aws_iam_role" "lambda" {\n  name = "\${var.project_name}-\${var.environment}-lambda"\n\n  assume_role_policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [\n      {\n        Action    = "sts:AssumeRole"\n        Effect    = "Allow"\n        Principal = { Service = "lambda.amazonaws.com" }\n      }\n    ]\n  })\n}\n\nresource "aws_lambda_function" "app" {\n  function_name = "\${var.project_name}-\${var.environment}"\n  role          = aws_iam_role.lambda.arn\n  package_type  = "Image"\n  image_uri     = var.container_image\n}`,
          outputs: [{ name: "lambda_function_name", description: "Lambda function name", value: "aws_lambda_function.app.function_name" }],
        };
      case "database:postgres":
        return {
          hcl: `resource "aws_db_instance" "postgres" {\n  identifier          = "\${var.project_name}-\${var.environment}-pg"\n  engine              = "postgres"\n  engine_version      = "16"\n  instance_class      = "db.t3.micro"\n  allocated_storage   = 20\n  db_name             = replace(var.project_name, "-", "")\n  username            = var.db_admin_username\n  password            = var.db_admin_password\n  skip_final_snapshot = true\n}`,
          outputs: [{ name: "postgres_endpoint", description: "PostgreSQL endpoint", value: "aws_db_instance.postgres.endpoint" }],
        };
      case "database:mysql":
        return {
          hcl: `resource "aws_db_instance" "mysql" {\n  identifier          = "\${var.project_name}-\${var.environment}-mysql"\n  engine              = "mysql"\n  engine_version      = "8.0"\n  instance_class      = "db.t3.micro"\n  allocated_storage   = 20\n  db_name             = replace(var.project_name, "-", "")\n  username            = var.db_admin_username\n  password            = var.db_admin_password\n  skip_final_snapshot = true\n}`,
          outputs: [{ name: "mysql_endpoint", description: "MySQL endpoint", value: "aws_db_instance.mysql.endpoint" }],
        };
      case "database:nosql":
        return {
          hcl: `resource "aws_dynamodb_table" "nosql" {\n  name         = "\${var.project_name}-\${var.environment}"\n  billing_mode = "PAY_PER_REQUEST"\n  hash_key     = "id"\n\n  attribute {\n    name = "id"\n    type = "S"\n  }\n}`,
          outputs: [{ name: "dynamodb_table_name", description: "DynamoDB table name", value: "aws_dynamodb_table.nosql.name" }],
        };
      case "database:sqlserver":
        return {
          hcl: `resource "aws_db_instance" "mssql" {\n  identifier          = "\${var.project_name}-\${var.environment}-sql"\n  engine              = "sqlserver-ex"\n  instance_class      = "db.t3.small"\n  allocated_storage   = 20\n  license_model       = "license-included"\n  username            = var.db_admin_username\n  password            = var.db_admin_password\n  skip_final_snapshot = true\n}`,
          outputs: [{ name: "sqlserver_endpoint", description: "SQL Server endpoint", value: "aws_db_instance.mssql.endpoint" }],
        };
      case "cache:redis":
        return {
          hcl: `resource "aws_elasticache_cluster" "redis" {\n  cluster_id      = "\${var.project_name}-\${var.environment}-redis"\n  engine          = "redis"\n  node_type       = "cache.t3.micro"\n  num_cache_nodes = 1\n}`,
          outputs: [{ name: "redis_endpoint", description: "Redis endpoint address", value: "aws_elasticache_cluster.redis.cache_nodes[0].address" }],
        };
      case "storage:object":
        return {
          hcl: `resource "aws_s3_bucket" "storage" {\n  bucket = "\${var.project_name}-\${var.environment}-data"\n}\n\nresource "aws_s3_bucket_versioning" "storage" {\n  bucket = aws_s3_bucket.storage.id\n\n  versioning_configuration {\n    status = "Enabled"\n  }\n}`,
          outputs: [{ name: "s3_bucket_name", description: "S3 bucket name", value: "aws_s3_bucket.storage.bucket" }],
        };
      case "messaging:queue":
        return {
          hcl: `resource "aws_sqs_queue" "queue" {\n  name = "\${var.project_name}-\${var.environment}-queue"\n}`,
          outputs: [{ name: "sqs_queue_url", description: "SQS queue URL", value: "aws_sqs_queue.queue.url" }],
        };
      case "identity:identity":
        return {
          hcl: `resource "aws_iam_role" "app" {\n  name = "\${var.project_name}-\${var.environment}-app"\n\n  assume_role_policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [\n      {\n        Action    = "sts:AssumeRole"\n        Effect    = "Allow"\n        Principal = { Service = "ecs-tasks.amazonaws.com" }\n      }\n    ]\n  })\n}`,
          outputs: [{ name: "app_role_arn", description: "Application IAM role ARN", value: "aws_iam_role.app.arn" }],
        };
      case "monitoring:logs":
        return {
          hcl: `resource "aws_cloudwatch_log_group" "logs" {\n  name              = "/app/\${var.project_name}-\${var.environment}"\n  retention_in_days = 30\n}`,
          outputs: [{ name: "log_group_name", description: "CloudWatch log group name", value: "aws_cloudwatch_log_group.logs.name" }],
        };
      default:
        return null;
    }
  }

  private gcpComponent(key: string): RenderedComponent | null {
    switch (key) {
      case "networking:network":
        return {
          hcl: `resource "google_compute_network" "network" {\n  name                    = "\${var.project_name}-\${var.environment}"\n  auto_create_subnetworks = false\n}\n\nresource "google_compute_subnetwork" "app" {\n  name          = "\${var.project_name}-\${var.environment}-app"\n  network       = google_compute_network.network.id\n  ip_cidr_range = "10.0.1.0/24"\n  region        = var.region\n}`,
          outputs: [{ name: "network_id", description: "VPC network ID", value: "google_compute_network.network.id" }],
        };
      case "compute:container":
      case "compute:serverless":
        // Cloud Run is GCP's serverless container platform — it covers both flavors.
        return {
          hcl: `resource "google_cloud_run_v2_service" "app" {\n  name     = "\${var.project_name}-\${var.environment}"\n  location = var.region\n\n  template {\n    containers {\n      image = var.container_image\n\n      ports {\n        container_port = var.container_port\n      }\n    }\n  }\n}`,
          outputs: [{ name: "cloud_run_url", description: "Cloud Run service URL", value: "google_cloud_run_v2_service.app.uri" }],
        };
      case "compute:kubernetes":
        return {
          hcl: `resource "google_container_cluster" "k8s" {\n  name             = "\${var.project_name}-\${var.environment}"\n  location         = var.region\n  enable_autopilot = true\n}`,
          outputs: [{ name: "kubernetes_cluster_name", description: "GKE cluster name", value: "google_container_cluster.k8s.name" }],
        };
      case "database:postgres":
        return {
          hcl: `resource "google_sql_database_instance" "postgres" {\n  name             = "\${var.project_name}-\${var.environment}-pg"\n  database_version = "POSTGRES_16"\n  region           = var.region\n\n  settings {\n    tier = "db-f1-micro"\n  }\n}\n\nresource "google_sql_user" "postgres" {\n  name     = var.db_admin_username\n  instance = google_sql_database_instance.postgres.name\n  password = var.db_admin_password\n}`,
          outputs: [{ name: "postgres_connection_name", description: "Cloud SQL connection name", value: "google_sql_database_instance.postgres.connection_name" }],
        };
      case "database:mysql":
        return {
          hcl: `resource "google_sql_database_instance" "mysql" {\n  name             = "\${var.project_name}-\${var.environment}-mysql"\n  database_version = "MYSQL_8_0"\n  region           = var.region\n\n  settings {\n    tier = "db-f1-micro"\n  }\n}\n\nresource "google_sql_user" "mysql" {\n  name     = var.db_admin_username\n  instance = google_sql_database_instance.mysql.name\n  password = var.db_admin_password\n}`,
          outputs: [{ name: "mysql_connection_name", description: "Cloud SQL connection name", value: "google_sql_database_instance.mysql.connection_name" }],
        };
      case "database:nosql":
        return {
          hcl: `resource "google_firestore_database" "nosql" {\n  name        = "\${var.project_name}-\${var.environment}"\n  location_id = var.region\n  type        = "FIRESTORE_NATIVE"\n}`,
          outputs: [{ name: "firestore_database_name", description: "Firestore database name", value: "google_firestore_database.nosql.name" }],
        };
      case "database:sqlserver":
        return {
          hcl: `resource "google_sql_database_instance" "mssql" {\n  name             = "\${var.project_name}-\${var.environment}-sql"\n  database_version = "SQLSERVER_2019_EXPRESS"\n  region           = var.region\n  root_password    = var.db_admin_password\n\n  settings {\n    tier = "db-custom-1-3840"\n  }\n}`,
          outputs: [{ name: "sqlserver_connection_name", description: "Cloud SQL connection name", value: "google_sql_database_instance.mssql.connection_name" }],
        };
      case "cache:redis":
        return {
          hcl: `resource "google_redis_instance" "redis" {\n  name           = "\${var.project_name}-\${var.environment}-redis"\n  memory_size_gb = 1\n  region         = var.region\n}`,
          outputs: [{ name: "redis_host", description: "Redis instance host", value: "google_redis_instance.redis.host" }],
        };
      case "storage:object":
        return {
          hcl: `resource "google_storage_bucket" "storage" {\n  name                        = "\${var.project_name}-\${var.environment}-data"\n  location                    = var.region\n  uniform_bucket_level_access = true\n}`,
          outputs: [{ name: "bucket_name", description: "Storage bucket name", value: "google_storage_bucket.storage.name" }],
        };
      case "messaging:queue":
        return {
          hcl: `resource "google_pubsub_topic" "queue" {\n  name = "\${var.project_name}-\${var.environment}"\n}\n\nresource "google_pubsub_subscription" "app" {\n  name  = "\${var.project_name}-\${var.environment}-sub"\n  topic = google_pubsub_topic.queue.id\n}`,
          outputs: [{ name: "pubsub_topic_id", description: "Pub/Sub topic ID", value: "google_pubsub_topic.queue.id" }],
        };
      case "identity:identity":
        return {
          hcl: `resource "google_service_account" "app" {\n  account_id   = "\${var.project_name}-app"\n  display_name = "\${var.project_name} application"\n}`,
          outputs: [{ name: "service_account_email", description: "Service account email", value: "google_service_account.app.email" }],
        };
      case "monitoring:logs":
        return {
          hcl: `resource "google_logging_metric" "logs" {\n  name   = "\${var.project_name}-\${var.environment}-errors"\n  filter = "severity>=ERROR"\n\n  metric_descriptor {\n    metric_kind = "DELTA"\n    value_type  = "INT64"\n  }\n}`,
          outputs: [{ name: "logging_metric_name", description: "Log-based metric name", value: "google_logging_metric.logs.name" }],
        };
      default:
        return null;
    }
  }

  private generateVariables(cloud: CloudProvider, components: InfraComponent[]): IacVariable[] {
    const vars: IacVariable[] = [
      { name: "project_name", type: "string", description: "Project name", required: true },
      { name: "environment", type: "string", description: "Environment (dev/staging/prod)", default: '"dev"', required: false },
    ];
    if (cloud === "azure") vars.push({ name: "location", type: "string", description: "Azure region", default: '"eastus2"', required: false });
    if (cloud === "aws") vars.push({ name: "region", type: "string", description: "AWS region", default: '"us-east-1"', required: false });
    if (cloud === "gcp") {
      vars.push({ name: "project_id", type: "string", description: "GCP project ID", required: true });
      vars.push({ name: "region", type: "string", description: "GCP region", default: '"us-central1"', required: false });
    }

    const needsContainerVars = components.some(
      c => c.module === "compute" && (c.service === "container" || (c.service === "serverless" && cloud !== "azure"))
    );
    if (needsContainerVars) {
      vars.push({ name: "container_image", type: "string", description: "Container image to deploy", default: '"nginx:latest"', required: false });
      vars.push({ name: "container_port", type: "number", description: "Port the application listens on", default: "3000", required: false });
    }

    const needsDbCredentials = components.some(
      c => c.module === "database" && ["postgres", "mysql", "sqlserver"].includes(c.service)
    );
    if (needsDbCredentials) {
      vars.push({ name: "db_admin_username", type: "string", description: "Database administrator login", default: '"sddadmin"', required: false });
      vars.push({ name: "db_admin_password", type: "string", description: "Database administrator password (sensitive)", required: true });
    }

    if (cloud === "aws" && components.some(c => c.module === "compute" && c.service === "kubernetes")) {
      vars.push({ name: "subnet_ids", type: "list(string)", description: "Subnet IDs for the EKS cluster", required: true });
    }

    return vars;
  }

  private generateVariablesTf(vars: IacVariable[]): string {
    return vars
      .map(v => {
        const sensitive = /password|secret/.test(v.name) ? "  sensitive   = true\n" : "";
        return `variable "${v.name}" {\n  type        = ${v.type}\n  description = "${v.description}"\n${sensitive}${v.default ? `  default     = ${v.default}\n` : ""}}`;
      })
      .join("\n\n");
  }

  private generateOutputsTf(outputs: TfOutput[]): string {
    if (outputs.length === 0) return "# No outputs defined for the detected components.";
    return outputs
      .map(o => `output "${o.name}" {\n  description = "${o.description}"\n  value       = ${o.value}\n}`)
      .join("\n\n");
  }
}
