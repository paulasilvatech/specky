/**
 * content-diagram-generator.test.ts — deterministic, evidence-backed diagram
 * synthesis. Verifies the generator never invents actors, entities,
 * relationships, or infrastructure, and fails when evidence is insufficient.
 */
import { describe, expect, it } from "vitest";
import {
  AUTO_DIAGRAM_TYPES,
  extractActors,
  extractApiEndpoints,
  extractDataEntities,
  extractSystem,
  generateC4ContextDiagram,
  generateDeploymentDiagram,
  generateDiagramFromContent,
  generateErDiagram,
  generateSequenceDiagram,
  InsufficientEvidenceError,
  isAutoDiagramType,
} from "../../src/services/content-diagram-generator.js";

describe("extractActors", () => {
  it("extracts user and admin actors with evidence", () => {
    const requirements = [
      { id: "REQ-001", text: "When a user logs in, the system shall issue a token." },
      { id: "REQ-002", text: "When an admin deletes a record, the system shall audit it." },
    ];

    const actors = extractActors(requirements);
    const ids = actors.map((a) => a.id);

    expect(ids).toContain("user");
    expect(ids).toContain("admin");
    for (const actor of actors) {
      expect(actor.evidence.length).toBeGreaterThan(0);
    }
  });

  it("extracts external systems from requirements", () => {
    const requirements = [
      { id: "REQ-001", text: "The system shall cache results in Redis." },
      { id: "REQ-002", text: "When the External API is unavailable, the system shall retry." },
    ];

    const actors = extractActors(requirements);
    const ids = actors.map((a) => a.id);

    expect(ids).toContain("cache");
    expect(ids).toContain("ext_api");
    expect(actors.find((a) => a.id === "cache")?.type).toBe("system");
  });

  it("returns an empty list when no actors are present (no invention)", () => {
    const requirements = [{ id: "REQ-001", text: "The system shall process data." }];
    expect(extractActors(requirements)).toEqual([]);
  });

  it("is deterministic and de-duplicates repeated actors", () => {
    const requirements = [
      { id: "REQ-001", text: "A user does X. Another user does Y." },
      { id: "REQ-002", text: "The user also does Z." },
    ];
    const actors = extractActors(requirements);
    expect(actors.filter((a) => a.id === "user")).toHaveLength(1);
  });
});

describe("extractSystem", () => {
  it("creates a safe Mermaid identifier from the feature name", () => {
    const system = extractSystem("Todo API");
    expect(system.id).toBe("todo_api");
    expect(system.name).toBe("Todo API");
  });

  it("prefixes identifiers that would start with a digit", () => {
    const system = extractSystem("3D Rendering");
    expect(system.id).toMatch(/^[a-z_]/);
  });

  it("falls back to a default id for empty names", () => {
    const system = extractSystem("");
    expect(system.id).toBe("system");
  });
});

describe("extractApiEndpoints", () => {
  it("extracts REST endpoints with evidence in document order", () => {
    const design = `
      ## API Contracts
      - GET /api/users - List all users
      - POST /api/users - Create a user
      - DELETE /api/users/:id - Delete user
    `;

    const endpoints = extractApiEndpoints(design);

    expect(endpoints).toHaveLength(3);
    expect(endpoints[0].method).toBe("GET");
    expect(endpoints[0].path).toBe("/api/users");
    expect(endpoints[0].evidence).toBe("GET /api/users");
  });

  it("deduplicates repeated endpoints", () => {
    const design = "GET /api/health\nGET /api/health\nPOST /api/health";
    expect(extractApiEndpoints(design)).toHaveLength(2);
  });
});

describe("extractDataEntities", () => {
  it("extracts entity definitions with evidence", () => {
    const design = `
      ## Data Model
      The User entity stores authentication data.
      The Todo model contains task information.
    `;

    const entities = extractDataEntities(design);
    const names = entities.map((e) => e.name);

    expect(names).toContain("User");
    expect(names).toContain("Todo");
    for (const entity of entities) {
      expect(entity.evidence.length).toBeGreaterThan(0);
    }
  });

  it("limits attributes to 5 per entity", () => {
    const design =
      "The User entity has id, name, email, description, created_at, updated_at, status, type.";
    const entities = extractDataEntities(design);
    expect(entities[0]?.attributes.length).toBeLessThanOrEqual(5);
  });
});

describe("generateC4ContextDiagram", () => {
  it("generates valid C4Context Mermaid with distinct relation verbs", () => {
    const system = { id: "todo_api", name: "Todo API" };
    const actors = [
      { id: "user", name: "User", type: "person" as const, evidence: "user" },
      { id: "db", name: "Database", type: "system" as const, evidence: "database" },
    ];

    const diagram = generateC4ContextDiagram(system, actors);

    expect(diagram).toContain("C4Context");
    expect(diagram).toContain("title Todo API - System Context");
    expect(diagram).toContain('Person(user, "User")');
    expect(diagram).toContain('System_Ext(db, "Database")');
    expect(diagram).toContain('System(todo_api, "Todo API")');
    expect(diagram).toContain('Rel(user, todo_api, "Uses")');
    expect(diagram).toContain('Rel(db, todo_api, "Integrates with")');
  });

  it("throws InsufficientEvidenceError when there are no actors", () => {
    expect(() => generateC4ContextDiagram({ id: "s", name: "S" }, [])).toThrow(
      InsufficientEvidenceError,
    );
  });

  it("escapes double quotes in labels", () => {
    const system = { id: "s", name: 'The "Best" System' };
    const actors = [
      { id: "user", name: 'A "power" user', type: "person" as const, evidence: "user" },
    ];
    const diagram = generateC4ContextDiagram(system, actors);
    expect(diagram).toContain("'power'");
    expect(diagram).not.toContain('"power"');
  });
});

describe("generateSequenceDiagram", () => {
  it("generates a sequence diagram from endpoints", () => {
    const system = { id: "todo_api", name: "Todo API" };
    const actors = [{ id: "user", name: "User", type: "person" as const, evidence: "user" }];
    const endpoints = [
      { method: "GET", path: "/api/todos", evidence: "GET /api/todos" },
      { method: "POST", path: "/api/todos", evidence: "POST /api/todos" },
    ];

    const diagram = generateSequenceDiagram(system, actors, endpoints);

    expect(diagram).toContain("sequenceDiagram");
    expect(diagram).toContain("participant user as User");
    expect(diagram).toContain("participant todo_api as Todo API");
    expect(diagram).toContain("user->>+todo_api: GET /api/todos");
  });

  it("throws InsufficientEvidenceError when there are no endpoints", () => {
    expect(() => generateSequenceDiagram({ id: "s", name: "S" }, [], [])).toThrow(
      InsufficientEvidenceError,
    );
  });

  it("caps the number of rendered calls", () => {
    const system = { id: "api", name: "API" };
    const actors = [{ id: "user", name: "User", type: "person" as const, evidence: "user" }];
    const endpoints = Array.from({ length: 12 }, (_, i) => ({
      method: "GET",
      path: `/api/endpoint${i}`,
      evidence: `GET /api/endpoint${i}`,
    }));

    const diagram = generateSequenceDiagram(system, actors, endpoints);
    const calls = diagram.match(/user->>\+api:/g);
    expect(calls?.length).toBeLessThanOrEqual(8);
  });
});

describe("generateErDiagram", () => {
  it("generates an ER diagram without inventing relationships", () => {
    const entities = [
      { name: "User", attributes: ["id", "email"], evidence: "User entity" },
      { name: "Todo", attributes: ["id", "title"], evidence: "Todo model" },
    ];

    const diagram = generateErDiagram(entities);

    expect(diagram).toContain("erDiagram");
    expect(diagram).toContain("User {");
    expect(diagram).toContain("string email");
    expect(diagram).toContain("Todo {");
    // No fabricated relationships between entities.
    expect(diagram).not.toContain("||--o{");
    expect(diagram).not.toContain('"has"');
  });

  it("throws InsufficientEvidenceError for empty entities (no NOTE placeholder)", () => {
    expect(() => generateErDiagram([])).toThrow(InsufficientEvidenceError);
  });
});

describe("generateDeploymentDiagram", () => {
  it("generates a deployment diagram from container evidence", () => {
    const system = { id: "todo_api", name: "Todo API" };
    const design = "Deploy to Azure Container Apps with Docker containers";

    const diagram = generateDeploymentDiagram(system, design);

    expect(diagram).toContain("flowchart TB");
    expect(diagram).toContain("Todo API Deployment");
    expect(diagram).toContain("Containers");
  });

  it("throws InsufficientEvidenceError when no deployment target is present", () => {
    expect(() =>
      generateDeploymentDiagram({ id: "s", name: "S" }, "Simple deployment"),
    ).toThrow(InsufficientEvidenceError);
  });
});

describe("generateDiagramFromContent dispatcher", () => {
  const sources = {
    featureName: "Todo API",
    requirements: [
      { id: "REQ-001", text: "When a user logs in, the system shall issue a token." },
    ],
    designContent: [
      "## Infrastructure",
      "Deploy with Docker containers.",
      "The Todo model has id and title.",
      "GET /api/todos lists todos.",
    ].join("\n"),
  };

  it("synthesizes each supported diagram type with grounded evidence", () => {
    const haystack =
      `${sources.requirements.map((r) => r.text).join("\n")}\n${sources.designContent}`.toLowerCase();
    for (const type of AUTO_DIAGRAM_TYPES) {
      const result = generateDiagramFromContent(type, sources);
      expect(result.mermaid.length).toBeGreaterThan(10);
      expect(result.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of result.evidenceRefs) {
        expect(haystack).toContain(ref.toLowerCase());
      }
    }
  });

  it("propagates InsufficientEvidenceError when the source lacks evidence", () => {
    expect(() =>
      generateDiagramFromContent("er", {
        featureName: "Empty",
        requirements: [],
        designContent: "Nothing structured here.",
      }),
    ).toThrow(InsufficientEvidenceError);
  });
});

describe("isAutoDiagramType", () => {
  it("recognizes supported auto types", () => {
    expect(isAutoDiagramType("c4_context")).toBe(true);
    expect(isAutoDiagramType("sequence")).toBe(true);
    expect(isAutoDiagramType("er")).toBe(true);
    expect(isAutoDiagramType("deployment")).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(isAutoDiagramType("gantt")).toBe(false);
    expect(isAutoDiagramType("class")).toBe(false);
  });
});
