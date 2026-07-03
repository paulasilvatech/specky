/**
 * doc-content-quality.test.ts — guards the content depth of generated docs
 * (promise-delivery audit, documentation category). The original defects:
 *   - summarize() took the first 15 non-empty lines = frontmatter + ToC, so
 *     full docs and onboarding contained ZERO requirement text (grep "shall" = 0)
 *   - the runbook read DESIGN.md and discarded it (100% static boilerplate)
 *   - API docs rendered every request/response as "{}" although DESIGN.md held
 *     the JSON contract bodies, and duplicated endpoints from mermaid diagrams
 *   - the journey doc ran OUTSIDE the advertised Promise.all and errors were
 *     silently swallowed
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocGenerator } from "../../src/services/doc-generator.js";
import { FileManager } from "../../src/services/file-manager.js";
import type { DocumentationResult } from "../../src/types.js";

const FEATURE_DIR = "001-todo-api";

/** SPECIFICATION.md exactly as the pipeline renders it: frontmatter + ToC + EARS blocks. */
const SPEC = [
  `---`,
  `title: "todo-api — Specification"`,
  `feature_id: "001-todo-api"`,
  `version: "1.0.0"`,
  `date: "2026-07-03"`,
  `author: "SDD Pipeline"`,
  `status: "Draft"`,
  `---`,
  `<!-- markdownlint-disable -->`,
  `# todo-api — Specification`,
  ``,
  `> All requirements use **EARS notation** (Easy Approach to Requirements Syntax).`,
  ``,
  `---`,
  ``,
  `## Table of Contents`,
  ``,
  `- [1. Core Requirements](#1-core-requirements)`,
  `- [2. Functional Requirements](#2-functional-requirements)`,
  `- [3. Non-Functional Requirements](#3-non-functional-requirements)`,
  `- [Acceptance Criteria Summary](#acceptance-criteria-summary)`,
  ``,
  `---`,
  ``,
  `## 1. Core Requirements`,
  ``,
  `### REQ-TODO-001: (event-driven)`,
  ``,
  `WHEN a user submits a new todo item, the system shall persist it and return the created record with a unique id.`,
  ``,
  `**Acceptance Criteria:**`,
  `- POST /todos returns 201 with the created todo`,
  `- The todo is retrievable afterwards`,
  ``,
  `---`,
  ``,
  `### REQ-TODO-002: (ubiquitous)`,
  ``,
  `The system shall list all stored todo items ordered by creation time.`,
  ``,
  `**Acceptance Criteria:**`,
  `- GET /todos returns 200 with an array`,
  ``,
  `---`,
  ``,
  `## 2. Functional Requirements`,
  ``,
  ``,
  `---`,
  ``,
  `## Acceptance Criteria Summary`,
  ``,
  `| ID | Requirement | Test Method |`,
  `|----|-------------|-------------|`,
  `| REQ-TODO-001 | WHEN a user submits a new todo item, the system shall persist... | Acceptance test |`,
].join("\n");

/** DESIGN.md as rendered by sdd_write_design: mermaid diagram + API contracts + ADRs. */
const DESIGN = [
  `---`,
  `title: "todo-api — Design"`,
  `feature_id: "001-todo-api"`,
  `version: "1.0.0"`,
  `date: "2026-07-03"`,
  `author: "SDD Pipeline"`,
  `status: "Draft"`,
  `---`,
  `<!-- markdownlint-disable -->`,
  `# todo-api — Design`,
  ``,
  `> Complete system design covering architecture, data, APIs, security, infrastructure, and decisions.`,
  ``,
  `---`,
  ``,
  `## 1. System Context (C4 Level 1)`,
  ``,
  `> Who uses the system and what external systems does it integrate with?`,
  ``,
  `A single user consumes the HTTP API from a CLI or web client.`,
  ``,
  `---`,
  ``,
  `## 2. Container Architecture (C4 Level 2)`,
  ``,
  `> What are the deployable units?`,
  ``,
  `An Express API server packaged with Docker persists todos in a PostgreSQL database.`,
  ``,
  `---`,
  ``,
  `## 5. System Diagrams`,
  ``,
  `### Create flow`,
  ``,
  "```mermaid",
  `sequenceDiagram`,
  `  Client->>API: POST /todos`,
  `  API->>DB: INSERT todo`,
  `  API->>Hooks: POST /internal-webhook`,
  "```",
  ``,
  `---`,
  ``,
  `## 7. API Contracts`,
  ``,
  `> Endpoints, request/response schemas, authentication, and error codes.`,
  ``,
  `### POST /todos`,
  ``,
  `Create a new todo item`,
  ``,
  `**Request:** { "title": "string", "due_date": "ISO-8601" }`,
  ``,
  `**Response:** { "id": 1, "title": "string", "completed": false }`,
  ``,
  `---`,
  ``,
  `### GET /todos`,
  ``,
  `List all todos`,
  ``,
  `**Request:** N/A`,
  ``,
  `**Response:** [ { "id": 1, "title": "string", "completed": false } ]`,
  ``,
  `---`,
  ``,
  `## 8. Infrastructure & Deployment`,
  ``,
  `> How the system is deployed.`,
  ``,
  `Deployed as a single Docker container behind Nginx.`,
  ``,
  `---`,
  ``,
  `## 10. Architecture Decision Records`,
  ``,
  `### ADR-001: Use PostgreSQL for persistence`,
  ``,
  `**Decision:** Store todos in PostgreSQL.`,
  ``,
  `**Rationale:** Relational integrity.`,
  ``,
  `**Consequences:** Requires a managed database.`,
].join("\n");

const TASKS = [
  `---`,
  `title: "todo-api — Tasks"`,
  `feature_id: "001-todo-api"`,
  `---`,
  `<!-- markdownlint-disable -->`,
  `# todo-api — Tasks`,
  ``,
  `## Task Breakdown`,
  ``,
  `| ID | Task | [P] | Effort | Depends On | Traces To |`,
  `|----|------|-----|--------|------------|-----------|`,
  `| T-001 | Create todos table | | 2h | | REQ-TODO-001 |`,
  `| T-002 | Implement POST /todos handler | | 3h | T-001 | REQ-TODO-001 |`,
].join("\n");

describe("generated docs carry real feature content (not frontmatter/ToC/boilerplate)", () => {
  let workspace: string;
  let fileManager: FileManager;
  let docGenerator: DocGenerator;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-doc-quality-"));
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), SPEC, "utf8");
    writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), DESIGN, "utf8");
    writeFileSync(join(workspace, FEATURE_DIR, "TASKS.md"), TASKS, "utf8");
    fileManager = new FileManager(workspace);
    docGenerator = new DocGenerator(fileManager);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  describe("full docs (sdd_generate_docs)", () => {
    it("contains the actual EARS requirement text with REQ ids", async () => {
      const doc = await docGenerator.generateFullDocs(FEATURE_DIR, "001");
      // The original summarize() emitted only frontmatter + ToC: grep "shall" = 0.
      expect(doc.content).toMatch(/shall/);
      expect(doc.content).toContain("REQ-TODO-001");
      expect(doc.content).toContain("REQ-TODO-002");
      expect(doc.content).toContain("the system shall persist it and return the created record");
    });

    it("does not leak frontmatter or ToC anchors into the Specification section", async () => {
      const doc = await docGenerator.generateFullDocs(FEATURE_DIR, "001");
      expect(doc.content).not.toContain(`feature_id: "001-todo-api"`);
      expect(doc.content).not.toContain("(#1-core-requirements)");
    });

    it("pulls architecture sections from DESIGN.md and task rows from TASKS.md", async () => {
      const doc = await docGenerator.generateFullDocs(FEATURE_DIR, "001");
      expect(doc.content).toContain("A single user consumes the HTTP API");
      expect(doc.content).toContain("Express API server");
      expect(doc.content).toContain("T-001");
      expect(doc.content).toContain("Create todos table");
    });
  });

  describe("onboarding (sdd_generate_onboarding)", () => {
    it("explains what the feature does using real requirement text", async () => {
      const doc = await docGenerator.generateOnboarding(FEATURE_DIR, "001");
      const whatItDoes = doc.content.split("## Architecture Overview")[0];
      // Originally this section was the truncated ToC — no "shall", no REQ id.
      expect(whatItDoes).toMatch(/shall/);
      expect(whatItDoes).toContain("REQ-TODO-001");
      expect(whatItDoes).not.toContain("(#1-core-requirements)");
      expect(whatItDoes).not.toContain(`title: "todo-api — Specification"`);
    });

    it("architecture overview carries real design text", async () => {
      const doc = await docGenerator.generateOnboarding(FEATURE_DIR, "001");
      expect(doc.content).toContain("Express API server");
    });
  });

  describe("API docs (sdd_generate_api_docs)", () => {
    it("fills request/response examples from the DESIGN.md contract bodies", async () => {
      const doc = await docGenerator.generateApiDocs(FEATURE_DIR, "001");
      // Originally every example was an empty "{}" placeholder.
      expect(doc.content).toContain(`{ "title": "string", "due_date": "ISO-8601" }`);
      expect(doc.content).toContain(`{ "id": 1, "title": "string", "completed": false }`);
      expect(doc.content).toContain("Create a new todo item");
    });

    it("does not duplicate endpoints matched inside mermaid diagrams", async () => {
      const doc = await docGenerator.generateApiDocs(FEATURE_DIR, "001");
      const postTodos = doc.content.match(/^## POST \/todos$/gm) || [];
      expect(postTodos).toHaveLength(1);
      // Mermaid-only edges must not become endpoints.
      expect(doc.content).not.toContain("/internal-webhook");
      expect(doc.sections).toEqual(["POST /todos", "GET /todos"]);
    });

    it("keeps the {} fallback only where the design has no body (GET request)", async () => {
      const doc = await docGenerator.generateApiDocs(FEATURE_DIR, "001");
      const getSection = doc.content.split("## GET /todos")[1];
      expect(getSection).toContain("{}");
      expect(getSection).toContain(`[ { "id": 1, "title": "string", "completed": false } ]`);
    });
  });

  describe("runbook (sdd_generate_runbook)", () => {
    it("derives tech stack, endpoints, and infrastructure from DESIGN.md", async () => {
      const doc = await docGenerator.generateRunbook(FEATURE_DIR, "001");
      // Originally the runbook read DESIGN.md and discarded it entirely.
      expect(doc.content).toContain("PostgreSQL");
      expect(doc.content).toContain("Docker");
      expect(doc.content).toContain("POST /todos");
      expect(doc.content).toContain("Deployed as a single Docker container behind Nginx.");
    });

    it("differs between two features with different designs", async () => {
      const otherDir = "002-search";
      mkdirSync(join(workspace, otherDir), { recursive: true });
      writeFileSync(
        join(workspace, otherDir, "DESIGN.md"),
        "# search — Design\n\n## 7. API Contracts\n\n### GET /search\n\nFull-text search\n\n**Response:** { \"hits\": [] }\n\nBacked by Elasticsearch on Kubernetes.\n",
        "utf8",
      );
      const first = await docGenerator.generateRunbook(FEATURE_DIR, "001");
      const second = await docGenerator.generateRunbook(otherDir, "002");
      expect(second.content).toContain("Elasticsearch");
      expect(second.content).toContain("GET /search");
      expect(second.content).toContain("kubectl rollout undo");
      expect(second.content).not.toContain("PostgreSQL");
      // Beyond name/number/timestamp, the bodies must actually differ.
      expect(first.content.replace(/todo-api|001/g, "")).not.toBe(second.content.replace(/search|002/g, ""));
    });

    it("falls back to the generic template when DESIGN.md has nothing to derive", async () => {
      const bareDir = "003-bare";
      mkdirSync(join(workspace, bareDir), { recursive: true });
      const doc = await docGenerator.generateRunbook(bareDir, "003");
      expect(doc.content).toContain("## Deployment");
      expect(doc.content).toContain("## Monitoring");
      expect(doc.content).toContain("## Troubleshooting");
      expect(doc.content).toContain("## Rollback");
      expect(doc.content).toContain("Follow CI/CD pipeline");
      expect(doc.explanation).toContain("generic template");
    });
  });

  describe("generateAllDocs (sdd_generate_all_docs)", () => {
    it("produces all 5 advertised types in one batch, journey included", async () => {
      const all = await docGenerator.generateAllDocs(FEATURE_DIR, "001");
      expect(all.total_generated).toBe(5);
      expect(all.failures).toEqual([]);
      expect(all.results.map((r) => r.type).sort()).toEqual(
        ["api", "full", "journey", "onboarding", "runbook"],
      );
    });

    it("every generated doc contains feature-derived text, not only boilerplate", async () => {
      const all = await docGenerator.generateAllDocs(FEATURE_DIR, "001");
      const byType = new Map(all.results.map((r) => [r.type, r.content]));
      expect(byType.get("full")).toMatch(/shall/);
      expect(byType.get("full")).toContain("REQ-TODO-001");
      expect(byType.get("onboarding")).toMatch(/shall/);
      expect(byType.get("api")).toContain(`{ "title": "string", "due_date": "ISO-8601" }`);
      expect(byType.get("runbook")).toContain("PostgreSQL");
      // Journey derives ADR titles and traceability counts from the artifacts.
      expect(byType.get("journey")).toContain("Use PostgreSQL for persistence");
      expect(byType.get("journey")).toContain("**Requirements**: 2");
      expect(byType.get("journey")).toContain("**Tasks**: 2");
    });

    it("surfaces a journey failure instead of silently dropping it", async () => {
      class FailingJourneyGenerator extends DocGenerator {
        override generateJourneyDocs(): Promise<DocumentationResult> {
          return Promise.reject(new Error("state exploded"));
        }
      }
      const failing = new FailingJourneyGenerator(fileManager);
      const all = await failing.generateAllDocs(FEATURE_DIR, "001");
      expect(all.total_generated).toBe(4);
      expect(all.failures).toEqual([{ type: "journey", error: "state exploded" }]);
      expect(all.results.map((r) => r.type).sort()).toEqual(["api", "full", "onboarding", "runbook"]);
    });
  });
});
