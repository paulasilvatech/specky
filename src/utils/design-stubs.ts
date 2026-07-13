/**
 * design-stubs.ts — Derive minimal DESIGN.md section content from SPECIFICATION.md
 * when optional write_design fields are omitted.
 */
import { extractRequirementIds } from "./id-contracts.js";

const NFR_KEYWORDS =
  /\b(security|secur|encrypt|auth|gdpr|hipaa|pci|compliance|performance|latency|throughput|availab|scalability|reliab|observab|monitor|logging|backup|disaster|SLA|uptime)\b/i;

const SECURITY_KEYWORDS =
  /\b(security|secur|encrypt|auth|oauth|jwt|rbac|permission|gdpr|hipaa|pci|tls|https|secret|credential)\b/i;

const ERROR_KEYWORDS =
  /\b(error|exception|fail|timeout|retry|fallback|unwanted|invalid|reject)\b/i;

const DATA_KEYWORDS =
  /\b(data|store|storage|database|persist|table|entity|model|schema|redis|postgres|mongo|sql)\b/i;

const INFRA_KEYWORDS =
  /\b(deploy|infrastructure|container|kubernetes|docker|cloud|scale|postgres|redis|cdn|region)\b/i;

const API_KEYWORDS =
  /\b(api|endpoint|http|rest|graphql|GET|POST|PUT|PATCH|DELETE|route)\b/i;

const CROSS_KEYWORDS =
  /\b(logging|monitor|observab|tracing|metric|audit|cross-cutting)\b/i;

export interface SpecRequirementBlock {
  id: string;
  text: string;
  isNfr: boolean;
}

/**
 * Parse requirement blocks from a Specky SPECIFICATION.md body.
 * Headings look like: ### REQ-FOO-001: (event_driven)
 */
export function parseSpecRequirementBlocks(specContent: string): SpecRequirementBlock[] {
  const blocks: SpecRequirementBlock[] = [];
  const reqRegex = /^###\s+(REQ-[A-Z]+-\d{3})\s*[:\-—]\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = reqRegex.exec(specContent)) !== null) {
    const id = match[1];
    const startPos = match.index + match[0].length;
    const nextHeading = specContent.indexOf("\n### ", startPos);
    const nextSection = specContent.indexOf("\n## ", startPos);
    let end = specContent.length;
    if (nextHeading > -1) end = Math.min(end, nextHeading);
    if (nextSection > -1) end = Math.min(end, nextSection);
    const text = specContent.slice(startPos, end).trim();
    const headingHint = match[2].trim();
    const isNfr =
      NFR_KEYWORDS.test(text) ||
      NFR_KEYWORDS.test(headingHint) ||
      /non[- ]?functional/i.test(headingHint);
    blocks.push({ id, text, isNfr });
  }
  return blocks;
}

/** First non-empty line of requirement body that looks like EARS prose (not markdown chrome). */
export function extractEarsProse(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("**") && trimmed.endsWith(":**")) continue;
    if (/^\*\*[^*]+?:\*\*/.test(trimmed)) continue;
    if (trimmed.startsWith("- ") && !/\bshall\b/i.test(trimmed)) continue;
    const cleaned = trimmed.replace(/^[-*]\s+/, "").replace(/^\*\*(.+)\*\*$/, "$1");
    if (cleaned.length > 12) return cleaned;
  }
  return body.split("\n").map((l) => l.trim()).find((l) => l.length > 12) ?? body.slice(0, 120);
}

export function partitionFunctionalNonFunctional<T extends { id: string; text: string }>(
  requirements: T[],
): { functional: T[]; nonfunctional: T[] } {
  const functional: T[] = [];
  const nonfunctional: T[] = [];
  for (const req of requirements) {
    if (NFR_KEYWORDS.test(req.text) || /^REQ-NFR-/i.test(req.id)) {
      nonfunctional.push(req);
    } else {
      functional.push(req);
    }
  }
  return { functional, nonfunctional };
}

function bulletsFor(ids: string[], label: string): string {
  if (ids.length === 0) {
    return `- No ${label} signals detected in SPECIFICATION.md — refine this section during design review.`;
  }
  return ids.map((id) => `- ${id}`).join("\n");
}

export interface DesignStubs {
  requirement_references: string;
  component_design: string;
  code_level_design: string;
  data_models: string;
  infrastructure: string;
  security_architecture: string;
  error_handling: string;
  cross_cutting: string;
  api_contracts_stub: string;
}

export function deriveDesignStubs(specContent: string): DesignStubs {
  const blocks = parseSpecRequirementBlocks(specContent);
  const allIds = blocks.map((b) => b.id);
  const fallbackIds = allIds.length > 0 ? allIds : extractRequirementIds(specContent);

  const matching = (re: RegExp) => blocks.filter((b) => re.test(b.text)).map((b) => b.id);

  const componentDesign =
    fallbackIds.length > 0
      ? fallbackIds.map((id) => `- Component coverage for ${id}`).join("\n")
      : "- Derive components from each REQ-ID in SPECIFICATION.md.";

  return {
    requirement_references:
      fallbackIds.length > 0
        ? fallbackIds.map((id) => `- ${id}`).join("\n")
        : "[TODO: requirement_references]",
    component_design: componentDesign,
    code_level_design:
      "- Map each REQ-ID to modules/classes during implementation planning.\n" +
      (fallbackIds.slice(0, 8).map((id) => `- ${id}: pending class/module assignment`).join("\n") ||
        "- Pending class/module assignment."),
    data_models: bulletsFor(matching(DATA_KEYWORDS), "data-model"),
    infrastructure: bulletsFor(matching(INFRA_KEYWORDS), "infrastructure"),
    security_architecture: bulletsFor(matching(SECURITY_KEYWORDS), "security"),
    error_handling: bulletsFor(matching(ERROR_KEYWORDS), "error-handling"),
    cross_cutting: bulletsFor(matching(CROSS_KEYWORDS), "cross-cutting"),
    api_contracts_stub: bulletsFor(matching(API_KEYWORDS), "API"),
  };
}
