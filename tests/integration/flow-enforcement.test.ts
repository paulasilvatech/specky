/**
 * flow-enforcement.test.ts — Integration tests for Sprint 3 pipeline guards.
 *
 * Verifies rc.13 flipped-polarity semantics:
 *   - Default (no SPECKY_GUARD or SPECKY_GUARD=off/advisory) → warn, exit 0
 *   - SPECKY_GUARD=strict                                    → block, exit 2
 *   - Orchestrator/onboarding prompts never warn or block
 *   - No behavior when no pipeline is active (greenfield users are not harmed)
 */
import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { testDocumentationConfig } from "../helpers/documentation-config.js";

const REPO = resolve(import.meta.dirname, "../..");
const GUARD = resolve(REPO, ".apm/hooks/scripts/specky-pipeline-guard.sh");
const BRANCH = resolve(REPO, ".apm/hooks/scripts/specky-branch-validator.sh");

// spawnSync wrapper — no shell, no injection risk.
function run(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
  if ((r.status ?? 0) !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr?.toString()}`);
  }
}

function makeWorkspace(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "specky-flow-"));
  run("git", ["init", "-q", "-b", "main"], dir);
  run("git", ["config", "user.email", "t@t.com"], dir);
  run("git", ["config", "user.name", "t"], dir);
  writeFileSync(resolve(dir, "README.md"), "# test\n");
  run("git", ["add", "."], dir);
  run("git", ["commit", "-q", "-m", "init"], dir);
  return dir;
}

function activatePipeline(workspace: string, phase = 7, feature = "001-test"): void {
  const dir = resolve(workspace, ".specs", feature);
  mkdirSync(dir, { recursive: true });
  const PHASE_NAMES = [
    "init",
    "discover",
    "specify",
    "clarify",
    "design",
    "tasks",
    "analyze",
    "implement",
    "verify",
    "release",
  ];
  const current_phase = PHASE_NAMES[phase] ?? "implement";
  const number = feature.slice(0, 3);
  const name = feature.slice(4);
  const directory = `.specs/${feature}`;
  const contract = resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "service",
    execution_mode: "full",
    capabilities: ["release"],
    capability_config: {
      release: {
        branch_prefix: "spec/",
        base_branch: "develop",
        draft_pr: false,
        checkpoints: true,
        documentation: testDocumentationConfig(),
      },
    },
  });
  const phases = Object.fromEntries(PHASE_NAMES.map((phaseName) => [phaseName, { status: "pending" }]));
  const state = {
    version: "5.0.0",
    project_name: name,
    feature: { number, name, directory },
    contract,
    current_phase,
    phases,
    amendments: [],
    gate_decision: null,
  };
  const raw = JSON.stringify(state, null, 2);
  const key = process.env["SDD_STATE_KEY"]
    ?? createHash("sha256").update(`specky-state-v1:${workspace}`).digest("hex");
  writeFileSync(resolve(dir, ".sdd-state.json"), raw);
  writeFileSync(
    resolve(dir, ".sdd-state.json.sig"),
    createHmac("sha256", key).update(raw).digest("hex"),
  );
}

function checkoutBranch(workspace: string, branch: string): void {
  run("git", ["checkout", "-qb", branch], workspace);
}

function hookFeatureContext(workspace: string): Record<string, string> {
  const specRoot = resolve(workspace, ".specs");
  if (!existsSync(specRoot)) return {};
  const feature = readdirSync(specRoot).find((name) =>
    name.startsWith("001-") &&
    existsSync(resolve(specRoot, name, ".sdd-state.json")) &&
    existsSync(resolve(specRoot, name, ".sdd-state.json.sig"))
  );
  return feature
    ? {
      SPECKY_HOOK_WORKSPACE: workspace,
      SDD_SPEC_DIR: ".specs",
      SDD_FEATURE_NUMBER: "001",
    }
    : {};
}

function runGuard(
  workspace: string,
  prompt: string,
  env: Record<string, string> = {},
): { code: number; stderr: string } {
  const featureContext = hookFeatureContext(workspace);
  const res = spawnSync("bash", [GUARD], {
    cwd: workspace,
    input: JSON.stringify({ prompt }),
    env: { ...process.env, ...featureContext, ...env },
    encoding: "utf8",
  });
  return { code: res.status ?? -1, stderr: res.stderr };
}

function runBranch(
  workspace: string,
  toolName: string,
  env: Record<string, string> = {},
): { code: number; stderr: string } {
  const featureContext = hookFeatureContext(workspace);
  const res = spawnSync("bash", [BRANCH], {
    cwd: workspace,
    env: { ...process.env, ...featureContext, SDD_TOOL_NAME: toolName, ...env },
    encoding: "utf8",
  });
  return { code: res.status ?? -1, stderr: res.stderr };
}

// Integration tests spawn bash + git repeatedly; Windows Git Bash is slow.
// 20s covers worst case (3 spawns × ~5s each on slow Windows CI).
const INTEGRATION_TIMEOUT = 20_000;

describe("pipeline-guard.sh", { timeout: INTEGRATION_TIMEOUT }, () => {
  let ws: string;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("allows any prompt when no .specs/ exists (greenfield user)", () => {
    expect(runGuard(ws, "implement a login system").code).toBe(0);
    expect(runGuard(ws, "write the auth module").code).toBe(0);
  });

  it("allows any prompt when .specs/ exists but no .sdd-state.json (unactivated)", () => {
    mkdirSync(resolve(ws, ".specs/001-test"), { recursive: true });
    expect(runGuard(ws, "implement feature X").code).toBe(0);
  });

  it("default mode: WARNS but allows free-form implementation prompts when pipeline is active", () => {
    activatePipeline(ws);
    const r = runGuard(ws, "implement the backend now");
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("pipeline-guard");
    expect(r.stderr).toContain("SPECKY_GUARD=strict");
  });

  it("strict mode: BLOCKS free-form implementation prompts when pipeline is active", () => {
    activatePipeline(ws);
    const r = runGuard(ws, "implement the backend now", { SPECKY_GUARD: "strict" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("BLOCKED");
    expect(r.stderr).toContain("@specky-orchestrator");
  });

  it("strict mode: BLOCKS build/create/fix/refactor variants", () => {
    activatePipeline(ws);
    for (const verb of ["build", "create", "write", "fix", "refactor", "deploy"]) {
      expect(runGuard(ws, `${verb} the user module`, { SPECKY_GUARD: "strict" }).code).toBe(2);
    }
  });

  it("ALLOWS prompts referencing orchestrator/onboarding (even in strict mode)", () => {
    activatePipeline(ws);
    expect(runGuard(ws, "@specky-orchestrator continue", { SPECKY_GUARD: "strict" }).code).toBe(0);
    expect(runGuard(ws, "/specky-implement", { SPECKY_GUARD: "strict" }).code).toBe(0);
    expect(runGuard(ws, "@specky-onboarding help me", { SPECKY_GUARD: "strict" }).code).toBe(0);
  });

  it("ALLOWS informational prompts (even in strict mode)", () => {
    activatePipeline(ws);
    expect(runGuard(ws, "what is my current phase", { SPECKY_GUARD: "strict" }).code).toBe(0);
    expect(runGuard(ws, "show me the specification", { SPECKY_GUARD: "strict" }).code).toBe(0);
    expect(runGuard(ws, "explain the design doc", { SPECKY_GUARD: "strict" }).code).toBe(0);
  });

  it("SPECKY_GUARD=off is aliased to advisory (warn, exit 0)", () => {
    activatePipeline(ws);
    const r = runGuard(ws, "implement X", { SPECKY_GUARD: "off" });
    expect(r.code).toBe(0);
  });
});

describe("branch-validator.sh (Write|Edit|MultiEdit enforcement)", { timeout: INTEGRATION_TIMEOUT }, () => {
  let ws: string;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("default mode: WARNS but allows Write on impl/* during active P7", () => {
    activatePipeline(ws, 7, "001-sifap");
    checkoutBranch(ws, "impl/001-sifap");
    const r = runBranch(ws, "Write");
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("branch-validator");
    expect(r.stderr).toContain("SPECKY_GUARD=strict");
  });

  it("strict mode: BLOCKS Write on impl/* branch during active P7", () => {
    activatePipeline(ws, 7, "001-sifap");
    checkoutBranch(ws, "impl/001-sifap");
    const r = runBranch(ws, "Write", { SPECKY_GUARD: "strict" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("BLOCKED");
  });

  it("ALLOWS Write on spec/* branch during active P7 (any mode)", () => {
    activatePipeline(ws, 7, "001-sifap");
    checkoutBranch(ws, "spec/001-sifap");
    expect(runBranch(ws, "Write").code).toBe(0);
    expect(runBranch(ws, "Write", { SPECKY_GUARD: "strict" }).code).toBe(0);
  });

  it("strict mode: BLOCKS Write on feature/* during P7 (not spec/)", () => {
    activatePipeline(ws, 7);
    checkoutBranch(ws, "feature/something");
    expect(runBranch(ws, "Write", { SPECKY_GUARD: "strict" }).code).toBe(2);
  });

  it("strict mode: BLOCKS Edit and MultiEdit (same rule)", () => {
    activatePipeline(ws, 7);
    checkoutBranch(ws, "impl/001-test");
    expect(runBranch(ws, "Edit", { SPECKY_GUARD: "strict" }).code).toBe(2);
    expect(runBranch(ws, "MultiEdit", { SPECKY_GUARD: "strict" }).code).toBe(2);
  });

  it("ALLOWS Write when no pipeline active (greenfield user)", () => {
    checkoutBranch(ws, "feature/anything");
    expect(runBranch(ws, "Write").code).toBe(0);
    expect(runBranch(ws, "Write", { SPECKY_GUARD: "strict" }).code).toBe(0);
  });

  it("SPECKY_GUARD=off is aliased to advisory (warn, exit 0)", () => {
    activatePipeline(ws, 7);
    checkoutBranch(ws, "impl/001");
    const r = runBranch(ws, "Write", { SPECKY_GUARD: "off" });
    expect(r.code).toBe(0);
  });

  it("is advisory (not blocking) for sdd_* MCP tools", () => {
    activatePipeline(ws, 7);
    checkoutBranch(ws, "impl/001");
    // sdd_write_spec should warn but exit 0 (advisory)
    expect(runBranch(ws, "sdd_write_spec").code).toBe(0);
  });

  it("strict mode: BLOCKS Write on a branch that violates persisted policy during Verify", () => {
    activatePipeline(ws, 8);
    checkoutBranch(ws, "impl/001");
    expect(runBranch(ws, "Write", { SPECKY_GUARD: "strict" }).code).toBe(2);
  });

  it("ALLOWS Write on the persisted feature branch during Verify", () => {
    activatePipeline(ws, 8);
    checkoutBranch(ws, "spec/001-test");
    expect(runBranch(ws, "Write").code).toBe(0);
    expect(runBranch(ws, "Write", { SPECKY_GUARD: "strict" }).code).toBe(0);
  });
});
