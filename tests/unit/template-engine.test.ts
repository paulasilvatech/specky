import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileManager } from "../../src/services/file-manager.js";
import { TemplateEngine, TemplateRenderError } from "../../src/services/template-engine.js";

const REPO = resolve(import.meta.dirname, "../..");

describe("TemplateEngine strict rendering", () => {
  let workspace: string;
  let engine: TemplateEngine;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-template-strict-"));
    cpSync(join(REPO, "templates"), join(workspace, "templates"), { recursive: true });
    engine = new TemplateEngine(new FileManager(workspace), "templates");
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("throws a named error for a missing scalar", () => {
    expect(() => engine.replaceVariables("Hello {{name}}", {}, "example")).toThrow(
      TemplateRenderError,
    );
    expect(() => engine.replaceVariables("Hello {{name}}", {}, "example")).toThrow(
      /requires name as string/,
    );
  });

  it("throws for a missing loop instead of emitting a TODO marker", () => {
    expect(() =>
      engine.replaceVariables("{{#each items}}- {{this}}\n{{/each}}", {}, "list"),
    ).toThrow(/requires items as array/);
  });

  it("renders string and structured loop rows without unresolved expressions", () => {
    expect(
      engine.replaceVariables(
        "{{#each items}}- {{this}}\n{{/each}}",
        { items: ["one", "two"] },
        "strings",
      ),
    ).toBe("- one\n- two\n");

    expect(
      engine.replaceVariables(
        "{{#each endpoints}}{{method}} {{path}}\n{{/each}}",
        { endpoints: [{ method: "GET", path: "/health" }] },
        "rows",
      ),
    ).toBe("GET /health\n");
  });

  it("rejects a structured row missing a named field", () => {
    expect(() =>
      engine.replaceVariables(
        "{{#each endpoints}}{{method}} {{path}}{{/each}}",
        { endpoints: [{ method: "GET" }] },
        "rows",
      ),
    ).toThrow(/endpoints\[0\]\.path/);
  });

  it("requires explicit frontmatter metadata", () => {
    expect(() =>
      engine.generateFrontmatter({
        title: "Spec",
        feature_id: "001-spec",
      } as never),
    ).toThrow(/frontmatter requires version as string/);
    const frontmatter = engine.generateFrontmatter({
      title: "Spec",
      feature_id: "001-spec",
      version: "2.0.0",
      date: "2026-07-15",
      author: "sdd_write_spec",
      status: "Draft",
    });
    expect(frontmatter).toContain('version: "2.0.0"');
    expect(frontmatter).toContain('author: "sdd_write_spec"');
    expect(frontmatter).toContain('status: "Draft"');
  });

  it("validates project-local custom templates with the same strict rules", async () => {
    mkdirSync(join(workspace, "custom"), { recursive: true });
    writeFileSync(
      join(workspace, "custom/constitution.md"),
      "# {{project_name}}\n{{required_custom_value}}\n",
    );
    const custom = new TemplateEngine(new FileManager(workspace), "custom");

    await expect(
      custom.render("constitution", {
        project_name: "Example",
      }),
    ).rejects.toThrow(/required_custom_value/);
  });
});
