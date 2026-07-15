import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrateContracts, type MigrateContractsOptions } from "../../src/cli/commands/migrate-contracts.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";

function legacyState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const phases = Object.fromEntries(
        ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement", "verify", "release"]
            .map((phase) => [phase, {
                status: phase === "init" || phase === "discover"
                    ? "completed"
                    : phase === "specify"
                        ? "in_progress"
                        : "pending",
            }]),
    );
    return {
        version: "4.0.0",
        project_name: "legacy-api",
        current_phase: "specify",
        phases,
        features: [".specs/001-legacy-api"],
        amendments: [],
        gate_decision: null,
        ...overrides,
    };
}

describe("migrate-contracts", () => {
    let workspace: string;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "specky-migrate-contracts-"));
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    function options(overrides: Partial<MigrateContractsOptions> = {}): MigrateContractsOptions {
        return {
            workspace,
            specDir: ".specs",
            dryRun: true,
            apply: false,
            lifecycle: "greenfield",
            workload: "api",
            executionMode: "full",
            capabilities: "",
            ...overrides,
        };
    }

    function seedSingleRootState(state: Record<string, unknown> = legacyState()): string {
        const featureDir = join(workspace, ".specs/001-legacy-api");
        mkdirSync(featureDir, { recursive: true });
        writeFileSync(join(featureDir, "SPECIFICATION.md"), "# Legacy specification\n", "utf8");
        writeFileSync(join(workspace, ".specs/.sdd-state.json"), JSON.stringify(state, null, 2), "utf8");
        return featureDir;
    }

    async function dryRunHash(input = options()): Promise<string> {
        consoleSpy.mockClear();
        expect(await runMigrateContracts(input)).toBe(0);
        const report = JSON.parse(String(consoleSpy.mock.calls[0][0])) as { plan_hash: string };
        return report.plan_hash;
    }

    it("produces a deterministic dry-run without changing state or artifacts", async () => {
        const featureDir = seedSingleRootState();
        const rootBefore = readFileSync(join(workspace, ".specs/.sdd-state.json"), "utf8");
        const artifactBefore = readFileSync(join(featureDir, "SPECIFICATION.md"), "utf8");

        const first = await dryRunHash();
        const second = await dryRunHash();
        expect(first).toBe(second);
        expect(readFileSync(join(workspace, ".specs/.sdd-state.json"), "utf8")).toBe(rootBefore);
        expect(readFileSync(join(featureDir, "SPECIFICATION.md"), "utf8")).toBe(artifactBefore);
        expect(existsSync(join(featureDir, ".sdd-state.json"))).toBe(false);
    });

    it("requires the exact reviewed hash before applying", async () => {
        seedSingleRootState();
        await expect(runMigrateContracts(options({
            dryRun: false,
            apply: true,
            confirmPlan: "wrong",
        }))).rejects.toThrow(/Plan confirmation mismatch/);
        expect(existsSync(join(workspace, ".specs/.sdd-state.json"))).toBe(true);
    });

    it("migrates root metadata to signed feature v5 state without changing artifacts", async () => {
        const featureDir = seedSingleRootState();
        const artifactBefore = readFileSync(join(featureDir, "SPECIFICATION.md"), "utf8");
        const hash = await dryRunHash();

        consoleSpy.mockClear();
        expect(await runMigrateContracts(options({
            dryRun: false,
            apply: true,
            confirmPlan: hash,
        }))).toBe(0);

        expect(readFileSync(join(featureDir, "SPECIFICATION.md"), "utf8")).toBe(artifactBefore);
        expect(existsSync(join(workspace, ".specs/.sdd-state.json"))).toBe(false);
        expect(existsSync(join(featureDir, ".sdd-state.json.sig"))).toBe(true);
        const state = await new StateMachine(new FileManager(workspace), workspace).loadState(
            ".specs/001-legacy-api",
        );
        expect(state).toMatchObject({
            version: "5.0.0",
            current_phase: "specify",
            feature: { number: "001", name: "legacy-api" },
            contract: { id: "greenfield-api-full" },
        });
        expect(existsSync(join(workspace, ".specky/migrations", hash, "plan.json"))).toBe(true);
    });

    it("requires per-feature mappings in a multi-feature workspace", async () => {
        for (const feature of ["001-api", "002-worker"]) {
            const featureDir = join(workspace, ".specs", feature);
            mkdirSync(featureDir, { recursive: true });
            writeFileSync(join(featureDir, ".sdd-state.json"), JSON.stringify(legacyState(), null, 2));
        }
        await expect(runMigrateContracts(options())).rejects.toThrow(/Multiple features require --mapping/);
    });

    it("rolls back the original state when v5 validation fails during apply", async () => {
        const featureDir = seedSingleRootState(legacyState({ gate_decision: "not-a-gate-object" }));
        const rootPath = join(workspace, ".specs/.sdd-state.json");
        const rootBefore = readFileSync(rootPath, "utf8");
        const hash = await dryRunHash();

        await expect(runMigrateContracts(options({
            dryRun: false,
            apply: true,
            confirmPlan: hash,
        }))).rejects.toThrow();
        expect(readFileSync(rootPath, "utf8")).toBe(rootBefore);
        expect(existsSync(join(featureDir, ".sdd-state.json"))).toBe(false);
        expect(existsSync(join(workspace, ".specky/migrations", hash))).toBe(false);
    });
});
