/**
 * Documentation Tools — sdd_generate_docs, sdd_generate_api_docs, sdd_generate_runbook, sdd_generate_onboarding.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { DocGenerator } from "../services/doc-generator.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

const docsInputSchema = z.object({
  feature_number: z.string().regex(/^\d{3}$/).describe("Zero-padded feature number."),
  spec_dir: z.string().min(1).default(".specs").describe("Spec directory."),
}).strict();

export function registerDocumentationTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  docGenerator: DocGenerator
): void {
  // ─── sdd_generate_docs ───
  server.registerTool(
    "sdd_generate_docs",
    {
      title: "Generate Full Documentation",
      description:
        "Generates comprehensive feature documentation from SPECIFICATION.md, DESIGN.md, TASKS.md, and ANALYSIS.md. Writes a combined Markdown file to docs/ with all sections.",
      inputSchema: docsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const docResult = await docGenerator.generateFullDocs(feature.directory, feature_number);

        const writtenPath = await fileManager.writeSpecFile(
          "docs",
          docResult.file_path.replace("docs/", ""),
          docResult.content,
          true
        );

        const result = {
          status: "docs_generated",
          type: docResult.type,
          file: writtenPath,
          sections: docResult.sections,
          content: docResult.content,
          explanation: docResult.explanation,
          next_steps: "Review the generated documentation and refine sections as needed. Consider generating API docs or a runbook for operational teams.",
          learning_note: "Full documentation combines all SDD artifacts into a single reference. It includes specification, architecture, implementation plan, and quality analysis.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_docs", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_generate_api_docs ───
  server.registerTool(
    "sdd_generate_api_docs",
    {
      title: "Generate API Documentation",
      description:
        "Extracts API endpoints from DESIGN.md and generates structured API documentation with request/response examples. Writes to docs/api-{feature}.md.",
      inputSchema: docsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const docResult = await docGenerator.generateApiDocs(feature.directory, feature_number);

        const writtenPath = await fileManager.writeSpecFile(
          "docs",
          docResult.file_path.replace("docs/", ""),
          docResult.content,
          true
        );

        const result = {
          status: "api_docs_generated",
          type: docResult.type,
          file: writtenPath,
          sections: docResult.sections,
          content: docResult.content,
          explanation: docResult.explanation,
          next_steps: "Review endpoint documentation for accuracy. Add request/response examples and error codes for each endpoint.",
          learning_note: "API documentation is auto-extracted from DESIGN.md endpoint definitions. Keep DESIGN.md up to date to maintain accurate API docs.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_api_docs", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_generate_runbook ───
  server.registerTool(
    "sdd_generate_runbook",
    {
      title: "Generate Operational Runbook",
      description:
        "Generates an operational runbook with deployment, monitoring, troubleshooting, and rollback procedures. Writes to docs/runbook-{feature}.md.",
      inputSchema: docsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const docResult = await docGenerator.generateRunbook(feature.directory, feature_number);

        const writtenPath = await fileManager.writeSpecFile(
          "docs",
          docResult.file_path.replace("docs/", ""),
          docResult.content,
          true
        );

        const result = {
          status: "runbook_generated",
          type: docResult.type,
          file: writtenPath,
          sections: docResult.sections,
          content: docResult.content,
          explanation: docResult.explanation,
          next_steps: "Customize the runbook with environment-specific details, monitoring URLs, and escalation contacts.",
          learning_note: "Operational runbooks reduce MTTR by providing structured troubleshooting guides. Keep them updated as infrastructure changes.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_runbook", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_generate_onboarding ───
  server.registerTool(
    "sdd_generate_onboarding",
    {
      title: "Generate Onboarding Guide",
      description:
        "Generates a developer onboarding guide with feature overview, architecture summary, getting started steps, key concepts, and file locations. Writes to docs/onboarding-{feature}.md.",
      inputSchema: docsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const docResult = await docGenerator.generateOnboarding(feature.directory, feature_number);

        const writtenPath = await fileManager.writeSpecFile(
          "docs",
          docResult.file_path.replace("docs/", ""),
          docResult.content,
          true
        );

        const result = {
          status: "onboarding_generated",
          type: docResult.type,
          file: writtenPath,
          sections: docResult.sections,
          content: docResult.content,
          explanation: docResult.explanation,
          next_steps: "Share with new team members. Add team-specific setup instructions and communication channels.",
          learning_note: "Onboarding guides accelerate ramp-up time for new developers. They provide context that code alone cannot convey.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_generate_onboarding", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
