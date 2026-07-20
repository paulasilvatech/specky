/**
 * agent-skills.test.ts — the neutral "agent-skills" harness compiler. It is an
 * identity transform: primitive content and filenames pass through unchanged
 * because only `.apm/skills` is deployed for this target.
 */
import { describe, expect, it } from "vitest";
import { agentSkillsCompiler } from "../../src/cli/lib/harness/compilers/agent-skills.js";

const AGENT_MARKDOWN = [
  "---",
  "name: specky-orchestrator",
  "description: Coordinates the SDD pipeline.",
  "tools: [vscode/askQuestions, execute/runInTerminal]",
  "---",
  "",
  "# Orchestrator",
  "",
  "Route each phase to the right sub-agent.",
].join("\n");

const PROMPT_MARKDOWN = "---\nname: specky.init\n---\n\nInitialize a feature.\n";

describe("agentSkillsCompiler", () => {
  it("targets the agent-skills harness", () => {
    expect(agentSkillsCompiler.target).toBe("agent-skills");
  });

  describe("compileAgent", () => {
    it("returns agent content unchanged", () => {
      expect(agentSkillsCompiler.compileAgent(AGENT_MARKDOWN)).toBe(AGENT_MARKDOWN);
    });

    it("ignores compile options", () => {
      expect(agentSkillsCompiler.compileAgent(AGENT_MARKDOWN, { integrations: ["github"] })).toBe(
        AGENT_MARKDOWN,
      );
    });

    it("returns empty content unchanged", () => {
      expect(agentSkillsCompiler.compileAgent("")).toBe("");
    });
  });

  describe("compilePrompt", () => {
    it("returns prompt content unchanged", () => {
      expect(agentSkillsCompiler.compilePrompt(PROMPT_MARKDOWN)).toBe(PROMPT_MARKDOWN);
    });

    it("returns empty content unchanged", () => {
      expect(agentSkillsCompiler.compilePrompt("")).toBe("");
    });
  });

  describe("compileInstruction", () => {
    it("returns instruction content unchanged", () => {
      const instructions = "# Copilot Instructions\n\nFollow EARS notation.\n";
      expect(agentSkillsCompiler.compileInstruction(instructions)).toBe(instructions);
    });
  });

  describe("renameAgent", () => {
    it("keeps the original agent filename", () => {
      expect(agentSkillsCompiler.renameAgent("specky-orchestrator.agent.md")).toBe(
        "specky-orchestrator.agent.md",
      );
    });
  });

  describe("renamePrompt", () => {
    it("keeps the original prompt filename", () => {
      expect(agentSkillsCompiler.renamePrompt("specky.init.prompt.md")).toBe(
        "specky.init.prompt.md",
      );
    });
  });
});
