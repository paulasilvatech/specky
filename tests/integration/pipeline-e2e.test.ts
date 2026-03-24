/**
 * Pipeline E2E Integration Test
 * Uses real FileManager with temp directories — no mocks.
 * Validates: sdd_init → advance → write_spec → advance → write_design → advance → write_tasks
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { Phase } from "../../src/constants.js";

let tempDir: string;
let fm: FileManager;
let sm: StateMachine;
let te: TemplateEngine;

const SPEC_DIR = ".specs";
const PROJECT = "test-project";
const FEATURE_DIR = ".specs/001-test-project";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "specky-e2e-"));
  fm = new FileManager(tempDir);
  sm = new StateMachine(fm);
  te = new TemplateEngine(fm);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("Pipeline E2E", () => {
  // ── Init phase ─────────────────────────────────────────────────────────

  it("sdd_init creates CONSTITUTION.md and state file", async () => {
    // Create spec dir and feature dir
    await fm.ensureSpecDir(SPEC_DIR);

    // Render constitution template
    const content = await te.renderWithFrontmatter("constitution", {
      title: `${PROJECT} — Constitution`,
      feature_id: `001-${PROJECT}`,
      project_name: PROJECT,
      author: "SDD Pipeline",
      principles: ["Simplicity", "Traceability"],
      constraints: ["No external deps"],
      description: `Charter for ${PROJECT}`,
      license: "MIT",
      scope_in: "Core features",
      scope_out: "Future enhancements",
    });

    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", content);

    // Initialize state
    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.phases[Phase.Init] = { status: "completed", started_at: new Date().toISOString(), completed_at: new Date().toISOString() };
    await sm.saveState(SPEC_DIR, state);

    // Verify files exist
    const constitutionExists = await fm.fileExists(join(FEATURE_DIR, "CONSTITUTION.md"));
    expect(constitutionExists).toBe(true);

    const constitutionContent = await fm.readSpecFile(FEATURE_DIR, "CONSTITUTION.md");
    expect(constitutionContent).toContain(PROJECT);

    // Verify state
    const loadedState = await sm.loadState(SPEC_DIR);
    expect(loadedState.current_phase).toBe(Phase.Init);
    expect(loadedState.features).toContain(FEATURE_DIR);
    expect(loadedState.phases[Phase.Init].status).toBe("completed");
  });

  // ── Phase advancement ──────────────────────────────────────────────────

  it("advances from Init → Discover when CONSTITUTION.md exists", async () => {
    // Setup: init phase completed
    await fm.ensureSpecDir(SPEC_DIR);
    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", "# Constitution\nTest project.", true);

    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.phases[Phase.Init] = { status: "completed" };
    await sm.saveState(SPEC_DIR, state);

    // Advance
    const newState = await sm.advancePhase(SPEC_DIR, "001");
    expect(newState.current_phase).toBe(Phase.Discover);
    expect(newState.phases[Phase.Init].status).toBe("completed");
    expect(newState.phases[Phase.Discover].status).toBe("in_progress");
  });

  it("advances from Discover → Specify (no required files for Discover)", async () => {
    await fm.ensureSpecDir(SPEC_DIR);
    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", "# Constitution", true);

    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.current_phase = Phase.Discover;
    state.phases[Phase.Init] = { status: "completed" };
    state.phases[Phase.Discover] = { status: "in_progress" };
    await sm.saveState(SPEC_DIR, state);

    const newState = await sm.advancePhase(SPEC_DIR, "001");
    expect(newState.current_phase).toBe(Phase.Specify);
  });

  // ── Phase blocking ─────────────────────────────────────────────────────

  it("blocks advancement when required file is missing", async () => {
    await fm.ensureSpecDir(SPEC_DIR);
    // Specify phase requires SPECIFICATION.md — don't create it

    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.current_phase = Phase.Specify;
    state.phases[Phase.Init] = { status: "completed" };
    state.phases[Phase.Discover] = { status: "completed" };
    state.phases[Phase.Specify] = { status: "in_progress" };
    await sm.saveState(SPEC_DIR, state);

    // Should throw because SPECIFICATION.md doesn't exist
    await expect(sm.advancePhase(SPEC_DIR, "001")).rejects.toThrow(/missing/i);
  });

  it("blocks skipping phases (Init → Design)", async () => {
    await fm.ensureSpecDir(SPEC_DIR);
    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", "# Constitution", true);

    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.phases[Phase.Init] = { status: "completed" };
    await sm.saveState(SPEC_DIR, state);

    // canTransition from Init directly to Design should fail
    const result = await sm.canTransition(SPEC_DIR, Phase.Design);
    expect(result.allowed).toBe(false);
    expect(result.error_message).toContain("skip");
  });

  // ── Full pipeline flow ─────────────────────────────────────────────────

  it("runs Init → Discover → Specify → Clarify → Design → Tasks (6 phases)", async () => {
    await fm.ensureSpecDir(SPEC_DIR);

    // Phase 1: Init — create constitution
    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", "# Constitution\nProject charter.", true);
    const initState = sm.createDefaultState(PROJECT);
    initState.features = [FEATURE_DIR];
    initState.phases[Phase.Init] = { status: "completed" };
    await sm.saveState(SPEC_DIR, initState);

    // Phase 2: Init → Discover
    let state = await sm.advancePhase(SPEC_DIR, "001");
    expect(state.current_phase).toBe(Phase.Discover);

    // Phase 3: Discover → Specify (no required files for Discover)
    state = await sm.advancePhase(SPEC_DIR, "001");
    expect(state.current_phase).toBe(Phase.Specify);

    // Write SPECIFICATION.md so we can advance past Specify
    const specContent = "# SPECIFICATION\n\n## REQ-001\nThe system shall authenticate users via OAuth 2.0.\n\n## Acceptance Criteria\n- AC-1: Valid credentials return JWT\n";
    await fm.writeSpecFile(FEATURE_DIR, "SPECIFICATION.md", specContent, true);

    // Phase 4: Specify → Clarify
    state = await sm.advancePhase(SPEC_DIR, "001");
    expect(state.current_phase).toBe(Phase.Clarify);

    // Clarify also requires SPECIFICATION.md (already exists)
    // Phase 5: Clarify → Design
    state = await sm.advancePhase(SPEC_DIR, "001");
    expect(state.current_phase).toBe(Phase.Design);

    // Write DESIGN.md
    const designContent = "# DESIGN\n\n## Architecture\nMicroservices with API Gateway.\n\n## API\nGET /api/users\nPOST /api/auth/login\n";
    await fm.writeSpecFile(FEATURE_DIR, "DESIGN.md", designContent, true);

    // Phase 6: Design → Tasks
    state = await sm.advancePhase(SPEC_DIR, "001");
    expect(state.current_phase).toBe(Phase.Tasks);

    // Verify all files present
    const files = await fm.listSpecFiles(FEATURE_DIR);
    expect(files).toContain("CONSTITUTION.md");
    expect(files).toContain("SPECIFICATION.md");
    expect(files).toContain("DESIGN.md");

    // Verify state integrity
    const finalState = await sm.loadState(SPEC_DIR);
    expect(finalState.phases[Phase.Init].status).toBe("completed");
    expect(finalState.phases[Phase.Discover].status).toBe("completed");
    expect(finalState.phases[Phase.Specify].status).toBe("completed");
    expect(finalState.phases[Phase.Clarify].status).toBe("completed");
    expect(finalState.phases[Phase.Design].status).toBe("completed");
    expect(finalState.phases[Phase.Tasks].status).toBe("in_progress");
  });

  // ── FileManager path safety ────────────────────────────────────────────

  it("FileManager rejects path traversal in real filesystem", () => {
    expect(() => fm.sanitizePath("../../etc/passwd")).toThrow(/traversal/i);
    expect(() => fm.sanitizePath("/absolute/path")).toThrow(/Absolute/i);
  });

  // ── State persistence ─────────────────────────────────────────────────

  it("state survives across StateMachine instances", async () => {
    await fm.ensureSpecDir(SPEC_DIR);
    await fm.writeSpecFile(FEATURE_DIR, "CONSTITUTION.md", "# Constitution", true);

    // First instance: save state
    const state = sm.createDefaultState(PROJECT);
    state.features = [FEATURE_DIR];
    state.current_phase = Phase.Discover;
    state.phases[Phase.Init] = { status: "completed" };
    state.phases[Phase.Discover] = { status: "in_progress" };
    await sm.saveState(SPEC_DIR, state);

    // Second instance: load state
    const sm2 = new StateMachine(fm);
    const loaded = await sm2.loadState(SPEC_DIR);

    expect(loaded.current_phase).toBe(Phase.Discover);
    expect(loaded.features).toContain(FEATURE_DIR);
    expect(loaded.project_name).toBe(PROJECT);
  });
});
