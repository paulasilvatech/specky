/**
 * GitManager — Branch naming and PR payload generation.
 * Does NOT execute git commands. Generates payloads for the AI client.
 */
import type { FileManager } from "./file-manager.js";
import type { BranchInfo, PrPayload } from "../types.js";
import { extractRequirementIds } from "../utils/id-contracts.js";
import { parseTasksFromMarkdown } from "../utils/task-parser.js";

export class GitManager {
  constructor(private fileManager: FileManager) {}

  generateBranchInfo(featureNumber: string, featureName: string, prefix: string = "feature/", baseBranch: string = "main"): BranchInfo {
    const branchName = `${prefix}${featureNumber}-${featureName}`;
    return {
      name: branchName,
      feature_number: featureNumber,
      convention: `${prefix}<number>-<kebab-case-name>`,
      command_hint: `git checkout -b ${branchName} ${baseBranch}`,
    };
  }

  async generatePrPayload(featureDir: string, featureNumber: string, baseBranch: string, headBranch?: string): Promise<PrPayload> {
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const head = headBranch || `feature/${featureNumber}-${featureName}`;

    let specSummary = "";
    let reqsCovered: string[] = [];
    try {
      const spec = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
      reqsCovered = extractRequirementIds(spec);
      specSummary = spec.split("\n").slice(0, 20).join("\n");
    } catch { /* no spec found */ }

    let tasksSummary = "";
    try {
      const tasksMd = await this.fileManager.readSpecFile(featureDir, "TASKS.md");
      const tasks = parseTasksFromMarkdown(tasksMd);
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.claimed_done).length;
      tasksSummary = totalTasks > 0
        ? `Tasks: ${completedTasks}/${totalTasks} completed`
        : "Tasks: none parsed";
    } catch { /* no tasks found */ }

    const body = [
      `## Summary`,
      specSummary,
      ``,
      `## ${tasksSummary}`,
      ``,
      `## Requirements Covered`,
      reqsCovered.map(r => `- ${r}`).join("\n"),
      ``,
      `## Spec Artifacts`,
      `- \`.specs/${featureNumber}-${featureName}/SPECIFICATION.md\``,
      `- \`.specs/${featureNumber}-${featureName}/DESIGN.md\``,
      `- \`.specs/${featureNumber}-${featureName}/TASKS.md\``,
    ].join("\n");

    return {
      title: `[${featureNumber}] ${featureName.replace(/-/g, " ")}`,
      body,
      base_branch: baseBranch,
      head_branch: head,
      labels: ["sdd", `feature/${featureNumber}`],
      spec_summary: specSummary,
      requirements_covered: reqsCovered,
      routing_instructions: { mcp_server: "github", tool_name: "create_pull_request", note: "Call GitHub MCP create_pull_request with this payload" },
    };
  }
}
