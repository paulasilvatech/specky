import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";

// ── Factory ────────────────────────────────────────────────────────────────────
function makeFileManager(files: Record<string, string> = {}) {
  return {
    readSpecFile: vi.fn().mockImplementation((_specDir: string, file: string) => {
      const content = files[file];
      if (content !== undefined) return Promise.resolve(content);
      throw new Error("ENOENT");
    }),
    readProjectFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("DiagramGenerator", () => {
  let generator: DiagramGenerator;

  beforeEach(() => {
    generator = new DiagramGenerator(makeFileManager() as never);
  });

  // ── generateDiagram ──────────────────────────────────────────────────────
  describe("generateDiagram — output shape", () => {
    it("returns an object with type, title, source, and mermaid_code", () => {
      const spec = generator.generateDiagram("- Step A\n- Step B\n- Step C", "flowchart", "My Flow");
      expect(spec).toHaveProperty("type", "flowchart");
      expect(spec).toHaveProperty("title", "My Flow");
      expect(spec).toHaveProperty("source", "spec");
      expect(spec).toHaveProperty("mermaid_code");
      expect(typeof spec.mermaid_code).toBe("string");
      expect(spec.mermaid_code.length).toBeGreaterThan(0);
    });
  });

  describe("generateDiagram — flowchart", () => {
    it("generates valid Mermaid flowchart starting with 'flowchart TD'", () => {
      const content = "- Authenticate user\n- Validate input\n- Process request\n- Return response";
      const result = generator.generateDiagram(content, "flowchart", "Request Flow");
      expect(result.mermaid_code).toMatch(/^flowchart TD/);
    });

    it("falls back gracefully when content has no list items", () => {
      const result = generator.generateDiagram("", "flowchart", "Empty");
      expect(result.mermaid_code).toMatch(/^flowchart TD/);
      expect(result.mermaid_code).toContain("Empty");
    });
  });

  describe("generateDiagram — sequence", () => {
    it("generates valid Mermaid sequence diagram", () => {
      const content = "User authenticates. System validates. API responds.";
      const result = generator.generateDiagram(content, "sequence", "API Flow");
      expect(result.mermaid_code).toMatch(/^sequenceDiagram/);
    });
  });

  describe("generateDiagram — er", () => {
    it("generates a valid Mermaid ER diagram", () => {
      const content = "User entity has id, name, email. Order entity has id, amount.";
      const result = generator.generateDiagram(content, "er", "Data Model");
      expect(result.mermaid_code).toMatch(/^erDiagram/);
    });
  });

  describe("generateDiagram — class", () => {
    it("generates a valid Mermaid class diagram", () => {
      const content = "IRepository interface with getById. IService interface.";
      const result = generator.generateDiagram(content, "class", "Interfaces");
      expect(result.mermaid_code).toContain("classDiagram");
    });
  });

  describe("generateDiagram — state", () => {
    it("generates a valid Mermaid state diagram", () => {
      const content = "IDLE → PROCESSING → DONE states.";
      const result = generator.generateDiagram(content, "state", "State Machine");
      expect(result.mermaid_code).toContain("stateDiagram");
    });
  });

  describe("generateDiagram — gantt", () => {
    it("generates a valid Mermaid Gantt chart", () => {
      const content = "- [ ] Task 1 — sprint 1\n- [ ] Task 2 — sprint 1\n- [ ] Task 3 — sprint 2";
      const result = generator.generateDiagram(content, "gantt", "Timeline");
      expect(result.mermaid_code).toMatch(/^gantt/);
    });
  });

  describe("generateDiagram — pie", () => {
    it("generates a valid pie chart with title", () => {
      const content = "- Item A\n- Item B\n- Item C";
      const result = generator.generateDiagram(content, "pie", "Coverage");
      expect(result.mermaid_code).toMatch(/^pie/);
    });
  });

  describe("generateDiagram — mindmap", () => {
    it("generates a valid mindmap", () => {
      const content = "# Project\n## Auth\n## API\n## Storage";
      const result = generator.generateDiagram(content, "mindmap", "Project Map");
      expect(result.mermaid_code).toContain("mindmap");
    });
  });

  describe("generateDiagram — c4_context and c4_container", () => {
    it("generates C4 context diagram", () => {
      const result = generator.generateDiagram("User accesses API gateway.", "c4_context", "C4 Context");
      expect(result.mermaid_code).toBeTruthy();
    });

    it("generates C4 container diagram", () => {
      const result = generator.generateDiagram("API container uses database.", "c4_container", "C4 Container");
      expect(result.mermaid_code).toBeTruthy();
    });
  });

  describe("generateDiagram — unknown type fallback", () => {
    it("falls back to flowchart for unknown diagram type", () => {
      const result = generator.generateDiagram("content", "unknown_type" as never, "Fallback");
      expect(result.mermaid_code).toMatch(/^flowchart TD/);
    });
  });

  // ── generateUserStoryFlow ─────────────────────────────────────────────────
  describe("generateUserStoryFlow", () => {
    it("generates a flowchart with all story steps connected", () => {
      const steps = ["As a user", "I click login", "I enter credentials", "I access dashboard"];
      const mermaid = generator.generateUserStoryFlow("Login Flow", steps);
      expect(mermaid).toMatch(/^flowchart TD/);
      expect(mermaid).toContain("-->");
    });

    it("returns a single node when steps array is empty", () => {
      const mermaid = generator.generateUserStoryFlow("Empty Story", []);
      expect(mermaid).toMatch(/^flowchart TD/);
      expect(mermaid).not.toContain("-->");
    });
  });

  // ── generateAllDiagrams ────────────────────────────────────────────────────
  describe("generateAllDiagrams", () => {
    it("generates diagrams only for available artifact files", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "- REQ-001\n- REQ-002",
        "DESIGN.md": "# Design\nUser service interacts with API.",
      });
      const gen = new DiagramGenerator(fm as never);

      const result = await gen.generateAllDiagrams(".specs", ".specs/features/001");
      expect(result.total_generated).toBeGreaterThan(0);
      expect(Array.isArray(result.diagrams)).toBe(true);
      expect(result.feature_number).toBe("001");
    });

    it("returns zero diagrams when no artifact files exist", async () => {
      const gen = new DiagramGenerator(makeFileManager() as never);
      const result = await gen.generateAllDiagrams(".specs", ".specs/features/001");
      expect(result.total_generated).toBe(0);
      expect(result.diagrams).toHaveLength(0);
    });
  });
});
