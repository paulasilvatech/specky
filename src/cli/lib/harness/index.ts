/**
 * harness/index.ts — the harness compiler registry.
 *
 * `getCompiler(target)` returns the compiler that renders Specky's canonical
 * `.apm` primitives into a harness's native form. Register new harnesses here.
 */

import { agentSkillsCompiler } from "./compilers/agent-skills.js";
import { claudeCompiler } from "./compilers/claude.js";
import { copilotCompiler } from "./compilers/copilot.js";
import { cursorCompiler } from "./compilers/cursor.js";
import { opencodeCompiler } from "./compilers/opencode.js";
import type { HarnessCompiler, HarnessTarget } from "./types.js";

const COMPILERS: Record<HarnessTarget, HarnessCompiler> = {
  copilot: copilotCompiler,
  claude: claudeCompiler,
  cursor: cursorCompiler,
  opencode: opencodeCompiler,
  "agent-skills": agentSkillsCompiler,
};

export function getCompiler(target: HarnessTarget): HarnessCompiler {
  return COMPILERS[target];
}

export const SUPPORTED_TARGETS = Object.keys(COMPILERS) as HarnessTarget[];

export { logicalToNative, mapTool, normalizeToLogical } from "./tool-map.js";
export type { HarnessCompiler, HarnessTarget } from "./types.js";
