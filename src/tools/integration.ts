/**
 * Integration Tools — sdd_create_branch, sdd_export_work_items, sdd_create_pr, sdd_implement, sdd_research.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, truncate } from "./tool-result.js";
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
import { enrichResponse } from "./response-builder.js";
import { parseTasksFromMarkdown } from "../utils/task-parser.js";
import { requireExecutionContext } from "../services/execution-context.js";

export function registerIntegrationTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  _templateEngine: TemplateEngine,
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
    async () => {
      try {
        const context = requireExecutionContext("sdd_create_branch");
        const feature = context.feature!;
        const stateDir = context.stateDir!;
        const release = context.state!.contract.capability_config.release!;

        const branchInfo = gitManager.generateBranchInfo(
          feature.number,
          feature.name,
          release.branch_prefix,
          release.base_branch,
        );

        const result = {
          status: "branch_info_generated",
          ...branchInfo,
          explanation: `Branch name '${branchInfo.name}' follows the SDD convention: ${branchInfo.convention}. Run the command_hint to create it.`,
          next_steps: `Execute: ${branchInfo.command_hint}`,
          learning_note: "SDD branch naming ties the feature number to the branch, enabling traceability from spec to code.",
        };

        const enriched = await enrichResponse("sdd_create_branch", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
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
        "Transforms TASKS.md into platform-specific work item payloads: GitHub Issues {title, body, labels}, Jira {fields: {project.key, summary, description, issuetype}} (project_key required), or Azure Boards {work_item_type, fields: System.Title/System.Description/System.AreaPath/System.IterationPath}. Honors include_subtasks and preserves REQ/task traceability in every shape. Returns routing_instructions for the AI client to create items via the appropriate MCP server.",
      inputSchema: exportWorkItemsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const context = requireExecutionContext("sdd_export_work_items");
        const feature = context.feature!;
        const stateDir = context.stateDir!;
        const specDir = context.specDir!;
        const workItems = context.state!.contract.capability_config["work-items"]!;

        const exportResult = await workItemExporter.export(
          workItems.platform,
          specDir,
          feature.directory,
          workItems.include_subtasks,
          {
            project_key: workItems.project_key,
            area_path: workItems.area_path,
            iteration_path: workItems.iteration_path,
          },
        );

        const serverRecommendations: Record<string, { id: string; name: string; purpose: string; install_command: string; install_note: string }> = {
          github: {
            id: "github",
            name: "GitHub MCP Server",
            purpose: "Create GitHub Issues from the exported work items",
            install_command: 'VS Code MCP Gallery: search "GitHub"',
            install_note: "The AI client needs GitHub MCP to create the issues. If you see this message, ensure GitHub MCP is installed in your VS Code MCP settings.",
          },
          azure_boards: {
            id: "azure-devops",
            name: "Azure DevOps MCP Server",
            purpose: "Create Work Items in Azure Boards from the exported tasks",
            install_command: 'npx -y @azure-devops/mcp@latest <your-org> -d work-items',
            install_note: "The AI client needs Azure DevOps MCP to create work items. Replace <your-org> with your Azure DevOps organization name.",
          },
          jira: {
            id: "jira",
            name: "Jira MCP Server",
            purpose: "Create Jira Issues from the exported tasks",
            install_command: "Search VS Code MCP Gallery for Jira, or use npx @anthropic/jira-mcp-server",
            install_note: "The AI client needs Jira MCP to create issues. Requires a Jira API token.",
          },
        };

        const result = {
          status: "work_items_exported",
          platform: exportResult.platform,
          items: exportResult.items,
          metadata: exportResult.metadata,
          routing_instructions: exportResult.routing_instructions,
          recommended_servers: [serverRecommendations[workItems.platform]].filter(Boolean),
          explanation: `Exported ${exportResult.items.length} work items in the ${workItems.platform}-native payload shape. Route to ${exportResult.routing_instructions.mcp_server} MCP to create them.`,
          next_steps: `The AI client should call ${exportResult.routing_instructions.mcp_server} MCP's ${exportResult.routing_instructions.tool_name} for each item in the items array. ${exportResult.routing_instructions.note}`,
          learning_note: "Work items maintain traceability from TASKS.md through to your project management platform: every item carries task_id and traces_to, and the rendered body/description repeats the REQ references.",
        };

        const enriched = await enrichResponse("sdd_export_work_items", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
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
    async () => {
      try {
        const context = requireExecutionContext("sdd_create_pr");
        const feature = context.feature!;
        const stateDir = context.stateDir!;
        const release = context.state!.contract.capability_config.release!;
        const headBranch = `${release.branch_prefix}${feature.number}-${feature.name}`;

        const prPayload = await gitManager.generatePrPayload(
          feature.directory,
          feature.number,
          release.base_branch,
          headBranch,
        );

        const result = {
          status: "pr_payload_generated",
          title: prPayload.title,
          body: prPayload.body,
          base_branch: prPayload.base_branch,
          head_branch: prPayload.head_branch,
          labels: prPayload.labels,
          draft: release.draft_pr,
          spec_summary: prPayload.spec_summary,
          requirements_covered: prPayload.requirements_covered,
          routing_instructions: prPayload.routing_instructions,
          explanation: `PR payload generated for '${prPayload.title}'. Covers ${prPayload.requirements_covered.length} requirements.`,
          next_steps: "Route this payload to GitHub MCP's create_pull_request tool to open the PR.",
          learning_note: "SDD pull requests include spec artifact references and requirement coverage, enabling reviewers to trace code changes back to requirements.",
        };

        const enriched = await enrichResponse("sdd_create_pr", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
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
    async ({ task_ids, checkpoint }) => {
      try {
        const context = requireExecutionContext("sdd_implement");
        const feature = context.feature!;
        const stateDir = context.stateDir!;

        const tasksContent = await fileManager.readSpecFile(feature.directory, "TASKS.md");

        // Parse tasks from TASKS.md (table + checkbox)
        const allTasks = parseTasksFromMarkdown(tasksContent).map((t) => ({
          id: t.id,
          title: t.title,
          dependencies: t.dependencies,
          traces_to: t.traces_to,
          parallel: t.parallel,
          file_path: undefined as string | undefined,
        }));

        // Filter to requested task_ids if provided
        const targetTasks = task_ids.length > 0
          ? allTasks.filter((t) => task_ids.includes(t.id))
          : allTasks;

        if (targetTasks.length === 0) {
          throw new Error(
            "No tasks found. Ensure TASKS.md contains a Task Breakdown table (| T-001 | … |) or checkbox lines (- [ ] T-001: Title)."
          );
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
          feature_number: feature.number,
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

        const enriched = await enrichResponse("sdd_implement", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
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
    async ({ questions }) => {
      try {
        const context = requireExecutionContext("sdd_research");
        const feature = context.feature!;
        const featureDir = feature.directory;
        const stateDir = context.stateDir!;

        const entries: ResearchEntry[] = questions.map((q) => ({
          id: q.id,
          question: q.question,
          findings: "No findings recorded; investigation remains open.",
          sources: [],
          recommendation: "No recommendation recorded until evidence is reviewed.",
          status: "open" as const,
        }));

        // Build RESEARCH.md content
        const today = new Date().toISOString().split("T")[0];
        let content = `---\ntitle: Research Log\nfeature: ${feature.number}\ndate: ${today}\nstatus: in_progress\n---\n\n`;
        content += `# Research Log — Feature ${feature.number}\n\n`;
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
          feature_number: feature.number,
          entries,
          total_questions: entries.length,
          open_count: entries.filter((e) => e.status === "open").length,
          explanation: `Created RESEARCH.md with ${entries.length} research questions. All marked as 'open' for investigation.`,
          next_steps: "Investigate each question, update findings and recommendations in RESEARCH.md, then mark as 'resolved' or 'deferred'.",
          learning_note: "Research logs capture unknowns early in the spec process. Resolving them before design prevents costly rework later.",
        };

        const enriched = await enrichResponse("sdd_research", result, stateMachine, stateDir);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(enriched, null, 2)) }] };
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
  parallel?: boolean;
  file_path?: string;
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
