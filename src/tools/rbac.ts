/**
 * RBAC Tools — sdd_check_access.
 * Thin tool: validate input, call RbacEngine, format response.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TOOL_NAMES } from "../constants.js";
import { RbacEngine, type RbacRole } from "../services/rbac-engine.js";
import { getCallerIdentity } from "./tool-enforcement.js";

const checkAccessInputSchema = z
  .object({
    role_override: z
      .enum(["viewer", "contributor", "admin"])
      .optional()
      .describe(
        "Override the active role for this check (for testing access). Defaults to the authenticated token role, then SDD_ROLE env var, then the configured default_role.",
      ),
    tool_name: z
      .string()
      .optional()
      .describe(
        "Check access for a specific tool. If omitted, returns a summary of all role permissions.",
      ),
  })
  .strict();

export function registerRbacTools(server: McpServer, rbacEngine: RbacEngine): void {
  server.registerTool(
    TOOL_NAMES.CHECK_ACCESS,
    {
      description:
        "Check RBAC access for the current caller. Returns the active role (authenticated token role > SDD_ROLE > default_role), whether a specific tool is accessible, and a summary of what each role can do. Useful for diagnosing permission issues in enterprise deployments.",
      inputSchema: checkAccessInputSchema,
    },
    async (input, extra) => {
      const identity = getCallerIdentity([input, extra]);
      const activeRole: RbacRole =
        (input.role_override as RbacRole | undefined) ??
        identity.role ??
        (process.env["SDD_ROLE"] as RbacRole | undefined) ??
        rbacEngine.roleDefault;

      let toolCheck: { tool: string; allowed: boolean; reason?: string } | undefined;
      if (input.tool_name) {
        const result = rbacEngine.checkAccess(activeRole, input.tool_name);
        toolCheck = { tool: input.tool_name, ...result };
      }

      const roleSource = input.role_override
        ? "role_override parameter"
        : identity.role
          ? "authenticated token (SDD_HTTP_TOKENS_FILE)"
          : process.env["SDD_ROLE"]
            ? "SDD_ROLE environment variable"
            : "config default_role";

      const response = {
        rbac_enabled: rbacEngine.isEnabled,
        active_role: activeRole,
        ...(identity.principal ? { principal: identity.principal } : {}),
        default_role: rbacEngine.roleDefault,
        role_source: roleSource,
        ...(toolCheck ? { tool_check: toolCheck } : {}),
        role_summary: {
          viewer: {
            description: "Read-only access — status, context, routing, metrics, templates",
            allowed_tools: [...RbacEngine.VIEWER_TOOLS],
          },
          contributor: {
            description: "All tools except release-gate operations",
            blocked_tools: [...RbacEngine.BLOCKED_FOR_CONTRIBUTOR],
          },
          admin: {
            description: "All 58 tools — no restrictions",
            blocked_tools: [],
          },
        },
        next_steps: rbacEngine.isEnabled
          ? "For identity-based roles over HTTP, configure SDD_HTTP_TOKENS_FILE (principal + role per token). Locally, set SDD_ROLE=viewer|contributor|admin per process; configure rbac.default_role in .specky/config.yml."
          : "RBAC is disabled. Enable with rbac.enabled: true in .specky/config.yml, or switch to profile: enterprise.",
        learning_note:
          "RBAC is opt-in and defaults to disabled (the enterprise profile turns it on). Authenticated token roles always win over SDD_ROLE — a remote caller cannot out-vote its token. Admin role is required for sdd_create_pr (release gate).",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
