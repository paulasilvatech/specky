/**
 * diagram-quality.test.ts — behavior tests for the audit findings on diagram
 * generation: invalid Mermaid identifiers (er/dfd), constant stubs
 * (class/state/c4_code), fabricated pie numbers, header-only gantt, garbled
 * sequence extraction, sdd_generate_all_diagrams writing nothing to disk, and
 * Table-of-Contents headings leaking into deployment/network/figma payloads
 * with uniform "connects to" edges.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { FileManager } from "../../src/services/file-manager.js";
import { buildFigmaStructure } from "../../src/tools/visualization.js";
import type { DiagramType } from "../../src/constants.js";

// A spec whose headings contain exactly the characters that broke er/dfd in
// the audit: ':' and '(EVENT_DRIVEN)' in requirement headings, plus a ToC.
const SPEC_MD = `---
title: Order Tracking
---

# Specification — Order Tracking

## Table of Contents

- [1. Overview](#1-overview)
- [2. Functional Requirements](#2-functional-requirements)

## 1. Overview

Order tracking for the storefront.

## 2. Functional Requirements

### REQ-ORD-001: Order creation (EVENT_DRIVEN)

When a customer submits the checkout form, the system shall create an order record within 2 seconds.

- Order row exists after POST /orders
- Response 201 with order id

### REQ-ORD-002: Status notification (EVENT_DRIVEN)

When an order status changes, the system shall send an email notification within 5 minutes.

- Email queued on status change

### REQ-PAY-003: Payment persistence (UBIQUITOUS)

The system shall persist payment records in PostgreSQL.

- Payment row written
`;

const DESIGN_A = `# Design — Order Tracking

## Table of Contents

- [Order Service](#order-service)

## Order Service

- Validate incoming orders
- Persist order rows

## Notification Worker

- Send order emails

## Orders Database

- Stores order rows
`;

const DESIGN_B = `# Design — Billing

## Payment Gateway

- Authorize card payments

## Ledger Store

- Record transactions
`;

const FIGMA_DESIGN = `# Design — Order Tracking

## Table of Contents

- [Order Service](#order-service)
- [Notification Worker](#notification-worker)

## 1. Overview

High-level description.

## 2. Revision History

| Date | Author |

## Order Service

Handles order CRUD.

## Notification Worker

Sends notifications.

## Orders Database

Stores orders.

## External Payment Provider

Third-party payments.
`;

const ID_PATTERN = /^[A-Za-z0-9_]+$/;

/** Collect every identifier used in node/arrow positions of a flowchart. */
function collectFlowchartIds(code: string): string[] {
  const ids: string[] = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("flowchart") || line.startsWith("subgraph") || line === "end") continue;
    const arrow = line.match(/^(\S+)\s*-->(?:\|[^|]*\|)?\s*(\S.*)$/);
    if (arrow) {
      ids.push(arrow[1]);
      ids.push(arrow[2].split(/[\[(]/)[0].trim());
      continue;
    }
    const nodeDef = line.match(/^([^\s[({]+)[[({]/);
    if (nodeDef) ids.push(nodeDef[1]);
  }
  return ids;
}

describe("DiagramGenerator — identifier validity (er INVALID, dfd INVALID)", () => {
  const gen = new DiagramGenerator(undefined as unknown as FileManager);

  it("er: every line is structurally valid Mermaid with clean entity/attribute ids", () => {
    const code = gen.generateDiagram(SPEC_MD, "er", "Data Model").mermaid_code;
    const allowed = [
      /^erDiagram$/,
      /^ {2}[A-Za-z0-9_]+ \{$/,
      /^ {4}string [A-Za-z0-9_]+( PK)?$/,
      /^ {2}\}$/,
      /^ {2}[A-Za-z0-9_]+ \|\|--o\{ [A-Za-z0-9_]+ : "has"$/,
    ];
    for (const line of code.split("\n")) {
      expect(allowed.some((re) => re.test(line)), `er line not structurally valid: "${line}"`).toBe(true);
    }
    // The exact audit failure: ':' and '(' in entity-name position
    const entityNames = code.split("\n").filter((l) => l.endsWith("{")).map((l) => l.trim().replace(/ \{$/, ""));
    expect(entityNames.length).toBeGreaterThan(0);
    for (const name of entityNames) {
      expect(name, `entity name has forbidden chars: ${name}`).toMatch(ID_PATTERN);
    }
  });

  it("dfd: node ids and arrow endpoints contain only [A-Za-z0-9_]", () => {
    const code = gen.generateDiagram(SPEC_MD, "dfd", "Data Flow").mermaid_code;
    const ids = collectFlowchartIds(code);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) {
      expect(id, `dfd id has forbidden chars: ${id}`).toMatch(ID_PATTERN);
    }
  });

  it("all flowchart-encoded types keep ids clean even with hostile headings", () => {
    const types: DiagramType[] = ["flowchart", "activity", "use_case", "dfd", "deployment", "network_topology"];
    for (const type of types) {
      const code = gen.generateDiagram(SPEC_MD, type, "Order Tracking").mermaid_code;
      for (const id of collectFlowchartIds(code)) {
        expect(id, `${type} id has forbidden chars: ${id}`).toMatch(ID_PATTERN);
      }
    }
  });

  it("deployment/network/dfd never treat Table of Contents headings as components", () => {
    const types: DiagramType[] = ["deployment", "network_topology", "dfd", "c4_container", "c4_component"];
    for (const type of types) {
      const code = gen.generateDiagram(FIGMA_DESIGN, type, "Order Tracking").mermaid_code;
      expect(code.toLowerCase(), `${type} leaked a structural heading`).not.toContain("table of contents");
      expect(code, `${type} leaked a structural heading`).not.toContain("Table_of_Contents");
      expect(code.toLowerCase()).not.toContain("revision history");
      // Real components still present
      expect(code).toContain("Order Service");
    }
  });

  it("class/c4_code/state/sequence/c4 use clean identifiers", () => {
    const classCode = gen.generateDiagram(SPEC_MD, "class", "Interfaces").mermaid_code;
    for (const line of classCode.split("\n")) {
      const cls = line.match(/^ {2}class (\S+)/);
      if (cls) expect(cls[1].replace(/ \{$/, ""), line).toMatch(ID_PATTERN);
    }
    const stateCode = gen.generateDiagram(SPEC_MD, "state", "Lifecycle").mermaid_code;
    for (const line of stateCode.split("\n")) {
      const transition = line.match(/^ {2}(\S+) --> (\S+)$/);
      if (transition) {
        for (const endpoint of [transition[1], transition[2]]) {
          expect(endpoint === "[*]" || ID_PATTERN.test(endpoint), `state id invalid: ${endpoint}`).toBe(true);
        }
      }
    }
    const c4Code = gen.generateDiagram(SPEC_MD, "c4_container", "Architecture").mermaid_code;
    const c4IdRegex = /(?:Person|System|Container|ContainerDb|Component|System_Boundary|Container_Boundary)\(([^,]+),/g;
    let match: RegExpExecArray | null;
    while ((match = c4IdRegex.exec(c4Code)) !== null) {
      expect(match[1], `c4 id invalid: ${match[1]}`).toMatch(ID_PATTERN);
    }
    const seqCode = gen.generateDiagram(SPEC_MD, "sequence", "API Flow").mermaid_code;
    for (const line of seqCode.split("\n").slice(1)) {
      expect(
        /^ {2}participant [A-Za-z0-9_]+$/.test(line) || /^ {2}[A-Za-z0-9_]+(-->>|->>)[A-Za-z0-9_]+: .+$/.test(line),
        `sequence line invalid: "${line}"`
      ).toBe(true);
    }
  });
});

describe("DiagramGenerator — no constant stubs (class, state, c4_code)", () => {
  const gen = new DiagramGenerator(undefined as unknown as FileManager);

  it("class diagrams differ across inputs and carry source-derived tokens", () => {
    const a = gen.generateDiagram(DESIGN_A, "class", "Interfaces").mermaid_code;
    const b = gen.generateDiagram(DESIGN_B, "class", "Interfaces").mermaid_code;
    expect(a).not.toBe(b);
    expect(a).toContain("OrderService");
    expect(a).toContain("NotificationWorker");
    expect(b).toContain("PaymentGateway");
    expect(b).toContain("LedgerStore");
    // The audited constant stub
    expect(a).not.toContain("class Service {");
    expect(b).not.toContain("class Service {");
  });

  it("class methods come from the source bullets, not an invented execute()", () => {
    const a = gen.generateDiagram(DESIGN_A, "class", "Interfaces").mermaid_code;
    expect(a).toContain("+validateIncomingOrders()");
    expect(a).not.toContain("+execute()");
  });

  it("explicit interface declarations are read with their real methods", () => {
    const content = "## API\n\n```ts\ninterface OrderRepository {\n  save(order: Order): void;\n  findById(id: string): Order;\n}\n```\n";
    const code = gen.generateDiagram(content, "c4_code", "Code Structure").mermaid_code;
    expect(code).toContain("OrderRepository");
    expect(code).toContain("<<interface>>");
    expect(code).toContain("+save()");
    expect(code).toContain("+findById()");
    expect(code).not.toContain("IService");
  });

  it("state diagrams derive stages from the artifact's sections when no lifecycle words exist", () => {
    const a = gen.generateDiagram(DESIGN_A, "state", "Lifecycle").mermaid_code;
    const b = gen.generateDiagram(DESIGN_B, "state", "Lifecycle").mermaid_code;
    expect(a).not.toBe(b);
    expect(a).toContain("Order Service");
    expect(b).toContain("Payment Gateway");
    expect(a).toContain("[*] -->");
    expect(a).toContain("--> [*]");
  });

  it("state diagrams still prefer real lifecycle words when present", () => {
    const code = gen.generateDiagram(
      "The order is created, then submitted, then shipped, then delivered.",
      "state",
      "Order Lifecycle"
    ).mermaid_code;
    expect(code).toContain("Created");
    expect(code).toContain("Delivered");
  });

  it("c4_code diagrams differ across inputs and never emit the IService stub", () => {
    const a = gen.generateDiagram(DESIGN_A, "c4_code", "Code Structure").mermaid_code;
    const b = gen.generateDiagram(DESIGN_B, "c4_code", "Code Structure").mermaid_code;
    expect(a).not.toBe(b);
    expect(a).toContain("OrderService");
    expect(b).toContain("PaymentGateway");
    expect(a).not.toContain("IService");
    expect(b).not.toContain("IService");
  });
});

describe("DiagramGenerator — pie uses real counts (no fabricated 60/25/15)", () => {
  const gen = new DiagramGenerator(undefined as unknown as FileManager);

  it("counts requirements by EARS pattern from the spec", () => {
    const code = gen.generateDiagram(SPEC_MD, "pie", "Requirements Coverage").mermaid_code;
    expect(code).toContain('"Event-Driven" : 2');
    expect(code).toContain('"Ubiquitous" : 1');
    expect(code).not.toContain('"Functional" : 60');
    expect(code).not.toContain('"Non-Functional" : 25');
  });

  it("counts real section items for artifacts without requirements", () => {
    const code = gen.generateDiagram(DESIGN_A, "pie", "Design Coverage").mermaid_code;
    expect(code).toContain('"Order Service" : 2');
    expect(code).toContain('"Notification Worker" : 1');
    expect(code).not.toContain("Table of Contents");
    expect(code).not.toContain(": 60");
  });
});

describe("DiagramGenerator — gantt is never header-only", () => {
  const gen = new DiagramGenerator(undefined as unknown as FileManager);

  it("charts spec sections as tasks when there are no checkbox tasks", () => {
    const code = gen.generateDiagram(SPEC_MD, "gantt", "Implementation Timeline").mermaid_code;
    const taskLines = code.split("\n").filter((l) => /:t\d+, /.test(l));
    expect(taskLines.length).toBeGreaterThanOrEqual(2);
    expect(code).toContain("section ");
    expect(code).toContain("Order creation");
  });

  it("keeps the real TASKS.md path working with sections and dependencies", () => {
    const tasks = "## Milestone 1\n\n- [ ] T001 Implement order creation\n- [ ] T002 [P] Wire notifications\n\n## Milestone 2\n\n- [ ] T003 Ship it\n";
    const code = gen.generateDiagram(tasks, "gantt", "Timeline").mermaid_code;
    expect(code).toContain("section Milestone 1");
    expect(code).toContain("section Milestone 2");
    // Mermaid gantt metadata order: id, start date, duration
    expect(code).toMatch(/Implement order creation :t0, \d{4}-\d{2}-\d{2}, 2d/);
    expect(code).toMatch(/Wire notifications :t1, after t0, 1d/);
  });

  it("emits a labeled task even for empty content", () => {
    const code = gen.generateDiagram("", "gantt", "Empty Feature").mermaid_code;
    expect(code).toMatch(/:t0, \d{4}-\d{2}-\d{2}, \d+d/);
  });
});

describe("DiagramGenerator — sequence derives readable Client/System exchanges", () => {
  const gen = new DiagramGenerator(undefined as unknown as FileManager);

  it("maps EARS triggers to requests and shall-clauses to responses", () => {
    const code = gen.generateDiagram(SPEC_MD, "sequence", "API Flow").mermaid_code;
    expect(code).toContain("participant Client");
    expect(code).toContain("participant System");
    expect(code).toContain("Client->>System: a customer submits the checkout form");
    expect(code).toContain("System-->>Client: create an order record within 2 seconds");
    // The audited garbage patterns
    expect(code).not.toContain("shall->>");
    expect(code).not.toMatch(/->>an:/);
  });

  it("every message line is well-formed", () => {
    const code = gen.generateDiagram(SPEC_MD, "sequence", "API Flow").mermaid_code;
    const messageLines = code.split("\n").filter((l) => l.includes(">>"));
    expect(messageLines.length).toBeGreaterThanOrEqual(4);
    for (const line of messageLines) {
      expect(line, `garbled sequence line: "${line}"`).toMatch(/^ {2}(Client->>System|System-->>Client): [^:]+$/);
    }
  });
});

describe("DiagramGenerator — generateAllDiagrams writes DIAGRAMS.md", () => {
  let workspace: string;
  let gen: DiagramGenerator;
  const featureDir = "001-order-tracking";

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-diagram-quality-"));
    mkdirSync(join(workspace, featureDir), { recursive: true });
    writeFileSync(join(workspace, featureDir, "SPECIFICATION.md"), SPEC_MD, "utf8");
    writeFileSync(join(workspace, featureDir, "DESIGN.md"), DESIGN_A, "utf8");
    writeFileSync(
      join(workspace, featureDir, "TASKS.md"),
      "## Milestone 1\n\n- [ ] T001 Implement order creation\n- [ ] T002 Wire notifications\n",
      "utf8"
    );
    writeFileSync(join(workspace, featureDir, "CONSTITUTION.md"), "## Principles\n\n- Spec before code\n", "utf8");
    // The 2-diagram scaffold that the audit found untouched on disk
    writeFileSync(join(workspace, featureDir, "DIAGRAMS.md"), "# Old scaffold\n\n```mermaid\nflowchart TD\n  A\n```\n", "utf8");
    gen = new DiagramGenerator(new FileManager(workspace));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("replaces the scaffold with every generated diagram grouped by source", async () => {
    const result = await gen.generateAllDiagrams(".", featureDir);

    expect(result.total_generated).toBe(result.diagrams.length);
    expect(result.total_generated).toBeGreaterThanOrEqual(17);
    // The advertised set includes c4_context and state (missing in the audit)
    const types = new Set(result.diagrams.map((d) => d.type));
    expect(types.has("c4_context")).toBe(true);
    expect(types.has("state")).toBe(true);
    expect(types.size).toBe(17);

    expect(result.diagrams_file).toBeTruthy();
    const onDisk = readFileSync(join(workspace, featureDir, "DIAGRAMS.md"), "utf8");
    expect(onDisk).not.toContain("Old scaffold");
    const fences = onDisk.match(/```mermaid/g) || [];
    expect(fences.length).toBe(result.total_generated);
    expect(onDisk).toContain("## Source: SPECIFICATION.md");
    expect(onDisk).toContain("## Source: DESIGN.md");
    expect(onDisk).toContain("## Source: TASKS.md");
    expect(onDisk).toContain("## Source: CONSTITUTION.md");
  });
});

describe("figma payload — ToC filtering and per-type structure", () => {
  const types = ["architecture", "data_flow", "user_flow", "integration"] as const;

  it("never turns Table of Contents or numbered ToC headings into components", () => {
    for (const type of types) {
      const structure = buildFigmaStructure(FIGMA_DESIGN, type);
      for (const node of structure.nodes) {
        expect(node.label.toLowerCase(), `${type} leaked structural heading`).not.toMatch(
          /table of contents|revision history|^overview$/
        );
      }
    }
  });

  it("the four diagram types are structurally distinct", () => {
    const structures = types.map((type) => buildFigmaStructure(FIGMA_DESIGN, type));
    for (let i = 0; i < structures.length; i++) {
      for (let j = i + 1; j < structures.length; j++) {
        expect(
          JSON.stringify({ n: structures[i].nodes, c: structures[i].connections }),
          `${types[i]} and ${types[j]} payloads are identical`
        ).not.toBe(JSON.stringify({ n: structures[j].nodes, c: structures[j].connections }));
      }
    }
  });

  it("user_flow excludes infrastructure nodes and starts from the user", () => {
    const structure = buildFigmaStructure(FIGMA_DESIGN, "user_flow");
    expect(structure.nodes.some((n) => n.type === "database")).toBe(false);
    expect(structure.nodes[0].type).toBe("user");
    expect(structure.connections[0].label).toContain("starts at");
  });

  it("integration is hub-and-spoke around the core service", () => {
    const structure = buildFigmaStructure(FIGMA_DESIGN, "integration");
    const hub = structure.nodes[0].id;
    expect(structure.nodes[0].label).toBe("Order Service");
    expect(structure.connections.length).toBeGreaterThan(1);
    for (const connection of structure.connections) {
      expect(connection.from === hub || connection.to === hub).toBe(true);
    }
    expect(structure.connections.some((c) => c.label.includes("integrates with External Payment Provider"))).toBe(true);
  });

  it("data_flow carries data-movement edges including persistence", () => {
    const structure = buildFigmaStructure(FIGMA_DESIGN, "data_flow");
    expect(structure.connections.some((c) => c.label.startsWith("persists to"))).toBe(true);
    expect(structure.connections.some((c) => c.label === "returns output")).toBe(true);
  });

  it("edge labels are meaningful, never the uniform 'connects to'", () => {
    for (const type of types) {
      const structure = buildFigmaStructure(FIGMA_DESIGN, type);
      expect(structure.connections.length).toBeGreaterThan(0);
      for (const connection of structure.connections) {
        expect(connection.label, `${type} has a generic edge label`).not.toBe("connects to");
        expect(connection.label.length).toBeGreaterThan(4);
      }
    }
  });
});
