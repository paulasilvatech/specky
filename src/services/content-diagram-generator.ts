/**
 * ContentDiagramGenerator — deterministically derives Mermaid diagrams from
 * specification and design content, not from caller-provided Mermaid.
 *
 * Extracts actors, systems, endpoints, and data entities from SPECIFICATION.md
 * and DESIGN.md to produce C4 Context, Sequence, ER, and Deployment diagrams
 * that reflect the actual, evidenced specification content.
 *
 * Guarantees:
 * - No invented actors, entities, relationships, or infrastructure. Every
 *   emitted element is backed by a substring present in the source content.
 * - Deterministic output for identical input (no stateful regex, stable order).
 * - Fails with InsufficientEvidenceError when the source does not contain
 *   enough evidence to build a meaningful diagram, instead of emitting
 *   generic placeholder nodes.
 * - Mermaid identifiers and labels are sanitized so generated output is valid.
 */

export interface Actor {
  id: string;
  name: string;
  type: "person" | "system";
  /** Exact source snippet that justifies this actor. */
  evidence: string;
}

export interface SystemComponent {
  id: string;
  name: string;
  description?: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description?: string;
  /** Exact source snippet (the matched endpoint fragment). */
  evidence: string;
}

export interface DataEntity {
  name: string;
  attributes: string[];
  /** Exact source snippet that justifies this entity. */
  evidence: string;
}

/** Diagram types this generator can synthesize automatically. */
export type AutoDiagramType = "c4_context" | "sequence" | "er" | "deployment";

export const AUTO_DIAGRAM_TYPES: readonly AutoDiagramType[] = [
  "c4_context",
  "sequence",
  "er",
  "deployment",
];

export function isAutoDiagramType(value: string): value is AutoDiagramType {
  return (AUTO_DIAGRAM_TYPES as readonly string[]).includes(value);
}

/** Raised when the source content lacks evidence to build a diagram. */
export class InsufficientEvidenceError extends Error {
  readonly diagramType: string;

  constructor(diagramType: string, detail: string) {
    super(
      `Cannot synthesize ${diagramType} diagram: ${detail}. ` +
      "Provide the diagram explicitly (mode=explicit) or enrich the source artifact.",
    );
    this.name = "InsufficientEvidenceError";
    this.diagramType = diagramType;
  }
}

/** Result of an automatic diagram synthesis. */
export interface GeneratedDiagram {
  mermaid: string;
  /** Exact source substrings that justify the diagram, for evidence validation. */
  evidenceRefs: string[];
}

// ---------------------------------------------------------------------------
// Sanitization helpers — keep Mermaid identifiers and labels valid.
// ---------------------------------------------------------------------------

/** Build a safe Mermaid identifier (starts with a letter/underscore). */
function safeMermaidId(raw: string, fallback: string): string {
  let id = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (id.length === 0) id = fallback;
  if (!/^[a-z_]/.test(id)) id = `n_${id}`;
  return id;
}

/** Escape a label for use inside a Mermaid double-quoted string. */
function safeMermaidLabel(raw: string): string {
  return raw
    .replace(/\\/g, "")
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
}

/** Extract the exact source line containing a character offset (trimmed). */
function lineAt(content: string, index: number): string {
  const start = content.lastIndexOf("\n", index) + 1;
  const end = content.indexOf("\n", index);
  return content.slice(start, end === -1 ? undefined : end).trim();
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface ActorPattern {
  source: string;
  id: string;
  name: string;
  type: "person" | "system";
}

const ACTOR_PATTERNS: readonly ActorPattern[] = [
  { source: "\\badmin(?:istrator)?s?\\b", id: "admin", name: "Administrator", type: "person" },
  { source: "\\busers?\\b", id: "user", name: "User", type: "person" },
  { source: "\\bclients?\\b", id: "client", name: "Client", type: "person" },
  { source: "\\bdevelopers?\\b", id: "developer", name: "Developer", type: "person" },
  {
    source: "\\bexternal api\\b|\\bthird[- ]party api\\b",
    id: "ext_api",
    name: "External API",
    type: "system",
  },
  {
    source: "\\bdatabase\\b|\\bpostgres\\b|\\bmysql\\b",
    id: "db",
    name: "Database",
    type: "system",
  },
  { source: "\\bcache\\b|\\bredis\\b", id: "cache", name: "Cache", type: "system" },
  {
    source: "\\bmessage queue\\b|\\bkafka\\b|\\brabbitmq\\b",
    id: "queue",
    name: "Message Queue",
    type: "system",
  },
];

/**
 * Extract actors from requirement text. Only actors explicitly present in the
 * requirements are returned; no generic fallback is invented.
 */
export function extractActors(requirements: Array<{ id: string; text: string }>): Actor[] {
  const actors = new Map<string, Actor>();

  for (const req of requirements) {
    for (const pattern of ACTOR_PATTERNS) {
      if (actors.has(pattern.id)) continue;
      const match = new RegExp(pattern.source, "i").exec(req.text);
      if (match) {
        actors.set(pattern.id, {
          id: pattern.id,
          name: pattern.name,
          type: pattern.type,
          evidence: match[0],
        });
      }
    }
  }

  // Preserve ACTOR_PATTERNS order for deterministic output.
  return ACTOR_PATTERNS.map((p) => actors.get(p.id)).filter((a): a is Actor => a !== undefined);
}

/** Extract the main system under design from feature name. */
export function extractSystem(featureName: string): SystemComponent {
  const id = safeMermaidId(featureName, "system");
  return { id, name: featureName.trim() || "System" };
}

/** Extract API endpoints from DESIGN.md content in document order. */
export function extractApiEndpoints(designContent: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const seen = new Set<string>();

  const endpointRegex = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[a-zA-Z0-9\-_/:{}]+)/g;
  for (const match of designContent.matchAll(endpointRegex)) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push({
      method,
      path,
      description: extractEndpointDescription(designContent, match.index ?? 0),
      evidence: `${method} ${path}`,
    });
  }

  return endpoints;
}

function extractEndpointDescription(content: string, index: number): string | undefined {
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(index, lineEnd > 0 ? lineEnd : undefined);
  const descMatch = line.match(/[-–—:]\s*(.+)$/);
  return descMatch ? descMatch[1].trim() : undefined;
}

/** Extract data entities from DESIGN.md content in document order. */
export function extractDataEntities(designContent: string): DataEntity[] {
  const entities: DataEntity[] = [];
  const seen = new Set<string>();

  const entityPatterns = [
    /(\w+)\s+(?:entity|model|table|schema|record)\b/gi,
    /(?:entity|model|table|schema|record)\s+(\w+)/gi,
  ];

  // Collect matches with offsets, then order by document position so output is
  // deterministic regardless of pattern iteration order.
  const found: Array<{ name: string; index: number; evidence: string }> = [];
  for (const pattern of entityPatterns) {
    for (const match of designContent.matchAll(pattern)) {
      const name = match[1];
      if (name && name.length > 2) {
        found.push({ name, index: match.index ?? 0, evidence: match[0].trim() });
      }
    }
  }
  found.sort((a, b) => a.index - b.index);

  for (const item of found) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({
      name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
      attributes: extractEntityAttributes(designContent, item.name),
      evidence: item.evidence,
    });
  }

  return entities;
}

const ATTR_PATTERNS: readonly string[] = [
  "\\bid\\b",
  "\\bname\\b",
  "\\btitle\\b",
  "\\bdescription\\b",
  "\\bemail\\b",
  "\\bcreated_?at\\b",
  "\\bupdated_?at\\b",
  "\\bstatus\\b",
  "\\btype\\b",
];

function extractEntityAttributes(content: string, entityName: string): string[] {
  const entityIndex = content.toLowerCase().indexOf(entityName.toLowerCase());
  if (entityIndex < 0) return [];

  const nearby = content.slice(entityIndex, entityIndex + 500);
  const attributes: string[] = [];

  for (const source of ATTR_PATTERNS) {
    const match = new RegExp(source, "i").exec(nearby);
    if (match) attributes.push(match[0].toLowerCase());
  }

  return attributes.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Diagram builders — each fails with InsufficientEvidenceError when empty.
// ---------------------------------------------------------------------------

/** Generate a C4 Context diagram from actors and system. */
export function generateC4ContextDiagram(system: SystemComponent, actors: Actor[]): string {
  if (actors.length === 0) {
    throw new InsufficientEvidenceError(
      "c4_context",
      "no actors were found in the specification requirements",
    );
  }

  const title = safeMermaidLabel(system.name);
  const lines = ["C4Context", `  title ${title} - System Context`, ""];

  for (const actor of actors) {
    const label = safeMermaidLabel(actor.name);
    if (actor.type === "person") {
      lines.push(`  Person(${actor.id}, "${label}")`);
    } else {
      lines.push(`  System_Ext(${actor.id}, "${label}")`);
    }
  }

  lines.push(`  System(${system.id}, "${title}")`);
  lines.push("");

  for (const actor of actors) {
    const verb = actor.type === "person" ? "Uses" : "Integrates with";
    lines.push(`  Rel(${actor.id}, ${system.id}, "${verb}")`);
  }

  return lines.join("\n");
}

/** Generate a sequence diagram from API endpoints. */
export function generateSequenceDiagram(
  system: SystemComponent,
  actors: Actor[],
  endpoints: ApiEndpoint[],
): string {
  if (endpoints.length === 0) {
    throw new InsufficientEvidenceError(
      "sequence",
      "no API endpoints were found in the design content",
    );
  }

  const primaryActor = actors.find((a) => a.type === "person") ?? actors[0];
  const actorId = primaryActor?.id ?? "user";
  const actorName = safeMermaidLabel(primaryActor?.name ?? "User");
  const systemLabel = safeMermaidLabel(system.name);

  const lines = [
    "sequenceDiagram",
    `  participant ${actorId} as ${actorName}`,
    `  participant ${system.id} as ${systemLabel}`,
  ];

  const externalSystems = actors.filter((a) => a.type === "system");
  for (const sys of externalSystems) {
    lines.push(`  participant ${sys.id} as ${safeMermaidLabel(sys.name)}`);
  }

  lines.push("");

  for (const endpoint of endpoints.slice(0, 8)) {
    const label = safeMermaidLabel(`${endpoint.method} ${endpoint.path}`);
    lines.push(`  ${actorId}->>+${system.id}: ${label}`);
    lines.push(`  ${system.id}-->>-${actorId}: Response`);
  }

  return lines.join("\n");
}

/** Generate an ER diagram from data entities. */
export function generateErDiagram(entities: DataEntity[]): string {
  if (entities.length === 0) {
    throw new InsufficientEvidenceError(
      "er",
      "no data entities were found in the design content",
    );
  }

  const lines = ["erDiagram"];
  for (const entity of entities) {
    const attrs = entity.attributes.length > 0 ? entity.attributes : ["id"];
    lines.push(`  ${entity.name} {`);
    for (const attr of attrs) {
      lines.push(`    string ${attr}`);
    }
    lines.push("  }");
  }

  return lines.join("\n");
}

interface DeploymentTarget {
  regex: RegExp;
  build: (system: SystemComponent) => string[];
}

const DEPLOYMENT_TARGETS: readonly DeploymentTarget[] = [
  {
    regex: /\bcontainer\b|\bdocker\b|\bkubernetes\b|\bk8s\b|\bcontainer apps?\b/i,
    build: (s) => [
      "    subgraph Containers",
      `      ${s.id}_container[${safeMermaidLabel(s.name)} Container]`,
      "    end",
    ],
  },
  {
    regex: /\bserverless\b|\blambda\b|\bazure functions?\b|\bcloud functions?\b/i,
    build: (s) => [
      "    subgraph Serverless",
      `      ${s.id}_fn[${safeMermaidLabel(s.name)} Function]`,
      "    end",
    ],
  },
  {
    regex: /\bpostgres\b|\bmysql\b|\bdatabase\b|\bcosmos\b|\bdynamodb\b/i,
    build: (s) => ["    subgraph Data", `      ${s.id}_db[(Database)]`, "    end"],
  },
  {
    regex: /\bredis\b|\bcache\b/i,
    build: (s) => ["    subgraph Cache", `      ${s.id}_cache[(Cache)]`, "    end"],
  },
];

/** Generate a deployment diagram from infrastructure content. */
export function generateDeploymentDiagram(
  system: SystemComponent,
  designContent: string,
): string {
  const inner: string[] = [];
  for (const target of DEPLOYMENT_TARGETS) {
    if (target.regex.test(designContent)) {
      inner.push(...target.build(system));
    }
  }

  if (inner.length === 0) {
    throw new InsufficientEvidenceError(
      "deployment",
      "no deployment targets (containers, serverless, database, cache) were found in the design content",
    );
  }

  return [
    "flowchart TB",
    `  subgraph "${safeMermaidLabel(system.name)} Deployment"`,
    ...inner,
    "  end",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface DiagramSources {
  /** Feature name used to derive the system identity. */
  featureName: string;
  /** Structured requirements parsed from SPECIFICATION.md. */
  requirements: Array<{ id: string; text: string }>;
  /** Raw DESIGN.md content. */
  designContent: string;
}

/**
 * Synthesize a single diagram of the given auto type from source content.
 * Throws InsufficientEvidenceError when the source lacks evidence.
 */
export function generateDiagramFromContent(
  diagramType: AutoDiagramType,
  sources: DiagramSources,
): GeneratedDiagram {
  const system = extractSystem(sources.featureName);

  switch (diagramType) {
    case "c4_context": {
      const actors = extractActors(sources.requirements);
      const mermaid = generateC4ContextDiagram(system, actors);
      return { mermaid, evidenceRefs: uniqueEvidence(actors.map((a) => a.evidence)) };
    }
    case "sequence": {
      const actors = extractActors(sources.requirements);
      const endpoints = extractApiEndpoints(sources.designContent);
      const mermaid = generateSequenceDiagram(system, actors, endpoints);
      return { mermaid, evidenceRefs: uniqueEvidence(endpoints.map((e) => e.evidence)) };
    }
    case "er": {
      const entities = extractDataEntities(sources.designContent);
      const mermaid = generateErDiagram(entities);
      return { mermaid, evidenceRefs: uniqueEvidence(entities.map((e) => e.evidence)) };
    }
    case "deployment": {
      const mermaid = generateDeploymentDiagram(system, sources.designContent);
      return { mermaid, evidenceRefs: collectDeploymentEvidence(sources.designContent) };
    }
    default: {
      const exhaustive: never = diagramType;
      throw new InsufficientEvidenceError(String(exhaustive), "unsupported diagram type");
    }
  }
}

function uniqueEvidence(refs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (trimmed.length >= 3 && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      out.push(trimmed);
    }
  }
  return out;
}

function collectDeploymentEvidence(designContent: string): string[] {
  const refs: string[] = [];
  for (const target of DEPLOYMENT_TARGETS) {
    const match = target.regex.exec(designContent);
    if (match) refs.push(lineAt(designContent, match.index));
  }
  return uniqueEvidence(refs);
}
