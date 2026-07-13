/**
 * task-parser.ts — Dual-format TASKS.md parser.
 *
 * Canonical writers (sdd_write_tasks, auto_pipeline) emit markdown tables.
 * Legacy / hand-edited files may use checkbox bullets (`- [ ] T-001: …`).
 * This module accepts both and merges by task ID.
 */
import {
  extractRequirementIds,
  normalizeTaskId,
  TASK_ID_PATTERN,
  TASK_LINE_PATTERN,
} from "./id-contracts.js";

export interface ParsedTask {
  id: string;
  title: string;
  parallel: boolean;
  effort?: string;
  dependencies: string[];
  traces_to: string[];
  /** True only when a checkbox line marks the task `[x]`. Table rows default false. */
  claimed_done: boolean;
  subtasks: string[];
}

const TASK_TABLE_ROW =
  /^\|\s*(T-?\d{3})\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|$/i;

const SUBTASK_LINE = /^\s{2,}-\s+(?:\[[ x]\]\s+)?(.+)/;
const TRAILING_TRACE_SUFFIX =
  /\s*[(\[]?\s*(?:traces?(?:_to)?\s*:\s*)?REQ-[A-Z]+-\d{3}(?:\s*,\s*REQ-[A-Z]+-\d{3})*\s*[)\]]?\s*$/i;

function splitCellList(cell: string): string[] {
  const trimmed = cell.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed === "–") return [];
  return trimmed
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "—" && part !== "-" && part !== "–");
}

function parseDependencies(cell: string): string[] {
  const ids: string[] = [];
  for (const token of splitCellList(cell)) {
    for (const match of token.matchAll(TASK_ID_PATTERN)) {
      try {
        ids.push(normalizeTaskId(match[0]));
      } catch {
        // skip malformed tokens
      }
    }
  }
  return [...new Set(ids)];
}

function parseTraces(cell: string, title: string): string[] {
  const fromCell = extractRequirementIds(cell);
  const fromTitle = extractRequirementIds(title);
  return [...new Set([...fromCell, ...fromTitle])].sort((a, b) => a.localeCompare(b));
}

function cleanTitle(raw: string): string {
  return raw.replace(TRAILING_TRACE_SUFFIX, "").trim() || raw.trim();
}

function isSeparatorOrHeader(line: string): boolean {
  if (/^\|\s*[-:| ]+\s*\|$/.test(line)) return true;
  if (/^\|\s*ID\s*\|/i.test(line)) return true;
  if (/^\|\s*\*\*/.test(line)) return true; // effort summary totals
  return false;
}

function parseTableRows(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || isSeparatorOrHeader(trimmed)) continue;

    const match = TASK_TABLE_ROW.exec(trimmed);
    if (!match) continue;

    let id: string;
    try {
      id = normalizeTaskId(match[1]);
    } catch {
      continue;
    }

    const rawTitle = match[2].trim();
    if (!rawTitle) continue;

    const parallelCell = match[3].trim();
    const effortCell = match[4].trim();
    const depsCell = match[5];
    const tracesCell = match[6];

    tasks.push({
      id,
      title: cleanTitle(rawTitle),
      parallel: /\[P\]/i.test(parallelCell) || /\[P\]/i.test(rawTitle),
      effort: effortCell && effortCell !== "—" ? effortCell : undefined,
      dependencies: parseDependencies(depsCell),
      traces_to: parseTraces(tracesCell, rawTitle),
      claimed_done: false,
      subtasks: [],
    });
  }
  return tasks;
}

function parseCheckboxTasks(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split("\n");
  const linePattern = new RegExp(TASK_LINE_PATTERN.source, "i");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = linePattern.exec(line);
    if (!match) continue;

    let id: string;
    try {
      id = normalizeTaskId(match[1]);
    } catch {
      continue;
    }

    const rawTitle = (match[3] ?? "").trim();
    const parallel = /\[P\]/i.test(line);
    const claimed_done = /^-\s+\[x\]/i.test(line.trim());

    const dependencySection = /depends?:\s*([^;.)]+)/i.exec(rawTitle)?.[1] ?? "";
    const dependencies = [...dependencySection.matchAll(TASK_ID_PATTERN)].map((dep) =>
      normalizeTaskId(dep[0]),
    );

    const subtasks: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const sub = SUBTASK_LINE.exec(lines[j]);
      if (!sub) break;
      subtasks.push(sub[1].trim());
      i = j;
    }

    tasks.push({
      id,
      title: cleanTitle(rawTitle),
      parallel,
      dependencies,
      traces_to: extractRequirementIds(rawTitle),
      claimed_done,
      subtasks,
    });
  }

  return tasks;
}

/**
 * Parse TASKS.md content supporting both canonical table rows and checkbox bullets.
 * When both formats mention the same ID, checkbox wins for claimed_done / subtasks;
 * table wins for effort / structured dependencies when checkbox deps are empty.
 */
export function parseTasksFromMarkdown(content: string): ParsedTask[] {
  const byId = new Map<string, ParsedTask>();

  for (const task of parseTableRows(content)) {
    byId.set(task.id, task);
  }

  for (const task of parseCheckboxTasks(content)) {
    const existing = byId.get(task.id);
    if (!existing) {
      byId.set(task.id, task);
      continue;
    }
    byId.set(task.id, {
      ...existing,
      title: task.title || existing.title,
      parallel: task.parallel || existing.parallel,
      claimed_done: task.claimed_done,
      subtasks: task.subtasks.length > 0 ? task.subtasks : existing.subtasks,
      dependencies:
        task.dependencies.length > 0 ? task.dependencies : existing.dependencies,
      traces_to:
        task.traces_to.length > 0
          ? [...new Set([...existing.traces_to, ...task.traces_to])].sort((a, b) =>
              a.localeCompare(b),
            )
          : existing.traces_to,
    });
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
