/**
 * harness/compilers/claude.ts — renders canonical primitives into Claude Code
 * native form: `.claude/agents/*.md`, `.claude/commands/*.md`, comma-list
 * `tools:` with `Read`/`Glob`/`Grep`/`Task` and `mcp__specky__sdd_*` MCP
 * tools, commands without Copilot-only `agent:` frontmatter, and rules that
 * use `paths:` instead of Copilot's `applyTo:`.
 */

import type { HarnessCompiler } from "../types.js";
import { transformAgentTools, normalizeNewlines } from "./common.js";

export const claudeCompiler: HarnessCompiler = {
    target: "claude",

    compileAgent(content, opts) {
        return transformAgentTools(content, "claude", "comma-list", opts);
    },

    compilePrompt(content) {
        return content
            .replace(/^agent:\s*agent\s*\n/m, "")
            .replace(/^mode:\s*agent\s*\n/m, "");
    },

    compileInstruction(content) {
        return normalizeNewlines(content).replace(
            /^applyTo:\s*['"]?\*\*['"]?\s*$/m,
            "paths: ['**']",
        );
    },

    renameAgent(fileName) {
        return fileName.replace(/\.agent\.md$/, ".md");
    },

    renamePrompt(fileName) {
        return fileName.replace(/\.prompt\.md$/, ".md");
    },
};
