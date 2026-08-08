import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTasksFromMarkdown } from "../../src/utils/task-parser.js";

const TODO_API_TASKS = readFileSync(
  resolve(import.meta.dirname, "../../examples/todo-api/001-todo-api/TASKS.md"),
  "utf8",
);

describe("parseTasksFromMarkdown", () => {
  it("parses canonical table rows from the todo-api example", () => {
    const tasks = parseTasksFromMarkdown(TODO_API_TASKS);
    expect(tasks).toHaveLength(6);
    expect(tasks[0]).toMatchObject({
      id: "T-001",
      title: "Scaffold Express + TypeScript and /health",
      parallel: false,
      effort: "S",
      dependencies: [],
      traces_to: ["REQ-TODO-001"],
      claimed_done: false,
    });
    expect(tasks[1]).toMatchObject({
      id: "T-002",
      parallel: true,
      dependencies: ["T-001"],
      traces_to: ["REQ-TODO-004"],
    });
    expect(tasks[3]).toMatchObject({
      id: "T-004",
      dependencies: ["T-002", "T-003"],
      traces_to: ["REQ-TODO-001", "REQ-TODO-003"],
    });
  });

  it("parses checkbox lines including claimed_done and subtasks", () => {
    const content = [
      "- [x] T-001: Implement parser REQ-CORE-001",
      "  - Unit tests",
      "  - Edge cases",
      "- [ ] T002 [P] Legacy task depends: T-001",
    ].join("\n");

    const tasks = parseTasksFromMarkdown(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      id: "T-001",
      claimed_done: true,
      traces_to: ["REQ-CORE-001"],
      subtasks: ["Unit tests", "Edge cases"],
    });
    expect(tasks[1]).toMatchObject({
      id: "T-002",
      parallel: true,
      claimed_done: false,
      dependencies: ["T-001"],
    });
  });

  it("merges table + checkbox by id (checkbox sets claimed_done)", () => {
    const content = [
      "| ID | Task | [P] | Effort | Depends On | Traces To |",
      "|----|------|-----|--------|------------|-----------|",
      "| T-001 | Build API |  | M | — | REQ-API-001 |",
      "",
      "- [x] T-001: Build API",
    ].join("\n");

    const tasks = parseTasksFromMarkdown(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "T-001",
      claimed_done: true,
      effort: "M",
      traces_to: ["REQ-API-001"],
    });
  });

  it("skips header, separator, and non-task pipe rows", () => {
    const content = [
      "| ID | Task | [P] | Effort | Depends On | Traces To |",
      "|----|------|-----|--------|------------|-----------|",
      "| T-001 | Real task |  | S | — | REQ-A-001 |",
      "| **Total** | **1** | **0** | **1 tasks** | | |",
    ].join("\n");

    const tasks = parseTasksFromMarkdown(content);
    expect(tasks.map((t) => t.id)).toEqual(["T-001"]);
  });

  it("normalizes legacy T001 table ids to T-001", () => {
    const content = "| T001 | Do the thing | [P] | S | — | REQ-A-001 |";
    const tasks = parseTasksFromMarkdown(content);
    expect(tasks[0].id).toBe("T-001");
    expect(tasks[0].parallel).toBe(true);
  });

  it("parses feature-scoped table IDs and mixed dependency formats", () => {
    const content = [
      "| ID | Task | REQ | Complexity | Depends on | Status |",
      "|---|---|---|---|---|---|",
      "| T-023-001 | Build registered-route matrix | REQ-ROLE-016, 006–010 | L | — | **Done** — route matrix passes |",
      "| T-023-010 [P] | Enforce company scope | REQ-ROLE-008 | M | T-023-001, T-002 | Pending |",
    ].join("\n");

    const tasks = parseTasksFromMarkdown(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      id: "T-023-001",
      effort: "L",
      claimed_done: true,
      dependencies: [],
      traces_to: [
        "REQ-ROLE-006",
        "REQ-ROLE-007",
        "REQ-ROLE-008",
        "REQ-ROLE-009",
        "REQ-ROLE-010",
        "REQ-ROLE-016",
      ],
    });
    expect(tasks[1]).toMatchObject({
      id: "T-023-010",
      parallel: true,
      claimed_done: false,
      dependencies: ["T-023-001", "T-002"],
      traces_to: ["REQ-ROLE-008"],
    });
  });

  it("merges feature-scoped table and checkbox entries by complete ID", () => {
    const content = [
      "| ID | Task | REQ | Complexity | Depends on | Status |",
      "|---|---|---|---|---|---|",
      "| T-023-015 | Prove mandate policies | REQ-ROLE-015 | M | T-023-013 | Pending |",
      "",
      "- [x] T-023-015: Prove mandate policies REQ-ROLE-015",
      "  - Run PostgreSQL matrix",
    ].join("\n");

    expect(parseTasksFromMarkdown(content)).toEqual([
      expect.objectContaining({
        id: "T-023-015",
        claimed_done: true,
        dependencies: ["T-023-013"],
        subtasks: ["Run PostgreSQL matrix"],
      }),
    ]);
  });
});
