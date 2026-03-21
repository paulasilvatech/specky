/**
 * Integration Tools — sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { GitManager } from "../services/git-manager.js";
import type { WorkItemExporter } from "../services/work-item-exporter.js";
import type { ImplementationPlan, ImplementationPhase, ImplementationTask, ResearchEntry } from "../types.js";
import {
  createBranchInputSchema,
  exportWorkItemsInputSchema,
  createPrInputSchema,
  implementInputSchema,
  researchInputSchema,
} from "../schemas/integration.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerIntegrationTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  gitManager: GitManager,
  workItemExporter: WorkItemExporter
): void {
  // ─── sdd_create_branch ───
  server.registerTool(
    "sdd_create_branch",
    {
      title: "Create Feature Branch",
      description:
        "Generates a branch name following SDD conventions and returns a command_hint for creating the branch. Does not execute git commands — the AI client or user runs the command.",
      inputSchema: createBranchInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, branch_prefix, base_branch }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        const featureName = feature?.name || "unnamed-feature";

        const branchInfo = gitManager.generateBranchInfo(
          feature_number,
          featureName,
          branch_prefix,
          base_branch
        );

        const result = {
          status: "branch_info_generated",
          ...branchInfo,
          explanation: `Branch name '${branchInfo.name}' follows the SDD convention: ${branchInfo.convention}. Run the command_hint to create it.`,
          next_steps: `Execute: ${branchInfo.command_hint}`,
          learning_note: "SDD branch naming ties the feature number to the branch, enabling traceability from spec to code.",
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_create_branch", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_export_work_items ───
  server.registerTool(
    "sdd_export_work_items",
    {
      title: "Export Work Items",
      description:
        "Transforms TASKS.md into platform-specific work item payloads (GitHub Issues, Azure Boards, or Jira). Returns routing_instructions for the AI client to create items via the appropriate MCP server.",
      inputSchema: exportWorkItemsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ platform, feature_number, spec_dir, include_subtasks, project_key, area_path, iteration_path }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const exportResult = await workItemExporter.export(
          platform,
          spec_dir,
          feature.directory,
          include_subtasks,
          { project_key, area_path, iteration_path }
        );

        const result = {
          status: "work_items_exported",
          platform: exportResult.platform,
          items: exportResult.items,
          metadata: exportResult.metadata,
          routing_instructions: exportResult.routing_instructions,
          explanation: `Exported ${exportResult.items.length} work items for ${platform}. Route to ${exportResult.routing_instructions.mcp_server} MCP to create them.`,
          next_steps: `The AI client should call ${exportResult.routing_instructions.mcp_server} MCP's ${exportResult.routing_instructions.tool_name} for each item in the items array.`,
          learning_note: "Work items maintain traceability from TASKS.md through to your project management platform via the traces_to field.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_export_work_items", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_create_pr ───
  server.registerTool(
    "sdd_create_pr",
    {
      title: "Create Pull Request Payload",
      description:
        "Generates a pull request payload from SPECIFICATION.md and TASKS.md with spec summary, requirements covered, and task progress. Returns routing_instructions for GitHub MCP's create_pull_request tool.",
      inputSchema: createPrInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ feature_number, spec_dir, base_branch, head_branch, draft }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        const prPayload = await gitManager.generatePrPayload(
          feature.directory,
          feature_number,
          base_branch,
          head_branch
        );

        const result = {
          status: "pr_payload_generated",
          title: prPayload.title,
          body: prPayload.body,
          base_branch: prPayload.base_branch,
          head_branch: prPayload.head_branch,
          labels: prPayload.labels,
          draft,
          spec_summary: prPayload.spec_summary,
          requirements_covered: prPayload.requirements_covered,
          routing_instructions: prPayload.routing_instructions,
          explanation: `PR payload generated for '${prPayload.title}'. Covers ${prPayload.requirements_covered.length} requirements.`,
          next_steps: "Route this payload to GitHub MCP's create_pull_request tool to open the PR.",
          learning_note: "SDD pull requests include spec artifact references and requirement coverage, enabling reviewers to trace code changes back to requirements.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_create_pr", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_implement ───
  server.registerTool(
    "sdd_implement",
    {
      title: "Generate Implementation Plan",
      description:
        "Reads TASKS.md and produces an ordered implementation roadmap with phases, parallel groups, dependency resolution, and checkpoints. Does NOT write code — it generates the plan the developer or AI agent follows.",
      inputSchema: implementInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, task_ids, checkpoint }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_write_tasks first.`);
        }

        const tasksContent = await fileManager.readSpecFile(feature.directory, "TASKS.md");

        // Parse tasks from TASKS.md
        const allTasks = parseTasks(tasksContent);

        // Filter to requested task_ids if provided
        const targetTasks = task_ids
          ? allTasks.filter((t) => task_ids.includes(t.id))
          : allTasks;

        if (targetTasks.length === 0) {
          throw new Error("No tasks found. Ensure TASKS.md contains tasks in the format: - [ ] T001 Task title");
        }

        // Build dependency graph and sort into phases
        const phases = buildPhases(targetTasks, checkpoint);

        // Count parallel opportunities
        const parallelOpportunities = phases.reduce(
          (sum, p) => sum + (p.tasks.filter((t) => t.parallel).length > 1 ? 1 : 0),
          0
        );

        // Generate Mermaid Gantt diagram
        const diagram = generateGanttDiagram(phases);

        const plan: ImplementationPlan = {
          feature_number,
          phases,
          total_tasks: targetTasks.length,
          parallel_opportunities: parallelOpportunities,
          estimated_checkpoints: phases.filter((p) => p.checkpoint).length,
          diagram,
          explanation: `Implementation plan with ${phases.length} phases covering ${targetTasks.length} tasks. ${parallelOpportunities} parallel opportunities detected.`,
          next_steps: "Follow the phases in order. Pause at each checkpoint for review. Tasks marked parallel can be executed simultaneously.",
        };

        const result = {
          status: "implementation_plan_generated",
          ...plan,
          learning_note: "Implementation plans resolve task dependencies to find the optimal execution order. Parallel groups reduce total implementation time.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_implement", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_research ───
  server.registerTool(
    "sdd_research",
    {
      title: "Research Questions",
      description:
        "Takes an array of research questions, generates RESEARCH.md with structured entries (question, findings placeholder, sources, recommendation, status), and writes it to the feature directory.",
      inputSchema: researchInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, questions }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        const featureDir = feature?.directory || join(spec_dir, `${feature_number}-research`);

        const entries: ResearchEntry[] = questions.map((q) => ({
          id: q.id,
          question: q.question,
          findings: "[TODO: Document findings after investigation]",
          sources: [],
          recommendation: "[TODO: Provide recommendation based on findings]",
          status: "open" as const,
        }));

        // Build RESEARCH.md content
        const today = new Date().toISOString().split("T")[0];
        let content = `---\ntitle: Research Log\nfeature: ${feature_number}\ndate: ${today}\nstatus: in_progress\n---\n\n`;
        content += `# Research Log — Feature ${feature_number}\n\n`;
        content += `**Generated**: ${new Date().toISOString()}\n**Total Questions**: ${entries.length}\n\n---\n\n`;

        for (const entry of entries) {
          const q = questions.find((qu) => qu.id === entry.id);
          content += `## ${entry.id}: ${entry.question}\n\n`;
          if (q?.context) content += `**Context**: ${q.context}\n\n`;
          content += `**Status**: ${entry.status}\n\n`;
          content += `### Findings\n\n${entry.findings}\n\n`;
          content += `### Sources\n\n- (none yet)\n\n`;
          content += `### Recommendation\n\n${entry.recommendation}\n\n`;
          content += `---\n\n`;
        }

        const filePath = await fileManager.writeSpecFile(featureDir, "RESEARCH.md", content, true);

        const result = {
          status: "research_created",
          file: filePath,
          feature_number,
          entries,
          total_questions: entries.length,
          open_count: entries.filter((e) => e.status === "open").length,
          explanation: `Created RESEARCH.md with ${entries.length} research questions. All marked as 'open' for investigation.`,
          next_steps: "Investigate each question, update findings and recommendations in RESEARCH.md, then mark as 'resolved' or 'deferred'.",
          learning_note: "Research logs capture unknowns early in the spec process. Resolving them before design prevents costly rework later.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_research", error as Error) }],
          isError: true,
        };
      }
    }
  );
}

// ─── Helper functions for sdd_implement ───

interface ParsedTask {
  id: string;
  title: string;
  dependencies: string[];
  traces_to: string[];
  file_path?: string;
}

function parseTasks(tasksContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const taskRegex = /^-\s+\[[ x]\]\s+(T\d{3})\s+(?:\[P\]\s+)?(?:\[(US\d+)\]\s+)?(.+)/gm;
  let match;
  while ((match = taskRegex.exec(tasksContent)) !== null) {
    const id = match[1];
    const title = match[3].trim();

    // Extract dependency references like "depends: T001, T002"
    const depMatch = title.match(/depends?:\s*(T\d{3}(?:\s*,\s*T\d{3})*)/i);
    const dependencies = depMatch
      ? depMatch[1].split(",").map((d) => d.trim())
      : [];

    // Extract REQ references
    const reqIds: string[] = [];
    const reqRegex = /REQ-[A-Z]+-\d{3}/g;
    let reqMatch;
    while ((reqMatch = reqRegex.exec(title)) !== null) reqIds.push(reqMatch[0]);

    tasks.push({ id, title, dependencies, traces_to: reqIds });
  }
  return tasks;
}

function buildPhases(tasks: ParsedTask[], includeCheckpoints: boolean): ImplementationPhase[] {
  const phases: ImplementationPhase[] = [];
  const completed = new Set<string>();
  let remaining = [...tasks];
  let phaseIndex = 1;

  while (remaining.length > 0) {
    // Find tasks whose dependencies are all completed
    const ready = remaining.filter((t) =>
      t.dependencies.every((d) => completed.has(d))
    );

    if (ready.length === 0) {
      // Circular dependency or missing deps — add remaining as final phase
      phases.push({
        name: `Phase ${phaseIndex} (unresolved dependencies)`,
        tasks: remaining.map((t) => ({
          id: t.id,
          title: t.title,
          file_path: t.file_path,
          parallel: false,
          dependencies: t.dependencies,
          traces_to: t.traces_to,
        })),
        checkpoint: includeCheckpoints,
      });
      break;
    }

    const phaseTasks: ImplementationTask[] = ready.map((t) => ({
      id: t.id,
      title: t.title,
      file_path: t.file_path,
      parallel: ready.length > 1,
      dependencies: t.dependencies,
      traces_to: t.traces_to,
    }));

    phases.push({
      name: `Phase ${phaseIndex}`,
      tasks: phaseTasks,
      checkpoint: includeCheckpoints,
    });

    for (const t of ready) completed.add(t.id);
    remaining = remaining.filter((t) => !completed.has(t.id));
    phaseIndex++;
  }

  return phases;
}

function generateGanttDiagram(phases: ImplementationPhase[]): string {
  let diagram = "gantt\n  title Implementation Plan\n  dateFormat YYYY-MM-DD\n";
  for (const phase of phases) {
    diagram += `  section ${phase.name}\n`;
    for (const task of phase.tasks) {
      const deps = task.dependencies.length > 0
        ? `after ${task.dependencies.join(" ")}`
        : "";
      diagram += `    ${task.id} ${task.title.substring(0, 30)} :${task.id}, ${deps || "active"}, 1d\n`;
    }
    if (phase.checkpoint) {
      diagram += `    Checkpoint :milestone, 0d\n`;
    }
  }
  return diagram;
}
