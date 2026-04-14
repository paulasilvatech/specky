/**
 * DocGenerator — Auto-documentation generation.
 * Generates full docs, API docs, runbooks, and onboarding guides.
 */
import type { FileManager } from "./file-manager.js";
import type { StateMachine } from "./state-machine.js";
import type { DocumentationResult } from "../types.js";

export class DocGenerator {
  constructor(private fileManager: FileManager, private stateMachine?: StateMachine) {}

  async generateFullDocs(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const sections: string[] = [];
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const design = await this.safeRead(featureDir, "DESIGN.md");
    const tasks = await this.safeRead(featureDir, "TASKS.md");
    const analysis = await this.safeRead(featureDir, "ANALYSIS.md");
    const featureName = featureDir.replace(/.*\d{3}-/, "");

    let content = `# ${featureName} — Complete Documentation\n\n`;
    content += `**Feature**: ${featureNumber}-${featureName}\n**Generated**: ${new Date().toISOString()}\n\n---\n\n`;

    if (spec) { content += `## Specification\n\n${this.summarize(spec)}\n\n`; sections.push("Specification"); }
    if (design) { content += `## Architecture & Design\n\n${this.summarize(design)}\n\n`; sections.push("Architecture & Design"); }
    if (tasks) { content += `## Implementation Plan\n\n${this.summarize(tasks)}\n\n`; sections.push("Implementation Plan"); }
    if (analysis) { content += `## Quality Analysis\n\n${this.summarize(analysis)}\n\n`; sections.push("Quality Analysis"); }

    content += `## How It Was Built\n\nThis feature was developed using Spec-Driven Development (SDD) with the Specky MCP Server.\n\n`;
    content += `### Pipeline Phases\n1. **Specification**: Requirements written in EARS notation\n2. **Design**: Architecture with C4 diagrams and ADRs\n3. **Tasks**: Implementation breakdown with dependency graph\n4. **Analysis**: Quality gate with traceability matrix\n5. **Implementation**: Phase-by-phase execution with checkpoints\n6. **Verification**: Drift detection and phantom task check\n\n`;
    sections.push("How It Was Built");

    return { type: "full", content, file_path: `docs/${featureNumber}-${featureName}.md`, sections, explanation: `Generated complete documentation with ${sections.length} sections.` };
  }

  async generateApiDocs(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const design = await this.safeRead(featureDir, "DESIGN.md") || "";
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const endpoints = this.extractEndpoints(design);

    let content = `# API Documentation: ${featureName}\n\n`;
    content += `**Version**: 1.0.0\n**Base URL**: \`/api/v1\`\n\n---\n\n`;
    for (const ep of endpoints) {
      content += `## ${ep.method} ${ep.path}\n\n${ep.description}\n\n`;
      content += `### Request\n\n\`\`\`json\n${ep.request || "{}"}\n\`\`\`\n\n`;
      content += `### Response\n\n\`\`\`json\n${ep.response || "{}"}\n\`\`\`\n\n---\n\n`;
    }

    return { type: "api", content, file_path: `docs/api-${featureNumber}.md`, sections: endpoints.map(e => `${e.method} ${e.path}`), explanation: `Generated API documentation with ${endpoints.length} endpoints.` };
  }

  async generateRunbook(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    await this.safeRead(featureDir, "DESIGN.md");
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const content = [
      `# Operational Runbook: ${featureName}`,
      `\n**Feature**: ${featureNumber}\n**Last Updated**: ${new Date().toISOString()}\n`,
      `## Deployment`,
      `1. Build: \`npm run build\``,
      `2. Test: \`npm test\``,
      `3. Deploy: Follow CI/CD pipeline\n`,
      `## Monitoring`,
      `- Health check: \`GET /health\``,
      `- Logs: Check application logs for errors\n`,
      `## Troubleshooting`,
      `| Symptom | Cause | Resolution |`,
      `|---------|-------|-----------|`,
      `| 500 errors | Database connection | Check connection string |`,
      `| Slow responses | High load | Scale horizontally |`,
      `| Auth failures | Token expiry | Check token configuration |\n`,
      `## Rollback`,
      `1. Revert deployment to previous version`,
      `2. Verify health checks pass`,
      `3. Notify team\n`,
    ].join("\n");

    return { type: "runbook", content, file_path: `docs/runbook-${featureNumber}.md`, sections: ["Deployment", "Monitoring", "Troubleshooting", "Rollback"], explanation: "Generated operational runbook." };
  }

  async generateOnboarding(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md") || "";
    const design = await this.safeRead(featureDir, "DESIGN.md") || "";
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const content = [
      `# Developer Onboarding: ${featureName}`,
      `\n> Welcome! This guide helps you understand and contribute to this feature.\n`,
      `## What This Feature Does`,
      this.summarize(spec).substring(0, 500),
      `\n## Architecture Overview`,
      this.summarize(design).substring(0, 500),
      `\n## Getting Started`,
      `1. Clone the repository`,
      `2. Install dependencies: \`npm install\``,
      `3. Read \`.specs/${featureNumber}-${featureName}/SPECIFICATION.md\``,
      `4. Review \`.specs/${featureNumber}-${featureName}/DESIGN.md\``,
      `5. Check \`.specs/${featureNumber}-${featureName}/TASKS.md\` for open tasks\n`,
      `## Key Concepts`,
      `- **EARS Notation**: Requirements follow the Easy Approach to Requirements Syntax`,
      `- **SDD Pipeline**: Spec → Design → Tasks → Implement → Verify`,
      `- **Traceability**: Every task traces to a requirement (REQ-XXX-NNN)\n`,
      `## Where to Find Things`,
      `| What | Where |`,
      `|------|-------|`,
      `| Requirements | \`.specs/${featureNumber}-${featureName}/SPECIFICATION.md\` |`,
      `| Architecture | \`.specs/${featureNumber}-${featureName}/DESIGN.md\` |`,
      `| Tasks | \`.specs/${featureNumber}-${featureName}/TASKS.md\` |`,
    ].join("\n");

    return { type: "onboarding", content, file_path: `docs/onboarding-${featureNumber}.md`, sections: ["What This Feature Does", "Architecture Overview", "Getting Started", "Key Concepts", "Where to Find Things"], explanation: "Generated developer onboarding guide." };
  }

  async generateAllDocs(featureDir: string, featureNumber: string): Promise<{
    results: DocumentationResult[];
    total_generated: number;
    total_sections: number;
  }> {
    const [full, api, runbook, onboarding] = await Promise.all([
      this.generateFullDocs(featureDir, featureNumber),
      this.generateApiDocs(featureDir, featureNumber),
      this.generateRunbook(featureDir, featureNumber),
      this.generateOnboarding(featureDir, featureNumber),
    ]);

    // Also generate journey docs if state machine is available
    const results = [full, api, runbook, onboarding];
    try {
      const journey = await this.generateJourneyDocs(featureDir, featureNumber);
      results.push(journey);
    } catch {
      // Journey docs are optional — skip if state not available
    }

    return {
      results,
      total_generated: results.length,
      total_sections: results.reduce((sum, r) => sum + r.sections.length, 0),
    };
  }

  async generateJourneyDocs(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const sections: string[] = [];

    let content = `# ${featureName} — SDD Journey\n\n`;
    content += `> Complete documentation of the Spec-Driven Development process.\n\n`;
    content += `**Feature**: ${featureNumber}-${featureName}\n**Generated**: ${new Date().toISOString()}\n\n---\n\n`;

    // 1. Methodology Overview
    content += `## 1. Methodology Overview\n\n`;
    content += `This project was built using **Spec-Driven Development (SDD)**, a methodology that enforces traceability between requirements, design, implementation, and tests.\n\n`;
    content += `### The 10-Phase Pipeline\n\n`;
    content += `| # | Phase | Purpose |\n|---|-------|--------|\n`;
    content += `| 1 | Init | Establish project constitution |\n`;
    content += `| 2 | Discover | Explore problem space |\n`;
    content += `| 3 | Specify | Write EARS requirements |\n`;
    content += `| 4 | Clarify | Resolve ambiguity |\n`;
    content += `| 5 | Design | Architecture & system design |\n`;
    content += `| 6 | Tasks | Implementation breakdown |\n`;
    content += `| 7 | Analyze | Quality gate |\n`;
    content += `| 8 | Implement | Build following the plan |\n`;
    content += `| 9 | Verify | Validate against spec |\n`;
    content += `| 10 | Release | Documentation & deployment |\n\n`;
    sections.push("Methodology Overview");

    // 2. Phase-by-Phase Journey (from state if available)
    content += `## 2. Phase-by-Phase Journey\n\n`;
    if (this.stateMachine) {
      try {
        const specDir = featureDir.replace(/\/\d{3}-.*$/, "");
        const state = await this.stateMachine.loadState(specDir);
        const phaseNames = ["init", "discover", "specify", "clarify", "design", "tasks", "analyze", "implement", "verify", "release"];
        for (const phaseName of phaseNames) {
          const phaseStatus = state.phases[phaseName as keyof typeof state.phases];
          if (phaseStatus && phaseStatus.status !== "pending") {
            content += `### ${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase\n\n`;
            content += `- **Status**: ${phaseStatus.status}\n`;
            if (phaseStatus.started_at) content += `- **Started**: ${phaseStatus.started_at}\n`;
            if (phaseStatus.completed_at) content += `- **Completed**: ${phaseStatus.completed_at}\n`;
            content += `\n`;
          }
        }
      } catch {
        content += `_Phase timeline not available — state file not found._\n\n`;
      }
    } else {
      content += `_Phase timeline not available — run through the SDD pipeline to populate._\n\n`;
    }
    sections.push("Phase-by-Phase Journey");

    // 3. Artifacts Summary
    content += `## 3. Artifacts Produced\n\n`;
    const artifactNames = ["CONSTITUTION.md", "SPECIFICATION.md", "DESIGN.md", "TASKS.md", "ANALYSIS.md", "CHECKLIST.md", "VERIFICATION.md"];
    for (const artifact of artifactNames) {
      const exists = await this.safeRead(featureDir, artifact);
      const status = exists ? "Present" : "Not yet created";
      const size = exists ? `${exists.length} chars` : "-";
      content += `| ${artifact} | ${status} | ${size} |\n`;
    }
    content += `\n`;
    sections.push("Artifacts Produced");

    // 4. Gate Decision
    content += `## 4. Quality Gate Results\n\n`;
    if (this.stateMachine) {
      try {
        const specDir = featureDir.replace(/\/\d{3}-.*$/, "");
        const state = await this.stateMachine.loadState(specDir);
        if (state.gate_decision) {
          content += `- **Decision**: ${state.gate_decision.decision}\n`;
          content += `- **Coverage**: ${state.gate_decision.coverage_percent}%\n`;
          content += `- **Reasons**: ${state.gate_decision.reasons.join(", ")}\n`;
          if (state.gate_decision.gaps.length > 0) {
            content += `- **Gaps**: ${state.gate_decision.gaps.join(", ")}\n`;
          }
          content += `- **Decided At**: ${state.gate_decision.decided_at}\n`;
        } else {
          content += `_No gate decision recorded yet. Run sdd_run_analysis to generate._\n`;
        }
      } catch {
        content += `_Gate decision not available._\n`;
      }
    } else {
      content += `_Gate decision not available — state machine not connected._\n`;
    }
    content += `\n`;
    sections.push("Quality Gate Results");

    // 5. Key Design Decisions
    content += `## 5. Architecture Decisions\n\n`;
    const design = await this.safeRead(featureDir, "DESIGN.md");
    if (design) {
      const adrRegex = /### ADR-\d+:\s*(.*?)$/gm;
      let adrMatch;
      let adrCount = 0;
      while ((adrMatch = adrRegex.exec(design)) !== null) {
        content += `- **${adrMatch[1].trim()}**\n`;
        adrCount++;
      }
      if (adrCount === 0) content += `_No ADRs found in DESIGN.md._\n`;
    } else {
      content += `_DESIGN.md not yet created._\n`;
    }
    content += `\n`;
    sections.push("Architecture Decisions");

    // 6. Traceability Summary
    content += `## 6. Traceability Summary\n\n`;
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const tasks = await this.safeRead(featureDir, "TASKS.md");
    const reqCount = spec ? (spec.match(/### REQ-/g) || []).length : 0;
    const taskCount = tasks ? (tasks.match(/T-\d{3}/g) || []).length : 0;
    content += `- **Requirements**: ${reqCount}\n`;
    content += `- **Tasks**: ${taskCount}\n`;
    content += `- **Traceability**: ${reqCount > 0 && taskCount > 0 ? "Linked" : "Incomplete"}\n\n`;
    sections.push("Traceability Summary");

    return {
      type: "journey",
      content,
      file_path: `docs/journey-${featureNumber}.md`,
      sections,
      explanation: `Generated SDD journey documentation with ${sections.length} sections.`,
    };
  }

  // ─── Helpers ───

  private summarize(content: string): string {
    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("---") && !l.startsWith("```"));
    return lines.slice(0, 15).join("\n");
  }

  private extractEndpoints(design: string): Array<{ method: string; path: string; description: string; request?: string; response?: string }> {
    const endpoints: Array<{ method: string; path: string; description: string; request?: string; response?: string }> = [];
    const regex = /\b(GET|POST|PUT|PATCH|DELETE)\s+([/\w{}:-]+)/g;
    let match;
    while ((match = regex.exec(design)) !== null) {
      endpoints.push({ method: match[1], path: match[2], description: `${match[1]} ${match[2]}` });
    }
    return endpoints;
  }

  private async safeRead(featureDir: string, fileName: string): Promise<string | null> {
    try { return await this.fileManager.readSpecFile(featureDir, fileName); } catch { return null; }
  }
}
