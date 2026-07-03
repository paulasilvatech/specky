/**
 * Environment Tools — sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import {} from "../constants.js";
import type { TechStack } from "../types.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { IacGenerator, DesignTechStack } from "../services/iac-generator.js";
import { detectServicesFromDesign, detectTechStackFromDesign } from "../services/iac-generator.js";
import type { CodebaseScanner } from "../services/codebase-scanner.js";
import {
  setupLocalEnvInputSchema,
  setupCodespacesInputSchema,
  generateDevcontainerInputSchema,
} from "../schemas/environment.js";
import { enrichResponse } from "./response-builder.js";

/** Read the feature's DESIGN.md; returns "" when the feature or file is absent. */
async function readFeatureDesign(
  fileManager: FileManager,
  specDir: string,
  featureNumber: string
): Promise<string> {
  try {
    const features = await fileManager.listFeatures(specDir);
    const feature = features.find((f) => f.number === featureNumber);
    if (!feature) return "";
    return await fileManager.readSpecFile(feature.directory, "DESIGN.md");
  } catch {
    return "";
  }
}

function designToTechStack(design: DesignTechStack): TechStack {
  switch (design.language) {
    case "Python":
      return { language: "Python", framework: design.framework, package_manager: "pip", runtime: "Python" };
    case "Go":
      return { language: "Go", framework: design.framework, package_manager: "go modules", runtime: "Go" };
    case "Java":
      return { language: "Java", framework: design.framework, package_manager: "maven", runtime: "JVM" };
    default:
      return { language: design.language, framework: design.framework, package_manager: "npm", runtime: "Node.js" };
  }
}

/**
 * Resolve the tech stack: codebase manifests first, DESIGN.md prose as the
 * fallback (the schemas promise DESIGN.md-based detection, so a DESIGN-only
 * workspace must not degrade to a generic ubuntu environment).
 */
async function resolveTechStack(
  codebaseScanner: CodebaseScanner,
  designContent: string
): Promise<{ stack: TechStack; source: "codebase" | "DESIGN.md" | "none" }> {
  const scanned = await codebaseScanner.detectTechStack();
  if (scanned.language !== "unknown") return { stack: scanned, source: "codebase" };
  const fromDesign = detectTechStackFromDesign(designContent);
  if (fromDesign) return { stack: designToTechStack(fromDesign), source: "DESIGN.md" };
  return { stack: scanned, source: "none" };
}

export function registerEnvironmentTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  iacGenerator: IacGenerator,
  codebaseScanner: CodebaseScanner
): void {
  // ─── sdd_setup_local_env ───
  server.registerTool(
    "sdd_setup_local_env",
    {
      title: "Setup Local Dev Environment",
      description:
        "Detects the project tech stack (codebase manifests, falling back to DESIGN.md) and generates a Docker-based local development environment (Dockerfile + docker-compose.yml with auto-detected sidecar services). Returns a payload with routing_instructions for Docker MCP to create and manage containers.",
      inputSchema: setupLocalEnvInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number, spec_dir, services, port }) => {
      try {
        const designContent = await readFeatureDesign(fileManager, spec_dir, feature_number);
        const { stack: techStack, source: techStackSource } = await resolveTechStack(
          codebaseScanner,
          designContent
        );

        // Sidecar services: explicit list wins; otherwise auto-detect from
        // DESIGN.md keywords + package.json dependencies (as the schema promises).
        let packageJson = "";
        try {
          packageJson = await fileManager.readProjectFile("package.json");
        } catch {
          // No package.json — DESIGN.md keywords only
        }
        const additionalServices =
          services && services.length > 0
            ? services
            : detectServicesFromDesign(designContent, packageJson);

        const envResult = iacGenerator.generateDockerfile(
          { language: techStack.language, framework: techStack.framework, runtime: techStack.runtime },
          true, // includeCompose
          true, // multiStage
          additionalServices
        );

        const result = {
          status: "local_env_generated",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: techStackSource,
          type: envResult.type,
          files: envResult.files,
          port,
          additional_services: additionalServices,
          services_source: services && services.length > 0 ? "explicit" : "auto-detected (DESIGN.md + package.json)",
          routing_instructions: {
            mcp_server: "docker",
            tool_name: "compose_up",
            note: "Route this payload to Docker MCP to build and start the local development environment.",
          },
          explanation: envResult.explanation,
          next_steps: "The AI client should route the generated Docker files to Docker MCP's compose tools to start the environment.",
          learning_note: "Local dev environments use Docker Compose to orchestrate multiple services. The generated Dockerfile uses multi-stage builds for smaller production images.",
        };

        const enriched = await enrichResponse("sdd_setup_local_env", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_setup_local_env", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_setup_codespaces ───
  server.registerTool(
    "sdd_setup_codespaces",
    {
      title: "Setup GitHub Codespaces",
      description:
        "Detects the project tech stack (codebase manifests, falling back to DESIGN.md) and generates a devcontainer configuration suitable for GitHub Codespaces. Returns the devcontainer.json payload with routing_instructions to commit it via GitHub MCP, plus the GitHub UI/CLI/API steps to create the Codespace (the official GitHub MCP does not expose Codespace creation).",
      inputSchema: setupCodespacesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number, spec_dir, machine_type, extensions }) => {
      try {
        const designContent = await readFeatureDesign(fileManager, spec_dir, feature_number);
        const { stack: techStack, source: techStackSource } = await resolveTechStack(
          codebaseScanner,
          designContent
        );

        const envResult = iacGenerator.generateDevcontainer(
          { language: techStack.language, framework: techStack.framework },
          undefined, // features auto-detected
          extensions
        );

        const result = {
          status: "codespaces_config_generated",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: techStackSource,
          machine_type,
          type: envResult.type,
          files: envResult.files,
          routing_instructions: {
            mcp_server: "github",
            tool_name: "create_or_update_file",
            note:
              "Commit the generated config to .devcontainer/devcontainer.json on the target branch (GitHub MCP: create_or_update_file or push_files). " +
              "The official GitHub MCP exposes no Codespace-creation tool — after committing, create the Codespace via the GitHub UI (Code → Codespaces → 'Create codespace'), " +
              `the GitHub CLI ('gh codespace create --repo <owner>/<repo> --machine ${machine_type}'), or the REST API ('POST /repos/{owner}/{repo}/codespaces').`,
          },
          explanation: envResult.explanation,
          next_steps:
            "1. Commit .devcontainer/devcontainer.json to the repository (GitHub MCP create_or_update_file or push_files). " +
            `2. Create the Codespace with machine type '${machine_type}' via the GitHub UI (Code → Codespaces → 'Create codespace'), ` +
            `'gh codespace create --repo <owner>/<repo> --machine ${machine_type}', or 'POST /repos/{owner}/{repo}/codespaces'.`,
          learning_note: "GitHub Codespaces provides cloud-hosted dev environments. The devcontainer.json defines the container image, extensions, and port forwarding.",
        };

        const enriched = await enrichResponse("sdd_setup_codespaces", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_setup_codespaces", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_generate_devcontainer ───
  server.registerTool(
    "sdd_generate_devcontainer",
    {
      title: "Generate Devcontainer Config",
      description:
        "Generates .devcontainer/devcontainer.json from the detected tech stack (codebase manifests, falling back to DESIGN.md). Writes the file to disk for local use with VS Code Dev Containers or GitHub Codespaces.",
      inputSchema: generateDevcontainerInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, base_image, features: devFeatures }) => {
      try {
        const designContent = await readFeatureDesign(fileManager, spec_dir, feature_number);
        const { stack: techStack, source: techStackSource } = await resolveTechStack(
          codebaseScanner,
          designContent
        );

        const envResult = iacGenerator.generateDevcontainer(
          { language: techStack.language, framework: techStack.framework },
          devFeatures,
          undefined // extensions auto-detected
        );

        // Write the devcontainer.json file
        const devcontainerFile = envResult.files.find(f => f.path.includes("devcontainer.json"));
        let writtenPath = "";
        if (devcontainerFile) {
          // If a custom base_image was specified, patch the config
          let content = devcontainerFile.content;
          if (base_image) {
            try {
              const config = JSON.parse(content);
              config.image = base_image;
              content = JSON.stringify(config, null, 2);
            } catch {
              // Leave content as-is if parsing fails
            }
          }
          writtenPath = await fileManager.writeSpecFile(
            ".devcontainer",
            "devcontainer.json",
            content,
            true
          );
        }

        const result = {
          status: "devcontainer_written",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: techStackSource,
          file: writtenPath || ".devcontainer/devcontainer.json",
          files: envResult.files,
          explanation: envResult.explanation,
          next_steps: "Open the project in VS Code and use 'Dev Containers: Reopen in Container' or push to GitHub for Codespaces.",
          learning_note: "The devcontainer.json specification defines reproducible development environments. It supports custom features, extensions, and lifecycle hooks.",
        };

        const enriched = await enrichResponse("sdd_generate_devcontainer", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_devcontainer", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
