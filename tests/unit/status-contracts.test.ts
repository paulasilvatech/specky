import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { runStatus } from "../../src/cli/commands/status.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";

describe("specky status contract diagnostics", () => {
    let workspace: string;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "specky-status-contracts-"));
        logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    function writeConfig(): void {
        mkdirSync(join(workspace, ".specky"), { recursive: true });
        writeFileSync(
            join(workspace, ".specky/config.yml"),
            serializeWorkspaceConfig(createWorkspaceConfig()),
        );
    }

    it("returns failure for an invalid workspace config", async () => {
        mkdirSync(join(workspace, ".specky"), { recursive: true });
        writeFileSync(join(workspace, ".specky/config.yml"), "profile: standard\n");
        expect(await runStatus({ workspace })).toBe(1);
        expect(errorSpy.mock.calls.flat().join(" ")).toContain("Workspace config: INVALID");
    });

    it("reports a legacy root state with the exact migration command", async () => {
        writeConfig();
        mkdirSync(join(workspace, ".specs/001-legacy"), { recursive: true });
        writeFileSync(join(workspace, ".specs/.sdd-state.json"), JSON.stringify({ version: "4.0.0" }));
        expect(await runStatus({ workspace })).toBe(0);
        const output = logSpy.mock.calls.flat().join(" ");
        expect(output).toContain("Legacy root state detected");
        expect(output).toContain("specky migrate-contracts --spec-dir=.specs --dry-run");
    });

    it("reports the selected feature contract and signed v5 phase", async () => {
        writeConfig();
        const fileManager = new FileManager(workspace);
        const stateMachine = new StateMachine(fileManager, workspace);
        const stateDir = ".specs/001-api";
        const state = stateMachine.createFeatureState({
            projectName: "api",
            feature: { number: "001", name: "api", directory: stateDir },
            contract: resolveUseCaseContract({
                lifecycle: "greenfield",
                workload: "api",
                execution_mode: "full",
                capabilities: [],
                capability_config: {},
            }),
        });
        await stateMachine.saveState(stateDir, state);

        expect(await runStatus({ workspace })).toBe(0);
        const output = logSpy.mock.calls.flat().join(" ");
        expect(output).toContain("contract=greenfield-api-full@1.0.0");
        expect(output).toContain("phase=init");
    });
});
