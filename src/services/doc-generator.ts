/**
 * DocGenerator — Auto-documentation generation.
 * Generates full docs, API docs, runbooks, and onboarding guides.
 */
import type { FileManager } from "./file-manager.js";
import type { StateMachine } from "./state-machine.js";
import type { DocumentationResult } from "../types.js";
import { extractTaskIds } from "../utils/id-contracts.js";
import { currentTimestamp } from "../utils/runtime-context.js";

interface ExtractedRequirement {
  id: string;
  label: string;
  text: string;
  criteria: string[];
}

interface ExtractedEndpoint {
  method: string;
  path: string;
  description: string;
  request?: string;
  response?: string;
}

export interface DocGenerationFailure {
  type: DocumentationResult["type"];
  error: string;
}

export class DocGenerator {
  /** Technologies recognized when deriving runbook content from DESIGN.md. */
  private static readonly KNOWN_TECH = [
    "Node.js", "TypeScript", "Express", "Fastify", "NestJS", "React", "Next.js", "Vue",
    "Python", "FastAPI", "Django", "Flask", "Golang", "Rust", "Java", "Spring", "Kotlin",
    "PostgreSQL", "Postgres", "MySQL", "SQLite", "MongoDB", "Redis", "Kafka", "RabbitMQ",
    "Elasticsearch", "Docker", "Kubernetes", "Terraform", "Nginx", "GraphQL", "gRPC",
  ];

  private static readonly DATABASES = ["PostgreSQL", "Postgres", "MySQL", "SQLite", "MongoDB", "Redis"];

  constructor(private fileManager: FileManager, private stateMachine?: StateMachine) {}

  async generateFullDocs(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const sections: string[] = [];
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const design = await this.safeRead(featureDir, "DESIGN.md");
    const tasks = await this.safeRead(featureDir, "TASKS.md");
    const analysis = await this.safeRead(featureDir, "ANALYSIS.md");
    const featureName = featureDir.replace(/.*\d{3}-/, "");

    let content = `# ${featureName} — Complete Documentation\n\n`;
    content += `**Feature**: ${featureNumber}-${featureName}\n**Generated**: ${currentTimestamp()}\n\n---\n\n`;

    if (spec) { content += `## Specification\n\n${this.summarizeSpec(spec)}\n\n`; sections.push("Specification"); }
    if (design) { content += `## Architecture & Design\n\n${this.summarizeDesign(design)}\n\n`; sections.push("Architecture & Design"); }
    if (tasks) { content += `## Implementation Plan\n\n${this.summarize(tasks, 30)}\n\n`; sections.push("Implementation Plan"); }
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

    const withExamples = endpoints.filter((e) => e.request || e.response).length;
    return { type: "api", content, file_path: `docs/api-${featureNumber}.md`, sections: endpoints.map(e => `${e.method} ${e.path}`), explanation: `Generated API documentation with ${endpoints.length} endpoints (${withExamples} with request/response examples from DESIGN.md).` };
  }

  async generateRunbook(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const design = await this.safeRead(featureDir, "DESIGN.md") || "";
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const endpoints = this.extractEndpoints(design);
    const stack = this.detectTechStack(design);
    const infrastructure = this.cleanSectionExcerpt(this.extractDesignSection(design, /infrastructure|deployment/i), 8);
    const security = this.cleanSectionExcerpt(this.extractDesignSection(design, /security/i), 6);
    const database = stack.find((t) => DocGenerator.DATABASES.includes(t));

    const lines: string[] = [
      `# Operational Runbook: ${featureName}`,
      `\n**Feature**: ${featureNumber}\n**Last Updated**: ${currentTimestamp()}\n`,
    ];
    const sections: string[] = [];

    if (stack.length > 0) {
      lines.push(`## Tech Stack`, ...stack.map((t) => `- ${t}`), ``);
      sections.push("Tech Stack");
    }

    lines.push(`## Deployment`);
    const deploySteps: string[] = [];
    if (stack.includes("Docker")) deploySteps.push(`Build the container image: \`docker build -t ${featureName} .\``);
    if (stack.some((t) => ["Node.js", "TypeScript", "Express", "Fastify", "NestJS"].includes(t))) {
      deploySteps.push("Install and build: `npm ci && npm run build`", "Run the test suite: `npm test`");
    }
    if (stack.includes("Kubernetes")) deploySteps.push(`Roll out: \`kubectl rollout status deployment/${featureName}\``);
    if (deploySteps.length === 0) deploySteps.push("Build: `npm run build`", "Test: `npm test`", "Deploy: Follow CI/CD pipeline");
    lines.push(...deploySteps.map((step, i) => `${i + 1}. ${step}`), ``);
    if (infrastructure) lines.push(`### Infrastructure (from DESIGN.md)`, ``, infrastructure, ``);
    sections.push("Deployment");

    lines.push(`## Monitoring`);
    if (endpoints.length > 0) {
      lines.push(`Feature endpoints to monitor:`);
      for (const ep of endpoints.slice(0, 8)) {
        lines.push(`- \`${ep.method} ${ep.path}\` — ${ep.description}`);
      }
    }
    lines.push(`- Health check: \`GET /health\``, `- Logs: Check application logs for errors`);
    if (database) lines.push(`- Monitor ${database} connectivity, connection-pool saturation, and slow queries`);
    lines.push(``);
    sections.push("Monitoring");

    lines.push(`## Troubleshooting`, `| Symptom | Cause | Resolution |`, `|---------|-------|-----------|`);
    const rows: string[] = [];
    if (database) rows.push(`| 500 errors | ${database} connection failure | Verify ${database} availability and connection string |`);
    if (endpoints.length > 0) {
      const first = endpoints[0];
      rows.push(`| 4xx/5xx from \`${first.method} ${first.path}\` | Payload drift from the design contract | Compare request/response against the API contracts in DESIGN.md |`);
    }
    if (security || /\b(auth|token|jwt|oauth)\b/i.test(design)) {
      rows.push(`| Auth failures | Token expiry or misconfiguration | Check token configuration |`);
    }
    if (rows.length === 0) {
      rows.push(
        `| 500 errors | Database connection | Check connection string |`,
        `| Auth failures | Token expiry | Check token configuration |`,
      );
    }
    rows.push(`| Slow responses | High load | Scale horizontally |`);
    lines.push(...rows, ``);
    if (security) lines.push(`### Security Notes (from DESIGN.md)`, ``, security, ``);
    sections.push("Troubleshooting");

    lines.push(
      `## Rollback`,
      stack.includes("Kubernetes")
        ? `1. Roll back: \`kubectl rollout undo deployment/${featureName}\``
        : `1. Revert deployment to previous version`,
      `2. Verify health checks pass`,
      `3. Notify team\n`,
    );
    sections.push("Rollback");

    const derived = stack.length > 0 || endpoints.length > 0 || infrastructure || security;
    return {
      type: "runbook",
      content: lines.join("\n"),
      file_path: `docs/runbook-${featureNumber}.md`,
      sections,
      explanation: derived
        ? `Generated operational runbook derived from DESIGN.md (${stack.length} technologies, ${endpoints.length} endpoints).`
        : "Generated operational runbook (generic template — DESIGN.md had no detectable stack, endpoints, or infrastructure).",
    };
  }

  async generateOnboarding(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md") || "";
    const design = await this.safeRead(featureDir, "DESIGN.md") || "";
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const content = [
      `# Developer Onboarding: ${featureName}`,
      `\n> Welcome! This guide helps you understand and contribute to this feature.\n`,
      `## What This Feature Does`,
      this.summarizeSpec(spec) || `_No specification content available yet — run sdd_write_spec first._`,
      `\n## Architecture Overview`,
      this.summarizeDesign(design) || `_No design content available yet — run sdd_write_design first._`,
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
    failures: DocGenerationFailure[];
    total_generated: number;
    total_sections: number;
  }> {
    // All five advertised doc types run in the same parallel batch. Failures
    // are collected and surfaced to the caller instead of silently dropped.
    const generators: Array<{ type: DocumentationResult["type"]; generate: () => Promise<DocumentationResult> }> = [
      { type: "full", generate: () => this.generateFullDocs(featureDir, featureNumber) },
      { type: "api", generate: () => this.generateApiDocs(featureDir, featureNumber) },
      { type: "runbook", generate: () => this.generateRunbook(featureDir, featureNumber) },
      { type: "onboarding", generate: () => this.generateOnboarding(featureDir, featureNumber) },
      { type: "journey", generate: () => this.generateJourneyDocs(featureDir, featureNumber) },
    ];

    const settled = await Promise.allSettled(generators.map((g) => g.generate()));
    const results: DocumentationResult[] = [];
    const failures: DocGenerationFailure[] = [];
    settled.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        failures.push({ type: generators[i].type, error: reason });
      }
    });

    return {
      results,
      failures,
      total_generated: results.length,
      total_sections: results.reduce((sum, r) => sum + r.sections.length, 0),
    };
  }

  async generateJourneyDocs(featureDir: string, featureNumber: string): Promise<DocumentationResult> {
    const featureName = featureDir.replace(/.*\d{3}-/, "");
    const sections: string[] = [];

    let content = `# ${featureName} — SDD Journey\n\n`;
    content += `> Complete documentation of the Spec-Driven Development process.\n\n`;
    content += `**Feature**: ${featureNumber}-${featureName}\n**Generated**: ${currentTimestamp()}\n\n---\n\n`;

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
    const taskCount = tasks ? extractTaskIds(tasks).length : 0;
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

  /** Strip a leading YAML frontmatter block (--- ... ---) from a document. */
  private stripFrontmatter(content: string): string {
    if (!content.startsWith("---")) return content;
    const closing = content.indexOf("\n---", 3);
    if (closing === -1) return content;
    return content.slice(closing + 4).replace(/^\r?\n/, "");
  }

  /**
   * Generic content summary. Skips frontmatter, the Table of Contents,
   * code fences, separators, comments, and TODO placeholders, then keeps
   * the first `maxLines` meaningful lines.
   */
  private summarize(content: string, maxLines = 15): string {
    const lines = this.stripFrontmatter(content).split("\n");
    const kept: string[] = [];
    let inCodeFence = false;
    let inToc = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) { inCodeFence = !inCodeFence; continue; }
      if (inCodeFence) continue;
      if (/^#{1,6}\s+table of contents/i.test(trimmed)) { inToc = true; continue; }
      if (inToc) {
        if (!trimmed.startsWith("#")) continue;
        inToc = false;
      }
      if (!trimmed || trimmed === "---" || trimmed.startsWith("<!--") || trimmed.includes("[TODO:")) continue;
      kept.push(line);
      if (kept.length >= maxLines) break;
    }
    return kept.join("\n");
  }

  /** Parse EARS requirement blocks (### REQ-XXX-NNN ...) out of SPECIFICATION.md. */
  private extractRequirements(spec: string): ExtractedRequirement[] {
    const headingRegex = /^###\s+(REQ-[A-Za-z0-9_-]*\d+)\s*:?\s*(.*)$/gm;
    const headings: Array<{ id: string; label: string; start: number; bodyStart: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(spec)) !== null) {
      headings.push({ id: match[1], label: match[2].trim(), start: match.index, bodyStart: match.index + match[0].length });
    }
    return headings
      .map((heading, i) => {
        const end = i + 1 < headings.length ? headings[i + 1].start : spec.length;
        const block = spec.slice(heading.bodyStart, end);
        // Stop at the next non-REQ heading (e.g. "## 2. Functional Requirements").
        const nextHeading = block.search(/^#{2,3}\s+/m);
        const body = nextHeading === -1 ? block : block.slice(0, nextHeading);
        const parts = body.split(/\*\*Acceptance Criteria:?\*\*/i);
        const text = (parts[0] || "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && l !== "---" && !l.startsWith("```"))
          .join(" ");
        const criteria = (parts[1] || "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("- "))
          .map((l) => l.slice(2).trim());
        return { id: heading.id, label: heading.label, text, criteria };
      })
      .filter((req) => req.text.length > 0);
  }

  /**
   * Requirement-aware spec summary: pulls the actual EARS "shall" statements
   * with their REQ IDs instead of the frontmatter/ToC head of the file.
   */
  private summarizeSpec(spec: string): string {
    const requirements = this.extractRequirements(spec);
    if (requirements.length === 0) return this.summarize(spec);
    const entries = requirements.map((req) => {
      const label = req.label ? ` ${req.label}` : "";
      const criteria = req.criteria.length > 0 ? `\n  - Acceptance: ${req.criteria.join("; ")}` : "";
      return `- **${req.id}**${label}: ${req.text}${criteria}`;
    });
    const plural = requirements.length === 1 ? "requirement" : "requirements";
    return `This feature is specified by ${requirements.length} EARS ${plural}:\n\n${entries.join("\n")}`;
  }

  /** Extract the body of the first "## ..." design section whose title matches. */
  private extractDesignSection(design: string, titlePattern: RegExp): string {
    const body = this.stripFrontmatter(design);
    const headingRegex = /^##\s+(.+)$/gm;
    const headings: Array<{ title: string; start: number; bodyStart: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(body)) !== null) {
      headings.push({ title: match[1].trim(), start: match.index, bodyStart: match.index + match[0].length });
    }
    for (let i = 0; i < headings.length; i++) {
      if (!titlePattern.test(headings[i].title)) continue;
      const end = i + 1 < headings.length ? headings[i + 1].start : body.length;
      return body.slice(headings[i].bodyStart, end);
    }
    return "";
  }

  /** Clean a design-section excerpt: drop template hints, TODOs, fences, and separators. */
  private cleanSectionExcerpt(section: string, maxLines = 12): string {
    const kept: string[] = [];
    let inCodeFence = false;
    for (const line of section.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) { inCodeFence = !inCodeFence; continue; }
      if (inCodeFence) continue;
      if (!trimmed || trimmed === "---" || trimmed.startsWith(">") || trimmed.startsWith("<!--") || trimmed.includes("[TODO:")) continue;
      kept.push(line);
      if (kept.length >= maxLines) break;
    }
    return kept.join("\n").trim();
  }

  /**
   * Architecture-aware design summary: pulls the C4 sections, data model, and
   * API contracts instead of the frontmatter/ToC head of the file.
   */
  private summarizeDesign(design: string): string {
    const parts: string[] = [];
    const sectionSpecs: Array<{ heading: string; pattern: RegExp }> = [
      { heading: "System Context", pattern: /system context/i },
      { heading: "Container Architecture", pattern: /container architecture/i },
      { heading: "Component Design", pattern: /component design/i },
      { heading: "Data Model", pattern: /data model/i },
      { heading: "API Contracts", pattern: /api contracts?/i },
    ];
    for (const { heading, pattern } of sectionSpecs) {
      const excerpt = this.cleanSectionExcerpt(this.extractDesignSection(design, pattern));
      if (excerpt) parts.push(`### ${heading}\n\n${excerpt}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : this.summarize(design);
  }

  /** Remove ```mermaid fenced blocks so diagram edges are not scanned as endpoints. */
  private stripMermaidBlocks(content: string): string {
    return content.replace(/```mermaid[\s\S]*?(?:```|$)/g, "");
  }

  /** Detect technologies named in DESIGN.md (word-boundary matched). */
  private detectTechStack(design: string): string[] {
    const found: string[] = [];
    for (const tech of DocGenerator.KNOWN_TECH) {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[^\\w])${escaped}(?:[^\\w]|$)`, "i").test(design)) found.push(tech);
    }
    return found;
  }

  /** Pull the schema/JSON body that follows a **Request:** or **Response:** marker. */
  private extractContractBody(block: string, marker: RegExp, stopAt?: RegExp): string | undefined {
    const markerMatch = marker.exec(block);
    if (!markerMatch) return undefined;
    let rest = block.slice(markerMatch.index + markerMatch[0].length);
    if (stopAt) {
      const stop = stopAt.exec(rest);
      if (stop) rest = rest.slice(0, stop.index);
    }
    const separator = rest.search(/^---\s*$/m);
    if (separator !== -1) rest = rest.slice(0, separator);
    const value = rest.replace(/```(?:json)?/g, "").trim();
    if (!value || /^n\/?a\.?$/i.test(value)) return undefined;
    return value;
  }

  /**
   * Extract API endpoints from DESIGN.md. Structured contract blocks
   * ("### METHOD /path" with **Request:** and **Response:** bodies) are
   * parsed first, including their JSON examples; a fallback scan picks up
   * endpoints mentioned in prose. Mermaid diagrams are excluded and
   * endpoints are deduplicated by METHOD+path.
   */
  private extractEndpoints(design: string): ExtractedEndpoint[] {
    const scannable = this.stripMermaidBlocks(this.stripFrontmatter(design));
    const byKey = new Map<string, ExtractedEndpoint>();

    // 1. Structured API contract blocks.
    const contractRegex = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)\s*$/gm;
    const contracts: Array<{ method: string; path: string; bodyStart: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = contractRegex.exec(scannable)) !== null) {
      contracts.push({ method: match[1], path: match[2], bodyStart: match.index + match[0].length });
    }
    for (const contract of contracts) {
      const rest = scannable.slice(contract.bodyStart);
      const nextHeading = rest.search(/^#{2,3}\s+/m);
      const block = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

      const description = block
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && l !== "---" && !l.startsWith("**") && !l.startsWith("```") && !l.startsWith("{") && !l.startsWith("["))
        || `${contract.method} ${contract.path}`;

      let request = this.extractContractBody(block, /\*\*Request:?\*\*/i, /\*\*Response:?\*\*/i);
      let response = this.extractContractBody(block, /\*\*Response:?\*\*/i);

      // Fallback: bare ```json fences under the endpoint heading.
      if (!request && !response) {
        const fences = [...block.matchAll(/```json\s*([\s\S]*?)```/g)]
          .map((m) => m[1].trim())
          .filter((body) => body.length > 0);
        const hasRequestBody = ["POST", "PUT", "PATCH"].includes(contract.method);
        if (fences.length >= 2) {
          request = fences[0];
          response = fences[1];
        } else if (fences.length === 1) {
          if (hasRequestBody) request = fences[0];
          else response = fences[0];
        }
      }

      const key = `${contract.method} ${contract.path}`;
      if (!byKey.has(key)) {
        const endpoint: ExtractedEndpoint = { method: contract.method, path: contract.path, description };
        if (request) endpoint.request = request;
        if (response) endpoint.response = response;
        byKey.set(key, endpoint);
      }
    }

    // 2. Fallback scan for endpoints mentioned outside contract blocks.
    const inlineRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w{}:./-]*)/g;
    while ((match = inlineRegex.exec(scannable)) !== null) {
      const method = match[1];
      const path = match[2].replace(/[.,;:]+$/, "");
      const key = `${method} ${path}`;
      if (!byKey.has(key)) {
        byKey.set(key, { method, path, description: `${method} ${path}` });
      }
    }

    return [...byKey.values()];
  }

  private async safeRead(featureDir: string, fileName: string): Promise<string | null> {
    try { return await this.fileManager.readSpecFile(featureDir, fileName); } catch { return null; }
  }
}
