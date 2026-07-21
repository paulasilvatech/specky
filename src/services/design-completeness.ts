/**
 * Design-completeness heuristic — checks DESIGN.md for the presence of key
 * architectural section headings. Extracted from StateMachine so the heuristic
 * lives independently of state persistence.
 */

import type { FileManager } from "./file-manager.js";

/** Result of the DESIGN.md section-heading completeness check. */
export interface DesignCompletenessResult {
  score: number;
  total_sections: number;
  found_sections: string[];
  missing_sections: string[];
}

const DESIGN_SECTIONS: { name: string; patterns: string[] }[] = [
  { name: "System Context", patterns: ["system context", "c4 level 1", "context"] },
  { name: "Container", patterns: ["container", "c4 level 2"] },
  { name: "Component", patterns: ["component", "c4 level 3"] },
  { name: "Data Model", patterns: ["data model", "data", "entity"] },
  { name: "API Contract", patterns: ["api contract", "api", "endpoint"] },
  { name: "Infrastructure", patterns: ["infrastructure", "deployment"] },
  { name: "Security", patterns: ["security", "authentication", "authorization"] },
  { name: "Architecture Decision", patterns: ["architecture decision", "adr"] },
  { name: "Error Handling", patterns: ["error handling", "error"] },
  { name: "Diagrams", patterns: ["diagrams", "system diagrams"] },
  { name: "Cross-Cutting", patterns: ["cross-cutting", "logging", "monitoring"] },
  { name: "Code-Level", patterns: ["code-level", "class", "interface"] },
];

/**
 * Validate the completeness of a DESIGN.md file by checking for
 * the presence of key architectural section headings.
 */
export async function validateDesignCompleteness(
  fileManager: FileManager,
  featureDir: string,
): Promise<DesignCompletenessResult> {
  let content: string;
  try {
    content = await fileManager.readSpecFile(featureDir, "DESIGN.md");
  } catch {
    return {
      score: 0,
      total_sections: DESIGN_SECTIONS.length,
      found_sections: [],
      missing_sections: DESIGN_SECTIONS.map((s) => s.name),
    };
  }

  const contentLower = content.toLowerCase();
  const foundSections: string[] = [];
  const missingSections: string[] = [];

  for (const section of DESIGN_SECTIONS) {
    const found = section.patterns.some((pattern) => contentLower.includes(pattern));
    if (found) {
      foundSections.push(section.name);
    } else {
      missingSections.push(section.name);
    }
  }

  const totalSections = DESIGN_SECTIONS.length;
  const score = totalSections > 0 ? Math.round((foundSections.length / totalSections) * 100) : 0;

  return {
    score,
    total_sections: totalSections,
    found_sections: foundSections,
    missing_sections: missingSections,
  };
}
