import { describe, expect, it } from "vitest";
import { Phase, TOOL_NAMES, TOTAL_TOOLS } from "../../src/constants.js";
import {
  assertToolContractCompleteness,
  getToolContract,
  TOOL_CONTRACTS,
} from "../../src/contracts/tool-contracts.js";
import {
  assertUseCaseContractFingerprint,
  type ExecutionMode,
  type Lifecycle,
  resolvedUseCaseContractSchema,
  resolveUseCaseContract,
  SUPPORTED_USE_CASE_CONTRACT_IDS,
  type Workload,
} from "../../src/contracts/use-case.js";

function parseContractId(id: string): {
  lifecycle: Lifecycle;
  workload: Workload;
  execution_mode: ExecutionMode;
} {
  const lifecycle = id.startsWith("greenfield-")
    ? "greenfield"
    : id.startsWith("brownfield-")
      ? "brownfield"
      : "migration";
  const execution_mode = id.endsWith("-full")
    ? "full"
    : id.endsWith("-rapid")
      ? "rapid"
      : "emergency";
  const workload = id.slice(lifecycle.length + 1, -(execution_mode.length + 1)) as Workload;
  return { lifecycle, workload, execution_mode };
}

describe("explicit Specky contracts", () => {
  it("has one explicit contract for every MCP tool", () => {
    expect(() => assertToolContractCompleteness()).not.toThrow();
    expect(Object.keys(TOOL_CONTRACTS)).toHaveLength(TOTAL_TOOLS);
    expect(new Set(Object.values(TOOL_NAMES))).toHaveLength(TOTAL_TOOLS);
  });

  it("rejects tools without a registered contract", () => {
    expect(() => getToolContract("sdd_future_unclassified_tool")).toThrow(
      /No explicit tool contract registered/,
    );
  });

  it("classifies clarify as feature-scoped with canonical feature state", () => {
    expect(getToolContract(TOOL_NAMES.CLARIFY)).toMatchObject({
      scope: "feature",
      state: "feature",
      phases: [Phase.Specify, Phase.Clarify],
      reads: ["SPECIFICATION.md"],
      writes: ["feature state"],
    });
  });

  it("materializes all named lifecycle/workload/mode contracts deterministically", () => {
    expect(SUPPORTED_USE_CASE_CONTRACT_IDS).toHaveLength(54);
    expect(new Set(SUPPORTED_USE_CASE_CONTRACT_IDS)).toHaveLength(54);

    for (const id of SUPPORTED_USE_CASE_CONTRACT_IDS) {
      const selection = { ...parseContractId(id), capabilities: [], capability_config: {} };
      const first = resolveUseCaseContract(selection);
      const second = resolveUseCaseContract(selection);
      expect(first.id).toBe(id);
      expect(first.fingerprint).toBe(second.fingerprint);
      expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(() => assertUseCaseContractFingerprint(first)).not.toThrow();
      expect(() =>
        assertUseCaseContractFingerprint(
          resolvedUseCaseContractSchema.parse(JSON.parse(JSON.stringify(first))),
        ),
      ).not.toThrow();
      expect(first.required_discovery_artifacts.length).toBeGreaterThan(0);
      expect(first.required_design_sections.length).toBeGreaterThan(0);
    }
  });

  it("rejects a modified contract snapshot", () => {
    const contract = resolveUseCaseContract({
      lifecycle: "brownfield",
      workload: "api",
      execution_mode: "full",
      capabilities: ["compliance", "tdd"],
      capability_config: {
        compliance: {
          frameworks: ["soc2"],
          control_pack_version: "2026.1",
          evidence_required: true,
        },
        tdd: {
          framework: "vitest",
          property_framework: "fast-check",
          output_dir: "tests",
          coverage_threshold: 90,
          trace_marker: "REQ-",
          imports: 'import { describe, it, expect } from "vitest";',
          bindings: [
            {
              requirement_id: "REQ-CORE-001",
              test_name: "returns the configured result",
              body: "const result = 2 + 2;\nexpect(result).toBe(4);",
            },
          ],
          property_imports: 'import fc from "fast-check";\nimport { expect, it } from "vitest";',
          property_bindings: [
            {
              requirement_id: "REQ-CORE-001",
              property_name: "addition preserves the configured offset",
              property_type: "invariant",
              body: 'it("REQ-CORE-001: addition offset", () => {\n  fc.assert(fc.property(fc.integer(), (value) => {\n    expect(value + 2 - 2).toBe(value);\n  }));\n});',
            },
          ],
        },
      },
    });
    const modified = {
      ...contract,
      required_design_sections: [...contract.required_design_sections, "unregistered section"],
    };
    expect(() => assertUseCaseContractFingerprint(modified)).toThrow(/fingerprint mismatch/);
  });
});
