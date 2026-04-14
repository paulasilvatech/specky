/**
 * Environment Tools — sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { IacGenerator } from "../services/iac-generator.js";
import type { CodebaseScanner } from "../services/codebase-scanner.js";
import {
  setupLocalEnvInputSchema,
  setupCodespacesInputSchema,
  generateDevcontainerInputSchema,
} from "../schemas/environment.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
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
        "Detects the project tech stack and generates a Docker-based local development environment (Dockerfile + docker-compose.yml). Returns a payload with routing_instructions for Docker MCP to create and manage containers.",
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
        const techStack = await codebaseScanner.detectTechStack();

        const envResult = iacGenerator.generateDockerfile(
          { language: techStack.language, framework: techStack.framework, runtime: techStack.runtime },
          true, // includeCompose
          true  // multiStage
        );

        const result = {
          status: "local_env_generated",
          feature_number,
          tech_stack: techStack,
          type: envResult.type,
          files: envResult.files,
          port,
          additional_services: services || [],
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
        "Detects the project tech stack and generates a devcontainer configuration suitable for GitHub Codespaces. Returns a payload with routing_instructions for GitHub MCP's create_codespace tool.",
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
        const techStack = await codebaseScanner.detectTechStack();

        const envResult = iacGenerator.generateDevcontainer(
          { language: techStack.language, framework: techStack.framework },
          undefined, // features auto-detected
          extensions
        );

        const result = {
          status: "codespaces_config_generated",
          feature_number,
          tech_stack: techStack,
          machine_type,
          type: envResult.type,
          files: envResult.files,
          routing_instructions: {
            mcp_server: "github",
            tool_name: "create_codespace",
            note: "Route this payload to GitHub MCP's create_codespace tool to provision a cloud development environment.",
          },
          explanation: envResult.explanation,
          next_steps: "The AI client should route the devcontainer config to GitHub MCP to create a Codespace with the specified machine type.",
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
        "Generates .devcontainer/devcontainer.json from the detected tech stack and DESIGN.md. Writes the file to disk for local use with VS Code Dev Containers or GitHub Codespaces.",
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
        const techStack = await codebaseScanner.detectTechStack();

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
