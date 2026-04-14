import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHmac, createHash } from "node:crypto";
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
    rmSync(tempDir, { recursive: true, force: true });
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
});
