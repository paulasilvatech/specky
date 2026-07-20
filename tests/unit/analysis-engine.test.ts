/**
 * analysis-engine.test.ts — the shared quality-gate math. This is the logic
 * that sdd_auto_pipeline previously bypassed with a hard-coded APPROVE/100%.
 */
import { describe, expect, it } from "vitest";
import { AnalysisEngine } from "../../src/services/analysis-engine.js";
import { EarsValidator } from "../../src/services/ears-validator.js";

const engine = new AnalysisEngine(new EarsValidator());

const SPEC = [
  "## Requirements",
  "### REQ-CORE-001: (event_driven)",
  "When a user submits valid credentials, the system shall issue a JWT within 500ms.",
  "---",
  "### REQ-CORE-002: (ubiquitous)",
  "The system shall encrypt all tokens at rest.",
  "---",
].join("\n");

describe("AnalysisEngine.analyze", () => {
  it("APPROVEs when every requirement is mapped through design and tasks", () => {
    const design = "Design references REQ-CORE-001 and REQ-CORE-002.";
    const tasks = "T-001 traces REQ-CORE-001. T-002 traces REQ-CORE-002.";
    const r = engine.analyze({
      hasConstitution: true,
      hasSpec: true,
      hasDesign: true,
      hasTasks: true,
      specContent: SPEC,
      designContent: design,
      tasksContent: tasks,
    });
    expect(r.decision).toBe("APPROVE");
    expect(r.coveragePercent).toBeGreaterThanOrEqual(90);
    expect(r.gaps).toHaveLength(0);
    expect(r.orphanCount).toBe(0);
  });

  it("does NOT approve when tasks omit a requirement (no more fabricated 100%)", () => {
    const design = "Design references REQ-CORE-001 and REQ-CORE-002.";
    const tasks = "T-001 traces REQ-CORE-001."; // REQ-CORE-002 orphaned in tasks
    const r = engine.analyze({
      hasConstitution: true,
      hasSpec: true,
      hasDesign: true,
      hasTasks: true,
      specContent: SPEC,
      designContent: design,
      tasksContent: tasks,
    });
    expect(r.decision).not.toBe("APPROVE");
    expect(r.orphanCount).toBeGreaterThan(0);
    expect(r.gaps.some((g) => g.includes("Task mapping missing"))).toBe(true);
  });

  it("BLOCKs when core documents are missing", () => {
    const r = engine.analyze({
      hasConstitution: true,
      hasSpec: true,
      hasDesign: false,
      hasTasks: false,
      specContent: SPEC,
      designContent: "",
      tasksContent: "",
    });
    expect(r.decision).toBe("BLOCK");
    expect(r.gaps).toContain("DESIGN.md missing");
    expect(r.gaps).toContain("TASKS.md missing");
  });
});
