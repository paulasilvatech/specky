import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHmac, createHash } from "node:crypto";
import { Phase } from "../../src/constants.js";
import { SPECKY_SCAFFOLD_MARKER } from "../../src/services/feature-package-generator.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { FileManager } from "../../src/services/file-manager.js";

describe("StateMachine — state file integrity (HMAC-SHA256)", () => {
  let tempDir: string;
  let fileManager: FileManager;
  let stateMachine: StateMachine;
  const specDir = ".specs";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "specky-state-"));
    fileManager = new FileManager(tempDir);
    stateMachine = new StateMachine(fileManager, tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    delete process.env["SDD_STATE_KEY"];
  });

  it("writes a .sig file alongside .sdd-state.json on saveState", async () => {
    const state = stateMachine.createDefaultState("test-project");
    await stateMachine.saveState(specDir, state);
    const sigFile = join(tempDir, specDir, ".sdd-state.json.sig");
    expect(existsSync(sigFile)).toBe(true);
  });

  it("sig file contains valid HMAC-SHA256 of the state JSON", async () => {
    process.env["SDD_STATE_KEY"] = "test-key-abc";
    const state = stateMachine.createDefaultState("test-project");
    await stateMachine.saveState(specDir, state);

    const stateJson = readFileSync(join(tempDir, specDir, ".sdd-state.json"), "utf-8");
    const storedSig = readFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "utf-8").trim();
    const expectedSig = createHmac("sha256", "test-key-abc").update(stateJson).digest("hex");
    expect(storedSig).toBe(expectedSig);
  });

  it("loadState succeeds when .sig matches", async () => {
    process.env["SDD_STATE_KEY"] = "valid-key";
    const state = stateMachine.createDefaultState("matching");
    await stateMachine.saveState(specDir, state);
    const loaded = await stateMachine.loadState(specDir);
    expect(loaded.project_name).toBe("matching");
  });

  it("loadState emits stderr warning when .sig does not match", async () => {
    process.env["SDD_STATE_KEY"] = "original-key";
    const state = stateMachine.createDefaultState("tamperable");
    await stateMachine.saveState(specDir, state);

    // Tamper with sig file
    writeFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "badsignature");

    const stderrSpy = vi.spyOn(console, "error");
    await stateMachine.loadState(specDir);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("tamper"),
    );
    stderrSpy.mockRestore();
  });

  it("loadState does NOT warn when .sig file is absent (pre-v3.2.0 state)", async () => {
    const state = stateMachine.createDefaultState("legacy");
    // Write state JSON without sig (pre-v3.2.0 — directory must exist)
    const stateJson = JSON.stringify(state, null, 2);
    const specsDir = join(tempDir, specDir);
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(specsDir, ".sdd-state.json"), stateJson);

    const stderrSpy = vi.spyOn(console, "error");
    await stateMachine.loadState(specDir);
    // Should not warn about tamper for missing .sig
    const tamperCalls = stderrSpy.mock.calls.filter((c) =>
      String(c[0]).includes("tamper"),
    );
    expect(tamperCalls).toHaveLength(0);
    stderrSpy.mockRestore();
  });

  it("sig changes when state content changes", async () => {
    process.env["SDD_STATE_KEY"] = "change-key";
    const state1 = stateMachine.createDefaultState("v1");
    await stateMachine.saveState(specDir, state1);
    const sig1 = readFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "utf-8").trim();

    const state2 = stateMachine.createDefaultState("v2");
    await stateMachine.saveState(specDir, state2);
    const sig2 = readFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "utf-8").trim();

    expect(sig1).not.toBe(sig2);
  });

  it("uses derived key when SDD_STATE_KEY is not set", async () => {
    delete process.env["SDD_STATE_KEY"];
    const state = stateMachine.createDefaultState("derived");
    await stateMachine.saveState(specDir, state);

    const stateJson = readFileSync(join(tempDir, specDir, ".sdd-state.json"), "utf-8");
    const storedSig = readFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "utf-8").trim();
    const derivedKey = createHash("sha256").update(`specky-state-v1:${tempDir}`).digest("hex");
    const expectedSig = createHmac("sha256", derivedKey).update(stateJson).digest("hex");
    expect(storedSig).toBe(expectedSig);
  });

  it("loadState still returns valid state even when tampered (graceful degradation)", async () => {
    process.env["SDD_STATE_KEY"] = "degrade-key";
    const state = stateMachine.createDefaultState("degrade-test");
    await stateMachine.saveState(specDir, state);
    writeFileSync(join(tempDir, specDir, ".sdd-state.json.sig"), "wrongsig");

    vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = await stateMachine.loadState(specDir);
    expect(loaded.project_name).toBe("degrade-test");
  });

  it("refuses to advance when no feature is registered (featureless loophole)", async () => {
    // Audit finding: with state.features empty every required-file check was
    // silently skipped, letting 6 phases complete with zero artifacts on disk.
    const state = stateMachine.createDefaultState("featureless");
    await stateMachine.saveState(specDir, state);

    const transition = await stateMachine.canTransition(specDir, Phase.Discover);
    expect(transition.allowed).toBe(false);
    expect(transition.error_message).toContain("no feature registered");
    expect(transition.error_message).toContain("sdd_init");

    await expect(stateMachine.advancePhase(specDir, "001")).rejects.toThrow(
      /no feature registered/,
    );

    // Phase must not have moved.
    const after = await stateMachine.loadState(specDir);
    expect(after.current_phase).toBe(Phase.Init);
  });

  it("still allows advancing once a feature is registered and artifacts exist", async () => {
    const featureDir = `${specDir}/001-registered`;
    mkdirSync(join(tempDir, featureDir), { recursive: true });
    writeFileSync(join(tempDir, featureDir, "CONSTITUTION.md"), "# Constitution\n");

    const state = stateMachine.createDefaultState("registered");
    state.features = [featureDir];
    await stateMachine.saveState(specDir, state);

    const advanced = await stateMachine.advancePhase(specDir, "001");
    expect(advanced.current_phase).toBe(Phase.Discover);
  });

  it("recordGateEvent resolves workspace-relative artifact paths against the workspace root, not cwd", async () => {
    // Audit finding (cognitive debt): recordGateEvent stat'ed the
    // workspace-RELATIVE artifact path against process.cwd(). In hosted mode
    // (cwd != SDD_WORKSPACE — exactly this test's setup, cwd is the repo but
    // the workspace is a temp dir) the stat always threw and was_modified
    // silently defaulted to true, so unmodified-approval warnings never fired.
    expect(process.cwd()).not.toBe(tempDir);

    const featureDir = `${specDir}/001-debt`;
    const artifactRel = `${featureDir}/SPECIFICATION.md`;
    mkdirSync(join(tempDir, featureDir), { recursive: true });
    writeFileSync(join(tempDir, artifactRel), "# Spec\n");
    // Artifact last modified one minute BEFORE the phase started.
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(tempDir, artifactRel), past, past);

    const state = stateMachine.createDefaultState("debt");
    state.features = [featureDir];
    state.current_phase = Phase.Specify;
    state.phases[Phase.Specify] = {
      status: "in_progress",
      started_at: new Date().toISOString(),
    };
    await stateMachine.saveState(specDir, state);

    const entry = await stateMachine.recordGateEvent(specDir, Phase.Specify, artifactRel);
    expect(entry.was_modified).toBe(false);

    // Counter-case: touching the artifact after phase start flips the signal.
    const future = new Date(Date.now() + 1_000);
    utimesSync(join(tempDir, artifactRel), future, future);
    const modifiedEntry = await stateMachine.recordGateEvent(specDir, Phase.Specify, artifactRel);
    expect(modifiedEntry.was_modified).toBe(true);
  });

  it("recordGateEvent records the lgtm flag in the gate history entry", async () => {
    const featureDir = `${specDir}/001-lgtm`;
    mkdirSync(join(tempDir, featureDir), { recursive: true });
    writeFileSync(join(tempDir, featureDir, "SPECIFICATION.md"), "# Spec\n");

    const state = stateMachine.createDefaultState("lgtm");
    state.features = [featureDir];
    state.current_phase = Phase.Specify;
    state.phases[Phase.Specify] = { status: "in_progress", started_at: new Date().toISOString() };
    await stateMachine.saveState(specDir, state);

    const approved = await stateMachine.recordGateEvent(
      specDir,
      Phase.Specify,
      `${featureDir}/SPECIFICATION.md`,
      { lgtm: true },
    );
    expect(approved.lgtm).toBe(true);

    const unapproved = await stateMachine.recordGateEvent(
      specDir,
      Phase.Specify,
      `${featureDir}/SPECIFICATION.md`,
      { lgtm: false },
    );
    expect(unapproved.lgtm).toBe(false);

    // Both entries persisted with their lgtm flags.
    const persisted = await stateMachine.loadState(specDir);
    const history = (persisted.gate_history ?? []) as Array<{ lgtm?: boolean }>;
    expect(history.at(-2)?.lgtm).toBe(true);
    expect(history.at(-1)?.lgtm).toBe(false);
  });

  it("does not allow phase advancement with scaffold design artifacts", async () => {
    const featureDir = `${specDir}/001-scaffolded`;
    mkdirSync(join(tempDir, featureDir), { recursive: true });
    writeFileSync(join(tempDir, featureDir, "DESIGN.md"), `---\n${SPECKY_SCAFFOLD_MARKER}\n---\n# Scaffold\n`);

    const state = stateMachine.createDefaultState("scaffolded");
    state.features = [featureDir];
    state.current_phase = Phase.Design;
    state.phases[Phase.Design] = { status: "in_progress" };
    await stateMachine.saveState(specDir, state);

    const result = await stateMachine.canTransition(specDir, Phase.Tasks);

    expect(result.allowed).toBe(false);
    expect(result.error_message).toContain("scaffold artifacts must be completed");
  });
});
