import { describe, it, expect, vi } from "vitest";
import { PbtGenerator } from "../../src/services/pbt-generator.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SPEC_WITH_EARS = [
  "### REQ-CORE-001: (ubiquitous)",
  "",
  "The system shall validate all user inputs before processing.",
  "",
  "### REQ-CORE-002: (event_driven)",
  "",
  "When the user submits a form, the system shall save the data to the database.",
  "",
  "### REQ-CORE-003: (unwanted)",
  "",
  "If a database connection error occurs, then the system shall retry the operation up to 3 times.",
  "",
  "### REQ-CORE-004: (state_driven)",
  "",
  "While the system is in maintenance mode, the system shall reject all write operations.",
  "",
  "### REQ-CORE-005: (event_driven)",
  "",
  "When the user requests data export, the system shall serialize the records and parse the output format.",
].join("\n");

const SPEC_WITH_IDEMPOTENCE = [
  "### REQ-CORE-001: (event_driven)",
  "",
  "When the user clicks delete, the system shall remove the record permanently.",
].join("\n");

const SPEC_WITH_CONVERT = [
  "### REQ-CORE-001: (event_driven)",
  "",
  "When the user uploads a file, the system shall convert the data and decode the payload.",
].join("\n");

function makeFileManager(specContent: string) {
  return {
    readSpecFile: vi.fn((_dir: string, file: string) => {
      if (file.includes("SPECIFICATION")) return Promise.resolve(specContent);
      return Promise.reject(new Error("Not found"));
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PbtGenerator", () => {
  // ── extractEarsRequirements ───────────────────────────────────────────

  describe("extractEarsRequirements", () => {
    it("extracts ubiquitous requirements", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("The system shall validate all inputs.\nSome random text.");
      expect(reqs).toHaveLength(1);
      expect(reqs[0].line).toContain("validate all inputs");
    });

    it("extracts event-driven requirements", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("When the user logs in, the system shall create a session.");
      expect(reqs).toHaveLength(1);
      expect(reqs[0].line).toContain("When the user logs in");
    });

    it("extracts state-driven requirements", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("While the system is offline, the system shall queue requests.");
      expect(reqs).toHaveLength(1);
      expect(reqs[0].line).toContain("While the system is offline");
    });

    it("extracts unwanted (If) requirements", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("If an error occurs, then the system shall log the failure.");
      expect(reqs).toHaveLength(1);
      expect(reqs[0].line).toContain("If an error occurs");
    });

    it("extracts requirements from full spec with headers", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements(SPEC_WITH_EARS);
      // REQ IDs are in headers, not on the same line as EARS text, so fallback IDs are generated
      expect(reqs.length).toBeGreaterThan(0);
      expect(reqs[0].reqId).toMatch(/^REQ-/);
    });

    it("generates fallback IDs when REQ-XXX not found", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("The system shall do something.");
      expect(reqs[0].reqId).toMatch(/^REQ-GEN-\d{3}$/);
    });

    it("returns empty for empty text", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("");
      expect(reqs).toHaveLength(0);
    });

    it("returns empty for non-EARS text", () => {
      const gen = new PbtGenerator({} as never);
      const reqs = gen.extractEarsRequirements("This is just a regular paragraph about nothing.");
      expect(reqs).toHaveLength(0);
    });
  });

  // ── classifyPropertyType ──────────────────────────────────────────────

  describe("classifyPropertyType", () => {
    it("classifies ubiquitous as invariant", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall validate all inputs")).toBe("invariant");
    });

    it("classifies event-driven as state_transition", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("When the user clicks submit, the system shall save")).toBe("state_transition");
    });

    it("classifies state-driven as conditional", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("While in maintenance mode, the system shall reject writes")).toBe("conditional");
    });

    it("classifies unwanted as negative", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("If an error occurs, then the system shall log it")).toBe("negative");
    });

    it("classifies Where as conditional", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("Where the feature is enabled, the system shall show it")).toBe("conditional");
    });

    it("detects round_trip for parse+serialize", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall parse the JSON and serialize the output")).toBe("round_trip");
    });

    it("detects round_trip for convert/transform", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall convert data to XML format")).toBe("round_trip");
    });

    it("detects round_trip for encode/decode", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall encode and decode the payload")).toBe("round_trip");
    });

    it("detects idempotence for delete/remove/reset", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall delete the record permanently")).toBe("idempotence");
    });

    it("detects idempotence for update/apply", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall update the configuration settings")).toBe("idempotence");
    });

    it("detects commutativity for order-independent operations", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall combine items regardless of order")).toBe("commutativity");
    });

    it("detects commutativity for swap/interchangeable", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall produce interchangeable results")).toBe("commutativity");
    });

    it("detects monotonicity for proportional relationships", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall scale monotonically with load")).toBe("monotonicity");
    });

    it("detects monotonicity for proportional keyword", () => {
      const gen = new PbtGenerator({} as never);
      expect(gen.classifyPropertyType("The system shall grow proportional to input size")).toBe("monotonicity");
    });
  });

  // ── generate (fast-check) ─────────────────────────────────────────────

  describe("generate — fast-check", () => {
    it("generates properties for all EARS requirements", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.framework).toBe("fast-check");
      expect(result.total_properties).toBe(5);
      expect(result.properties).toHaveLength(5);
    });

    it("produces sequential PROP IDs", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.properties[0].id).toBe("PROP-001");
      expect(result.properties[1].id).toBe("PROP-002");
      expect(result.properties[4].id).toBe("PROP-005");
    });

    it("extracts requirement IDs (generated or from spec)", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      const reqIds = result.properties.map(p => p.requirement_id);
      // REQ IDs may be extracted from line or generated as fallback
      for (const id of reqIds) {
        expect(id).toMatch(/^REQ-/);
      }
    });

    it("contains fc.assert in output", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.content).toContain("fc.assert");
      expect(result.content).toContain("fc.property");
    });

    it("contains vitest imports", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.content).toContain('import { describe, it, expect } from "vitest"');
      expect(result.content).toContain('import { fc } from "fast-check"');
    });

    it("output file has .pbt.test.ts extension", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.output_file).toMatch(/\.pbt\.test\.ts$/);
    });

    it("counts property types correctly", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.property_types).toBeDefined();
      const total = Object.values(result.property_types).reduce((a, b) => a + b, 0);
      expect(total).toBe(5);
    });

    it("generates round_trip test for serialize+parse requirement", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      // REQ-CORE-005 mentions serialize and parse
      const roundTrip = result.properties.find(p => p.property_type === "round_trip");
      expect(roundTrip).toBeDefined();
      expect(roundTrip!.test_code).toContain("round-trip");
    });

    it("generates idempotence test for delete requirement", async () => {
      const fm = makeFileManager(SPEC_WITH_IDEMPOTENCE);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      const idem = result.properties.find(p => p.property_type === "idempotence");
      expect(idem).toBeDefined();
      expect(idem!.test_code).toContain("idempotence");
    });
  });

  // ── generate (hypothesis) ─────────────────────────────────────────────

  describe("generate — hypothesis", () => {
    it("generates Python property-based tests", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      expect(result.framework).toBe("hypothesis");
      expect(result.total_properties).toBe(5);
    });

    it("output file has _pbt_test.py extension", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      expect(result.output_file).toMatch(/_pbt_test\.py$/);
    });

    it("contains hypothesis imports", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      expect(result.content).toContain("from hypothesis import given");
      expect(result.content).toContain("from hypothesis import strategies as st");
    });

    it("contains @given decorators", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      expect(result.content).toContain("@given(");
      expect(result.content).toContain("@settings(max_examples=100)");
    });

    it("contains class definition", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      expect(result.content).toContain("class TestPropertyBased_");
    });

    it("generates round_trip test for convert+decode", async () => {
      const fm = makeFileManager(SPEC_WITH_CONVERT);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "hypothesis", "tests");

      const roundTrip = result.properties.find(p => p.property_type === "round_trip");
      expect(roundTrip).toBeDefined();
      expect(roundTrip!.test_code).toContain("round_trip");
    });
  });

  // ── generate — commutativity/monotonicity ───────────────────────────────

  describe("generate — commutativity and monotonicity", () => {
    const SPEC_COMMUTATIVE = "The system shall combine items regardless of order in all merge operations.";
    const SPEC_MONOTONIC = "The system shall scale monotonically with increasing input load.";

    it("generates commutativity fast-check test", async () => {
      const fm = makeFileManager(SPEC_COMMUTATIVE);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test", "fast-check", "tests");
      const comm = result.properties.find(p => p.property_type === "commutativity");
      expect(comm).toBeDefined();
      expect(comm!.test_code).toContain("commutativity");
    });

    it("generates monotonicity fast-check test", async () => {
      const fm = makeFileManager(SPEC_MONOTONIC);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test", "fast-check", "tests");
      const mono = result.properties.find(p => p.property_type === "monotonicity");
      expect(mono).toBeDefined();
      expect(mono!.test_code).toContain("monotonicity");
    });

    it("generates commutativity hypothesis test", async () => {
      const fm = makeFileManager(SPEC_COMMUTATIVE);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test", "hypothesis", "tests");
      const comm = result.properties.find(p => p.property_type === "commutativity");
      expect(comm).toBeDefined();
      expect(comm!.test_code).toContain("commutativity");
    });

    it("generates monotonicity hypothesis test", async () => {
      const fm = makeFileManager(SPEC_MONOTONIC);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test", "hypothesis", "tests");
      const mono = result.properties.find(p => p.property_type === "monotonicity");
      expect(mono).toBeDefined();
      expect(mono!.test_code).toContain("monotonicity");
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty spec gracefully", async () => {
      const fm = makeFileManager("");
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-empty", "fast-check", "tests");

      expect(result.total_properties).toBe(0);
      expect(result.properties).toHaveLength(0);
      expect(result.content).toContain("describe(");
    });

    it("handles spec with no EARS requirements", async () => {
      const fm = makeFileManager("# Just a title\n\nSome regular text without EARS.");
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-no-ears", "fast-check", "tests");

      expect(result.total_properties).toBe(0);
    });

    it("includes header with feature name", async () => {
      const fm = makeFileManager(SPEC_WITH_EARS);
      const gen = new PbtGenerator(fm as never);
      const result = await gen.generate(".specs/001-test-feature", "fast-check", "tests");

      expect(result.content).toContain("Auto-generated property-based tests from Specky SDD");
      expect(result.content).toContain("Framework: fast-check");
    });
  });
});
