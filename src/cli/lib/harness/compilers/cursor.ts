/**
 * harness/compilers/cursor.ts — renders canonical primitives into Cursor native
 * form: `.cursor/agents/*.md`, `.cursor/commands/*.md`, comma-list `tools:`
 * compatible with Cursor's Claude-like command/agent surface, and `.mdc` rules.
 */

import type { HarnessCompiler } from "../types.js";
import { stripYamlFrontmatter, transformAgentTools } from "./common.js";

export const cursorCompiler: HarnessCompiler = {
  target: "cursor",

  compileAgent(content, opts) {
    return transformAgentTools(content, "cursor", "comma-list", opts);
  },

  compilePrompt(content) {
    return content.replace(/^agent:\s*agent\s*\n/m, "").replace(/^mode:\s*agent\s*\n/m, "");
  },

  compileInstruction(content) {
    const body = stripYamlFrontmatter(content);
    return `---\ndescription: Specky SDD pipeline rules\nalwaysApply: true\n---\n${body}`;
  },

  renameAgent(fileName) {
    return fileName.replace(/\.agent\.md$/, ".md");
  },

  renamePrompt(fileName) {
    return fileName.replace(/\.prompt\.md$/, ".md");
  },
};
