import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrossAnalyzer } from "../../src/services/cross-analyzer.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SPEC_WITH_REQS = `
## Requirements

### REQ-AUTH-001
The system shall authenticate users via OAuth 2.0.

### REQ-AUTH-002
When the token expires, the system shall prompt the user to re-authenticate.

### REQ-AUTH-003
The system shall enforce MFA for admin accounts.
`;

const DESIGN_REFERENCING_ALL = `
# Design

REQ-AUTH-001 is addressed by the OAuth2 middleware.
REQ-AUTH-002 is handled by the token refresh interceptor.
REQ-AUTH-003 is enforced at the admin gateway layer.
`;

const TASKS_REFERENCING_ALL = `
# Tasks

- [ ] Implement OAuth2 middleware — REQ-AUTH-001
- [ ] Token refresh interceptor — REQ-AUTH-002
- [ ] MFA enforcement at admin gateway — REQ-AUTH-003
`;

// ── Factory ────────────────────────────────────────────────────────────────────
function makeFileManager(spec: string, design?: string, tasks?: string) {
  return {
    readSpecFile: vi.fn().mockImplementation((_dir: string, file: string) => {
      if (file === "SPECIFICATION.md") return Promise.resolve(spec);
      throw new Error("ENOENT");
    }),
    readProjectFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  };
}

function makeFileManagerFull(spec: string, design?: string, tasks?: string) {
  return {
    readSpecFile: vi.fn().mockImplementation((_dir: string, file: string) => {
      if (file === "SPECIFICATION.md") return Promise.resolve(spec);
      if (file === "DESIGN.md" && design !== undefined) return Promise.resolve(design);
      if (file === "TASKS.md" && tasks !== undefined) return Promise.resolve(tasks);
      throw new Error("ENOENT");
    }),
    readProjectFile: vi.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("CrossAnalyzer", () => {
  describe("analyze — full alignment", () => {
    it("returns 100% consistency score when all REQs are in DESIGN and TASKS", async () => {
      const fm = makeFileManagerFull(SPEC_WITH_REQS, DESIGN_REFERENCING_ALL, TASKS_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.consistency_score).toBe(100);
      expect(result.orphaned_requirements).toHaveLength(0);
    });

    it("all spec_design_alignment entries are 'aligned'", async () => {
      const fm = makeFileManagerFull(SPEC_WITH_REQS, DESIGN_REFERENCING_ALL, TASKS_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      const notAligned = result.spec_design_alignment.filter(a => a.status !== "aligned");
      expect(notAligned).toHaveLength(0);
    });
  });

  describe("analyze — partial alignment", () => {
    it("detects orphaned requirements when DESIGN is missing references", async () => {
      const partialDesign = "REQ-AUTH-001 is addressed by the OAuth2 middleware.\n";
      const fm = makeFileManagerFull(SPEC_WITH_REQS, partialDesign, TASKS_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.orphaned_requirements.length).toBeGreaterThan(0);
      expect(result.consistency_score).toBeLessThan(100);
    });

    it("reports missing_designs for unaddressed requirements", async () => {
      const fm = makeFileManagerFull(SPEC_WITH_REQS, "No references here.", TASKS_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.missing_designs.length).toBeGreaterThan(0);
    });
  });

  describe("analyze — no DESIGN and no TASKS", () => {
    it("returns 0 consistency score without DESIGN and TASKS files", async () => {
      const fm = makeFileManager(SPEC_WITH_REQS);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.consistency_score).toBe(0);
    });

    it("lists all requirements as orphaned", async () => {
      const fm = makeFileManager(SPEC_WITH_REQS);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.orphaned_requirements).toContain("REQ-AUTH-001");
      expect(result.orphaned_requirements).toContain("REQ-AUTH-002");
      expect(result.orphaned_requirements).toContain("REQ-AUTH-003");
    });
  });

  describe("analyze — empty spec", () => {
    it("returns 100 score and empty alignments when spec has no REQ IDs", async () => {
      const fm = makeFileManagerFull("No structured requirements here.", "", "");
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result.spec_design_alignment).toHaveLength(0);
      expect(result.design_tasks_alignment).toHaveLength(0);
      expect(result.consistency_score).toBe(100);
    });
  });

  describe("analyze — result shape", () => {
    it("always returns all required fields", async () => {
      const fm = makeFileManagerFull(SPEC_WITH_REQS, DESIGN_REFERENCING_ALL, TASKS_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      expect(result).toHaveProperty("spec_design_alignment");
      expect(result).toHaveProperty("design_tasks_alignment");
      expect(result).toHaveProperty("orphaned_requirements");
      expect(result).toHaveProperty("orphaned_tasks");
      expect(result).toHaveProperty("missing_designs");
      expect(result).toHaveProperty("consistency_score");
      expect(result).toHaveProperty("explanation");
      expect(result).toHaveProperty("diagram");
    });

    it("each alignment entry has source_id, target_id, status, and detail", async () => {
      const fm = makeFileManagerFull(SPEC_WITH_REQS, DESIGN_REFERENCING_ALL);
      const analyzer = new CrossAnalyzer(fm as never);

      const result = await analyzer.analyze(".specs/features/001");
      for (const entry of result.spec_design_alignment) {
        expect(entry).toHaveProperty("source_id");
        expect(entry).toHaveProperty("target_id");
        expect(entry).toHaveProperty("status");
        expect(entry).toHaveProperty("detail");
      }
    });
  });
});
