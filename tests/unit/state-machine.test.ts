import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateMachine } from "../../src/services/state-machine.js";
import { Phase } from "../../src/constants.js";
import type { SddState } from "../../src/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeState(currentPhase: Phase): SddState {
  return {
    version: "4.0.0",
    current_phase: currentPhase,
    features: [],
    phases: {
      [Phase.Init]: { status: "completed" },
      [Phase.Discover]: { status: "pending" },
      [Phase.Specify]: { status: "pending" },
      [Phase.Clarify]: { status: "pending" },
      [Phase.Design]: { status: "pending" },
      [Phase.Tasks]: { status: "pending" },
      [Phase.Analyze]: { status: "pending" },
      [Phase.Implement]: { status: "pending" },
      [Phase.Verify]: { status: "pending" },
      [Phase.Release]: { status: "pending" },
    },
  };
}

function makeFileManager(state?: SddState) {
  const stateJson = state ? JSON.stringify(state) : "{}";
  return {
    readProjectFile: vi.fn().mockResolvedValue(stateJson),
    writeSpecFile: vi.fn().mockResolvedValue(undefined),
    readSpecFile: vi.fn().mockResolvedValue(""),
    fileExists: vi.fn().mockResolvedValue(true),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("StateMachine", () => {
  let sm: StateMachine;

  // ── loadState ───────────────────────────────────────────────────────────
  describe("loadState", () => {
    it("returns parsed state from file manager", async () => {
      const state = makeState(Phase.Specify);
      sm = new StateMachine(makeFileManager(state) as never);

      const loaded = await sm.loadState(".specs");
      expect(loaded.current_phase).toBe(Phase.Specify);
    });

    it("returns default state when file read fails (no init yet)", async () => {
      const fm = {
        readProjectFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
        writeSpecFile: vi.fn().mockResolvedValue(undefined),
        fileExists: vi.fn().mockResolvedValue(true),
      };
      sm = new StateMachine(fm as never);

      const loaded = await sm.loadState(".specs");
      expect(loaded.current_phase).toBe(Phase.Init);
    });

    it("migrates v3 state to v4 by adding missing phases", async () => {
      const v3State = {
        version: "3.0.0",
        current_phase: Phase.Specify,
        features: [],
        phases: {
          [Phase.Init]: { status: "completed" },
          [Phase.Discover]: { status: "completed" },
          [Phase.Specify]: { status: "in_progress" },
        },
      };
      const fm = makeFileManager(v3State as never);
      sm = new StateMachine(fm as never);

      const loaded = await sm.loadState(".specs");
      expect(loaded.version).toBe("4.0.0");
      expect(loaded.phases[Phase.Implement]).toBeDefined();
      expect(loaded.phases[Phase.Release]).toBeDefined();
      // Migration auto-saves the new state
      expect(fm.writeSpecFile).toHaveBeenCalled();
    });
  });

  // ── getCurrentPhase ──────────────────────────────────────────────────────
  describe("getCurrentPhase", () => {
    it("returns the current phase from persisted state", async () => {
      const state = makeState(Phase.Design);
      sm = new StateMachine(makeFileManager(state) as never);

      const phase = await sm.getCurrentPhase(".specs");
      expect(phase).toBe(Phase.Design);
    });
  });

  // ── canTransition ─────────────────────────────────────────────────────────
  describe("canTransition", () => {
    it("allows transition to the immediately next phase", async () => {
      const state = makeState(Phase.Init);
      const fm = makeFileManager(state);
      fm.fileExists.mockResolvedValue(true); // required files exist
      sm = new StateMachine(fm as never);

      const result = await sm.canTransition(".specs", Phase.Discover);
      expect(result.allowed).toBe(true);
      expect(result.from_phase).toBe(Phase.Init);
      expect(result.to_phase).toBe(Phase.Discover);
    });

    it("rejects skipping a phase", async () => {
      const state = makeState(Phase.Init);
      sm = new StateMachine(makeFileManager(state) as never);

      const result = await sm.canTransition(".specs", Phase.Specify);
      expect(result.allowed).toBe(false);
      expect(result.error_message).toMatch(/discover/i);
    });

    it("rejects going backwards", async () => {
      const state = makeState(Phase.Design);
      sm = new StateMachine(makeFileManager(state) as never);

      const result = await sm.canTransition(".specs", Phase.Init);
      expect(result.allowed).toBe(false);
    });

    it("blocks transition when required files are missing", async () => {
      const state = makeState(Phase.Specify);
      const fm = makeFileManager(state);
      fm.fileExists.mockResolvedValue(false);
      state.features = [".specs/features/001"];
      sm = new StateMachine(fm as never);

      const result = await sm.canTransition(".specs", Phase.Clarify);
      expect(result.allowed).toBe(false);
      expect(result.missing_files?.length).toBeGreaterThan(0);
    });
  });

  // ── saveState ─────────────────────────────────────────────────────────────
  describe("saveState", () => {
    it("calls writeSpecFile with JSON-serialised state", async () => {
      const fm = makeFileManager();
      sm = new StateMachine(fm as never);

      const state = makeState(Phase.Clarify);
      await sm.saveState(".specs", state);

      expect(fm.writeSpecFile).toHaveBeenCalledOnce();
      const [, , json] = fm.writeSpecFile.mock.calls[0];
      const parsed = JSON.parse(json);
      expect(parsed.current_phase).toBe(Phase.Clarify);
    });
  });
});
