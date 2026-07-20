/**
 * EarsValidator — EARS pattern detection and validation.
 * Pure service with no disk dependencies.
 */

import type { EarsPatternName } from "../constants.js";
import type {
  BatchValidationResult,
  EarsImprovement,
  EarsRequirement,
  ValidationResult,
} from "../types.js";

interface PatternRule {
  name: EarsPatternName;
  regex: RegExp;
  priority: number;
  template: string;
}

// Bound regex input to keep the compound patterns (multiple greedy groups)
// away from pathological backtracking on long comma-heavy strings.
const MAX_MATCH_LEN = 2000;

const PATTERN_RULES: PatternRule[] = [
  // Complex is checked FIRST and requires a genuine compound (While+When, or
  // When+If). Otherwise "While <state>, when <event>, the system shall …"
  // would be swallowed by the state-driven rule and the complex pattern would
  // be unreachable.
  {
    name: "complex",
    regex:
      /^(?:While\s+.+?,\s+when\s+.+?,\s+|When\s+.+?,\s+if\s+.+?,\s+then\s+)the\s+(?:system|server|tool)\s+shall\s+/i,
    priority: 1,
    template: "While <state>, when <trigger>, the system shall <response>.",
  },
  {
    name: "event_driven",
    regex: /^When\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 2,
    template: "When <trigger>, the system shall <response>.",
  },
  {
    name: "state_driven",
    regex: /^While\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 3,
    template: "While <state>, the system shall <behavior>.",
  },
  {
    name: "optional",
    regex: /^Where\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 4,
    template: "Where <feature is included>, the system shall <behavior>.",
  },
  {
    name: "unwanted",
    regex: /^If\s+.+,\s+then\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 5,
    template: "If <unwanted condition>, then the system shall <mitigation>.",
  },
  {
    name: "ubiquitous",
    regex: /^The\s+(system|server|tool)\s+shall\s+/i,
    priority: 6,
    template: "The system shall <behavior>.",
  },
];

// Vague, non-measurable terms. Matched on word boundaries so "fast" does not
// fire on "breakfast" and "robust" not on "robustness".
const VAGUE_TERMS = [
  "fast",
  "quick",
  "slow",
  "good",
  "bad",
  "easy",
  "nice",
  "better",
  "best",
  "properly",
  "appropriate",
  "appropriately",
  "efficient",
  "efficiently",
  "robust",
  "seamless",
  "seamlessly",
  "intuitive",
  "user friendly",
  "user-friendly",
  "flexible",
  "scalable",
  "reliable",
  "simple",
  "modern",
  "state of the art",
  "state-of-the-art",
  "as needed",
  "as appropriate",
  "etc",
];

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class EarsValidator {
  /**
   * Detect which EARS pattern a requirement follows.
   */
  detectPattern(requirement: string): EarsPatternName {
    const trimmed = requirement.trim().slice(0, MAX_MATCH_LEN);

    // Check patterns in priority order (most specific first)
    for (const rule of PATTERN_RULES) {
      if (rule.regex.test(trimmed)) {
        return rule.name;
      }
    }

    return "unknown";
  }

  /**
   * Detect vague, non-measurable terms in a requirement (word-boundary match).
   */
  private findVagueTerms(requirement: string): string[] {
    const found: string[] = [];
    for (const term of VAGUE_TERMS) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (re.test(requirement)) found.push(term);
    }
    return found;
  }

  /**
   * Validate a single requirement against EARS patterns.
   */
  validate(requirement: string): ValidationResult {
    const pattern = this.detectPattern(requirement);
    const issues: string[] = [];

    if (pattern === "unknown") {
      issues.push("Requirement does not match any EARS pattern.");
      issues.push(
        "EARS patterns start with: 'The system shall', 'When...', 'While...', 'Where...', or 'If..., then...'",
      );
      return {
        valid: false,
        pattern,
        issues,
        suggestion: this.suggestImprovement(requirement).suggestion,
      };
    }

    // Check for testability
    if (requirement.trim().length < 20) {
      issues.push("Requirement is too short to be testable.");
    }

    // Check for vague terms (word-boundary, runs for every matched pattern)
    for (const term of this.findVagueTerms(requirement)) {
      issues.push(`Contains vague term "${term}" — replace with measurable criteria.`);
    }

    // Flag multiple "shall" clauses — a requirement should state one behaviour.
    const shallCount = (requirement.match(/\bshall\b/gi) ?? []).length;
    if (shallCount > 1) {
      issues.push('Contains multiple "shall" clauses — split into one requirement per behaviour.');
    }

    return {
      valid: issues.length === 0,
      pattern,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Suggest an EARS-compliant rewrite for a non-conforming requirement.
   */
  suggestImprovement(requirement: string): EarsImprovement {
    const trimmed = requirement.trim().toLowerCase();

    // Try to determine intent
    if (trimmed.includes("when") || trimmed.includes("trigger") || trimmed.includes("event")) {
      return {
        pattern: "event_driven",
        suggestion: `When <trigger event>, the system shall ${this.extractAction(requirement)}.`,
      };
    }

    if (trimmed.includes("while") || trimmed.includes("during") || trimmed.includes("state")) {
      return {
        pattern: "state_driven",
        suggestion: `While <system state>, the system shall ${this.extractAction(requirement)}.`,
      };
    }

    if (trimmed.includes("if") || trimmed.includes("error") || trimmed.includes("fail")) {
      return {
        pattern: "unwanted",
        suggestion: `If <unwanted condition>, then the system shall ${this.extractAction(requirement)}.`,
      };
    }

    if (trimmed.includes("option") || trimmed.includes("where") || trimmed.includes("config")) {
      return {
        pattern: "optional",
        suggestion: `Where <feature is enabled>, the system shall ${this.extractAction(requirement)}.`,
      };
    }

    // Default to ubiquitous
    return {
      pattern: "ubiquitous",
      suggestion: `The system shall ${this.extractAction(requirement)}.`,
    };
  }

  /**
   * Validate multiple requirements at once.
   */
  validateAll(requirements: EarsRequirement[]): BatchValidationResult {
    const results: ValidationResult[] = [];
    let valid = 0;
    let invalid = 0;

    for (const req of requirements) {
      const result = this.validate(req.text);
      results.push(result);
      if (result.valid) {
        valid++;
      } else {
        invalid++;
      }
    }

    return { valid, invalid, results };
  }

  /**
   * Extract the action part from a vague requirement so a rewrite does not
   * double up the boilerplate ("The system shall The system shall …").
   */
  private extractAction(requirement: string): string {
    let action = requirement.trim();
    const prefixes = [
      // Strip an existing EARS/boilerplate lead-in, INCLUDING "shall", so the
      // caller can prepend a fresh "The system shall".
      /^(the\s+)?(system|server|tool|app|application)\s+(shall|should|must|will|needs?\s+to|has\s+to)\s+/i,
      /^(make|ensure|do|create|implement|add|build)\s+/i,
    ];

    for (const prefix of prefixes) {
      action = action.replace(prefix, "");
    }

    // Clean up
    action = action.replace(/\.$/, "").trim();
    return action || "perform the specified action";
  }
}
