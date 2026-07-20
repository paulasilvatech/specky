/**
 * ContentDiagramGenerator — generates architecture diagrams from requirement
 * and design content, not from caller-provided Mermaid.
 *
 * Extracts actors, systems, and flows from SPECIFICATION.md and DESIGN.md
 * to produce C4 Context, Sequence, and ER diagrams that reflect the actual
 * specification content.
 */

export interface Actor {
  id: string;
  name: string;
  type: "person" | "system";
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
}

export interface DataEntity {
  name: string;
  attributes: string[];
}

/** Extract actors (users, external systems) from requirement text. */
export function extractActors(requirements: Array<{ id: string; text: string }>): Actor[] {
  const actors = new Map<string, Actor>();

  // Common actor patterns in EARS requirements
  const actorPatterns = [
    { regex: /\buser(s)?\b/gi, id: "user", name: "User", type: "person" as const },
    {
      regex: /\badmin(istrator)?(s)?\b/gi,
      id: "admin",
      name: "Administrator",
      type: "person" as const,
    },
    { regex: /\bclient(s)?\b/gi, id: "client", name: "Client", type: "person" as const },
    { regex: /\bdeveloper(s)?\b/gi, id: "developer", name: "Developer", type: "person" as const },
    { regex: /\bapi\b/gi, id: "api", name: "External API", type: "system" as const },
    { regex: /\bdatabase\b/gi, id: "db", name: "Database", type: "system" as const },
    { regex: /\bcache\b|\bredis\b/gi, id: "cache", name: "Cache", type: "system" as const },
    {
      regex: /\bqueue\b|\bkafka\b|\brabbitmq\b/gi,
      id: "queue",
      name: "Message Queue",
      type: "system" as const,
    },
  ];

  for (const req of requirements) {
    for (const pattern of actorPatterns) {
      if (pattern.regex.test(req.text)) {
        if (!actors.has(pattern.id)) {
          actors.set(pattern.id, { id: pattern.id, name: pattern.name, type: pattern.type });
        }
      }
    }
  }

  // Default to a generic user if no actors found
  if (actors.size === 0) {
    actors.set("user", { id: "user", name: "User", type: "person" });
  }

  return Array.from(actors.values());
}

/** Extract the main system under design from feature name. */
export function extractSystem(featureName: string): SystemComponent {
  const id = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { id, name: featureName };
}

/** Extract API endpoints from DESIGN.md content. */
export function extractApiEndpoints(designContent: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const seen = new Set<string>();

  // Match patterns like "GET /api/users", "POST /api/items", etc.
  const endpointRegex = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[a-zA-Z0-9\-_/:{}]+)/gi;
  for (const match of designContent.matchAll(endpointRegex)) {
    const key = `${match[1].toUpperCase()} ${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        description: extractEndpointDescription(designContent, match.index),
      });
    }
  }

  return endpoints;
}

function extractEndpointDescription(content: string, index: number): string | undefined {
  // Look for a description in the same line or nearby
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(index, lineEnd > 0 ? lineEnd : undefined);
  const descMatch = line.match(/[-–—:]\s*(.+)$/);
  return descMatch ? descMatch[1].trim() : undefined;
}

/** Extract data entities from DESIGN.md content. */
export function extractDataEntities(designContent: string): DataEntity[] {
  const entities: DataEntity[] = [];
  const seen = new Set<string>();

  // Look for entity definitions like "User entity", "Todo model", etc.
  const entityPatterns = [
    /(\w+)\s+(?:entity|model|table|schema|record)/gi,
    /(?:entity|model|table|schema|record)\s+(\w+)/gi,
  ];

  for (const pattern of entityPatterns) {
    for (const match of designContent.matchAll(pattern)) {
      const name = match[1];
      if (name && name.length > 2 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        entities.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          attributes: extractEntityAttributes(designContent, name),
        });
      }
    }
  }

  return entities;
}

function extractEntityAttributes(content: string, entityName: string): string[] {
  // Look for attributes in the vicinity of the entity mention
  const entityIndex = content.toLowerCase().indexOf(entityName.toLowerCase());
  if (entityIndex < 0) return [];

  const nearby = content.slice(entityIndex, entityIndex + 500);
  const attributes: string[] = [];

  // Common attribute patterns: "id", "name", "email", "created_at", etc.
  const attrPatterns = [
    /\bid\b/gi,
    /\bname\b/gi,
    /\btitle\b/gi,
    /\bdescription\b/gi,
    /\bemail\b/gi,
    /\bcreated_at\b|\bcreatedat\b/gi,
    /\bupdated_at\b|\bupdatedat\b/gi,
    /\bstatus\b/gi,
    /\btype\b/gi,
  ];

  for (const pattern of attrPatterns) {
    if (pattern.test(nearby)) {
      const match = nearby.match(pattern);
      if (match) attributes.push(match[0].toLowerCase());
    }
  }

  return attributes.slice(0, 5); // Limit to 5 attributes
}

/** Generate a C4 Context diagram from actors and system. */
export function generateC4ContextDiagram(system: SystemComponent, actors: Actor[]): string {
  const lines = ["C4Context", `  title ${system.name} - System Context`, ""];

  // Add actors
  for (const actor of actors) {
    if (actor.type === "person") {
      lines.push(`  Person(${actor.id}, "${actor.name}")`);
    } else {
      lines.push(`  System_Ext(${actor.id}, "${actor.name}")`);
    }
  }

  lines.push(`  System(${system.id}, "${system.name}")`);
  lines.push("");

  // Add relations
  for (const actor of actors) {
    lines.push(`  Rel(${actor.id}, ${system.id}, "Uses")`);
  }

  return lines.join("\n");
}

/** Generate a sequence diagram from API endpoints. */
export function generateSequenceDiagram(
  system: SystemComponent,
  actors: Actor[],
  endpoints: ApiEndpoint[],
): string {
  const primaryActor = actors.find((a) => a.type === "person") ?? actors[0];
  const lines = [
    "sequenceDiagram",
    `  participant ${primaryActor?.id ?? "user"} as ${primaryActor?.name ?? "User"}`,
    `  participant ${system.id} as ${system.name}`,
  ];

  // Add external systems if any
  const externalSystems = actors.filter((a) => a.type === "system");
  for (const sys of externalSystems) {
    lines.push(`  participant ${sys.id} as ${sys.name}`);
  }

  lines.push("");

  // Add API calls
  for (const endpoint of endpoints.slice(0, 5)) {
    // Limit to 5 endpoints
    const actorId = primaryActor?.id ?? "user";
    lines.push(`  ${actorId}->>+${system.id}: ${endpoint.method} ${endpoint.path}`);
    lines.push(`  ${system.id}-->>-${actorId}: Response`);
  }

  return lines.join("\n");
}

/** Generate an ER diagram from data entities. */
export function generateErDiagram(entities: DataEntity[]): string {
  if (entities.length === 0) {
    return "erDiagram\n  NOTE {\n    No entities extracted from design content\n  }";
  }

  const lines = ["erDiagram"];
  for (const entity of entities) {
    const attrs = entity.attributes.length > 0 ? entity.attributes : ["id"];
    const attrLines = attrs.map((attr) => `    string ${attr}`).join("\n");
    lines.push(`  ${entity.name} {`);
    lines.push(attrLines);
    lines.push("  }");
  }

  // Add simple relationships if we have multiple entities
  if (entities.length > 1) {
    for (let i = 1; i < entities.length; i++) {
      lines.push(`  ${entities[0].name} ||--o{ ${entities[i].name} : "has"`);
    }
  }

  return lines.join("\n");
}

/** Generate a deployment diagram from infrastructure content. */
export function generateDeploymentDiagram(system: SystemComponent, designContent: string): string {
  const lines = ["flowchart TB", `  subgraph "${system.name} Deployment"`];

  // Detect deployment targets
  const hasContainers = /\bcontainer\b|\bdocker\b|\bkubernetes\b|\bk8s\b/i.test(designContent);
  const hasCloud = /\bazure\b|\baws\b|\bgcp\b|\bcloud\b/i.test(designContent);
  const hasServerless = /\bserverless\b|\blambda\b|\bfunction\b/i.test(designContent);

  if (hasContainers) {
    lines.push("    subgraph Containers");
    lines.push(`      ${system.id}_container[${system.name} Container]`);
    lines.push("    end");
  }

  if (hasCloud) {
    lines.push("    subgraph Cloud");
    lines.push(`      ${system.id}_cloud[Cloud Provider]`);
    lines.push("    end");
  }

  if (hasServerless) {
    lines.push("    subgraph Serverless");
    lines.push(`      ${system.id}_fn[${system.name} Function]`);
    lines.push("    end");
  }

  if (!hasContainers && !hasCloud && !hasServerless) {
    lines.push(`    ${system.id}_server[Application Server]`);
  }

  lines.push("  end");
  return lines.join("\n");
}
