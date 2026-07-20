/**
 * IntentDriftEngine — Detects drift between CONSTITUTION.md principles
 * and SPECIFICATION.md requirements / TASKS.md tasks using keyword overlap.
 *
 * Evidence: arXiv:2603.22106 (intent drift as leading indicator of requirement failures)
 */

import type { DriftSnapshot } from "../types.js";

export interface ConstitutionalPrinciple {
  id: string;
  heading: string;
  keywords: string[];
}

export interface DriftReport {
  total_principles: number;
  covered_principles: number;
  orphaned_principles: ConstitutionalPrinciple[];
  unimplemented_principles: ConstitutionalPrinciple[];
  intent_drift_score: number;
  intent_drift_label: "aligned" | "minor_drift" | "significant_drift";
}

export type DriftTrend = "improving" | "stable" | "worsening";

export class IntentDriftEngine {
  /**
   * Extract constitutional principles from CONSTITUTION.md.
   * Looks for H3 headings under ## Article sections.
   */
  extractPrinciples(constitutionContent: string): ConstitutionalPrinciple[] {
    const principles: ConstitutionalPrinciple[] = [];
    const lines = constitutionContent.split("\n");
    let inArticle = false;
    let idCounter = 1;

    for (const line of lines) {
      if (/^##\s+Article/i.test(line)) {
        inArticle = true;
        continue;
      }
      if (/^##\s/.test(line)) {
        inArticle = false;
        continue;
      }
      if (inArticle && /^###\s+/.test(line)) {
        const heading = line.replace(/^###\s+/, "").trim();
        const keywords = this.extractKeywords(heading);
        principles.push({
          id: `P-${String(idCounter++).padStart(3, "0")}`,
          heading,
          keywords,
        });
      }
    }
    return principles;
  }

  /**
   * Compute coverage: check each principle against spec and tasks content.
   * A principle is "covered" if ≥2 keywords appear in the content.
   */
  computeCoverage(
    principles: ConstitutionalPrinciple[],
    specContent: string,
    tasksContent: string,
  ): DriftReport {
    const specLower = specContent.toLowerCase();
    const tasksLower = tasksContent.toLowerCase();

    const orphaned: ConstitutionalPrinciple[] = [];
    const unimplemented: ConstitutionalPrinciple[] = [];

    for (const principle of principles) {
      const specMatches = principle.keywords.filter((kw) => specLower.includes(kw.toLowerCase()));
      const taskMatches = principle.keywords.filter((kw) => tasksLower.includes(kw.toLowerCase()));
      if (specMatches.length < 2) orphaned.push(principle);
      if (taskMatches.length < 2) unimplemented.push(principle);
    }

    const total = principles.length;
    const covered = total - orphaned.length;
    const score = this.computeScore({
      orphaned_count: orphaned.length + unimplemented.length,
      total_principles: total,
    });
    const label = this.scoreToLabel(score);

    return {
      total_principles: total,
      covered_principles: covered,
      orphaned_principles: orphaned,
      unimplemented_principles: unimplemented,
      intent_drift_score: score,
      intent_drift_label: label,
    };
  }

  computeScore(data: { orphaned_count: number; total_principles: number }): number {
    if (data.total_principles === 0) return 0;
    return Math.min(100, Math.round((data.orphaned_count / data.total_principles) * 100));
  }

  computeTrend(history: DriftSnapshot[]): DriftTrend {
    if (history.length < 3) return "stable";
    const last3 = history.slice(-3).map((s) => s.score);
    const [a, b, c] = last3 as [number, number, number];
    if (c < b && b < a) return "improving";
    if (c > b && b > a) return "worsening";
    return "stable";
  }

  private scoreToLabel(score: number): "aligned" | "minor_drift" | "significant_drift" {
    if (score <= 20) return "aligned";
    if (score <= 40) return "minor_drift";
    return "significant_drift";
  }

  private extractKeywords(text: string): string[] {
    // Extract meaningful words: 4+ characters, no stop words
    const stopWords = new Set([
      "with",
      "from",
      "this",
      "that",
      "have",
      "will",
      "been",
      "when",
      "then",
      "each",
      "only",
      "must",
      "should",
    ]);
    return text
      .replace(/[^a-zA-Z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()))
      .map((w) => w.toLowerCase());
  }
}
