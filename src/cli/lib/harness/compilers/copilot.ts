/**
 * harness/compilers/copilot.ts — renders canonical primitives into GitHub
 * Copilot (VS Code) native form: `.github/agents/*.agent.md`,
 * `.github/prompts/*.prompt.md`, JSON-array `tools:` with `search`/`agent`/
 * `edit`/`fetch` and namespaced `specky/sdd_*` MCP tools, and `agent: agent`
 * prompt frontmatter.
 */

import type { HarnessCompiler } from "../types.js";
import { transformAgentTools } from "./common.js";

export const copilotCompiler: HarnessCompiler = {
    target: "copilot",

    compileAgent(content, opts) {
        return transformAgentTools(content, "copilot", "json-array", opts);
    },

    compilePrompt(content) {
        // `.apm` prompts already use `agent: agent`; keep them and drop any stray
        // legacy `mode: agent` line. If only a legacy line exists, upgrade it.
        if (/^agent:/m.test(content)) {
            return content.replace(/^mode:\s*agent\s*$/m, "");
        }
        return content.replace(/^mode:\s*agent\s*$/m, "agent: agent");
    },

    compileInstruction(content) {
        return content;
    },

    renameAgent(fileName) {
        return fileName;
    },

    renamePrompt(fileName) {
        return fileName;
    },
};
