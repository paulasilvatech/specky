/**
 * status-command.test.ts — `specky status` CLI command.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStatus } from "../../src/cli/commands/status.js";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";
import { VERSION } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";

const workspaces: string[] = [];

let logs: string[];
let errors: string[];

function setup(): string {
  const workspace = mkdtempSync(join(tmpdir(), "specky-status-"));
  workspaces.push(workspace);
  return workspace;
}

function writeConfig(workspace: string): void {
  mkdirSync(join(workspace, ".specky"), { recursive: true });
  writeFileSync(
    join(workspace, ".specky/config.yml"),
    serializeWorkspaceConfig(createWorkspaceConfig()),
    "utf8",
  );
}

function writeInstallJson(workspace: string, meta: Record<string, string>): void {
  mkdirSync(join(workspace, ".specky"), { recursive: true });
  writeFileSync(join(workspace, ".specky/install.json"), JSON.stringify(meta), "utf8");
}

/** Create a signed, valid v5 feature state in `.specs/<feature>/`. */
async function createFeatureState(
  workspace: string,
  feature: string,
  opts: { completedPhases?: string[]; gate?: "APPROVE" | "CHANGES_NEEDED" | "BLOCK" } = {},
): Promise<{ id: string; version: string; phaseCount: number }> {
  const contract = resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "api",
    execution_mode: "full",
    capabilities: [],
    capability_config: {},
  });
  const stateMachine = new StateMachine(new FileManager(workspace), workspace);
  const featureDir = join(".specs", feature);
  const state = stateMachine.createFeatureState({
    projectName: "Test Project",
    feature: { number: feature.slice(0, 3), name: feature, directory: featureDir },
    contract,
  });
  for (const phase of opts.completedPhases ?? []) {
    state.phases[phase as keyof typeof state.phases] = {
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
  }
  if (opts.gate) {
    state.gate_decision = {
      decision: opts.gate,
      reasons: [],
      coverage_percent: 100,
      gaps: [],
      decided_at: new Date().toISOString(),
    };
  }
  await stateMachine.saveState(featureDir, state);
  return { id: contract.id, version: contract.version, phaseCount: contract.phases.length };
}

beforeEach(() => {
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("runStatus — workspace config", () => {
  it("fails with exit code 1 when the workspace config is missing", async () => {
    const workspace = setup();

    const code = await runStatus({ workspace });

    expect(code).toBe(1);
    expect(errors.some((line) => line.includes("Workspace config: INVALID"))).toBe(true);
  });

  it("fails with exit code 1 when the workspace config is malformed", async () => {
    const workspace = setup();
    mkdirSync(join(workspace, ".specky"), { recursive: true });
    writeFileSync(join(workspace, ".specky/config.yml"), "{ not: valid", "utf8");

    const code = await runStatus({ workspace });

    expect(code).toBe(1);
    expect(errors.some((line) => line.includes("Workspace config: INVALID"))).toBe(true);
  });

  it("prints version and workspace header on success", async () => {
    const workspace = setup();
    writeConfig(workspace);

    const code = await runStatus({ workspace });

    expect(code).toBe(0);
    expect(logs).toContain(`Specky v${VERSION}`);
    expect(logs).toContain(`Workspace: ${workspace}`);
  });
});

describe("runStatus — install metadata", () => {
  it("reports NOT DETECTED when install.json is missing", async () => {
    const workspace = setup();
    writeConfig(workspace);

    await runStatus({ workspace });

    expect(logs).toContain("Install: NOT DETECTED — run `npx specky init`");
  });

  it("reports unreadable metadata when install.json is corrupt", async () => {
    const workspace = setup();
    writeConfig(workspace);
    writeFileSync(join(workspace, ".specky/install.json"), "{ not json", "utf8");

    await runStatus({ workspace });

    expect(logs).toContain("Install: metadata unreadable — run `npx specky doctor`");
  });

  it("prints install metadata without an upgrade warning when versions match", async () => {
    const workspace = setup();
    writeConfig(workspace);
    writeInstallJson(workspace, {
      version: VERSION,
      ide: "copilot",
      installed_at: "2026-01-01T00:00:00.000Z",
    });

    await runStatus({ workspace });

    expect(logs).toContain(`Install: v${VERSION}, ide=copilot, at=2026-01-01T00:00:00.000Z`);
    expect(logs.some((line) => line.includes("specky upgrade"))).toBe(false);
  });

  it("warns when installed assets are older than the CLI", async () => {
    const workspace = setup();
    writeConfig(workspace);
    writeInstallJson(workspace, {
      version: "0.0.1-old",
      ide: "claude",
      installed_at: "2025-01-01T00:00:00.000Z",
    });

    await runStatus({ workspace });

    expect(logs).toContain("Install: v0.0.1-old, ide=claude, at=2025-01-01T00:00:00.000Z");
    expect(
      logs.some(
        (line) =>
          line.includes("Installed assets are v0.0.1-old") && line.includes("specky upgrade"),
      ),
    ).toBe(true);
  });
});

describe("runStatus — IDE targets", () => {
  it("omits IDE target lines when no target directories exist", async () => {
    const workspace = setup();
    writeConfig(workspace);

    await runStatus({ workspace });

    expect(logs).toContain("IDE targets:");
    expect(logs.some((line) => line.includes(".claude/"))).toBe(false);
    expect(logs.some((line) => line.includes(".github/"))).toBe(false);
  });

  it("counts Claude target assets (files for agents, dirs for skills)", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".claude/agents"), { recursive: true });
    writeFileSync(join(workspace, ".claude/agents/a.md"), "");
    writeFileSync(join(workspace, ".claude/agents/b.md"), "");
    mkdirSync(join(workspace, ".claude/commands"), { recursive: true });
    writeFileSync(join(workspace, ".claude/commands/c.md"), "");
    mkdirSync(join(workspace, ".claude/skills/skill-a"), { recursive: true });
    mkdirSync(join(workspace, ".claude/skills/skill-b"), { recursive: true });
    // Files inside skills/ are not counted — only directories.
    writeFileSync(join(workspace, ".claude/skills/stray.md"), "");
    mkdirSync(join(workspace, ".claude/hooks/scripts"), { recursive: true });
    writeFileSync(join(workspace, ".claude/hooks/scripts/h1.sh"), "");

    await runStatus({ workspace });

    expect(logs).toContain("  .claude/      agents=2, commands=1, skills=2, hooks=1");
  });

  it("counts Copilot target assets when .github/agents or .github/prompts exists", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".github/agents"), { recursive: true });
    writeFileSync(join(workspace, ".github/agents/a.agent.md"), "");
    mkdirSync(join(workspace, ".github/prompts"), { recursive: true });
    writeFileSync(join(workspace, ".github/prompts/p1.prompt.md"), "");
    writeFileSync(join(workspace, ".github/prompts/p2.prompt.md"), "");
    mkdirSync(join(workspace, ".github/skills/skill-x"), { recursive: true });

    await runStatus({ workspace });

    expect(logs).toContain("  .github/      agents=1, prompts=2, skills=1, hooks=0");
  });
});

describe("runStatus — pipeline status", () => {
  it("reports no active pipeline when the spec root is missing", async () => {
    const workspace = setup();
    writeConfig(workspace);

    await runStatus({ workspace });

    expect(logs).toContain("  No .specs/ directory — no active pipeline.");
    expect(logs.some((line) => line.includes("specky-onboarding"))).toBe(true);
  });

  it("reports an empty spec root with no feature directories", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".specs/not-a-feature"), { recursive: true });
    writeFileSync(join(workspace, ".specs/README.md"), "");

    await runStatus({ workspace });

    expect(logs).toContain("  .specs/ exists but has no feature directories.");
  });

  it("warns about legacy root state when .specs/.sdd-state.json exists", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".specs"), { recursive: true });
    writeFileSync(join(workspace, ".specs/.sdd-state.json"), "{}", "utf8");

    await runStatus({ workspace });

    expect(logs).toContain("  Legacy root state detected.");
    expect(logs.some((line) => line.includes("specky migrate-contracts"))).toBe(true);
  });

  it("prints phase progress and contract for a feature with valid state", async () => {
    const workspace = setup();
    writeConfig(workspace);
    const contract = await createFeatureState(workspace, "001-todo-api", {
      completedPhases: ["init"],
    });

    const code = await runStatus({ workspace });

    expect(code).toBe(0);
    expect(logs).toContain(
      `  001-todo-api: phase=init (1/${contract.phaseCount}) contract=${contract.id}@${contract.version}`,
    );
  });

  it("includes the gate decision when one has been recorded", async () => {
    const workspace = setup();
    writeConfig(workspace);
    const contract = await createFeatureState(workspace, "001-todo-api", { gate: "APPROVE" });

    await runStatus({ workspace });

    expect(logs).toContain(
      `  001-todo-api: phase=init (0/${contract.phaseCount}) contract=${contract.id}@${contract.version} gate=APPROVE`,
    );
  });

  it("lists multiple features sorted by name", async () => {
    const workspace = setup();
    writeConfig(workspace);
    await createFeatureState(workspace, "002-second");
    await createFeatureState(workspace, "001-first");

    await runStatus({ workspace });

    const featureLines = logs.filter((line) => /^\s{2}\d{3}-/.test(line));
    expect(featureLines).toHaveLength(2);
    expect(featureLines[0]).toContain("001-first");
    expect(featureLines[1]).toContain("002-second");
  });

  it("labels a state with an old schema version as 'migration required'", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".specs/001-legacy"), { recursive: true });
    writeFileSync(
      join(workspace, ".specs/001-legacy/.sdd-state.json"),
      JSON.stringify({ version: "4.0.0" }),
      "utf8",
    );

    await runStatus({ workspace });

    const line = logs.find((entry) => entry.includes("001-legacy"));
    expect(line).toBeDefined();
    expect(line).toContain("migration required");
  });

  it("labels unparseable feature state as 'invalid state'", async () => {
    const workspace = setup();
    writeConfig(workspace);
    mkdirSync(join(workspace, ".specs/001-broken"), { recursive: true });
    writeFileSync(join(workspace, ".specs/001-broken/.sdd-state.json"), "{ nope", "utf8");

    await runStatus({ workspace });

    const line = logs.find((entry) => entry.includes("001-broken"));
    expect(line).toBeDefined();
    expect(line).toContain("invalid state");
    expect(line).toContain("Invalid JSON");
  });
});
