import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { testDocumentationConfig } from "../helpers/documentation-config.js";

const REPO = resolve(import.meta.dirname, "../..");
const CONTEXT = resolve(REPO, ".apm/hooks/scripts/specky-contract-context.mjs");
const BRANCH = resolve(REPO, ".apm/hooks/scripts/specky-branch-validator.sh");
const RELEASE_GATE = resolve(REPO, ".apm/hooks/scripts/specky-release-gate.sh");

function runGit(workspace: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}

describe("contract-aware hooks", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-hook-contract-"));
    runGit(workspace, ["init", "-q", "-b", "main"]);
    runGit(workspace, ["config", "user.email", "test@example.com"]);
    runGit(workspace, ["config", "user.name", "Test"]);
    writeFileSync(join(workspace, "README.md"), "# hook test\n");
    runGit(workspace, ["add", "."]);
    runGit(workspace, ["commit", "-qm", "init"]);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  async function writeFeature(number: string, name: string, threshold: number): Promise<string> {
    const stateDir = `.specs/${number}-${name}`;
    const fileManager = new FileManager(workspace);
    const stateMachine = new StateMachine(fileManager, workspace);
    const contract = resolveUseCaseContract({
      lifecycle: "greenfield",
      workload: "service",
      execution_mode: "full",
      capabilities: ["tdd", "release"],
      capability_config: {
        tdd: {
          framework: "vitest",
          property_framework: "fast-check",
          output_dir: "tests",
          coverage_threshold: threshold,
          trace_marker: "REQ-",
          imports: 'import { expect, it } from "vitest";',
          bindings: [
            {
              requirement_id: "REQ-CORE-001",
              test_name: "verifies delivery",
              body: "const delivered = 1;\nexpect(delivered).toBe(1);",
            },
          ],
          property_imports: 'import fc from "fast-check";\nimport { expect, it } from "vitest";',
          property_bindings: [
            {
              requirement_id: "REQ-CORE-001",
              property_name: "delivery count remains nonnegative",
              property_type: "invariant",
              body: 'it("REQ-CORE-001", () => { fc.assert(fc.property(fc.nat(), (value) => { expect(value).toBeGreaterThanOrEqual(0); })); });',
            },
          ],
        },
        release: {
          branch_prefix: "feature/",
          base_branch: "trunk",
          draft_pr: true,
          checkpoints: true,
          documentation: testDocumentationConfig(),
        },
      },
    });
    const state = stateMachine.createFeatureState({
      projectName: name,
      feature: { number, name, directory: stateDir },
      contract,
    });
    state.current_phase = "release" as typeof state.current_phase;
    state.gate_decision = {
      decision: "APPROVE",
      reasons: ["verified"],
      coverage_percent: 100,
      gaps: [],
      decided_at: new Date().toISOString(),
    };
    await stateMachine.saveState(stateDir, state);
    mkdirSync(join(workspace, stateDir), { recursive: true });
    writeFileSync(join(workspace, stateDir, "ANALYSIS.md"), "# Analysis\nAPPROVE\n");
    writeFileSync(
      join(workspace, stateDir, "VERIFICATION.md"),
      "# Verification\n**Pass Rate**: 85%\n",
    );
    return stateDir;
  }

  function runContext(number: string) {
    return spawnSync("node", [CONTEXT, "json"], {
      cwd: workspace,
      env: {
        ...process.env,
        SPECKY_HOOK_WORKSPACE: workspace,
        SDD_SPEC_DIR: ".specs",
        SDD_FEATURE_NUMBER: number,
      },
      encoding: "utf8",
    });
  }

  it("resolves only the explicitly selected signed feature", async () => {
    await writeFeature("001", "first", 80);
    await writeFeature("002", "second", 90);
    const result = runContext("002");
    expect(result.status, result.stderr).toBe(0);
    const context = JSON.parse(result.stdout) as {
      featureNumber: string;
      featureName: string;
      contract: { id: string };
    };
    expect(context.featureNumber).toBe("002");
    expect(context.featureName).toBe("second");
    expect(context.contract.id).toBe("greenfield-service-full");
  });

  it("does not infer a feature when context is absent", async () => {
    await writeFeature("001", "first", 80);
    const result = spawnSync("node", [CONTEXT, "json"], { cwd: workspace, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ active: false });
  });

  it("fails closed when the selected state signature is tampered", async () => {
    const stateDir = await writeFeature("001", "first", 80);
    const statePath = join(workspace, stateDir, ".sdd-state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
    state["current_phase"] = "verify";
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    const result = runContext("001");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("signature verification failed");
  });

  it("uses persisted branch prefix and base instead of Gitflow names", async () => {
    await writeFeature("001", "first", 80);
    runGit(workspace, ["checkout", "-qb", "feature/001-first"]);
    const featureResult = spawnSync("bash", [BRANCH], {
      cwd: workspace,
      env: {
        ...process.env,
        SPECKY_HOOK_WORKSPACE: workspace,
        SDD_SPEC_DIR: ".specs",
        SDD_FEATURE_NUMBER: "001",
        SDD_TOOL_NAME: "sdd_write_design",
      },
      encoding: "utf8",
    });
    expect(featureResult.status, featureResult.stderr).toBe(0);
    expect(featureResult.stdout).toContain("matches persisted release policy");

    runGit(workspace, ["checkout", "-qb", "trunk"]);
    const baseResult = spawnSync("bash", [BRANCH], {
      cwd: workspace,
      env: {
        ...process.env,
        SPECKY_HOOK_WORKSPACE: workspace,
        SDD_SPEC_DIR: ".specs",
        SDD_FEATURE_NUMBER: "001",
        SDD_TOOL_NAME: "sdd_create_branch",
      },
      encoding: "utf8",
    });
    expect(baseResult.status).toBe(0);
    expect(baseResult.stdout).toContain("matches persisted release policy");
  }, 15_000);

  it("uses the persisted TDD threshold in the release gate", async () => {
    await writeFeature("001", "passing", 80);
    const passing = spawnSync("bash", [RELEASE_GATE], {
      cwd: workspace,
      env: {
        ...process.env,
        SPECKY_HOOK_WORKSPACE: workspace,
        SDD_SPEC_DIR: ".specs",
        SDD_FEATURE_NUMBER: "001",
      },
      encoding: "utf8",
    });
    expect(passing.status, passing.stderr).toBe(0);
    expect(passing.stdout).toContain("85% meets 80%");

    await writeFeature("002", "blocked", 90);
    const blocked = spawnSync("bash", [RELEASE_GATE], {
      cwd: workspace,
      env: {
        ...process.env,
        SPECKY_HOOK_WORKSPACE: workspace,
        SDD_SPEC_DIR: ".specs",
        SDD_FEATURE_NUMBER: "002",
      },
      encoding: "utf8",
    });
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("below contracted threshold 90%");
  });
});
