/**
 * Transcript Automation Tools — sdd_import_transcript + sdd_auto_pipeline.
 *
 * sdd_import_transcript: Parse VTT/SRT/TXT/MD → structured analysis
 * sdd_auto_pipeline: Parse transcript → run FULL pipeline → all 5 spec files written
 */

import { basename, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Phase } from "../constants.js";
import { renderWorkloadDesign } from "../contracts/pipeline-profiles.js";
import {
  autoPipelineInputSchema,
  batchTranscriptsInputSchema,
  importTranscriptInputSchema,
} from "../schemas/transcript.js";
import { AnalysisEngine } from "../services/analysis-engine.js";
import type { EarsValidator } from "../services/ears-validator.js";
import { requireExecutionContext } from "../services/execution-context.js";
import { FeaturePackageGenerator } from "../services/feature-package-generator.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { TranscriptParser } from "../services/transcript-parser.js";
import type { TranscriptAnalysis } from "../types.js";
import { artifactMetadata } from "../utils/artifact-metadata.js";
import {
  type DesignFormatting,
  initializeFeatureState,
  type RequirementSectionInput,
  renderAcceptanceCriteriaTable,
  renderRequirementSections,
  type TasksFormatting,
  writeConstitution,
  writeDesign,
  writeSpecification,
  writeTasks,
} from "./pipeline-writers.js";
import { enrichResponse } from "./response-builder.js";
import { errorResult, truncate } from "./tool-result.js";

/** Transcript flows keep design evidence sections unterminated and render the no-API sentence for empty contract lists. */
const TRANSCRIPT_DESIGN_FORMATTING: DesignFormatting = {
  sectionTrailingNewline: false,
  emptyApiListMeansNoApi: true,
};

/** Transcript flows use an ASCII dependency arrow and itemize per-task effort. */
const TRANSCRIPT_TASKS_FORMATTING: TasksFormatting = {
  dependencyGraphArrow: "->",
  itemizedEffortSummary: true,
};

function transcriptDiscoveryContext(analysis: TranscriptAnalysis): string {
  const lines = [
    "## Discovery Context",
    "",
    `- **Participants:** ${analysis.participants.join(", ") || "Not identified in source"}`,
    `- **Topics:** ${analysis.topics.map((topic) => topic.name).join(", ") || "No named topics extracted"}`,
    `- **Decisions captured:** ${analysis.decisions.length}`,
    `- **Constraints captured:** ${analysis.constraints_mentioned.length}`,
    `- **Open questions:** ${analysis.open_questions.length}`,
    "",
    "This context was extracted from the referenced transcript and must be reviewed against the source before approval.",
    "",
    "---",
    "",
  ];
  return lines.join("\n");
}

function validateExplicitFeatureContent(
  analysis: TranscriptAnalysis,
  requirements: Array<{
    id: string;
    text: string;
    source_quote: string;
    acceptance_criteria: string[];
  }>,
  tasks: Array<{ id: string; dependencies: string[]; traces_to: string[] }>,
  earsValidator: EarsValidator,
): void {
  const source = analysis.full_text.toLowerCase();
  const requirementIds = new Set<string>();
  for (const requirement of requirements) {
    if (requirementIds.has(requirement.id))
      throw new Error(`Duplicate requirement ID ${requirement.id}.`);
    requirementIds.add(requirement.id);
    if (!source.includes(requirement.source_quote.toLowerCase())) {
      throw new Error(
        `Requirement ${requirement.id} source_quote is not present in the transcript.`,
      );
    }
    const validation = earsValidator.validate(requirement.text);
    if (!validation.valid) {
      throw new Error(
        `Requirement ${requirement.id} is not valid EARS: ${(validation.issues ?? []).join("; ")}.`,
      );
    }
    if (requirement.acceptance_criteria.length === 0) {
      throw new Error(`Requirement ${requirement.id} requires acceptance criteria.`);
    }
  }

  const taskIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    const unknownRequirements = task.traces_to.filter((id) => !requirementIds.has(id));
    const unknownDependencies = task.dependencies.filter((id) => !taskIds.has(id));
    if (unknownRequirements.length > 0) {
      throw new Error(
        `Task ${task.id} traces to unknown requirements: ${unknownRequirements.join(", ")}.`,
      );
    }
    if (unknownDependencies.length > 0) {
      throw new Error(
        `Task ${task.id} depends on unknown tasks: ${unknownDependencies.join(", ")}.`,
      );
    }
  }
}

export function registerTranscriptTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator,
  transcriptParser: TranscriptParser,
): void {
  const featurePackageGenerator = new FeaturePackageGenerator(fileManager);
  const analysisEngine = new AnalysisEngine(earsValidator);

  // ─── sdd_import_transcript ───
  server.registerTool(
    "sdd_import_transcript",
    {
      title: "Import Meeting Transcript",
      description:
        "Parses a meeting transcript (VTT, SRT, TXT, or MD) and extracts structured data: participants, topics, decisions, action items, raw requirements, constraints, and open questions. Supports Teams, Zoom, Google Meet, and Otter.ai transcripts.",
      inputSchema: importTranscriptInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ file_path, raw_text, format, spec_dir }) => {
      try {
        let analysis: TranscriptAnalysis;

        if (raw_text) {
          const fmt = format === "auto" ? "txt" : format;
          analysis = transcriptParser.parse(raw_text, fmt, "inline-paste");
        } else if (file_path) {
          analysis = await transcriptParser.parseFile(file_path);
        } else {
          throw new Error(
            "Provide either file_path or raw_text.\n→ Fix: Set file_path to transcript location, or paste text in raw_text.",
          );
        }

        // Save the clean markdown version for reference
        transcriptParser.toMarkdown(analysis);

        const result = {
          status: "transcript_parsed",
          title: analysis.title,
          participants: analysis.participants,
          duration: analysis.duration_estimate,
          stats: {
            segments: analysis.segments.length,
            topics: analysis.topics.length,
            decisions: analysis.decisions.length,
            action_items: analysis.action_items.length,
            requirements_identified: analysis.requirements_raw.length,
            constraints: analysis.constraints_mentioned.length,
            open_questions: analysis.open_questions.length,
          },
          topics: analysis.topics.map((t) => ({
            name: t.name,
            summary: t.summary,
            speakers: t.speakers,
            key_points: t.key_points,
          })),
          decisions: analysis.decisions,
          action_items: analysis.action_items,
          requirements_raw: analysis.requirements_raw,
          constraints_mentioned: analysis.constraints_mentioned,
          open_questions: analysis.open_questions,
          next_action:
            "Review the extracted data. Call sdd_auto_pipeline to automatically generate the full specification from this transcript.",
          tip: "You can also call sdd_auto_pipeline directly with the same file_path for a fully automated flow.",
        };

        const enriched = await enrichResponse(
          "sdd_import_transcript",
          result,
          stateMachine,
          spec_dir,
        );
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return errorResult("sdd_import_transcript", error);
      }
    },
  );

  // ─── sdd_auto_pipeline ───
  server.registerTool(
    "sdd_auto_pipeline",
    {
      title: "Auto Pipeline from Transcript",
      description:
        "Validates explicit Constitution, source-quoted EARS requirements, complete architecture, tasks, and gates against one transcript before atomically orchestrating the full contracted artifact set.",
      inputSchema: autoPipelineInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      file_path,
      raw_text,
      project_name,
      feature_number,
      constitution,
      requirements,
      architecture,
      tasks,
      pre_impl_gates,
      format,
      spec_dir,
      force,
    }) => {
      try {
        // ── Step 1: Parse transcript ──
        console.error(`[specky] Auto-pipeline: parsing transcript...`);
        let analysis: TranscriptAnalysis;

        if (raw_text) {
          const fmt = format === "auto" ? "txt" : format;
          analysis = transcriptParser.parse(raw_text, fmt, "inline-paste");
        } else if (file_path) {
          analysis = await transcriptParser.parseFile(file_path);
        } else {
          throw new Error(
            "Provide either file_path or raw_text.\n→ Fix: Set file_path to transcript location, or paste text in raw_text.",
          );
        }

        const featureDir = join(spec_dir, `${feature_number}-${project_name}`);
        const contract = requireExecutionContext("sdd_auto_pipeline").requestedContract!;
        if (contract.execution_mode !== "full") {
          throw new Error(
            `sdd_auto_pipeline requires a full execution-mode contract; received ${contract.id}.`,
          );
        }
        validateExplicitFeatureContent(analysis, requirements, tasks, earsValidator);
        const workloadDesign = renderWorkloadDesign(
          contract.workload,
          architecture.workload_design,
        );
        if (contract.workload === "api" && architecture.api_contracts.length === 0) {
          throw new Error(
            "API transcript orchestration requires at least one explicit API contract.",
          );
        }
        const existing = (await fileManager.listFeatures(spec_dir)).find(
          (feature) => feature.number === feature_number,
        );
        if (existing)
          throw new Error(
            `Feature number ${feature_number} is already assigned to ${existing.directory}.`,
          );
        const filesCreated: string[] = [];

        // ── Step 2: Create CONSTITUTION.md ──
        console.error(`[specky] Auto-pipeline: writing CONSTITUTION.md...`);
        await fileManager.ensureSpecDir(spec_dir);

        await writeConstitution(fileManager, templateEngine, {
          featureDir,
          projectName: project_name,
          featureNumber: feature_number,
          toolName: "sdd_auto_pipeline",
          constitution,
          force,
        });
        filesCreated.push("CONSTITUTION.md");

        // Initialize state and advance through phases properly
        await initializeFeatureState(stateMachine, {
          featureDir,
          projectName: project_name,
          featureNumber: feature_number,
          contract,
          useStateLock: false,
        });
        // Advance Init → Discover
        await stateMachine.advancePhase(featureDir);

        const earsRequirements: RequirementSectionInput[] = requirements.map((requirement) => ({
          id: requirement.id,
          title: requirement.title,
          pattern: requirement.ears_pattern,
          text: requirement.text,
          acceptance_criteria: requirement.acceptance_criteria,
          source: requirement.source_quote,
        }));

        // ── Step 4: Write SPECIFICATION.md ──
        console.error(`[specky] Auto-pipeline: writing SPECIFICATION.md...`);
        const specScores = `${earsRequirements.length}/${earsRequirements.length}`;
        const { content: specContent } = await writeSpecification(fileManager, templateEngine, {
          featureDir,
          projectName: project_name,
          featureNumber: feature_number,
          toolName: "sdd_auto_pipeline",
          discoveryContext: transcriptDiscoveryContext(analysis),
          requirementsCore: renderRequirementSections(earsRequirements, earsValidator),
          requirementsFunctional: "",
          requirementsNonfunctional: "",
          acceptanceCriteriaTable: renderAcceptanceCriteriaTable(earsRequirements),
          scores: {
            ears_compliance: specScores,
            testability_score: specScores,
            traceability_score: specScores,
            uniqueness_score: specScores,
          },
          force,
        });

        filesCreated.push("SPECIFICATION.md");
        // Advance Discover → Specify → Clarify
        await stateMachine.recordPhaseComplete(featureDir, Phase.Discover);
        await stateMachine.advancePhase(featureDir); // Discover → Specify
        await stateMachine.recordPhaseComplete(featureDir, Phase.Specify);
        await stateMachine.advancePhase(featureDir); // Specify → Clarify
        await stateMachine.recordPhaseComplete(featureDir, Phase.Clarify);

        // ── Step 5: Write DESIGN.md ──
        console.error(`[specky] Auto-pipeline: writing DESIGN.md...`);
        const { content: designContent } = await writeDesign(fileManager, templateEngine, {
          featureDir,
          projectName: project_name,
          featureNumber: feature_number,
          toolName: "sdd_auto_pipeline",
          architecture_overview: architecture.architecture_overview,
          system_context: architecture.system_context,
          container_architecture: architecture.container_architecture,
          component_design: architecture.component_design,
          code_level_design: architecture.code_level_design,
          data_models: architecture.data_models,
          infrastructure: architecture.infrastructure,
          security_architecture: architecture.security_architecture,
          error_handling: architecture.error_handling,
          cross_cutting: architecture.cross_cutting,
          workloadDesign,
          requirementReferences: requirements
            .map((requirement) => `- ${requirement.id}`)
            .join("\n"),
          diagrams: architecture.mermaid_diagrams,
          adrs: architecture.adrs,
          apiContracts: architecture.api_contracts,
          force,
          formatting: TRANSCRIPT_DESIGN_FORMATTING,
        });
        filesCreated.push("DESIGN.md");
        // Advance Clarify → Design
        await stateMachine.advancePhase(featureDir);
        await stateMachine.recordPhaseComplete(featureDir, Phase.Design);

        // ── Step 6: Write TASKS.md ──
        console.error(`[specky] Auto-pipeline: writing TASKS.md...`);
        const { content: tasksContent } = await writeTasks(fileManager, templateEngine, {
          featureDir,
          projectName: project_name,
          featureNumber: feature_number,
          toolName: "sdd_auto_pipeline",
          tasks,
          gates: pre_impl_gates,
          force,
          formatting: TRANSCRIPT_TASKS_FORMATTING,
        });
        filesCreated.push("TASKS.md");
        // Advance Design → Tasks
        await stateMachine.advancePhase(featureDir);
        await stateMachine.recordPhaseComplete(featureDir, Phase.Tasks);

        // ── Step 7: Write ANALYSIS.md ──
        // Real quality gate over the artifacts we just wrote — the SAME
        // AnalysisEngine sdd_run_analysis and sdd_batch_transcripts use, with
        // a requirement-level traceability matrix. No hard-coded APPROVE/100%:
        // auto-generated packages report whatever the evidence supports.
        console.error(`[specky] Auto-pipeline: writing ANALYSIS.md...`);
        const gate = analysisEngine.analyze({
          hasConstitution: true,
          hasSpec: true,
          hasDesign: true,
          hasTasks: true,
          specContent,
          designContent,
          tasksContent,
        });
        let reportedGaps = gate.gaps;
        if (reportedGaps.length === 0) {
          reportedGaps =
            analysis.open_questions.length > 0
              ? analysis.open_questions.map((question) => `Open question from meeting: ${question}`)
              : ["No gaps — all requirements mapped through design and tasks"];
        }

        const analysisContent = await templateEngine.renderWithFrontmatter("analysis", {
          ...artifactMetadata({
            version: "1.0.0",
            author: "sdd_auto_pipeline",
            status: gate.decision,
          }),
          title: `${project_name} — Analysis`,
          feature_id: `${feature_number}-${project_name}`,
          project_name,
          gate_decision: gate.decision,
          coverage_percent: String(gate.coveragePercent),
          traceability_matrix: gate.traceMatrix,
          design_coverage: `${gate.designCoverage}%`,
          task_coverage: `${gate.taskCoverage}%`,
          test_coverage: "Pending implementation",
          gaps: reportedGaps,
          recommendations:
            gate.gaps.length > 0
              ? gate.gaps.map((gap) => `Remediate: ${gap}`)
              : analysis.action_items.length > 0
                ? analysis.action_items.map((action) => `Source action: ${action}`)
                : ["No remediation is required by the current traceability analysis."],
          ears_compliance: `${gate.earsCoverage}%`,
          ears_status: gate.earsCoverage === 100 ? "✅" : "❌",
          coverage_status: gate.coveragePercent >= 90 ? "✅" : "❌",
          orphan_count: String(gate.orphanCount),
          orphan_status: gate.orphanCount === 0 ? "✅" : "❌",
        });

        await fileManager.writeSpecFile(featureDir, "ANALYSIS.md", analysisContent, force);
        filesCreated.push("ANALYSIS.md");

        // ── Step 8: Save transcript as reference ──
        const transcriptMd = transcriptParser.toMarkdown(analysis);
        await fileManager.writeSpecFile(featureDir, "TRANSCRIPT.md", transcriptMd, force);
        filesCreated.push("TRANSCRIPT.md");

        const featurePackage = await featurePackageGenerator.ensureFeaturePackage({
          featureDir,
          featureNumber: feature_number,
          featureName: project_name,
          specContent,
          sourceTool: "sdd_auto_pipeline",
        });
        filesCreated.push(...featurePackage.created);

        // ── Step 9: Finalize state — advance Tasks → Analyze and set gate decision ──
        await stateMachine.advancePhase(featureDir); // Tasks → Analyze
        await stateMachine.recordPhaseComplete(featureDir, Phase.Analyze);

        // Persist the COMPUTED gate decision — the state must carry the same
        // engine verdict written into ANALYSIS.md, not an asserted APPROVE.
        const gateDecidedAt = new Date().toISOString();
        await stateMachine.mutateState(featureDir, (state) => {
          state.gate_decision = {
            decision: gate.decision,
            reasons: [
              ...gate.reasons,
              `${earsRequirements.length} source-backed EARS requirements validated against the transcript.`,
              `${analysis.decisions.length} decisions captured.`,
              `${analysis.topics.length} topics covered.`,
            ],
            coverage_percent: gate.coveragePercent,
            gaps: gate.gaps,
            decided_at: gateDecidedAt,
          };
        });

        console.error(`[specky] Auto-pipeline: COMPLETE — ${filesCreated.length} files written.`);

        const result = {
          status: "auto_pipeline_complete",
          project_name,
          feature_dir: featureDir,
          transcript_source: file_path || "inline-paste",
          files_created: filesCreated,
          feature_package: featurePackage,
          summary: {
            participants: analysis.participants,
            topics_extracted: analysis.topics.length,
            decisions_captured: analysis.decisions.length,
            action_items: analysis.action_items.length,
            requirements_validated: earsRequirements.length,
            open_questions: analysis.open_questions.length,
          },
          gate_decision: {
            decision: gate.decision,
            coverage_percent: gate.coveragePercent,
            reasons: gate.reasons,
            gaps: gate.gaps,
            decided_at: gateDecidedAt,
          },
          next_action: [
            ...(gate.decision === "APPROVE"
              ? []
              : [
                  `0. Gate is ${gate.decision} (${gate.coveragePercent}% coverage) — remediate the gaps in ANALYSIS.md, then re-run sdd_run_analysis`,
                ]),
            "1. Review SPECIFICATION.md source quotes and acceptance criteria",
            "2. Review DESIGN.md diagrams, ADRs, and workload-specific contract",
            "3. Review TASKS.md dependency and requirement traceability",
            "4. Review TRANSCRIPT.md — original meeting content preserved",
            "5. Start implementation following TASKS.md breakdown",
          ].join("\n"),
        };

        const enriched = await enrichResponse(
          "sdd_auto_pipeline",
          result,
          stateMachine,
          featureDir,
        );
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }],
        };
      } catch (error) {
        return errorResult("sdd_auto_pipeline", error);
      }
    },
  );

  // ─── sdd_batch_transcripts ───
  server.registerTool(
    "sdd_batch_transcripts",
    {
      title: "Batch Process Transcript Folder",
      description:
        "Validates a one-to-one explicit feature manifest for every transcript file, including source quotes, architecture, tasks, gates, and feature numbers, before writing batch feature packages.",
      inputSchema: batchTranscriptsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ transcripts_dir, spec_dir, features: featureInputs, force }) => {
      try {
        const contract = requireExecutionContext("sdd_batch_transcripts").requestedContract!;
        if (contract.execution_mode !== "full") {
          throw new Error(
            `sdd_batch_transcripts requires a full execution-mode contract; received ${contract.id}.`,
          );
        }
        console.error(`[specky] Batch: scanning ${transcripts_dir} for transcripts...`);

        // Find all transcript files
        const extensions = [".vtt", ".srt", ".txt", ".md"] as const;
        const files = await fileManager.listFilesByExtension(transcripts_dir, extensions);

        if (files.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "no_transcripts_found",
                    directory: transcripts_dir,
                    message: `No transcript files found in "${transcripts_dir}". Expected files with extensions: ${extensions.join(", ")}`,
                    fix: "Check the folder path. OneDrive paths may include spaces (e.g., 'OneDrive - Company/Meeting Transcripts').",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const filesByName = new Map(files.map((filePath) => [basename(filePath), filePath]));
        const configuredNames = new Set(featureInputs.map((feature) => feature.file_name));
        const missingConfigurations = [...filesByName.keys()].filter(
          (name) => !configuredNames.has(name),
        );
        const missingFiles = featureInputs
          .map((feature) => feature.file_name)
          .filter((name) => !filesByName.has(name));
        if (missingConfigurations.length > 0 || missingFiles.length > 0) {
          throw new Error(
            `Batch manifest mismatch. Unconfigured files: ${missingConfigurations.join(", ") || "none"}. ` +
              `Missing files: ${missingFiles.join(", ") || "none"}.`,
          );
        }

        const existingFeatures = await fileManager.listFeatures(spec_dir);
        const existingNumbers = new Set(existingFeatures.map((feature) => feature.number));
        const configuredNumbers = featureInputs.map((feature) => feature.feature_number);
        const duplicateNumbers = configuredNumbers.filter(
          (number, index) => configuredNumbers.indexOf(number) !== index,
        );
        const collisions = configuredNumbers.filter((number) => existingNumbers.has(number));
        if (duplicateNumbers.length > 0 || collisions.length > 0) {
          throw new Error(
            `Batch feature number conflict. Duplicates: ${[...new Set(duplicateNumbers)].join(", ") || "none"}. ` +
              `Existing: ${collisions.join(", ") || "none"}.`,
          );
        }

        const prepared = await Promise.all(
          featureInputs.map(async (featureInput) => {
            const filePath = filesByName.get(featureInput.file_name)!;
            const analysis = await transcriptParser.parseFile(filePath);
            validateExplicitFeatureContent(
              analysis,
              featureInput.requirements,
              featureInput.tasks,
              earsValidator,
            );
            const workloadDesign = renderWorkloadDesign(
              contract.workload,
              featureInput.architecture.workload_design,
            );
            if (
              contract.workload === "api" &&
              featureInput.architecture.api_contracts.length === 0
            ) {
              throw new Error(
                `Batch feature ${featureInput.feature_number} requires an explicit API contract.`,
              );
            }
            return { featureInput, filePath, analysis, workloadDesign };
          }),
        );

        console.error(
          `[specky] Batch: validated ${prepared.length} transcript feature manifest(s). Processing...`,
        );

        const results: Array<{
          file: string;
          project_name: string;
          feature_number: string;
          status: string;
          requirements: number;
          package_artifacts?: number;
          error?: string;
        }> = [];

        for (const { featureInput, analysis, workloadDesign } of prepared) {
          const fileName = featureInput.file_name;
          const projectName = featureInput.project_name;
          const featureNum = featureInput.feature_number;
          const featureDir = join(spec_dir, `${featureNum}-${projectName}`);

          try {
            console.error(`[specky] Batch feature ${featureNum}: processing "${fileName}"...`);
            const earsRequirements: RequirementSectionInput[] = featureInput.requirements.map(
              (requirement) => ({
                id: requirement.id,
                title: requirement.title,
                pattern: requirement.ears_pattern,
                text: requirement.text,
                acceptance_criteria: requirement.acceptance_criteria,
                source: requirement.source_quote,
              }),
            );

            // ── Write all spec files ──
            await fileManager.ensureSpecDir(spec_dir);

            // CONSTITUTION.md
            await writeConstitution(fileManager, templateEngine, {
              featureDir,
              projectName,
              featureNumber: featureNum,
              toolName: "sdd_batch_transcripts",
              constitution: featureInput.constitution,
              force,
            });

            // SPECIFICATION.md
            const batchScores = `${earsRequirements.length}/${earsRequirements.length}`;
            const { content: specContent } = await writeSpecification(fileManager, templateEngine, {
              featureDir,
              projectName,
              featureNumber: featureNum,
              toolName: "sdd_batch_transcripts",
              discoveryContext: transcriptDiscoveryContext(analysis),
              requirementsCore: renderRequirementSections(earsRequirements, earsValidator),
              requirementsFunctional: "",
              requirementsNonfunctional: "",
              acceptanceCriteriaTable: renderAcceptanceCriteriaTable(earsRequirements, {
                testMethodLabel: "Test",
              }),
              scores: {
                ears_compliance: batchScores,
                testability_score: batchScores,
                traceability_score: batchScores,
                uniqueness_score: batchScores,
              },
              force,
            });

            const architecture = featureInput.architecture;
            const { content: designContent } = await writeDesign(fileManager, templateEngine, {
              featureDir,
              projectName,
              featureNumber: featureNum,
              toolName: "sdd_batch_transcripts",
              architecture_overview: architecture.architecture_overview,
              system_context: architecture.system_context,
              container_architecture: architecture.container_architecture,
              component_design: architecture.component_design,
              code_level_design: architecture.code_level_design,
              data_models: architecture.data_models,
              infrastructure: architecture.infrastructure,
              security_architecture: architecture.security_architecture,
              error_handling: architecture.error_handling,
              cross_cutting: architecture.cross_cutting,
              workloadDesign,
              requirementReferences: featureInput.requirements
                .map((requirement) => `- ${requirement.id}`)
                .join("\n"),
              diagrams: architecture.mermaid_diagrams,
              adrs: architecture.adrs,
              apiContracts: architecture.api_contracts,
              force,
              formatting: TRANSCRIPT_DESIGN_FORMATTING,
            });

            const { content: tasksContent } = await writeTasks(fileManager, templateEngine, {
              featureDir,
              projectName,
              featureNumber: featureNum,
              toolName: "sdd_batch_transcripts",
              tasks: featureInput.tasks,
              gates: featureInput.pre_impl_gates,
              force,
              formatting: TRANSCRIPT_TASKS_FORMATTING,
            });

            // ANALYSIS.md — real quality gate over the artifacts we just wrote
            // (shared engine, no hard-coded APPROVE/100%). Auto-generated
            // packages typically land at CHANGES_NEEDED until traceability is
            // completed, which is the honest signal.
            const gate = analysisEngine.analyze({
              hasConstitution: true,
              hasSpec: true,
              hasDesign: true,
              hasTasks: true,
              specContent,
              designContent,
              tasksContent,
            });
            const analysisContent = await templateEngine.renderWithFrontmatter("analysis", {
              ...artifactMetadata({
                version: "1.0.0",
                author: "sdd_batch_transcripts",
                status: gate.decision,
              }),
              title: `${projectName} — Analysis`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              gate_decision: gate.decision,
              coverage_percent: String(gate.coveragePercent),
              traceability_matrix: gate.traceMatrix,
              design_coverage: `${gate.designCoverage}%`,
              task_coverage: `${gate.taskCoverage}%`,
              test_coverage: "Pending",
              gaps: batchAnalysisGaps(gate.gaps, analysis.open_questions),
              recommendations:
                gate.gaps.length > 0
                  ? gate.gaps.map((gap) => `Remediate: ${gap}`)
                  : analysis.action_items.length > 0
                    ? analysis.action_items.map((action) => `Source action: ${action}`)
                    : ["No remediation is required by the current traceability analysis."],
              ears_compliance: `${gate.earsCoverage}%`,
              ears_status: evidenceStatus(gate.earsCoverage === 100),
              coverage_status: evidenceStatus(gate.coveragePercent >= 90),
              orphan_count: String(gate.orphanCount),
              orphan_status: evidenceStatus(gate.orphanCount === 0),
            });
            await fileManager.writeSpecFile(featureDir, "ANALYSIS.md", analysisContent, force);

            // TRANSCRIPT.md
            const transcriptMd = transcriptParser.toMarkdown(analysis);
            await fileManager.writeSpecFile(featureDir, "TRANSCRIPT.md", transcriptMd, force);

            const featurePackage = await featurePackageGenerator.ensureFeaturePackage({
              featureDir,
              featureNumber: featureNum,
              featureName: projectName,
              specContent,
              sourceTool: "sdd_batch_transcripts",
            });

            const state = stateMachine.createFeatureState({
              projectName,
              feature: { number: featureNum, name: projectName, directory: featureDir },
              contract,
            });
            state.current_phase = Phase.Analyze;
            for (const phase of [
              Phase.Init,
              Phase.Discover,
              Phase.Specify,
              Phase.Clarify,
              Phase.Design,
              Phase.Tasks,
              Phase.Analyze,
            ]) {
              state.phases[phase] = {
                status: "completed",
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
              };
            }
            // Persist the computed gate — the per-feature state must agree
            // with the ANALYSIS.md the engine just wrote (sdd_get_status
            // reads this file).
            state.gate_decision = {
              decision: gate.decision,
              reasons: [
                ...gate.reasons,
                `${earsRequirements.length} requirements from ${fileName}`,
              ],
              coverage_percent: gate.coveragePercent,
              gaps: gate.gaps,
              decided_at: new Date().toISOString(),
            };
            await stateMachine.saveState(featureDir, state);

            results.push({
              file: fileName,
              project_name: projectName,
              feature_number: featureNum,
              status: "completed",
              requirements: earsRequirements.length,
              package_artifacts: featurePackage.created.length,
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[specky] Batch: ERROR processing "${fileName}": ${errorMsg}`);
            results.push({
              file: fileName,
              project_name: projectName,
              feature_number: featureNum,
              status: "error",
              requirements: 0,
              error: errorMsg,
            });
          }
        }

        const succeeded = results.filter((r) => r.status === "completed");
        const failed = results.filter((r) => r.status === "error");

        console.error(
          `[specky] Batch: DONE — ${succeeded.length} succeeded, ${failed.length} failed out of ${files.length} transcripts.`,
        );

        const batchResult = {
          status: "batch_complete",
          transcripts_dir,
          total_files: files.length,
          succeeded: succeeded.length,
          failed: failed.length,
          total_requirements: succeeded.reduce((sum, r) => sum + r.requirements, 0),
          results,
          spec_directory: spec_dir,
          next_action: [
            `${succeeded.length} feature spec packages created in ${spec_dir}/`,
            "Review each source quote and artifact approval state.",
            "Use sdd_get_status to check any individual feature.",
            batchCompletionMessage(failed.length),
          ].join("\n"),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: truncate(
                JSON.stringify(
                  {
                    ...batchResult,
                    contract_id: contract.id,
                    contract_fingerprint: contract.fingerprint,
                  },
                  null,
                  2,
                ),
              ),
            },
          ],
        };
      } catch (error) {
        return errorResult("sdd_batch_transcripts", error);
      }
    },
  );
}

// ─── Helpers for batch reporting ───

function batchAnalysisGaps(gaps: string[], openQuestions: string[]): string[] {
  return gaps.length > 0 ? gaps : openQuestions.map((question) => `Open: ${question}`);
}

function evidenceStatus(passed: boolean): string {
  return passed ? "✅" : "❌";
}

function batchCompletionMessage(failedCount: number): string {
  return failedCount > 0
    ? `${failedCount} transcript feature(s) failed; no unvalidated source content was synthesized.`
    : "All explicitly configured transcript features were processed successfully.";
}
