/**
 * StateMachine — Phase tracking, transition validation, state persistence.
 * State persists in .specs/.sdd-state.json.
 */

import { Phase, PHASE_ORDER, PHASE_REQUIRED_FILES, STATE_FILE, DEFAULT_SPEC_DIR } from "../constants.js";
import type { SddState, PhaseStatus, TransitionResult, GateDecision } from "../types.js";
import type { FileManager } from "./file-manager.js";
import { join } from "node:path";

export class StateMachine {
  constructor(private fileManager: FileManager) {}

  /**
   * Load state from .sdd-state.json, or return a default "not initialized" state.
   */
  async loadState(specDir: string = DEFAULT_SPEC_DIR): Promise<SddState> {
    const statePath = join(specDir, STATE_FILE);
    try {
      const raw = await this.fileManager.readProjectFile(statePath);
      return JSON.parse(raw) as SddState;
    } catch {
      return this.createDefaultState("");
    }
  }

  /**
   * Save state to .sdd-state.json.
   */
  async saveState(specDir: string, state: SddState): Promise<void> {
    const statePath = join(specDir, STATE_FILE);
    await this.fileManager.writeSpecFile(
      specDir,
      STATE_FILE,
      JSON.stringify(state, null, 2),
      true // always overwrite state file
    );
  }

  /**
   * Get current phase from persisted state.
   */
  async getCurrentPhase(specDir: string = DEFAULT_SPEC_DIR): Promise<Phase> {
    const state = await this.loadState(specDir);
    return state.current_phase;
  }

  /**
   * Check if transition to target phase is allowed.
   */
  async canTransition(specDir: string, targetPhase: Phase): Promise<TransitionResult> {
    const state = await this.loadState(specDir);
    const currentIndex = PHASE_ORDER.indexOf(state.current_phase);
    const targetIndex = PHASE_ORDER.indexOf(targetPhase);

    // Can only advance to the next phase
    if (targetIndex !== currentIndex + 1) {
      const nextPhase = currentIndex < PHASE_ORDER.length - 1
        ? PHASE_ORDER[currentIndex + 1]
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

    // Check required files for current phase
    const requiredFiles = PHASE_REQUIRED_FILES[state.current_phase];
    const missingFiles: string[] = [];

    for (const fileName of requiredFiles) {
      const featureDir = state.features[0];
      if (featureDir) {
        const exists = await this.fileManager.fileExists(join(featureDir, fileName));
        if (!exists) {
          missingFiles.push(fileName);
        }
      }
    }

    if (missingFiles.length > 0) {
      return {
        allowed: false,
        from_phase: state.current_phase,
        to_phase: targetPhase,
        missing_files: missingFiles,
        error_message: `Cannot advance: missing required files: ${missingFiles.join(", ")}`,
      };
    }

    return {
      allowed: true,
      from_phase: state.current_phase,
      to_phase: targetPhase,
    };
  }

  /**
   * Advance to the next phase. Validates prerequisites first.
   */
  async advancePhase(specDir: string, featureNumber: string): Promise<SddState> {
    const state = await this.loadState(specDir);
    const currentIndex = PHASE_ORDER.indexOf(state.current_phase);

    if (currentIndex >= PHASE_ORDER.length - 1) {
      throw new Error(`Already at terminal phase "${state.current_phase}". Pipeline is complete.`);
    }

    const nextPhase = PHASE_ORDER[currentIndex + 1];
    const transition = await this.canTransition(specDir, nextPhase);

    if (!transition.allowed) {
      throw new Error(transition.error_message || "Transition not allowed.");
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

    await this.saveState(specDir, state);
    return state;
  }

  /**
   * Record that a phase has started.
   */
  async recordPhaseStart(specDir: string, phase: Phase): Promise<void> {
    const state = await this.loadState(specDir);
    state.phases[phase] = {
      ...state.phases[phase],
      status: "in_progress",
      started_at: new Date().toISOString(),
    };
    state.current_phase = phase;
    await this.saveState(specDir, state);
  }

  /**
   * Record that a phase has completed.
   */
  async recordPhaseComplete(specDir: string, phase: Phase): Promise<void> {
    const state = await this.loadState(specDir);
    state.phases[phase] = {
      ...state.phases[phase],
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    await this.saveState(specDir, state);
  }

  /** Get required files for a given phase */
  getRequiredFiles(phase: Phase): string[] {
    return [...PHASE_REQUIRED_FILES[phase]];
  }

  /** Get phase order */
  getPhaseOrder(): Phase[] {
    return [...PHASE_ORDER];
  }

  /** Create a fresh state object */
  createDefaultState(projectName: string): SddState {
    const phases: Record<Phase, PhaseStatus> = {} as Record<Phase, PhaseStatus>;
    for (const phase of PHASE_ORDER) {
      phases[phase] = { status: "pending" };
    }
    return {
      version: "3.0.0",
      project_name: projectName,
      current_phase: Phase.Init,
      phases,
      features: [],
      amendments: [],
      gate_decision: null,
    };
  }
}
