import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "node:crypto";
import type { AuditLogger } from "../services/audit-logger.js";
import { type RbacRole, RbacEngine } from "../services/rbac-engine.js";
import type { StateMachine } from "../services/state-machine.js";
import {
  ExecutionContextError,
  type ExecutionContext,
  type ExecutionContextResolver,
  runWithExecutionContext,
} from "../services/execution-context.js";

interface RegisterableServer {
  registerTool: (name: string, config: unknown, handler: ToolHandler) => unknown;
}

type ToolInput = Record<string, unknown>;
type ToolHandler = (...args: unknown[]) => unknown;

export interface ToolEnforcementOptions {
  auditLogger: AuditLogger;
  rbacEngine: RbacEngine;
  stateMachine: StateMachine;
  contextResolver: ExecutionContextResolver;
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
  principal?: string;
  inputHash: string;
}

/**
 * The slice of the MCP request context we consume. The HTTP transport fills
 * `authInfo` from `req.auth` (set after bearer validation); stdio has none.
 */
export interface CallerIdentity {
  principal?: string;
  role?: RbacRole;
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

function getFeatureNumber(input: ToolInput): string | undefined {
  return readString(input, "feature_number");
}

function getToolInput(args: unknown[]): ToolInput {
  const firstArg = args[0];
  return isRecord(firstArg) ? firstArg : {};
}

function isRbacRole(value: unknown): value is RbacRole {
  return value === "viewer" || value === "contributor" || value === "admin";
}

/**
 * Extract the authenticated identity from the MCP request extra (second
 * handler argument). The HTTP transport propagates `req.auth` as
 * `extra.authInfo`; the principal/role live in `authInfo.extra`.
 */
export function getCallerIdentity(args: unknown[]): CallerIdentity {
  const extra = args[1];
  if (!isRecord(extra) || !isRecord(extra["authInfo"])) return {};
  const authInfo = extra["authInfo"];
  const authExtra = isRecord(authInfo["extra"]) ? authInfo["extra"] : {};
  const principal = readString(authExtra, "principal") ?? readString(authInfo, "clientId");
  const role = isRbacRole(authExtra["role"]) ? authExtra["role"] : undefined;
  return { principal, role };
}

/**
 * Role precedence: authenticated identity (token table) > SDD_ROLE env
 * (local/stdio convenience — the launcher owns the process anyway) > config
 * default_role. When a request carries an authenticated identity, the env var
 * is deliberately ignored: a remote caller must not out-vote its token.
 */
function getActiveRole(rbacEngine: RbacEngine, identity: CallerIdentity): RbacRole {
  if (identity.role) return identity.role;
  const envRole = process.env["SDD_ROLE"];
  if (isRbacRole(envRole)) return envRole;
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
    principal: context.principal,
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
    principal: context.principal,
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
    principal: context.principal,
    result: "error",
    summary,
    input_hash: context.inputHash,
    previous_hash: auditLogger.currentHash,
  });
}

/**
 * Post-execution audit failures cannot un-run the tool; even in fail-closed
 * mode the result is returned and the failure is surfaced on stderr. Only the
 * pre-execution entry gates execution.
 */
async function auditBestEffort(write: Promise<void>, toolName: string): Promise<void> {
  try {
    await write;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[specky] Post-execution audit write failed for ${toolName}: ${message}`);
  }
}

async function resolveContextOrDeny(
  input: ToolInput,
  context: ToolExecutionContext,
  options: ToolEnforcementOptions,
): Promise<ExecutionContext | ToolEnforcementDeniedResponse> {
  try {
    const executionContext = await options.contextResolver.resolve(context.toolName, input);
    context.specDir = executionContext.specDir ?? "<stateless>";
    context.featureNumber = executionContext.featureNumber;
    return executionContext;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof ExecutionContextError ? error.code : "context_resolution_failed";
    await auditBestEffort(
      auditError(options.auditLogger, context, message),
      context.toolName,
    );
    return buildDeniedResponse({ error: code, tool: context.toolName, message });
  }
}

interface StateValidationResult {
  currentPhase?: string;
  denied?: ToolEnforcementDeniedResponse;
}

async function validateStateContext(
  executionContext: ExecutionContext,
  context: ToolExecutionContext,
  options: ToolEnforcementOptions,
): Promise<StateValidationResult> {
  if (!executionContext.stateDir) {
    return { currentPhase: executionContext.state?.current_phase };
  }

  const phaseCheck = await options.stateMachine.validatePhaseForTool(
    executionContext.stateDir,
    context.toolName,
  );
  if (!phaseCheck.allowed) {
    const message = phaseCheck.error_message ?? `Tool ${context.toolName} is not allowed in phase ${phaseCheck.current_phase}.`;
    await auditBestEffort(
      auditError(options.auditLogger, context, message, phaseCheck.current_phase),
      context.toolName,
    );
    return {
      currentPhase: phaseCheck.current_phase,
      denied: buildDeniedResponse({
        error: "phase_validation_failed",
        tool: context.toolName,
        current_phase: phaseCheck.current_phase,
        expected_phases: phaseCheck.expected_phases,
        message,
      }),
    };
  }

  const gateCheck = await options.stateMachine.validateGateForTool(
    executionContext.stateDir,
    context.toolName,
  );
  if (gateCheck.allowed) return { currentPhase: phaseCheck.current_phase };

  const message = gateCheck.error_message ?? `Tool ${context.toolName} blocked by analysis gate.`;
  await auditBestEffort(
    auditError(options.auditLogger, context, message, phaseCheck.current_phase),
    context.toolName,
  );
  return {
    currentPhase: phaseCheck.current_phase,
    denied: buildDeniedResponse({
      error: "gate_blocked",
      tool: context.toolName,
      current_phase: phaseCheck.current_phase,
      gate_decision: gateCheck.gate_decision ?? null,
      message,
      fix: "Run sdd_run_analysis and obtain APPROVE before proceeding to implementation.",
    }),
  };
}

async function executeWithAudit(
  executionContext: ExecutionContext,
  context: ToolExecutionContext,
  handler: ToolHandler,
  args: unknown[],
  options: ToolEnforcementOptions,
  currentPhase?: string,
): Promise<unknown> {
  try {
    await auditStart(options.auditLogger, context, currentPhase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildDeniedResponse({
      error: "audit_unavailable",
      tool: context.toolName,
      message: `Refusing to execute: the audit trail could not be written and audit.fail_closed is on. (${message})`,
    });
  }

  try {
    const result = await runWithExecutionContext(executionContext, async () => handler(...args));
    await auditBestEffort(
      auditSuccess(options.auditLogger, context, result, currentPhase),
      context.toolName,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await auditBestEffort(
      auditError(options.auditLogger, context, message, currentPhase),
      context.toolName,
    );
    throw error;
  }
}

function wrapToolHandler(
  toolName: string,
  handler: ToolHandler,
  options: ToolEnforcementOptions,
): ToolHandler {
  return async (...args: unknown[]) => {
    const input = getToolInput(args);
    const requestedSpecDir = readString(input, "spec_dir");
    const identity = getCallerIdentity(args);
    const activeRole = getActiveRole(options.rbacEngine, identity);
    const context: ToolExecutionContext = {
      toolName,
      specDir: requestedSpecDir ?? "<unspecified>",
      featureNumber: getFeatureNumber(input),
      activeRole,
      principal: identity.principal,
      inputHash: hashValue(input),
    };

    const rbac = options.rbacEngine.checkAccess(activeRole, toolName);
    if (!rbac.allowed) {
      await auditBestEffort(
        auditError(options.auditLogger, context, rbac.reason ?? "RBAC access denied"),
        toolName,
      );
      return buildDeniedResponse({
        error: "access_denied",
        tool: toolName,
        active_role: activeRole,
        ...(identity.principal ? { principal: identity.principal } : {}),
        message: rbac.reason ?? `Role ${activeRole} cannot invoke ${toolName}.`,
      });
    }

    const resolved = await resolveContextOrDeny(input, context, options);
    if ("isError" in resolved) return resolved;

    const validation = await validateStateContext(resolved, context, options);
    if (validation.denied) return validation.denied;

    return executeWithAudit(
      resolved,
      context,
      handler,
      args,
      options,
      validation.currentPhase,
    );
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
