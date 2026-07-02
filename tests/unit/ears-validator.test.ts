/**
 * ears-validator.test.ts — locks the EARS pattern detection and validation
 * behaviour, including the bugs fixed in the v2 pass:
 *   - the "complex" compound pattern is reachable (was shadowed by state-driven)
 *   - suggestions no longer double the "The system shall" boilerplate
 *   - vague terms match on word boundaries ("breakfast" ≠ "fast")
 */
import { describe, expect, it } from "vitest";
import { EarsValidator } from "../../src/services/ears-validator.js";

const v = new EarsValidator();

describe("EarsValidator.detectPattern", () => {
  it("detects each of the six EARS patterns", () => {
    expect(v.detectPattern("The system shall encrypt all data at rest.")).toBe("ubiquitous");
    expect(v.detectPattern("When a user submits login, the system shall validate credentials.")).toBe("event_driven");
    expect(v.detectPattern("While offline, the system shall queue requests.")).toBe("state_driven");
    expect(v.detectPattern("Where 2FA is enabled, the system shall require an OTP.")).toBe("optional");
    expect(v.detectPattern("If the session expires, then the system shall redirect to login.")).toBe("unwanted");
  });

  it("reaches the complex pattern for a genuine compound (regression)", () => {
    // Before the fix the greedy state-driven rule matched first and complex
    // was unreachable.
    expect(
      v.detectPattern("While in maintenance mode, when a request arrives, the system shall queue it."),
    ).toBe("complex");
    expect(
      v.detectPattern("When a payment fails, if retries are exhausted, then the system shall alert the operator."),
    ).toBe("complex");
  });

  it("does not misclassify simple event/state requirements as complex", () => {
    expect(v.detectPattern("When a user logs in, the system shall record the timestamp.")).toBe("event_driven");
    expect(v.detectPattern("While syncing, the system shall show a spinner.")).toBe("state_driven");
  });

  it("returns unknown for non-EARS text", () => {
    expect(v.detectPattern("The system should be fast and user friendly.")).toBe("unknown");
    expect(v.detectPattern("Make login work.")).toBe("unknown");
  });
});

describe("EarsValidator.validate", () => {
  it("passes a well-formed, measurable requirement", () => {
    const r = v.validate("When a user submits valid credentials, the system shall issue a JWT within 500ms.");
    expect(r.valid).toBe(true);
    expect(r.issues).toBeUndefined();
  });

  it("flags vague terms with a word-boundary match", () => {
    const r = v.validate("The system shall be fast.");
    expect(r.valid).toBe(false);
    expect(r.issues?.some((i) => i.includes('vague term "fast"'))).toBe(true);
  });

  it("does not false-positive vague terms inside longer words", () => {
    const r = v.validate("When a user orders breakfast, the system shall record the order within 300ms.");
    expect(r.valid).toBe(true);
  });

  it("flags multiple shall clauses", () => {
    const r = v.validate("The system shall log the event and the system shall notify the admin.");
    expect(r.valid).toBe(false);
    expect(r.issues?.some((i) => i.includes("multiple"))).toBe(true);
  });
});

describe("EarsValidator.suggestImprovement", () => {
  it("does not duplicate the boilerplate lead-in (regression)", () => {
    const { suggestion } = v.suggestImprovement("The system shall be fast.");
    expect(suggestion).toBe("The system shall be fast.");
    expect(suggestion).not.toContain("shall The system shall");
  });

  it("rewrites a bare imperative into ubiquitous form", () => {
    const { suggestion } = v.suggestImprovement("make the login work");
    expect(suggestion.startsWith("The system shall ")).toBe(true);
  });

  it("routes event-flavoured intent to the event-driven pattern", () => {
    const { pattern } = v.suggestImprovement("when the button is clicked, do the thing");
    expect(pattern).toBe("event_driven");
  });
});

describe("EarsValidator ReDoS guard", () => {
  it("terminates (does not hang) on a long comma-heavy non-matching string", () => {
    // A pathological input for the compound pattern's greedy groups. The input
    // is bounded before matching, so this returns rather than backtracking
    // forever. Behavioural, not wall-clock based, to avoid a flaky timing test;
    // a real hang is caught by vitest's per-test timeout.
    const evil = "While " + "a, ".repeat(5000) + "no shall here";
    expect(v.detectPattern(evil)).toBe("unknown");
    expect(v.validate(evil).valid).toBe(false);
  });
});
