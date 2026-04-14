/**
 * IacGenerator — Generates Terraform/Bicep and Dockerfile from DESIGN.md.
 * Deterministic template-based generation.
 */
import type { FileManager } from "./file-manager.js";
import type { IacResult, IacFile, IacVariable, IacValidationResult, DevEnvironmentResult, RoutingInstructions, IacProvider, CloudProvider } from "../types.js";

export class IacGenerator {
  constructor(private fileManager: FileManager) {}

  async generateTerraform(featureDir: string, cloud: CloudProvider, modules?: string[]): Promise<IacResult> {
    let designContent = "";
    try { designContent = await this.fileManager.readSpecFile(featureDir, "DESIGN.md"); } catch { /* empty */ }

    const detectedModules = modules || this.detectModules(designContent);
    const files: IacFile[] = [];
    const variables: IacVariable[] = [];

    // main.tf
    files.push({ path: "terraform/main.tf", content: this.generateMainTf(cloud, detectedModules), description: "Main Terraform configuration" });
    // variables.tf
    const vars = this.generateVariables(cloud, detectedModules);
    variables.push(...vars);
    files.push({ path: "terraform/variables.tf", content: this.generateVariablesTf(vars), description: "Terraform variable definitions" });
    // outputs.tf
    files.push({ path: "terraform/outputs.tf", content: this.generateOutputsTf(detectedModules), description: "Terraform output definitions" });
    // terraform.tfvars.example
    files.push({ path: "terraform/terraform.tfvars.example", content: vars.map(v => `${v.name} = ${v.default || `"<${v.name}>"`}`).join("\n"), description: "Example variable values" });

    const diagram = `flowchart TD\n  TF[Terraform] --> ${detectedModules.map((m, i) => `M${i}[${m}]`).join("\n  TF --> ")}`;

    return {
      provider: "terraform",
      files,
      variables: vars,
      explanation: `Generated Terraform for ${cloud} with ${detectedModules.length} modules: ${detectedModules.join(", ")}`,
      next_steps: "Run sdd_validate_iac to validate the Terraform configuration via Terraform MCP.",
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

  generateDockerfile(techStack: { language: string; framework?: string; runtime: string }, includeCompose: boolean, multiStage: boolean): DevEnvironmentResult {
    const files: IacFile[] = [];
    const lang = techStack.language.toLowerCase();

    let dockerfile = "";
    if (lang.includes("typescript") || lang.includes("javascript")) {
      dockerfile = multiStage
        ? `FROM node:22-slim AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-slim\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY --from=builder /app/package.json ./\nEXPOSE 3000\nCMD ["node", "dist/index.js"]`
        : `FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["node", "dist/index.js"]`;
    } else if (lang.includes("python")) {
      dockerfile = multiStage
        ? `FROM python:3.12-slim AS builder\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\n\nFROM python:3.12-slim\nWORKDIR /app\nCOPY --from=builder /app .\nEXPOSE 8000\nCMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]`
        : `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]`;
    } else {
      dockerfile = `FROM ubuntu:22.04\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["./start.sh"]`;
    }

    files.push({ path: "Dockerfile", content: dockerfile, description: "Application Dockerfile" });

    if (includeCompose) {
      const compose = `version: "3.8"\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=production\n    restart: unless-stopped`;
      files.push({ path: "docker-compose.yml", content: compose, description: "Docker Compose configuration" });
    }

    files.push({ path: ".dockerignore", content: "node_modules\ndist\n.git\n*.md\n.specs\n.env*\ncoverage", description: "Docker ignore file" });

    return {
      type: "docker",
      files,
      explanation: `Generated ${multiStage ? "multi-stage " : ""}Dockerfile for ${techStack.language}${techStack.framework ? ` (${techStack.framework})` : ""}${includeCompose ? " with docker-compose.yml" : ""}.`,
      next_steps: "Run docker build to test the image, or use sdd_setup_local_env to create a full dev environment.",
    };
  }

  generateDevcontainer(techStack: { language: string; framework?: string }, features?: string[], extensions?: string[]): DevEnvironmentResult {
    const lang = techStack.language.toLowerCase();
    let image = "mcr.microsoft.com/devcontainers/base:ubuntu";
    const devFeatures: Record<string, Record<string, string>> = {};
    const devExtensions: string[] = extensions || [];

    if (lang.includes("typescript") || lang.includes("javascript")) {
      image = "mcr.microsoft.com/devcontainers/typescript-node:22";
      devExtensions.push("dbaeumer.vscode-eslint", "esbenp.prettier-vscode");
    } else if (lang.includes("python")) {
      image = "mcr.microsoft.com/devcontainers/python:3.12";
      devExtensions.push("ms-python.python", "ms-python.vscode-pylance");
    } else if (lang.includes("go")) {
      image = "mcr.microsoft.com/devcontainers/go:1.22";
      devExtensions.push("golang.go");
    }

    if (features) {
      for (const f of features) devFeatures[f] = {};
    }

    const config = {
      name: "Dev Environment",
      image,
      features: devFeatures,
      customizations: { vscode: { extensions: devExtensions } },
      forwardPorts: [3000],
      postCreateCommand: lang.includes("python") ? "pip install -r requirements.txt" : "npm install",
    };

    return {
      type: "devcontainer",
      files: [{ path: ".devcontainer/devcontainer.json", content: JSON.stringify(config, null, 2), description: "Dev container configuration" }],
      explanation: `Generated devcontainer for ${techStack.language}. Open in VS Code or GitHub Codespaces.`,
      next_steps: "Use sdd_setup_codespaces to create a cloud environment, or open locally with 'Dev Containers: Reopen in Container'.",
    };
  }

  // ─── Private helpers ───

  private detectModules(designContent: string): string[] {
    const modules: string[] = [];
    const patterns: Record<string, RegExp> = {
      networking: /\b(vpc|vnet|subnet|network|load.?balancer|cdn|dns|firewall)\b/i,
      compute: /\b(vm|container|kubernetes|aks|ecs|app.?service|function|lambda|compute)\b/i,
      database: /\b(database|db|sql|cosmos|dynamo|postgres|mysql|redis|mongo|storage.?account)\b/i,
      storage: /\b(blob|s3|bucket|file.?share|storage)\b/i,
      identity: /\b(identity|iam|rbac|entra|active.?directory|cognito|auth)\b/i,
      monitoring: /\b(monitor|log|metric|alert|insight|grafana|datadog|observability)\b/i,
    };
    for (const [name, regex] of Object.entries(patterns)) {
      if (regex.test(designContent)) modules.push(name);
    }
    return modules.length > 0 ? modules : ["compute", "networking"];
  }

  private generateMainTf(cloud: CloudProvider, modules: string[]): string {
    const provider = cloud === "azure" ? 'provider "azurerm" {\n  features {}\n}' : cloud === "aws" ? 'provider "aws" {\n  region = var.region\n}' : 'provider "google" {\n  project = var.project_id\n}';
    const resources = modules.map(m => `# Module: ${m}\n# TODO: Add ${m} resources`).join("\n\n");
    return `terraform {\n  required_version = ">= 1.5"\n  required_providers {\n    ${cloud === "azure" ? 'azurerm' : cloud === "aws" ? 'aws' : 'google'} = {\n      source = "${cloud === "azure" ? 'hashicorp/azurerm' : cloud === "aws" ? 'hashicorp/aws' : 'hashicorp/google'}"\n    }\n  }\n}\n\n${provider}\n\n${resources}`;
  }

  private generateVariables(cloud: CloudProvider, _modules: string[]): IacVariable[] {
    const vars: IacVariable[] = [
      { name: "project_name", type: "string", description: "Project name", required: true },
      { name: "environment", type: "string", description: "Environment (dev/staging/prod)", default: '"dev"', required: false },
    ];
    if (cloud === "azure") vars.push({ name: "location", type: "string", description: "Azure region", default: '"eastus2"', required: false });
    if (cloud === "aws") vars.push({ name: "region", type: "string", description: "AWS region", default: '"us-east-1"', required: false });
    return vars;
  }

  private generateVariablesTf(vars: IacVariable[]): string {
    return vars.map(v => `variable "${v.name}" {\n  type        = ${v.type}\n  description = "${v.description}"\n${v.default ? `  default     = ${v.default}\n` : ""}}`).join("\n\n");
  }

  private generateOutputsTf(modules: string[]): string {
    return modules.map(m => `output "${m}_id" {\n  description = "${m} resource ID"\n  value       = "" # TODO\n}`).join("\n\n");
  }
}
