import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOL_NAMES } from "../constants.js";
import {
    figmaDiagramInputSchema,
    generateAllDiagramsInputSchema,
    generateDiagramInputSchema,
    generateUserStoriesInputSchema,
} from "../schemas/visualization.js";
import type { DiagramGenerator } from "../services/diagram-generator.js";
import { requireExecutionContext } from "../services/execution-context.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { UserStoriesResult, UserStory } from "../types.js";
import { extractRequirementIds } from "../utils/id-contracts.js";
import { enrichResponse } from "./response-builder.js";
import { formatError, truncate } from "./tool-result.js";

const SOURCE_TO_FILE = {
    spec: "SPECIFICATION.md",
    design: "DESIGN.md",
    tasks: "TASKS.md",
    constitution: "CONSTITUTION.md",
} as const;

const MERMAID_HEADERS: Record<string, RegExp> = {
    flowchart: /^flowchart\s+/,
    sequence: /^sequenceDiagram\b/,
    class: /^classDiagram\b/,
    er: /^erDiagram\b/,
    state: /^stateDiagram(?:-v2)?\b/,
    c4_context: /^(?:C4Context|flowchart)\b/,
    c4_container: /^(?:C4Container|flowchart)\b/,
    c4_component: /^(?:C4Component|flowchart)\b/,
    c4_code: /^(?:classDiagram|flowchart)\b/,
    activity: /^(?:flowchart|stateDiagram)\b/,
    use_case: /^flowchart\s+/,
    dfd: /^flowchart\s+/,
    deployment: /^flowchart\s+/,
    network_topology: /^flowchart\s+/,
    gantt: /^gantt\b/,
    pie: /^pie\b/,
    mindmap: /^mindmap\b/,
};

function validateDiagramEvidence(
    diagramType: string,
    mermaidCode: string,
    evidenceRefs: string[],
    sourceContent: string,
): void {
    if (!MERMAID_HEADERS[diagramType]?.test(mermaidCode.trim())) {
        throw new Error(`Diagram ${diagramType} has an incompatible Mermaid header.`);
    }
    const source = sourceContent.toLowerCase();
    const missing = evidenceRefs.filter((reference) => !source.includes(reference.toLowerCase()));
    if (missing.length > 0) {
        throw new Error(`Diagram ${diagramType} evidence is absent from its source: ${missing.join(", ")}.`);
    }
}

function errorResponse(toolName: string, error: unknown) {
    return {
        content: [{ type: "text" as const, text: formatError(toolName, error as Error) }],
        isError: true,
    };
}

async function sourceArtifact(
    fileManager: FileManager,
    featureDir: string,
    source: keyof typeof SOURCE_TO_FILE,
): Promise<string> {
    const fileName = SOURCE_TO_FILE[source];
    try {
        return await fileManager.readSpecFile(featureDir, fileName);
    } catch {
        throw new Error(`${fileName} is required as diagram evidence in ${featureDir}.`);
    }
}

export function registerVisualizationTools(
    server: McpServer,
    fileManager: FileManager,
    stateMachine: StateMachine,
    diagramGenerator: DiagramGenerator,
): void {
    server.registerTool(
        TOOL_NAMES.GENERATE_DIAGRAM,
        {
            title: "Validate Contracted Mermaid Diagram",
            description: "Validates explicit Mermaid code and source evidence for one diagram type required by the selected workload contract. No diagram content is synthesized.",
            inputSchema: generateDiagramInputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async ({ diagram_type, mermaid_code, evidence_refs }) => {
            try {
                const context = requireExecutionContext(TOOL_NAMES.GENERATE_DIAGRAM);
                const required = context.state!.contract.required_diagrams.find((diagram) => diagram.type === diagram_type);
                if (!required) {
                    throw new Error(
                        `Diagram ${diagram_type} is not required by ${context.state!.contract.id}. ` +
                        `Allowed: ${context.state!.contract.required_diagrams.map((diagram) => diagram.type).join(", ")}.`,
                    );
                }
                const source = await sourceArtifact(fileManager, context.feature!.directory, required.source);
                validateDiagramEvidence(diagram_type, mermaid_code, evidence_refs, source);
                const result = await enrichResponse(
                    TOOL_NAMES.GENERATE_DIAGRAM,
                    {
                        type: diagram_type,
                        title: required.title,
                        mermaid_code,
                        source: required.source,
                        evidence_refs,
                        feature_number: context.featureNumber,
                        contract_id: context.state!.contract.id,
                    },
                    stateMachine,
                    context.stateDir!,
                );
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return errorResponse(TOOL_NAMES.GENERATE_DIAGRAM, error);
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_ALL_DIAGRAMS,
        {
            title: "Write All Contracted Mermaid Diagrams",
            description: "Validates the exact workload-required diagram set and its source evidence, then writes DIAGRAMS.md. Missing, extra, duplicate, or ungrounded inputs fail before writing.",
            inputSchema: generateAllDiagramsInputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ diagrams: inputs, force }) => {
            try {
                const context = requireExecutionContext(TOOL_NAMES.GENERATE_ALL_DIAGRAMS);
                const required = context.state!.contract.required_diagrams;
                const requiredTypes = required.map((diagram) => diagram.type);
                const inputTypes = inputs.map((diagram) => diagram.diagram_type);
                const missing = requiredTypes.filter((type) => !inputTypes.includes(type));
                const extra = inputTypes.filter((type) => !requiredTypes.includes(type));
                const duplicates = inputTypes.filter((type, index) => inputTypes.indexOf(type) !== index);
                if (missing.length > 0 || extra.length > 0 || duplicates.length > 0) {
                    throw new Error(
                        `Diagram set mismatch. Missing: ${missing.join(", ") || "none"}. ` +
                        `Extra: ${extra.join(", ") || "none"}. ` +
                        `Duplicate: ${[...new Set(duplicates)].join(", ") || "none"}.`,
                    );
                }

                const diagrams = [];
                for (const contract of required) {
                    const input = inputs.find((candidate) => candidate.diagram_type === contract.type)!;
                    const source = await sourceArtifact(fileManager, context.feature!.directory, contract.source);
                    validateDiagramEvidence(contract.type, input.mermaid_code, input.evidence_refs, source);
                    diagrams.push({
                        type: contract.type,
                        title: contract.title,
                        source: contract.source,
                        mermaid_code: input.mermaid_code,
                        evidence_refs: input.evidence_refs,
                    });
                }

                const body = diagrams.map((diagram) => [
                    `## ${diagram.title}`,
                    "",
                    `**Type:** ${diagram.type}`,
                    `**Source:** ${diagram.source}`,
                    `**Evidence:** ${diagram.evidence_refs.join(", ")}`,
                    "",
                    "```mermaid",
                    diagram.mermaid_code,
                    "```",
                ].join("\n")).join("\n\n---\n\n");
                const path = await fileManager.writeSpecFile(
                    context.feature!.directory,
                    "DIAGRAMS.md",
                    `# ${context.feature!.name} — Required Diagrams\n\n${body}\n`,
                    force,
                );
                const result = await enrichResponse(
                    TOOL_NAMES.GENERATE_ALL_DIAGRAMS,
                    {
                        feature_number: context.featureNumber,
                        diagrams,
                        total_generated: diagrams.length,
                        diagrams_file: path,
                        contract_id: context.state!.contract.id,
                    },
                    stateMachine,
                    context.stateDir!,
                );
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return errorResponse(TOOL_NAMES.GENERATE_ALL_DIAGRAMS, error);
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.GENERATE_USER_STORIES,
        {
            title: "Assemble Explicit Web User Stories",
            description: "Validates one explicit story binding per Specification requirement for web-application workloads and assembles deterministic flowcharts from provided steps.",
            inputSchema: generateUserStoriesInputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async ({ stories: inputs }) => {
            try {
                const context = requireExecutionContext(TOOL_NAMES.GENERATE_USER_STORIES);
                if (context.state!.contract.workload !== "web-application") {
                    throw new Error(
                        `${TOOL_NAMES.GENERATE_USER_STORIES} requires workload web-application; received ${context.state!.contract.workload}.`,
                    );
                }
                const spec = await sourceArtifact(fileManager, context.feature!.directory, "spec");
                const requirementIds = new Set(extractRequirementIds(spec));
                const boundIds = new Set(inputs.map((story) => story.requirement_id));
                const unknown = [...boundIds].filter((id) => !requirementIds.has(id));
                const missing = [...requirementIds].filter((id) => !boundIds.has(id));
                if (unknown.length > 0 || missing.length > 0) {
                    throw new Error(
                        `User-story bindings mismatch. Missing: ${missing.join(", ") || "none"}. ` +
                        `Unknown: ${unknown.join(", ") || "none"}.`,
                    );
                }

                const stories: UserStory[] = inputs.map((story) => ({
                    id: story.requirement_id,
                    title: story.goal,
                    description: `As ${story.role}, I want ${story.goal} so that ${story.benefit}.`,
                    priority: story.priority,
                    acceptance_criteria: story.acceptance_criteria,
                    independent_test: story.independent_test,
                    flow_diagram: diagramGenerator.generateUserStoryFlow(story.goal, story.flow_steps),
                }));
                const result: UserStoriesResult & { contract_id: string } = {
                    stories,
                    total_count: stories.length,
                    diagram: diagramGenerator.generateUserStoryFlow(
                        `${context.feature!.name} User Journeys`,
                        stories.map((story) => story.title),
                    ),
                    explanation: `Assembled ${stories.length} explicit story bindings for ${requirementIds.size} requirements.`,
                    contract_id: context.state!.contract.id,
                };
                const enriched = await enrichResponse(
                    TOOL_NAMES.GENERATE_USER_STORIES,
                    result as unknown as Record<string, unknown>,
                    stateMachine,
                    context.stateDir!,
                );
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
            } catch (error) {
                return errorResponse(TOOL_NAMES.GENERATE_USER_STORIES, error);
            }
        },
    );

    server.registerTool(
        TOOL_NAMES.FIGMA_DIAGRAM,
        {
            title: "Validate Explicit FigJam Diagram Payload",
            description: "Validates caller-provided FigJam nodes, connections, diagram type, and DESIGN.md evidence against the persisted Figma capability. No nodes or connections are inferred.",
            inputSchema: figmaDiagramInputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        },
        async ({ diagram_type, nodes, connections, evidence_refs }) => {
            try {
                const context = requireExecutionContext(TOOL_NAMES.FIGMA_DIAGRAM);
                const figma = context.state!.contract.capability_config.figma!;
                if (!figma.diagram_types.includes(diagram_type)) {
                    throw new Error(
                        `FigJam diagram ${diagram_type} is not enabled by ${context.state!.contract.id}. ` +
                        `Allowed: ${figma.diagram_types.join(", ")}.`,
                    );
                }
                const design = await sourceArtifact(fileManager, context.feature!.directory, "design");
                const missingEvidence = evidence_refs.filter(
                    (reference) => !design.toLowerCase().includes(reference.toLowerCase()),
                );
                if (missingEvidence.length > 0) {
                    throw new Error(`FigJam evidence is absent from DESIGN.md: ${missingEvidence.join(", ")}.`);
                }
                const nodeIds = new Set(nodes.map((node) => node.id));
                if (connections.some((connection) => !nodeIds.has(connection.from) || !nodeIds.has(connection.to))) {
                    throw new Error("Every FigJam connection endpoint must reference a declared node ID.");
                }
                const payload = {
                    feature_number: context.featureNumber,
                    feature_name: context.feature!.name,
                    diagram_type,
                    title: `${context.feature!.name} — ${diagram_type.replaceAll("_", " ")}`,
                    figjam_structure: { nodes, connections },
                    evidence_refs,
                    routing_instructions: {
                        target_tool: "Figma MCP generate_diagram",
                        note: "Forward the validated nodes and connections without modification.",
                    },
                    contract_id: context.state!.contract.id,
                };
                const result = await enrichResponse(
                    TOOL_NAMES.FIGMA_DIAGRAM,
                    payload,
                    stateMachine,
                    context.stateDir!,
                );
                return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
            } catch (error) {
                return errorResponse(TOOL_NAMES.FIGMA_DIAGRAM, error);
            }
        },
    );
}
