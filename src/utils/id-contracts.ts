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
