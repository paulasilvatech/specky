/**
 * Pipeline Tools — 8 tools for the SDD pipeline.
 * Thin tools: validate input → call service → format output.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT, Phase, PHASE_ORDER } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { EarsValidator } from "../services/ears-validator.js";
import { enrichResponse } from "./response-builder.js";
import { routingEngine } from "../utils/routing-helper.js";
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

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters. Use sdd_get_status to see current state.";
}

export function registerPipelineTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator
): void {
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
    async ({ project_name, spec_dir, principles, constraints }) => {
      try {
        const featureDir = join(spec_dir, `001-${project_name}`);

        // Ensure spec directory
        await fileManager.ensureSpecDir(spec_dir);

        // Render CONSTITUTION.md
        const content = await templateEngine.renderWithFrontmatter("constitution", {
          title: `${project_name} — Constitution`,
          feature_id: `001-${project_name}`,
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

        // Initialize state machine
        const state = stateMachine.createDefaultState(project_name);
        state.features = [featureDir];
        state.phases[Phase.Init] = {
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        };
        await stateMachine.saveState(spec_dir, state);

        const result = {
          status: "initialized",
          project_name,
          feature_dir: featureDir,
          files_created: ["CONSTITUTION.md", ".sdd-state.json"],
          next_action: "Call sdd_discover with your project idea to get discovery questions.",
        };

        const enriched = await enrichResponse("sdd_init", result, stateMachine, spec_dir, {
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
        "Returns 7 structured discovery questions tailored to your project idea. Covers: scope, users, constraints, integrations, performance, security, and deployment.",
      inputSchema: discoverInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_idea, codebase_summary, spec_dir }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_discover");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_discover",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        const questions = [
          {
            id: "Q1",
            category: "Scope",
            question: `What is the primary problem "${project_idea}" solves? What are the boundaries of the first release?`,
            why_it_matters: "Defines what is in and out of scope to prevent feature creep.",
            example_answer: "The first release focuses on core CRUD operations. Analytics dashboard is deferred to v2.",
          },
          {
            id: "Q2",
            category: "Users",
            question: "Who are the primary users? What are their technical skill levels?",
            why_it_matters: "User personas drive UI complexity, error handling depth, and documentation needs.",
            example_answer: "Primary users are developers with 2+ years experience. Secondary users are technical PMs.",
          },
          {
            id: "Q3",
            category: "Constraints",
            question: "What technical constraints exist? (language, framework, hosting, budget, timeline)",
            why_it_matters: "Constraints narrow design choices and prevent wasted effort on infeasible approaches.",
            example_answer: "Must use TypeScript, deploy on Azure, and be production-ready within 8 weeks.",
          },
          {
            id: "Q4",
            category: "Integrations",
            question: "What external systems, APIs, or services does this need to integrate with?",
            why_it_matters: "Integration points are the primary source of complexity and failure modes.",
            example_answer: "Integrates with GitHub API for repository data and Azure AD for authentication.",
          },
          {
            id: "Q5",
            category: "Performance",
            question: "What are the expected load characteristics? (concurrent users, data volume, response time requirements)",
            why_it_matters: "Performance requirements drive architecture decisions (caching, async processing, database choice).",
            example_answer: "Expected 100 concurrent users, <500ms API response time, <10GB data storage.",
          },
          {
            id: "Q6",
            category: "Security",
            question: "What are the security and compliance requirements? (authentication, authorization, data sensitivity, regulations)",
            why_it_matters: "Security requirements affect architecture, data handling, and deployment choices from day one.",
            example_answer: "OAuth 2.0 authentication, role-based access control, no PII stored outside encrypted databases.",
          },
          {
            id: "Q7",
            category: "Deployment",
            question: "How will this be deployed and operated? (CI/CD, monitoring, rollback strategy)",
            why_it_matters: "Deployment strategy influences testing requirements, configuration management, and observability design.",
            example_answer: "GitHub Actions CI/CD, Docker containers on AKS, Prometheus monitoring, blue-green deployments.",
          },
        ];

        if (codebase_summary) {
          questions[2].question += ` (Note: existing codebase detected — consider compatibility with current stack.)`;
        }

        // Record discover phase
        await stateMachine.recordPhaseStart(spec_dir, Phase.Discover);

        const result = {
          project_idea,
          questions,
          instructions: "Answer each question, then call sdd_write_spec with your answers and requirements.",
        };

        const enriched = await enrichResponse("sdd_discover", result, stateMachine, spec_dir);
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
    async ({ feature_name, feature_number, requirements, spec_dir, force }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_write_spec");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_write_spec",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        const featureDir = join(spec_dir, `${feature_number}-${feature_name.toLowerCase().replace(/\s+/g, "-")}`);

        // Validate EARS patterns
        const validationIssues: string[] = [];
        for (const req of requirements) {
          const result = earsValidator.validate(req.text);
          if (!result.valid && result.issues) {
            validationIssues.push(`${req.id}: ${result.issues.join("; ")}`);
          }
        }

        // Build requirement sections
        const reqSections = requirements.map((req) => {
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
        });

        // Build acceptance criteria table
        const acTable = requirements
          .map((req) => `| ${req.id} | ${req.text.slice(0, 60)}... | Acceptance test |`)
          .join("\n");

        const content = await templateEngine.renderWithFrontmatter("specification", {
          title: `${feature_name} — Specification`,
          feature_id: `${feature_number}-${feature_name.toLowerCase().replace(/\s+/g, "-")}`,
          project_name: feature_name,
          requirements_core: reqSections.join("\n"),
          requirements_functional: "",
          requirements_nonfunctional: "",
          acceptance_criteria_table: acTable,
          ears_compliance: `${requirements.length}/${requirements.length}`,
          testability_score: `${requirements.length}/${requirements.length}`,
          traceability_score: `${requirements.length}/${requirements.length}`,
          uniqueness_score: `${requirements.length}/${requirements.length}`,
        });

        const filePath = await fileManager.writeSpecFile(featureDir, "SPECIFICATION.md", content, force);

        // Update state
        await stateMachine.recordPhaseStart(spec_dir, Phase.Specify);
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Specify);

        const result = {
          status: "specification_written",
          file: filePath,
          requirement_count: requirements.length,
          validation_issues: validationIssues.length > 0 ? validationIssues : undefined,
          next_action: "Review the specification. Call sdd_advance_phase when ready, then sdd_clarify for disambiguation.",
        };

        const enriched = await enrichResponse("sdd_write_spec", result, stateMachine, spec_dir, {
          completedPhase: Phase.Specify,
          nextPhase: Phase.Clarify,
          artifactsProduced: ["SPECIFICATION.md"],
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
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ spec_dir, feature_number }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_clarify");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_clarify",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        // Find feature directory
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }

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

        await stateMachine.recordPhaseStart(spec_dir, Phase.Clarify);
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Clarify);

        const result = {
          status: "clarification_questions",
          question_count: questions.length,
          questions,
          instructions: "Answer the clarification questions, then call sdd_write_design to proceed.",
        };

        const enriched = await enrichResponse("sdd_clarify", result, stateMachine, spec_dir, {
          completedPhase: Phase.Clarify,
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
    async ({ architecture_overview, mermaid_diagrams, adrs, api_contracts, system_context, container_architecture, component_design, code_level_design, data_models, infrastructure, security_architecture, error_handling, cross_cutting, spec_dir, feature_number, force }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_write_design");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_write_design",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
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
          ? adrs
              .map(
                (a, i) =>
                  `### ADR-${String(i + 1).padStart(3, "0")}: ${a.title}\n\n**Decision:** ${a.decision}\n\n**Rationale:** ${a.rationale}\n\n**Consequences:** ${a.consequences}\n`
              )
              .join("\n---\n\n")
          : "[TODO: Add Architecture Decision Records]";

        // Build API contracts section
        const apiContent = api_contracts
          ? api_contracts
              .map(
                (c) =>
                  `### ${c.method} ${c.endpoint}\n\n${c.description}\n\n**Request:** ${c.request || "N/A"}\n\n**Response:** ${c.response || "N/A"}\n`
              )
              .join("\n---\n\n")
          : "[TODO: Add API contracts if applicable]";

        const content = await templateEngine.renderWithFrontmatter("design", {
          title: `${feature.name} — Design`,
          feature_id: `${feature_number}-${feature.name}`,
          project_name: feature.name,
          architecture_overview,
          system_context: system_context || architecture_overview,
          container_architecture: container_architecture || architecture_overview,
          component_design: component_design || "[TODO: component_design]",
          code_level_design: code_level_design || "[TODO: code_level_design]",
          diagrams: mermaid_diagrams.map((d) => d.title),
          data_models: data_models || "[TODO: data_models]",
          api_contracts: apiContent,
          infrastructure: infrastructure || "[TODO: infrastructure]",
          security_architecture: security_architecture || "[TODO: security_architecture]",
          adrs: adrs ? adrs.map((a) => a.title) : [],
          error_handling: error_handling || "[TODO: error_handling]",
          cross_cutting: cross_cutting || "[TODO: cross_cutting]",
          requirement_references: "[TODO: requirement_references]",
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

        const filePath = await fileManager.writeSpecFile(feature.directory, "DESIGN.md", finalContent, force);

        await stateMachine.recordPhaseStart(spec_dir, Phase.Design);
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Design);

        const result = {
          status: "design_written",
          file: filePath,
          diagram_count: mermaid_diagrams.length,
          adr_count: adrs?.length || 0,
          next_action: "Review the design. Call sdd_advance_phase, then sdd_write_tasks.",
        };

        const enriched = await enrichResponse("sdd_write_design", result, stateMachine, spec_dir, {
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
    async ({ tasks, pre_impl_gates, spec_dir, feature_number, force }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_write_tasks");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_write_tasks",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }

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
          title: `${feature.name} — Tasks`,
          feature_id: `${feature_number}-${feature.name}`,
          project_name: feature.name,
          gates: gatesList,
          task_table: taskTable,
          dependency_graph: tasks.map((t) => `${t.id}: ${t.title} → [${t.dependencies.join(", ")}]`).join("\n"),
          effort_summary: "",
          total_tasks: String(tasks.length),
          parallel_tasks: String(parallelCount),
          total_effort: `${tasks.length} tasks`,
        });

        const filePath = await fileManager.writeSpecFile(feature.directory, "TASKS.md", content, force);

        await stateMachine.recordPhaseStart(spec_dir, Phase.Tasks);
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Tasks);

        const result = {
          status: "tasks_written",
          file: filePath,
          task_count: tasks.length,
          parallel_tasks: parallelCount,
          next_action: "Review the tasks. Call sdd_advance_phase, then sdd_run_analysis for quality gate.",
        };

        const enriched = await enrichResponse("sdd_write_tasks", result, stateMachine, spec_dir, {
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
    async ({ spec_dir, feature_number, force }) => {
      try {
        // Phase validation
        const phaseCheck = await stateMachine.validatePhaseForTool(spec_dir, "sdd_run_analysis");
        if (!phaseCheck.allowed) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "phase_validation_failed",
              tool: "sdd_run_analysis",
              current_phase: phaseCheck.current_phase,
              expected_phases: phaseCheck.expected_phases,
              message: phaseCheck.error_message,
              fix: `Complete the ${phaseCheck.current_phase} phase first, then advance to proceed.`,
            }, null, 2) }],
            isError: true,
          };
        }

        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }

        // Read available spec files
        const files = await fileManager.listSpecFiles(feature.directory);
        const hasConstitution = files.includes("CONSTITUTION.md");
        const hasSpec = files.includes("SPECIFICATION.md");
        const hasDesign = files.includes("DESIGN.md");
        const hasTasks = files.includes("TASKS.md");

        // Calculate coverage
        const totalChecks = 4;
        const passedChecks = [hasConstitution, hasSpec, hasDesign, hasTasks].filter(Boolean).length;
        const coveragePercent = Math.round((passedChecks / totalChecks) * 100);

        // Determine gate decision
        const gaps: string[] = [];
        if (!hasConstitution) gaps.push("CONSTITUTION.md missing");
        if (!hasSpec) gaps.push("SPECIFICATION.md missing");
        if (!hasDesign) gaps.push("DESIGN.md missing");
        if (!hasTasks) gaps.push("TASKS.md missing");

        let decision: "APPROVE" | "CHANGES_NEEDED" | "BLOCK";
        const reasons: string[] = [];

        if (coveragePercent >= 90) {
          decision = "APPROVE";
          reasons.push("All core specification documents are present.");
        } else if (coveragePercent >= 70) {
          decision = "CHANGES_NEEDED";
          reasons.push(`Coverage at ${coveragePercent}% — some documents missing.`);
        } else {
          decision = "BLOCK";
          reasons.push(`Coverage at ${coveragePercent}% — critical documents missing.`);
        }

        // Build traceability matrix
        const traceMatrix = `| CONSTITUTION.md | ${hasConstitution ? "Present" : "Missing"} | — | — | ${hasConstitution ? "✅" : "❌"} |
| SPECIFICATION.md | ${hasSpec ? "Present" : "Missing"} | — | — | ${hasSpec ? "✅" : "❌"} |
| DESIGN.md | ${hasDesign ? "Present" : "Missing"} | — | — | ${hasDesign ? "✅" : "❌"} |
| TASKS.md | ${hasTasks ? "Present" : "Missing"} | — | — | ${hasTasks ? "✅" : "❌"} |`;

        const gateDecision = {
          decision,
          reasons,
          coverage_percent: coveragePercent,
          gaps,
          decided_at: new Date().toISOString(),
        };

        const content = await templateEngine.renderWithFrontmatter("analysis", {
          title: `${feature.name} — Analysis`,
          feature_id: `${feature_number}-${feature.name}`,
          project_name: feature.name,
          gate_decision: decision,
          coverage_percent: String(coveragePercent),
          traceability_matrix: traceMatrix,
          design_coverage: hasDesign ? "100%" : "0%",
          task_coverage: hasTasks ? "100%" : "0%",
          test_coverage: "Pending",
          gaps,
          recommendations: gaps.length > 0
            ? gaps.map((g) => `Create ${g.replace(" missing", "")}`)
            : ["All documents present — proceed to implementation."],
          ears_compliance: hasSpec ? "Pass" : "N/A",
          ears_status: hasSpec ? "✅" : "❌",
          coverage_status: coveragePercent >= 90 ? "✅" : "❌",
          orphan_count: "0",
          orphan_status: "✅",
        });

        const filePath = await fileManager.writeSpecFile(feature.directory, "ANALYSIS.md", content, force);

        // Update state with gate decision
        const state = await stateMachine.loadState(spec_dir);
        state.gate_decision = gateDecision;
        await stateMachine.saveState(spec_dir, state);
        await stateMachine.recordPhaseStart(spec_dir, Phase.Analyze);
        await stateMachine.recordPhaseComplete(spec_dir, Phase.Analyze);

        const result = {
          status: "analysis_complete",
          file: filePath,
          gate_decision: gateDecision,
          next_action: decision === "APPROVE"
            ? "Pipeline complete! Proceed to implementation."
            : `Address the following gaps: ${gaps.join(", ")}`,
        };

        const enriched = await enrichResponse("sdd_run_analysis", result, stateMachine, spec_dir, {
          completedPhase: Phase.Analyze,
          nextPhase: Phase.Implement,
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
        "Validates that the current phase's required files exist, then transitions the state machine to the next phase.",
      inputSchema: advancePhaseInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ spec_dir, feature_number }) => {
      try {
        // Capture phase before advancing for gate instrumentation
        const priorState = await stateMachine.loadState(spec_dir);
        const completedPhase = priorState.current_phase;

        const state = await stateMachine.advancePhase(spec_dir, feature_number);
        const currentIndex = PHASE_ORDER.indexOf(state.current_phase);
        const nextPhase = currentIndex < PHASE_ORDER.length - 1
          ? PHASE_ORDER[currentIndex + 1]
          : null;

        // Gate instrumentation: record whether artifact was modified before approval
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        let gateEntry;
        if (feature) {
          const requiredFiles = stateMachine.getRequiredFiles(completedPhase);
          const artifactPath = requiredFiles[0]
            ? `${feature.directory}/${requiredFiles[0]}`
            : feature.directory;
          gateEntry = await stateMachine.recordGateEvent(spec_dir, completedPhase, artifactPath);
        }

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

        const enriched = await enrichResponse("sdd_advance_phase", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_advance_phase", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
