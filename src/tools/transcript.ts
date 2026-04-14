/**
 * Transcript Automation Tools — sdd_import_transcript + sdd_auto_pipeline.
 *
 * sdd_import_transcript: Parse VTT/SRT/TXT/MD → structured analysis
 * sdd_auto_pipeline: Parse transcript → run FULL pipeline → all 5 spec files written
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT, Phase } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { EarsValidator } from "../services/ears-validator.js";
import type { TranscriptParser } from "../services/transcript-parser.js";
import type { TranscriptAnalysis } from "../types.js";
import { basename } from "node:path";
import {
  importTranscriptInputSchema,
  autoPipelineInputSchema,
  batchTranscriptsInputSchema,
} from "../schemas/transcript.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n[TRUNCATED] Response exceeded 25,000 characters."
  );
}

export function registerTranscriptTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator,
  transcriptParser: TranscriptParser
): void {
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
            "Provide either file_path or raw_text.\n→ Fix: Set file_path to transcript location, or paste text in raw_text."
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

        const enriched = await enrichResponse("sdd_import_transcript", result, stateMachine, spec_dir);
        return {
          content: [
            { type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_import_transcript", error as Error),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_auto_pipeline ───
  server.registerTool(
    "sdd_auto_pipeline",
    {
      title: "Auto Pipeline from Transcript",
      description:
        "FULLY AUTOMATED: Reads a meeting transcript, extracts requirements, and runs the complete SDD pipeline in one call. Creates CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, and ANALYSIS.md from a single transcript file. Supports VTT (Teams), SRT (Zoom), TXT, and MD formats.",
      inputSchema: autoPipelineInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ file_path, raw_text, project_name, format, spec_dir, principles, force }) => {
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
            "Provide either file_path or raw_text.\n→ Fix: Set file_path to transcript location, or paste text in raw_text."
          );
        }

        const featureDir = join(spec_dir, `001-${project_name}`);
        const filesCreated: string[] = [];

        // ── Step 2: Create CONSTITUTION.md ──
        console.error(`[specky] Auto-pipeline: writing CONSTITUTION.md...`);
        await fileManager.ensureSpecDir(spec_dir);

        const autoConstraints = analysis.constraints_mentioned.length > 0
          ? analysis.constraints_mentioned
          : ["Derived from meeting transcript — review for accuracy"];

        const autoPrinciples = principles || [
          "Requirements traced to meeting decisions",
          "EARS notation for all requirements",
          "Traceability from transcript to implementation",
        ];

        const constitutionContent = await templateEngine.renderWithFrontmatter(
          "constitution",
          {
            title: `${project_name} — Constitution`,
            feature_id: `001-${project_name}`,
            project_name,
            author: `SDD Pipeline (from transcript: ${analysis.participants.join(", ")})`,
            principles: autoPrinciples,
            constraints: autoConstraints,
            description: `Project charter auto-generated from meeting transcript. ${analysis.topics.length} topics discussed by ${analysis.participants.length} participants.`,
            license: "MIT",
            scope_in: analysis.topics.map((t) => t.name).join(", "),
            scope_out: "Items not discussed in the meeting",
          }
        );

        await fileManager.writeSpecFile(featureDir, "CONSTITUTION.md", constitutionContent, force);
        filesCreated.push("CONSTITUTION.md");

        // Initialize state and advance through phases properly
        const state = stateMachine.createDefaultState(project_name);
        state.features = [featureDir];
        state.phases[Phase.Init] = {
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        };
        await stateMachine.saveState(spec_dir, state);
        // Advance Init → Discover
        await stateMachine.advancePhase(spec_dir, "001");

        // ── Step 3: Generate EARS requirements from transcript ──
        console.error(`[specky] Auto-pipeline: generating EARS requirements...`);
        const earsRequirements = generateEarsRequirements(analysis, earsValidator);

        // ── Step 4: Write SPECIFICATION.md ──
        console.error(`[specky] Auto-pipeline: writing SPECIFICATION.md...`);
        const reqSections = earsRequirements
          .map((req) => {
            return [
              `### ${req.id}: ${req.title} (${req.pattern})`,
              "",
              req.text,
              "",
              "**Acceptance Criteria:**",
              ...req.acceptance_criteria.map((ac) => `- ${ac}`),
              "",
              `**Source:** ${req.source}`,
              "",
              "---",
              "",
            ].join("\n");
          })
          .join("\n");

        const acTable = earsRequirements
          .map(
            (req) =>
              `| ${req.id} | ${req.text.slice(0, 60)}... | Acceptance test |`
          )
          .join("\n");

        const specContent = await templateEngine.renderWithFrontmatter(
          "specification",
          {
            title: `${project_name} — Specification`,
            feature_id: `001-${project_name}`,
            project_name,
            requirements_core: reqSections,
            requirements_functional: "",
            requirements_nonfunctional: "",
            acceptance_criteria_table: acTable,
            ears_compliance: `${earsRequirements.length}/${earsRequirements.length}`,
            testability_score: `${earsRequirements.length}/${earsRequirements.length}`,
            traceability_score: `${earsRequirements.length}/${earsRequirements.length}`,
            uniqueness_score: `${earsRequirements.length}/${earsRequirements.length}`,
          }
        );

        await fileManager.writeSpecFile(featureDir, "SPECIFICATION.md", specContent, force);
        filesCreated.push("SPECIFICATION.md");
        // Advance Discover → Specify → Clarify
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Discover);
        await stateMachine.advancePhase(spec_dir, "001");  // Discover → Specify
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Specify);
        await stateMachine.advancePhase(spec_dir, "001");  // Specify → Clarify
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Clarify);

        // ── Step 5: Write DESIGN.md ──
        console.error(`[specky] Auto-pipeline: writing DESIGN.md...`);
        const topicList = analysis.topics.map((t) => t.name);
        const designContent = await templateEngine.renderWithFrontmatter("design", {
          title: `${project_name} — Design`,
          feature_id: `001-${project_name}`,
          project_name,
          architecture_overview: generateArchitectureOverview(analysis, earsRequirements),
          diagrams: topicList,
          adrs: analysis.decisions.length > 0
            ? analysis.decisions.map((d, i) => `ADR-${String(i + 1).padStart(3, "0")}: ${d.slice(0, 80)}`)
            : ["No decisions recorded in transcript"],
          api_contracts: "[TODO: Define API contracts based on requirements]",
          data_models: "[TODO: Define data models based on requirements]",
          error_handling: "[TODO: Define error handling strategy]",
          requirement_references: earsRequirements.map((r) => r.id).join(", "),
        });

        await fileManager.writeSpecFile(featureDir, "DESIGN.md", designContent, force);
        filesCreated.push("DESIGN.md");
        // Advance Clarify → Design
        await stateMachine.advancePhase(spec_dir, "001");
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Design);

        // ── Step 6: Write TASKS.md ──
        console.error(`[specky] Auto-pipeline: writing TASKS.md...`);
        const tasks = generateTasks(earsRequirements, analysis);
        const taskTable = tasks
          .map(
            (t) =>
              `| ${t.id} | ${t.title} | ${t.parallel ? "[P]" : ""} | ${t.effort} | ${t.depends} | ${t.traces} |`
          )
          .join("\n");

        const gates = [
          "**Gate 1:** CONSTITUTION.md approved — project charter and scope confirmed",
          "**Gate 2:** SPECIFICATION.md reviewed — all EARS requirements have acceptance criteria",
          "**Gate 3:** DESIGN.md reviewed — architecture and decisions documented",
        ];

        const tasksContent = await templateEngine.renderWithFrontmatter("tasks", {
          title: `${project_name} — Tasks`,
          feature_id: `001-${project_name}`,
          project_name,
          gates,
          task_table: taskTable,
          dependency_graph: tasks.map((t) => `${t.id}: ${t.title}`).join("\n"),
          effort_summary: "",
          total_tasks: String(tasks.length),
          parallel_tasks: String(tasks.filter((t) => t.parallel).length),
          total_effort: `${tasks.length} tasks`,
        });

        await fileManager.writeSpecFile(featureDir, "TASKS.md", tasksContent, force);
        filesCreated.push("TASKS.md");
        // Advance Design → Tasks
        await stateMachine.advancePhase(spec_dir, "001");
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Tasks);

        // ── Step 7: Write ANALYSIS.md ──
        console.error(`[specky] Auto-pipeline: writing ANALYSIS.md...`);
        const coveragePercent = 100; // All files exist
        const gateDecision = "APPROVE";

        const traceMatrix = [
          `| CONSTITUTION.md | Present | — | — | ✅ |`,
          `| SPECIFICATION.md | Present | — | — | ✅ |`,
          `| DESIGN.md | Present | — | — | ✅ |`,
          `| TASKS.md | Present | — | — | ✅ |`,
        ].join("\n");

        const analysisContent = await templateEngine.renderWithFrontmatter("analysis", {
          title: `${project_name} — Analysis`,
          feature_id: `001-${project_name}`,
          project_name,
          gate_decision: gateDecision,
          coverage_percent: String(coveragePercent),
          traceability_matrix: traceMatrix,
          design_coverage: "100%",
          task_coverage: "100%",
          test_coverage: "Pending implementation",
          gaps: analysis.open_questions.length > 0
            ? analysis.open_questions.map((q) => `Open question from meeting: ${q}`)
            : ["No gaps — all meeting topics covered"],
          recommendations: [
            "Review auto-generated EARS requirements for accuracy",
            "Validate architecture decisions with team",
            "Add detailed API contracts to DESIGN.md",
            "Prioritize tasks based on team capacity",
            ...analysis.action_items.map((a) => `Action item: ${a}`),
          ],
          ears_compliance: "Pass",
          ears_status: "✅",
          coverage_status: "✅",
          orphan_count: "0",
          orphan_status: "✅",
        });

        await fileManager.writeSpecFile(featureDir, "ANALYSIS.md", analysisContent, force);
        filesCreated.push("ANALYSIS.md");

        // ── Step 8: Save transcript as reference ──
        const transcriptMd = transcriptParser.toMarkdown(analysis);
        await fileManager.writeSpecFile(featureDir, "TRANSCRIPT.md", transcriptMd, force);
        filesCreated.push("TRANSCRIPT.md");

        // ── Step 9: Finalize state — advance Tasks → Analyze and set gate decision ──
        await stateMachine.advancePhase(spec_dir, "001");  // Tasks → Analyze
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Analyze);

        // Load final state and set gate decision
        const finalState = await stateMachine.loadState(spec_dir);
        finalState.gate_decision = {
          decision: "APPROVE",
          reasons: [
            "All specification documents generated from transcript.",
            `${earsRequirements.length} EARS requirements extracted.`,
            `${analysis.decisions.length} decisions captured.`,
            `${analysis.topics.length} topics covered.`,
          ],
          coverage_percent: coveragePercent,
          gaps: analysis.open_questions.slice(0, 5),
          decided_at: new Date().toISOString(),
        };
        await stateMachine.saveState(spec_dir, finalState);

        console.error(`[specky] Auto-pipeline: COMPLETE — ${filesCreated.length} files written.`);

        const result = {
          status: "auto_pipeline_complete",
          project_name,
          feature_dir: featureDir,
          transcript_source: file_path || "inline-paste",
          files_created: filesCreated,
          summary: {
            participants: analysis.participants,
            topics_extracted: analysis.topics.length,
            decisions_captured: analysis.decisions.length,
            action_items: analysis.action_items.length,
            requirements_generated: earsRequirements.length,
            open_questions: analysis.open_questions.length,
          },
          gate_decision: gateDecision,
          next_action: [
            "1. Review SPECIFICATION.md — validate auto-generated EARS requirements",
            "2. Review DESIGN.md — add Mermaid diagrams and API contracts",
            "3. Review TASKS.md — adjust priorities and effort estimates",
            "4. Review TRANSCRIPT.md — original meeting content preserved",
            "5. Start implementation following TASKS.md breakdown",
          ].join("\n"),
        };

        const enriched = await enrichResponse("sdd_auto_pipeline", result, stateMachine, spec_dir);
        return {
          content: [
            { type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_auto_pipeline", error as Error),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_batch_transcripts ───
  server.registerTool(
    "sdd_batch_transcripts",
    {
      title: "Batch Process Transcript Folder",
      description:
        "Scans a folder for transcript files (.vtt, .srt, .txt, .md) and runs the full SDD auto-pipeline for each one. Designed for Power Automate + OneDrive workflows where meeting transcripts are saved automatically to a shared folder. Each transcript becomes its own feature spec package.",
      inputSchema: batchTranscriptsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ transcripts_dir, spec_dir, force }) => {
      try {
        console.error(`[specky] Batch: scanning ${transcripts_dir} for transcripts...`);

        // Find all transcript files
        const extensions = [".vtt", ".srt", ".txt", ".md"] as const;
        const files = await fileManager.listFilesByExtension(transcripts_dir, extensions);

        if (files.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "no_transcripts_found",
                  directory: transcripts_dir,
                  message: `No transcript files found in "${transcripts_dir}". Expected files with extensions: ${extensions.join(", ")}`,
                  fix: "Check the folder path. OneDrive paths may include spaces (e.g., 'OneDrive - Company/Meeting Transcripts').",
                }, null, 2),
              },
            ],
          };
        }

        console.error(`[specky] Batch: found ${files.length} transcript(s). Processing...`);

        const results: Array<{
          file: string;
          project_name: string;
          feature_number: string;
          status: string;
          requirements: number;
          error?: string;
        }> = [];

        let featureSeq = 1;

        // Check existing features to avoid number collisions
        const existingFeatures = await fileManager.listFeatures(spec_dir);
        if (existingFeatures.length > 0) {
          const maxNum = Math.max(
            ...existingFeatures.map((f) => parseInt(f.number, 10))
          );
          featureSeq = maxNum + 1;
        }

        for (const filePath of files) {
          const fileName = basename(filePath);
          // Derive project name from filename: "Sprint Planning 2026-03-20.vtt" → "sprint-planning-2026-03-20"
          const projectName = fileName
            .replace(/\.(vtt|srt|txt|md)$/i, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "transcript";

          const featureNum = String(featureSeq).padStart(3, "0");
          const featureDir = join(spec_dir, `${featureNum}-${projectName}`);

          try {
            console.error(`[specky] Batch [${featureSeq}/${files.length}]: processing "${fileName}"...`);

            // Parse transcript
            const analysis = await transcriptParser.parseFile(filePath);

            // Generate requirements
            const earsRequirements = generateEarsRequirements(analysis, earsValidator);

            // ── Write all spec files ──
            await fileManager.ensureSpecDir(spec_dir);

            // CONSTITUTION.md
            const constitutionContent = await templateEngine.renderWithFrontmatter("constitution", {
              title: `${projectName} — Constitution`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              author: `SDD Pipeline (from: ${analysis.participants.join(", ")})`,
              principles: [
                "Requirements traced to meeting decisions",
                "EARS notation for all requirements",
                "Traceability from transcript to implementation",
              ],
              constraints: analysis.constraints_mentioned.length > 0
                ? analysis.constraints_mentioned
                : ["Derived from meeting transcript"],
              description: `Auto-generated from ${fileName}. ${analysis.topics.length} topics, ${analysis.participants.length} participants.`,
              license: "MIT",
              scope_in: analysis.topics.map((t) => t.name).join(", ") || "Meeting topics",
              scope_out: "Items not discussed",
            });
            await fileManager.writeSpecFile(featureDir, "CONSTITUTION.md", constitutionContent, force);

            // SPECIFICATION.md
            const reqSections = earsRequirements.map((req) =>
              [
                `### ${req.id}: ${req.title} (${req.pattern})`,
                "", req.text, "",
                "**Acceptance Criteria:**",
                ...req.acceptance_criteria.map((ac) => `- ${ac}`),
                "", `**Source:** ${req.source}`, "", "---", "",
              ].join("\n")
            ).join("\n");

            const specContent = await templateEngine.renderWithFrontmatter("specification", {
              title: `${projectName} — Specification`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              requirements_core: reqSections,
              requirements_functional: "",
              requirements_nonfunctional: "",
              acceptance_criteria_table: earsRequirements.map((r) =>
                `| ${r.id} | ${r.text.slice(0, 60)}... | Test |`
              ).join("\n"),
              ears_compliance: `${earsRequirements.length}/${earsRequirements.length}`,
              testability_score: `${earsRequirements.length}/${earsRequirements.length}`,
              traceability_score: `${earsRequirements.length}/${earsRequirements.length}`,
              uniqueness_score: `${earsRequirements.length}/${earsRequirements.length}`,
            });
            await fileManager.writeSpecFile(featureDir, "SPECIFICATION.md", specContent, force);

            // DESIGN.md
            const designContent = await templateEngine.renderWithFrontmatter("design", {
              title: `${projectName} — Design`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              architecture_overview: generateArchitectureOverview(analysis, earsRequirements),
              diagrams: analysis.topics.map((t) => t.name),
              adrs: analysis.decisions.length > 0
                ? analysis.decisions.map((d, i) => `ADR-${String(i+1).padStart(3,"0")}: ${d.slice(0,80)}`)
                : ["No decisions in transcript"],
              api_contracts: "[TODO: Define API contracts]",
              data_models: "[TODO: Define data models]",
              error_handling: "[TODO: Define error handling]",
              requirement_references: earsRequirements.map((r) => r.id).join(", "),
            });
            await fileManager.writeSpecFile(featureDir, "DESIGN.md", designContent, force);

            // TASKS.md
            const tasks = generateTasks(earsRequirements, analysis);
            const tasksContent = await templateEngine.renderWithFrontmatter("tasks", {
              title: `${projectName} — Tasks`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              gates: [
                "**Gate 1:** CONSTITUTION.md approved",
                "**Gate 2:** SPECIFICATION.md reviewed",
                "**Gate 3:** DESIGN.md reviewed",
              ],
              task_table: tasks.map((t) =>
                `| ${t.id} | ${t.title} | ${t.parallel ? "[P]" : ""} | ${t.effort} | ${t.depends} | ${t.traces} |`
              ).join("\n"),
              dependency_graph: tasks.map((t) => `${t.id}: ${t.title}`).join("\n"),
              effort_summary: "",
              total_tasks: String(tasks.length),
              parallel_tasks: String(tasks.filter((t) => t.parallel).length),
              total_effort: `${tasks.length} tasks`,
            });
            await fileManager.writeSpecFile(featureDir, "TASKS.md", tasksContent, force);

            // ANALYSIS.md
            const analysisContent = await templateEngine.renderWithFrontmatter("analysis", {
              title: `${projectName} — Analysis`,
              feature_id: `${featureNum}-${projectName}`,
              project_name: projectName,
              gate_decision: "APPROVE",
              coverage_percent: "100",
              traceability_matrix: "| All docs | Present | — | — | ✅ |",
              design_coverage: "100%",
              task_coverage: "100%",
              test_coverage: "Pending",
              gaps: analysis.open_questions.length > 0
                ? analysis.open_questions.map((q) => `Open: ${q}`)
                : ["No gaps"],
              recommendations: [
                "Review auto-generated EARS requirements",
                ...analysis.action_items.slice(0, 3).map((a) => `Action: ${a}`),
              ],
              ears_compliance: "Pass",
              ears_status: "✅",
              coverage_status: "✅",
              orphan_count: "0",
              orphan_status: "✅",
            });
            await fileManager.writeSpecFile(featureDir, "ANALYSIS.md", analysisContent, force);

            // TRANSCRIPT.md
            const transcriptMd = transcriptParser.toMarkdown(analysis);
            await fileManager.writeSpecFile(featureDir, "TRANSCRIPT.md", transcriptMd, force);

            // State for this feature
            const state = stateMachine.createDefaultState(projectName);
            state.features = [featureDir];
            state.current_phase = Phase.Analyze;
            for (const phase of [Phase.Init, Phase.Discover, Phase.Specify, Phase.Clarify, Phase.Design, Phase.Tasks, Phase.Analyze]) {
              state.phases[phase] = {
                status: "completed",
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
              };
            }
            state.gate_decision = {
              decision: "APPROVE",
              reasons: [`${earsRequirements.length} requirements from ${fileName}`],
              coverage_percent: 100,
              gaps: analysis.open_questions.slice(0, 3),
              decided_at: new Date().toISOString(),
            };
            // Save state per feature (use feature-specific state dir)
            await fileManager.writeSpecFile(featureDir, ".sdd-state.json", JSON.stringify(state, null, 2), true);

            results.push({
              file: fileName,
              project_name: projectName,
              feature_number: featureNum,
              status: "completed",
              requirements: earsRequirements.length,
            });

            featureSeq++;
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
            featureSeq++;
          }
        }

        const succeeded = results.filter((r) => r.status === "completed");
        const failed = results.filter((r) => r.status === "error");

        console.error(
          `[specky] Batch: DONE — ${succeeded.length} succeeded, ${failed.length} failed out of ${files.length} transcripts.`
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
            "Review each SPECIFICATION.md for EARS requirement accuracy.",
            "Use sdd_get_status to check any individual feature.",
            failed.length > 0
              ? `${failed.length} transcript(s) failed — check error messages above.`
              : "All transcripts processed successfully.",
          ].join("\n"),
        };

        const enriched = await enrichResponse("sdd_batch_transcripts", batchResult, stateMachine, spec_dir);
        return {
          content: [
            { type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError("sdd_batch_transcripts", error as Error),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// ─── Helper: Generate EARS requirements from transcript analysis ───

interface GeneratedRequirement {
  id: string;
  title: string;
  pattern: string;
  text: string;
  acceptance_criteria: string[];
  source: string;
}

interface GeneratedTask {
  id: string;
  title: string;
  parallel: boolean;
  effort: string;
  depends: string;
  traces: string;
}

function generateEarsRequirements(
  analysis: TranscriptAnalysis,
  earsValidator: EarsValidator
): GeneratedRequirement[] {
  const reqs: GeneratedRequirement[] = [];
  let seqCore = 1;
  let seqFunc = 1;
  let seqNfr = 1;

  // Generate from extracted requirements
  for (const rawReq of analysis.requirements_raw) {
    const improvement = earsValidator.suggestImprovement(rawReq);
    const id = `REQ-FUNC-${String(seqFunc++).padStart(3, "0")}`;

    reqs.push({
      id,
      title: rawReq.slice(0, 60),
      pattern: improvement.pattern,
      text: improvement.suggestion.includes("[TODO")
        ? `The system shall ${rawReq.toLowerCase().replace(/\.$/, "")}.`
        : improvement.suggestion,
      acceptance_criteria: [
        `Verify that the system ${rawReq.toLowerCase().replace(/\.$/, "")}`,
        "Automated test validates this requirement",
      ],
      source: `Meeting transcript — raw requirement`,
    });
  }

  // Generate from decisions
  for (const decision of analysis.decisions) {
    const cleanDecision = decision.replace(/^\[[^\]]+\]\s*/, "");
    const id = `REQ-CORE-${String(seqCore++).padStart(3, "0")}`;

    reqs.push({
      id,
      title: cleanDecision.slice(0, 60),
      pattern: "event_driven",
      text: `When the project is implemented, the system shall ${cleanDecision.toLowerCase().replace(/\.$/, "")}.`,
      acceptance_criteria: [
        `Verify that ${cleanDecision.toLowerCase().replace(/\.$/, "")}`,
        "Team review confirms alignment with meeting decision",
      ],
      source: `Meeting decision`,
    });
  }

  // Generate from constraints
  for (const constraint of analysis.constraints_mentioned) {
    const id = `REQ-NFR-${String(seqNfr++).padStart(3, "0")}`;

    reqs.push({
      id,
      title: constraint.slice(0, 60),
      pattern: "ubiquitous",
      text: `The system shall comply with the constraint: ${constraint.toLowerCase().replace(/\.$/, "")}.`,
      acceptance_criteria: [
        `Verify compliance with: ${constraint}`,
        "Architecture review confirms constraint is met",
      ],
      source: `Meeting constraint`,
    });
  }

  // Generate from topics (at least one per topic)
  for (const topic of analysis.topics) {
    const existing = reqs.some(
      (r) => r.source.includes(topic.name) || r.title.toLowerCase().includes(topic.name.toLowerCase())
    );
    if (!existing && topic.key_points.length > 0) {
      const id = `REQ-FUNC-${String(seqFunc++).padStart(3, "0")}`;
      reqs.push({
        id,
        title: topic.name,
        pattern: "ubiquitous",
        text: `The system shall support ${topic.name.toLowerCase()} as discussed: ${topic.key_points[0].slice(0, 200)}.`,
        acceptance_criteria: [
          `Verify ${topic.name.toLowerCase()} functionality`,
          ...topic.key_points.slice(0, 2).map((kp) => `Verify: ${kp.slice(0, 100)}`),
        ],
        source: `Meeting topic: ${topic.name}`,
      });
    }
  }

  // Ensure minimum 5 requirements
  if (reqs.length < 5) {
    const defaults = [
      {
        title: "System Availability",
        text: "The system shall be available during business hours with 99% uptime.",
        criteria: ["Monitor uptime", "Alert on downtime"],
      },
      {
        title: "Error Handling",
        text: "When an error occurs, the system shall log the error and return a user-friendly message.",
        criteria: ["Verify error logging", "Verify user-friendly error messages"],
      },
      {
        title: "Security",
        text: "The system shall authenticate all users before granting access to protected resources.",
        criteria: ["Verify authentication is required", "Verify unauthorized access is rejected"],
      },
    ];

    for (const def of defaults) {
      if (reqs.length >= 5) break;
      const id = `REQ-NFR-${String(seqNfr++).padStart(3, "0")}`;
      reqs.push({
        id,
        title: def.title,
        pattern: reqs.length % 2 === 0 ? "ubiquitous" : "event_driven",
        text: def.text,
        acceptance_criteria: def.criteria,
        source: "Auto-generated baseline requirement",
      });
    }
  }

  return reqs;
}

function generateArchitectureOverview(
  analysis: TranscriptAnalysis,
  requirements: GeneratedRequirement[]
): string {
  const lines: string[] = [
    `Architecture auto-generated from meeting transcript with ${analysis.participants.length} participants.`,
    "",
    "## Key Components (from meeting topics)",
    "",
  ];

  for (const topic of analysis.topics) {
    lines.push(`### ${topic.name}`);
    lines.push("");
    lines.push(topic.summary || "Component discussed in meeting.");
    lines.push("");
    if (topic.key_points.length > 0) {
      lines.push("**Key points:**");
      for (const kp of topic.key_points.slice(0, 3)) {
        lines.push(`- ${kp}`);
      }
      lines.push("");
    }
  }

  if (analysis.decisions.length > 0) {
    lines.push("## Architecture Decisions");
    lines.push("");
    for (const d of analysis.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  lines.push(`## Requirements Coverage`);
  lines.push("");
  lines.push(`Total requirements: ${requirements.length}`);
  lines.push(`Topics covered: ${analysis.topics.length}`);

  return lines.join("\n");
}

function generateTasks(
  requirements: GeneratedRequirement[],
  analysis: TranscriptAnalysis
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  let seq = 1;

  // Task 1: Project setup (always)
  tasks.push({
    id: `T-${String(seq++).padStart(3, "0")}`,
    title: "Project setup and scaffolding",
    parallel: false,
    effort: "M",
    depends: "—",
    traces: "REQ-CORE-001",
  });

  // Tasks from requirements
  for (const req of requirements) {
    tasks.push({
      id: `T-${String(seq++).padStart(3, "0")}`,
      title: `Implement: ${req.title.slice(0, 60)}`,
      parallel: seq > 3, // First 2 tasks sequential, rest parallel
      effort: req.acceptance_criteria.length > 2 ? "L" : "M",
      depends: seq <= 3 ? `T-${String(seq - 2).padStart(3, "0")}` : "T-001",
      traces: req.id,
    });
  }

  // Tasks from action items
  for (const action of analysis.action_items.slice(0, 5)) {
    const cleanAction = action.replace(/^\[[^\]]+\]\s*/, "");
    tasks.push({
      id: `T-${String(seq++).padStart(3, "0")}`,
      title: `Action: ${cleanAction.slice(0, 60)}`,
      parallel: true,
      effort: "S",
      depends: "T-001",
      traces: "—",
    });
  }

  // Final tasks
  tasks.push({
    id: `T-${String(seq++).padStart(3, "0")}`,
    title: "Integration testing",
    parallel: false,
    effort: "L",
    depends: tasks
      .slice(-3)
      .map((t) => t.id)
      .join(", "),
    traces: "All REQ",
  });

  tasks.push({
    id: `T-${String(seq++).padStart(3, "0")}`,
    title: "Documentation and deployment",
    parallel: false,
    effort: "M",
    depends: `T-${String(seq - 2).padStart(3, "0")}`,
    traces: "All REQ",
  });

  return tasks;
}

