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
import { SPECKY_REQUIRED_ALLOWS } from "../../src/cli/lib/settings-merger.js";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (p: string): string => readFileSync(resolve(ROOT, p), "utf8");

function listMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (currentDir: string, relFromDocs: string): void => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const rel = relFromDocs ? `${relFromDocs}/${entry.name}` : entry.name;
      const absolute = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, rel);
      } else if (entry.name.endsWith(".md")) {
        files.push(`${dir}/${rel}`);
      }
    }
  };
  walk(resolve(ROOT, dir), "");
  return files;
}
const countFiles = (dir: string, suffix: string): number =>
  readdirSync(resolve(ROOT, dir)).filter((name) => name.endsWith(suffix)).length;
const countDirs = (dir: string): number =>
  readdirSync(resolve(ROOT, dir), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;

const PUBLIC_COUNTS = {
  agents: countFiles(".apm/agents", ".agent.md"),
  tools: TOTAL_TOOLS,
  prompts: countFiles(".apm/prompts", ".prompt.md"),
  skills: countDirs(".apm/skills"),
  hooks: countFiles(".apm/hooks/scripts", ".sh"),
};

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
    ...listMarkdownFiles("docs"),
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
    const summary = `${PUBLIC_COUNTS.agents} agents, ${PUBLIC_COUNTS.tools} MCP tools, ${PUBLIC_COUNTS.prompts} prompts, ${PUBLIC_COUNTS.skills} skills, ${PUBLIC_COUNTS.hooks} hooks`;

    expect(site).toContain(summary);
    expect(site).not.toContain("8 skills");
    expect(site).toContain(`Open Source · MIT License · v${majorMinor}`);
    expect(site).toMatch(new RegExp(`toolkit-stat-num">${PUBLIC_COUNTS.skills}<\\/div>\\s*<div class="toolkit-stat-label">Skills`));
    expect(socialImage).toContain(`MIT License · v${majorMinor}`);
    expect(socialImage).toContain(summary);
    expect(socialImage).toContain("npm install -g specky-sdd@latest");
    expect(socialImage).not.toContain("57 MCP tools");
    expect(socialImage).not.toContain("14 hooks");
  });

  it("uses canonical target, agent, and prompt names on the website", () => {
    const site = read("site/index.html");
    const packageJson = JSON.parse(read("package.json")) as { version: string };

    for (const target of ["copilot", "claude", "cursor", "opencode"]) {
      expect(site).toContain(`specky install --target=${target}`);
    }
    expect(site).toContain("@specky-sdd-init");
    expect(site).toContain("/specky-specify");
    expect(site).toContain("/specky-design");
    expect(site).toContain("/specky-verify");
    expect(site).toContain(`specky-sdd-${packageJson.version}.tgz`);
    expect(site).toContain(`ghcr.io/paulasilvatech/specky:${packageJson.version}`);
    expect(site).toContain("SBOM + Optional Cosign Signing");

    expect(site).not.toContain("--ide=");
    expect(site).not.toContain("@sdd-");
    expect(site).not.toContain("@implementer");
    expect(site).not.toContain("/sdd:");
    expect(site).not.toContain("Cursor / Windsurf");
    expect(site).not.toContain("Every published image ships a CycloneDX SBOM and a cosign signature");
  });

  it("keeps the getting-started install inventory aligned with source", () => {
    const guide = read("docs/GETTING-STARTED.md");
    expect(guide).toContain(`.github/skills/*/SKILL.md\` (${PUBLIC_COUNTS.skills})`);
    expect(guide).toContain(`.claude/skills/*/SKILL.md\` (${PUBLIC_COUNTS.skills})`);
    expect(guide).toContain(`Hooks + ${SPECKY_REQUIRED_ALLOWS.length} permission rules`);
  });

  it("documents image signing as optional when Cosign secrets are configured", () => {
    const publishGuide = read("docs/PUBLISH.md");
    const enterpriseGuide = read("docs/ENTERPRISE-DEPLOYMENT.md");
    const readme = read("README.md");

    expect(publishGuide).toMatch(/Cosign signatures are added only when the\s+signing secrets are configured/);
    expect(enterpriseGuide).toMatch(/optional Cosign signatures when signing secrets are configured/);
    expect(readme).toContain("CycloneDX SBOM artifact + optional Cosign signing");
    expect(publishGuide).not.toContain("(cosign-signed + CycloneDX SBOM)");
  });
});
