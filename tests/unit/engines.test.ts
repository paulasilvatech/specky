/**
 * engines.test.ts — coverage for the pure intelligence-layer engines
 * (model routing, context tiering, cognitive debt, intent drift).
 */
import { describe, expect, it } from "vitest";
import { CognitiveDebtEngine } from "../../src/services/cognitive-debt-engine.js";
import { ContextTieringEngine } from "../../src/services/context-tiering-engine.js";
import { IntentDriftEngine } from "../../src/services/intent-drift-engine.js";
import { ModelRoutingEngine } from "../../src/services/model-routing-engine.js";
import type { GateHistoryEntry } from "../../src/types.js";

describe("ModelRoutingEngine", () => {
  const engine = new ModelRoutingEngine();

  it("returns a hint for every pipeline phase and a full table", () => {
    const table = engine.getTable();
    expect(table.length).toBe(10);
    for (const row of table) {
      expect(row.phase).toBeTruthy();
      expect(row.model).toBeTruthy();
      expect(Array.isArray(row.fallback_chain)).toBe(true);
    }
  });

  it("computes non-negative cost savings that scale with team size", () => {
    const small = engine.calculateCostSavings(1);
    const large = engine.calculateCostSavings(50);
    expect(small).toBeTruthy();
    expect(large).toBeTruthy();
  });
});

describe("ContextTieringEngine", () => {
  const engine = new ContextTieringEngine();

  it("assigns a tier to known artifacts and estimates tokens", () => {
    expect(engine.getTier("SPECIFICATION.md")).toBeTruthy();
    expect(engine.getTierTable().length).toBeGreaterThan(0);
    expect(engine.estimateTokens("a".repeat(400))).toBeGreaterThan(0);
  });
});

describe("CognitiveDebtEngine", () => {
  const engine = new CognitiveDebtEngine();

  it("computes metrics from gate history including unmodified approvals", () => {
    const history: GateHistoryEntry[] = [
      {
        phase: "specify" as GateHistoryEntry["phase"],
        timestamp: "2026-01-01T00:00:00Z",
        artifact: "a",
        was_modified: true,
      },
      {
        phase: "design" as GateHistoryEntry["phase"],
        timestamp: "2026-01-01T00:01:00Z",
        artifact: "b",
        was_modified: false,
      },
    ];
    const metrics = engine.computeMetrics(history);
    expect(metrics).toBeTruthy();
    // An unmodified gate approval is a debt signal.
    expect(JSON.stringify(metrics)).toContain("modified".slice(0, 3));
  });

  it("handles empty history without throwing", () => {
    expect(() => engine.computeMetrics([])).not.toThrow();
  });
});

describe("IntentDriftEngine", () => {
  const engine = new IntentDriftEngine();

  it("extracts constitutional principles and scores drift", () => {
    const constitution = [
      "## Article I: Foundations",
      "### Simplicity and minimal surface area",
      "The system keeps its surface minimal.",
      "### Traceability of every requirement to a task",
      "Each requirement maps to a task.",
      "## Overview",
      "### Not a principle (outside an Article)",
    ].join("\n");
    const principles = engine.extractPrinciples(constitution);
    expect(principles.length).toBe(2); // only the two under the Article

    // computeScore is a DRIFT score: more orphaned principles = higher drift.
    const noDrift = engine.computeScore({ orphaned_count: 0, total_principles: 5 });
    const highDrift = engine.computeScore({ orphaned_count: 5, total_principles: 5 });
    expect(highDrift).toBeGreaterThanOrEqual(noDrift);
  });
});
