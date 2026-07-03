/**
 * Visualization Tools — sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
import {} from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { DiagramGenerator } from "../services/diagram-generator.js";
import type { UserStory, UserStoriesResult } from "../types.js";
import { enrichResponse } from "./response-builder.js";
import {
  generateDiagramInputSchema,
  generateAllDiagramsInputSchema,
  generateUserStoriesInputSchema,
  figmaDiagramInputSchema,
} from "../schemas/visualization.js";

const SOURCE_TO_FILE: Record<string, string> = {
  spec: "SPECIFICATION.md",
  design: "DESIGN.md",
  tasks: "TASKS.md",
  constitution: "CONSTITUTION.md",
};

export function registerVisualizationTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  diagramGenerator: DiagramGenerator
): void {
  // ─── sdd_generate_diagram ───
  server.registerTool(
    "sdd_generate_diagram",
    {
      title: "Generate Mermaid Diagram",
      description:
        "Generates a single Mermaid diagram from a specification artifact. Supports 17 diagram types: flowchart, sequence, class, ER, state machine, C4 context, C4 container, C4 component, C4 code, activity, use case, DFD (data flow), deployment, network topology, Gantt, pie chart, and mind map.",
      inputSchema: generateDiagramInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, diagram_type, source }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Feature ${feature_number} not found in ${spec_dir}.`,
                  fix: "Run sdd_init first to create the feature directory.",
                }),
              },
            ],
          };
        }

        const fileName = SOURCE_TO_FILE[source];
        if (!fileName) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `Unknown source: ${source}` }),
              },
            ],
          };
        }

        let content: string;
        try {
          content = await fileManager.readSpecFile(feature.directory, fileName);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `${fileName} not found in ${feature.directory}.`,
                  fix: `Run the appropriate SDD pipeline tool to generate ${fileName} first.`,
                }),
              },
            ],
          };
        }

        const diagramSpec = diagramGenerator.generateDiagram(content, diagram_type, `${feature.name} — ${diagram_type}`);

        const result = {
          ...diagramSpec,
          feature_number,
          learning_note: `A "${diagram_type}" diagram visualizes ${getDiagramDescription(diagram_type)}. Mermaid diagrams can be rendered in GitHub Markdown, documentation sites, and most modern editors.`,
        };

        const enriched = await enrichResponse("sdd_generate_diagram", result, stateMachine, spec_dir);
        return {
          content: [
            {
              type: "text" as const,
              text: truncate(JSON.stringify(enriched, null, 2)),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_generate_diagram", err as Error),
            },
          ],
        };
      }
    }
  );

  // ─── sdd_generate_all_diagrams ───
  server.registerTool(
    "sdd_generate_all_diagrams",
    {
      title: "Generate All Diagrams",
      description:
        "Generates ALL diagram types for a feature in one call. Produces architecture, sequence, ERD, flow, dependency, and traceability diagrams from all available artifacts, " +
        "and writes the full set to DIAGRAMS.md in the feature directory, grouped by source artifact.",
      inputSchema: generateAllDiagramsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Feature ${feature_number} not found in ${spec_dir}.`,
                  fix: "Run sdd_init first to create the feature directory.",
                }),
              },
            ],
          };
        }

        const allDiagrams = await diagramGenerator.generateAllDiagrams(spec_dir, feature.directory);

        const result = {
          ...allDiagrams,
          learning_note:
            "Diagrams aid understanding by providing visual representations of system structure and behavior. " +
            "Architecture diagrams (C4) show system boundaries, sequence diagrams show runtime interactions, " +
            "ERDs show data relationships, Gantt charts show timelines, and flowcharts show process logic. " +
            "Together they form a complete visual specification that complements the written artifacts. " +
            "The full set has been written to DIAGRAMS.md in the feature directory (see diagrams_file).",
        };

        const enriched = await enrichResponse("sdd_generate_all_diagrams", result, stateMachine, spec_dir);
        return {
          content: [
            {
              type: "text" as const,
              text: truncate(JSON.stringify(enriched, null, 2)),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_generate_all_diagrams", err as Error),
            },
          ],
        };
      }
    }
  );

  // ─── sdd_generate_user_stories ───
  server.registerTool(
    "sdd_generate_user_stories",
    {
      title: "Generate User Stories",
      description:
        "Generates user stories with acceptance criteria and flow diagrams from SPECIFICATION.md. Each story includes a Mermaid flowchart of the user journey.",
      inputSchema: generateUserStoriesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, max_stories }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Feature ${feature_number} not found in ${spec_dir}.`,
                  fix: "Run sdd_init first to create the feature directory.",
                }),
              },
            ],
          };
        }

        let specContent: string;
        try {
          specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md");
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `SPECIFICATION.md not found in ${feature.directory}.`,
                  fix: "Run sdd_write_spec first to generate the specification.",
                }),
              },
            ],
          };
        }

        // Extract requirements from SPECIFICATION.md
        const requirements = extractRequirements(specContent);
        const storyLimit = max_stories ?? 10;
        const stories: UserStory[] = [];

        for (const req of requirements.slice(0, storyLimit)) {
          const steps = extractStepsFromRequirement(req.text);
          const flowDiagram = diagramGenerator.generateUserStoryFlow(req.title, steps);
          const acceptanceCriteria = generateAcceptanceCriteria(req.text);

          stories.push({
            id: req.id,
            title: req.title,
            description: `As a user, I want ${req.title.toLowerCase()} so that ${req.rationale || "the system meets this requirement"}.`,
            priority: req.priority,
            acceptance_criteria: acceptanceCriteria,
            flow_diagram: flowDiagram,
            independent_test: `Given the system is running, when ${req.title.toLowerCase()} is triggered, then ${acceptanceCriteria[0] || "the expected outcome occurs"}.`,
          });
        }

        // Generate an overview flow diagram connecting all stories
        const overviewSteps = stories.map((s) => s.title);
        const overviewDiagram = diagramGenerator.generateUserStoryFlow(`${feature.name} User Journeys`, overviewSteps);

        const result: UserStoriesResult & { learning_note: string } = {
          stories,
          total_count: stories.length,
          diagram: overviewDiagram,
          explanation:
            `Generated ${stories.length} user stories from ${requirements.length} requirements in SPECIFICATION.md. ` +
            "Each story includes acceptance criteria mapped to the original EARS requirement and a Mermaid flowchart of the user journey.",
          learning_note:
            "User stories bridge the gap between formal EARS requirements and developer tasks. " +
            "Each story follows the format 'As a [role], I want [goal] so that [benefit]' and includes " +
            "testable acceptance criteria derived from the specification.",
        };

        const enriched = await enrichResponse("sdd_generate_user_stories", result as unknown as Record<string, unknown>, stateMachine, spec_dir);
        return {
          content: [
            {
              type: "text" as const,
              text: truncate(JSON.stringify(enriched, null, 2)),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_generate_user_stories", err as Error),
            },
          ],
        };
      }
    }
  );

  // ─── sdd_figma_diagram ───
  server.registerTool(
    "sdd_figma_diagram",
    {
      title: "Generate Figma Diagram Payload",
      description:
        "Generates a FigJam-ready diagram payload from DESIGN.md. Returns structured data with routing_instructions for the AI client to call Figma MCP's generate_diagram tool.",
      inputSchema: figmaDiagramInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number, spec_dir, diagram_type }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Feature ${feature_number} not found in ${spec_dir}.`,
                  fix: "Run sdd_init first to create the feature directory.",
                }),
              },
            ],
          };
        }

        let designContent: string;
        try {
          designContent = await fileManager.readSpecFile(feature.directory, "DESIGN.md");
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `DESIGN.md not found in ${feature.directory}.`,
                  fix: "Run sdd_write_design first to generate the design document.",
                }),
              },
            ],
          };
        }

        // Build FigJam-compatible diagram structure — node/edge derivation
        // differs per diagram type (architecture vs data_flow vs user_flow vs
        // integration), so the four payloads are structurally distinct.
        const figjamStructure = buildFigmaStructure(designContent, diagram_type);

        const figmaPayload = {
          feature_number,
          feature_name: feature.name,
          diagram_type,
          title: `${feature.name} — ${diagram_type.replace(/_/g, " ")}`,
          figjam_structure: figjamStructure,
          routing_instructions: {
            target_tool: "Figma MCP generate_diagram",
            description:
              "Pass the figjam_structure to Figma MCP's generate_diagram tool to render this diagram in FigJam. " +
              "The nodes and connections arrays define the visual elements and their relationships.",
            example_call: {
              tool: "generate_diagram",
              arguments: {
                title: `${feature.name} — ${diagram_type.replace(/_/g, " ")}`,
                diagram_type: "flowchart",
                nodes: "<<use figjam_structure.nodes>>",
                connections: "<<use figjam_structure.connections>>",
              },
            },
          },
          learning_note:
            "This payload is designed for cross-tool orchestration. The AI client reads the routing_instructions " +
            "and forwards the figjam_structure to Figma MCP's generate_diagram tool, creating a visual diagram " +
            "in FigJam from the specification artifacts.",
        };

        const enriched = await enrichResponse("sdd_figma_diagram", figmaPayload, stateMachine, spec_dir);
        return {
          content: [
            {
              type: "text" as const,
              text: truncate(JSON.stringify(enriched, null, 2)),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_figma_diagram", err as Error),
            },
          ],
        };
      }
    }
  );
}

// ─── Helper Functions ───

function getDiagramDescription(type: string): string {
  const descriptions: Record<string, string> = {
    flowchart: "process flows and decision logic as directed graphs",
    sequence: "runtime interactions between actors and components over time",
    class: "object-oriented interfaces, classes, and their relationships",
    er: "data entities, their attributes, and relationships (Entity-Relationship)",
    state: "state transitions in a system lifecycle",
    c4_context: "high-level system context showing external actors and systems (C4 Level 1)",
    c4_container: "containers within a system boundary — APIs, databases, services (C4 Level 2)",
    gantt: "task timelines and dependencies as a Gantt chart",
    pie: "proportional distribution of categories",
    mindmap: "hierarchical topic breakdown as a mind map",
  };
  return descriptions[type] || "system structure and behavior";
}

interface ParsedRequirement {
  id: string;
  title: string;
  text: string;
  priority: "P1" | "P2" | "P3" | "P4";
  rationale?: string;
}

function extractRequirements(specContent: string): ParsedRequirement[] {
  const requirements: ParsedRequirement[] = [];
  // Match EARS-style requirement sections: ### REQ-XXX-NNN ...
  const reqRegex = /^###\s+(REQ-\w+-\d{3})\s*[:\-—]\s*(.+)$/gm;
  let match;
  let index = 0;

  while ((match = reqRegex.exec(specContent)) !== null) {
    const id = match[1];
    const title = match[2].trim();

    // Extract the body text until the next heading
    const startPos = match.index + match[0].length;
    const nextHeading = specContent.indexOf("\n##", startPos);
    const body = nextHeading > -1
      ? specContent.slice(startPos, nextHeading).trim()
      : specContent.slice(startPos).trim();

    // Determine priority from content
    const priorityMatch = body.match(/\b(P[1-4])\b/) || title.match(/\b(P[1-4])\b/);
    const priority = (priorityMatch?.[1] as "P1" | "P2" | "P3" | "P4") || (index < 3 ? "P1" : index < 6 ? "P2" : "P3");

    // Extract rationale if present
    const rationaleMatch = body.match(/(?:rationale|so that|because|in order to)[:\s]+(.+?)(?:\.|$)/i);
    const rationale = rationaleMatch?.[1]?.trim();

    requirements.push({ id, title, text: body, priority, rationale });
    index++;
  }

  // Fallback: extract from bullet lists if no EARS headings found. The ids are
  // deliberately NOT "REQ-" prefixed — these items have no spec requirement to
  // trace to, and a REQ-looking id would make traceability look real.
  if (requirements.length === 0) {
    const bulletRegex = /^[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?[:]\s*(.+)$/gm;
    let bulletIndex = 0;
    while ((match = bulletRegex.exec(specContent)) !== null && bulletIndex < 20) {
      requirements.push({
        id: `UNTRACED-${String(bulletIndex + 1).padStart(3, "0")}`,
        title: match[1].trim(),
        text: match[2].trim(),
        priority: bulletIndex < 3 ? "P1" : bulletIndex < 6 ? "P2" : "P3",
      });
      bulletIndex++;
    }
  }

  return requirements;
}

function extractStepsFromRequirement(text: string): string[] {
  const steps: string[] = [];
  // Extract numbered or bulleted steps
  const stepRegex = /(?:^\d+[.)]\s*|^[-*]\s+)(.+)$/gm;
  let match;
  while ((match = stepRegex.exec(text)) !== null) {
    steps.push(match[1].trim());
  }
  // Fallback: split sentences if no explicit steps
  if (steps.length === 0) {
    const sentences = text.split(/[.;]/).filter((s) => s.trim().length > 10);
    for (const sentence of sentences.slice(0, 6)) {
      steps.push(sentence.trim());
    }
  }
  return steps.slice(0, 8);
}

function generateAcceptanceCriteria(text: string): string[] {
  const criteria: string[] = [];
  // Extract explicit acceptance criteria
  const acRegex = /(?:AC|acceptance[_ ]criteria?|given|when|then)[:\s]+(.+?)(?:\.|$)/gim;
  let match;
  while ((match = acRegex.exec(text)) !== null) {
    criteria.push(match[1].trim());
  }
  // Fallback: derive from EARS patterns
  if (criteria.length === 0) {
    const earsPatterns = [
      /when\s+(.+?),?\s+the system\s+(?:shall|will|can)\s+(.+?)(?:\.|$)/gi,
      /the system\s+(?:shall|will|can)\s+(.+?)(?:\.|$)/gi,
    ];
    for (const pattern of earsPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        criteria.push(match[0].trim());
      }
    }
  }
  // Final fallback
  if (criteria.length === 0) {
    criteria.push("The feature operates as specified");
  }
  return criteria.slice(0, 5);
}

export interface FigmaNode {
  id: string;
  label: string;
  type: "component" | "database" | "service" | "user" | "external";
}

export interface FigmaConnection {
  from: string;
  to: string;
  label: string;
}

export interface FigmaStructure {
  nodes: FigmaNode[];
  connections: FigmaConnection[];
  layout: string;
}

/** Document-plumbing headings that must never become diagram components. */
const STRUCTURAL_HEADING_REGEX =
  /^(table of contents|contents|toc|overview|introduction|revision history|document (?:control|history)|references|appendix(?:\s+\w+)?|glossary|summary|executive summary|purpose|scope|background|assumptions|out of scope|non-goals|approvals?|sign[- ]?offs?|change ?log|metadata|version history|status)$/i;

function cleanFigmaHeading(raw: string): string {
  return raw
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

function extractFigmaNodes(designContent: string): FigmaNode[] {
  const nodes: FigmaNode[] = [];
  const seen = new Set<string>();

  // Extract components from real (non-structural) headings
  const headingRegex = /^#{2,3}\s+(.+)/gm;
  let match;
  let index = 0;

  while ((match = headingRegex.exec(designContent)) !== null && index < 15) {
    const label = cleanFigmaHeading(match[1]);
    if (!label || STRUCTURAL_HEADING_REGEX.test(label)) continue;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const id = `node_${index}`;

    let nodeType: FigmaNode["type"] = "component";
    if (/database|db|storage|store/i.test(label)) nodeType = "database";
    else if (/service|api|gateway|server/i.test(label)) nodeType = "service";
    else if (/user|client|consumer/i.test(label)) nodeType = "user";
    else if (/external|third.?party|integration/i.test(label)) nodeType = "external";

    nodes.push({ id, label, type: nodeType });
    index++;
  }

  if (nodes.length === 0) {
    nodes.push({ id: "node_0", label: "System", type: "component" });
  }
  return nodes;
}

/**
 * Build the FigJam structure for one of the four diagram types. Each type uses
 * its own node selection and edge derivation, so the payloads differ
 * structurally — not just in title.
 */
export function buildFigmaStructure(designContent: string, diagramType: string): FigmaStructure {
  const components = extractFigmaNodes(designContent);
  switch (diagramType) {
    case "data_flow":
      return buildDataFlowStructure(components);
    case "user_flow":
      return buildUserFlowStructure(components);
    case "integration":
      return buildIntegrationStructure(components);
    default:
      return buildArchitectureStructure(components);
  }
}

/** Layered view: apps depend on each other; every app reads/writes each store. */
function buildArchitectureStructure(components: FigmaNode[]): FigmaStructure {
  const nodes = components.slice(0, 15);
  const connections: FigmaConnection[] = [];
  const users = nodes.filter((n) => n.type === "user");
  const apps = nodes.filter((n) => n.type === "component" || n.type === "service");
  const databases = nodes.filter((n) => n.type === "database");
  const externals = nodes.filter((n) => n.type === "external");
  const entry = apps[0] ?? nodes[0];
  for (const user of users) {
    connections.push({ from: user.id, to: entry.id, label: `uses ${entry.label}` });
  }
  for (let i = 0; i < apps.length - 1; i++) {
    connections.push({ from: apps[i].id, to: apps[i + 1].id, label: `depends on ${apps[i + 1].label}` });
  }
  for (const app of apps) {
    for (const db of databases) {
      connections.push({ from: app.id, to: db.id, label: `reads/writes ${db.label}` });
    }
  }
  for (const ext of externals) {
    connections.push({ from: entry.id, to: ext.id, label: `calls ${ext.label}` });
  }
  return { nodes, connections: connections.slice(0, 20), layout: "hierarchical" };
}

/** Source -> processes -> stores, with data-movement edge labels. */
function buildDataFlowStructure(components: FigmaNode[]): FigmaStructure {
  const sources = components.filter((n) => n.type === "user" || n.type === "external");
  const processes = components.filter((n) => n.type === "component" || n.type === "service");
  const stores = components.filter((n) => n.type === "database");
  const source: FigmaNode = sources[0] ?? { id: "node_source", label: "User", type: "user" };
  const nodes = [source, ...sources.slice(1), ...processes, ...stores].slice(0, 15);
  const connections: FigmaConnection[] = [];
  if (processes.length > 0) {
    connections.push({ from: source.id, to: processes[0].id, label: `sends input to ${processes[0].label}` });
    for (let i = 0; i < processes.length - 1; i++) {
      connections.push({ from: processes[i].id, to: processes[i + 1].id, label: `passes data to ${processes[i + 1].label}` });
    }
    const last = processes[processes.length - 1];
    for (const store of stores) {
      connections.push({ from: last.id, to: store.id, label: `persists to ${store.label}` });
    }
    connections.push({ from: last.id, to: source.id, label: "returns output" });
  }
  return { nodes, connections: connections.slice(0, 20), layout: "left-to-right" };
}

/** User journey through the user-facing steps — infrastructure nodes excluded. */
function buildUserFlowStructure(components: FigmaNode[]): FigmaStructure {
  const user: FigmaNode = components.find((n) => n.type === "user") ?? { id: "node_user", label: "User", type: "user" };
  const steps = components.filter((n) => n.type === "component" || n.type === "service").slice(0, 10);
  const nodes = [user, ...steps];
  const connections: FigmaConnection[] = [];
  if (steps.length > 0) {
    connections.push({ from: user.id, to: steps[0].id, label: `starts at ${steps[0].label}` });
    for (let i = 0; i < steps.length - 1; i++) {
      connections.push({ from: steps[i].id, to: steps[i + 1].id, label: `step ${i + 2}: ${steps[i + 1].label}` });
    }
  }
  return { nodes, connections: connections.slice(0, 20), layout: "left-to-right" };
}

/** Hub-and-spoke: the core system integrates with every other node. */
function buildIntegrationStructure(components: FigmaNode[]): FigmaStructure {
  const core =
    components.find((n) => n.type === "service") ??
    components.find((n) => n.type === "component") ??
    components[0];
  const others = components.filter((n) => n.id !== core.id).slice(0, 12);
  const nodes = [core, ...others];
  const connections: FigmaConnection[] = [];
  for (const other of others) {
    if (other.type === "user") {
      connections.push({ from: other.id, to: core.id, label: `uses ${core.label}` });
    } else if (other.type === "database") {
      connections.push({ from: core.id, to: other.id, label: `stores data in ${other.label}` });
    } else if (other.type === "external") {
      connections.push({ from: core.id, to: other.id, label: `integrates with ${other.label}` });
    } else {
      connections.push({ from: core.id, to: other.id, label: `calls ${other.label}` });
    }
  }
  return { nodes, connections: connections.slice(0, 20), layout: "radial" };
}
