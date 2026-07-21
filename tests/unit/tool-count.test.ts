import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOTAL_TOOLS } from "../../src/constants.js";

/**
 * Regression guard for the advertised tool count.
 *
 * Specky advertises an exact number of MCP tools in its server description,
 * plugin manifest, README, and onboarding material. This test anchors that
 * number to the real registration calls so the count can never drift again
 * (e.g. the 57 -> 58 drift introduced when sdd_verify_audit was added).
 *
 * If you add or remove a tool, update TOTAL_TOOLS in src/constants.ts and the
 * user-facing copy, then this test will confirm they agree.
 */
describe("Tool count integrity", () => {
  const toolsDir = fileURLToPath(new URL("../../src/tools", import.meta.url));

  function countRegisteredTools(): number {
    const files = readdirSync(toolsDir).filter((name) => name.endsWith(".ts"));
    let count = 0;
    for (const file of files) {
      const content = readFileSync(
        fileURLToPath(new URL(`../../src/tools/${file}`, import.meta.url)),
        "utf8",
      );
      const matches = content.match(/server\.registerTool\(/g);
      count += matches ? matches.length : 0;
    }
    return count;
  }

  it("registers exactly TOTAL_TOOLS tools across src/tools", () => {
    expect(countRegisteredTools()).toBe(TOTAL_TOOLS);
  });

  it("advertises 58 tools (current release contract)", () => {
    expect(TOTAL_TOOLS).toBe(58);
  });
});
