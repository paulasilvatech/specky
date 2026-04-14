/**
 * Infrastructure Tools — sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { IacGenerator } from "../services/iac-generator.js";
import {
  generateIacInputSchema,
  validateIacInputSchema,
  generateDockerfileInputSchema,
} from "../schemas/infrastructure.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerInfrastructureTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  iacGenerator: IacGenerator
): void {
  // ─── sdd_generate_iac ───
  server.registerTool(
    "sdd_generate_iac",
    {
      title: "Generate Infrastructure as Code",
      description:
        "Reads DESIGN.md to detect infrastructure needs and generates Terraform or Bicep files. Returns generated file contents, variables, and a Mermaid diagram of the infrastructure topology.",
      inputSchema: generateIacInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, cloud, modules }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}.\n→ Fix: Run sdd_discover first to create the feature directory.`
          );
        }

        // Read DESIGN.md to detect infrastructure needs
        try {
          await fileManager.readSpecFile(feature.directory, "DESIGN.md");
        } catch {
          // DESIGN.md is optional; generator will use defaults
        }

        const iacResult = await iacGenerator.generateTerraform(
          feature.directory,
          cloud,
          modules
        );

        // Write generated files to feature directory
        const writtenPaths: string[] = [];
        for (const file of iacResult.files) {
          const filePath = await fileManager.writeSpecFile(
            feature.directory,
            file.path,
            file.content,
            true
          );
          writtenPaths.push(filePath);
        }

        const result = {
          provider: iacResult.provider,
          cloud,
          files: iacResult.files.map((f) => ({
            path: f.path,
            description: f.description,
          })),
          variables: iacResult.variables,
          diagram: iacResult.diagram,
          written_paths: writtenPaths,
          explanation: iacResult.explanation,
          next_steps: iacResult.next_steps,
          learning_note:
            "Infrastructure as Code (IaC) defines cloud resources in declarative configuration files. " +
            "Terraform uses HCL (HashiCorp Configuration Language) with a plan-apply workflow: " +
            "'terraform plan' previews changes, 'terraform apply' provisions them. " +
            "Variables allow reuse across environments (dev/staging/prod). " +
            "State files track deployed resources so Terraform knows what exists.",
        };

        const enriched = await enrichResponse("sdd_generate_iac", result, stateMachine, spec_dir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_iac", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_validate_iac ───
  server.registerTool(
    "sdd_validate_iac",
    {
      title: "Validate Infrastructure as Code",
      description:
        "Generates a validation payload for Terraform MCP (plan/validate) or Azure MCP (template validation). The AI client routes this payload to the appropriate MCP server for execution.",
      inputSchema: validateIacInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number, spec_dir, provider, cloud, iac_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}.\n→ Fix: Run sdd_discover first to create the feature directory.`
          );
        }

        const resolvedDir = iac_dir || join(feature.directory, "terraform");
        const validationResult = iacGenerator.generateValidationPayload(
          provider,
          cloud,
          resolvedDir
        );

        const result = {
          provider: validationResult.provider,
          cloud: validationResult.cloud,
          payload: validationResult.payload,
          routing_instructions: validationResult.routing_instructions,
          explanation: validationResult.explanation,
          learning_note:
            "IaC validation checks configuration syntax, resource compatibility, and provider constraints " +
            "before any infrastructure is provisioned. Terraform uses 'terraform validate' for syntax and " +
            "'terraform plan' for a dry-run preview. Azure uses ARM/Bicep template validation. " +
            "Always validate before applying to catch misconfigurations early.",
        };

        const enriched = await enrichResponse("sdd_validate_iac", result, stateMachine, spec_dir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_validate_iac", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_generate_dockerfile ───
  server.registerTool(
    "sdd_generate_dockerfile",
    {
      title: "Generate Dockerfile",
      description:
        "Reads DESIGN.md or uses sdd_scan_codebase results to detect the tech stack, then generates a Dockerfile and optionally a docker-compose.yml. Supports multi-stage builds for smaller production images.",
      inputSchema: generateDockerfileInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, include_compose, multi_stage }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(
            `Feature ${feature_number} not found in ${spec_dir}.\n→ Fix: Run sdd_discover first to create the feature directory.`
          );
        }

        // Detect tech stack from DESIGN.md
        let designContent = "";
        try {
          designContent = await fileManager.readSpecFile(feature.directory, "DESIGN.md");
        } catch {
          // DESIGN.md is optional; fall back to defaults
        }

        const techStack = detectTechStack(designContent);

        const dockerResult = iacGenerator.generateDockerfile(
          techStack,
          include_compose,
          multi_stage
        );

        // Write generated files to feature directory
        const writtenPaths: string[] = [];
        for (const file of dockerResult.files) {
          const filePath = await fileManager.writeSpecFile(
            feature.directory,
            file.path,
            file.content,
            true
          );
          writtenPaths.push(filePath);
        }

        const result = {
          type: dockerResult.type,
          tech_stack: techStack,
          files: dockerResult.files.map((f) => ({
            path: f.path,
            description: f.description,
            content: f.content,
          })),
          written_paths: writtenPaths,
          explanation: dockerResult.explanation,
          next_steps: dockerResult.next_steps,
          learning_note:
            "Containers package an application with all its dependencies into an isolated, portable unit. " +
            "A Dockerfile defines the build steps: base image, dependency installation, code copy, and startup command. " +
            "Multi-stage builds use separate build and runtime stages to produce smaller production images " +
            "by excluding build tools and source code from the final image. " +
            "docker-compose.yml orchestrates multiple containers (app, database, cache) as a single stack.",
        };

        const enriched = await enrichResponse("sdd_generate_dockerfile", result, stateMachine, spec_dir);
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_dockerfile", error as Error) }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Detects tech stack from DESIGN.md content using keyword matching.
 * Falls back to TypeScript/Node.js if nothing is detected.
 */
function detectTechStack(designContent: string): {
  language: string;
  framework?: string;
  runtime: string;
} {
  const lower = designContent.toLowerCase();

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

  if (/\bgo\b|\bgolang\b/.test(lower)) {
    const framework = /\bgin\b/.test(lower)
      ? "Gin"
      : /\becho\b/.test(lower)
        ? "Echo"
        : undefined;
    return { language: "Go", framework, runtime: "go1.22" };
  }

  if (/\bjava\b/.test(lower) && !/\bjavascript\b/.test(lower)) {
    const framework = /\bspring\b/.test(lower) ? "Spring Boot" : undefined;
    return { language: "Java", framework, runtime: "java21" };
  }

  // Default: TypeScript/Node.js
  const framework = /\bnext\.?js\b/.test(lower)
    ? "Next.js"
    : /\bexpress\b/.test(lower)
      ? "Express"
      : /\bfastify\b/.test(lower)
        ? "Fastify"
        : undefined;
  return { language: "TypeScript", framework, runtime: "node22" };
}
