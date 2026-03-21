/**
 * DocGenerator — Auto-documentation generation.
 * Generates full docs, API docs, runbooks, and onboarding guides.
 */
import type { FileManager } from "./file-manager.js";
import type { DocumentationResult } from "../types.js";

export class DocGenerator {
  constructor(private fileManager: FileManager) {}

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
    const design = await this.safeRead(featureDir, "DESIGN.md") || "";
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
