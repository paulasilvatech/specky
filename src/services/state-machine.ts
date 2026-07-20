/**
 * StateMachine — Phase tracking, transition validation, state persistence.
 * State persists in each feature directory at .specs/<NNN-name>/.sdd-state.json.
 */

import { createHash, createHmac } from "node:crypto";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { PHASE_ORDER, PHASE_REQUIRED_FILES, Phase, STATE_FILE } from "../constants.js";
import { getToolContract } from "../contracts/tool-contracts.js";
import {
  assertUseCaseContractFingerprint,
  type ResolvedUseCaseContract,
  resolvedUseCaseContractSchema,
} from "../contracts/use-case.js";
import type {
  FeatureIdentity,
  GateHistoryEntry,
  PhaseStatus,
  SddState,
  TransitionResult,
} from "../types.js";
import { validateDesignCompleteness } from "./design-completeness.js";
import { SPECKY_SCAFFOLD_MARKER } from "./feature-package-generator.js";
import type { FileManager } from "./file-manager.js";

const SIG_FILE = ".sdd-state.json.sig";
const STATE_BAK_FILE = `${STATE_FILE}.bak`;
const SIG_BAK_FILE = `${SIG_FILE}.bak`;

/** True once the derived-key warning has been printed (process-wide dedupe). */
let derivedKeyWarningEmitted = false;

function normalizeFeatureDirectory(directory: string): string {
  return directory.replaceAll("\\", "/").replace(/^\.\//, "");
}

/** Phases whose completion requires explicit LGTM when pipeline.require_lgtm is enabled. */
const LGTM_GATE_PHASES = new Set<Phase>([Phase.Specify, Phase.Design, Phase.Tasks]);

const phaseSchema = z.enum([
  Phase.Init,
  Phase.Discover,
  Phase.Specify,
  Phase.Clarify,
  Phase.Design,
  Phase.Tasks,
  Phase.Analyze,
  Phase.Implement,
  Phase.Verify,
  Phase.Release,
]);

const phaseStatusSchema = z
  .object({
    status: z.enum(["pending", "in_progress", "completed"]),
    started_at: z.string().optional(),
    completed_at: z.string().optional(),
  })
  .strict();

const stateSchema = z
  .object({
    version: z.literal("5.0.0"),
    project_name: z.string().min(1),
    feature: z
      .object({
        number: z.string().regex(/^\d{3}$/),
        name: z.string().min(1),
        directory: z.string().min(1),
      })
      .strict(),
    contract: resolvedUseCaseContractSchema,
    current_phase: phaseSchema,
    phases: z.record(phaseSchema, phaseStatusSchema),
    amendments: z.array(
      z
        .object({
          number: z.number().int().positive(),
          date: z.string(),
          author: z.string(),
          rationale: z.string(),
          articles_affected: z.array(z.string()),
        })
        .strict(),
    ),
    gate_decision: z
      .object({
        decision: z.enum(["APPROVE", "CHANGES_NEEDED", "BLOCK"]),
        reasons: z.array(z.string()),
        coverage_percent: z.number(),
        gaps: z.array(z.string()),
        decided_at: z.string(),
      })
      .strict()
      .nullable(),
    gate_history: z
      .array(
        z
          .object({
            phase: z.string(),
            timestamp: z.string(),
            artifact: z.string(),
            was_modified: z.boolean(),
            req_count: z.number().optional(),
            lgtm: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    drift_history: z
      .array(
        z
          .object({
            timestamp: z.string(),
            score: z.number(),
            orphaned_count: z.number(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export class StateNotFoundError extends Error {
  constructor(stateDir: string) {
    super(`Feature state not found at ${join(stateDir, STATE_FILE)}`);
    this.name = "StateNotFoundError";
  }
}

export class StateMigrationRequiredError extends Error {
  constructor(stateDir: string, version: unknown) {
    const versionLabel = typeof version === "string" ? version : "unknown";
    super(
      `State at ${join(stateDir, STATE_FILE)} uses version ${versionLabel}; run specky migrate-contracts before invoking pipeline tools.`,
    );
    this.name = "StateMigrationRequiredError";
  }
}

export interface CreateFeatureStateInput {
  projectName: string;
  feature: FeatureIdentity;
  contract: ResolvedUseCaseContract;
}

/** Tools that require an APPROVE gate decision once the pipeline reaches Analyze. */
export const GATE_SENSITIVE_TOOLS = new Set([
  "sdd_implement",
  "sdd_generate_iac",
  "sdd_validate_iac",
  "sdd_generate_dockerfile",
  "sdd_setup_local_env",
  "sdd_setup_codespaces",
  "sdd_generate_devcontainer",
  "sdd_create_branch",
  "sdd_verify_tasks",
  "sdd_generate_tests",
  "sdd_verify_tests",
  "sdd_generate_pbt",
  "sdd_create_pr",
  "sdd_export_work_items",
  "sdd_generate_docs",
  "sdd_generate_api_docs",
  "sdd_generate_runbook",
  "sdd_generate_onboarding",
  "sdd_generate_all_docs",
]);

/**
 * GateHistoryEntry extended with the server-side LGTM approval flag.
 * `lgtm` records whether the caller passed lgtm:true on sdd_advance_phase —
 * recorded on every advance so gate history shows review presence, not just
 * artifact modification.
 */
export interface LgtmGateHistoryEntry extends GateHistoryEntry {
  lgtm?: boolean;
}

/** Optional instrumentation attached to a gate event. */
export interface GateEventOptions {
  reqCount?: number;
  lgtm?: boolean;
}

export class StateMachine {
  constructor(
    private fileManager: FileManager,
    private workspaceRoot: string = process.cwd(),
  ) {}

  /**
   * Per-workspace-and-spec-dir serialization queue. Tool handlers can run
   * concurrently (a client pipelines requests, or HTTP mode fields parallel
   * callers); without this, two load→mutate→save cycles interleave and the
   * last writer silently drops the other's change — and the state + signature
   * pair can be written torn, producing a false "tamper detected". Every
   * read-modify-write below runs inside withLock so those cycles are atomic.
   */
  private static readonly locks = new Map<string, Promise<unknown>>();

  private withLock<T>(specDir: string, fn: () => Promise<T>): Promise<T> {
    const key = resolve(this.workspaceRoot, specDir);
    const prev = StateMachine.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    // Keep the chain alive regardless of individual success/failure.
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    StateMachine.locks.set(key, tail);
    // Drop the entry once this key's queue drains so the map cannot grow
    // unboundedly; a newer queued operation replaces the tail, and only the
    // latest tail deletes the key.
    void tail.then(() => {
      if (StateMachine.locks.get(key) === tail) {
        StateMachine.locks.delete(key);
      }
    });
    return run;
  }

  /**
   * Run a state operation exclusively for this spec dir. Use when creating a
   * fresh state (sdd_init) where load-then-mutate is not the right shape.
   */
  async withStateLock<T>(specDir: string, fn: () => Promise<T>): Promise<T> {
    return this.withLock(specDir, fn);
  }

  /**
   * Atomically load state, apply a mutation, and persist it — the safe path
   * for tool handlers that need to touch state outside the phase helpers.
   */
  async mutateState(
    specDir: string,
    mutator: (state: SddState) => void | Promise<void>,
  ): Promise<SddState> {
    return this.withLock(specDir, async () => {
      const state = await this.loadState(specDir);
      await mutator(state);
      await this.saveState(specDir, state);
      return state;
    });
  }

  /** Derive a workspace-specific HMAC key when SDD_STATE_KEY is not set */
  private deriveKey(): string {
    if (!derivedKeyWarningEmitted) {
      derivedKeyWarningEmitted = true;
      console.error(
        "[specky] SDD_STATE_KEY is not set — signing feature state with a key derived from the workspace path. " +
          "Anyone with read access to the workspace can forge this signature; set SDD_STATE_KEY to a secret value for tamper-evident state.",
      );
    }
    return createHash("sha256").update(`specky-state-v1:${this.workspaceRoot}`).digest("hex");
  }

  /** Compute HMAC-SHA256 signature for state JSON */
  private computeSig(json: string): string {
    const key = process.env["SDD_STATE_KEY"] ?? this.deriveKey();
    return createHmac("sha256", key).update(json).digest("hex");
  }

  /**
   * Load and validate a signed v5 feature state.
   */
  async loadState(stateDir: string): Promise<SddState> {
    stateDir = normalizeFeatureDirectory(stateDir);
    const statePath = join(stateDir, STATE_FILE);
    let raw: string;
    try {
      raw = await this.fileManager.readProjectFile(statePath);
    } catch {
      throw new StateNotFoundError(stateDir);
    }

    let untrusted: unknown;
    try {
      untrusted = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in feature state at ${statePath}`);
    }
    const version =
      typeof untrusted === "object" && untrusted !== null
        ? (untrusted as Record<string, unknown>)["version"]
        : undefined;
    if (version !== "5.0.0") {
      throw new StateMigrationRequiredError(stateDir, version);
    }

    let storedSig: string;
    try {
      storedSig = await this.fileManager.readProjectFile(join(stateDir, SIG_FILE));
    } catch {
      return this.recoverFromBackup(
        stateDir,
        `Feature state signature not found at ${join(stateDir, SIG_FILE)}`,
      );
    }
    const expectedSig = this.computeSig(raw);
    if (storedSig.trim() !== expectedSig) {
      return this.recoverFromBackup(
        stateDir,
        `Feature state integrity check failed at ${statePath}`,
      );
    }

    const parsed = stateSchema.parse(untrusted) as SddState;
    if (
      normalizeFeatureDirectory(parsed.feature.directory) !== normalizeFeatureDirectory(stateDir)
    ) {
      throw new Error(
        `Feature state directory mismatch: state declares ${parsed.feature.directory}, loaded from ${stateDir}`,
      );
    }
    assertUseCaseContractFingerprint(parsed.contract);
    if (!parsed.contract.phases.includes(parsed.current_phase)) {
      throw new Error(
        `Current phase ${parsed.current_phase} is not enabled by contract ${parsed.contract.id}`,
      );
    }
    return parsed;
  }

  /**
   * Read a state/signature pair and verify its HMAC. Returns the raw state
   * JSON and trimmed signature when the pair verifies, null when either file
   * is missing or the signature does not match.
   */
  private async readVerifiedPair(
    stateDir: string,
    stateFileName: string,
    sigFileName: string,
  ): Promise<{ raw: string; sig: string } | null> {
    let raw: string;
    let sig: string;
    try {
      raw = await this.fileManager.readProjectFile(join(stateDir, stateFileName));
      sig = await this.fileManager.readProjectFile(join(stateDir, sigFileName));
    } catch {
      return null;
    }
    const trimmed = sig.trim();
    return trimmed === this.computeSig(raw) ? { raw, sig: trimmed } : null;
  }

  /**
   * Recover from a torn state pair — a crash between the state and signature
   * renames in saveState leaves a pair that can never verify, and without
   * recovery every later loadState fails. When the .bak snapshot written by
   * the previous saveState passes its own integrity check, restore it as the
   * live pair and continue from it; otherwise fail with manual recovery
   * instructions.
   */
  private async recoverFromBackup(stateDir: string, failure: string): Promise<SddState> {
    const backup = await this.readVerifiedPair(stateDir, STATE_BAK_FILE, SIG_BAK_FILE);
    if (!backup) {
      throw new Error(
        `${failure}. No valid backup pair (${STATE_BAK_FILE}/${SIG_BAK_FILE}) is available — the state may be torn from an interrupted save. ` +
          `Recover manually by restoring both ${STATE_FILE} and ${SIG_FILE} in ${stateDir} from version control or another verified copy, or delete the pair and re-initialize the feature.`,
      );
    }
    await this.fileManager.writeSpecFile(stateDir, STATE_FILE, backup.raw, true);
    await this.fileManager.writeSpecFile(stateDir, SIG_FILE, backup.sig, true);
    console.error(
      `[specky] ${failure}. Restored ${join(stateDir, STATE_FILE)} from the verified backup pair (${STATE_BAK_FILE}/${SIG_BAK_FILE}).`,
    );
    return this.loadState(stateDir);
  }

  /**
   * Save state to .sdd-state.json and write HMAC-SHA256 signature to .sdd-state.json.sig.
   */
  async saveState(stateDir: string, state: SddState): Promise<void> {
    stateDir = normalizeFeatureDirectory(stateDir);
    if (
      normalizeFeatureDirectory(state.feature.directory) !== normalizeFeatureDirectory(stateDir)
    ) {
      throw new Error(
        `Refusing to save feature ${state.feature.number} state outside ${state.feature.directory}`,
      );
    }
    assertUseCaseContractFingerprint(state.contract);
    const validated = stateSchema.parse(state) as SddState;
    const json = JSON.stringify(validated, null, 2);
    const sig = this.computeSig(json);
    // Snapshot the current pair to .bak siblings before overwriting, but only
    // when it still verifies — a corrupt backup fails its own integrity check
    // on recovery and is no better than none.
    const current = await this.readVerifiedPair(stateDir, STATE_FILE, SIG_FILE);
    if (current) {
      await this.fileManager.writeSpecFile(stateDir, STATE_BAK_FILE, current.raw, true);
      await this.fileManager.writeSpecFile(stateDir, SIG_BAK_FILE, current.sig, true);
    }
    // Each write is a temp file + rename; a crash between the two renames
    // leaves a torn pair that loadState recovers from the snapshot above.
    await this.fileManager.writeSpecFile(stateDir, STATE_FILE, json, true);
    await this.fileManager.writeSpecFile(stateDir, SIG_FILE, sig, true);
  }

  /**
   * Get current phase from persisted state.
   */
  async getCurrentPhase(stateDir: string): Promise<Phase> {
    const state = await this.loadState(stateDir);
    return state.current_phase;
  }

  /**
   * Check if transition to target phase is allowed.
   */
  async canTransition(stateDir: string, targetPhase: Phase): Promise<TransitionResult> {
    const state = await this.loadState(stateDir);
    const currentIndex = state.contract.phases.indexOf(state.current_phase);
    const targetIndex = state.contract.phases.indexOf(targetPhase);

    // Can only advance to the next phase
    if (targetIndex !== currentIndex + 1) {
      const nextPhase =
        currentIndex < state.contract.phases.length - 1
          ? state.contract.phases[currentIndex + 1]
          : undefined;
      return {
        allowed: false,
        from_phase: state.current_phase,
        to_phase: targetPhase,
        error_message: nextPhase
          ? `Cannot skip to "${targetPhase}". Next phase is "${nextPhase}".`
          : `Already at terminal phase "${state.current_phase}".`,
      };
    }

    const { missingFiles, scaffoldFiles } = await this.checkRequiredArtifacts(state);

    if (missingFiles.length > 0) {
      return {
        allowed: false,
        from_phase: state.current_phase,
        to_phase: targetPhase,
        missing_files: missingFiles,
        error_message: `Cannot advance: missing required files: ${missingFiles.join(", ")}`,
      };
    }

    if (scaffoldFiles.length > 0) {
      return {
        allowed: false,
        from_phase: state.current_phase,
        to_phase: targetPhase,
        missing_files: scaffoldFiles,
        error_message: `Cannot advance: scaffold artifacts must be completed first: ${scaffoldFiles.join(", ")}`,
      };
    }

    return {
      allowed: true,
      from_phase: state.current_phase,
      to_phase: targetPhase,
    };
  }

  /**
   * Mark all phases before targetPhase as completed when a downstream write-tool
   * runs without intermediate sdd_advance_phase calls (prevents orphan phases).
   */
  async ensurePhasesThrough(specDir: string, targetPhase: Phase): Promise<void> {
    await this.withLock(specDir, async () => {
      const state = await this.loadState(specDir);
      const targetIndex = PHASE_ORDER.indexOf(targetPhase);
      const now = new Date().toISOString();
      for (let i = 0; i < targetIndex; i++) {
        const phase = PHASE_ORDER[i];
        const current = state.phases[phase];
        if (current.status === "pending" || current.status === "in_progress") {
          state.phases[phase] = {
            ...current,
            status: "completed",
            started_at: current.started_at ?? now,
            completed_at: now,
          };
        }
      }
      await this.saveState(specDir, state);
    });
  }

  /** Clear a stale analysis gate after upstream artifacts are rewritten. */
  async invalidateGateDecision(specDir: string): Promise<void> {
    await this.mutateState(specDir, (state) => {
      state.gate_decision = null;
    });
  }

  /**
   * Block implement/verify/release tools until sdd_run_analysis records APPROVE.
   * Enforced centrally from tool-enforcement.ts for all gate-sensitive tools.
   */
  async validateGateForTool(
    specDir: string,
    toolName: string,
  ): Promise<{
    allowed: boolean;
    error_message?: string;
    gate_decision?: string | null;
  }> {
    if (!GATE_SENSITIVE_TOOLS.has(toolName)) {
      return { allowed: true };
    }

    const state = await this.loadState(specDir);
    const phaseIndex = PHASE_ORDER.indexOf(state.current_phase);
    const analyzeIndex = PHASE_ORDER.indexOf(Phase.Analyze);

    if (phaseIndex < analyzeIndex) {
      return { allowed: true };
    }

    if (state.gate_decision?.decision !== "APPROVE") {
      const decision = state.gate_decision?.decision ?? null;
      return {
        allowed: false,
        gate_decision: decision,
        error_message: decision
          ? `Gate decision is ${decision}. Address gaps and re-run sdd_run_analysis before invoking ${toolName}.`
          : `No APPROVE gate decision recorded. Run sdd_run_analysis before invoking ${toolName}.`,
      };
    }

    return { allowed: true };
  }

  private async checkRequiredArtifacts(state: SddState): Promise<{
    missingFiles: string[];
    scaffoldFiles: string[];
  }> {
    const requiredFiles = PHASE_REQUIRED_FILES[state.current_phase];
    const featureDir = state.feature.directory;

    const missingFiles: string[] = [];
    const scaffoldFiles: string[] = [];

    for (const fileName of requiredFiles) {
      const exists = await this.fileManager.fileExists(join(featureDir, fileName));
      if (!exists) {
        missingFiles.push(fileName);
        continue;
      }
      const isScaffold = await this.isScaffoldArtifact(featureDir, fileName);
      if (isScaffold) scaffoldFiles.push(fileName);
    }

    return { missingFiles, scaffoldFiles };
  }

  private async isScaffoldArtifact(featureDir: string, fileName: string): Promise<boolean> {
    if (fileName !== "DESIGN.md" && fileName !== "TASKS.md") return false;
    try {
      const content = await this.fileManager.readSpecFile(featureDir, fileName);
      return content.includes(SPECKY_SCAFFOLD_MARKER);
    } catch {
      return false;
    }
  }

  /**
   * Advance to the next phase. Validates prerequisites first.
   */
  async advancePhase(
    stateDir: string,
    options?: { lgtm?: boolean; requireLgtm?: boolean },
  ): Promise<SddState> {
    return this.withLock(stateDir, () => this._advancePhase(stateDir, options));
  }

  private async _advancePhase(
    stateDir: string,
    options?: { lgtm?: boolean; requireLgtm?: boolean },
  ): Promise<SddState> {
    const state = await this.loadState(stateDir);

    if (
      options?.requireLgtm &&
      LGTM_GATE_PHASES.has(state.current_phase) &&
      options.lgtm !== true
    ) {
      throw new Error(
        `Cannot advance: completing the "${state.current_phase}" phase is an LGTM quality gate and pipeline.require_lgtm is enabled. Pass lgtm: true after human review.`,
      );
    }

    const currentIndex = state.contract.phases.indexOf(state.current_phase);

    if (currentIndex >= state.contract.phases.length - 1) {
      throw new Error(`Already at terminal phase "${state.current_phase}". Pipeline is complete.`);
    }

    const nextPhase = state.contract.phases[currentIndex + 1];
    const transition = await this.canTransition(stateDir, nextPhase);

    if (!transition.allowed) {
      throw new Error(transition.error_message || "Transition not allowed.");
    }

    // Gate enforcement: cannot advance past Analyze without APPROVE
    if (state.current_phase === Phase.Analyze) {
      if (!state.gate_decision) {
        throw new Error(
          "Cannot advance past Analyze phase: no gate decision recorded. Run sdd_run_analysis first.",
        );
      }
      if (state.gate_decision.decision === "BLOCK") {
        throw new Error(
          `Gate decision is BLOCK. Reasons: ${state.gate_decision.reasons.join("; ")}. Gaps: ${state.gate_decision.gaps.join(", ")}. Address these before advancing.`,
        );
      }
      if (state.gate_decision.decision === "CHANGES_NEEDED") {
        throw new Error(
          `Gate decision is CHANGES_NEEDED. Gaps: ${state.gate_decision.gaps.join(", ")}. Address changes and re-run sdd_run_analysis.`,
        );
      }
    }

    // Mark current phase as completed
    state.phases[state.current_phase] = {
      ...state.phases[state.current_phase],
      status: "completed",
      completed_at: new Date().toISOString(),
    };

    // Advance to next phase
    state.current_phase = nextPhase;
    state.phases[nextPhase] = {
      status: "in_progress",
      started_at: new Date().toISOString(),
    };

    await this.saveState(stateDir, state);
    return state;
  }

  /**
   * Record that a phase has started.
   */
  async recordPhaseStart(specDir: string, phase: Phase): Promise<void> {
    await this.withLock(specDir, async () => {
      const state = await this.loadState(specDir);
      state.phases[phase] = {
        ...state.phases[phase],
        status: "in_progress",
        started_at: new Date().toISOString(),
      };
      state.current_phase = phase;
      await this.saveState(specDir, state);
    });
  }

  /**
   * Record that a phase has completed.
   */
  async recordPhaseComplete(specDir: string, phase: Phase): Promise<void> {
    await this.withLock(specDir, async () => {
      const state = await this.loadState(specDir);
      state.phases[phase] = {
        ...state.phases[phase],
        status: "completed",
        completed_at: new Date().toISOString(),
      };
      await this.saveState(specDir, state);
    });
  }

  /**
   * Record a gate instrumentation event on sdd_advance_phase.
   * Compares artifact mtime against phase start time to detect unmodified approvals.
   */
  async recordGateEvent(
    specDir: string,
    phase: Phase,
    artifactPath: string,
    options?: GateEventOptions,
  ): Promise<LgtmGateHistoryEntry> {
    return this.withLock(specDir, async () => {
      const state = await this.loadState(specDir);
      const phaseStatus = state.phases[phase];
      const phaseStarted = phaseStatus?.started_at;

      let wasModified = true;
      try {
        // Artifact paths are workspace-relative. Resolve against the workspace
        // root, NOT process.cwd(): in hosted/HTTP deployments the server cwd
        // is not the workspace, and a cwd-relative stat throws for every gate,
        // silently pinning was_modified=true so cognitive-debt warnings never
        // fire regardless of user behavior.
        const fileStat = await stat(resolve(this.workspaceRoot, artifactPath));
        if (phaseStarted) {
          wasModified = fileStat.mtimeMs > new Date(phaseStarted).getTime();
        }
      } catch {
        // file not found — treat as modified (first write)
      }

      const entry: LgtmGateHistoryEntry = {
        phase,
        timestamp: new Date().toISOString(),
        artifact: artifactPath,
        was_modified: wasModified,
        ...(options?.reqCount !== undefined ? { req_count: options.reqCount } : {}),
        ...(options?.lgtm !== undefined ? { lgtm: options.lgtm } : {}),
      };

      const history = state.gate_history ?? [];
      const MAX_ENTRIES = 1000;
      const updated = [...history, entry].slice(-MAX_ENTRIES);
      state.gate_history = updated;
      await this.saveState(specDir, state);

      return entry;
    });
  }

  /** Get required files for a given phase */
  getRequiredFiles(phase: Phase): string[] {
    return [...PHASE_REQUIRED_FILES[phase]];
  }

  /** Create a fresh state object for one explicitly identified feature and contract. */
  createFeatureState(input: CreateFeatureStateInput): SddState {
    assertUseCaseContractFingerprint(input.contract);
    const phases: Record<Phase, PhaseStatus> = {} as Record<Phase, PhaseStatus>;
    for (const phase of PHASE_ORDER) {
      phases[phase] = { status: "pending" };
    }
    return {
      version: "5.0.0",
      project_name: input.projectName,
      feature: { ...input.feature },
      contract: {
        ...input.contract,
        capabilities: [...input.contract.capabilities],
        capability_config: structuredClone(input.contract.capability_config),
        phases: [...input.contract.phases],
        required_discovery_artifacts: [...input.contract.required_discovery_artifacts],
        required_design_sections: [...input.contract.required_design_sections],
        required_diagrams: input.contract.required_diagrams.map((diagram) => ({ ...diagram })),
      },
      current_phase: input.contract.phases[0],
      phases,
      amendments: [],
      gate_decision: null,
    };
  }

  /**
   * Validate whether a tool is allowed to run in the current pipeline phase.
   * Read-only/utility tools are allowed in any phase. Phase-specific tools
   * are restricted to their mapped phases. Unknown tools are allowed for
   * forward compatibility.
   */
  async validatePhaseForTool(
    specDir: string,
    toolName: string,
  ): Promise<{
    allowed: boolean;
    current_phase: Phase;
    expected_phases: Phase[];
    error_message?: string;
  }> {
    const state = await this.loadState(specDir);
    const currentPhase = state.current_phase;
    const toolContract = getToolContract(toolName);
    const allowedPhases = toolContract.phases;

    if (allowedPhases === "any") {
      return {
        allowed: true,
        current_phase: currentPhase,
        expected_phases: [],
      };
    }

    const enabledPhases = allowedPhases.filter((phase) => state.contract.phases.includes(phase));
    if (enabledPhases.length === 0) {
      return {
        allowed: false,
        current_phase: currentPhase,
        expected_phases: [],
        error_message: `Tool "${toolName}" is disabled by use-case contract "${state.contract.id}".`,
      };
    }

    if (allowedPhases.includes(currentPhase)) {
      return {
        allowed: true,
        current_phase: currentPhase,
        expected_phases: [...allowedPhases],
      };
    }

    return {
      allowed: false,
      current_phase: currentPhase,
      expected_phases: [...allowedPhases],
      error_message: `Tool "${toolName}" is not allowed in phase "${currentPhase}". Allowed phases: ${allowedPhases.join(", ")}.`,
    };
  }

  /**
   * Validate the completeness of a DESIGN.md file by checking for
   * the presence of key architectural section headings.
   */
  async validateDesignCompleteness(featureDir: string): Promise<{
    score: number;
    total_sections: number;
    found_sections: string[];
    missing_sections: string[];
  }> {
    return validateDesignCompleteness(this.fileManager, featureDir);
  }
}
