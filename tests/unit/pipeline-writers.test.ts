/**
 * pipeline-writers.test.ts — shared artifact writers for the SDD pipeline.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Phase } from "../../src/constants.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { EarsValidator } from "../../src/services/ears-validator.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import {
  type ArtifactIdentity,
  type ConstitutionContent,
  type DesignFormatting,
  initializeFeatureState,
  renderAcceptanceCriteriaTable,
  renderRequirementSections,
  type TasksFormatting,
  writeConstitution,
  writeDesign,
  writeSpecification,
  writeTasks,
} from "../../src/tools/pipeline-writers.js";

const FEATURE_DIR = ".specs/001-api";
const REPO = resolve(import.meta.dirname, "../..");

const workspaces: string[] = [];

function setup(): { workspace: string; fileManager: FileManager; templateEngine: TemplateEngine } {
  const workspace = mkdtempSync(join(tmpdir(), "specky-pipeline-writers-"));
  workspaces.push(workspace);
  cpSync(join(REPO, "templates"), join(workspace, "templates"), { recursive: true });
  const fileManager = new FileManager(workspace);
  return { workspace, fileManager, templateEngine: new TemplateEngine(fileManager, "templates") };
}

function identity(): ArtifactIdentity {
  return { projectName: "Todo API", featureNumber: "001", featureSlug: "todo-api" };
}

function makeContract() {
  return resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "api",
    execution_mode: "full",
    capabilities: [],
    capability_config: {},
  });
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("renderRequirementSections", () => {
  const earsValidator = new EarsValidator();

  it("renders a requirement without a title or explicit pattern", () => {
    const sections = renderRequirementSections(
      [
        {
          id: "REQ-001",
          text: "When a user submits a todo, the system shall store it.",
          acceptance_criteria: ["The todo is persisted."],
        },
      ],
      earsValidator,
    );

    expect(sections).toContain("### REQ-001: (event_driven)");
    expect(sections).toContain("When a user submits a todo, the system shall store it.");
    expect(sections).toContain("- The todo is persisted.");
  });

  it("renders a requirement with a title", () => {
    const sections = renderRequirementSections(
      [
        {
          id: "REQ-002",
          title: "List Todos",
          text: "The system shall list todos.",
          acceptance_criteria: ["All todos are returned."],
        },
      ],
      earsValidator,
    );

    expect(sections).toContain("### REQ-002: List Todos (ubiquitous)");
  });

  it("renders an explicit pattern and source attribution", () => {
    const sections = renderRequirementSections(
      [
        {
          id: "REQ-003",
          text: "If the network fails, then the system shall retry.",
          acceptance_criteria: ["Retries occur up to 3 times."],
          pattern: "unwanted",
          source: "Architecture review",
        },
      ],
      earsValidator,
    );

    expect(sections).toContain("### REQ-003: (unwanted)");
    expect(sections).toContain("**Source:** Architecture review");
  });

  it("renders multiple requirements separated by horizontal rules", () => {
    const sections = renderRequirementSections(
      [
        {
          id: "REQ-A",
          text: "The system shall do A.",
          acceptance_criteria: ["A happens."],
          pattern: "ubiquitous",
        },
        {
          id: "REQ-B",
          text: "The system shall do B.",
          acceptance_criteria: ["B happens."],
          pattern: "ubiquitous",
        },
      ],
      earsValidator,
    );

    expect(sections.split("---\n\n")).toHaveLength(2);
  });
});

describe("renderAcceptanceCriteriaTable", () => {
  it("renders rows with the default test method", () => {
    const table = renderAcceptanceCriteriaTable([
      { id: "REQ-001", text: "The system shall store todos in a database." },
    ]);

    expect(table).toBe(
      "| REQ-001 | The system shall store todos in a database.... | Acceptance test |",
    );
  });

  it("truncates requirement text to 60 characters", () => {
    const table = renderAcceptanceCriteriaTable([
      {
        id: "REQ-001",
        text: "The system shall store todos in a database and sync them across devices.",
      },
    ]);

    expect(table).toContain(
      "| REQ-001 | The system shall store todos in a database and sync them acr... | Acceptance test |",
    );
  });

  it("uses a custom test method label when provided", () => {
    const table = renderAcceptanceCriteriaTable(
      [{ id: "REQ-001", text: "The system shall store todos." }],
      { testMethodLabel: "Unit test" },
    );

    expect(table).toContain("| Unit test |");
  });

  it("renders multiple rows", () => {
    const table = renderAcceptanceCriteriaTable([
      { id: "REQ-001", text: "Store todos." },
      { id: "REQ-002", text: "List todos." },
    ]);

    expect(table.split("\n")).toHaveLength(2);
  });
});

describe("writeConstitution", () => {
  it("writes a rendered CONSTITUTION.md", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const content: ConstitutionContent = {
      author: "Alice",
      description: "A simple todo API.",
      license: "MIT",
      scope_in: "Core CRUD operations.",
      scope_out: "Real-time sync.",
      principles: ["Test-driven design."],
      constraints: ["No external auth."],
    };

    const result = await writeConstitution(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_init",
      constitution: content,
      force: true,
    });

    expect(result.filePath).toBe(join(workspace, FEATURE_DIR, "CONSTITUTION.md"));
    const written = readFileSync(result.filePath, "utf-8");
    expect(written).toContain("Todo API — Constitution");
    expect(written).toContain("001-todo-api");
    expect(written).toContain("Test-driven design.");
    expect(written).toContain("No external auth.");
  });
});

describe("writeSpecification", () => {
  it("writes a rendered SPECIFICATION.md", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const result = await writeSpecification(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_define_spec",
      discoveryContext: "Greenfield API.",
      requirementsCore: "### REQ-001: (ubiquitous)\n\nThe system shall store todos.",
      requirementsFunctional: "",
      requirementsNonfunctional: "",
      acceptanceCriteriaTable: "| REQ-001 | Store todos.... | Acceptance test |",
      scores: {
        ears_compliance: "100%",
        testability_score: "100%",
        traceability_score: "100%",
        uniqueness_score: "100%",
      },
      force: true,
    });

    const written = readFileSync(result.filePath, "utf-8");
    expect(written).toContain("Todo API — Specification");
    expect(written).toContain("Greenfield API.");
    expect(written).toContain("REQ-001");
    expect(written).toContain("| EARS notation compliance | 100% |");
  });
});

describe("writeDesign", () => {
  it("writes a rendered DESIGN.md with diagrams and ADRs", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const formatting: DesignFormatting = {
      sectionTrailingNewline: false,
      emptyApiListMeansNoApi: true,
    };

    const result = await writeDesign(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_design",
      architecture_overview: "Layered API.",
      system_context: "Users manage todos.",
      container_architecture: "API + database.",
      component_design: "Controllers and services.",
      code_level_design: "Classes and interfaces.",
      data_models: "Todo entity.",
      infrastructure: "Container Apps.",
      security_architecture: "API key.",
      error_handling: "Problem details.",
      cross_cutting: "Logging.",
      workloadDesign: "Workload design summary.",
      requirementReferences: "- REQ-001",
      diagrams: [{ title: "Context", code: "graph LR\n  User --> API" }],
      adrs: [
        {
          title: "ADR-001",
          decision: "Use REST.",
          rationale: "Familiar.",
          consequences: "Simple.",
        },
      ],
      apiContracts: undefined,
      force: true,
      formatting,
    });

    const written = readFileSync(result.filePath, "utf-8");
    expect(written).toContain("Todo API — Design");
    expect(written).toContain("## 5. System Diagrams");
    expect(written).toContain("### Context");
    expect(written).toContain("```mermaid");
    expect(written).toContain("## 10. Architecture Decision Records");
    expect(written).toContain("### ADR-001");
    expect(written).toContain("No network API is exposed by this workload contract.");
  });

  it("renders API contracts when provided", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const formatting: DesignFormatting = {
      sectionTrailingNewline: true,
      apiMissingFieldFallback: "N/A",
      emptyApiListMeansNoApi: false,
    };

    const result = await writeDesign(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_design",
      architecture_overview: "",
      system_context: "",
      container_architecture: "",
      component_design: "",
      code_level_design: "",
      data_models: "",
      infrastructure: "",
      security_architecture: "",
      error_handling: "",
      cross_cutting: "",
      workloadDesign: "",
      requirementReferences: "",
      diagrams: [],
      adrs: [],
      apiContracts: [
        {
          method: "GET",
          endpoint: "/todos",
          description: "List todos.",
          request: undefined,
          response: "Todo[]",
        },
      ],
      force: true,
      formatting,
    });

    const written = readFileSync(result.filePath, "utf-8");
    expect(written).toContain("### GET /todos");
    expect(written).toContain("**Request:** N/A");
    expect(written).toContain("**Response:** Todo[]");
  });

  it("renders an empty API section when contracts list is empty and emptyApiListMeansNoApi is false", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const formatting: DesignFormatting = {
      sectionTrailingNewline: false,
      emptyApiListMeansNoApi: false,
    };

    const result = await writeDesign(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_design",
      architecture_overview: "",
      system_context: "",
      container_architecture: "",
      component_design: "",
      code_level_design: "",
      data_models: "",
      infrastructure: "",
      security_architecture: "",
      error_handling: "",
      cross_cutting: "",
      workloadDesign: "",
      requirementReferences: "",
      diagrams: [],
      adrs: [],
      apiContracts: [],
      force: true,
      formatting,
    });

    const written = readFileSync(result.filePath, "utf-8");
    expect(written).not.toContain("No network API is exposed");
  });
});

describe("writeTasks", () => {
  it("writes a rendered TASKS.md and returns the parallel count", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const formatting: TasksFormatting = {
      emptyTracesToFallback: "—",
      dependencyGraphArrow: "→",
      itemizedEffortSummary: true,
    };

    const result = await writeTasks(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_plan_tasks",
      tasks: [
        {
          id: "T-001",
          title: "Setup",
          effort: "S",
          dependencies: [],
          parallel: false,
          traces_to: ["REQ-001"],
        },
        {
          id: "T-002",
          title: "Implement",
          effort: "M",
          dependencies: ["T-001"],
          parallel: false,
          traces_to: [],
        },
      ],
      gates: [{ id: "1", check: "Spec approved", constitution_article: "II" }],
      force: true,
      formatting,
    });

    expect(result.parallelCount).toBe(0);
    const written = readFileSync(result.filePath, "utf-8");
    expect(written).toContain("Todo API — Tasks");
    expect(written).toContain("| T-001 | Setup |  | S | — | REQ-001 |");
    expect(written).toContain("| T-002 | Implement |  | M | T-001 | — |");
    expect(written).toContain("T-001: Setup → []");
    expect(written).toContain("T-002: Implement → [T-001]");
    expect(written).toContain("T-001: S; T-002: M");
  });

  it("counts parallel tasks", async () => {
    const { workspace, fileManager, templateEngine } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });

    const result = await writeTasks(fileManager, templateEngine, {
      ...identity(),
      featureDir: FEATURE_DIR,
      toolName: "sdd_plan_tasks",
      tasks: [
        {
          id: "T-001",
          title: "A",
          effort: "S",
          dependencies: [],
          parallel: true,
          traces_to: ["REQ-001"],
        },
        {
          id: "T-002",
          title: "B",
          effort: "S",
          dependencies: [],
          parallel: true,
          traces_to: ["REQ-002"],
        },
      ],
      gates: [],
      force: true,
      formatting: { dependencyGraphArrow: "=>", itemizedEffortSummary: false },
    });

    expect(result.parallelCount).toBe(2);
  });
});

describe("initializeFeatureState", () => {
  it("creates and persists a feature state without the state lock", async () => {
    const { workspace, fileManager } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    const stateMachine = new StateMachine(fileManager, workspace);

    await initializeFeatureState(stateMachine, {
      featureDir: FEATURE_DIR,
      projectName: "Todo API",
      featureNumber: "001",
      contract: makeContract(),
      useStateLock: false,
    });

    const state = await stateMachine.loadState(FEATURE_DIR);
    expect(state.project_name).toBe("Todo API");
    expect(state.feature.number).toBe("001");
    expect(state.phases[Phase.Init]?.status).toBe("completed");
  });
});
