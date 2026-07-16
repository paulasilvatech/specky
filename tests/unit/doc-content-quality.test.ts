import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DocumentationConfig } from "../../src/contracts/use-case.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { DocGenerator } from "../../src/services/doc-generator.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import type { DocumentationResult } from "../../src/types.js";

const FEATURE_DIR = ".specs/001-todo-api";

const DOCUMENTATION: DocumentationConfig = {
    types: ["full", "api", "runbook", "onboarding", "journey"],
    version: "2.4.0",
    api_base_url: "https://api.example.test/todos",
    deployment_steps: [
        "Build the signed container image with the release workflow.",
        "Deploy the reviewed image digest to the production environment.",
    ],
    health_checks: ["GET /health must return 200 with database status healthy."],
    monitoring_checks: ["Alert when POST /todos error rate exceeds the reviewed threshold."],
    troubleshooting: [
        {
            symptom: "POST /todos returns 503",
            cause: "PostgreSQL connectivity is unavailable",
            resolution: "Restore the database route and verify the health endpoint",
        },
    ],
    rollback_steps: ["Redeploy the previous reviewed image digest."],
    support_contacts: ["Todo API on-call: todo-api@example.test"],
    onboarding_steps: [
        "Install dependencies with the repository-locked package manager.",
        "Run the requirement-bound test suite before editing handlers.",
    ],
};

const SPEC = `---
title: "todo-api — Specification"
feature_id: "001-todo-api"
---
# todo-api — Specification

## 1. Core Requirements

### REQ-TODO-001: Create todo

When a user submits a todo, the system shall persist it and return the created record.

**Acceptance Criteria:**
- POST /todos returns 201 with the created todo
- The todo is retrievable by its id

---

### REQ-TODO-002: List todos

The system shall list stored todos ordered by creation time.

**Acceptance Criteria:**
- GET /todos returns 200 with an array
`;

const DESIGN = `---
title: "todo-api — Design"
feature_id: "001-todo-api"
---
# todo-api — Design

## 1. System Context (C4 Level 1)

A web client calls the Todo API over HTTPS.

## 2. Container Architecture (C4 Level 2)

An API container owns request handling and PostgreSQL owns durable todo state.

## 3. Component Design (C4 Level 3)

TodoController validates input and TodoRepository persists records.

## 4. Code-Level Design (C4 Level 4)

TodoService exposes create and list operations through typed interfaces.

## 5. System Diagrams

\`\`\`mermaid
sequenceDiagram
  Client->>API: POST /todos
  API->>DB: INSERT todo
\`\`\`

## 6. Data Model

Todo has id, title, completed, and created_at fields.

## 7. API Contracts

### POST /todos

Create a new todo item.

**Request:**
\`\`\`json
{ "title": "string" }
\`\`\`

**Response:**
\`\`\`json
{ "id": 1, "title": "string", "completed": false }
\`\`\`

### GET /todos

List all todo items.

**Request:**
\`\`\`json
{ "cursor": null }
\`\`\`

**Response:**
\`\`\`json
[{ "id": 1, "title": "string", "completed": false }]
\`\`\`

## 8. Infrastructure & Deployment

The reviewed container image runs behind HTTPS and connects to managed PostgreSQL.

## 9. Security Architecture

OAuth scopes authorize create and list operations.

## 10. Architecture Decision Records

### ADR-001: Use PostgreSQL for persistence

PostgreSQL provides transactional todo storage.

## 11. Error Handling Strategy

Database timeouts map to a stable 503 problem response.

## 12. Cross-Cutting Concerns

Traces correlate requests with database operations and alerts.

## 13. Workload-Specific Design Contract

API versioning, error codes, authentication, and limits are explicit.
`;

const TASKS = `# todo-api — Tasks

## Task Breakdown

| ID | Task | Parallel | Effort | Depends On | Traces To |
|---|---|---|---|---|---|
| T-001 | Create todos table | No | M | — | REQ-TODO-001 |
| T-002 | Implement POST /todos | No | M | T-001 | REQ-TODO-001 |
| T-003 | Implement GET /todos | Yes | S | T-001 | REQ-TODO-002 |
`;

const ANALYSIS = `# Analysis

Decision: APPROVE

All requirements are traced to design and tasks.
`;

describe("strict documentation generation", () => {
    let workspace: string;
    let fileManager: FileManager;
    let stateMachine: StateMachine;
    let docGenerator: DocGenerator;

    beforeEach(async () => {
        workspace = mkdtempSync(join(tmpdir(), "specky-doc-quality-"));
        mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
        writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), SPEC);
        writeFileSync(join(workspace, FEATURE_DIR, "DESIGN.md"), DESIGN);
        writeFileSync(join(workspace, FEATURE_DIR, "TASKS.md"), TASKS);
        writeFileSync(join(workspace, FEATURE_DIR, "ANALYSIS.md"), ANALYSIS);

        fileManager = new FileManager(workspace);
        stateMachine = new StateMachine(fileManager, workspace);
        const state = stateMachine.createFeatureState({
            projectName: "todo-api",
            feature: { number: "001", name: "todo-api", directory: FEATURE_DIR },
            contract: resolveUseCaseContract({
                lifecycle: "greenfield",
                workload: "api",
                execution_mode: "full",
                capabilities: ["release"],
                capability_config: {
                    release: {
                        branch_prefix: "spec/",
                        base_branch: "develop",
                        draft_pr: false,
                        checkpoints: true,
                        documentation: DOCUMENTATION,
                    },
                },
            }),
        });
        state.gate_decision = {
            decision: "APPROVE",
            reasons: ["All traceability evidence is present"],
            coverage_percent: 100,
            gaps: [],
            decided_at: "2026-07-15T00:00:00.000Z",
        };
        await stateMachine.saveState(FEATURE_DIR, state);
        docGenerator = new DocGenerator(fileManager, stateMachine);
    });

    afterEach(async () => {
        await rm(workspace, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    });

    it("assembles full docs from required requirement, design, task, and analysis evidence", async () => {
        const doc = await docGenerator.generateFullDocs(FEATURE_DIR, "001", DOCUMENTATION);
        expect(doc.content).toContain("REQ-TODO-001");
        expect(doc.content).toContain("the system shall persist it");
        expect(doc.content).toContain("TodoController validates input");
        expect(doc.content).toContain("T-003");
        expect(doc.content).toContain("Decision: APPROVE");
        expect(doc.content).not.toContain("feature_id:");
    });

    it("uses explicit API base URL and complete request/response contracts", async () => {
        const doc = await docGenerator.generateApiDocs(FEATURE_DIR, "001", DOCUMENTATION);
        expect(doc.content).toContain("https://api.example.test/todos");
        expect(doc.content).toContain('{ "title": "string" }');
        expect(doc.content).toContain('[{ "id": 1, "title": "string", "completed": false }]');
        expect(doc.sections).toEqual(["POST /todos", "GET /todos"]);
        expect(doc.content).not.toContain("/api/v1");
        expect(doc.content).not.toContain("/internal-webhook");
    });

    it("uses persisted operational and onboarding procedures without generic commands", async () => {
        const runbook = await docGenerator.generateRunbook(FEATURE_DIR, "001", DOCUMENTATION);
        expect(runbook.content).toContain("Build the signed container image");
        expect(runbook.content).toContain("Todo API on-call");
        expect(runbook.content).toContain("PostgreSQL connectivity is unavailable");
        expect(runbook.content).not.toContain("npm run build");
        expect(runbook.content).not.toContain("GET /health\`");

        const onboarding = await docGenerator.generateOnboarding(FEATURE_DIR, "001", DOCUMENTATION);
        expect(onboarding.content).toContain("repository-locked package manager");
        expect(onboarding.content).toContain("REQ-TODO-002");
        expect(onboarding.content).not.toContain("npm install");
    });

    it("builds journey docs from signed feature state and the persisted phase graph", async () => {
        const doc = await docGenerator.generateJourneyDocs(FEATURE_DIR, "001", DOCUMENTATION);
        expect(doc.content).toContain("greenfield-api-full@1.0.0");
        expect(doc.content).toContain("All traceability evidence is present");
        expect(doc.content).toContain("Use PostgreSQL for persistence");
        expect(doc.content).toContain("Requirements: 2");
        expect(doc.content).toContain("Tasks: 3");
    });

    it("generates exactly the documentation types enabled by the release contract", async () => {
        const selected: DocumentationConfig = { ...DOCUMENTATION, types: ["full", "runbook"] };
        const all = await docGenerator.generateAllDocs(FEATURE_DIR, "001", selected);
        expect(all.total_generated).toBe(2);
        expect(all.results.map((result) => result.type)).toEqual(["full", "runbook"]);
        expect(all.failures).toEqual([]);
    });

    it("fails closed when evidence is absent and rejects partial all-doc batches", async () => {
        const missingDir = ".specs/002-missing";
        mkdirSync(join(workspace, missingDir), { recursive: true });
        await expect(docGenerator.generateRunbook(missingDir, "002", DOCUMENTATION)).rejects.toThrow(
            /DESIGN.md is required/,
        );

        class FailingJourneyGenerator extends DocGenerator {
            override generateJourneyDocs(): Promise<DocumentationResult> {
                return Promise.reject(new Error("state exploded"));
            }
        }
        const failing = new FailingJourneyGenerator(fileManager, stateMachine);
        await expect(failing.generateAllDocs(FEATURE_DIR, "001", DOCUMENTATION)).rejects.toThrow(
            /state exploded/,
        );
    });
});
