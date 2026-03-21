/**
 * Quality Tools — 4 tools for quality validation, compliance, and cross-analysis.
 * Thin tools: validate input → call service → format output.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { ComplianceEngine } from "../services/compliance-engine.js";
import type { CrossAnalyzer } from "../services/cross-analyzer.js";
import type { ChecklistDomain } from "../constants.js";
import type { ChecklistItem, VerificationResult } from "../types.js";
import {
  checklistInputSchema,
  verifyTasksInputSchema,
  complianceCheckInputSchema,
  crossAnalyzeInputSchema,
} from "../schemas/quality.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters. Use sdd_get_status to see current state.";
}

/** Domain-specific checklist definitions */
const DOMAIN_CHECKS: Record<ChecklistDomain, Array<{ id: string; category: string; check: string; mandatory: boolean }>> = {
  security: [
    { id: "SEC-01", category: "Authentication", check: "Authentication mechanism is specified with method (OAuth2, JWT, etc.)", mandatory: true },
    { id: "SEC-02", category: "Authorization", check: "Authorization model is defined (RBAC, ABAC, etc.)", mandatory: true },
    { id: "SEC-03", category: "Input Validation", check: "All user inputs have validation rules specified", mandatory: true },
    { id: "SEC-04", category: "Encryption", check: "Data encryption at rest and in transit is specified", mandatory: true },
    { id: "SEC-05", category: "Secrets Management", check: "Secrets storage and rotation strategy is defined", mandatory: true },
    { id: "SEC-06", category: "Audit Logging", check: "Security-relevant events are logged", mandatory: true },
    { id: "SEC-07", category: "OWASP", check: "OWASP Top 10 risks are addressed in design", mandatory: false },
    { id: "SEC-08", category: "Rate Limiting", check: "Rate limiting and throttling are specified for public endpoints", mandatory: false },
  ],
  accessibility: [
    { id: "A11Y-01", category: "WCAG", check: "WCAG 2.1 compliance level is specified (A, AA, or AAA)", mandatory: true },
    { id: "A11Y-02", category: "Keyboard", check: "All interactive elements are keyboard accessible", mandatory: true },
    { id: "A11Y-03", category: "Screen Reader", check: "ARIA labels and roles are specified for dynamic content", mandatory: true },
    { id: "A11Y-04", category: "Color Contrast", check: "Color contrast ratios meet minimum requirements", mandatory: true },
    { id: "A11Y-05", category: "Alt Text", check: "All images have meaningful alt text specified", mandatory: true },
    { id: "A11Y-06", category: "Focus Management", check: "Focus management strategy is defined for SPAs", mandatory: false },
    { id: "A11Y-07", category: "Responsive", check: "Content is readable at 200% zoom", mandatory: false },
  ],
  performance: [
    { id: "PERF-01", category: "Response Time", check: "API response time SLAs are defined", mandatory: true },
    { id: "PERF-02", category: "Throughput", check: "Expected concurrent users and request rates are specified", mandatory: true },
    { id: "PERF-03", category: "Caching", check: "Caching strategy is defined (CDN, application, database)", mandatory: true },
    { id: "PERF-04", category: "Database", check: "Database query optimization requirements are specified", mandatory: true },
    { id: "PERF-05", category: "Pagination", check: "Large data sets use pagination or streaming", mandatory: true },
    { id: "PERF-06", category: "Load Testing", check: "Load testing targets and methodology are defined", mandatory: false },
    { id: "PERF-07", category: "Monitoring", check: "Performance monitoring and alerting thresholds are specified", mandatory: false },
  ],
  testing: [
    { id: "TEST-01", category: "Unit Tests", check: "Unit test coverage target is defined", mandatory: true },
    { id: "TEST-02", category: "Integration", check: "Integration test strategy is specified", mandatory: true },
    { id: "TEST-03", category: "E2E", check: "End-to-end test scenarios are mapped to acceptance criteria", mandatory: true },
    { id: "TEST-04", category: "Test Data", check: "Test data strategy is defined (fixtures, factories, seeds)", mandatory: true },
    { id: "TEST-05", category: "CI Pipeline", check: "Tests are integrated into CI/CD pipeline", mandatory: true },
    { id: "TEST-06", category: "Regression", check: "Regression test suite is maintained", mandatory: false },
    { id: "TEST-07", category: "Mutation", check: "Mutation testing or property-based testing is considered", mandatory: false },
  ],
  documentation: [
    { id: "DOC-01", category: "API Docs", check: "API endpoints are documented with request/response schemas", mandatory: true },
    { id: "DOC-02", category: "Architecture", check: "Architecture decision records (ADRs) exist for key decisions", mandatory: true },
    { id: "DOC-03", category: "Setup Guide", check: "Developer setup guide covers local environment configuration", mandatory: true },
    { id: "DOC-04", category: "Runbook", check: "Operational runbook covers deployment and incident response", mandatory: true },
    { id: "DOC-05", category: "Changelog", check: "Changelog is maintained with semantic versioning", mandatory: true },
    { id: "DOC-06", category: "Code Comments", check: "Complex logic has inline documentation", mandatory: false },
  ],
  deployment: [
    { id: "DEPLOY-01", category: "CI/CD", check: "CI/CD pipeline is defined with build, test, deploy stages", mandatory: true },
    { id: "DEPLOY-02", category: "Environments", check: "Environment strategy is defined (dev, staging, production)", mandatory: true },
    { id: "DEPLOY-03", category: "Rollback", check: "Rollback strategy is documented and tested", mandatory: true },
    { id: "DEPLOY-04", category: "Health Checks", check: "Application health check endpoints are specified", mandatory: true },
    { id: "DEPLOY-05", category: "Config Management", check: "Configuration management strategy separates config from code", mandatory: true },
    { id: "DEPLOY-06", category: "Blue-Green", check: "Zero-downtime deployment strategy is considered", mandatory: false },
    { id: "DEPLOY-07", category: "IaC", check: "Infrastructure is defined as code (Terraform, Bicep, etc.)", mandatory: false },
  ],
  general: [
    { id: "GEN-01", category: "Requirements", check: "All requirements use EARS notation", mandatory: true },
    { id: "GEN-02", category: "Traceability", check: "Every requirement has acceptance criteria", mandatory: true },
    { id: "GEN-03", category: "Design", check: "Architecture design covers all specified requirements", mandatory: true },
    { id: "GEN-04", category: "Tasks", check: "All tasks trace back to at least one requirement", mandatory: true },
    { id: "GEN-05", category: "Error Handling", check: "Error handling strategy is defined for all failure modes", mandatory: true },
    { id: "GEN-06", category: "Dependencies", check: "External dependencies are listed with versions and alternatives", mandatory: false },
  ],
};

export function registerQualityTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  complianceEngine: ComplianceEngine,
  crossAnalyzer: CrossAnalyzer
): void {
  // ─── sdd_checklist ───
  server.registerTool(
    "sdd_checklist",
    {
      title: "Generate Quality Checklist",
      description:
        "Generates a domain-specific quality checklist (security, accessibility, performance, etc.) by analyzing SPECIFICATION.md and DESIGN.md. Writes CHECKLIST.md.",
      inputSchema: checklistInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ domain, feature_number, spec_dir, force }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }
        const featureDir = feature.directory;

        // Read specification and design for evidence matching
        let specContent = "";
        try {
          specContent = await fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
        } catch {
          throw new Error(
            `SPECIFICATION.md not found in ${featureDir}.\n→ Fix: Run sdd_write_spec first.`
          );
        }

        let designContent = "";
        try {
          designContent = await fileManager.readSpecFile(featureDir, "DESIGN.md");
        } catch {
          // Design is optional for checklist generation
        }

        const combined = `${specContent}\n${designContent}`.toLowerCase();
        const checks = DOMAIN_CHECKS[domain] || DOMAIN_CHECKS.general;

        // Evaluate each check item against spec/design content
        const items: ChecklistItem[] = checks.map((check) => {
          const keywords = check.check.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
          const matchCount = keywords.filter((kw) => combined.includes(kw)).length;
          const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

          let status: "pass" | "fail" | "pending";
          let evidence: string | undefined;
          if (matchRatio >= 0.4) {
            status = "pass";
            evidence = `Keywords matched in specification/design artifacts`;
          } else if (matchRatio > 0) {
            status = "pending";
            evidence = `Partial coverage detected — review recommended`;
          } else {
            status = "fail";
          }

          return {
            id: check.id,
            category: check.category,
            check: check.check,
            status,
            evidence,
            mandatory: check.mandatory,
          };
        });

        const passCount = items.filter((i) => i.status === "pass").length;
        const failCount = items.filter((i) => i.status === "fail").length;
        const pendingCount = items.filter((i) => i.status === "pending").length;
        const mandatoryItems = items.filter((i) => i.mandatory);
        const mandatoryPassed = mandatoryItems.filter((i) => i.status === "pass").length;
        const mandatoryPassRate = mandatoryItems.length > 0
          ? Math.round((mandatoryPassed / mandatoryItems.length) * 100)
          : 100;

        // Render and write CHECKLIST.md
        const content = await templateEngine.renderWithFrontmatter("checklist", {
          title: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Quality Checklist`,
          feature_id: feature_number,
          domain,
          items: JSON.stringify(items, null, 2),
          pass_count: String(passCount),
          fail_count: String(failCount),
          pending_count: String(pendingCount),
          mandatory_pass_rate: String(mandatoryPassRate),
        });

        const filePath = await fileManager.writeSpecFile(featureDir, "CHECKLIST.md", content, force);

        const result = {
          domain,
          items,
          pass_count: passCount,
          fail_count: failCount,
          pending_count: pendingCount,
          mandatory_pass_rate: mandatoryPassRate,
          file_written: filePath,
          explanation: `Generated ${domain} quality checklist with ${items.length} items. ${passCount} passed, ${failCount} failed, ${pendingCount} pending review. Mandatory pass rate: ${mandatoryPassRate}%.`,
          next_steps: failCount > 0
            ? `Address ${failCount} failing checks in SPECIFICATION.md or DESIGN.md. Focus on mandatory items first (${mandatoryItems.length - mandatoryPassed} mandatory items need attention).`
            : "All checks addressed. Proceed to the next pipeline phase.",
          learning_note: `The ${domain} checklist validates that your specification and design artifacts address key ${domain} concerns. Items marked 'pending' have partial coverage and should be reviewed manually.`,
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_checklist", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_verify_tasks ───
  server.registerTool(
    "sdd_verify_tasks",
    {
      title: "Verify Task Completions",
      description:
        "Reads TASKS.md and checks code_paths for implementation evidence. Detects phantom completions — tasks marked [x] but with no corresponding code. Writes VERIFICATION.md.",
      inputSchema: verifyTasksInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, code_paths }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }
        const featureDir = feature.directory;

        // Read TASKS.md
        let tasksContent: string;
        try {
          tasksContent = await fileManager.readSpecFile(featureDir, "TASKS.md");
        } catch {
          throw new Error(
            `TASKS.md not found in ${featureDir}.\n→ Fix: Run sdd_write_tasks first.`
          );
        }

        // Parse task entries: match lines like "- [x] T001: Description" or "- [ ] T002: Description"
        const taskRegex = /- \[(x| )\]\s*(T\d{3}):\s*(.+)/g;
        let match;
        const tasks: Array<{ id: string; description: string; claimed_done: boolean }> = [];
        while ((match = taskRegex.exec(tasksContent)) !== null) {
          tasks.push({
            id: match[2],
            description: match[3].trim(),
            claimed_done: match[1] === "x",
          });
        }

        if (tasks.length === 0) {
          throw new Error(
            `No tasks found in TASKS.md. Expected format: "- [x] T001: Description".\n→ Fix: Ensure TASKS.md uses the standard task format.`
          );
        }

        // Read all code files for evidence
        const codeContents: string[] = [];
        for (const codePath of code_paths) {
          try {
            const content = await fileManager.readProjectFile(codePath);
            codeContents.push(content);
          } catch {
            // Skip unreadable paths
          }
        }
        const combinedCode = codeContents.join("\n");

        // Verify each task
        const results: VerificationResult[] = tasks.map((task) => {
          const idInCode = combinedCode.includes(task.id);
          // Also check for description keywords (3+ word match)
          const descWords = task.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const keywordMatches = descWords.filter((w) => combinedCode.toLowerCase().includes(w)).length;
          const hasEvidence = idInCode || keywordMatches >= Math.min(3, descWords.length);

          const evidence: string[] = [];
          if (idInCode) evidence.push(`Task ID ${task.id} found in code`);
          if (keywordMatches > 0) evidence.push(`${keywordMatches}/${descWords.length} description keywords found in code`);
          if (!hasEvidence) evidence.push("No implementation evidence found in provided code paths");

          const phantom = task.claimed_done && !hasEvidence;
          const verifiedStatus = hasEvidence ? "verified" : (task.claimed_done ? "phantom" : "not_started");

          return {
            task_id: task.id,
            claimed_status: task.claimed_done ? "complete" : "incomplete",
            verified_status: verifiedStatus,
            evidence,
            phantom,
          };
        });

        const verifiedCount = results.filter((r) => r.verified_status === "verified").length;
        const phantomCount = results.filter((r) => r.phantom).length;
        const passRate = tasks.length > 0 ? Math.round((verifiedCount / tasks.length) * 100) : 0;

        // Generate verification diagram
        const diagramLines = ["flowchart TD"];
        for (const r of results.slice(0, 15)) {
          const style = r.phantom ? ":::phantom" : r.verified_status === "verified" ? ":::verified" : ":::pending";
          diagramLines.push(`  ${r.task_id}[${r.task_id}: ${r.claimed_status}]${style}`);
        }
        diagramLines.push("  classDef verified fill:#4caf50,stroke:#333");
        diagramLines.push("  classDef phantom fill:#f44336,stroke:#333,color:#fff");
        diagramLines.push("  classDef pending fill:#ff9800,stroke:#333");
        const diagram = diagramLines.join("\n");

        // Write VERIFICATION.md
        const content = await templateEngine.renderWithFrontmatter("verification", {
          title: "Task Verification Report",
          feature_id: feature_number,
          results: JSON.stringify(results, null, 2),
          total_tasks: String(tasks.length),
          verified_count: String(verifiedCount),
          phantom_count: String(phantomCount),
          pass_rate: String(passRate),
          diagram,
        });

        await fileManager.writeSpecFile(featureDir, "VERIFICATION.md", content, true);

        const report = {
          feature_number,
          results,
          total_tasks: tasks.length,
          verified_count: verifiedCount,
          phantom_count: phantomCount,
          pass_rate: passRate,
          explanation: `Verified ${tasks.length} tasks against ${code_paths.length} code paths. ${verifiedCount} verified, ${phantomCount} phantom completions detected. Pass rate: ${passRate}%.`,
          diagram,
          next_steps: phantomCount > 0
            ? `${phantomCount} tasks are marked complete but have no code evidence. Review these phantom completions and either implement the missing code or update TASKS.md.`
            : "All completed tasks have implementation evidence. Verification passed.",
          learning_note: "Phantom completions occur when a task is marked [x] but no corresponding code is found in the specified paths. This helps catch accidental check-offs and ensures specification-code alignment.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(report, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_verify_tasks", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_compliance_check ───
  server.registerTool(
    "sdd_compliance_check",
    {
      title: "Run Compliance Check",
      description:
        "Validates specification and design against a compliance framework (HIPAA, SOC2, GDPR, PCI-DSS, ISO27001, or general). Writes COMPLIANCE.md.",
      inputSchema: complianceCheckInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ framework, feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }
        const featureDir = feature.directory;

        // Read specification
        let specContent: string;
        try {
          specContent = await fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
        } catch {
          throw new Error(
            `SPECIFICATION.md not found in ${featureDir}.\n→ Fix: Run sdd_write_spec first.`
          );
        }

        // Read design (optional)
        let designContent = "";
        try {
          designContent = await fileManager.readSpecFile(featureDir, "DESIGN.md");
        } catch {
          // Design is optional for compliance check
        }

        // Run compliance check
        const complianceResult = complianceEngine.checkCompliance(framework, specContent, designContent);

        // Write COMPLIANCE.md
        const content = await templateEngine.renderWithFrontmatter("compliance", {
          title: `${framework.toUpperCase()} Compliance Report`,
          feature_id: feature_number,
          framework,
          controls_checked: String(complianceResult.controls_checked),
          controls_passed: String(complianceResult.controls_passed),
          controls_failed: String(complianceResult.controls_failed),
          controls_na: String(complianceResult.controls_na),
          findings: JSON.stringify(complianceResult.findings, null, 2),
          overall_status: complianceResult.overall_status,
        });

        await fileManager.writeSpecFile(featureDir, "COMPLIANCE.md", content, true);

        const result = {
          ...complianceResult,
          file_written: join(featureDir, "COMPLIANCE.md"),
          learning_note: `Compliance checks match specification and design keywords against ${framework.toUpperCase()} controls. Failing controls indicate areas where your spec or design should explicitly address the requirement. Add relevant terms and sections, then re-run the check.`,
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_compliance_check", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_cross_analyze ───
  server.registerTool(
    "sdd_cross_analyze",
    {
      title: "Cross-Artifact Analysis",
      description:
        "Cross-artifact consistency analysis: checks alignment between SPECIFICATION.md, DESIGN.md, and TASKS.md. Finds orphaned requirements, missing designs, and untraced tasks. Writes CROSS_ANALYSIS.md.",
      inputSchema: crossAnalyzeInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}`);
        }
        const featureDir = feature.directory;

        // Run cross-analysis
        const analysisResult = await crossAnalyzer.analyze(featureDir);

        // Write CROSS_ANALYSIS.md
        const content = await templateEngine.renderWithFrontmatter("cross_analysis", {
          title: "Cross-Artifact Consistency Analysis",
          feature_id: feature_number,
          spec_design_alignment: JSON.stringify(analysisResult.spec_design_alignment, null, 2),
          design_tasks_alignment: JSON.stringify(analysisResult.design_tasks_alignment, null, 2),
          orphaned_requirements: analysisResult.orphaned_requirements,
          orphaned_tasks: analysisResult.orphaned_tasks,
          missing_designs: analysisResult.missing_designs,
          consistency_score: String(analysisResult.consistency_score),
          diagram: analysisResult.diagram,
        });

        await fileManager.writeSpecFile(featureDir, "CROSS_ANALYSIS.md", content, true);

        const result = {
          ...analysisResult,
          file_written: join(featureDir, "CROSS_ANALYSIS.md"),
          next_steps: analysisResult.consistency_score < 100
            ? `Consistency score is ${analysisResult.consistency_score}%. Review orphaned requirements (${analysisResult.orphaned_requirements.length}) and orphaned tasks (${analysisResult.orphaned_tasks.length}). Update DESIGN.md and TASKS.md to reference all requirements.`
            : "Perfect consistency score. All requirements are traced through design and tasks.",
          learning_note: "Cross-analysis ensures every requirement flows from SPECIFICATION.md → DESIGN.md → TASKS.md. Orphaned items indicate gaps in traceability that can lead to missing features or wasted effort.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_cross_analyze", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
