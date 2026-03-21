/**
 * WorkItemExporter — Transforms tasks into platform-specific work item payloads.
 * Supports GitHub Issues, Azure Boards, and Jira.
 */
import type { FileManager } from "./file-manager.js";
import type { WorkItemExportResult, WorkItemPayload, GitHubIssuePayload, AzureBoardsPayload, JiraPayload, WorkItemPlatform, RoutingInstructions } from "../types.js";

export class WorkItemExporter {
  constructor(private fileManager: FileManager) {}

  async export(platform: WorkItemPlatform, specDir: string, featureDir: string, includeSubtasks: boolean, options?: { project_key?: string; area_path?: string; iteration_path?: string }): Promise<WorkItemExportResult> {
    const tasksContent = await this.fileManager.readSpecFile(featureDir, "TASKS.md");
    const specContent = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
    const tasks = this.parseTasks(tasksContent, specContent);
    const featureNumber = featureDir.match(/(\d{3})/)?.[1] || "000";
    const featureName = featureDir.replace(/.*\d{3}-/, "");

    const items: WorkItemPayload[] = tasks.map(t => ({
      task_id: t.id,
      title: t.title,
      description: t.description,
      traces_to: t.traces_to,
      effort: t.effort,
      dependencies: t.dependencies,
      acceptance_criteria: t.acceptance_criteria,
    }));

    const routing = this.getRoutingInstructions(platform);

    return {
      platform,
      items,
      metadata: { feature_number: featureNumber, feature_name: featureName, total_items: items.length, generated_at: new Date().toISOString() },
      routing_instructions: routing,
    };
  }

  toGitHubPayloads(items: WorkItemPayload[], featureNumber: string): GitHubIssuePayload[] {
    return items.map(item => ({
      title: `[${item.task_id}] ${item.title}`,
      body: `## Description\n${item.description}\n\n## Acceptance Criteria\n${item.acceptance_criteria.map(ac => `- [ ] ${ac}`).join("\n")}\n\n## Traces To\n${item.traces_to.join(", ")}\n\n## Effort\n${item.effort || "Not estimated"}`,
      labels: ["sdd", `feature/${featureNumber}`, item.effort ? `effort:${item.effort}` : ""].filter(Boolean),
      assignees: [],
    }));
  }

  toAzureBoardsPayloads(items: WorkItemPayload[], areaPath?: string, iterationPath?: string): AzureBoardsPayload[] {
    return items.map(item => ({
      title: `[${item.task_id}] ${item.title}`,
      description: `<h2>Description</h2><p>${item.description}</p><h2>Traces To</h2><p>${item.traces_to.join(", ")}</p>`,
      work_item_type: "Task" as const,
      area_path: areaPath,
      iteration_path: iterationPath,
      tags: ["sdd", item.effort || ""].filter(Boolean),
      acceptance_criteria: item.acceptance_criteria.map(ac => `<li>${ac}</li>`).join(""),
    }));
  }

  toJiraPayloads(items: WorkItemPayload[], projectKey: string): JiraPayload[] {
    return items.map(item => ({
      summary: `[${item.task_id}] ${item.title}`,
      description: `h2. Description\n${item.description}\n\nh2. Acceptance Criteria\n${item.acceptance_criteria.map(ac => `* ${ac}`).join("\n")}\n\nh2. Traces To\n${item.traces_to.join(", ")}`,
      issue_type: "Task" as const,
      project_key: projectKey,
      labels: ["sdd", item.effort || ""].filter(Boolean),
      priority: "Medium" as const,
    }));
  }

  private parseTasks(tasksContent: string, specContent: string): Array<{ id: string; title: string; description: string; traces_to: string[]; effort?: string; dependencies: string[]; acceptance_criteria: string[] }> {
    const tasks: Array<{ id: string; title: string; description: string; traces_to: string[]; effort?: string; dependencies: string[]; acceptance_criteria: string[] }> = [];
    const taskRegex = /^-\s+\[[ x]\]\s+(T\d{3})\s+(?:\[P\]\s+)?(?:\[(US\d+)\]\s+)?(.+)/gm;
    let match;
    while ((match = taskRegex.exec(tasksContent)) !== null) {
      const id = match[1];
      const story = match[2] || "";
      const title = match[3].trim();
      // Extract REQ IDs referenced in the task or linked story
      const reqIds: string[] = [];
      const reqRegex = /REQ-[A-Z]+-\d{3}/g;
      let reqMatch;
      while ((reqMatch = reqRegex.exec(title)) !== null) reqIds.push(reqMatch[0]);
      // If no direct REQ ref, look in spec for the story
      if (reqIds.length === 0 && story) {
        const storySection = specContent.match(new RegExp(`${story}[\\s\\S]*?(?=##|$)`));
        if (storySection) {
          while ((reqMatch = reqRegex.exec(storySection[0])) !== null) reqIds.push(reqMatch[0]);
        }
      }
      tasks.push({ id, title, description: title, traces_to: reqIds, dependencies: [], acceptance_criteria: [] });
    }
    return tasks;
  }

  private getRoutingInstructions(platform: WorkItemPlatform): RoutingInstructions {
    switch (platform) {
      case "github": return { mcp_server: "github", tool_name: "create_issue", note: "Call GitHub MCP create_issue for each item" };
      case "azure_boards": return { mcp_server: "azure-devops", tool_name: "create_work_item", note: "Call Azure DevOps MCP create_work_item for each item" };
      case "jira": return { mcp_server: "jira", tool_name: "create_issue", note: "Call Jira MCP create_issue for each item" };
    }
  }
}
