import type { DocumentationConfig } from "../contracts/use-case.js";
import type { DocumentationResult } from "../types.js";
import { extractRequirementIds, extractTaskIds } from "../utils/id-contracts.js";
import { currentTimestamp } from "../utils/runtime-context.js";
import type { FileManager } from "./file-manager.js";
import type { StateMachine } from "./state-machine.js";

interface RequirementEvidence {
  id: string;
  title: string;
  text: string;
  acceptanceCriteria: string[];
}

interface EndpointEvidence {
  method: string;
  path: string;
  description: string;
  request: string;
  response: string;
}

export interface DocGenerationFailure {
  type: DocumentationResult["type"];
  error: string;
}

export class DocGenerator {
  constructor(
    private readonly fileManager: FileManager,
    private readonly stateMachine?: StateMachine,
  ) {}

  async generateFullDocs(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<DocumentationResult> {
    this.requireType(config, "full");
    const [spec, design, tasks, analysis] = await Promise.all([
      this.requireArtifact(featureDir, "SPECIFICATION.md"),
      this.requireArtifact(featureDir, "DESIGN.md"),
      this.requireArtifact(featureDir, "TASKS.md"),
      this.requireArtifact(featureDir, "ANALYSIS.md"),
    ]);
    const requirements = this.extractRequirements(spec);
    const taskRows = tasks.split("\n").filter((line) => /^\|\s*T-\d{3}\s*\|/.test(line));
    if (requirements.length === 0)
      throw new Error("SPECIFICATION.md contains no documented requirements.");
    if (taskRows.length === 0) throw new Error("TASKS.md contains no documented task rows.");

    const featureName = this.featureName(featureDir);
    const content = [
      `# ${featureName} — Complete Documentation`,
      "",
      `**Feature**: ${featureNumber}-${featureName}`,
      `**Version**: ${config.version}`,
      `**Generated**: ${currentTimestamp()}`,
      "",
      "## Specification Evidence",
      "",
      this.renderRequirements(requirements),
      "",
      "## Design Evidence",
      "",
      this.renderDesignEvidence(design),
      "",
      "## Task Evidence",
      "",
      "| ID | Task | Parallel | Effort | Depends On | Traces To |",
      "|---|---|---|---|---|---|",
      ...taskRows,
      "",
      "## Analysis Evidence",
      "",
      this.stripFrontmatter(analysis).trim(),
      "",
    ].join("\n");

    return {
      type: "full",
      content,
      file_path: `docs/${featureNumber}-${featureName}.md`,
      sections: ["Specification Evidence", "Design Evidence", "Task Evidence", "Analysis Evidence"],
      explanation: "Assembled complete documentation from four required feature artifacts.",
    };
  }

  async generateApiDocs(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<DocumentationResult> {
    this.requireType(config, "api");
    if (!config.api_base_url) throw new Error("API documentation requires api_base_url.");
    const design = await this.requireArtifact(featureDir, "DESIGN.md");
    const endpoints = this.extractEndpoints(design);
    if (endpoints.length === 0)
      throw new Error("DESIGN.md contains no structured API contract blocks.");

    const featureName = this.featureName(featureDir);
    const content = [
      `# API Documentation: ${featureName}`,
      "",
      `**Version**: ${config.version}`,
      `**Base URL**: \`${config.api_base_url}\``,
      "",
      ...endpoints.flatMap((endpoint) => [
        `## ${endpoint.method} ${endpoint.path}`,
        "",
        endpoint.description,
        "",
        "### Request",
        "",
        "```json",
        endpoint.request,
        "```",
        "",
        "### Response",
        "",
        "```json",
        endpoint.response,
        "```",
        "",
      ]),
    ].join("\n");

    return {
      type: "api",
      content,
      file_path: `docs/api-${featureNumber}.md`,
      sections: endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
      explanation: `Assembled API documentation from ${endpoints.length} complete DESIGN.md contracts.`,
    };
  }

  async generateRunbook(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<DocumentationResult> {
    this.requireType(config, "runbook");
    const design = await this.requireArtifact(featureDir, "DESIGN.md");
    const infrastructure = this.extractSection(design, /infrastructure|deployment/i);
    const operations = this.extractSection(design, /cross-cutting|operability|observability/i);
    if (!infrastructure)
      throw new Error("DESIGN.md lacks infrastructure/deployment evidence for the runbook.");

    const featureName = this.featureName(featureDir);
    const content = [
      `# Operational Runbook: ${featureName}`,
      "",
      `**Feature**: ${featureNumber}`,
      `**Version**: ${config.version}`,
      `**Generated**: ${currentTimestamp()}`,
      "",
      "## Design Evidence",
      "",
      infrastructure,
      ...(operations ? ["", "### Operations and Observability", "", operations] : []),
      "",
      "## Deployment",
      "",
      ...config.deployment_steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "## Health Checks",
      "",
      ...config.health_checks.map((check) => `- ${check}`),
      "",
      "## Monitoring",
      "",
      ...config.monitoring_checks.map((check) => `- ${check}`),
      "",
      "## Troubleshooting",
      "",
      "| Symptom | Cause | Resolution |",
      "|---|---|---|",
      ...config.troubleshooting.map(
        (item) =>
          `| ${this.tableCell(item.symptom)} | ${this.tableCell(item.cause)} | ${this.tableCell(item.resolution)} |`,
      ),
      "",
      "## Rollback",
      "",
      ...config.rollback_steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "## Support Contacts",
      "",
      ...config.support_contacts.map((contact) => `- ${contact}`),
      "",
    ].join("\n");

    return {
      type: "runbook",
      content,
      file_path: `docs/runbook-${featureNumber}.md`,
      sections: [
        "Design Evidence",
        "Deployment",
        "Health Checks",
        "Monitoring",
        "Troubleshooting",
        "Rollback",
        "Support Contacts",
      ],
      explanation:
        "Assembled an operational runbook from DESIGN.md evidence and explicit release documentation parameters.",
    };
  }

  async generateOnboarding(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<DocumentationResult> {
    this.requireType(config, "onboarding");
    const [spec, design, tasks] = await Promise.all([
      this.requireArtifact(featureDir, "SPECIFICATION.md"),
      this.requireArtifact(featureDir, "DESIGN.md"),
      this.requireArtifact(featureDir, "TASKS.md"),
    ]);
    const requirements = this.extractRequirements(spec);
    const taskIds = extractTaskIds(tasks);
    if (requirements.length === 0 || taskIds.length === 0) {
      throw new Error("Onboarding requires documented requirements and tasks.");
    }

    const featureName = this.featureName(featureDir);
    const content = [
      `# Developer Onboarding: ${featureName}`,
      "",
      `**Version**: ${config.version}`,
      "",
      "## Feature Contract",
      "",
      this.renderRequirements(requirements),
      "",
      "## Architecture Evidence",
      "",
      this.renderDesignEvidence(design),
      "",
      "## Getting Started",
      "",
      ...config.onboarding_steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "## Traced Tasks",
      "",
      ...taskIds.map((taskId) => `- ${taskId}`),
      "",
      "## Support Contacts",
      "",
      ...config.support_contacts.map((contact) => `- ${contact}`),
      "",
      `Artifacts: \`${featureDir}/SPECIFICATION.md\`, \`${featureDir}/DESIGN.md\`, \`${featureDir}/TASKS.md\``,
      "",
    ].join("\n");

    return {
      type: "onboarding",
      content,
      file_path: `docs/onboarding-${featureNumber}.md`,
      sections: [
        "Feature Contract",
        "Architecture Evidence",
        "Getting Started",
        "Traced Tasks",
        "Support Contacts",
      ],
      explanation: "Assembled onboarding from explicit release steps and feature artifacts.",
    };
  }

  async generateJourneyDocs(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<DocumentationResult> {
    this.requireType(config, "journey");
    if (!this.stateMachine)
      throw new Error("Journey documentation requires the signed feature StateMachine.");
    const state = await this.stateMachine.loadState(featureDir);
    if (!state.gate_decision)
      throw new Error("Journey documentation requires an analysis gate decision.");
    const [spec, design, tasks] = await Promise.all([
      this.requireArtifact(featureDir, "SPECIFICATION.md"),
      this.requireArtifact(featureDir, "DESIGN.md"),
      this.requireArtifact(featureDir, "TASKS.md"),
    ]);
    const requirementIds = extractRequirementIds(spec);
    const taskIds = extractTaskIds(tasks);
    const adrs = design
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("### ADR-") && line.includes(":"))
      .map((line) => line.slice(line.indexOf(":") + 1).trim());
    if (requirementIds.length === 0 || taskIds.length === 0 || adrs.length === 0) {
      throw new Error("Journey documentation requires requirements, tasks, and ADR evidence.");
    }

    const featureName = this.featureName(featureDir);
    const content = [
      `# ${featureName} — Contract Journey`,
      "",
      `**Feature**: ${featureNumber}-${featureName}`,
      `**Contract**: ${state.contract.id}@${state.contract.version}`,
      `**Fingerprint**: \`${state.contract.fingerprint}\``,
      `**Generated**: ${currentTimestamp()}`,
      "",
      "## Persisted Phase Graph",
      "",
      "| Phase | Status | Started | Completed |",
      "|---|---|---|---|",
      ...state.contract.phases.map((phase) => {
        const phaseState = state.phases[phase];
        return `| ${phase} | ${phaseState.status} | ${phaseState.started_at ?? ""} | ${phaseState.completed_at ?? ""} |`;
      }),
      "",
      "## Analysis Gate",
      "",
      `- Decision: ${state.gate_decision.decision}`,
      `- Coverage: ${state.gate_decision.coverage_percent}%`,
      `- Reasons: ${state.gate_decision.reasons.join("; ")}`,
      `- Gaps: ${state.gate_decision.gaps.join("; ") || "none"}`,
      "",
      "## Architecture Decisions",
      "",
      ...adrs.map((adr) => `- ${adr}`),
      "",
      "## Traceability Summary",
      "",
      `- Requirements: ${requirementIds.length} (${requirementIds.join(", ")})`,
      `- Tasks: ${taskIds.length} (${taskIds.join(", ")})`,
      "",
    ].join("\n");

    return {
      type: "journey",
      content,
      file_path: `docs/journey-${featureNumber}.md`,
      sections: [
        "Persisted Phase Graph",
        "Analysis Gate",
        "Architecture Decisions",
        "Traceability Summary",
      ],
      explanation: "Assembled journey documentation from signed state and artifact evidence.",
    };
  }

  async generateAllDocs(
    featureDir: string,
    featureNumber: string,
    config: DocumentationConfig,
  ): Promise<{
    results: DocumentationResult[];
    failures: DocGenerationFailure[];
    total_generated: number;
    total_sections: number;
  }> {
    const generators: Record<
      DocumentationConfig["types"][number],
      () => Promise<DocumentationResult>
    > = {
      full: () => this.generateFullDocs(featureDir, featureNumber, config),
      api: () => this.generateApiDocs(featureDir, featureNumber, config),
      runbook: () => this.generateRunbook(featureDir, featureNumber, config),
      onboarding: () => this.generateOnboarding(featureDir, featureNumber, config),
      journey: () => this.generateJourneyDocs(featureDir, featureNumber, config),
    };
    const results = await Promise.all(config.types.map((type) => generators[type]()));
    return {
      results,
      failures: [],
      total_generated: results.length,
      total_sections: results.reduce((sum, result) => sum + result.sections.length, 0),
    };
  }

  private requireType(
    config: DocumentationConfig,
    type: DocumentationConfig["types"][number],
  ): void {
    if (!config.types.includes(type)) {
      throw new Error(`Documentation type ${type} is not enabled by the release contract.`);
    }
  }

  private async requireArtifact(featureDir: string, fileName: string): Promise<string> {
    try {
      const content = await this.fileManager.readSpecFile(featureDir, fileName);
      if (!content.trim()) throw new Error("empty");
      return content;
    } catch {
      throw new Error(`${fileName} is required for documentation in ${featureDir}.`);
    }
  }

  private featureName(featureDir: string): string {
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    if (!featureName) throw new Error(`Cannot derive feature name from ${featureDir}.`);
    return featureName;
  }

  private stripFrontmatter(content: string): string {
    if (!content.startsWith("---")) return content;
    const closing = content.indexOf("\n---", 3);
    if (closing === -1) throw new Error("Artifact frontmatter is not closed.");
    return content.slice(closing + 4).replace(/^\r?\n/, "");
  }

  private extractRequirements(spec: string): RequirementEvidence[] {
    const lines = this.stripFrontmatter(spec).split("\n");
    const requirements: RequirementEvidence[] = [];
    for (let index = 0; index < lines.length; index++) {
      const heading = lines[index].trim();
      if (!heading.startsWith("### REQ-")) continue;
      const separator = heading.indexOf(":");
      const id = (separator === -1 ? heading.slice(4) : heading.slice(4, separator)).trim();
      const title = separator === -1 ? "" : heading.slice(separator + 1).trim();
      if (!/^REQ-[A-Z]+-\d{3}$/.test(id)) continue;
      requirements.push(
        this.parseRequirementBlock(id, title, this.collectRequirementBlock(lines, index + 1)),
      );
    }
    return requirements;
  }

  private collectRequirementBlock(lines: string[], start: number): string {
    const blockLines: string[] = [];
    for (let cursor = start; cursor < lines.length; cursor++) {
      const candidate = lines[cursor].trim();
      if (candidate.startsWith("### REQ-") || candidate.startsWith("## ")) break;
      blockLines.push(lines[cursor]);
    }
    return blockLines.join("\n");
  }

  private parseRequirementBlock(id: string, title: string, block: string): RequirementEvidence {
    const criteriaMarker = "**acceptance criteria:**";
    const marker = block.toLowerCase().indexOf(criteriaMarker);
    const prose = marker === -1 ? block : block.slice(0, marker);
    const criteriaBlock = marker === -1 ? "" : block.slice(marker + criteriaMarker.length);
    const text = prose
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && line !== "---" && !line.startsWith("**Source:"))
      .join(" ");
    const acceptanceCriteria = criteriaBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2));
    if (!text || acceptanceCriteria.length === 0) {
      throw new Error(`Requirement ${id} lacks prose or acceptance criteria.`);
    }
    return { id, title, text, acceptanceCriteria };
  }

  private renderRequirements(requirements: RequirementEvidence[]): string {
    return requirements
      .map((requirement) =>
        [
          `### ${requirement.id}: ${requirement.title}`,
          "",
          requirement.text,
          "",
          "Acceptance criteria:",
          ...requirement.acceptanceCriteria.map((criterion) => `- ${criterion}`),
        ].join("\n"),
      )
      .join("\n\n");
  }

  private renderDesignEvidence(design: string): string {
    const sectionPatterns = [
      /system context/i,
      /container architecture/i,
      /component design/i,
      /code-level design/i,
      /data model/i,
      /api contracts?/i,
      /infrastructure|deployment/i,
      /security architecture/i,
      /architecture decision records?/i,
      /workload-specific design contract/i,
    ];
    const evidence = sectionPatterns
      .map((pattern) => this.extractSection(design, pattern))
      .filter(Boolean);
    if (evidence.length < 5) throw new Error("DESIGN.md lacks complete architecture evidence.");
    return evidence.join("\n\n");
  }

  private extractSection(document: string, titlePattern: RegExp): string {
    const lines = this.stripFrontmatter(document).split("\n");
    for (let index = 0; index < lines.length; index++) {
      const heading = lines[index].trim();
      if (!heading.startsWith("## ") || !titlePattern.test(heading.slice(3))) continue;
      let end = index + 1;
      while (end < lines.length && !lines[end].trim().startsWith("## ")) end++;
      return lines.slice(index, end).join("\n").trim();
    }
    return "";
  }

  private extractEndpoints(design: string): EndpointEvidence[] {
    const apiSection = this.extractSection(design, /api contracts?/i);
    if (!apiSection) return [];
    const lines = apiSection.split("\n");
    const endpoints: EndpointEvidence[] = [];
    const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    for (let index = 0; index < lines.length; index++) {
      const heading = lines[index].trim();
      if (!heading.startsWith("### ")) continue;
      const [method, path] = heading.slice(4).split(/\s+/, 2);
      if (!methods.has(method) || !path?.startsWith("/")) continue;
      let end = index + 1;
      while (end < lines.length && !lines[end].trim().startsWith("### ")) end++;
      const block = lines
        .slice(index + 1, end)
        .filter((line) => line.trim() !== "---")
        .join("\n")
        .trim();
      const requestMarker = /\*\*Request:?\*\*/i.exec(block);
      const responseMarker = /\*\*Response:?\*\*/i.exec(block);
      if (!requestMarker || !responseMarker || responseMarker.index <= requestMarker.index) {
        throw new Error(`${method} ${path} lacks explicit request/response markers.`);
      }
      const description = block.slice(0, requestMarker.index).trim();
      const request = block
        .slice(requestMarker.index + requestMarker[0].length, responseMarker.index)
        .replace(/```(?:json)?/g, "")
        .trim();
      const response = block
        .slice(responseMarker.index + responseMarker[0].length)
        .replace(/```(?:json)?/g, "")
        .trim();
      if (!description || !request || !response) {
        throw new Error(`${method} ${path} has incomplete API evidence.`);
      }
      endpoints.push({ method, path, description, request, response });
    }
    return endpoints;
  }

  private tableCell(value: string): string {
    const slash = String.fromCodePoint(92);
    return value
      .split(slash)
      .join(slash + slash)
      .split("|")
      .join(`${slash}|`);
  }
}
