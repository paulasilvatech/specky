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
  TASK_ID_SOURCE,
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

const TASK_ID_CELL = new RegExp(String.raw`^(${TASK_ID_SOURCE})(?:\s+\[P\])?$`, "i");

const SUBTASK_LINE = /^\s{2,}-\s+(?:\[[ x]\]\s+)?(.+)/;

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
  const fromCell = expandRequirementIds(cell);
  const fromTitle = extractRequirementIds(title);
  return [...new Set([...fromCell, ...fromTitle])].sort((a, b) => a.localeCompare(b));
}

function expandRequirementIds(cell: string): string[] {
  const ids: string[] = [];
  let prefix: string | null = null;
  for (const part of cell.split(/[,;]/)) {
    const full = extractRequirementIds(part);
    if (full.length > 0) {
      ids.push(...full);
      prefix = full.at(-1)?.replace(/\d{3}$/, "") ?? prefix;
      continue;
    }
    if (!prefix) continue;
    const shorthand = /^\s*(\d{3})(?:\s*[-–]\s*(\d{3}))?\s*$/.exec(part);
    if (!shorthand) continue;
    const start = Number(shorthand[1]);
    const end = Number(shorthand[2] ?? shorthand[1]);
    if (end < start || end - start > 99) continue;
    for (let sequence = start; sequence <= end; sequence++) {
      ids.push(`${prefix}${String(sequence).padStart(3, "0")}`);
    }
  }
  return ids;
}

function cleanTitle(raw: string): string {
  const requirementIndex = raw.search(/\bREQ-[A-Z]+-\d{3}\b/);
  if (requirementIndex < 0) return raw.trim();
  const prefix = raw.slice(0, requirementIndex);
  const withoutLabel = prefix.replace(/traces?(?:_to)?\s*:\s*$/i, "");
  let end = withoutLabel.length;
  while (end > 0 && " ([\t\n\r".includes(withoutLabel[end - 1])) end--;
  return withoutLabel.slice(0, end).trim() || raw.trim();
}

interface TaskTableColumns {
  id: number;
  title: number;
  parallel?: number;
  effort?: number;
  dependencies?: number;
  traces?: number;
  status?: number;
}

function tableCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function normalizedHeader(cell: string): string {
  return cell
    .replace(/[*_`[\]]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findHeader(headers: string[], names: string[]): number | undefined {
  const index = headers.findIndex((header) => names.includes(header));
  return index >= 0 ? index : undefined;
}

function taskTableColumns(cells: string[]): TaskTableColumns | null {
  const headers = cells.map(normalizedHeader);
  const id = findHeader(headers, ["id"]);
  const title = findHeader(headers, ["task", "title", "description"]);
  if (id === undefined || title === undefined) return null;
  return {
    id,
    title,
    parallel: findHeader(headers, ["[p]", "p", "parallel"]),
    effort: findHeader(headers, ["effort", "complexity"]),
    dependencies: findHeader(headers, ["depends", "depends on", "dependencies"]),
    traces: findHeader(headers, ["req", "requirements", "traces", "traces to"]),
    status: findHeader(headers, ["status"]),
  };
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function cellAt(cells: string[], index: number | undefined): string {
  return index === undefined ? "" : (cells[index] ?? "");
}

function isDoneStatus(status: string): boolean {
  return /^(done|complete|completed)\b/i.test(status.replaceAll("*", "").trim());
}

function parseTaskRow(cells: string[], columns: TaskTableColumns): ParsedTask | null {
  const idCell = cellAt(cells, columns.id);
  const idMatch = TASK_ID_CELL.exec(idCell);
  if (!idMatch) return null;
  const rawTitle = cellAt(cells, columns.title);
  if (!rawTitle) return null;
  const parallelCell = cellAt(cells, columns.parallel);
  const effortCell = cellAt(cells, columns.effort);
  const dependenciesCell = cellAt(cells, columns.dependencies);
  const tracesCell = cellAt(cells, columns.traces);
  return {
    id: normalizeTaskId(idMatch[1]),
    title: cleanTitle(rawTitle),
    parallel: /\[P\]/i.test(idCell) || /^(\[P\]|yes|true)$/i.test(parallelCell),
    effort: effortCell && effortCell !== "—" ? effortCell : undefined,
    dependencies: parseDependencies(dependenciesCell),
    traces_to: parseTraces(tracesCell, rawTitle),
    claimed_done: isDoneStatus(cellAt(cells, columns.status)),
    subtasks: [],
  };
}

function parseTableRows(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  let columns: TaskTableColumns | null = null;
  for (const line of content.split("\n")) {
    const cells = tableCells(line);
    if (cells.length === 0 || isSeparatorRow(cells)) continue;
    const nextColumns = taskTableColumns(cells);
    if (nextColumns) {
      columns = nextColumns;
      continue;
    }
    if (cells[0]?.startsWith("**")) continue;
    const fallback: TaskTableColumns = {
      id: 0,
      title: 1,
      parallel: 2,
      effort: 3,
      dependencies: 4,
      traces: 5,
    };
    const task = parseTaskRow(cells, columns ?? fallback);
    if (task) tasks.push(task);
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
      dependencies: task.dependencies.length > 0 ? task.dependencies : existing.dependencies,
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
