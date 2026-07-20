/**
 * harness/compilers/agent-skills.ts — neutral skills-only target. It preserves
 * primitive content and names because only `.apm/skills` is deployed.
 */

import type { HarnessCompiler } from "../types.js";

export const agentSkillsCompiler: HarnessCompiler = {
  target: "agent-skills",

  compileAgent(content) {
    return content;
  },

  compilePrompt(content) {
    return content;
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
