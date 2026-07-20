export const REQUIREMENT_ID_PATTERN = /\bREQ-[A-Z]+-\d{3}\b/g;
/** Canonical ID shape (no flags) — compose context-specific patterns from this source. */
export const REQUIREMENT_ID_SOURCE = String.raw`REQ-[A-Z]+-\d{3}`;
/** Requirement section heading in SPEC.md: `### REQ-<AREA>-<NNN>: Title` */
export const REQUIREMENT_HEADING_PATTERN = /### (REQ-[A-Z]+-\d{3})/g;
/** Requirement ID at the start of a spec heading or table row (metrics extraction). */
export const REQUIREMENT_REF_PATTERN = /^##?\s+REQ-[A-Z]+-\d+|^\|\s*REQ-[A-Z]+-\d+/gm;
export const TASK_ID_PATTERN = /\bT-?\d{3}\b/g;
export const TASK_LINE_PATTERN =
  /^-\s+\[[ x]\]\s+(T-?\d{3})(?::)?\s+(?:\[P\]\s+)?(?:\[(US\d+)\]\s+)?(.+)/gm;

export function normalizeTaskId(taskId: string): string {
  const match = /^T-?(\d{3})$/i.exec(taskId);
  if (!match) {
    throw new Error(`Invalid task ID: ${taskId}. Expected T-001.`);
  }
  return `T-${match[1]}`;
}

export function formatTaskId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error(`Task sequence out of range: ${sequence}`);
  }
  return `T-${String(sequence).padStart(3, "0")}`;
}

export function extractRequirementIds(text: string): string[] {
  return [...new Set([...text.matchAll(REQUIREMENT_ID_PATTERN)].map((match) => match[0]))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function extractTaskIds(text: string): string[] {
  return [
    ...new Set([...text.matchAll(TASK_ID_PATTERN)].map((match) => normalizeTaskId(match[0]))),
  ].sort((a, b) => a.localeCompare(b));
}

/** A parsed requirement section from SPECIFICATION.md. */
export interface RequirementSection {
  id: string;
  title: string;
  /** Requirement statement text (title + body), excluding acceptance criteria. */
  text: string;
}

const REQUIREMENT_SECTION_HEADING = /^###\s+(REQ-[A-Z]+-\d{3})\b:?\s*(.*)$/;
const ACCEPTANCE_HEADING = /^\s*#{1,6}\s*acceptance\b/i;
const ACCEPTANCE_LABEL = /^\s*\*{0,2}acceptance\s+criteria\*{0,2}\s*:?/i;

/**
 * Parse requirement sections (`### REQ-<AREA>-<NNN>: Title`) from a
 * specification document. Each section's text is the title plus the body up to
 * the next heading, with acceptance-criteria prose excluded. Repeated
 * requirement IDs are de-duplicated (first occurrence wins), so the result is
 * deterministic even when a requirement heading appears more than once.
 */
export function extractRequirementSections(spec: string): RequirementSection[] {
  const lines = spec.split(/\r?\n/);
  const sections: RequirementSection[] = [];
  const seen = new Set<string>();

  let current: { id: string; title: string; body: string[] } | null = null;
  let inAcceptance = false;

  const flush = (): void => {
    if (current && !seen.has(current.id)) {
      seen.add(current.id);
      const text = [current.title, ...current.body].join("\n").trim();
      sections.push({ id: current.id, title: current.title.trim(), text });
    }
    current = null;
    inAcceptance = false;
  };

  for (const line of lines) {
    const heading = REQUIREMENT_SECTION_HEADING.exec(line);
    if (heading) {
      flush();
      current = { id: heading[1], title: heading[2] ?? "", body: [] };
      continue;
    }
    if (!current) continue;

    // Any non-requirement heading at level 1-3 ends the requirement body.
    const level = /^(#{1,3})\s/.exec(line);
    if (level) {
      flush();
      continue;
    }

    if (ACCEPTANCE_HEADING.test(line) || ACCEPTANCE_LABEL.test(line)) {
      inAcceptance = true;
      continue;
    }
    if (inAcceptance) continue;

    current.body.push(line);
  }
  flush();

  return sections;
}

