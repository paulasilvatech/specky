import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TOOL_NAMES } from "../constants.js";
import type { AuditLogger } from "../services/audit-logger.js";
import { specDirSchema } from "../schemas/common.js";

const verifyAuditInputSchema = z.object({
  spec_dir: specDirSchema,
}).strict();

export function registerAuditTools(
  server: McpServer,
  auditLogger: AuditLogger,
): void {
  server.registerTool(
    TOOL_NAMES.VERIFY_AUDIT,
    {
      title: "Verify Audit Trail",
      description:
        "Verifies the hash-chain integrity of the Specky audit log for a spec directory. When an HMAC key is configured (SDD_AUDIT_HMAC_KEY / SDD_AUDIT_HMAC_KEY_FILE), also verifies each entry's HMAC-SHA256 signature (tamper evidence). Returns whether the chain is valid, entry count, current hash, hmac_checked/signed_entries, and any mismatch errors.",
      inputSchema: verifyAuditInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ spec_dir }) => {
      const verification = await auditLogger.verifyChain(spec_dir);
      return {
        content: [{ type: "text", text: JSON.stringify(verification, null, 2) }],
      };
    },
  );
}
