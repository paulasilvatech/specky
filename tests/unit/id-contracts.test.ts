import { describe, expect, it } from "vitest";
import { extractRequirementIds, extractTaskIds, formatTaskId, normalizeTaskId, TASK_LINE_PATTERN } from "../../src/utils/id-contracts.js";

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
