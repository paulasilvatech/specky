import { describe, expect, it } from "vitest";
import {
  extractRequirementIds,
  extractRequirementSections,
  extractTaskIds,
  formatTaskId,
  normalizeTaskId,
  TASK_LINE_PATTERN,
} from "../../src/utils/id-contracts.js";

describe("ID contracts", () => {
  it("normalizes canonical and legacy task IDs to T-001", () => {
    expect(normalizeTaskId("T-001")).toBe("T-001");
    expect(normalizeTaskId("T001")).toBe("T-001");
  });

  it("formats task IDs canonically", () => {
    expect(formatTaskId(1)).toBe("T-001");
    expect(formatTaskId(42)).toBe("T-042");
    expect(formatTaskId(999)).toBe("T-999");
  });

  it("rejects invalid task IDs", () => {
    expect(() => normalizeTaskId("TASK-001")).toThrow("Invalid task ID");
    expect(() => formatTaskId(0)).toThrow("Task sequence out of range");
  });

  it("extracts sorted unique requirement IDs", () => {
    const text = "REQ-NFR-002 then REQ-CORE-001 then REQ-CORE-001";
    expect(extractRequirementIds(text)).toEqual(["REQ-CORE-001", "REQ-NFR-002"]);
  });

  it("extracts sorted unique task IDs across canonical and legacy formats", () => {
    const text = "T002 depends on T-001 and T002";
    expect(extractTaskIds(text)).toEqual(["T-001", "T-002"]);
  });

  it("parses task lines with canonical task IDs", () => {
    const tasks = "- [x] T-001: Implement parser REQ-CORE-001\n- [ ] T002 [P] Legacy task";
    const matches = [...tasks.matchAll(TASK_LINE_PATTERN)];

    expect(matches).toHaveLength(2);
    expect(normalizeTaskId(matches[0][1])).toBe("T-001");
    expect(matches[0][3]).toContain("Implement parser");
    expect(normalizeTaskId(matches[1][1])).toBe("T-002");
  });
});

describe("extractRequirementSections", () => {
  it("parses requirement heading, title, and body", () => {
    const spec = [
      "# Specification",
      "",
      "### REQ-CORE-001: User login",
      "When a user submits credentials, the system shall authenticate them.",
      "",
      "### REQ-CORE-002: Admin audit",
      "When an admin deletes a record, the system shall log it.",
    ].join("\n");

    const sections = extractRequirementSections(spec);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe("REQ-CORE-001");
    expect(sections[0].title).toBe("User login");
    expect(sections[0].text).toContain("authenticate");
    expect(sections[1].id).toBe("REQ-CORE-002");
  });

  it("excludes acceptance-criteria prose from the requirement text", () => {
    const spec = [
      "### REQ-CORE-001: Login",
      "When a user logs in, the system shall issue a token.",
      "",
      "Acceptance Criteria:",
      "- Token expires in 15 minutes",
      "- Refresh token is rotated",
    ].join("\n");

    const [section] = extractRequirementSections(spec);
    expect(section.text).toContain("issue a token");
    expect(section.text).not.toContain("Token expires");
    expect(section.text).not.toContain("Refresh token");
  });

  it("deduplicates repeated requirement IDs (first wins)", () => {
    const spec = [
      "### REQ-CORE-001: First",
      "First body.",
      "### REQ-CORE-001: Duplicate",
      "Duplicate body.",
    ].join("\n");

    const sections = extractRequirementSections(spec);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("First");
  });

  it("stops the body at the next non-requirement heading", () => {
    const spec = [
      "### REQ-CORE-001: Login",
      "Login body.",
      "## Non-Functional",
      "Latency under 200ms.",
    ].join("\n");

    const [section] = extractRequirementSections(spec);
    expect(section.text).toContain("Login body");
    expect(section.text).not.toContain("Latency");
  });

  it("returns an empty list when there are no requirement sections", () => {
    expect(extractRequirementSections("# Just a title\nSome prose.")).toEqual([]);
  });
});
