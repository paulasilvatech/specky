/**
 * harness/compilers/opencode.ts — renders canonical primitives into OpenCode
 * native form: `.opencode/agents/*.md` and `.opencode/commands/*.md`.
 */

import type { HarnessCompiler } from "../types.js";
import { transformAgentTools } from "./common.js";

export const opencodeCompiler: HarnessCompiler = {
    target: "opencode",

    compileAgent(content, opts) {
        return transformAgentTools(content, "opencode", "comma-list", opts);
    },

    compilePrompt(content) {
        return content
            .replace(/^agent:\s*agent\s*\n/m, "")
            .replace(/^mode:\s*agent\s*\n/m, "");
    },

    compileInstruction(content) {
        return content;
    },

    renameAgent(fileName) {
        return fileName.replace(/\.agent\.md$/, ".md");
    },

    renamePrompt(fileName) {
        return fileName.replace(/\.prompt\.md$/, ".md");
    },
};