import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "node:crypto";
import { DEFAULT_SPEC_DIR } from "../constants.js";
import type { AuditLogger } from "../services/audit-logger.js";
import { type RbacRole, RbacEngine } from "../services/rbac-engine.js";
import type { StateMachine } from "../services/state-machine.js";

interface RegisterableServer {
  registerTool: (name: string, config: unknown, handler: ToolHandler) => unknown;
}

type ToolInput = Record<string, unknown>;
type ToolHandler = (...args: unknown[]) => unknown;

export interface ToolEnforcementOptions {
  auditLogger: AuditLogger;
  rbacEngine: RbacEngine;
  stateMachine: StateMachine;
}

export interface ToolEnforcementDeniedResponse {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
}

interface ToolExecutionContext {
  toolName: string;
  specDir: string;
  featureNumber?: string;
  activeRole: RbacRole;
  inputHash: string;
}

const ENFORCEMENT_INSTALLED = Symbol.for("specky.toolEnforcementInstalled");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForHash(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function hashValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHash(value)))
    .digest("hex");
}

function readString(input: ToolInput, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getSpecDir(input: ToolInput): string {
  return readString(input, "spec_dir") ?? DEFAULT_SPEC_DIR;
}

function getFeatureNumber(input: ToolInput): string | undefined {
  return readString(input, "feature_number");
}

function getToolInput(args: unknown[]): ToolInput {
  const firstArg = args[0];
  return isRecord(firstArg) ? firstArg : {};
}

function getActiveRole(rbacEngine: RbacEngine): RbacRole {
  const envRole = process.env["SDD_ROLE"];
  if (envRole === "viewer" || envRole === "contributor" || envRole === "admin") {
    return envRole;
  }
  return rbacEngine.roleDefault;
}

function buildDeniedResponse(payload: Record<string, unknown>): ToolEnforcementDeniedResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

async function auditStart(
  auditLogger: AuditLogger,
  context: ToolExecutionContext,
  phase?: string,
): Promise<void> {
  await auditLogger.log({
    timestamp: new Date().toISOString(),
    tool: context.toolName,
    spec_dir: context.specDir,
    feature_number: context.featureNumber,
    phase,
    role: context.activeRole,
    result: "success",
    summary: "Execution started",
    input_hash: context.inputHash,
    previous_hash: auditLogger.currentHash,
  });
}

async function auditSuccess(
  auditLogger: AuditLogger,
  context: ToolExecutionContext,
  output: unknown,
  phase?: string,
): Promise<void> {
  await auditLogger.log({
    timestamp: new Date().toISOString(),
    tool: context.toolName,
    spec_dir: context.specDir,
    feature_number: context.featureNumber,
    phase,
    role: context.activeRole,
    result: "success",
    summary: "Execution completed",
    input_hash: context.inputHash,
    output_hash: hashValue(output),
    previous_hash: auditLogger.currentHash,
  });
}

async function auditError(
  auditLogger: AuditLogger,
  context: ToolExecutionContext,
  summary: string,
  phase?: string,
): Promise<void> {
  await auditLogger.log({
    timestamp: new Date().toISOString(),
    tool: context.toolName,
    spec_dir: context.specDir,
    feature_number: context.featureNumber,
    phase,
    role: context.activeRole,
    result: "error",
    summary,
    input_hash: context.inputHash,
    previous_hash: auditLogger.currentHash,
  });
}

function wrapToolHandler(
  toolName: string,
  handler: ToolHandler,
  options: ToolEnforcementOptions,
): ToolHandler {
  return async (...args: unknown[]) => {
    const input = getToolInput(args);
    const specDir = getSpecDir(input);
    const activeRole = getActiveRole(options.rbacEngine);
    const context: ToolExecutionContext = {
      toolName,
      specDir,
      featureNumber: getFeatureNumber(input),
      activeRole,
      inputHash: hashValue(input),
    };

    const rbac = options.rbacEngine.checkAccess(activeRole, toolName);
    if (!rbac.allowed) {
      await auditError(options.auditLogger, context, rbac.reason ?? "RBAC access denied");
      return buildDeniedResponse({
        error: "access_denied",
        tool: toolName,
        active_role: activeRole,
        message: rbac.reason ?? `Role ${activeRole} cannot invoke ${toolName}.`,
      });
    }

    const phaseCheck = await options.stateMachine.validatePhaseForTool(specDir, toolName);
    if (!phaseCheck.allowed) {
      const message = phaseCheck.error_message ?? `Tool ${toolName} is not allowed in phase ${phaseCheck.current_phase}.`;
      await auditError(options.auditLogger, context, message, phaseCheck.current_phase);
      return buildDeniedResponse({
        error: "phase_validation_failed",
        tool: toolName,
        current_phase: phaseCheck.current_phase,
        expected_phases: phaseCheck.expected_phases,
        message,
      });
    }

    await auditStart(options.auditLogger, context, phaseCheck.current_phase);
    try {
      const result = await handler(...args);
      await auditSuccess(options.auditLogger, context, result, phaseCheck.current_phase);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await auditError(options.auditLogger, context, message, phaseCheck.current_phase);
      throw error;
    }
  };
}

export function installToolEnforcement(
  server: McpServer,
  options: ToolEnforcementOptions,
): void {
  const target = server as unknown as RegisterableServer & { [ENFORCEMENT_INSTALLED]?: boolean };
  if (target[ENFORCEMENT_INSTALLED]) return;

  const originalRegisterTool = target.registerTool.bind(target);
  target.registerTool = (name: string, config: unknown, handler: ToolHandler) => {
    return originalRegisterTool(name, config, wrapToolHandler(name, handler, options));
  };
  target[ENFORCEMENT_INSTALLED] = true;
}
