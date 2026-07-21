/**
 * generators.test.ts — coverage for three large, pure services that had none:
 * ComplianceEngine, explicit story-flow assembly, and IacGenerator.
 */
import { describe, expect, it } from "vitest";
import type { ComplianceFramework } from "../../src/constants.js";
import { ComplianceEngine } from "../../src/services/compliance-engine.js";
import { DiagramGenerator } from "../../src/services/diagram-generator.js";
import { IacGenerator } from "../../src/services/iac-generator.js";

describe("ComplianceEngine", () => {
  const engine = new ComplianceEngine();

  it("exposes exactly five versioned frameworks with six controls each", () => {
    const frameworks = engine.getFrameworks();
    expect(frameworks).toHaveLength(5);
    expect(frameworks).toEqual(
      expect.arrayContaining([
        "hipaa",
        "soc2",
        "gdpr",
        "pci_dss",
        "iso27001",
      ] as ComplianceFramework[]),
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
    expect(evidenced.findings.every((finding) => finding.evidence?.startsWith("DESIGN.md"))).toBe(
      true,
    );
  });
});

describe("DiagramGenerator", () => {
  const gen = new DiagramGenerator();

  it("builds a user-story flow", () => {
    const code = gen.generateUserStoryFlow("Login", [
      "enter credentials",
      "submit",
      "receive token",
    ]);
    expect(code).toContain("flowchart TD");
    expect(code).toContain("S1 --> S2");
  });

  it("rejects an empty user-story flow instead of synthesizing a title node", () => {
    expect(() => gen.generateUserStoryFlow("Login", [])).toThrow(
      /requires at least one explicit flow step/,
    );
  });
});

describe("IacGenerator", () => {
  const gen = new IacGenerator();

  it("generates a Node Dockerfile (+ compose + dockerignore)", () => {
    const res = gen.generateDockerfile(
      { language: "TypeScript", framework: "Express", runtime: "Node.js" },
      true,
      true,
    );
    const paths = res.files.map((f) => f.path);
    expect(paths).toContain("Dockerfile");
    expect(paths).toContain("docker-compose.yml");
    expect(paths).toContain(".dockerignore");
    const dockerfile = res.files.find((f) => f.path === "Dockerfile")!;
    expect(dockerfile.content).toContain("FROM node:");
    expect(dockerfile.content).toContain("AS builder"); // multi-stage requested
  });

  it("generates a Python Dockerfile without compose when not requested", () => {
    const res = gen.generateDockerfile(
      { language: "Python", framework: "FastAPI", runtime: "Python" },
      false,
      false,
    );
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
