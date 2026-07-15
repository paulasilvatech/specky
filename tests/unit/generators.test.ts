/**
 * generators.test.ts — coverage for three large, pure services that had none:
 * ComplianceEngine, DiagramGenerator (17 diagram types), and IacGenerator.
 */
import { describe, expect, it } from "vitest";
import { ComplianceEngine } from "../../src/services/compliance-engine.js";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { IacGenerator } from "../../src/services/iac-generator.js";
import type { ComplianceFramework, DiagramType } from "../../src/constants.js";

describe("ComplianceEngine", () => {
  const engine = new ComplianceEngine();

  it("exposes exactly five versioned frameworks with six controls each", () => {
    const frameworks = engine.getFrameworks();
    expect(frameworks).toHaveLength(5);
    expect(frameworks).toEqual(
      expect.arrayContaining(["hipaa", "soc2", "gdpr", "pci_dss", "iso27001"] as ComplianceFramework[]),
    );
    for (const fw of frameworks) {
      expect(engine.getControls(fw), `${fw} controls`).toHaveLength(6);
    }
  });

  it("reports compliance only from explicit control evidence", () => {
    const empty = engine.checkCompliance("soc2", {});
    expect(empty.controls_checked).toBe(6);
    expect(empty.overall_status).toBe("non_compliant");

    const evidence = Object.fromEntries(
      engine.getControls("soc2").map((control) => [control.id, [`DESIGN.md#${control.id}`]]),
    );
    const evidenced = engine.checkCompliance("soc2", evidence);
    expect(evidenced.controls_passed).toBe(6);
    expect(evidenced.overall_status).toBe("compliant");
    expect(evidenced.findings.every((finding) => finding.evidence?.startsWith("DESIGN.md"))).toBe(true);
  });
});

describe("DiagramGenerator", () => {
  const gen = new DiagramGenerator();
  const ALL_TYPES: DiagramType[] = [
    "flowchart", "sequence", "class", "er", "state",
    "c4_context", "c4_container", "c4_component", "c4_code",
    "activity", "use_case", "dfd", "deployment", "network_topology",
    "gantt", "pie", "mindmap",
  ];

  it("produces non-empty Mermaid for every one of the 17 types", () => {
    const content = "REQ-CORE-001: The system shall authenticate users and store sessions in a database.";
    for (const type of ALL_TYPES) {
      const spec = gen.generateDiagram(content, type, "Auth");
      expect(spec.type).toBe(type);
      expect(spec.mermaid_code.length, `${type} mermaid`).toBeGreaterThan(0);
    }
  });

  it("emits a valid mermaid header for common types", () => {
    expect(gen.generateDiagram("a -> b", "sequence", "Flow").mermaid_code).toContain("sequenceDiagram");
    expect(gen.generateDiagram("Users, Orders", "er", "Data").mermaid_code).toContain("erDiagram");
  });

  it("builds a user-story flow", () => {
    const code = gen.generateUserStoryFlow("Login", ["enter credentials", "submit", "receive token"]);
    expect(code).toContain("flowchart");
  });

  it("gantt diagram accepts canonical TASKS.md table rows", () => {
    const tasksTable = [
      "| ID | Title | Parallel | Effort | Depends On | Traces To |",
      "|----|-------|----------|--------|------------|-----------|",
      "| T-001 | Scaffold API | | S | — | REQ-TODO-001 |",
      "| T-002 | Add auth | [P] | M | T-001 | REQ-TODO-002 |",
    ].join("\n");
    const gantt = gen.generateDiagram(tasksTable, "gantt", "Timeline");
    expect(gantt.mermaid_code).toContain("gantt");
    expect(gantt.mermaid_code).toMatch(/Scaffold API|T-001/);
  });
});

describe("IacGenerator", () => {
  const gen = new IacGenerator();

  it("generates a Node Dockerfile (+ compose + dockerignore)", () => {
    const res = gen.generateDockerfile({ language: "TypeScript", framework: "Express", runtime: "Node.js" }, true, true);
    const paths = res.files.map((f) => f.path);
    expect(paths).toContain("Dockerfile");
    expect(paths).toContain("docker-compose.yml");
    expect(paths).toContain(".dockerignore");
    const dockerfile = res.files.find((f) => f.path === "Dockerfile")!;
    expect(dockerfile.content).toContain("FROM node:");
    expect(dockerfile.content).toContain("AS builder"); // multi-stage requested
  });

  it("generates a Python Dockerfile without compose when not requested", () => {
    const res = gen.generateDockerfile({ language: "Python", framework: "FastAPI", runtime: "Python" }, false, false);
    const paths = res.files.map((f) => f.path);
    expect(paths).toContain("Dockerfile");
    expect(paths).not.toContain("docker-compose.yml");
    expect(res.files.find((f) => f.path === "Dockerfile")!.content).toContain("FROM python:");
  });

  it("generates a devcontainer.json", () => {
    const res = gen.generateDevcontainer({ language: "TypeScript", framework: "Next.js" }, [], []);
    expect(res.type).toBe("devcontainer");
    expect(res.files.some((f) => f.path.includes("devcontainer.json"))).toBe(true);
  });
});
