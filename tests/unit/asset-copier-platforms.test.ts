import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copyToAgentSkills,
  copyToClaude,
  copyToCopilot,
  copyToCursor,
  copyToOpenCode,
} from "../../src/cli/lib/asset-copier.js";
import { targetPaths } from "../../src/cli/lib/paths.js";

const REPO = resolve(import.meta.dirname, "../..");

describe("asset copier platform-specific primitive transforms", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-assets-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("installs GitHub Copilot-native agents and prompts", () => {
    copyToCopilot(REPO, targetPaths(workspace), { force: true, dryRun: false });

    const agent = readFileSync(
      resolve(workspace, ".github/agents/specky-orchestrator.agent.md"),
      "utf8",
    );
    const prompt = readFileSync(
      resolve(workspace, ".github/prompts/specky-orchestrate.prompt.md"),
      "utf8",
    );
    const toolsLine = agent.split("\n").find((line) => line.startsWith("tools:")) ?? "";

    expect(toolsLine).toContain('["search","runCommands","agent","specky/sdd_get_status"');
    expect(toolsLine).not.toMatch(/\b(Read|Glob|Grep|Task)\b/);
    expect(toolsLine).not.toContain("mcp__specky__");
    expect(toolsLine).not.toMatch(/"sdd_[a-z0-9_]+"/);

    expect(prompt).toContain("agent: agent");
    expect(prompt).not.toContain("mode: agent");

    // Only the Copilot instruction is installed — no cursor/claude leakage
    const instruction = readFileSync(
      resolve(workspace, ".github/instructions/copilot-instructions.instructions.md"),
      "utf8",
    );
    expect(instruction).toContain("applyTo:");
    expect(instruction).not.toContain("@workspace /prompt-name");
    expect(() =>
      readFileSync(
        resolve(workspace, ".github/instructions/cursor-instructions.instructions.md"),
        "utf8",
      ),
    ).toThrow();
    expect(() =>
      readFileSync(
        resolve(workspace, ".github/instructions/claude-instructions.instructions.md"),
        "utf8",
      ),
    ).toThrow();
  });

  it("installs Claude-native agents, commands, and rules", () => {
    copyToClaude(REPO, targetPaths(workspace), { force: true, dryRun: false });

    const agent = readFileSync(resolve(workspace, ".claude/agents/specky-orchestrator.md"), "utf8");
    const command = readFileSync(
      resolve(workspace, ".claude/commands/specky-orchestrate.md"),
      "utf8",
    );
    const rule = readFileSync(resolve(workspace, ".claude/rules/specky-sdd.md"), "utf8");

    expect(agent).toContain("tools: Read, Glob, Grep, Bash, Task, mcp__specky__sdd_get_status");
    expect(agent).not.toContain("specky/sdd_get_status");
    expect(agent).not.toContain('"search"');

    expect(command).not.toContain("agent: agent");
    expect(command).not.toContain("mode: agent");

    expect(rule).toContain("paths: ['**']");
    expect(rule).not.toContain("applyTo:");
    expect(rule).not.toContain("@workspace");
    expect(rule).not.toContain("Copilot Instructions");
    expect(rule).toContain(".mcp.json");
    // Stale Copilot-named rule must not be installed for Claude
    expect(() =>
      readFileSync(resolve(workspace, ".claude/rules/copilot-instructions.md"), "utf8"),
    ).toThrow();
  });

  it("installs Cursor-native agents, commands, rules, and shared skills", () => {
    copyToCursor(REPO, targetPaths(workspace), { force: true, dryRun: false });

    const agent = readFileSync(resolve(workspace, ".cursor/agents/specky-orchestrator.md"), "utf8");
    const command = readFileSync(
      resolve(workspace, ".cursor/commands/specky-orchestrate.md"),
      "utf8",
    );
    const rule = readFileSync(resolve(workspace, ".cursor/rules/specky-sdd.mdc"), "utf8");
    const hooks = readFileSync(resolve(workspace, ".cursor/hooks.json"), "utf8");
    const runner = readFileSync(resolve(workspace, ".cursor/hooks/specky-run.sh"), "utf8");
    const skill = readFileSync(
      resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"),
      "utf8",
    );

    expect(agent).toContain("tools: Read, Glob, Grep, Bash, Task, mcp__specky__sdd_get_status");
    expect(agent).not.toContain("specky/sdd_get_status");
    expect(command).not.toContain("agent: agent");
    expect(rule).toContain("alwaysApply: true");
    expect(hooks).toContain("beforeMCPExecution");
    expect(runner).toContain("specky-run.sh");
    expect(skill).toContain("name: specky-onboarding");
  });

  it("installs OpenCode-native agents, commands, and shared skills", () => {
    copyToOpenCode(REPO, targetPaths(workspace), { force: true, dryRun: false });

    const agent = readFileSync(
      resolve(workspace, ".opencode/agents/specky-orchestrator.md"),
      "utf8",
    );
    const command = readFileSync(
      resolve(workspace, ".opencode/commands/specky-orchestrate.md"),
      "utf8",
    );
    const skill = readFileSync(
      resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"),
      "utf8",
    );

    expect(agent).toContain("tools: read, bash, agent, specky/sdd_get_status");
    expect(agent).not.toContain("mcp__specky__sdd_get_status");
    expect(command).not.toContain("agent: agent");
    expect(skill).toContain("name: specky-onboarding");
  });

  it("installs neutral Agent Skills only", () => {
    copyToAgentSkills(REPO, targetPaths(workspace), { force: true, dryRun: false });

    const skill = readFileSync(
      resolve(workspace, ".agents/skills/specky-onboarding/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain("name: specky-onboarding");
    expect(() =>
      readFileSync(resolve(workspace, ".github/agents/specky-orchestrator.agent.md"), "utf8"),
    ).toThrow();
    expect(() =>
      readFileSync(resolve(workspace, ".claude/agents/specky-orchestrator.md"), "utf8"),
    ).toThrow();
  });
});
