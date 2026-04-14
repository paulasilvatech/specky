/**
 * StateMachine — Phase tracking, transition validation, state persistence.
 * State persists in .specs/.sdd-state.json.
 */

import { Phase, PHASE_ORDER, PHASE_REQUIRED_FILES, STATE_FILE, DEFAULT_SPEC_DIR } from "../constants.js";
import type { SddState, PhaseStatus, TransitionResult, GateHistoryEntry } from "../types.js";
import type { FileManager } from "./file-manager.js";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { createHmac, createHash } from "node:crypto";

const SIG_FILE = ".sdd-state.json.sig";

export class StateMachine {
  constructor(
    private fileManager: FileManager,
    private workspaceRoot: string = process.cwd(),
  ) {}

  /** Derive a workspace-specific HMAC key when SDD_STATE_KEY is not set */
  private deriveKey(): string {
    return createHash("sha256")
      .update(`specky-state-v1:${this.workspaceRoot}`)
      .digest("hex");
  }

  /** Compute HMAC-SHA256 signature for state JSON */
  private computeSig(json: string): string {
    const key = process.env["SDD_STATE_KEY"] ?? this.deriveKey();
    return createHmac("sha256", key).update(json).digest("hex");
  }

  /**
   * Load state from .sdd-state.json, or return a default "not initialized" state.
   * Verifies HMAC signature if .sdd-state.json.sig exists.
   * A missing .sig file is treated as unverified (no tamper_warning).
   * A mismatched .sig file logs a tamper warning to stderr.
   */
  async loadState(specDir: string = DEFAULT_SPEC_DIR): Promise<SddState> {
    const statePath = join(specDir, STATE_FILE);
    try {
      const raw = await this.fileManager.readProjectFile(statePath);

      // Verify signature if .sig file exists
      try {
        const storedSig = await this.fileManager.readProjectFile(join(specDir, SIG_FILE));
        const expectedSig = this.computeSig(raw);
        if (storedSig.trim() !== expectedSig) {
          console.error("[specky] WARNING: State file tamper detected — .sdd-state.json signature mismatch.");
        }
      } catch {
        // .sig not found — first write or pre-v3.2.0 state — skip verification silently
      }

      const parsed = JSON.parse(raw) as SddState;

      // v1 → v2 migration: add missing phases for 10-phase pipeline
      if (parsed.version === "3.0.0" || !parsed.phases["implement"]) {
        for (const phase of PHASE_ORDER) {
          if (!(phase in parsed.phases)) {
            parsed.phases[phase] = { status: "pending" };
          }
        }
        parsed.version = "4.0.0";
        await this.fileManager.writeSpecFile(
          specDir,
          STATE_FILE,
          JSON.stringify(parsed, null, 2),
          true
        );
      }

      return parsed;
    } catch {
      return this.createDefaultState("");
    }
  }

  /**
   * Save state to .sdd-state.json and write HMAC-SHA256 signature to .sdd-state.json.sig.
   */
  async saveState(specDir: string, state: SddState): Promise<void> {
    const json = JSON.stringify(state, null, 2);
    await this.fileManager.writeSpecFile(specDir, STATE_FILE, json, true);
    // Write tamper-detection signature
    const sig = this.computeSig(json);
    await this.fileManager.writeSpecFile(specDir, SIG_FILE, sig, true);
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
  async advancePhase(specDir: string, _featureNumber: string): Promise<SddState> {
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

    // Gate enforcement: cannot advance past Analyze without APPROVE
    if (state.current_phase === Phase.Analyze) {
      if (!state.gate_decision) {
        throw new Error(
          "Cannot advance past Analyze phase: no gate decision recorded. Run sdd_run_analysis first."
        );
      }
      if (state.gate_decision.decision === "BLOCK") {
        throw new Error(
          `Gate decision is BLOCK. Reasons: ${state.gate_decision.reasons.join("; ")}. Gaps: ${state.gate_decision.gaps.join(", ")}. Address these before advancing.`
        );
      }
      if (state.gate_decision.decision === "CHANGES_NEEDED") {
        throw new Error(
          `Gate decision is CHANGES_NEEDED. Gaps: ${state.gate_decision.gaps.join(", ")}. Address changes and re-run sdd_run_analysis.`
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

  /**
   * Record a gate instrumentation event on sdd_advance_phase.
   * Compares artifact mtime against phase start time to detect unmodified approvals.
   */
  async recordGateEvent(
    specDir: string,
    phase: Phase,
    artifactPath: string,
    reqCount?: number,
  ): Promise<GateHistoryEntry> {
    const state = await this.loadState(specDir);
    const phaseStatus = state.phases[phase];
    const phaseStarted = phaseStatus?.started_at;

    let wasModified = true;
    try {
      const fileStat = await stat(artifactPath);
      if (phaseStarted) {
        wasModified = fileStat.mtimeMs > new Date(phaseStarted).getTime();
      }
    } catch {
      // file not found — treat as modified (first write)
    }

    const entry: GateHistoryEntry = {
      phase,
      timestamp: new Date().toISOString(),
      artifact: artifactPath,
      was_modified: wasModified,
      ...(reqCount !== undefined ? { req_count: reqCount } : {}),
    };

    const history = state.gate_history ?? [];
    const MAX_ENTRIES = 1000;
    const updated = [...history, entry].slice(-MAX_ENTRIES);
    state.gate_history = updated;
    await this.saveState(specDir, state);

    return entry;
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
      version: "4.0.0",
      project_name: projectName,
      current_phase: Phase.Init,
      phases,
      features: [],
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
  async validatePhaseForTool(specDir: string, toolName: string): Promise<{
    allowed: boolean;
    current_phase: Phase;
    expected_phases: Phase[];
    error_message?: string;
  }> {
    const TOOL_PHASE_MAP: Record<string, Phase[]> = {
      // Read-only / utility tools — allowed in ANY phase (empty array = any)
      sdd_get_status: [],
      sdd_get_template: [],
      sdd_scan_codebase: [],
      sdd_check_sync: [],
      sdd_generate_diagram: [],
      sdd_generate_all_diagrams: [],
      sdd_generate_user_stories: [],
      sdd_figma_diagram: [],
      sdd_validate_ears: [],
      sdd_checkpoint: [],
      sdd_restore: [],
      sdd_list_checkpoints: [],
      sdd_check_ecosystem: [],
      sdd_metrics: [],
      sdd_research: [],

      // Special tools — allowed in any phase
      sdd_advance_phase: [],
      sdd_write_bugfix: [],
      sdd_amend: [],
      sdd_auto_pipeline: [],

      // Phase-specific tools
      sdd_init: [Phase.Init],
      sdd_discover: [Phase.Init, Phase.Discover],
      sdd_write_spec: [Phase.Discover, Phase.Specify],
      sdd_import_transcript: [Phase.Discover, Phase.Specify],
      sdd_import_document: [Phase.Discover, Phase.Specify],
      sdd_batch_import: [Phase.Discover, Phase.Specify],
      sdd_figma_to_spec: [Phase.Discover, Phase.Specify],
      sdd_batch_transcripts: [Phase.Discover, Phase.Specify],
      sdd_turnkey_spec: [Phase.Discover, Phase.Specify],
      sdd_clarify: [Phase.Specify, Phase.Clarify],
      sdd_write_design: [Phase.Clarify, Phase.Design],
      sdd_write_tasks: [Phase.Design, Phase.Tasks],
      sdd_run_analysis: [Phase.Tasks, Phase.Analyze],
      sdd_cross_analyze: [Phase.Tasks, Phase.Analyze],
      sdd_compliance_check: [Phase.Tasks, Phase.Analyze],
      sdd_checklist: [Phase.Tasks, Phase.Analyze],
      sdd_implement: [Phase.Analyze, Phase.Implement],
      sdd_generate_iac: [Phase.Analyze, Phase.Implement],
      sdd_validate_iac: [Phase.Analyze, Phase.Implement],
      sdd_generate_dockerfile: [Phase.Analyze, Phase.Implement],
      sdd_setup_local_env: [Phase.Analyze, Phase.Implement],
      sdd_setup_codespaces: [Phase.Analyze, Phase.Implement],
      sdd_generate_devcontainer: [Phase.Analyze, Phase.Implement],
      sdd_create_branch: [Phase.Analyze, Phase.Implement],
      sdd_verify_tasks: [Phase.Implement, Phase.Verify],
      sdd_generate_tests: [Phase.Implement, Phase.Verify],
      sdd_verify_tests: [Phase.Implement, Phase.Verify],
      sdd_generate_pbt: [Phase.Implement, Phase.Verify],
      sdd_create_pr: [Phase.Verify, Phase.Release],
      sdd_export_work_items: [Phase.Verify, Phase.Release],
      sdd_generate_docs: [Phase.Verify, Phase.Release],
      sdd_generate_api_docs: [Phase.Verify, Phase.Release],
      sdd_generate_runbook: [Phase.Verify, Phase.Release],
      sdd_generate_onboarding: [Phase.Verify, Phase.Release],
      sdd_generate_all_docs: [Phase.Verify, Phase.Release],
    } as const;

    const state = await this.loadState(specDir);
    const currentPhase = state.current_phase;

    // Unknown tools are allowed (forward compatibility)
    if (!(toolName in TOOL_PHASE_MAP)) {
      return {
        allowed: true,
        current_phase: currentPhase,
        expected_phases: [],
      };
    }

    const allowedPhases = TOOL_PHASE_MAP[toolName];

    // Empty array means allowed in any phase
    if (allowedPhases.length === 0) {
      return {
        allowed: true,
        current_phase: currentPhase,
        expected_phases: [],
      };
    }

    if (allowedPhases.includes(currentPhase)) {
      return {
        allowed: true,
        current_phase: currentPhase,
        expected_phases: allowedPhases,
      };
    }

    return {
      allowed: false,
      current_phase: currentPhase,
      expected_phases: allowedPhases,
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
    const DESIGN_SECTIONS: { name: string; patterns: string[] }[] = [
      { name: "System Context", patterns: ["system context", "c4 level 1", "context"] },
      { name: "Container", patterns: ["container", "c4 level 2"] },
      { name: "Component", patterns: ["component", "c4 level 3"] },
      { name: "Data Model", patterns: ["data model", "data", "entity"] },
      { name: "API Contract", patterns: ["api contract", "api", "endpoint"] },
      { name: "Infrastructure", patterns: ["infrastructure", "deployment"] },
      { name: "Security", patterns: ["security", "authentication", "authorization"] },
      { name: "Architecture Decision", patterns: ["architecture decision", "adr"] },
      { name: "Error Handling", patterns: ["error handling", "error"] },
      { name: "Diagrams", patterns: ["diagrams", "system diagrams"] },
      { name: "Cross-Cutting", patterns: ["cross-cutting", "logging", "monitoring"] },
      { name: "Code-Level", patterns: ["code-level", "class", "interface"] },
    ];

    let content: string;
    try {
      content = await this.fileManager.readSpecFile(featureDir, "DESIGN.md");
    } catch {
      return {
        score: 0,
        total_sections: DESIGN_SECTIONS.length,
        found_sections: [],
        missing_sections: DESIGN_SECTIONS.map((s) => s.name),
      };
    }

    const contentLower = content.toLowerCase();
    const foundSections: string[] = [];
    const missingSections: string[] = [];

    for (const section of DESIGN_SECTIONS) {
      const found = section.patterns.some((pattern) => contentLower.includes(pattern));
      if (found) {
        foundSections.push(section.name);
      } else {
        missingSections.push(section.name);
      }
    }

    const totalSections = DESIGN_SECTIONS.length;
    const score = totalSections > 0
      ? Math.round((foundSections.length / totalSections) * 100)
      : 0;

    return {
      score,
      total_sections: totalSections,
      found_sections: foundSections,
      missing_sections: missingSections,
    };
  }
}
