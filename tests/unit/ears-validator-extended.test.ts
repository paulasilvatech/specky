/**
 * ears-validator-extended.test.ts — extended coverage for EarsValidator beyond
 * the regression locks in ears-validator.test.ts:
 *   - all six EARS patterns across subjects (system/server/tool) and casing
 *   - vague-term word boundaries (positive and negative matches)
 *   - suggestion routing for every intent branch and the action extractor
 *   - batch validation accounting
 *   - malformed/empty input and the MAX_MATCH_LEN bound
 */
import { describe, expect, it } from "vitest";
import { EarsValidator } from "../../src/services/ears-validator.js";
import type { EarsRequirement } from "../../src/types.js";

const v = new EarsValidator();

function requirement(text: string): EarsRequirement {
  return { id: "REQ-TST-001", pattern: "unknown", text, acceptance_criteria: [], traces_to: [] };
}

describe("EarsValidator.detectPattern — pattern coverage", () => {
  it("detects ubiquitous requirements for the system, server, and tool subjects", () => {
    expect(v.detectPattern("The system shall retain audit logs for seven years.")).toBe(
      "ubiquitous",
    );
    expect(v.detectPattern("The server shall reject malformed payloads.")).toBe("ubiquitous");
    expect(v.detectPattern("The tool shall emit a non-zero exit code on failure.")).toBe(
      "ubiquitous",
    );
  });

  it("detects event-driven requirements with an explicit trigger", () => {
    expect(v.detectPattern("When the queue depth exceeds 1000, the system shall shed load.")).toBe(
      "event_driven",
    );
    expect(v.detectPattern("When a token expires, the server shall return HTTP 401.")).toBe(
      "event_driven",
    );
  });

  it("detects state-driven requirements with an ongoing state", () => {
    expect(v.detectPattern("While the battery is low, the system shall dim the display.")).toBe(
      "state_driven",
    );
    expect(v.detectPattern("While in read-only mode, the tool shall refuse writes.")).toBe(
      "state_driven",
    );
  });

  it("detects optional requirements scoped to an included feature", () => {
    expect(
      v.detectPattern("Where single sign-on is configured, the system shall offer SAML login."),
    ).toBe("optional");
  });

  it("detects unwanted-behaviour requirements with a mitigation", () => {
    expect(
      v.detectPattern("If the database is unreachable, then the system shall serve stale reads."),
    ).toBe("unwanted");
  });

  it("detects both complex compound forms", () => {
    expect(
      v.detectPattern(
        "While in degraded mode, when a write arrives, the system shall buffer it to disk.",
      ),
    ).toBe("complex");
    expect(
      v.detectPattern(
        "When a deploy is requested, if the canary is unhealthy, then the system shall abort the rollout.",
      ),
    ).toBe("complex");
  });

  it("matches patterns case-insensitively", () => {
    expect(v.detectPattern("the system shall encrypt data at rest.")).toBe("ubiquitous");
    expect(v.detectPattern("WHEN a user logs in, THE SYSTEM SHALL record the event.")).toBe(
      "event_driven",
    );
  });

  it("ignores leading whitespace before the pattern keyword", () => {
    expect(v.detectPattern("   The system shall validate every input.")).toBe("ubiquitous");
  });

  it("treats a When+If compound without 'then' as event-driven, not complex", () => {
    expect(
      v.detectPattern(
        "When a payment fails, if retries are exhausted, the system shall alert the operator.",
      ),
    ).toBe("event_driven");
  });

  it("returns unknown for requirements missing the shall keyword", () => {
    expect(v.detectPattern("The system encrypts all data at rest.")).toBe("unknown");
    expect(v.detectPattern("Users can reset their passwords.")).toBe("unknown");
    expect(v.detectPattern("")).toBe("unknown");
  });
});

describe("EarsValidator.validate — single requirement", () => {
  it("accepts a measurable optional requirement", () => {
    const r = v.validate(
      "Where two-factor authentication is enabled, the system shall require a 6-digit OTP.",
    );
    expect(r.valid).toBe(true);
    expect(r.pattern).toBe("optional");
    expect(r.issues).toBeUndefined();
  });

  it("accepts a measurable unwanted-behaviour requirement", () => {
    const r = v.validate(
      "If the payment gateway times out after 5s, then the system shall retry the charge exactly once.",
    );
    expect(r.valid).toBe(true);
    expect(r.pattern).toBe("unwanted");
  });

  it("flags a matched pattern that is too short to be testable", () => {
    const r = v.validate("The system shall x.");
    expect(r.pattern).toBe("ubiquitous");
    expect(r.valid).toBe(false);
    expect(r.issues).toEqual(["Requirement is too short to be testable."]);
    expect(r.suggestion).toBeUndefined();
  });

  it("reports every vague term it finds, not just the first", () => {
    const r = v.validate("The system shall be fast, scalable, and reliable.");
    expect(r.valid).toBe(false);
    expect(r.issues?.filter((i) => i.includes("vague term"))).toHaveLength(3);
    expect(r.issues?.some((i) => i.includes('"fast"'))).toBe(true);
    expect(r.issues?.some((i) => i.includes('"scalable"'))).toBe(true);
    expect(r.issues?.some((i) => i.includes('"reliable"'))).toBe(true);
  });

  it("detects multi-word vague phrases", () => {
    const r = v.validate("The system shall scale up as needed to handle load.");
    expect(r.valid).toBe(false);
    expect(r.issues?.some((i) => i.includes('"as needed"'))).toBe(true);

    const phrase = v.validate("The system shall use state of the art encryption algorithms.");
    expect(phrase.issues?.some((i) => i.includes('"state of the art"'))).toBe(true);

    const friendly = v.validate("The system shall present a user friendly dashboard layout.");
    expect(friendly.issues?.some((i) => i.includes('"user friendly"'))).toBe(true);
  });

  it("matches vague terms case-insensitively", () => {
    const r = v.validate("The system shall respond in a FAST and EFFICIENT manner.");
    expect(r.issues?.some((i) => i.includes('"fast"'))).toBe(true);
    expect(r.issues?.some((i) => i.includes('"efficient"'))).toBe(true);
  });

  it("does not fire on vague-term substrings inside longer words", () => {
    // "goods" ⊃ good, "robustness" ⊃ robust, "simplest" ⊃ simple, "etcetera" ⊃ etc
    const r = v.validate(
      "The system shall record goods receipt, verify robustness metrics, and process the etcetera queue in the simplest cases within 200ms.",
    );
    expect(r.valid).toBe(true);
    expect(r.issues).toBeUndefined();
  });

  it("flags the catch-all 'etc' as a vague term", () => {
    const r = v.validate("The system shall log errors, warnings, etc.");
    expect(r.issues?.some((i) => i.includes('"etc"'))).toBe(true);
  });

  it("combines vague-term and multiple-shall issues in one result", () => {
    const r = v.validate(
      "The system shall be fast and the system shall validate every request schema.",
    );
    expect(r.valid).toBe(false);
    expect(r.issues?.some((i) => i.includes("vague term"))).toBe(true);
    expect(r.issues?.some((i) => i.includes('multiple "shall" clauses'))).toBe(true);
  });

  it("returns guidance and a suggestion for non-EARS input", () => {
    const r = v.validate("Users should be able to reset passwords.");
    expect(r.valid).toBe(false);
    expect(r.pattern).toBe("unknown");
    expect(r.issues).toHaveLength(2);
    expect(r.issues?.[0]).toBe("Requirement does not match any EARS pattern.");
    expect(r.issues?.[1]).toContain("EARS patterns start with");
    expect(r.suggestion).toBeDefined();
  });

  it("rejects empty and whitespace-only requirements", () => {
    for (const text of ["", "   ", "\n\t "]) {
      const r = v.validate(text);
      expect(r.valid).toBe(false);
      expect(r.pattern).toBe("unknown");
    }
  });
});

describe("EarsValidator.suggestImprovement", () => {
  it("routes event intent to the event-driven template", () => {
    const r = v.suggestImprovement("trigger a rebuild on every commit");
    expect(r.pattern).toBe("event_driven");
    expect(r.suggestion).toBe(
      "When <trigger event>, the system shall trigger a rebuild on every commit.",
    );
  });

  it("routes state intent to the state-driven template", () => {
    const r = v.suggestImprovement("the app must stay usable during a failover");
    expect(r.pattern).toBe("state_driven");
    expect(r.suggestion).toBe(
      "While <system state>, the system shall stay usable during a failover.",
    );
  });

  it("routes error intent to the unwanted template", () => {
    const r = v.suggestImprovement("the system must handle errors gracefully");
    expect(r.pattern).toBe("unwanted");
    expect(r.suggestion).toBe(
      "If <unwanted condition>, then the system shall handle errors gracefully.",
    );
  });

  it("routes configuration intent to the optional template", () => {
    const r = v.suggestImprovement("support configurable retry limits");
    expect(r.pattern).toBe("optional");
    expect(r.suggestion).toBe(
      "Where <feature is enabled>, the system shall support configurable retry limits.",
    );
  });

  it("falls back to the ubiquitous template with no intent keywords", () => {
    const r = v.suggestImprovement("encrypt all stored tokens");
    expect(r.pattern).toBe("ubiquitous");
    expect(r.suggestion).toBe("The system shall encrypt all stored tokens.");
  });

  it("prefers event intent over later branches when keywords collide", () => {
    // Contains both "when" and "fail" — the event branch is checked first.
    const r = v.suggestImprovement("when the disk is full the write fails");
    expect(r.pattern).toBe("event_driven");
  });

  it("strips leading imperative verbs and trailing punctuation from the action", () => {
    const r = v.suggestImprovement("Ensure all tokens are encrypted.");
    expect(r.suggestion).toBe("The system shall all tokens are encrypted.");
    expect(r.suggestion.endsWith(".")).toBe(true);
    expect(r.suggestion).not.toContain("..");
  });

  it("strips boilerplate subjects with any modal verb", () => {
    for (const modal of ["shall", "should", "must", "will", "needs to", "has to"]) {
      const r = v.suggestImprovement(`The server ${modal} validate tokens`);
      expect(r.suggestion).toBe("The system shall validate tokens.");
    }
  });

  it("uses a placeholder action when nothing remains after stripping", () => {
    // An empty requirement yields an empty action, which falls back to the placeholder.
    const r = v.suggestImprovement("");
    expect(r.pattern).toBe("ubiquitous");
    expect(r.suggestion).toBe("The system shall perform the specified action.");
  });
});

describe("EarsValidator.validateAll — batch validation", () => {
  it("counts valid and invalid results and preserves order", () => {
    const batch = v.validateAll([
      requirement("The system shall encrypt all tokens using AES-256."),
      requirement("The system should maybe encrypt things nicely."),
      requirement("When a user logs out, the system shall revoke the session within 100ms."),
      requirement("If the cache fill exceeds 90%, then the system shall evict the oldest entries."),
    ]);
    expect(batch.results).toHaveLength(4);
    expect(batch.valid).toBe(3);
    expect(batch.invalid).toBe(1);
    expect(batch.results[0].valid).toBe(true);
    expect(batch.results[1].valid).toBe(false);
    expect(batch.results[1].pattern).toBe("unknown");
    expect(batch.results[2].pattern).toBe("event_driven");
    expect(batch.results[3].pattern).toBe("unwanted");
  });

  it("returns zeroed counts for an empty batch", () => {
    const batch = v.validateAll([]);
    expect(batch).toEqual({ valid: 0, invalid: 0, results: [] });
  });

  it("validates a batch consisting only of empty requirements", () => {
    const batch = v.validateAll([requirement(""), requirement("   ")]);
    expect(batch.valid).toBe(0);
    expect(batch.invalid).toBe(2);
    expect(batch.results.every((r) => r.pattern === "unknown")).toBe(true);
  });
});

describe("EarsValidator — input bounding", () => {
  it("still detects a pattern when the requirement exceeds the match bound", () => {
    const long = `The system shall ${"process records ".repeat(300)}within 500ms.`;
    expect(long.length).toBeGreaterThan(2000);
    expect(v.detectPattern(long)).toBe("ubiquitous");
  });

  it("returns unknown when the EARS lead-in sits beyond the match bound", () => {
    const long = `${"filler ".repeat(400)}The system shall validate input.`;
    expect(long.length).toBeGreaterThan(2000);
    expect(v.detectPattern(long)).toBe("unknown");
  });
});
