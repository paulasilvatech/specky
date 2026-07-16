import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { FileManager } from "../../src/services/file-manager.js";
import { SPECKY_SCAFFOLD_MARKER } from "../../src/services/feature-package-generator.js";
import {
    StateMachine,
    StateMigrationRequiredError,
    StateNotFoundError,
} from "../../src/services/state-machine.js";

describe("StateMachine v5 per-feature state", () => {
    let tempDir: string;
    let fileManager: FileManager;
    let stateMachine: StateMachine;
    const stateDir = ".specs/001-state";
    const contract = resolveUseCaseContract({
        lifecycle: "greenfield",
        workload: "service",
        execution_mode: "full",
        capabilities: [],
        capability_config: {},
    });

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "specky-state-v5-"));
        fileManager = new FileManager(tempDir);
        stateMachine = new StateMachine(fileManager, tempDir);
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        delete process.env["SDD_STATE_KEY"];
    });

    function createState(
        projectName = "state",
        directory = stateDir,
        number = "001",
    ) {
        return stateMachine.createFeatureState({
            projectName,
            feature: { number, name: projectName, directory },
            contract,
        });
    }

    it("writes a signed v5 state inside the owning feature directory", async () => {
        const state = createState();
        await stateMachine.saveState(stateDir, state);

        expect(existsSync(join(tempDir, stateDir, ".sdd-state.json"))).toBe(true);
        expect(existsSync(join(tempDir, stateDir, ".sdd-state.json.sig"))).toBe(true);
        const loaded = await stateMachine.loadState(stateDir);
        expect(loaded).toMatchObject({
            version: "5.0.0",
            feature: { number: "001", directory: stateDir },
            contract: { id: "greenfield-service-full" },
        });
    });

    it("accepts Windows separators when loading a state that persists canonical POSIX separators", async () => {
        const state = createState();
        await stateMachine.saveState(stateDir, state);

        const loaded = await stateMachine.loadState(".specs\\001-state");
        expect(loaded.feature.directory).toBe(stateDir);
    });

    it("signs the exact persisted JSON with the configured HMAC key", async () => {
        process.env["SDD_STATE_KEY"] = "test-key-abc";
        await stateMachine.saveState(stateDir, createState());

        const stateJson = readFileSync(join(tempDir, stateDir, ".sdd-state.json"), "utf-8");
        const storedSig = readFileSync(join(tempDir, stateDir, ".sdd-state.json.sig"), "utf-8").trim();
        expect(storedSig).toBe(createHmac("sha256", "test-key-abc").update(stateJson).digest("hex"));
    });

    it("derives a workspace-specific key when SDD_STATE_KEY is absent", async () => {
        await stateMachine.saveState(stateDir, createState());
        const stateJson = readFileSync(join(tempDir, stateDir, ".sdd-state.json"), "utf-8");
        const storedSig = readFileSync(join(tempDir, stateDir, ".sdd-state.json.sig"), "utf-8").trim();
        const derivedKey = createHash("sha256").update(`specky-state-v1:${tempDir}`).digest("hex");
        expect(storedSig).toBe(createHmac("sha256", derivedKey).update(stateJson).digest("hex"));
    });

    it("fails closed when state content or signature is changed", async () => {
        await stateMachine.saveState(stateDir, createState());
        writeFileSync(join(tempDir, stateDir, ".sdd-state.json.sig"), "invalid");
        await expect(stateMachine.loadState(stateDir)).rejects.toThrow(/integrity check failed/);
    });

    it("requires a signature for every v5 state", async () => {
        mkdirSync(join(tempDir, stateDir), { recursive: true });
        writeFileSync(
            join(tempDir, stateDir, ".sdd-state.json"),
            JSON.stringify(createState(), null, 2),
        );
        await expect(stateMachine.loadState(stateDir)).rejects.toThrow(/signature not found/);
    });

    it("reports missing and legacy state without creating or migrating files", async () => {
        await expect(stateMachine.loadState(stateDir)).rejects.toBeInstanceOf(StateNotFoundError);

        mkdirSync(join(tempDir, stateDir), { recursive: true });
        const legacy = JSON.stringify({ version: "4.0.0", current_phase: "specify" }, null, 2);
        writeFileSync(join(tempDir, stateDir, ".sdd-state.json"), legacy);
        await expect(stateMachine.loadState(stateDir)).rejects.toBeInstanceOf(StateMigrationRequiredError);
        expect(readFileSync(join(tempDir, stateDir, ".sdd-state.json"), "utf-8")).toBe(legacy);
    });

    it("refuses to save a feature state outside its declared directory", async () => {
        const state = createState();
        await expect(stateMachine.saveState(".specs/002-other", state)).rejects.toThrow(
            /Refusing to save feature 001 state outside/,
        );
    });

    it("isolates phase transitions between feature states", async () => {
        const firstDir = ".specs/001-first";
        const secondDir = ".specs/002-second";
        mkdirSync(join(tempDir, firstDir), { recursive: true });
        mkdirSync(join(tempDir, secondDir), { recursive: true });
        writeFileSync(join(tempDir, firstDir, "CONSTITUTION.md"), "# First\n");
        writeFileSync(join(tempDir, secondDir, "CONSTITUTION.md"), "# Second\n");
        await stateMachine.saveState(firstDir, createState("first", firstDir, "001"));
        await stateMachine.saveState(secondDir, createState("second", secondDir, "002"));

        const advanced = await stateMachine.advancePhase(secondDir);
        expect(advanced.current_phase).toBe(Phase.Discover);
        expect((await stateMachine.loadState(firstDir)).current_phase).toBe(Phase.Init);
    });

    it("follows the phase graph persisted by the selected execution mode", async () => {
        const rapidDir = ".specs/001-rapid";
        const rapidContract = resolveUseCaseContract({
            lifecycle: "greenfield",
            workload: "service",
            execution_mode: "rapid",
            capabilities: [],
            capability_config: {},
        });
        const state = stateMachine.createFeatureState({
            projectName: "rapid",
            feature: { number: "001", name: "rapid", directory: rapidDir },
            contract: rapidContract,
        });
        mkdirSync(join(tempDir, rapidDir), { recursive: true });
        writeFileSync(join(tempDir, rapidDir, "CONSTITUTION.md"), "# Constitution\n");
        state.current_phase = Phase.Specify;
        state.phases[Phase.Specify] = { status: "in_progress" };
        writeFileSync(join(tempDir, rapidDir, "SPECIFICATION.md"), "# Specification\n");
        await stateMachine.saveState(rapidDir, state);

        expect((await stateMachine.advancePhase(rapidDir)).current_phase).toBe(Phase.Design);
    });

    it("blocks transitions when required artifacts are absent or scaffolds", async () => {
        const state = createState("scaffold", stateDir);
        state.current_phase = Phase.Design;
        state.phases[Phase.Design] = { status: "in_progress" };
        mkdirSync(join(tempDir, stateDir), { recursive: true });
        await stateMachine.saveState(stateDir, state);

        const missing = await stateMachine.canTransition(stateDir, Phase.Tasks);
        expect(missing.allowed).toBe(false);
        expect(missing.error_message).toContain("missing required files");

        writeFileSync(
            join(tempDir, stateDir, "DESIGN.md"),
            `---\n${SPECKY_SCAFFOLD_MARKER}\n---\n# Scaffold\n`,
        );
        const scaffold = await stateMachine.canTransition(stateDir, Phase.Tasks);
        expect(scaffold.allowed).toBe(false);
        expect(scaffold.error_message).toContain("scaffold artifacts must be completed");
    });

    it("enforces analysis gates and clears stale approvals", async () => {
        const state = createState("gate");
        state.current_phase = Phase.Analyze;
        state.gate_decision = {
            decision: "BLOCK",
            reasons: ["incomplete"],
            coverage_percent: 50,
            gaps: ["missing tests"],
            decided_at: new Date().toISOString(),
        };
        await stateMachine.saveState(stateDir, state);

        const blocked = await stateMachine.validateGateForTool(stateDir, "sdd_implement");
        expect(blocked.allowed).toBe(false);
        expect(blocked.gate_decision).toBe("BLOCK");

        await stateMachine.invalidateGateDecision(stateDir);
        expect((await stateMachine.loadState(stateDir)).gate_decision).toBeNull();
    });

    it("records artifact modification and LGTM evidence in feature gate history", async () => {
        const artifactPath = `${stateDir}/SPECIFICATION.md`;
        mkdirSync(join(tempDir, stateDir), { recursive: true });
        writeFileSync(join(tempDir, artifactPath), "# Spec\n");
        const past = new Date(Date.now() - 60_000);
        utimesSync(join(tempDir, artifactPath), past, past);

        const state = createState("evidence");
        state.current_phase = Phase.Specify;
        state.phases[Phase.Specify] = {
            status: "in_progress",
            started_at: new Date().toISOString(),
        };
        await stateMachine.saveState(stateDir, state);

        const entry = await stateMachine.recordGateEvent(
            stateDir,
            Phase.Specify,
            artifactPath,
            { lgtm: true },
        );
        expect(entry).toMatchObject({ was_modified: false, lgtm: true });
        expect((await stateMachine.loadState(stateDir)).gate_history?.at(-1)).toMatchObject({
            phase: Phase.Specify,
            lgtm: true,
        });
    });
});