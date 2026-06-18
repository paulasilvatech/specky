/**
 * RbacEngine — Role-Based Access Control for Specky MCP tools.
 * All new features are opt-in via rbac.enabled=true in .specky/config.yml.
 * Default behavior (enabled=false): all tools allowed for all callers.
 *
 * Roles:
 *   viewer      — Read-only tools only (status, context, routing, metrics, templates)
 *   contributor — All tools except release-gate tools (sdd_create_pr)
 *   admin       — All tools
 */

export type RbacRole = "viewer" | "contributor" | "admin";

/**
 * Tools accessible to the viewer role (read-only operations).
 * These tools query state or generate content without modifying spec artifacts.
 */
const VIEWER_TOOLS: readonly string[] = [
  "sdd_get_status",
  "sdd_get_template",
  "sdd_model_routing",
  "sdd_context_status",
  "sdd_metrics",
  "sdd_detect_drift",
  "sdd_check_ecosystem",
  "sdd_list_checkpoints",
  "sdd_check_access",
  "sdd_verify_audit",
] as const;

/**
 * Tools blocked for contributor role (release-gate protection).
 * Contributors can do everything except trigger production releases.
 */
const BLOCKED_FOR_CONTRIBUTOR: readonly string[] = [
  "sdd_create_pr",
] as const;

export class RbacEngine {
  static readonly VIEWER_TOOLS = VIEWER_TOOLS;
  static readonly BLOCKED_FOR_CONTRIBUTOR = BLOCKED_FOR_CONTRIBUTOR;

  constructor(
    private readonly enabled: boolean,
    private readonly defaultRole: RbacRole,
  ) {}

  /**
   * Check whether a given role may invoke a specific tool.
   * When RBAC is disabled, always returns allowed:true.
   */
  checkAccess(
    role: RbacRole,
    toolName: string,
  ): { allowed: boolean; reason?: string } {
    if (!this.enabled) {
      return { allowed: true };
    }

    switch (role) {
      case "admin":
        return { allowed: true };

      case "contributor":
        if (BLOCKED_FOR_CONTRIBUTOR.includes(toolName)) {
          return {
            allowed: false,
            reason: `Tool "${toolName}" requires admin role. Contributors cannot trigger releases.`,
          };
        }
        return { allowed: true };

      case "viewer":
        if (VIEWER_TOOLS.includes(toolName)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Tool "${toolName}" requires contributor or admin role. Viewer role has read-only access.`,
        };

      default: {
        const exhaustive: never = role;
        return {
          allowed: false,
          reason: `Unknown role "${exhaustive as string}". Valid roles: viewer, contributor, admin.`,
        };
      }
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get roleDefault(): RbacRole {
    return this.defaultRole;
  }
}
