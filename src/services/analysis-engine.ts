/**
 * AnalysisEngine — the single source of truth for the quality-gate computation.
 *
 * Extracted from the sdd_run_analysis handler so that every code path that
 * produces an ANALYSIS.md (the interactive pipeline AND sdd_auto_pipeline /
 * sdd_batch_transcripts) runs the same real coverage/traceability math instead
 * of hard-coding an APPROVE verdict. Pure and disk-free: callers read the files
 * and pass the contents in.
 */

import { extractRequirementIds } from "../utils/id-contracts.js";
import type { EarsValidator } from "./ears-validator.js";

export interface AnalysisInput {
  hasConstitution: boolean;
  hasSpec: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  specContent: string;
  designContent: string;
  tasksContent: string;
}

export type GateDecisionValue = "APPROVE" | "CHANGES_NEEDED" | "BLOCK";

export interface AnalysisResult {
  decision: GateDecisionValue;
  reasons: string[];
  coveragePercent: number;
  documentCoverage: number;
  earsCoverage: number;
  designCoverage: number;
  taskCoverage: number;
  gaps: string[];
  orphanCount: number;
  traceMatrix: string;
  reqIds: string[];
}

export class AnalysisEngine {
  constructor(private readonly earsValidator: EarsValidator) {}

  analyze(input: AnalysisInput): AnalysisResult {
    const {
      hasConstitution,
      hasSpec,
      hasDesign,
      hasTasks,
      specContent,
      designContent,
      tasksContent,
    } = input;

    const gaps: string[] = [];
    if (!hasConstitution) gaps.push("CONSTITUTION.md missing");
    if (!hasSpec) gaps.push("SPECIFICATION.md missing");
    if (!hasDesign) gaps.push("DESIGN.md missing");
    if (!hasTasks) gaps.push("TASKS.md missing");

    const reqIds = extractRequirementIds(specContent);
    const requirementRows = reqIds.map((reqId) => {
      const reqSectionPattern = new RegExp(
        String.raw`###\s+${reqId}[^\n]*\n+([\s\S]*?)(?=\n###\s+REQ-|\n---|$)`,
        "m",
      );
      const reqSection = reqSectionPattern.exec(specContent)?.[1] ?? "";
      const requirementText =
        reqSection
          .split("\n")
          .map((line) => line.trim())
          .find((line) => /\bshall\b/i.test(line)) ?? "";
      const earsValidation = requirementText
        ? this.earsValidator.validate(requirementText)
        : { valid: false, pattern: "unknown" as const, issues: ["No EARS statement found"] };
      const designMapped = designContent.includes(reqId);
      const taskMapped = tasksContent.includes(reqId);
      return {
        reqId,
        earsValid: earsValidation.valid,
        designMapped,
        taskMapped,
        status: earsValidation.valid && designMapped && taskMapped ? "Pass" : "Gap",
      };
    });

    if (hasSpec && reqIds.length === 0) gaps.push("No requirement IDs found in SPECIFICATION.md");

    const invalidEars = requirementRows.filter((row) => !row.earsValid).map((row) => row.reqId);
    const missingDesignRefs = requirementRows
      .filter((row) => !row.designMapped)
      .map((row) => row.reqId);
    const missingTaskRefs = requirementRows
      .filter((row) => !row.taskMapped)
      .map((row) => row.reqId);
    if (invalidEars.length > 0) gaps.push(`EARS invalid or missing for: ${invalidEars.join(", ")}`);
    if (missingDesignRefs.length > 0)
      gaps.push(`Design mapping missing for: ${missingDesignRefs.join(", ")}`);
    if (missingTaskRefs.length > 0)
      gaps.push(`Task mapping missing for: ${missingTaskRefs.join(", ")}`);

    const documentCoverage = Math.round(
      ([hasConstitution, hasSpec, hasDesign, hasTasks].filter(Boolean).length / 4) * 100,
    );
    const earsCoverage =
      reqIds.length > 0
        ? Math.round(((reqIds.length - invalidEars.length) / reqIds.length) * 100)
        : 0;
    const designCoverage =
      reqIds.length > 0
        ? Math.round(((reqIds.length - missingDesignRefs.length) / reqIds.length) * 100)
        : 0;
    const taskCoverage =
      reqIds.length > 0
        ? Math.round(((reqIds.length - missingTaskRefs.length) / reqIds.length) * 100)
        : 0;
    const coveragePercent = Math.round(
      (documentCoverage + earsCoverage + designCoverage + taskCoverage) / 4,
    );

    let decision: GateDecisionValue;
    const reasons: string[] = [];
    if (gaps.length === 0 && coveragePercent >= 90) {
      decision = "APPROVE";
      reasons.push(
        "All core documents are present and requirements are mapped through design and tasks.",
      );
    } else if (coveragePercent >= 70) {
      decision = "CHANGES_NEEDED";
      reasons.push(`Evidence coverage at ${coveragePercent}% — gaps require remediation.`);
    } else {
      decision = "BLOCK";
      reasons.push(
        `Evidence coverage at ${coveragePercent}% — critical specification evidence is missing.`,
      );
    }

    const fallbackDesignStatus = hasDesign ? "Present" : "Missing";
    const fallbackTaskStatus = hasTasks ? "Present" : "Missing";
    const fallbackStatus = hasSpec ? "No requirements found" : "Missing spec";
    const traceMatrix =
      requirementRows.length > 0
        ? requirementRows
            .map(
              (row) =>
                `| ${row.reqId} | ${row.designMapped ? "Mapped" : "Missing"} | ${row.taskMapped ? "Mapped" : "Missing"} | Pending | ${row.status} |`,
            )
            .join("\n")
        : `| Documents | ${fallbackDesignStatus} | ${fallbackTaskStatus} | Pending | ${fallbackStatus} |`;

    return {
      decision,
      reasons,
      coveragePercent,
      documentCoverage,
      earsCoverage,
      designCoverage,
      taskCoverage,
      gaps,
      orphanCount: missingDesignRefs.length + missingTaskRefs.length,
      traceMatrix,
      reqIds,
    };
  }
}
