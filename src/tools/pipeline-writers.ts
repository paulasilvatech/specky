/**
 * Pipeline Writers — shared artifact-writing flow for the SDD pipeline.
 *
 * The interactive tools (pipeline.ts) and the transcript orchestration flows
 * (transcript.ts) render and write the same artifact set. These writers keep
 * both flows on one code path so the two pipelines cannot drift. Services
 * are passed in explicitly (no globals); the few byte-level formatting
 * differences between the flows are explicit options so the artifacts each
 * flow generates stay identical to what it wrote before the extraction.
 */

import { Phase } from "../constants.js";
import type { ResolvedUseCaseContract } from "../contracts/use-case.js";
import type { EarsValidator } from "../services/ears-validator.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import { artifactMetadata } from "../utils/artifact-metadata.js";

/** Identifies the feature an artifact belongs to (title, feature_id, project_name fields). */
export interface ArtifactIdentity {
  /** Name used for the document title and project_name field. */
  projectName: string;
  featureNumber: string;
  /** Resolved feature slug for feature_id; defaults to projectName. */
  featureSlug?: string;
}

function featureIdOf(identity: ArtifactIdentity): string {
  return `${identity.featureNumber}-${identity.featureSlug ?? identity.projectName}`;
}

/** Result of an artifact writer: the rendered content and where it was written. */
export interface WrittenArtifact {
  content: string;
  filePath: string;
}

// ─── Requirement sections ───

export interface RequirementSectionInput {
  id: string;
  text: string;
  acceptance_criteria: string[];
  /** Requirement title — included in the section heading when present. */
  title?: string;
  /** Explicit EARS pattern label; when omitted the pattern is detected from the text. */
  pattern?: string;
  /** Source attribution quote — rendered as a `**Source:**` line when present. */
  source?: string;
}

export function renderRequirementSections(
  requirements: RequirementSectionInput[],
  earsValidator: EarsValidator,
): string {
  return requirements
    .map((req) => {
      const pattern = req.pattern ?? earsValidator.detectPattern(req.text);
      const lines = [
        req.title === undefined
          ? `### ${req.id}: (${pattern})`
          : `### ${req.id}: ${req.title} (${pattern})`,
        "",
        req.text,
        "",
        "**Acceptance Criteria:**",
        ...req.acceptance_criteria.map((ac) => `- ${ac}`),
        "",
      ];
      if (req.source !== undefined) {
        lines.push(`**Source:** ${req.source}`, "");
      }
      lines.push("---", "");
      return lines.join("\n");
    })
    .join("\n");
}

/** Acceptance Criteria Summary table rows (`| ID | requirement excerpt | test method |`). */
export function renderAcceptanceCriteriaTable(
  requirements: Array<{ id: string; text: string }>,
  options?: { testMethodLabel?: string },
): string {
  const testMethodLabel = options?.testMethodLabel ?? "Acceptance test";
  return requirements
    .map((req) => `| ${req.id} | ${req.text.slice(0, 60)}... | ${testMethodLabel} |`)
    .join("\n");
}

// ─── CONSTITUTION.md ───

export interface ConstitutionContent {
  author: string;
  description: string;
  license: string;
  scope_in: string;
  scope_out: string;
  principles: string[];
  constraints: string[];
}

export interface ConstitutionWriterInput extends ArtifactIdentity {
  featureDir: string;
  /** Tool name recorded as the artifact metadata author. */
  toolName: string;
  constitution: ConstitutionContent;
  force: boolean;
}

export async function writeConstitution(
  fileManager: FileManager,
  templateEngine: TemplateEngine,
  input: ConstitutionWriterInput,
): Promise<WrittenArtifact> {
  const content = await templateEngine.renderWithFrontmatter("constitution", {
    ...artifactMetadata({ version: "1.0.0", author: input.toolName, status: "Active" }),
    title: `${input.projectName} — Constitution`,
    feature_id: featureIdOf(input),
    project_name: input.projectName,
    author: input.constitution.author,
    principles: input.constitution.principles,
    constraints: input.constitution.constraints,
    description: input.constitution.description,
    license: input.constitution.license,
    scope_in: input.constitution.scope_in,
    scope_out: input.constitution.scope_out,
  });
  const filePath = await fileManager.writeSpecFile(
    input.featureDir,
    "CONSTITUTION.md",
    content,
    input.force,
  );
  return { content, filePath };
}

// ─── SPECIFICATION.md ───

export interface SpecificationScores {
  ears_compliance: string;
  testability_score: string;
  traceability_score: string;
  uniqueness_score: string;
}

export interface SpecificationWriterInput extends ArtifactIdentity {
  featureDir: string;
  /** Tool name recorded as the artifact metadata author. */
  toolName: string;
  discoveryContext: string;
  requirementsCore: string;
  requirementsFunctional: string;
  requirementsNonfunctional: string;
  acceptanceCriteriaTable: string;
  scores: SpecificationScores;
  force: boolean;
}

export async function writeSpecification(
  fileManager: FileManager,
  templateEngine: TemplateEngine,
  input: SpecificationWriterInput,
): Promise<WrittenArtifact> {
  const content = await templateEngine.renderWithFrontmatter("specification", {
    ...artifactMetadata({ version: "1.0.0", author: input.toolName, status: "Draft" }),
    title: `${input.projectName} — Specification`,
    feature_id: featureIdOf(input),
    project_name: input.projectName,
    discovery_context: input.discoveryContext,
    requirements_core: input.requirementsCore,
    requirements_functional: input.requirementsFunctional,
    requirements_nonfunctional: input.requirementsNonfunctional,
    acceptance_criteria_table: input.acceptanceCriteriaTable,
    ...input.scores,
  });
  const filePath = await fileManager.writeSpecFile(
    input.featureDir,
    "SPECIFICATION.md",
    content,
    input.force,
  );
  return { content, filePath };
}

// ─── DESIGN.md ───

export interface DiagramContent {
  title: string;
  code: string;
}

export interface AdrContent {
  title: string;
  decision: string;
  rationale: string;
  consequences: string;
}

export interface ApiContractContent {
  method: string;
  endpoint: string;
  description: string;
  request?: string;
  response?: string;
}

/**
 * Byte-level formatting differences between the flows: the interactive
 * pipeline appends a trailing newline to each joined evidence section and
 * falls back to "N/A" for missing API fields, while the transcript flows
 * keep sections unterminated and render the no-API sentence for empty lists.
 */
export interface DesignFormatting {
  /** Append a trailing newline after the last block of each evidence section. */
  sectionTrailingNewline: boolean;
  /** Fallback for missing API request/response fields. */
  apiMissingFieldFallback?: string;
  /** Render the no-API sentence when the contract list is present but empty. */
  emptyApiListMeansNoApi: boolean;
}

export interface DesignWriterInput extends ArtifactIdentity {
  featureDir: string;
  /** Tool name recorded as the artifact metadata author. */
  toolName: string;
  architecture_overview: string;
  system_context: string;
  container_architecture: string;
  component_design: string;
  code_level_design: string;
  data_models: string;
  infrastructure: string;
  security_architecture: string;
  error_handling: string;
  cross_cutting: string;
  /** Rendered workload-specific design contract. */
  workloadDesign: string;
  /** Pre-rendered traceability lines (`- REQ-…` joined by newlines). */
  requirementReferences: string;
  diagrams: DiagramContent[];
  adrs: AdrContent[];
  apiContracts: ApiContractContent[] | undefined;
  force: boolean;
  formatting: DesignFormatting;
}

/** Join evidence blocks with `---` separators; optionally terminate the final block. */
function joinSectionBlocks(blocks: string[], trailingNewline: boolean): string {
  if (blocks.length === 0) return "";
  const joined = blocks.join("\n\n---\n\n");
  return trailingNewline ? `${joined}\n` : joined;
}

function renderDiagramsSection(diagrams: DiagramContent[], formatting: DesignFormatting): string {
  return joinSectionBlocks(
    diagrams.map((diagram) => `### ${diagram.title}\n\n\`\`\`mermaid\n${diagram.code}\n\`\`\``),
    formatting.sectionTrailingNewline,
  );
}

function renderAdrsSection(adrs: AdrContent[], formatting: DesignFormatting): string {
  return joinSectionBlocks(
    adrs.map((adr, index) =>
      [
        `### ADR-${String(index + 1).padStart(3, "0")}: ${adr.title}`,
        "",
        `**Decision:** ${adr.decision}`,
        "",
        `**Rationale:** ${adr.rationale}`,
        "",
        `**Consequences:** ${adr.consequences}`,
      ].join("\n"),
    ),
    formatting.sectionTrailingNewline,
  );
}

function apiFieldText(value: string | undefined, fallback: string | undefined): string {
  return fallback !== undefined ? value || fallback : `${value}`;
}

function renderApiContractsContent(
  contracts: ApiContractContent[] | undefined,
  formatting: DesignFormatting,
): string {
  const noApiMessage = "No network API is exposed by this workload contract.";
  if (contracts === undefined) return noApiMessage;
  if (contracts.length === 0) {
    return formatting.emptyApiListMeansNoApi ? noApiMessage : "";
  }
  return joinSectionBlocks(
    contracts.map((contract) =>
      [
        `### ${contract.method} ${contract.endpoint}`,
        "",
        contract.description,
        "",
        `**Request:** ${apiFieldText(contract.request, formatting.apiMissingFieldFallback)}`,
        "",
        `**Response:** ${apiFieldText(contract.response, formatting.apiMissingFieldFallback)}`,
      ].join("\n"),
    ),
    formatting.sectionTrailingNewline,
  );
}

/** Swap the design template's diagram/ADR placeholder sections for the rendered evidence. */
function replaceDesignEvidenceSections(
  content: string,
  diagramsContent: string,
  adrsContent: string,
): string {
  const normalizedContent = content.replaceAll("\r\n", "\n");
  return normalizedContent
    .replace(
      /## 5\. System Diagrams\n\n[\s\S]*?(?=\n---\n\n## 6)/,
      `## 5. System Diagrams\n\n${diagramsContent}`,
    )
    .replace(
      /## 10\. Architecture Decision Records\n\n[\s\S]*?(?=\n---\n\n## 11)/,
      `## 10. Architecture Decision Records\n\n${adrsContent}`,
    );
}

export async function writeDesign(
  fileManager: FileManager,
  templateEngine: TemplateEngine,
  input: DesignWriterInput,
): Promise<WrittenArtifact> {
  const content = await templateEngine.renderWithFrontmatter("design", {
    ...artifactMetadata({ version: "1.0.0", author: input.toolName, status: "Draft" }),
    title: `${input.projectName} — Design`,
    feature_id: featureIdOf(input),
    project_name: input.projectName,
    architecture_overview: input.architecture_overview,
    system_context: input.system_context,
    container_architecture: input.container_architecture,
    component_design: input.component_design,
    code_level_design: input.code_level_design,
    diagrams: input.diagrams.map((diagram) => diagram.title),
    data_models: input.data_models,
    api_contracts: renderApiContractsContent(input.apiContracts, input.formatting),
    infrastructure: input.infrastructure,
    security_architecture: input.security_architecture,
    adrs: input.adrs.map((adr) => adr.title),
    error_handling: input.error_handling,
    cross_cutting: input.cross_cutting,
    workload_design: input.workloadDesign,
    requirement_references: input.requirementReferences,
  });
  const finalContent = replaceDesignEvidenceSections(
    content,
    renderDiagramsSection(input.diagrams, input.formatting),
    renderAdrsSection(input.adrs, input.formatting),
  );
  const filePath = await fileManager.writeSpecFile(
    input.featureDir,
    "DESIGN.md",
    finalContent,
    input.force,
  );
  return { content: finalContent, filePath };
}

// ─── TASKS.md ───

export interface TaskContent {
  id: string;
  title: string;
  effort: string;
  dependencies: string[];
  parallel: boolean;
  traces_to: string[];
}

export interface PreImplementationGateContent {
  id: string;
  check: string;
  constitution_article: string;
}

/**
 * Byte-level formatting differences between the flows: the interactive
 * pipeline renders "—" for untraced tasks, uses a unicode arrow in the
 * dependency graph, and leaves the effort summary blank, while the
 * transcript flows use an ASCII arrow and itemize per-task effort.
 */
export interface TasksFormatting {
  /** Fallback when a task traces to no requirements. */
  emptyTracesToFallback?: string;
  /** Arrow between a task and its dependency list in the dependency graph. */
  dependencyGraphArrow: string;
  /** Itemize per-task effort in the effort summary. */
  itemizedEffortSummary: boolean;
}

export interface TasksWriterInput extends ArtifactIdentity {
  featureDir: string;
  /** Tool name recorded as the artifact metadata author. */
  toolName: string;
  tasks: TaskContent[];
  gates: PreImplementationGateContent[];
  force: boolean;
  formatting: TasksFormatting;
}

export interface WrittenTasks extends WrittenArtifact {
  parallelCount: number;
}

export async function writeTasks(
  fileManager: FileManager,
  templateEngine: TemplateEngine,
  input: TasksWriterInput,
): Promise<WrittenTasks> {
  const parallelCount = input.tasks.filter((task) => task.parallel).length;
  const content = await templateEngine.renderWithFrontmatter("tasks", {
    ...artifactMetadata({ version: "1.0.0", author: input.toolName, status: "Draft" }),
    title: `${input.projectName} — Tasks`,
    feature_id: featureIdOf(input),
    project_name: input.projectName,
    gates: input.gates.map(
      (gate) => `**Gate ${gate.id}:** ${gate.check} (${gate.constitution_article})`,
    ),
    task_table: input.tasks
      .map(
        (task) =>
          `| ${task.id} | ${task.title} | ${task.parallel ? "[P]" : ""} | ${task.effort} | ${task.dependencies.join(", ") || "—"} | ${task.traces_to.join(", ") || (input.formatting.emptyTracesToFallback ?? "")} |`,
      )
      .join("\n"),
    dependency_graph: input.tasks
      .map(
        (task) =>
          `${task.id}: ${task.title} ${input.formatting.dependencyGraphArrow} [${task.dependencies.join(", ")}]`,
      )
      .join("\n"),
    effort_summary: input.formatting.itemizedEffortSummary
      ? input.tasks.map((task) => `${task.id}: ${task.effort}`).join("; ")
      : "",
    total_tasks: String(input.tasks.length),
    parallel_tasks: String(parallelCount),
    total_effort: `${input.tasks.length} tasks`,
  });
  const filePath = await fileManager.writeSpecFile(
    input.featureDir,
    "TASKS.md",
    content,
    input.force,
  );
  return { content, filePath, parallelCount };
}

// ─── Feature state initialization ───

export interface InitializeFeatureStateInput {
  featureDir: string;
  projectName: string;
  featureNumber: string;
  contract: ResolvedUseCaseContract;
  /**
   * Serialize the create+save through the state lock (sdd_init) instead of
   * saving directly (sdd_auto_pipeline).
   */
  useStateLock: boolean;
}

/** Create the per-feature state with the Init phase completed and persist it. */
export async function initializeFeatureState(
  stateMachine: StateMachine,
  input: InitializeFeatureStateInput,
): Promise<void> {
  const create = async () => {
    const state = stateMachine.createFeatureState({
      projectName: input.projectName,
      feature: {
        number: input.featureNumber,
        name: input.projectName,
        directory: input.featureDir,
      },
      contract: input.contract,
    });
    state.phases[Phase.Init] = {
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    await stateMachine.saveState(input.featureDir, state);
  };
  if (input.useStateLock) {
    await stateMachine.withStateLock(input.featureDir, create);
  } else {
    await create();
  }
}
