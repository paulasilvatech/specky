import type { z } from "zod";
import { Phase } from "../constants.js";
import { type ResolvedUseCaseContract, resolveUseCaseContract } from "../contracts/use-case.js";
import type { tddAmendmentSchema } from "../schemas/utility.js";
import type { FeatureContext } from "../types.js";
import { extractRequirementIds } from "../utils/id-contracts.js";
import type { FileManager } from "./file-manager.js";

export type TddAmendment = z.infer<typeof tddAmendmentSchema>;

export interface TddAmendmentResult {
  replaced_bindings?: number;
  replaced_property_bindings?: number;
  contract_fingerprint_before: string;
  contract_fingerprint_after: string;
}

function validateCompleteBindings(
  requirementIds: string[],
  bindings: Array<{ requirement_id: string; test_name: string }>,
): void {
  const expected = new Set(requirementIds);
  const requirementCounts = new Map<string, number>();
  const testNameCounts = new Map<string, number>();
  for (const binding of bindings) {
    requirementCounts.set(
      binding.requirement_id,
      (requirementCounts.get(binding.requirement_id) ?? 0) + 1,
    );
    testNameCounts.set(binding.test_name, (testNameCounts.get(binding.test_name) ?? 0) + 1);
  }
  const missing = requirementIds.filter((requirementId) => !requirementCounts.has(requirementId));
  const unknown = [...requirementCounts.keys()].filter(
    (requirementId) => !expected.has(requirementId),
  );
  const duplicateRequirements = [...requirementCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([requirementId]) => requirementId);
  const duplicateTestNames = [...testNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([testName]) => testName);
  if (
    missing.length > 0 ||
    unknown.length > 0 ||
    duplicateRequirements.length > 0 ||
    duplicateTestNames.length > 0
  ) {
    throw new Error(
      `TDD bindings mismatch. Missing: ${missing.join(", ") || "none"}. ` +
        `Unknown: ${unknown.join(", ") || "none"}. ` +
        `Duplicate requirements: ${duplicateRequirements.join(", ") || "none"}. ` +
        `Duplicate test names: ${duplicateTestNames.join(", ") || "none"}.`,
    );
  }
}

function validatePropertyBindings(
  requirementIds: string[],
  bindings: Array<{ requirement_id: string; property_name: string }>,
): void {
  const expected = new Set(requirementIds);
  const requirementCounts = new Map<string, number>();
  const propertyNameCounts = new Map<string, number>();
  for (const binding of bindings) {
    requirementCounts.set(
      binding.requirement_id,
      (requirementCounts.get(binding.requirement_id) ?? 0) + 1,
    );
    propertyNameCounts.set(
      binding.property_name,
      (propertyNameCounts.get(binding.property_name) ?? 0) + 1,
    );
  }
  const unknown = [...requirementCounts.keys()].filter(
    (requirementId) => !expected.has(requirementId),
  );
  const duplicateRequirements = [...requirementCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([requirementId]) => requirementId);
  const duplicateNames = [...propertyNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([propertyName]) => propertyName);
  if (unknown.length > 0 || duplicateRequirements.length > 0 || duplicateNames.length > 0) {
    throw new Error(
      `Property bindings mismatch. Unknown: ${unknown.join(", ") || "none"}. ` +
        `Duplicate property requirements: ${duplicateRequirements.join(", ") || "none"}. ` +
        `Duplicate property names: ${duplicateNames.join(", ") || "none"}.`,
    );
  }
}

export async function prepareTddContractAmendment(
  fileManager: FileManager,
  context: FeatureContext,
  amendment: TddAmendment,
): Promise<{ contract: ResolvedUseCaseContract; result: TddAmendmentResult }> {
  if (context.state.current_phase === Phase.Release) {
    throw new Error("TDD bindings cannot be amended after the feature enters the release phase.");
  }
  const currentTdd = context.state.contract.capability_config.tdd;
  if (!currentTdd || !context.state.contract.capabilities.includes("tdd")) {
    throw new Error("TDD capability is not enabled for this feature contract.");
  }

  let specification: string;
  try {
    specification = await fileManager.readSpecFile(context.feature.directory, "SPECIFICATION.md");
  } catch {
    throw new Error(`SPECIFICATION.md not found in ${context.feature.directory}.`);
  }
  const requirementIds = extractRequirementIds(specification);
  if (requirementIds.length === 0) {
    throw new Error(`No requirement IDs found in ${context.feature.directory}/SPECIFICATION.md.`);
  }

  const nextCapabilityConfig = structuredClone(context.state.contract.capability_config);
  const nextTdd = { ...currentTdd, ...amendment };
  if (amendment.bindings) validateCompleteBindings(requirementIds, nextTdd.bindings);
  if (amendment.property_bindings) {
    validatePropertyBindings(requirementIds, nextTdd.property_bindings);
  }
  nextCapabilityConfig.tdd = nextTdd;
  const contract = resolveUseCaseContract({
    lifecycle: context.state.contract.lifecycle,
    workload: context.state.contract.workload,
    execution_mode: context.state.contract.execution_mode,
    capabilities: [...context.state.contract.capabilities],
    capability_config: nextCapabilityConfig,
  });

  return {
    contract,
    result: {
      ...(amendment.bindings ? { replaced_bindings: amendment.bindings.length } : {}),
      ...(amendment.property_bindings
        ? { replaced_property_bindings: amendment.property_bindings.length }
        : {}),
      contract_fingerprint_before: context.state.contract.fingerprint,
      contract_fingerprint_after: contract.fingerprint,
    },
  };
}
