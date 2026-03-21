/**
 * EarsValidator — EARS pattern detection and validation.
 * Pure service with no disk dependencies.
 */

import type { EarsPatternName } from "../constants.js";
import type { ValidationResult, BatchValidationResult, EarsImprovement, EarsRequirement } from "../types.js";

interface PatternRule {
  name: EarsPatternName;
  regex: RegExp;
  priority: number;
  template: string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    name: "event_driven",
    regex: /^When\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 1,
    template: 'When <trigger>, the system shall <response>.',
  },
  {
    name: "state_driven",
    regex: /^While\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 2,
    template: 'While <state>, the system shall <behavior>.',
  },
  {
    name: "optional",
    regex: /^Where\s+.+,\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 3,
    template: 'Where <feature is included>, the system shall <behavior>.',
  },
  {
    name: "unwanted",
    regex: /^If\s+.+,\s+then\s+the\s+(system|server|tool)\s+shall\s+/i,
    priority: 4,
    template: 'If <unwanted condition>, then the system shall <mitigation>.',
  },
  {
    name: "complex",
    regex: /^(While\s+.+,\s+)?[Ww]hen\s+.+,\s+(if\s+.+,\s+)?the\s+(system|server|tool)\s+shall\s+/i,
    priority: 5,
    template: 'While <state>, when <trigger>, the system shall <response>.',
  },
  {
    name: "ubiquitous",
    regex: /^The\s+(system|server|tool)\s+shall\s+/i,
    priority: 6,
    template: 'The system shall <behavior>.',
  },
];

export class EarsValidator {
  /**
   * Detect which EARS pattern a requirement follows.
   */
  detectPattern(requirement: string): EarsPatternName {
    const trimmed = requirement.trim();

    // Check patterns in priority order (most specific first)
    for (const rule of PATTERN_RULES) {
      if (rule.regex.test(trimmed)) {
        return rule.name;
      }
    }

    return "unknown";
  }

  /**
   * Validate a single requirement against EARS patterns.
   */
  validate(requirement: string): ValidationResult {
    const pattern = this.detectPattern(requirement);
    const issues: string[] = [];

    if (pattern === "unknown") {
      issues.push("Requirement does not match any EARS pattern.");
      issues.push("EARS patterns start with: 'The system shall', 'When...', 'While...', 'Where...', or 'If..., then...'");
      return {
        valid: false,
        pattern,
        issues,
        suggestion: this.suggestImprovement(requirement).suggestion,
      };
    }

    // Check for testability
    if (requirement.length < 20) {
      issues.push("Requirement is too short to be testable.");
    }

    // Check for vague terms
    const vagueTerms = ["fast", "good", "easy", "nice", "better", "properly", "appropriate"];
    for (const term of vagueTerms) {
      if (requirement.toLowerCase().includes(term)) {
        issues.push(`Contains vague term "${term}" — replace with measurable criteria.`);
      }
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
   * Extract the action part from a vague requirement.
   */
  private extractAction(requirement: string): string {
    // Remove common prefixes
    let action = requirement.trim();
    const prefixes = [
      /^(the\s+)?(system|server|tool|app|application)\s+(should|must|will|needs?\s+to|has\s+to)\s+/i,
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
