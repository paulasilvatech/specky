import { createHash } from "node:crypto";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Phase, STATE_FILE } from "../../constants.js";
import {
    resolveUseCaseContract,
    useCaseSelectionSchema,
    type UseCaseSelection,
} from "../../contracts/use-case.js";
import { FileManager } from "../../services/file-manager.js";
import { StateMachine } from "../../services/state-machine.js";
import type { SddState } from "../../types.js";

const SIG_FILE = ".sdd-state.json.sig";

export interface MigrateContractsOptions {
    workspace?: string;
    specDir: string;
    dryRun: boolean;
    apply: boolean;
    confirmPlan?: string;
    mappingFile?: string;
    lifecycle?: string;
    workload?: string;
    executionMode?: string;
    capabilities?: string;
    capabilityConfigFile?: string;
}

interface MigrationEntry {
    feature_number: string;
    feature_name: string;
    feature_dir: string;
    source_state: string;
    source_version: string;
    contract_id: string;
    contract_fingerprint: string;
    action: "migrate" | "skip";
}

interface MigrationPlan {
    version: 1;
    workspace: string;
    spec_dir: string;
    entries: MigrationEntry[];
    errors: string[];
    artifact_hashes: Record<string, string>;
}

interface FileSnapshot {
    path: string;
    existed: boolean;
    content?: Buffer;
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (typeof value !== "object" || value === null) return value;
    return Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .reduce<Record<string, unknown>>((result, key) => {
            result[key] = canonicalize((value as Record<string, unknown>)[key]);
            return result;
        }, {});
}

function hashValue(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function hashFile(path: string): string {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectArtifactHashes(root: string): Record<string, string> {
    if (!existsSync(root)) return {};
    const hashes: Record<string, string> = {};
    const visit = (directory: string): void => {
        const entries = readdirSync(directory, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(path);
            } else if (entry.name !== STATE_FILE && entry.name !== SIG_FILE) {
                hashes[relative(root, path)] = hashFile(path);
            }
        }
    };
    visit(root);
    return hashes;
}

function parseJson(path: string): unknown {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Cannot parse ${path}: ${(error as Error).message}`);
    }
}

function readVersion(value: unknown): string {
    if (typeof value !== "object" || value === null) return "unknown";
    const version = (value as Record<string, unknown>)["version"];
    return typeof version === "string" ? version : "unknown";
}

function loadMappings(
    options: MigrateContractsOptions,
    featureCount: number,
): Record<string, UseCaseSelection> {
    const workspace = resolve(options.workspace ?? process.cwd());
    if (options.mappingFile) {
        const mappingPath = resolve(workspace, options.mappingFile);
        const parsed = parseJson(mappingPath) as { features?: unknown };
        if (typeof parsed.features !== "object" || parsed.features === null) {
            throw new Error(`Mapping file ${mappingPath} must contain a features object.`);
        }
        return Object.fromEntries(
            Object.entries(parsed.features).map(([number, selection]) => [
                number,
                useCaseSelectionSchema.parse(selection),
            ]),
        );
    }

    if (featureCount !== 1) {
        throw new Error("Multiple features require --mapping=<json> with one explicit use-case selection per feature number.");
    }
    if (!options.lifecycle || !options.workload || !options.executionMode) {
        throw new Error("Single-feature migration requires --lifecycle, --workload, and --execution-mode.");
    }
    const capabilities = options.capabilities
        ? options.capabilities.split(",").map((item) => item.trim()).filter(Boolean)
        : [];
    if (capabilities.length > 0 && !options.capabilityConfigFile) {
        throw new Error("Enabled capabilities require --capability-config=<json>.");
    }
    const capabilityConfig = options.capabilityConfigFile
        ? parseJson(resolve(workspace, options.capabilityConfigFile))
        : {};
    return {
        "*": useCaseSelectionSchema.parse({
            lifecycle: options.lifecycle,
            workload: options.workload,
            execution_mode: options.executionMode,
            capabilities,
            capability_config: capabilityConfig,
        }),
    };
}

function featureDirectories(specRoot: string): Array<{ number: string; name: string; directory: string }> {
    if (!existsSync(specRoot)) return [];
    return readdirSync(specRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{3}-.+/.test(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
            const match = /^(\d{3})-(.+)$/.exec(entry.name)!;
            return { number: match[1], name: match[2], directory: entry.name };
        });
}

function planFeature(
    workspace: string,
    specDir: string,
    feature: { number: string; name: string; directory: string },
    featureCount: number,
    mappings: Record<string, UseCaseSelection>,
): MigrationEntry | string {
    const featureDir = join(specDir, feature.directory);
    const featureStatePath = join(workspace, featureDir, STATE_FILE);
    const rootStatePath = join(workspace, specDir, STATE_FILE);
    let sourcePath = featureStatePath;
    if (!existsSync(sourcePath)) {
        if (featureCount !== 1 || !existsSync(rootStatePath)) {
            return `Feature ${feature.number} has no state and root state cannot be assigned unambiguously.`;
        }
        sourcePath = rootStatePath;
    }

    const source = parseJson(sourcePath) as Record<string, unknown>;
    const sourceVersion = readVersion(source);
    if (sourceVersion === "5.0.0" && sourcePath === featureStatePath) {
        const state = source as unknown as SddState;
        return {
            feature_number: feature.number,
            feature_name: feature.name,
            feature_dir: featureDir,
            source_state: relative(workspace, sourcePath),
            source_version: sourceVersion,
            contract_id: state.contract?.id ?? "invalid",
            contract_fingerprint: state.contract?.fingerprint ?? "invalid",
            action: "skip",
        };
    }

    const selection = mappings[feature.number] ?? mappings["*"];
    if (!selection) return `Mapping does not define feature ${feature.number}.`;
    const contract = resolveUseCaseContract(selection);
    const currentPhase = source["current_phase"];
    if (typeof currentPhase === "string" && !contract.phases.includes(currentPhase as Phase)) {
        return `Feature ${feature.number} phase ${currentPhase} is not enabled by ${contract.id}.`;
    }
    return {
        feature_number: feature.number,
        feature_name: feature.name,
        feature_dir: featureDir,
        source_state: relative(workspace, sourcePath),
        source_version: sourceVersion,
        contract_id: contract.id,
        contract_fingerprint: contract.fingerprint,
        action: "migrate",
    };
}

function buildPlan(options: MigrateContractsOptions): MigrationPlan {
    const workspace = resolve(options.workspace ?? process.cwd());
    const specRoot = resolve(workspace, options.specDir);
    const features = featureDirectories(specRoot);
    const mappings = loadMappings(options, features.length);
    const errors: string[] = [];
    const entries: MigrationEntry[] = [];

    if (features.length === 0) errors.push(`No feature directories found in ${options.specDir}.`);
    for (const feature of features) {
        const planned = planFeature(workspace, options.specDir, feature, features.length, mappings);
        if (typeof planned === "string") errors.push(planned);
        else entries.push(planned);
    }

    return {
        version: 1,
        workspace,
        spec_dir: options.specDir,
        entries,
        errors,
        artifact_hashes: collectArtifactHashes(specRoot),
    };
}

function snapshot(path: string): FileSnapshot {
    return existsSync(path)
        ? { path, existed: true, content: readFileSync(path) }
        : { path, existed: false };
}

function restore(file: FileSnapshot): void {
    if (file.existed) {
        mkdirSync(dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content!);
    } else if (existsSync(file.path)) {
        unlinkSync(file.path);
    }
}

function copyLegacyPhases(
    state: SddState,
    source: Record<string, unknown>,
): void {
    const legacyPhases = source["phases"];
    if (typeof legacyPhases !== "object" || legacyPhases === null) return;
    for (const phase of state.contract.phases) {
        const candidate = (legacyPhases as Record<string, unknown>)[phase];
        if (typeof candidate !== "object" || candidate === null) continue;
        const record = candidate as Record<string, unknown>;
        const status = record["status"];
        if (status !== "pending" && status !== "in_progress" && status !== "completed") continue;
        state.phases[phase] = {
            status,
            ...(typeof record["started_at"] === "string" ? { started_at: record["started_at"] } : {}),
            ...(typeof record["completed_at"] === "string" ? { completed_at: record["completed_at"] } : {}),
        };
    }
}

function toFeatureState(
    stateMachine: StateMachine,
    workspace: string,
    entry: MigrationEntry,
    selection: UseCaseSelection,
): SddState {
    const source = parseJson(join(workspace, entry.source_state)) as Record<string, unknown>;
    const contract = resolveUseCaseContract(selection);
    const state = stateMachine.createFeatureState({
        projectName: typeof source["project_name"] === "string" ? source["project_name"] : entry.feature_name,
        feature: {
            number: entry.feature_number,
            name: entry.feature_name,
            directory: entry.feature_dir,
        },
        contract,
    });

    const currentPhase = source["current_phase"];
    if (typeof currentPhase === "string" && contract.phases.includes(currentPhase as Phase)) {
        state.current_phase = currentPhase as Phase;
    }
    copyLegacyPhases(state, source);
    if (Array.isArray(source["amendments"])) state.amendments = source["amendments"] as SddState["amendments"];
    if (source["gate_decision"] !== undefined) state.gate_decision = source["gate_decision"] as SddState["gate_decision"];
    if (Array.isArray(source["gate_history"])) state.gate_history = source["gate_history"] as SddState["gate_history"];
    if (Array.isArray(source["drift_history"])) state.drift_history = source["drift_history"] as SddState["drift_history"];
    return state;
}

async function applyEntry(
    entry: MigrationEntry,
    plan: MigrationPlan,
    mappings: Record<string, UseCaseSelection>,
    stateMachine: StateMachine,
    backupRoot: string,
    snapshots: FileSnapshot[],
): Promise<void> {
    const targetState = join(plan.workspace, entry.feature_dir, STATE_FILE);
    const targetSig = join(plan.workspace, entry.feature_dir, SIG_FILE);
    const sourceState = join(plan.workspace, entry.source_state);
    const sourceSig = join(dirname(sourceState), SIG_FILE);
    for (const path of new Set([targetState, targetSig, sourceState, sourceSig])) {
        const file = snapshot(path);
        snapshots.push(file);
        if (!file.existed) continue;
        const backupName = createHash("sha256").update(relative(plan.workspace, path)).digest("hex");
        copyFileSync(path, join(backupRoot, `${backupName}-${basename(path)}`));
    }

    const selection = mappings[entry.feature_number] ?? mappings["*"];
    await stateMachine.saveState(
        entry.feature_dir,
        toFeatureState(stateMachine, plan.workspace, entry, selection),
    );
    await stateMachine.loadState(entry.feature_dir);
}

async function applyPlan(
    options: MigrateContractsOptions,
    plan: MigrationPlan,
    hash: string,
): Promise<string> {
    const mappings = loadMappings(options, plan.entries.length);
    const fileManager = new FileManager(plan.workspace);
    const stateMachine = new StateMachine(fileManager, plan.workspace);
    const backupRoot = join(plan.workspace, ".specky", "migrations", hash);
    mkdirSync(backupRoot, { recursive: true });
    writeFileSync(join(backupRoot, "plan.json"), JSON.stringify({ ...plan, plan_hash: hash }, null, 2));
    const snapshots: FileSnapshot[] = [];

    try {
        const migrations = plan.entries.filter((entry) => entry.action === "migrate");
        for (const entry of migrations) {
            await applyEntry(entry, plan, mappings, stateMachine, backupRoot, snapshots);
        }

        const afterHashes = collectArtifactHashes(resolve(plan.workspace, plan.spec_dir));
        if (JSON.stringify(afterHashes) !== JSON.stringify(plan.artifact_hashes)) {
            throw new Error("Artifact hash verification failed: non-state content changed during migration.");
        }

        const rootState = join(plan.workspace, plan.spec_dir, STATE_FILE);
        const rootSig = join(plan.workspace, plan.spec_dir, SIG_FILE);
        const usedRootState = plan.entries.some(
            (entry) => resolve(plan.workspace, entry.source_state) === rootState,
        );
        if (usedRootState && existsSync(rootState)) unlinkSync(rootState);
        if (usedRootState && existsSync(rootSig)) unlinkSync(rootSig);
        return backupRoot;
    } catch (error) {
        const rollbackOrder = [...snapshots];
        rollbackOrder.reverse();
        for (const file of rollbackOrder) restore(file);
        rmSync(backupRoot, { recursive: true, force: true });
        throw error;
    }
}

export async function runMigrateContracts(options: MigrateContractsOptions): Promise<number> {
    if (options.dryRun === options.apply) throw new Error("Choose exactly one of --dry-run or --apply.");

    const plan = buildPlan(options);
    const hash = hashValue(plan);
    console.log(JSON.stringify({ ...plan, plan_hash: hash }, null, 2));
    if (plan.errors.length > 0) return 1;
    if (options.dryRun) {
        console.log(`Review this plan, then run --apply --confirm-plan=${hash} with identical inputs.`);
        return 0;
    }
    if (options.confirmPlan !== hash) {
        throw new Error(`Plan confirmation mismatch. Run --dry-run and pass --confirm-plan=${hash}.`);
    }
    const backupRoot = await applyPlan(options, plan, hash);
    console.log(`Migration applied successfully. Backup: ${relative(plan.workspace, backupRoot)}`);
    return 0;
}
