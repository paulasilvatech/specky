export const REQUIREMENT_ID_PATTERN = /\bREQ-[A-Z]+-\d{3}\b/g;
export const TASK_ID_PATTERN = /\bT-?\d{3}\b/g;
export const TASK_LINE_PATTERN = /^-\s+\[[ x]\]\s+(T-?\d{3})(?::)?\s+(?:\[P\]\s+)?(?:\[(US\d+)\]\s+)?(.+)/gm;

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
  return [...new Set([...text.matchAll(REQUIREMENT_ID_PATTERN)].map((match) => match[0]))].sort((a, b) => a.localeCompare(b));
}

export function extractTaskIds(text: string): string[] {
  return [...new Set([...text.matchAll(TASK_ID_PATTERN)].map((match) => normalizeTaskId(match[0])))].sort((a, b) => a.localeCompare(b));
}
