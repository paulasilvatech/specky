import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import type { SpeckyConfig } from "../config.js";
import { STATE_FILE } from "../constants.js";
import { getToolContract, type ToolContract } from "../contracts/tool-contracts.js";
import {
  type Capability,
  type CapabilityConfig,
  type ResolvedUseCaseContract,
  resolveUseCaseContract,
  type UseCaseContractId,
  useCaseSelectionSchema,
} from "../contracts/use-case.js";
import type { FeatureContext, FeatureInfo, SddState } from "../types.js";
import type { FileManager } from "./file-manager.js";
import type { StateMachine } from "./state-machine.js";

export interface ExecutionContext {
  toolName: string;
  toolContract: ToolContract;
  specDir?: string;
  featureNumber?: string;
  feature?: FeatureInfo;
  stateDir?: string;
  state?: SddState;
  requestedContract?: ResolvedUseCaseContract;
}

export class ExecutionContextError extends Error {
  constructor(
    readonly code:
      | "missing_context"
      | "feature_not_found"
      | "state_not_found"
      | "contract_mismatch"
      | "capability_disabled",
    message: string,
  ) {
    super(message);
    this.name = "ExecutionContextError";
  }
}

function requiredString(input: Record<string, unknown>, key: string, toolName: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ExecutionContextError("missing_context", `${toolName} requires an explicit ${key}.`);
  }
  return value;
}

function normalizeFeatureDirectory(directory: string): string {
  return directory.replaceAll("\\", "/").replace(/^\.\//, "");
}

export class ExecutionContextResolver {
  constructor(
    private readonly fileManager: FileManager,
    private readonly stateMachine: StateMachine,
    private readonly configProvider?: () => SpeckyConfig,
  ) {}

  private validateWorkspaceContract(
    toolName: string,
    specDir: string,
    contract?: ResolvedUseCaseContract,
  ): void {
    if (!this.configProvider) return;
    const config = this.configProvider();
    if (specDir !== config.spec_root) {
      throw new ExecutionContextError(
        "contract_mismatch",
        `${toolName} received spec_dir ${specDir}; workspace config requires ${config.spec_root}.`,
      );
    }
    if (contract && !config.contracts.enabled.includes(contract.id as UseCaseContractId)) {
      throw new ExecutionContextError(
        "contract_mismatch",
        `Use-case contract ${contract.id} is not enabled in .specky/config.yml.`,
      );
    }
  }

  async resolve(toolName: string, input: Record<string, unknown>): Promise<ExecutionContext> {
    const toolContract = getToolContract(toolName);
    if (toolContract.scope === "stateless") {
      return Object.freeze({ toolName, toolContract });
    }

    const specDir = requiredString(input, "spec_dir", toolName);
    if (toolContract.scope === "bootstrap" || toolContract.scope === "batch") {
      const requestedContract = resolveUseCaseContract(this.resolveRequestedContract(input));
      this.validateWorkspaceContract(toolName, specDir, requestedContract);
      if (
        toolContract.capability &&
        !requestedContract.capabilities.includes(toolContract.capability)
      ) {
        throw new ExecutionContextError(
          "capability_disabled",
          `${toolName} requires capability ${toolContract.capability}, which is not enabled by ${requestedContract.id}.`,
        );
      }
      return Object.freeze({ toolName, toolContract, specDir, requestedContract });
    }

    if (toolContract.scope === "workspace") {
      if (!toolContract.capability) {
        this.validateWorkspaceContract(toolName, specDir);
        return Object.freeze({ toolName, toolContract, specDir });
      }
      const requestedContract = resolveUseCaseContract(this.resolveRequestedContract(input));
      this.validateWorkspaceContract(toolName, specDir, requestedContract);
      if (!requestedContract.capabilities.includes(toolContract.capability)) {
        throw new ExecutionContextError(
          "capability_disabled",
          `${toolName} requires capability ${toolContract.capability}, which is not enabled by ${requestedContract.id}.`,
        );
      }
      return Object.freeze({ toolName, toolContract, specDir, requestedContract });
    }

    const featureNumber = requiredString(input, "feature_number", toolName);
    this.validateWorkspaceContract(toolName, specDir);
    const features = await this.fileManager.listFeatures(specDir);
    const feature = features.find((candidate) => candidate.number === featureNumber);
    if (!feature) {
      throw new ExecutionContextError(
        "feature_not_found",
        `Feature ${featureNumber} not found in ${specDir}. Registered features: ${features.map((candidate) => candidate.number).join(", ") || "none"}.`,
      );
    }

    const statePath = join(feature.directory, STATE_FILE);
    if (!(await this.fileManager.fileExists(statePath))) {
      throw new ExecutionContextError(
        "state_not_found",
        `Feature ${featureNumber} has no canonical state at ${statePath}.`,
      );
    }

    const state = await this.stateMachine.loadState(feature.directory);
    this.validateWorkspaceContract(toolName, specDir, state.contract);
    if (
      state.feature.number !== feature.number ||
      state.feature.name !== feature.name ||
      normalizeFeatureDirectory(state.feature.directory) !==
        normalizeFeatureDirectory(feature.directory)
    ) {
      throw new ExecutionContextError(
        "contract_mismatch",
        `Feature state identity does not match directory ${feature.directory}.`,
      );
    }

    if (toolContract.capability && !state.contract.capabilities.includes(toolContract.capability)) {
      throw new ExecutionContextError(
        "capability_disabled",
        `${toolName} requires capability ${toolContract.capability}, which is not enabled by ${state.contract.id}.`,
      );
    }

    return Object.freeze({
      toolName,
      toolContract,
      specDir,
      featureNumber,
      feature: Object.freeze({ ...feature, files: [...feature.files] }),
      stateDir: feature.directory,
      state,
    });
  }

  resolveRequestedContract(
    input: Record<string, unknown>,
  ): ReturnType<typeof useCaseSelectionSchema.parse> {
    const selection = input["use_case"];
    if (selection === undefined) {
      throw new ExecutionContextError(
        "missing_context",
        "A use_case contract selection is required.",
      );
    }
    return useCaseSelectionSchema.parse(selection);
  }
}

const executionContextStorage = new AsyncLocalStorage<ExecutionContext>();

export function runWithExecutionContext<T>(
  context: ExecutionContext,
  operation: () => Promise<T>,
): Promise<T> {
  return executionContextStorage.run(context, operation);
}

export function requireExecutionContext(toolName: string): ExecutionContext {
  const context = executionContextStorage.getStore();
  if (context?.toolName !== toolName) {
    throw new Error(`Execution context for ${toolName} is unavailable.`);
  }
  return context;
}

/**
 * Narrowed resolution for feature-scoped tools: the tool contract guarantees
 * specDir, featureNumber, feature, stateDir, and state were resolved before
 * the handler runs. Absence indicates an enforcement or contract bug, so this
 * throws an internal error rather than a caller-facing one.
 */
export function requireFeatureContext(toolName: string): FeatureContext {
  const context = requireExecutionContext(toolName);
  if (
    !context.specDir ||
    !context.featureNumber ||
    !context.feature ||
    !context.stateDir ||
    !context.state
  ) {
    throw new Error(
      `Execution context for ${toolName} is missing feature-scoped state (declared scope: ${context.toolContract.scope}).`,
    );
  }
  return {
    toolName: context.toolName,
    toolContract: context.toolContract,
    specDir: context.specDir,
    featureNumber: context.featureNumber,
    feature: context.feature,
    stateDir: context.stateDir,
    state: context.state,
    requestedContract: context.requestedContract,
  };
}

/**
 * Typed per-capability accessor. Tool contracts already guarantee the
 * capability (and therefore its config) is present for tools declaring it, so
 * absence indicates a contract bug and throws an internal error.
 */
export function requireCapabilityConfig<K extends Capability>(
  config: CapabilityConfig,
  capability: K,
): NonNullable<CapabilityConfig[K]> {
  const value = config[capability];
  if (!value) {
    throw new Error(
      `Capability configuration for ${capability} is unavailable in the resolved use-case contract.`,
    );
  }
  return value;
}
