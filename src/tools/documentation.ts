import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TOOL_NAMES } from "../constants.js";
import type { DocumentationConfig } from "../contracts/use-case.js";
import { featureNumberSchema, forceSchema, specDirSchema } from "../schemas/common.js";
import type { DocGenerator } from "../services/doc-generator.js";
import { requireExecutionContext } from "../services/execution-context.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { DocumentationResult } from "../types.js";
import { enrichResponse } from "./response-builder.js";
import { formatError, truncate } from "./tool-result.js";

const documentationInputSchema = z.object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    force: forceSchema,
}).strict();

type DocumentationType = DocumentationConfig["types"][number];

type SingleDocumentationTool =
    | typeof TOOL_NAMES.GENERATE_DOCS
    | typeof TOOL_NAMES.GENERATE_API_DOCS
    | typeof TOOL_NAMES.GENERATE_RUNBOOK
    | typeof TOOL_NAMES.GENERATE_ONBOARDING;

function documentationConfig(toolName: string): {
    featureDir: string;
    featureNumber: string;
    stateDir: string;
    config: DocumentationConfig;
} {
    const context = requireExecutionContext(toolName);
    const release = context.state!.contract.capability_config.release!;
    return {
        featureDir: context.feature!.directory,
        featureNumber: context.featureNumber!,
        stateDir: context.stateDir!,
        config: release.documentation,
    };
}

async function generateSingle(
    toolName: SingleDocumentationTool,
    type: Exclude<DocumentationType, "journey">,
    docGenerator: DocGenerator,
): Promise<DocumentationResult> {
    const context = documentationConfig(toolName);
    switch (type) {
        case "full":
            return docGenerator.generateFullDocs(context.featureDir, context.featureNumber, context.config);
        case "api":
            return docGenerator.generateApiDocs(context.featureDir, context.featureNumber, context.config);
        case "runbook":
            return docGenerator.generateRunbook(context.featureDir, context.featureNumber, context.config);
        case "onboarding":
            return docGenerator.generateOnboarding(context.featureDir, context.featureNumber, context.config);
        default:
            throw new Error(`Unsupported single documentation type: ${String(type)}`);
    }
}

async function writeSingle(
    toolName: SingleDocumentationTool,
    type: Exclude<DocumentationType, "journey">,
    force: boolean,
    fileManager: FileManager,
    stateMachine: StateMachine,
    docGenerator: DocGenerator,
): Promise<Record<string, unknown>> {
    const context = documentationConfig(toolName);
    const document = await generateSingle(toolName, type, docGenerator);
    const fileName = document.file_path.replace(/^docs\//, "");
    const writtenPath = await fileManager.writeSpecFile("docs", fileName, document.content, force);
    return enrichResponse(
        toolName,
        {
            status: `${type}_documentation_generated`,
            contract_id: requireExecutionContext(toolName).state!.contract.id,
            documentation_version: context.config.version,
            type: document.type,
            file: writtenPath,
            sections: document.sections,
            content: document.content,
            explanation: document.explanation,
        },
        stateMachine,
        context.stateDir,
    );
}

export function registerDocumentationTools(
    server: McpServer,
    fileManager: FileManager,
    stateMachine: StateMachine,
    docGenerator: DocGenerator,
): void {
    server.registerTool(
        TOOL_NAMES.GENERATE_DOCS,
        {
            title: "Generate Contracted Feature Documentation",
            description: "Assembles full feature documentation only when release.documentation enables full and all required specification, design, task, and analysis evidence exists.",
            inputSchema: documentationInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ force }) => {
            try {
                const result = await writeSingle(TOOL_NAMES.GENERATE_DOCS, "full", force, fileManager, stateMachine, docGenerator);
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: formatError(TOOL_NAMES.GENERATE_DOCS, error as Error) }], isError: true };
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_API_DOCS,
        {
            title: "Generate Contracted API Documentation",
            description: "Assembles API documentation from complete DESIGN.md endpoint contracts and the persisted API base URL; available only to API workloads with api documentation enabled.",
            inputSchema: documentationInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ force }) => {
            try {
                const result = await writeSingle(TOOL_NAMES.GENERATE_API_DOCS, "api", force, fileManager, stateMachine, docGenerator);
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: formatError(TOOL_NAMES.GENERATE_API_DOCS, error as Error) }], isError: true };
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_RUNBOOK,
        {
            title: "Generate Contracted Operational Runbook",
            description: "Assembles deployment, health, monitoring, troubleshooting, rollback, and support procedures from DESIGN.md evidence and persisted release documentation parameters.",
            inputSchema: documentationInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ force }) => {
            try {
                const result = await writeSingle(TOOL_NAMES.GENERATE_RUNBOOK, "runbook", force, fileManager, stateMachine, docGenerator);
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: formatError(TOOL_NAMES.GENERATE_RUNBOOK, error as Error) }], isError: true };
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_ONBOARDING,
        {
            title: "Generate Contracted Developer Onboarding",
            description: "Assembles onboarding from feature requirements, architecture, tasks, persisted setup steps, and support contacts; no package-manager or platform steps are inferred.",
            inputSchema: documentationInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ force }) => {
            try {
                const result = await writeSingle(TOOL_NAMES.GENERATE_ONBOARDING, "onboarding", force, fileManager, stateMachine, docGenerator);
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: formatError(TOOL_NAMES.GENERATE_ONBOARDING, error as Error) }], isError: true };
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_ALL_DOCS,
        {
            title: "Generate All Contracted Documentation",
            description: "Prevalidates every documentation type enabled by release.documentation, then writes the complete set atomically. Any generation or write failure leaves the prior docs unchanged.",
            inputSchema: documentationInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ force }) => {
            try {
                const context = documentationConfig(TOOL_NAMES.GENERATE_ALL_DOCS);
                const generated = await docGenerator.generateAllDocs(
                    context.featureDir,
                    context.featureNumber,
                    context.config,
                );
                const writtenPaths = await fileManager.writeSpecFiles(
                    generated.results.map((document) => ({
                        directory: "docs",
                        fileName: document.file_path.replace(/^docs\//, ""),
                        content: document.content,
                    })),
                    force,
                );
                const result = await enrichResponse(
                    TOOL_NAMES.GENERATE_ALL_DOCS,
                    {
                        status: "all_contracted_documentation_generated",
                        contract_id: requireExecutionContext(TOOL_NAMES.GENERATE_ALL_DOCS).state!.contract.id,
                        documentation_version: context.config.version,
                        total_generated: generated.total_generated,
                        total_sections: generated.total_sections,
                        files: generated.results.map((document, index) => ({
                            type: document.type,
                            path: writtenPaths[index],
                            sections: document.sections,
                        })),
                    },
                    stateMachine,
                    context.stateDir,
                );
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return { content: [{ type: "text" as const, text: formatError(TOOL_NAMES.GENERATE_ALL_DOCS, error as Error) }], isError: true };
            }
        },
    );
}
