/**
 * TemplateEngine — Template loading, variable replacement, YAML frontmatter.
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { TemplateName } from "../constants.js";
import { TEMPLATE_NAMES } from "../constants.js";
import type { TemplateContext } from "../types.js";
import type { FileManager } from "./file-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "..", "..", "templates");

export class TemplateEngine {
  constructor(private fileManager: FileManager) {}

  /**
   * Load and render a template with variable replacement.
   */
  async render(
    templateName: TemplateName,
    context: Record<string, string | string[]>
  ): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return this.replaceVariables(template, context);
  }

  /**
   * Render a template with YAML frontmatter prepended.
   */
  async renderWithFrontmatter(
    templateName: TemplateName,
    context: TemplateContext
  ): Promise<string> {
    const frontmatter = this.generateFrontmatter(context);
    const body = await this.render(templateName, context as Record<string, string | string[]>);
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
   * Unknown variables become [TODO: variable].
   * Supports {{#each items}}...{{/each}} for arrays.
   */
  replaceVariables(
    template: string,
    context: Record<string, string | string[]>
  ): string {
    let result = template;

    // Handle {{#each key}}...{{/each}} blocks
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_match, key: string, body: string) => {
      const value = context[key];
      if (Array.isArray(value)) {
        return value.map((item) => body.replace(/\{\{this\}\}/g, item)).join("");
      }
      return `[TODO: ${key}]`;
    });

    // Handle {{variable}} replacements
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = context[key];
      if (value === undefined) {
        return `[TODO: ${key}]`;
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return value;
    });

    return result;
  }

  /**
   * Generate YAML frontmatter block.
   */
  generateFrontmatter(context: TemplateContext): string {
    const lines: string[] = ["---"];
    const fields: Array<[string, string | string[] | undefined]> = [
      ["title", context.title],
      ["feature_id", context.feature_id],
      ["version", context.version || "1.0.0"],
      ["date", context.date || new Date().toISOString().split("T")[0]],
      ["author", context.author || "SDD Pipeline"],
      ["status", context.status || "Draft"],
    ];

    for (const [key, value] of fields) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          lines.push(`${key}: [${value.map((v) => `"${v}"`).join(", ")}]`);
        } else {
          lines.push(`${key}: "${value}"`);
        }
      }
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Load raw template from templates/ directory.
   */
  private async loadTemplate(name: TemplateName): Promise<string> {
    if (!TEMPLATE_NAMES.includes(name)) {
      throw new Error(`Unknown template: "${name}". Available: ${TEMPLATE_NAMES.join(", ")}`);
    }
    // Map template name to file: sync_report -> sync-report.md
    const fileName = name.replace(/_/g, "-") + ".md";
    const templatePath = join(TEMPLATES_DIR, fileName);
    try {
      return await readFile(templatePath, "utf-8");
    } catch {
      throw new Error(`Template file not found: ${fileName}. Ensure templates/ directory exists.`);
    }
  }
}
