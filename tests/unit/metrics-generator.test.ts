/**
 * metrics-generator.test.ts — coverage for the requirement-count fix:
 * canonical requirement refs (REQ-<AREA>-<NNN>) in headings and table rows
 * must be counted; the old /REQ-\d+/ pattern missed them entirely and fell
 * back to the EARS heuristic. Also pins the tolerant-read behavior for
 * missing optional artifacts (ANALYSIS.md, VERIFICATION.md, CHECKLIST.md).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileManager } from "../../src/services/file-manager.js";
import { MetricsGenerator } from "../../src/services/metrics-generator.js";

const FEATURE_DIR = ".specs/001-todo-api";

const CANONICAL_SPEC = [
  "# Todo API — Specification",
  "",
  "## 1. Core Requirements",
  "",
  "### REQ-API-001: (event_driven)",
  "",
  "When a client sends POST /todos, the system shall create a todo item.",
  "",
  "### REQ-API-002: (ubiquitous)",
  "",
  "The system shall persist todo items across restarts.",
  "",
  "### REQ-SEC-001: (unwanted_behavior)",
  "",
  "If a request is unauthenticated, then the system shall reject it with 401.",
  "",
  "## Acceptance Criteria Summary",
  "",
  "| ID | Requirement |",
  "|----|-------------|",
  "| REQ-API-001 | create todo |",
  "| REQ-API-002 | persist todos |",
  "| REQ-SEC-001 | reject unauthenticated |",
].join("\n");

describe("MetricsGenerator", () => {
  let workspace: string;
  let metricsGenerator: MetricsGenerator;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-metrics-"));
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    metricsGenerator = new MetricsGenerator(new FileManager(workspace));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("counts canonical REQ-<AREA>-<NNN> refs in the summary table", async () => {
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), CANONICAL_SPEC, "utf8");
    const result = await metricsGenerator.generateMetrics(FEATURE_DIR, "001", true);
    // Canonical `### REQ-…` headings are outside the shared pattern's `##?`
    // heading branch, so each requirement is counted exactly once — via its
    // Acceptance Criteria Summary table row. The old /REQ-\d+/ pattern
    // matched nothing here and dropped to the EARS fallback (4).
    expect(result.requirements_count).toBe(3);
  });

  it("counts refs in #-level headings as well as table rows", async () => {
    const spec = [
      "## REQ-API-001: create",
      "The system shall create todos.",
      "",
      "| REQ-SEC-001 | reject unauthenticated |",
    ].join("\n");
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), spec, "utf8");
    const result = await metricsGenerator.generateMetrics(FEATURE_DIR, "001", true);
    expect(result.requirements_count).toBe(2);
  });

  it("no longer counts legacy REQ-<NNN> refs as requirement refs", async () => {
    const legacySpec = [
      "# Legacy Spec",
      "",
      "### REQ-001: first",
      "The system shall work.",
      "",
      "| REQ-002 | second |",
      "| REQ-003 | third |",
    ].join("\n");
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), legacySpec, "utf8");
    const result = await metricsGenerator.generateMetrics(FEATURE_DIR, "001", true);
    // Falls back to the EARS heuristic (1 SHALL keyword here), not the 3 refs.
    expect(result.requirements_count).toBe(1);
  });

  it("generates a dashboard when optional artifacts are missing", async () => {
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), CANONICAL_SPEC, "utf8");
    const result = await metricsGenerator.generateMetrics(FEATURE_DIR, "001", true);
    expect(result.compliance_score).toBe(0);
    expect(result.tasks_total).toBe(0);
    expect(result.test_coverage_percent).toBe(0);
    expect(result.phases).toEqual([]);
    expect(result.html_path).toBe(`${FEATURE_DIR}/metrics-dashboard.html`);
    expect(result.html_content).toContain("Specky Metrics Dashboard");
  });
});
