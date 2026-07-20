/**
 * intent-drift-engine.test.ts — constitution principle extraction, keyword
 * coverage scoring, drift labels, and trend computation.
 */
import { describe, expect, it } from "vitest";
import type { ConstitutionalPrinciple } from "../../src/services/intent-drift-engine.js";
import { IntentDriftEngine } from "../../src/services/intent-drift-engine.js";
import type { DriftSnapshot } from "../../src/types.js";

const engine = new IntentDriftEngine();

function principle(id: string, keywords: string[]): ConstitutionalPrinciple {
  return { id, heading: id, keywords };
}

function snapshot(score: number): DriftSnapshot {
  return { timestamp: "2026-01-01T00:00:00.000Z", score, orphaned_count: 0 };
}

describe("IntentDriftEngine.extractPrinciples", () => {
  it("extracts H3 headings only under ## Article sections, numbered in order", () => {
    const constitution = [
      "# Project Constitution",
      "",
      "### Not A Principle",
      "",
      "## Article I — Quality",
      "",
      "### All Code Must Be Tested",
      "Body text.",
      "### Observability With Structured Logs",
      "",
      "## Article II — Delivery",
      "",
      "### Small Reviewable Changes",
      "",
      "## Governance",
      "### Ignored Heading",
    ].join("\n");

    const principles = engine.extractPrinciples(constitution);

    expect(principles.map((p) => p.id)).toEqual(["P-001", "P-002", "P-003"]);
    expect(principles.map((p) => p.heading)).toEqual([
      "All Code Must Be Tested",
      "Observability With Structured Logs",
      "Small Reviewable Changes",
    ]);
    expect(principles[0]?.keywords).toEqual(["code", "tested"]);
    expect(principles[1]?.keywords).toEqual(["observability", "structured", "logs"]);
    expect(principles[2]?.keywords).toEqual(["small", "reviewable", "changes"]);
  });

  it("matches article headings case-insensitively", () => {
    const principles = engine.extractPrinciples("## article 9\n### Versioned Releases");
    expect(principles).toHaveLength(1);
    expect(principles[0]?.heading).toBe("Versioned Releases");
  });

  it("strips digits and punctuation from keywords", () => {
    const principles = engine.extractPrinciples("## Article X\n### OAuth2 Tokens Expire");
    expect(principles[0]?.keywords).toEqual(["oauth", "tokens", "expire"]);
  });

  it("returns an empty list when there are no article sections", () => {
    expect(engine.extractPrinciples("# Title\n### Orphan Heading")).toEqual([]);
  });
});

describe("IntentDriftEngine.computeCoverage", () => {
  it("reports full coverage as aligned with a zero drift score", () => {
    const principles = [
      principle("P-001", ["testing", "coverage"]),
      principle("P-002", ["review", "approval"]),
    ];

    const report = engine.computeCoverage(
      principles,
      "Testing requirements and coverage goals. Review gates need approval.",
      "testing task with coverage; review task with approval",
    );

    expect(report).toEqual({
      total_principles: 2,
      covered_principles: 2,
      orphaned_principles: [],
      unimplemented_principles: [],
      intent_drift_score: 0,
      intent_drift_label: "aligned",
    });
  });

  it("flags principles missing from both spec and tasks as significant drift", () => {
    const principles = [principle("P-001", ["audit", "trail"])];

    const report = engine.computeCoverage(principles, "nothing relevant here", "nor here");

    expect(report.orphaned_principles).toEqual(principles);
    expect(report.unimplemented_principles).toEqual(principles);
    expect(report.covered_principles).toBe(0);
    // (1 orphaned + 1 unimplemented) / 1 principle = 200%, capped at 100
    expect(report.intent_drift_score).toBe(100);
    expect(report.intent_drift_label).toBe("significant_drift");
  });

  it("labels the 21-40 score band as minor drift", () => {
    const covered = ["alpha", "bravo", "charlie", "delta"].map((word, i) =>
      principle(`P-00${i + 1}`, [word, "shared"]),
    );
    const missing = principle("P-005", ["missing", "absent"]);
    const body = "shared alpha bravo charlie delta";

    const report = engine.computeCoverage([...covered, missing], body, body);

    expect(report.covered_principles).toBe(4);
    // (1 orphaned + 1 unimplemented) / 5 = 40
    expect(report.intent_drift_score).toBe(40);
    expect(report.intent_drift_label).toBe("minor_drift");
  });

  it("requires at least two keyword matches per document", () => {
    const principles = [principle("P-001", ["alpha", "beta", "gamma"])];

    const report = engine.computeCoverage(
      principles,
      "only alpha appears here",
      "alpha beta gamma all present",
    );

    expect(report.orphaned_principles).toEqual(principles);
    expect(report.unimplemented_principles).toEqual([]);
    expect(report.covered_principles).toBe(0);
    expect(report.intent_drift_score).toBe(100);
  });

  it("matches keywords case-insensitively against document content", () => {
    const principles = [principle("P-001", ["audit", "trail"])];

    const report = engine.computeCoverage(
      principles,
      "AUDIT and TRAIL recorded",
      "Audit trail kept",
    );

    expect(report.orphaned_principles).toEqual([]);
    expect(report.unimplemented_principles).toEqual([]);
  });

  it("handles an empty principle list without dividing by zero", () => {
    const report = engine.computeCoverage([], "spec", "tasks");

    expect(report).toEqual({
      total_principles: 0,
      covered_principles: 0,
      orphaned_principles: [],
      unimplemented_principles: [],
      intent_drift_score: 0,
      intent_drift_label: "aligned",
    });
  });

  it("scores a real constitution extracted from CONSTITUTION.md content", () => {
    const constitution = [
      "## Article I — Quality",
      "### Testing Coverage Required",
      "### Review Approval Gates",
    ].join("\n");
    const principles = engine.extractPrinciples(constitution);

    const report = engine.computeCoverage(
      principles,
      "testing and coverage requirements",
      "review with approval",
    );

    expect(report.total_principles).toBe(2);
    // P-001 covered in spec only, P-002 covered in tasks only
    expect(report.orphaned_principles.map((p) => p.id)).toEqual(["P-002"]);
    expect(report.unimplemented_principles.map((p) => p.id)).toEqual(["P-001"]);
    // (1 + 1) / 2 = 100
    expect(report.intent_drift_score).toBe(100);
  });
});

describe("IntentDriftEngine.computeScore", () => {
  it("returns 0 when there are no principles", () => {
    expect(engine.computeScore({ orphaned_count: 0, total_principles: 0 })).toBe(0);
  });

  it("rounds the percentage", () => {
    expect(engine.computeScore({ orphaned_count: 1, total_principles: 3 })).toBe(33);
  });

  it("caps the score at 100", () => {
    expect(engine.computeScore({ orphaned_count: 5, total_principles: 2 })).toBe(100);
  });
});

describe("IntentDriftEngine.computeTrend", () => {
  it("is stable with fewer than three snapshots", () => {
    expect(engine.computeTrend([])).toBe("stable");
    expect(engine.computeTrend([snapshot(1), snapshot(2)])).toBe("stable");
  });

  it("detects strictly improving and worsening sequences", () => {
    expect(engine.computeTrend([snapshot(30), snapshot(20), snapshot(10)])).toBe("improving");
    expect(engine.computeTrend([snapshot(10), snapshot(20), snapshot(30)])).toBe("worsening");
  });

  it("is stable for non-monotone or flat sequences", () => {
    expect(engine.computeTrend([snapshot(10), snapshot(30), snapshot(20)])).toBe("stable");
    expect(engine.computeTrend([snapshot(20), snapshot(20), snapshot(20)])).toBe("stable");
  });

  it("only considers the last three snapshots", () => {
    const history = [snapshot(99), snapshot(99), snapshot(30), snapshot(20), snapshot(10)];
    expect(engine.computeTrend(history)).toBe("improving");
  });
});
