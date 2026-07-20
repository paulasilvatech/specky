/**
 * content-diagram-generator.test.ts — content-driven diagram generation.
 */
import { describe, expect, it } from "vitest";
import {
  extractActors,
  extractApiEndpoints,
  extractDataEntities,
  extractSystem,
  generateC4ContextDiagram,
  generateDeploymentDiagram,
  generateErDiagram,
  generateSequenceDiagram,
} from "../../src/services/content-diagram-generator.js";

describe("extractActors", () => {
  it("extracts user and admin actors from requirements", () => {
    const requirements = [
      { id: "REQ-001", text: "When a user logs in, the system shall issue a token." },
      { id: "REQ-002", text: "When an admin deletes a record, the system shall audit it." },
    ];

    const actors = extractActors(requirements);

    expect(actors).toContainEqual({ id: "user", name: "User", type: "person" });
    expect(actors).toContainEqual({ id: "admin", name: "Administrator", type: "person" });
  });

  it("extracts external systems from requirements", () => {
    const requirements = [
      { id: "REQ-001", text: "The system shall cache results in Redis." },
      { id: "REQ-002", text: "When the API is unavailable, the system shall retry." },
    ];

    const actors = extractActors(requirements);

    expect(actors).toContainEqual({ id: "cache", name: "Cache", type: "system" });
    expect(actors).toContainEqual({ id: "api", name: "External API", type: "system" });
  });

  it("defaults to user when no actors found", () => {
    const requirements = [{ id: "REQ-001", text: "The system shall process data." }];
    const actors = extractActors(requirements);

    expect(actors).toHaveLength(1);
    expect(actors[0].id).toBe("user");
  });
});

describe("extractSystem", () => {
  it("creates a system component from feature name", () => {
    const system = extractSystem("Todo API");
    expect(system.id).toBe("todo-api");
    expect(system.name).toBe("Todo API");
  });
});

describe("extractApiEndpoints", () => {
  it("extracts REST endpoints from design content", () => {
    const design = `
      ## API Contracts
      - GET /api/users - List all users
      - POST /api/users - Create a user
      - GET /api/users/:id - Get user by ID
      - DELETE /api/users/:id - Delete user
    `;

    const endpoints = extractApiEndpoints(design);

    expect(endpoints).toHaveLength(4);
    expect(endpoints[0]).toEqual({
      method: "GET",
      path: "/api/users",
      description: "List all users",
    });
    expect(endpoints[1]).toEqual({
      method: "POST",
      path: "/api/users",
      description: "Create a user",
    });
  });

  it("deduplicates repeated endpoints", () => {
    const design = `
      GET /api/health
      GET /api/health
      POST /api/health
    `;

    const endpoints = extractApiEndpoints(design);

    expect(endpoints).toHaveLength(2);
  });
});

describe("extractDataEntities", () => {
  it("extracts entity definitions from design content", () => {
    const design = `
      ## Data Model
      The User entity stores authentication data.
      The Todo model contains task information.
    `;

    const entities = extractDataEntities(design);

    expect(entities.length).toBeGreaterThanOrEqual(2);
    expect(entities.map((e) => e.name)).toContain("User");
    expect(entities.map((e) => e.name)).toContain("Todo");
  });

  it("limits attributes to 5 per entity", () => {
    const design = `
      The User entity has id, name, email, password, created_at, updated_at, status, role.
    `;

    const entities = extractDataEntities(design);

    expect(entities[0]?.attributes.length).toBeLessThanOrEqual(5);
  });
});

describe("generateC4ContextDiagram", () => {
  it("generates valid C4Context Mermaid", () => {
    const system = { id: "todo-api", name: "Todo API" };
    const actors = [
      { id: "user", name: "User", type: "person" as const },
      { id: "db", name: "Database", type: "system" as const },
    ];

    const diagram = generateC4ContextDiagram(system, actors);

    expect(diagram).toContain("C4Context");
    expect(diagram).toContain("title Todo API - System Context");
    expect(diagram).toContain('Person(user, "User")');
    expect(diagram).toContain('System_Ext(db, "Database")');
    expect(diagram).toContain('System(todo-api, "Todo API")');
    expect(diagram).toContain('Rel(user, todo-api, "Uses")');
  });
});

describe("generateSequenceDiagram", () => {
  it("generates valid sequence diagram with API endpoints", () => {
    const system = { id: "todo-api", name: "Todo API" };
    const actors = [{ id: "user", name: "User", type: "person" as const }];
    const endpoints = [
      { method: "GET", path: "/api/todos", description: "List todos" },
      { method: "POST", path: "/api/todos", description: "Create todo" },
    ];

    const diagram = generateSequenceDiagram(system, actors, endpoints);

    expect(diagram).toContain("sequenceDiagram");
    expect(diagram).toContain("participant user as User");
    expect(diagram).toContain("participant todo-api as Todo API");
    expect(diagram).toContain("user->>+todo-api: GET /api/todos");
    expect(diagram).toContain("user->>+todo-api: POST /api/todos");
  });

  it("limits to 5 endpoints", () => {
    const system = { id: "api", name: "API" };
    const actors = [{ id: "user", name: "User", type: "person" as const }];
    const endpoints = Array.from({ length: 10 }, (_, i) => ({
      method: "GET",
      path: `/api/endpoint${i}`,
    }));

    const diagram = generateSequenceDiagram(system, actors, endpoints);

    const calls = diagram.match(/user->>\+api:/g);
    expect(calls).toHaveLength(5);
  });
});

describe("generateErDiagram", () => {
  it("generates valid ER diagram with entities", () => {
    const entities = [
      { name: "User", attributes: ["id", "email"] },
      { name: "Todo", attributes: ["id", "title", "status"] },
    ];

    const diagram = generateErDiagram(entities);

    expect(diagram).toContain("erDiagram");
    expect(diagram).toContain("User {");
    expect(diagram).toContain("string id");
    expect(diagram).toContain("string email");
    expect(diagram).toContain("Todo {");
    expect(diagram).toContain('User ||--o{ Todo : "has"');
  });

  it("handles empty entities", () => {
    const diagram = generateErDiagram([]);
    expect(diagram).toContain("No entities extracted");
  });
});

describe("generateDeploymentDiagram", () => {
  it("generates deployment diagram with containers", () => {
    const system = { id: "todo-api", name: "Todo API" };
    const design = "Deploy to Azure Container Apps with Docker containers";

    const diagram = generateDeploymentDiagram(system, design);

    expect(diagram).toContain("flowchart TB");
    expect(diagram).toContain("Todo API Deployment");
    expect(diagram).toContain("Containers");
  });

  it("generates deployment diagram with cloud", () => {
    const system = { id: "todo-api", name: "Todo API" };
    const design = "Deploy to Azure cloud platform";

    const diagram = generateDeploymentDiagram(system, design);

    expect(diagram).toContain("Cloud");
  });

  it("falls back to generic server", () => {
    const system = { id: "todo-api", name: "Todo API" };
    const design = "Simple deployment";

    const diagram = generateDeploymentDiagram(system, design);

    expect(diagram).toContain("Application Server");
  });
});
