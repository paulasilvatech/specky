import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetricsGenerator } from "../../src/services/metrics-generator.js";
import type { FileManager } from "../../src/services/file-manager.js";

function makeFileManager(files: Record<string, string>): FileManager {
  return {
    readSpecFile: vi.fn(async (dirOrPath: string, fileName?: string) => {
      const key = fileName ?? dirOrPath;
      const hit = Object.entries(files).find(([k]) => key.endsWith(k));
      if (hit) return hit[1];
      throw new Error(`File not found: ${key}`);
    }),
    writeSpecFile: vi.fn(async () => "/feature/metrics-dashboard.html"),
    listFeatures: vi.fn(async () => []),
  } as unknown as FileManager;
}

describe("MetricsGenerator", () => {
  const featureDir = "/workspace/.specs/001-feature";
  const featureNumber = "001";

  describe("generateMetrics()", () => {
    it("returns a MetricsResult with html_path and html_content", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "# Spec\n## REQ-001\nWHEN user logs in THE SYSTEM SHALL grant access.",
        "ANALYSIS.md": "Compliance 85% controls passed.",
        "VERIFICATION.md": "Pass Rate: 90%\nTotal tasks: 10\nVerified: 9",
        "CHECKLIST.md": "- [x] item1\n- [x] item2\n- [ ] item3",
        ".sdd-state.json": JSON.stringify({
          phases: {
            specify: { status: "completed", started_at: "2026-01-01T10:00:00Z", completed_at: "2026-01-01T10:30:00Z" },
          },
        }),
      });

      const gen = new MetricsGenerator(fm);
      const result = await gen.generateMetrics(featureDir, featureNumber);

      expect(result.feature_number).toBe(featureNumber);
      expect(result.feature_dir).toBe(featureDir);
      expect(result.html_path).toBe(`${featureDir}/metrics-dashboard.html`);
      expect(result.html_content).toContain("<!DOCTYPE html>");
      expect(result.html_content).toContain("Specky Metrics Dashboard");
    });

    it("writes the HTML file via fileManager", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "",
        "ANALYSIS.md": "",
        "VERIFICATION.md": "",
        "CHECKLIST.md": "",
        ".sdd-state.json": "{}",
      });

      const gen = new MetricsGenerator(fm);
      await gen.generateMetrics(featureDir, featureNumber);

      expect(fm.writeSpecFile).toHaveBeenCalledWith(
        featureDir,
        "metrics-dashboard.html",
        expect.stringContaining("<!DOCTYPE html>"),
        true,
      );
    });

    it("handles missing files gracefully (returns zeros)", async () => {
      const fm = makeFileManager({});
      const gen = new MetricsGenerator(fm);
      const result = await gen.generateMetrics(featureDir, featureNumber);

      expect(result.requirements_count).toBe(0);
      expect(result.acceptance_criteria_count).toBe(0);
      expect(result.tasks_total).toBe(0);
      expect(result.tasks_verified).toBe(0);
      expect(result.phases).toEqual([]);
    });
  });

  describe("requirements counting", () => {
    it("counts REQ-NNN headings in SPECIFICATION.md", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "## REQ-001\nfoo\n## REQ-002\nbar\n| REQ-003 | baz |",
        "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.requirements_count).toBe(3);
    });

    it("counts acceptance criteria lines", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "- AC: user can login\n- Given user exists\n- When user submits\n- Then access granted",
        "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.acceptance_criteria_count).toBeGreaterThanOrEqual(3);
    });
  });

  describe("compliance score extraction", () => {
    it("extracts percentage from 'compliance X%'", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "compliance 92%", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.compliance_score).toBe(92);
    });

    it("extracts from 'X/Y controls pass' pattern", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "8/10 controls pass", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.compliance_score).toBe(80);
    });
  });

  describe("phase metrics extraction", () => {
    it("calculates duration_minutes from started_at / completed_at", async () => {
      const state = {
        phases: {
          specify: {
            status: "completed",
            started_at: "2026-01-01T10:00:00Z",
            completed_at: "2026-01-01T10:45:00Z",
          },
        },
      };
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "",
        ".sdd-state.json": JSON.stringify(state),
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0]?.duration_minutes).toBe(45);
      expect(result.phases[0]?.status).toBe("completed");
    });

    it("returns undefined duration when timestamps are missing", async () => {
      const state = { phases: { design: { status: "pending" } } };
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "",
        ".sdd-state.json": JSON.stringify(state),
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.phases[0]?.duration_minutes).toBeUndefined();
    });
  });

  describe("HTML output", () => {
    it("includes feature number in the title", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, "042");
      expect(result.html_content).toContain("042");
    });

    it("shows 'No phase data available' when state has no phases", async () => {
      const fm = makeFileManager({
        "SPECIFICATION.md": "", "ANALYSIS.md": "", "VERIFICATION.md": "", "CHECKLIST.md": "", ".sdd-state.json": "{}",
      });
      const result = await new MetricsGenerator(fm).generateMetrics(featureDir, featureNumber);
      expect(result.html_content).toContain("No phase data available");
    });
  });
});
