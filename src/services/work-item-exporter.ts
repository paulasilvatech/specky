/**
 * WorkItemExporter — Transforms tasks into platform-specific work item payloads.
 * Supports GitHub Issues, Azure Boards, and Jira.
 *
 * Each platform gets its native payload shape (not a generic item):
 *   github       → { title, body, labels[] }
 *   jira         → { fields: { project: { key }, summary, description, issuetype: { name }, labels[] } }
 *   azure_boards → { work_item_type, fields: { "System.Title", "System.Description", "System.Tags", "System.AreaPath"?, "System.IterationPath"? } }
 * REQ/task traceability is preserved in every shape (task_id + traces_to plus
 * the rendered body/description), and the documented inputs — jira project_key,
 * azure area_path/iteration_path, include_subtasks — are honored.
 */
import type { FileManager } from "./file-manager.js";
import type { WorkItemMetadata, WorkItemPlatform, RoutingInstructions } from "../types.js";
import { extractRequirementIds } from "../utils/id-contracts.js";
import { parseTasksFromMarkdown } from "../utils/task-parser.js";
import { currentTimestamp } from "../utils/runtime-context.js";

/** A task parsed from TASKS.md, including any indented subtask bullets. */
interface ParsedTask {
  id: string;
  title: string;
  description: string;
  traces_to: string[];
  subtasks: string[];
}

/** GitHub Issues payload: create_issue takes title/body/labels directly. */
export interface GitHubWorkItem {
  task_id: string;
  traces_to: string[];
  title: string;
  body: string;
  labels: string[];
}

/** Jira REST payload: create_issue takes a `fields` object. */
export interface JiraWorkItem {
  task_id: string;
  traces_to: string[];
  fields: {
    project: { key: string };
    summary: string;
    description: string;
    issuetype: { name: "Task" };
    labels: string[];
  };
}

/** Azure Boards payload: create_work_item takes System.* fields. */
export interface AzureBoardsWorkItem {
  task_id: string;
  traces_to: string[];
  work_item_type: "Task";
  fields: {
    "System.Title": string;
    "System.Description": string;
    "System.Tags": string;
    "System.AreaPath"?: string;
    "System.IterationPath"?: string;
  };
}

export type PlatformWorkItem = GitHubWorkItem | JiraWorkItem | AzureBoardsWorkItem;

export interface WorkItemExportOptions {
  project_key?: string;
  area_path?: string;
  iteration_path?: string;
}

/** Result of a platform-specific export, with the honored options echoed in metadata. */
export interface PlatformWorkItemExportResult {
  platform: WorkItemPlatform;
  items: PlatformWorkItem[];
  metadata: WorkItemMetadata & {
    include_subtasks: boolean;
    project_key?: string;
    area_path?: string;
    iteration_path?: string;
  };
  routing_instructions: RoutingInstructions;
}

/** Trailing REQ suffix strip for display titles. */
const TRAILING_TRACE_SUFFIX =
  /\s*[(\[]?\s*(?:traces?(?:_to)?\s*:\s*)?REQ-[A-Z]+-\d{3}(?:\s*,\s*REQ-[A-Z]+-\d{3})*\s*[)\]]?\s*$/i;

export class WorkItemExporter {
  constructor(private fileManager: FileManager) {}

  async export(
    platform: WorkItemPlatform,
    _specDir: string,
    featureDir: string,
    includeSubtasks: boolean,
    options?: WorkItemExportOptions
  ): Promise<PlatformWorkItemExportResult> {
    if (platform === "jira" && !options?.project_key) {
      throw new Error(
        "project_key is required for the jira platform. Pass the Jira project key (e.g. 'CHK') so issues are created in the right project."
      );
    }

    const tasksContent = await this.fileManager.readSpecFile(featureDir, "TASKS.md");
    const specContent = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
    const tasks = this.parseTasks(tasksContent, specContent);
    const featureNumber = featureDir.match(/(\d{3})/)?.[1] || "000";
    const featureName = featureDir.replace(/.*\d{3}-/, "");

    const items = this.buildPlatformItems(platform, tasks, featureNumber, includeSubtasks, options);
    const routing = this.getRoutingInstructions(platform);

    return {
      platform,
      items,
      metadata: {
        feature_number: featureNumber,
        feature_name: featureName,
        total_items: items.length,
        generated_at: currentTimestamp(),
        include_subtasks: includeSubtasks,
        ...(options?.project_key !== undefined && { project_key: options.project_key }),
        ...(options?.area_path !== undefined && { area_path: options.area_path }),
        ...(options?.iteration_path !== undefined && { iteration_path: options.iteration_path }),
      },
      routing_instructions: routing,
    };
  }

  private buildPlatformItems(
    platform: WorkItemPlatform,
    tasks: ParsedTask[],
    featureNumber: string,
    includeSubtasks: boolean,
    options?: WorkItemExportOptions
  ): PlatformWorkItem[] {
    switch (platform) {
      case "github":
        return tasks.map((task) => this.toGitHubItem(task, featureNumber, includeSubtasks));
      case "jira":
        return tasks.map((task) =>
          this.toJiraItem(task, featureNumber, includeSubtasks, options?.project_key ?? "")
        );
      case "azure_boards":
        return tasks.map((task) =>
          this.toAzureBoardsItem(task, featureNumber, includeSubtasks, options?.area_path, options?.iteration_path)
        );
    }
  }

  private toGitHubItem(task: ParsedTask, featureNumber: string, includeSubtasks: boolean): GitHubWorkItem {
    const subtaskSection = includeSubtasks && task.subtasks.length > 0
      ? `\n\n## Subtasks\n${task.subtasks.map((s) => `- [ ] ${s}`).join("\n")}`
      : "";
    return {
      task_id: task.id,
      traces_to: task.traces_to,
      title: `[${task.id}] ${task.title}`,
      body:
        `## Description\n${task.description}${subtaskSection}\n\n## Traces To\n${this.tracesLine(task)}`,
      labels: ["sdd", `feature/${featureNumber}`, ...task.traces_to],
    };
  }

  private toJiraItem(
    task: ParsedTask,
    featureNumber: string,
    includeSubtasks: boolean,
    projectKey: string
  ): JiraWorkItem {
    const subtaskSection = includeSubtasks && task.subtasks.length > 0
      ? `\n\nh2. Subtasks\n${task.subtasks.map((s) => `* ${s}`).join("\n")}`
      : "";
    return {
      task_id: task.id,
      traces_to: task.traces_to,
      fields: {
        project: { key: projectKey },
        summary: `[${task.id}] ${task.title}`,
        description:
          `h2. Description\n${task.description}${subtaskSection}\n\nh2. Traces To\n${this.tracesLine(task)}`,
        issuetype: { name: "Task" },
        labels: ["sdd", `feature-${featureNumber}`, ...task.traces_to],
      },
    };
  }

  private toAzureBoardsItem(
    task: ParsedTask,
    featureNumber: string,
    includeSubtasks: boolean,
    areaPath?: string,
    iterationPath?: string
  ): AzureBoardsWorkItem {
    const subtaskSection = includeSubtasks && task.subtasks.length > 0
      ? `<h2>Subtasks</h2><ul>${task.subtasks.map((s) => `<li>${s}</li>`).join("")}</ul>`
      : "";
    return {
      task_id: task.id,
      traces_to: task.traces_to,
      work_item_type: "Task",
      fields: {
        "System.Title": `[${task.id}] ${task.title}`,
        "System.Description":
          `<h2>Description</h2><p>${task.description}</p>${subtaskSection}<h2>Traces To</h2><p>${this.tracesLine(task)}</p>`,
        "System.Tags": ["sdd", `feature/${featureNumber}`, ...task.traces_to].join("; "),
        ...(areaPath !== undefined && { "System.AreaPath": areaPath }),
        ...(iterationPath !== undefined && { "System.IterationPath": iterationPath }),
      },
    };
  }

  private tracesLine(task: ParsedTask): string {
    return task.traces_to.length > 0 ? task.traces_to.join(", ") : "(no requirement reference)";
  }

  private parseTasks(tasksContent: string, _specContent: string): ParsedTask[] {
    return parseTasksFromMarkdown(tasksContent).map((task) => {
      const title = task.title.replace(TRAILING_TRACE_SUFFIX, "").trim() || task.title;
      return {
        id: task.id,
        title,
        description: task.title,
        traces_to: task.traces_to.length > 0 ? task.traces_to : extractRequirementIds(task.title),
        subtasks: task.subtasks,
      };
    });
  }

  private getRoutingInstructions(platform: WorkItemPlatform): RoutingInstructions {
    switch (platform) {
      case "github":
        return {
          mcp_server: "github",
          tool_name: "create_issue",
          note: "Call GitHub MCP create_issue for each item using item.title, item.body, and item.labels.",
        };
      case "azure_boards":
        return {
          mcp_server: "azure-devops",
          tool_name: "create_work_item",
          note: "Call Azure DevOps MCP create_work_item for each item using item.work_item_type and item.fields (System.Title, System.Description, System.AreaPath, System.IterationPath).",
        };
      case "jira":
        return {
          mcp_server: "jira",
          tool_name: "create_issue",
          note: "Call Jira MCP create_issue for each item passing item.fields (project.key, summary, description, issuetype.name).",
        };
    }
  }
}
