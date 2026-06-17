import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("enterprise documentation baseline", () => {
  const docs = [
    "docs/BRANCH-GOVERNANCE.md",
    "docs/DETERMINISM.md",
    "docs/ENTERPRISE-CONTROLS.md",
    "docs/EVIDENCE.md",
    "docs/SYSTEM-DESIGN.md",
  ];

  it("keeps required enterprise documentation files present", () => {
    for (const doc of docs) {
      expect(existsSync(resolve(ROOT, doc)), `${doc} should exist`).toBe(true);
    }
  });

  it("documents branch reset evidence", () => {
    const evidence = read("docs/EVIDENCE.md");
    const branchGovernance = read("docs/BRANCH-GOVERNANCE.md");

    expect(evidence).toContain("4225130af2780f44bc3a3825e5db275879f6b111");
    expect(branchGovernance).toContain("origin/main...origin/develop: 32 behind, 1 ahead");
    expect(branchGovernance).toContain("specky-pre-branch-reset-develop-dirty-20260617T205947Z");
  });

  it("documents C4 and execution diagrams", () => {
    const systemDesign = read("docs/SYSTEM-DESIGN.md");

    expect(systemDesign).toContain("## C4 Context");
    expect(systemDesign).toContain("## C4 Container");
    expect(systemDesign).toContain("## C4 Component");
    expect(systemDesign).toContain("## Tool Execution Sequence");
    expect(systemDesign).toContain("## Pipeline State Machine");
  });

  it("keeps dependency count aligned in public docs", () => {
    expect(read("README.md")).toContain("dependencies-3-green");
    expect(read("README.md")).toContain("3 runtime dependencies");
    expect(read("SECURITY.md")).toContain("Specky has only **3 runtime dependencies**");
  });

  it("documents Node 20 as the minimum install requirement", () => {
    const installDoc = read("docs/INSTALL.md");

    expect(installDoc).toContain("Requires Node.js ≥20");
    expect(installDoc).not.toContain("Requires Node.js ≥18");
    expect(installDoc).not.toContain("Node ≥18");
  });
});
