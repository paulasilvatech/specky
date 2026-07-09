/**
 * doc-consistency.test.ts — guards the public-facing counts and paths that
 * drifted from reality (audit Batch 2), so they cannot silently drift again:
 *   - config.yml enumerates exactly the 16 real hook scripts (was 12, and
 *     pointed at a non-existent .github/plugin/ path)
 *   - config.yml phase_names match the canonical Phase order
 *   - the README "All N Tools" heading matches TOTAL_TOOLS
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { PHASE_ORDER, TOTAL_TOOLS, TEMPLATE_NAMES } from "../../src/constants.js";

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

describe("every TEMPLATE_NAMES entry maps to a real templates/ file", () => {
  it("has no dangling template name (regression: onboarding had no file)", () => {
    const files = new Set(readdirSync(resolve(ROOT, "templates")).filter((n) => n.endsWith(".md")));
    for (const name of TEMPLATE_NAMES) {
      const fileName = `${name.replace(/_/g, "-")}.md`;
      expect(files.has(fileName), `template "${name}" -> ${fileName} must exist`).toBe(true);
    }
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

describe("public documentation links and website assets", () => {
  const publicDocs = [
    "README.md",
    "GETTING-STARTED.md",
    "CONTRIBUTING.md",
    ...readdirSync(resolve(ROOT, "docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `docs/${name}`),
  ];

  it("has no missing relative Markdown file links", () => {
    const missing: string[] = [];
    for (const relativePath of publicDocs) {
      const absolutePath = resolve(ROOT, relativePath);
      const content = readFileSync(absolutePath, "utf8");
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
        const raw = match[1];
        if (/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(raw)) continue;
        if (raw === "url" || raw.includes("<") || raw.includes("${")) continue;
        const clean = decodeURIComponent(raw.split("#")[0].split("?")[0]);
        if (!clean) continue;
        if (!existsSync(resolve(dirname(absolutePath), clean))) {
          missing.push(`${relativePath} -> ${raw}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps local website assets resolvable", () => {
    const siteRoot = resolve(ROOT, "site");
    const html = read("site/index.html");
    const missing = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((ref) => !/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(ref))
      .filter((ref) => !ref.includes("${"))
      .filter((ref) => !existsSync(resolve(siteRoot, ref.split("?")[0])))
      .sort();
    expect(missing).toEqual([]);
  });

  it("keeps website and social-image counts aligned with the package", () => {
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const majorMinor = packageJson.version.split(".").slice(0, 2).join(".");
    const site = read("site/index.html");
    const socialImage = read("site/og-image.svg");

    expect(site).toContain("13 agents, 58 MCP tools, 22 prompts, 14 skills, 16 hooks");
    expect(site).not.toContain("8 skills");
    expect(site).toContain(`Open Source · MIT License · v${majorMinor}`);
    expect(site).toMatch(/toolkit-stat-num">14<\/div>\s*<div class="toolkit-stat-label">Skills/);
    expect(socialImage).toContain(`MIT License · v${majorMinor}`);
    expect(socialImage).toContain("13 agents, 58 MCP tools, 22 prompts, 14 skills, 16 hooks");
    expect(socialImage).toContain("npm install -g specky-sdd@latest");
    expect(socialImage).not.toContain("57 MCP tools");
    expect(socialImage).not.toContain("14 hooks");
  });
});
