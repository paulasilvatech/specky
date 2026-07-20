/**
 * spec-package-mcp.test.ts — validates that spec creation produces a complete feature package.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeSignedFeatureState, writeTestWorkspaceConfig } from "../helpers/runtime-workspace.js";

const REPO = resolve(import.meta.dirname, "../..");
const SERVER = resolve(REPO, "dist/index.js");

function callTool(
  cwd: string,
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const input =
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "spec-package-test", version: "1" },
      },
    }) +
    "\n" +
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
    "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }) +
    "\n";

  const res = spawnSync("node", [SERVER], {
    cwd,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      SDD_WORKSPACE: cwd,
      SDD_ROLE: "admin",
      SDD_FIXED_NOW: "2026-06-17T12:00:00.000Z",
    },
    timeout: 10000,
  });

  const lines = (res.stdout ?? "").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed["id"] === 2) return parsed;
    } catch {
      // Ignore non-JSON lines.
    }
  }

  throw new Error(`No tool response. status=${res.status}; stderr=${res.stderr?.slice(0, 500)}`);
}

function extractPayload(response: Record<string, unknown>): Record<string, unknown> {
  const result = response["result"] as { content?: Array<{ text?: string }> } | undefined;
  const text = result?.content?.[0]?.text ?? "{}";
  expect(text.trim(), text).toMatch(/^\{/);
  return JSON.parse(text) as Record<string, unknown>;
}

describe("spec package generation through MCP", () => {
  let ws: string;

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-spec-package-"));
    spawnSync("git", ["init", "-q"], { cwd: ws });
    writeTestWorkspaceConfig(ws);
    writeSignedFeatureState(ws, {
      number: "001",
      name: "complete-feature",
      currentPhase: "discover",
      completed: ["init"],
    });
    writeFileSync(
      resolve(ws, ".specs", "001-complete-feature", "CONSTITUTION.md"),
      "# Constitution\n",
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("creates companion docs, diagrams, TDD status, evidence, and manifest when writing a spec", () => {
    const response = callTool(ws, "sdd_write_spec", {
      feature_name: "complete-feature",
      feature_number: "001",
      discovery_answers: { Q1: "Complete feature package" },
      spec_dir: ".specs",
      force: false,
      requirements: [
        {
          id: "REQ-CORE-001",
          ears_pattern: "ubiquitous",
          text: "The system shall create a complete feature package for every specification.",
          acceptance_criteria: ["All companion artifacts exist"],
        },
      ],
    });

    const payload = extractPayload(response);
    expect(payload.status).toBe("specification_written");
    expect(payload.feature_package).toMatchObject({
      created: expect.arrayContaining([
        "README.md",
        "DESIGN.md",
        "TASKS.md",
        "ADR.md",
        "PLAYBOOK.md",
        "DIAGRAMS.md",
        "TDD_STATUS.md",
        "EVIDENCE.md",
        "SPEC_PACKAGE.json",
      ]),
    });

    const featureDir = resolve(ws, ".specs", "001-complete-feature");
    for (const fileName of [
      "SPECIFICATION.md",
      "README.md",
      "DESIGN.md",
      "TASKS.md",
      "ADR.md",
      "PLAYBOOK.md",
      "DIAGRAMS.md",
      "TDD_STATUS.md",
      "EVIDENCE.md",
      "SPEC_PACKAGE.json",
    ]) {
      expect(existsSync(resolve(featureDir, fileName)), `${fileName} should exist`).toBe(true);
    }

    expect(readFileSync(resolve(featureDir, "DESIGN.md"), "utf8")).toContain(
      "specky_scaffold: true",
    );
    expect(readFileSync(resolve(featureDir, "TASKS.md"), "utf8")).toContain(
      "specky_scaffold: true",
    );
    expect(readFileSync(resolve(featureDir, "TDD_STATUS.md"), "utf8")).toContain("REQ-CORE-001");
    expect(
      JSON.parse(readFileSync(resolve(featureDir, "SPEC_PACKAGE.json"), "utf8")),
    ).toMatchObject({
      feature_number: "001",
      feature_name: "complete-feature",
      source_tool: "sdd_write_spec",
      requirements: ["REQ-CORE-001"],
    });
  });
});
