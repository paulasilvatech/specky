/**
 * RBAC Tools — sdd_check_access.
 * Thin tool: validate input, call RbacEngine, format response.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RbacEngine, type RbacRole } from "../services/rbac-engine.js";
import { TOOL_NAMES } from "../constants.js";

const checkAccessInputSchema = z.object({
  role_override: z
    .enum(["viewer", "contributor", "admin"])
    .optional()
    .describe(
      "Override the active role for this check (for testing access). Defaults to SDD_ROLE env var or the configured default_role.",
    ),
  tool_name: z
    .string()
    .optional()
    .describe(
      "Check access for a specific tool. If omitted, returns a summary of all role permissions.",
    ),
}).strict();

export function registerRbacTools(
  server: McpServer,
  rbacEngine: RbacEngine,
): void {
  server.registerTool(
    TOOL_NAMES.CHECK_ACCESS,
    {
      description:
        "Check RBAC access for the current role. Returns the active role, whether a specific tool is accessible, and a summary of what each role can do. Useful for diagnosing permission issues in enterprise deployments.",
      inputSchema: checkAccessInputSchema,
    },
    async (input) => {
      const activeRole: RbacRole =
        (input.role_override as RbacRole | undefined) ??
        ((process.env["SDD_ROLE"] as RbacRole | undefined) ?? rbacEngine.roleDefault);

      let toolCheck: { tool: string; allowed: boolean; reason?: string } | undefined;
      if (input.tool_name) {
        const result = rbacEngine.checkAccess(activeRole, input.tool_name);
        toolCheck = { tool: input.tool_name, ...result };
      }

      const response = {
        rbac_enabled: rbacEngine.isEnabled,
        active_role: activeRole,
        default_role: rbacEngine.roleDefault,
        role_source: input.role_override
          ? "role_override parameter"
          : process.env["SDD_ROLE"]
          ? "SDD_ROLE environment variable"
          : "config default_role",
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
          ? "Set SDD_ROLE=viewer|contributor|admin to control access. Configure rbac.default_role in .specky/config.yml."
          : "RBAC is disabled. Enable with rbac.enabled: true in .specky/config.yml.",
        learning_note:
          "RBAC is opt-in and defaults to disabled. When enabled, use SDD_ROLE env var to set the active role per process. Admin role is required for sdd_create_pr (release gate).",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
