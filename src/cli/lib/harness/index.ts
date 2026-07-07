/**
 * harness/index.ts — the harness compiler registry.
 *
 * `getCompiler(target)` returns the compiler that renders Specky's canonical
 * `.apm` primitives into a harness's native form. Register new harnesses here.
 */

import type { HarnessCompiler, HarnessTarget } from "./types.js";
import { copilotCompiler } from "./compilers/copilot.js";
import { claudeCompiler } from "./compilers/claude.js";
import { cursorCompiler } from "./compilers/cursor.js";
import { opencodeCompiler } from "./compilers/opencode.js";
import { agentSkillsCompiler } from "./compilers/agent-skills.js";

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

export type { HarnessCompiler, HarnessTarget } from "./types.js";
export { mapTool, normalizeToLogical, logicalToNative } from "./tool-map.js";
