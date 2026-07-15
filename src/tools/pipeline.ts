/**
 * Pipeline Tools — 8 tools for the SDD pipeline.
 * Thin tools: validate input → call service → format output.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, truncate } from "./tool-result.js";
import { join } from "node:path";
import { Phase } from "../constants.js";
import { loadConfig } from "../config.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { EarsValidator } from "../services/ears-validator.js";
import { FeaturePackageGenerator, SPECKY_SCAFFOLD_MARKER } from "../services/feature-package-generator.js";
import { AnalysisEngine } from "../services/analysis-engine.js";
import { enrichResponse } from "./response-builder.js";
import { routingEngine } from "../utils/routing-helper.js";
import { requireExecutionContext } from "../services/execution-context.js";
import {
  discoveryQuestionsForContract,
  renderWorkloadDesign,
} from "../contracts/pipeline-profiles.js";
import { artifactMetadata } from "../utils/artifact-metadata.js";
import { extractRequirementIds } from "../utils/id-contracts.js";
import {
  partitionFunctionalNonFunctional,
} from "../utils/design-stubs.js";
import {
  initInputSchema,
  discoverInputSchema,
  writeSpecInputSchema,
  clarifyInputSchema,
  writeDesignInputSchema,
  writeTasksInputSchema,
  runAnalysisInputSchema,
  advancePhaseInputSchema,
} from "../schemas/pipeline.js";

/**
 * Phases whose completion is an LGTM quality gate. When pipeline.require_lgtm
 * is enabled in .specky/config.yml, sdd_advance_phase refuses to complete
 * these phases unless the caller passes lgtm: true.
 */
const LGTM_GATE_PHASES: readonly Phase[] = [Phase.Specify, Phase.Design, Phase.Tasks];

function computeEarsScores(
  requirements: Array<{ id: string; acceptance_criteria: string[] }>,
  validationIssueCount: number,
): {
  ears_compliance: string;
  testability_score: string;
  traceability_score: string;
  uniqueness_score: string;
} {
  const total = requirements.length;
  const validCount = Math.max(0, total - validationIssueCount);
  const testableCount = requirements.filter((r) => r.acceptance_criteria.length > 0).length;
  const ids = requirements.map((r) => r.id);
  const uniqueIds = new Set(ids).size;
  const traceableCount = ids.filter((id) => /^REQ-[A-Z]+-\d{3}$/.test(id)).length;
  return {
    ears_compliance: `${validCount}/${total}`,
    testability_score: `${testableCount}/${total}`,
    traceability_score: `${traceableCount}/${total}`,
    uniqueness_score: `${uniqueIds}/${total}`,
  };
}

function formatDiscoveryContext(answers: Record<string, string>): string {
  const entries = Object.entries(answers);
  if (entries.length === 0) return "";
  const rows = entries.map(([q, a]) => `- **${q}:** ${a}`).join("\n");
  return `## Discovery Context\n\nAnswers from the structured discovery phase:\n\n${rows}\n\n---\n`;
}

function renderRequirementSections(
  requirements: Array<{ id: string; text: string; acceptance_criteria: string[] }>,
  earsValidator: EarsValidator,
): string {
  return requirements
    .map((req) => {
      const pattern = earsValidator.detectPattern(req.text);
      return [
        `### ${req.id}: (${pattern})`,
        "",
        req.text,
        "",
        "**Acceptance Criteria:**",
        ...req.acceptance_criteria.map((ac) => `- ${ac}`),
        "",
        "---",
        "",
      ].join("\n");
    })
    .join("\n");
}

async function shouldOverwriteScaffold(
  fileManager: FileManager,
  featureDir: string,
  fileName: string,
  force: boolean,
): Promise<boolean> {
  if (force) return true;
  try {
    const content = await fileManager.readSpecFile(featureDir, fileName);
    return content.includes(SPECKY_SCAFFOLD_MARKER);
  } catch {
    return false;
  }
}

export function registerPipelineTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator
): void {
  const featurePackageGenerator = new FeaturePackageGenerator(fileManager);
  const analysisEngine = new AnalysisEngine(earsValidator);

  // ─── sdd_init ───
  server.registerTool(
    "sdd_init",
    {
      title: "Initialize SDD Pipeline",
      description:
        "Creates .specs/ directory, writes CONSTITUTION.md skeleton, and initializes the state machine. Call this first before any other SDD tool.",
      inputSchema: initInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ project_name, spec_dir, feature_number, principles, constraints }) => {
      try {
        const featureDir = join(spec_dir, `${feature_number}-${project_name}`);
        const collision = (await fileManager.listFeatures(spec_dir)).find(
          (feature) => feature.number === feature_number,
        );
        if (collision) {
          throw new Error(`Feature number ${feature_number} is already assigned to ${collision.directory}.`);
        }
        const contract = requireExecutionContext("sdd_init").requestedContract!;

        // Ensure spec directory
        await fileManager.ensureSpecDir(spec_dir);

        // Render CONSTITUTION.md
        const content = await templateEngine.renderWithFrontmatter("constitution", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_init", status: "Active" }),
          title: `${project_name} — Constitution`,
          feature_id: `${feature_number}-${project_name}`,
          project_name,
          author: "SDD Pipeline",
          principles: principles || ["Simplicity", "Traceability", "Quality"],
          constraints: constraints || ["No external API dependencies"],
          description: `Foundational charter for ${project_name}`,
          license: "MIT",
          scope_in: "Core project features",
          scope_out: "Future enhancements not in initial scope",
        });

        await fileManager.writeSpecFile(featureDir, "CONSTITUTION.md", content);

        await stateMachine.withStateLock(featureDir, async () => {
          const state = stateMachine.createFeatureState({
            projectName: project_name,
            feature: {
              number: feature_number,
              name: project_name,
              directory: featureDir,
            },
            contract,
          });
          state.phases[Phase.Init] = {
            status: "completed",
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          };
          await stateMachine.saveState(featureDir, state);
        });

        const result = {
          status: "initialized",
          project_name,
          feature_number,
          feature_dir: featureDir,
          contract_id: contract.id,
          contract_fingerprint: contract.fingerprint,
          files_created: ["CONSTITUTION.md", ".sdd-state.json"],
          next_action: "Call sdd_discover with your project idea to get discovery questions.",
        };

        const enriched = await enrichResponse("sdd_init", result, stateMachine, featureDir, {
          completedPhase: Phase.Init,
          nextPhase: Phase.Discover,
          artifactsProduced: ["CONSTITUTION.md", ".sdd-state.json"],
          summaryOfWork: "Initialized SDD pipeline",
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_init", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_discover ───
  server.registerTool(
    "sdd_discover",
    {
      title: "Discover Project Requirements",
      description:
        "Returns lifecycle- and workload-specific discovery questions with required evidence. Brownfield requires a codebase baseline; migration requires source and target summaries.",
      inputSchema: discoverInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_idea, codebase_summary, migration_source, migration_target }) => {
      try {
        const context = requireExecutionContext("sdd_discover");
        const stateDir = context.stateDir!;
        const contract = context.state!.contract;
        if (!contract.phases.includes(Phase.Discover)) {
          throw new Error(`Contract ${contract.id} does not include the Discover phase.`);
        }
        const questions = discoveryQuestionsForContract(contract, {
          projectIdea: project_idea,
          codebaseSummary: codebase_summary,
          migrationSource: migration_source,
          migrationTarget: migration_target,
        });

        // Record discover phase
        await stateMachine.recordPhaseStart(stateDir, Phase.Discover);
        await stateMachine.recordPhaseComplete(stateDir, Phase.Discover);

        const result = {
          project_idea,
          contract_id: contract.id,
          lifecycle: contract.lifecycle,
          workload: contract.workload,
          questions,
          instructions: "Answer each question, then call sdd_write_spec with your answers and requirements.",
        };

        const enriched = await enrichResponse("sdd_discover", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_discover", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_write_spec ───
  server.registerTool(
    "sdd_write_spec",
    {
      title: "Write Specification",
      description:
        "Generates and writes SPECIFICATION.md with all requirements in EARS notation. Validates each requirement against EARS patterns.",
      inputSchema: writeSpecInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_name, feature_number, discovery_answers, requirements, force }) => {
      try {
        const context = requireExecutionContext("sdd_write_spec");
        const existingFeature = context.feature!;
        const featureSlug = existingFeature.name;
        const featureDir = existingFeature.directory;
        const stateDir = context.stateDir!;
        const featureId = `${feature_number}-${featureSlug}`;

        // Validate EARS patterns
        const validationIssues: string[] = [];
        for (const req of requirements) {
          const result = earsValidator.validate(req.text);
          if (!result.valid && result.issues) {
            validationIssues.push(`${req.id}: ${result.issues.join("; ")}`);
          }
        }

        if (validationIssues.length > 0 && !force) {
          return {
            content: [{
              type: "text" as const, text: JSON.stringify({
                error: "ears_validation_failed",
                tool: "sdd_write_spec",
                validation_issues: validationIssues,
                message: "One or more requirements failed EARS validation. Fix them or pass force: true to write anyway.",
              }, null, 2)
            }],
            isError: true,
          };
        }

        const scores = computeEarsScores(requirements, validationIssues.length);
        const discoveryContext = formatDiscoveryContext(discovery_answers);

        const { functional, nonfunctional } = partitionFunctionalNonFunctional(requirements);
        const requirementsCore = renderRequirementSections(requirements, earsValidator);
        const requirementsFunctional = renderRequirementSections(functional, earsValidator);
        const requirementsNonfunctional = renderRequirementSections(nonfunctional, earsValidator);

        // Build acceptance criteria table
        const acTable = requirements
          .map((req) => `| ${req.id} | ${req.text.slice(0, 60)}... | Acceptance test |`)
          .join("\n");

        await stateMachine.ensurePhasesThrough(stateDir, Phase.Specify);
        await stateMachine.recordPhaseStart(stateDir, Phase.Specify);
        await stateMachine.invalidateGateDecision(stateDir);

        const content = await templateEngine.renderWithFrontmatter("specification", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_write_spec", status: "Draft" }),
          title: `${feature_name} — Specification`,
          feature_id: featureId,
          project_name: feature_name,
          discovery_context: discoveryContext,
          requirements_core: requirementsCore,
          requirements_functional: requirementsFunctional,
          requirements_nonfunctional: requirementsNonfunctional,
          acceptance_criteria_table: acTable,
          ...scores,
        });

        const filePath = await fileManager.writeSpecFile(featureDir, "SPECIFICATION.md", content, force);
        const featurePackage = await featurePackageGenerator.ensureFeaturePackage({
          featureDir,
          featureNumber: feature_number,
          featureName: featureSlug,
          specContent: content,
          sourceTool: "sdd_write_spec",
        });

        await stateMachine.recordPhaseComplete(stateDir, Phase.Specify);

        const result = {
          status: "specification_written",
          file: filePath,
          requirement_count: requirements.length,
          feature_package: featurePackage,
          validation_issues: validationIssues.length > 0 ? validationIssues : undefined,
          next_action: "Review the specification. Call sdd_advance_phase when ready, then sdd_clarify for disambiguation.",
        };

        const enriched = await enrichResponse("sdd_write_spec", result, stateMachine, stateDir, {
          completedPhase: Phase.Specify,
          nextPhase: Phase.Clarify,
          artifactsProduced: ["SPECIFICATION.md", ...featurePackage.created],
          summaryOfWork: `Generated ${requirements.length} EARS requirements`,
        });
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_write_spec", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_clarify ───
  server.registerTool(
    "sdd_clarify",
    {
      title: "Clarify Requirements",
      description:
        "Reads SPECIFICATION.md and returns up to 5 disambiguation questions targeting ambiguous or incomplete requirements.",
      inputSchema: clarifyInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const context = requireExecutionContext("sdd_clarify");
        const feature = context.feature!;
        const stateDir = context.stateDir!;

        // Read specification
        const specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md");

        // Extract requirements (simple regex-based extraction)
        const reqRegex = /### (REQ-[A-Z]+-\d{3}):.*?\n\n(.*?)(?=\n###|\n---|\n##|$)/gs;
        const reqs: Array<{ id: string; text: string }> = [];
        let match;
        while ((match = reqRegex.exec(specContent)) !== null) {
          reqs.push({ id: match[1], text: match[2].trim() });
        }

        // Generate clarification questions for ambiguous requirements
        const questions: Array<{
          id: string;
          requirement_id: string;
          ambiguous_text: string;
          question: string;
          alternatives: string[];
        }> = [];

        let qNum = 1;
        for (const req of reqs) {
          if (qNum > 5) break;

          const validation = earsValidator.validate(req.text);
          if (!validation.valid || (validation.issues && validation.issues.length > 0)) {
            questions.push({
              id: `CQ-${String(qNum).padStart(3, "0")}`,
              requirement_id: req.id,
              ambiguous_text: req.text.slice(0, 200),
              question: `This requirement has issues: ${(validation.issues || []).join("; ")}. How should it be clarified?`,
              alternatives: [
                validation.suggestion || "Rewrite using EARS notation.",
                "Add measurable acceptance criteria.",
                "Split into multiple specific requirements.",
              ],
            });
            qNum++;
          }
        }

        // If no ambiguous requirements found, generate general questions
        if (questions.length === 0) {
          questions.push({
            id: "CQ-001",
            requirement_id: "GENERAL",
            ambiguous_text: "All requirements pass EARS validation.",
            question: "All requirements conform to EARS notation. Are there any edge cases or error scenarios not covered?",
            alternatives: [
              "Add error handling requirements.",
              "Add performance/scalability requirements.",
              "Requirements are complete — proceed to design.",
            ],
          });
        }

        await stateMachine.recordPhaseStart(stateDir, Phase.Clarify);

        const result = {
          status: "clarification_questions",
          question_count: questions.length,
          questions,
          instructions: "Answer the clarification questions, then call sdd_write_design to proceed.",
        };

        const enriched = await enrichResponse("sdd_clarify", result, stateMachine, stateDir, {
          nextPhase: Phase.Design,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_clarify", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_write_design ───
  server.registerTool(
    "sdd_write_design",
    {
      title: "Write Design Document",
      description:
        "Generates and writes DESIGN.md with architecture overview, Mermaid diagrams, ADRs, and API contracts.",
      inputSchema: writeDesignInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ architecture_overview, mermaid_diagrams, workload_design, adrs, api_contracts, system_context, container_architecture, component_design, code_level_design, data_models, infrastructure, security_architecture, error_handling, cross_cutting, force }) => {
      try {
        const context = requireExecutionContext("sdd_write_design");
        const feature = context.feature!;
        const featureNumber = context.featureNumber!;
        const stateDir = context.stateDir!;
        const contract = context.state!.contract;
        const workloadDesign = renderWorkloadDesign(contract.workload, workload_design);
        if (contract.workload === "api" && (!api_contracts || api_contracts.length === 0)) {
          throw new Error("API workload design requires at least one api_contracts entry.");
        }

        let specContent: string;
        try {
          specContent = await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md");
        } catch {
          throw new Error(`SPECIFICATION.md is required before design in ${feature.directory}.`);
        }
        const requirementReferences = extractRequirementIds(specContent);
        if (requirementReferences.length === 0) {
          throw new Error("SPECIFICATION.md contains no requirement IDs for design traceability.");
        }

        // Build diagrams section
        const diagramsContent = mermaid_diagrams
          .map(
            (d) =>
              `### ${d.title}\n\n\`\`\`mermaid\n${d.code}\n\`\`\`\n`
          )
          .join("\n---\n\n");

        // Build ADRs section
        const adrsContent = adrs
          .map(
            (a, i) =>
              `### ADR-${String(i + 1).padStart(3, "0")}: ${a.title}\n\n**Decision:** ${a.decision}\n\n**Rationale:** ${a.rationale}\n\n**Consequences:** ${a.consequences}\n`
          )
          .join("\n---\n\n");

        // Build API contracts section
        const apiContent = api_contracts
          ? api_contracts
            .map(
              (c) =>
                `### ${c.method} ${c.endpoint}\n\n${c.description}\n\n**Request:** ${c.request || "N/A"}\n\n**Response:** ${c.response || "N/A"}\n`
            )
            .join("\n---\n\n")
          : "No network API is exposed by this workload contract.";

        await stateMachine.ensurePhasesThrough(stateDir, Phase.Design);
        await stateMachine.recordPhaseStart(stateDir, Phase.Design);
        await stateMachine.invalidateGateDecision(stateDir);

        const content = await templateEngine.renderWithFrontmatter("design", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_write_design", status: "Draft" }),
          title: `${feature.name} — Design`,
          feature_id: `${featureNumber}-${feature.name}`,
          project_name: feature.name,
          architecture_overview,
          system_context,
          container_architecture,
          component_design,
          code_level_design,
          diagrams: mermaid_diagrams.map((d) => d.title),
          data_models,
          api_contracts: apiContent,
          infrastructure,
          security_architecture,
          adrs: adrs.map((a) => a.title),
          error_handling,
          cross_cutting,
          workload_design: workloadDesign,
          requirement_references: requirementReferences.map((id) => `- ${id}`).join("\n"),
        });

        // Replace the template diagram/ADR placeholders with actual content
        let finalContent = content;
        // Replace the diagrams section
        const diagramSectionRegex = /## 5\. System Diagrams\n\n([\s\S]*?)(?=\n---\n\n## 6)/;
        finalContent = finalContent.replace(
          diagramSectionRegex,
          `## 5. System Diagrams\n\n${diagramsContent}`
        );

        // Replace the ADR section
        const adrSectionRegex = /## 10\. Architecture Decision Records\n\n([\s\S]*?)(?=\n---\n\n## 11)/;
        finalContent = finalContent.replace(
          adrSectionRegex,
          `## 10. Architecture Decision Records\n\n${adrsContent}`
        );

        const overwriteDesign = await shouldOverwriteScaffold(fileManager, feature.directory, "DESIGN.md", force);
        const filePath = await fileManager.writeSpecFile(feature.directory, "DESIGN.md", finalContent, overwriteDesign);

        await stateMachine.recordPhaseComplete(stateDir, Phase.Design);

        const result = {
          status: "design_written",
          file: filePath,
          diagram_count: mermaid_diagrams.length,
          adr_count: adrs?.length || 0,
          contract_id: contract.id,
          workload: contract.workload,
          next_action: "Review the design. Call sdd_advance_phase, then sdd_write_tasks.",
        };

        const enriched = await enrichResponse("sdd_write_design", result, stateMachine, stateDir, {
          completedPhase: Phase.Design,
          nextPhase: Phase.Tasks,
          artifactsProduced: ["DESIGN.md"],
          summaryOfWork: `Generated design with ${mermaid_diagrams.length} diagrams`,
        });
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_write_design", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_write_tasks ───
  server.registerTool(
    "sdd_write_tasks",
    {
      title: "Write Task Breakdown",
      description:
        "Generates and writes TASKS.md with pre-implementation gates, sequenced tasks with [P] parallel markers, effort estimates, and requirement traceability.",
      inputSchema: writeTasksInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ tasks, pre_impl_gates, force }) => {
      try {
        const context = requireExecutionContext("sdd_write_tasks");
        const feature = context.feature!;
        const featureNumber = context.featureNumber!;
        const stateDir = context.stateDir!;

        // Build task table
        const taskTable = tasks
          .map(
            (t) =>
              `| ${t.id} | ${t.title} | ${t.parallel ? "[P]" : ""} | ${t.effort} | ${t.dependencies.join(", ") || "—"} | ${t.traces_to.join(", ") || "—"} |`
          )
          .join("\n");

        // Build gates
        const gatesList = pre_impl_gates.map(
          (g) => `**Gate ${g.id}:** ${g.check} (${g.constitution_article})`
        );

        const parallelCount = tasks.filter((t) => t.parallel).length;

        const content = await templateEngine.renderWithFrontmatter("tasks", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_write_tasks", status: "Draft" }),
          title: `${feature.name} — Tasks`,
          feature_id: `${featureNumber}-${feature.name}`,
          project_name: feature.name,
          gates: gatesList,
          task_table: taskTable,
          dependency_graph: tasks.map((t) => `${t.id}: ${t.title} → [${t.dependencies.join(", ")}]`).join("\n"),
          effort_summary: "",
          total_tasks: String(tasks.length),
          parallel_tasks: String(parallelCount),
          total_effort: `${tasks.length} tasks`,
        });

        await stateMachine.ensurePhasesThrough(stateDir, Phase.Tasks);
        await stateMachine.recordPhaseStart(stateDir, Phase.Tasks);
        await stateMachine.invalidateGateDecision(stateDir);

        const overwriteTasks = await shouldOverwriteScaffold(fileManager, feature.directory, "TASKS.md", force);
        const filePath = await fileManager.writeSpecFile(feature.directory, "TASKS.md", content, overwriteTasks);

        await stateMachine.recordPhaseComplete(stateDir, Phase.Tasks);

        const result = {
          status: "tasks_written",
          file: filePath,
          task_count: tasks.length,
          parallel_tasks: parallelCount,
          next_action: "Review the tasks. Call sdd_advance_phase, then sdd_run_analysis for quality gate.",
        };

        const enriched = await enrichResponse("sdd_write_tasks", result, stateMachine, stateDir, {
          completedPhase: Phase.Tasks,
          nextPhase: Phase.Analyze,
          artifactsProduced: ["TASKS.md"],
          summaryOfWork: `Created ${tasks.length} tasks`,
        });
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_write_tasks", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_run_analysis ───
  server.registerTool(
    "sdd_run_analysis",
    {
      title: "Run Specification Analysis",
      description:
        "Reads all spec files, generates ANALYSIS.md with traceability matrix and coverage report, and returns a gate decision (APPROVE, CHANGES_NEEDED, or BLOCK).",
      inputSchema: runAnalysisInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ force }) => {
      try {
        const context = requireExecutionContext("sdd_run_analysis");
        const feature = context.feature!;
        const featureNumber = context.featureNumber!;
        const stateDir = context.stateDir!;

        // Read available spec files
        const files = await fileManager.listSpecFiles(feature.directory);
        const hasConstitution = files.includes("CONSTITUTION.md");
        const hasSpec = files.includes("SPECIFICATION.md");
        const hasDesign = files.includes("DESIGN.md");
        const hasTasks = files.includes("TASKS.md");

        const specContent = hasSpec ? await fileManager.readSpecFile(feature.directory, "SPECIFICATION.md") : "";
        const designContent = hasDesign ? await fileManager.readSpecFile(feature.directory, "DESIGN.md") : "";
        const tasksContent = hasTasks ? await fileManager.readSpecFile(feature.directory, "TASKS.md") : "";

        const analysis = analysisEngine.analyze({
          hasConstitution, hasSpec, hasDesign, hasTasks,
          specContent, designContent, tasksContent,
        });
        const {
          decision, reasons, coveragePercent, earsCoverage, designCoverage, taskCoverage,
          gaps, orphanCount, traceMatrix,
        } = analysis;

        const gateDecision = {
          decision,
          reasons,
          coverage_percent: coveragePercent,
          gaps,
          decided_at: new Date().toISOString(),
        };

        const content = await templateEngine.renderWithFrontmatter("analysis", {
          ...artifactMetadata({ version: "1.0.0", author: "sdd_run_analysis", status: decision }),
          title: `${feature.name} — Analysis`,
          feature_id: `${featureNumber}-${feature.name}`,
          project_name: feature.name,
          gate_decision: decision,
          coverage_percent: String(coveragePercent),
          traceability_matrix: traceMatrix,
          design_coverage: `${designCoverage}%`,
          task_coverage: `${taskCoverage}%`,
          test_coverage: "Pending",
          gaps,
          recommendations: gaps.length > 0
            ? gaps.map((g) => `Remediate: ${g}`)
            : ["All requirements are mapped through design and tasks — proceed to implementation."],
          ears_compliance: `${earsCoverage}%`,
          ears_status: earsCoverage === 100 ? "✅" : "❌",
          coverage_status: coveragePercent >= 90 ? "✅" : "❌",
          orphan_count: String(orphanCount),
          orphan_status: orphanCount === 0 ? "✅" : "❌",
        });

        const filePath = await fileManager.writeSpecFile(feature.directory, "ANALYSIS.md", content, force);

        await stateMachine.ensurePhasesThrough(stateDir, Phase.Analyze);
        await stateMachine.recordPhaseStart(stateDir, Phase.Analyze);

        // Update state with gate decision
        await stateMachine.mutateState(stateDir, (state) => {
          state.gate_decision = gateDecision;
        });

        if (decision === "APPROVE") {
          await stateMachine.recordPhaseComplete(stateDir, Phase.Analyze);
        }

        const result = {
          status: "analysis_complete",
          file: filePath,
          gate_decision: gateDecision,
          next_action: decision === "APPROVE"
            ? "Gate APPROVE recorded. Proceed to implementation."
            : `Address the following gaps: ${gaps.join(", ")}`,
        };

        const enriched = await enrichResponse("sdd_run_analysis", result, stateMachine, stateDir, {
          completedPhase: decision === "APPROVE" ? Phase.Analyze : undefined,
          nextPhase: decision === "APPROVE" ? Phase.Implement : Phase.Analyze,
          artifactsProduced: ["ANALYSIS.md"],
          summaryOfWork: `Analysis complete: ${decision}`,
        });
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_run_analysis", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_advance_phase ───
  server.registerTool(
    "sdd_advance_phase",
    {
      title: "Advance Pipeline Phase",
      description:
        "Validates that the current phase's required files exist, then transitions the state machine to the next phase. When pipeline.require_lgtm is enabled, completing the specify/design/tasks quality gates requires lgtm: true.",
      inputSchema: advancePhaseInputSchema.extend({
        lgtm: z
          .boolean()
          .optional()
          .describe(
            "Explicit human approval (LGTM) for the phase being completed. Required at the specify/design/tasks gates when pipeline.require_lgtm is enabled in .specky/config.yml."
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ lgtm }) => {
      try {
        const context = requireExecutionContext("sdd_advance_phase");
        const stateDir = context.stateDir!;
        const feature = context.feature!;
        const config = loadConfig(fileManager.workspaceRoot);
        const priorState = await stateMachine.loadState(stateDir);
        const completedPhase = priorState.current_phase;

        const state = await stateMachine.advancePhase(stateDir, {
          lgtm,
          requireLgtm: config.pipeline.require_lgtm,
        });
        const currentIndex = state.contract.phases.indexOf(state.current_phase);
        const nextPhase = currentIndex < state.contract.phases.length - 1
          ? state.contract.phases[currentIndex + 1]
          : null;

        // Gate instrumentation: record whether artifact was modified before approval
        const requiredFiles = stateMachine.getRequiredFiles(completedPhase);
        const artifactPath = requiredFiles[0]
          ? `${feature.directory}/${requiredFiles[0]}`
          : feature.directory;
        const gateEntry = await stateMachine.recordGateEvent(stateDir, completedPhase, artifactPath, {
          lgtm: lgtm === true,
        });

        const result: Record<string, unknown> = {
          status: "phase_advanced",
          current_phase: state.current_phase,
          next_phase: nextPhase,
          timestamp: new Date().toISOString(),
          next_action: nextPhase
            ? `Proceed with ${nextPhase} phase.`
            : "Pipeline is complete.",
          next_phase_routing: nextPhase ? routingEngine.getHint(nextPhase) : null,
        };

        // Cognitive debt warning when artifact was not modified before approval
        if (gateEntry && !gateEntry.was_modified) {
          result.cognitive_debt_warning =
            "Artifact approved without modification. Consider whether the AI-generated content reflects your actual requirements. Unmodified approvals are a leading indicator of cognitive debt (arXiv:2603.22106).";
        }

        const enriched = await enrichResponse("sdd_advance_phase", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("LGTM quality gate") && message.includes("pipeline.require_lgtm")) {
          return {
            content: [{
              type: "text" as const, text: JSON.stringify({
                error: "lgtm_required",
                tool: "sdd_advance_phase",
                message,
                fix: "Review the phase artifact, then call sdd_advance_phase again with lgtm: true to record the approval.",
                require_lgtm: true,
              }, null, 2)
            }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatError("sdd_advance_phase", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
