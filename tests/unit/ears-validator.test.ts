import { describe, it, expect, beforeEach } from "vitest";
import { EarsValidator } from "../../src/services/ears-validator.js";

describe("EarsValidator", () => {
  let validator: EarsValidator;

  beforeEach(() => {
    validator = new EarsValidator();
  });

  // ── detectPattern ────────────────────────────────────────────────────────
  describe("detectPattern", () => {
    it("detects ubiquitous pattern", () => {
      expect(validator.detectPattern("The system shall store user sessions.")).toBe("ubiquitous");
      expect(validator.detectPattern("The server shall respond within 200ms.")).toBe("ubiquitous");
      expect(validator.detectPattern("The tool shall validate input.")).toBe("ubiquitous");
    });

    it("detects event_driven pattern", () => {
      expect(validator.detectPattern("When the user submits the form, the system shall validate all fields.")).toBe("event_driven");
      expect(validator.detectPattern("When a file is uploaded, the server shall scan for malware.")).toBe("event_driven");
    });

    it("detects state_driven pattern", () => {
      expect(validator.detectPattern("While the session is active, the system shall refresh tokens automatically.")).toBe("state_driven");
      expect(validator.detectPattern("While processing, the server shall display a progress indicator.")).toBe("state_driven");
    });

    it("detects optional pattern", () => {
      expect(validator.detectPattern("Where dark mode is enabled, the system shall render backgrounds in #1B1B1F.")).toBe("optional");
      expect(validator.detectPattern("Where the premium feature is included, the tool shall unlock advanced exports.")).toBe("optional");
    });

    it("detects unwanted (negative) pattern", () => {
      expect(validator.detectPattern("If the authentication fails, then the system shall lock the account after 5 attempts.")).toBe("unwanted");
      expect(validator.detectPattern("If a network error occurs, then the server shall retry up to 3 times.")).toBe("unwanted");
    });

    it("returns unknown for non-EARS requirements", () => {
      expect(validator.detectPattern("Users should be able to log in.")).toBe("unknown");
      expect(validator.detectPattern("Fast response time.")).toBe("unknown");
      expect(validator.detectPattern("")).toBe("unknown");
    });

    it("is case-insensitive for the system/server/tool token", () => {
      expect(validator.detectPattern("The SYSTEM shall handle errors.")).toBe("ubiquitous");
      expect(validator.detectPattern("When ready, the SERVER shall notify.")).toBe("event_driven");
    });
  });

  // ── validate ─────────────────────────────────────────────────────────────
  describe("validate", () => {
    it("returns valid=true for a well-formed ubiquitous requirement", () => {
      const result = validator.validate("The system shall encrypt all data at rest using AES-256.");
      expect(result.valid).toBe(true);
      expect(result.pattern).toBe("ubiquitous");
      expect(result.issues).toBeUndefined();
    });

    it("returns valid=true for a well-formed event_driven requirement", () => {
      const result = validator.validate("When the user clicks submit, the system shall validate the payload and return a response.");
      expect(result.valid).toBe(true);
      expect(result.pattern).toBe("event_driven");
    });

    it("returns valid=false for unknown pattern", () => {
      const result = validator.validate("The app should be fast and easy to use.");
      expect(result.valid).toBe(false);
      expect(result.pattern).toBe("unknown");
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
    });

    it("returns valid=false for requirements with vague terms", () => {
      const result = validator.validate("The system shall respond fast by providing good output.");
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      const allIssues = result.issues!.join(" ");
      expect(allIssues).toMatch(/fast|good/i);
    });

    it("returns valid=false for requirements shorter than 20 chars", () => {
      const result = validator.validate("The system shall run.");
      expect(result.valid).toBe(false);
      expect(result.issues!.some(i => i.includes("short"))).toBe(true);
    });

    it("includes a suggestion when pattern is unknown", () => {
      const result = validator.validate("Please make login work.");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBeTruthy();
    });

    it("does not penalise requirements with multiple vague terms multiple times", () => {
      const result = validator.validate("The system shall handle errors properly and appropriately.");
      // Both 'properly' and 'appropriate' are vague
      expect(result.issues!.some(i => i.includes("properly"))).toBe(true);
      expect(result.issues!.some(i => i.includes("appropriate"))).toBe(true);
    });
  });

  // ── suggestImprovement ───────────────────────────────────────────────────
  describe("suggestImprovement", () => {
    it("suggests event_driven for trigger-like text", () => {
      const { pattern, suggestion } = validator.suggestImprovement("notify when payment received");
      expect(pattern).toBe("event_driven");
      expect(suggestion).toMatch(/When/);
    });

    it("suggests state_driven for state-like text", () => {
      const { pattern, suggestion } = validator.suggestImprovement("while system is processing data");
      expect(pattern).toBe("state_driven");
      expect(suggestion).toMatch(/While/);
    });

    it("suggests unwanted for failure-like text", () => {
      const { pattern, suggestion } = validator.suggestImprovement("if there is an error or fail case");
      expect(pattern).toBe("unwanted");
      expect(suggestion).toMatch(/If/);
    });

    it("suggests optional for option-like text", () => {
      const { pattern, suggestion } = validator.suggestImprovement("optional feature config export");
      expect(pattern).toBe("optional");
      expect(suggestion).toMatch(/Where/);
    });

    it("falls back to ubiquitous for unclassifiable text", () => {
      const { pattern, suggestion } = validator.suggestImprovement("do some stuff");
      expect(pattern).toBe("ubiquitous");
      expect(suggestion).toMatch(/The system shall/);
    });
  });

  // ── validateAll ──────────────────────────────────────────────────────────
  describe("validateAll", () => {
    it("returns aggregated results for a mixed list", () => {
      const requirements = [
        { id: "REQ-001", text: "The system shall authenticate users via OAuth 2.0." },
        { id: "REQ-002", text: "Should be fast." },
        { id: "REQ-003", text: "When the token expires, the system shall prompt the user to re-authenticate." },
      ];

      const batch = validator.validateAll(requirements);
      expect(batch.total).toBe(3);
      expect(batch.valid).toBe(2);
      expect(batch.invalid).toBe(1);
      expect(batch.results).toHaveLength(3);
    });

    it("returns 100% compliance for an all-valid list", () => {
      const requirements = [
        { id: "REQ-001", text: "The system shall store encrypted passwords using bcrypt with cost factor 12." },
        { id: "REQ-002", text: "While authenticated, the system shall maintain session state across requests." },
      ];

      const batch = validator.validateAll(requirements);
      expect(batch.valid).toBe(2);
      expect(batch.invalid).toBe(0);
    });

    it("handles an empty list without errors", () => {
      const batch = validator.validateAll([]);
      expect(batch.total).toBe(0);
      expect(batch.valid).toBe(0);
      expect(batch.invalid).toBe(0);
      expect(batch.results).toHaveLength(0);
    });
  });
});
