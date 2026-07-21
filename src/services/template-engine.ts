/**
 * TemplateEngine — Template loading, variable replacement, YAML frontmatter.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TemplateName } from "../constants.js";
import { TEMPLATE_NAMES } from "../constants.js";
import type { TemplateContext, TemplateRow, TemplateValue } from "../types.js";
import type { FileManager } from "./file-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "..", "templates");

export class TemplateEngine {
  /** Optional path to project-local templates directory (from .specky/config.yml) */
  private customTemplatesDir: string;

  constructor(_fileManager: FileManager, customTemplatesPath?: string) {
    this.customTemplatesDir = customTemplatesPath
      ? join(_fileManager.workspaceRoot, customTemplatesPath)
      : "";
  }

  /**
   * Load and render a template with variable replacement.
   */
  async render(
    templateName: TemplateName,
    context: Record<string, TemplateValue>,
  ): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return this.replaceVariables(template, context, templateName);
  }

  /**
   * Render a template with YAML frontmatter prepended.
   */
  async renderWithFrontmatter(
    templateName: TemplateName,
    context: TemplateContext,
  ): Promise<string> {
    const frontmatter = this.generateFrontmatter(context);
    const body = await this.render(templateName, context);
    return `${frontmatter}\n${body}`;
  }

  /**
   * Get raw template content without any processing.
   */
  async getTemplate(templateName: TemplateName): Promise<string> {
    return this.loadTemplate(templateName);
  }

  /**
   * Replace {{variable}} placeholders with context values.
   * Every referenced variable must be present with the expected shape.
   * Supports string arrays via {{this}} and object arrays via named fields.
   */
  replaceVariables(
    template: string,
    context: Record<string, TemplateValue>,
    templateName: string = "inline",
  ): string {
    let result = template;

    // Handle {{#each key}}...{{/each}} blocks
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_match, key: string, body: string) => {
      const value = context[key];
      if (!Array.isArray(value)) {
        throw new TemplateRenderError(templateName, key, "array");
      }
      return value
        .map((item, index) => this.renderLoopItem(body, item, templateName, `${key}[${index}]`))
        .join("");
    });

    // Handle {{variable}} replacements
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = context[key];
      if (value === undefined) {
        throw new TemplateRenderError(templateName, key, "string");
      }
      if (Array.isArray(value)) {
        throw new TemplateRenderError(templateName, key, "string", "array");
      }
      return value;
    });

    const unresolvedStart = result.indexOf("{{");
    const unresolvedEnd = unresolvedStart === -1 ? -1 : result.indexOf("}}", unresolvedStart + 2);
    if (unresolvedStart !== -1 && unresolvedEnd !== -1) {
      const unresolved = result.slice(unresolvedStart, unresolvedEnd + 2);
      throw new Error(`Template ${templateName} contains unresolved expression ${unresolved}.`);
    }

    return result;
  }

  private renderLoopItem(
    body: string,
    item: string | TemplateRow,
    templateName: string,
    itemPath: string,
  ): string {
    if (typeof item === "string") {
      const rendered = body.replaceAll("{{this}}", item);
      const named = /\{\{(\w+)\}\}/.exec(rendered)?.[1];
      if (named) throw new TemplateRenderError(templateName, `${itemPath}.${named}`, "string");
      return rendered;
    }

    return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = item[key];
      if (value === undefined) {
        throw new TemplateRenderError(templateName, `${itemPath}.${key}`, "string");
      }
      return value;
    });
  }

  /**
   * Generate YAML frontmatter block.
   */
  generateFrontmatter(context: TemplateContext): string {
    const lines: string[] = ["---"];
    const fields: Array<[string, string]> = [
      ["title", context.title],
      ["feature_id", context.feature_id],
      ["version", context.version],
      ["date", context.date],
      ["author", context.author],
      ["status", context.status],
    ];

    for (const [key, value] of fields) {
      if (typeof value !== "string" || value.trim() === "") {
        throw new TemplateRenderError("frontmatter", key, "string");
      }
      lines.push(`${key}: "${value}"`);
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Load raw template — checks .specky/templates/ first, then built-in templates/.
   * This implements T-066: customizable templates via project-local directory.
   */
  private async loadTemplate(name: TemplateName): Promise<string> {
    if (!TEMPLATE_NAMES.includes(name)) {
      throw new Error(`Unknown template: "${name}". Available: ${TEMPLATE_NAMES.join(", ")}`);
    }
    // Map template name to file: sync_report -> sync-report.md
    const fileName = name.replace(/_/g, "-") + ".md";

    // Try custom templates directory first (T-066)
    if (this.customTemplatesDir) {
      try {
        return await readFile(join(this.customTemplatesDir, fileName), "utf-8");
      } catch {
        // Custom template not found — fall through to built-in
      }
    }

    // Fall back to built-in templates
    try {
      return await readFile(join(TEMPLATES_DIR, fileName), "utf-8");
    } catch {
      throw new Error(`Template file not found: ${fileName}. Ensure templates/ directory exists.`);
    }
  }
}

export class TemplateRenderError extends Error {
  constructor(
    readonly templateName: string,
    readonly variable: string,
    expected: "string" | "array",
    actual: "array" | "missing" = "missing",
  ) {
    super(`Template ${templateName} requires ${variable} as ${expected}; received ${actual}.`);
    this.name = "TemplateRenderError";
  }
}
