/**
 * Environment Tools — sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import type { TechStack } from "../types.js";
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
import { requireExecutionContext } from "../services/execution-context.js";

function configuredTechStack(environment: {
  language: string;
  framework?: string;
  runtime: string;
  package_manager: string;
}): TechStack {
  return {
    language: environment.language,
    framework: environment.framework,
    runtime: environment.runtime,
    package_manager: environment.package_manager,
  };
}

function applyDevcontainerContract(
  files: Array<{ path: string; content: string; description: string }>,
  baseImage: string,
  port: number,
): Array<{ path: string; content: string; description: string }> {
  return files.map((file) => {
    if (!file.path.includes("devcontainer.json")) return file;
    const config = JSON.parse(file.content) as Record<string, unknown>;
    config["image"] = baseImage;
    config["forwardPorts"] = [port];
    return { ...file, content: JSON.stringify(config, null, 2) };
  });
}

export function registerEnvironmentTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  iacGenerator: IacGenerator,
  _codebaseScanner: CodebaseScanner
): void {
  // ─── sdd_setup_local_env ───
  server.registerTool(
    "sdd_setup_local_env",
    {
      title: "Setup Local Dev Environment",
      description:
        "Generates a Docker-based local environment from the persisted dev-environment capability: exact stack, services, port, compose, and multi-stage policy. Returns Docker MCP routing without starting containers.",
      inputSchema: setupLocalEnvInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number }) => {
      try {
        const context = requireExecutionContext("sdd_setup_local_env");
        const stateDir = context.stateDir!;
        const environment = context.state!.contract.capability_config["dev-environment"]!;
        const techStack = configuredTechStack(environment);

        const envResult = iacGenerator.generateDockerfile(
          { language: techStack.language, framework: techStack.framework, runtime: techStack.runtime },
          environment.include_compose,
          environment.multi_stage,
          environment.services,
        );

        const result = {
          status: "local_env_generated",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: "feature contract",
          type: envResult.type,
          files: envResult.files,
          port: environment.port,
          additional_services: environment.services,
          services_source: "feature contract",
          routing_instructions: {
            mcp_server: "docker",
            tool_name: "compose_up",
            note: "Route this payload to Docker MCP to build and start the local development environment.",
          },
          explanation: envResult.explanation,
          next_steps: "The AI client should route the generated Docker files to Docker MCP's compose tools to start the environment.",
          learning_note: "Local dev environments use Docker Compose to orchestrate multiple services. The generated Dockerfile uses multi-stage builds for smaller production images.",
        };

        const enriched = await enrichResponse("sdd_setup_local_env", result, stateMachine, stateDir);
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
        "Generates Codespaces configuration from persisted dev-environment image, features, extensions, port, stack, and machine parameters. Returns commit and external creation routing; it does not create a Codespace.",
      inputSchema: setupCodespacesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number }) => {
      try {
        const context = requireExecutionContext("sdd_setup_codespaces");
        const stateDir = context.stateDir!;
        const environment = context.state!.contract.capability_config["dev-environment"]!;
        const techStack = configuredTechStack(environment);

        const envResult = iacGenerator.generateDevcontainer(
          { language: techStack.language, framework: techStack.framework },
          environment.features,
          environment.extensions,
        );
        const files = applyDevcontainerContract(envResult.files, environment.base_image, environment.port);

        const result = {
          status: "codespaces_config_generated",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: "feature contract",
          machine_type: environment.codespaces_machine,
          type: envResult.type,
          files,
          routing_instructions: {
            mcp_server: "github",
            tool_name: "create_or_update_file",
            note:
              "Commit the generated config to .devcontainer/devcontainer.json on the target branch (GitHub MCP: create_or_update_file or push_files). " +
              "The official GitHub MCP exposes no Codespace-creation tool — after committing, create the Codespace via the GitHub UI (Code → Codespaces → 'Create codespace'), " +
              `the GitHub CLI ('gh codespace create --repo <owner>/<repo> --machine ${environment.codespaces_machine}'), or the REST API ('POST /repos/{owner}/{repo}/codespaces').`,
          },
          explanation: envResult.explanation,
          next_steps:
            "1. Commit .devcontainer/devcontainer.json to the repository (GitHub MCP create_or_update_file or push_files). " +
            `2. Create the Codespace with machine type '${environment.codespaces_machine}' via the GitHub UI (Code → Codespaces → 'Create codespace'), ` +
            `'gh codespace create --repo <owner>/<repo> --machine ${environment.codespaces_machine}', or 'POST /repos/{owner}/{repo}/codespaces'.`,
          learning_note: "GitHub Codespaces provides cloud-hosted dev environments. The devcontainer.json defines the container image, extensions, and port forwarding.",
        };

        const enriched = await enrichResponse("sdd_setup_codespaces", result, stateMachine, stateDir);
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
        "Writes .devcontainer/devcontainer.json from the persisted dev-environment capability. Unsupported or incomplete stacks fail rather than producing a generic image.",
      inputSchema: generateDevcontainerInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number }) => {
      try {
        const context = requireExecutionContext("sdd_generate_devcontainer");
        const stateDir = context.stateDir!;
        const environment = context.state!.contract.capability_config["dev-environment"]!;
        const techStack = configuredTechStack(environment);

        const envResult = iacGenerator.generateDevcontainer(
          { language: techStack.language, framework: techStack.framework },
          environment.features,
          environment.extensions,
        );
        const files = applyDevcontainerContract(envResult.files, environment.base_image, environment.port);

        // Write the devcontainer.json file
        const devcontainerFile = files.find(f => f.path.includes("devcontainer.json"));
        let writtenPath = "";
        if (devcontainerFile) {
          writtenPath = await fileManager.writeSpecFile(
            ".devcontainer",
            "devcontainer.json",
            devcontainerFile.content,
            true
          );
        }

        const result = {
          status: "devcontainer_written",
          feature_number,
          tech_stack: techStack,
          tech_stack_source: "feature contract",
          file: writtenPath || ".devcontainer/devcontainer.json",
          files,
          explanation: envResult.explanation,
          next_steps: "Open the project in VS Code and use 'Dev Containers: Reopen in Container' or push to GitHub for Codespaces.",
          learning_note: "The devcontainer.json specification defines reproducible development environments. It supports custom features, extensions, and lifecycle hooks.",
        };

        const enriched = await enrichResponse("sdd_generate_devcontainer", result, stateMachine, stateDir);
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
