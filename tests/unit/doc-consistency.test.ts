/**
 * doc-consistency.test.ts — guards the public-facing counts and paths that
 * drifted from reality (audit Batch 2), so they cannot silently drift again:
 *   - config.yml enumerates exactly the 16 real hook scripts (was 12, and
 *     pointed at a non-existent .github/plugin/ path)
 *   - config.yml phase_names match the canonical Phase order
 *   - the README "All N Tools" heading matches TOTAL_TOOLS
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { PHASE_ORDER, TOTAL_TOOLS } from "../../src/constants.js";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (p: string): string => readFileSync(resolve(ROOT, p), "utf8");

describe("config.yml is consistent with the shipped assets", () => {
  const config = parse(read("config.yml")) as {
    hooks: { shared_path: string; blocking: string[]; advisory: string[] };
    skills_dir: string;
    pipeline: { phase_names: Record<string, string> };
  };

  it("enumerates exactly the hook scripts that exist on disk", () => {
    const scripts = readdirSync(resolve(ROOT, ".apm/hooks/scripts"))
      .filter((n) => n.endsWith(".sh"))
      .map((n) => n.replace(/\.sh$/, ""))
      .sort();
    const declared = [...config.hooks.blocking, ...config.hooks.advisory].sort();
    expect(declared).toEqual(scripts);
    expect(declared).toHaveLength(16);
  });

  it("points shared_path and skills_dir at paths that exist", () => {
    expect(config.hooks.shared_path).toBe(".apm/hooks/scripts");
    expect(config.skills_dir).toBe(".apm/skills");
    expect(config.hooks.shared_path).not.toContain(".github/plugin");
    expect(config.skills_dir).not.toContain(".github/plugin");
  });

  it("phase_names match the canonical phase order", () => {
    const names = Object.keys(config.pipeline.phase_names)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => config.pipeline.phase_names[String(i)]);
    expect(names).toEqual([...PHASE_ORDER]);
  });
});

describe("README public counts match the source of truth", () => {
  it("the tools heading matches TOTAL_TOOLS", () => {
    expect(read("README.md")).toContain(`## All ${TOTAL_TOOLS} Tools`);
  });

  it("does not advertise phases that do not exist in the pipeline", () => {
    const readme = read("README.md");
    // The canonical pipeline has no "Research" or "Review" phase.
    expect(readme).not.toContain("Init → Research → Specify");
    expect(readme).not.toContain("Verify → Review → Release");
  });
});
