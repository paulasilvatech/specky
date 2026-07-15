import { createHash, createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorkspaceConfig, serializeWorkspaceConfig, type SpeckyConfig } from "../../src/config.js";
import { resolveUseCaseContract, type Lifecycle, type Workload } from "../../src/contracts/use-case.js";
import type { GateDecision, SddState } from "../../src/types.js";

const PHASES = [
    "init", "discover", "specify", "clarify", "design",
    "tasks", "analyze", "implement", "verify", "release",
] as const;

export function writeTestWorkspaceConfig(
    workspace: string,
    mutate?: (config: SpeckyConfig) => void,
): void {
    const config = createWorkspaceConfig();
    mutate?.(config);
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    writeFileSync(resolve(workspace, ".specky/config.yml"), serializeWorkspaceConfig(config));
}

export function writeSignedFeatureState(
    workspace: string,
    options: {
        number: string;
        name: string;
        currentPhase: typeof PHASES[number];
        completed?: string[];
        lifecycle?: Lifecycle;
        workload?: Workload;
        gateDecision?: GateDecision | null;
    },
): string {
    const directory = `.specs/${options.number}-${options.name}`;
    const contract = resolveUseCaseContract({
        lifecycle: options.lifecycle ?? "greenfield",
        workload: options.workload ?? "service",
        execution_mode: "full",
        capabilities: [],
        capability_config: {},
    });
    const completed = new Set(options.completed ?? []);
    const phases = Object.fromEntries(PHASES.map((phase) => {
        let status: "pending" | "in_progress" | "completed" = "pending";
        if (completed.has(phase)) status = "completed";
        else if (phase === options.currentPhase) status = "in_progress";
        return [phase, { status }];
    })) as SddState["phases"];
    const state: SddState = {
        version: "5.0.0",
        project_name: options.name,
        feature: { number: options.number, name: options.name, directory },
        contract,
        current_phase: options.currentPhase,
        phases,
        amendments: [],
        gate_decision: options.gateDecision ?? null,
    };
    const raw = JSON.stringify(state, null, 2);
    const key = process.env["SDD_STATE_KEY"]
        ?? createHash("sha256").update(`specky-state-v1:${workspace}`).digest("hex");
    mkdirSync(resolve(workspace, directory), { recursive: true });
    writeFileSync(resolve(workspace, directory, ".sdd-state.json"), raw);
    writeFileSync(
        resolve(workspace, directory, ".sdd-state.json.sig"),
        createHmac("sha256", key).update(raw).digest("hex"),
    );
    return directory;
}
