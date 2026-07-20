/**
 * token-table.ts — named bearer tokens for the HTTP transport.
 *
 * Enterprise deployments map each token to an authenticated principal and an
 * RBAC role via a YAML file referenced by SDD_HTTP_TOKENS_FILE. The file must
 * live OUTSIDE the workspace (e.g. /etc/specky/tokens.yml, mode 0600) — the
 * whole point is that workspace writers cannot mint themselves a role.
 *
 *   tokens:
 *     - principal: alice
 *       role: admin
 *       token_sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
 *     - principal: ci-bot
 *       role: viewer
 *       token: "plaintext-also-works"   # sha256 form is recommended
 *
 * Loading is fail-closed: a configured file that is missing or malformed
 * throws, so the server refuses to start with broken auth instead of silently
 * accepting everyone.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import type { RbacRole } from "../services/rbac-engine.js";
import { isBearerAuthorized } from "./http-auth.js";

const tokenEntrySchema = z
  .object({
    principal: z.string().min(1),
    role: z.enum(["viewer", "contributor", "admin"]),
    token: z.string().min(8).optional(),
    token_sha256: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "token_sha256 must be a 64-char hex SHA-256")
      .optional(),
  })
  .strict()
  .refine((e) => Boolean(e.token) !== Boolean(e.token_sha256), {
    message: "each token entry needs exactly one of `token` or `token_sha256`",
  });

const tokenTableSchema = z
  .object({
    tokens: z.array(tokenEntrySchema).min(1),
  })
  .strict();

export type TokenTableEntry = z.infer<typeof tokenEntrySchema>;

export interface BearerIdentity {
  authorized: boolean;
  /** Set when the token table matched a named token. */
  principal?: string;
  /** Set when the token table matched a named token. */
  role?: RbacRole;
}

/**
 * Load and validate the tokens file. Throws on any problem — the caller must
 * treat a configured-but-broken tokens file as fatal (fail-closed).
 */
export function loadTokenTable(filePath: string): TokenTableEntry[] {
  const raw = readFileSync(filePath, "utf-8");
  const parsed: unknown = parse(raw) ?? {};
  const result = tokenTableSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid tokens file ${filePath}: ${result.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ")}`,
    );
  }
  return result.data.tokens;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Resolve the identity behind an Authorization header.
 *
 * - Token table configured → the presented token must match a named entry;
 *   returns its principal + role. The shared token is ignored in this mode
 *   (named identities only).
 * - Only SDD_HTTP_TOKEN configured → legacy single shared token; authorized
 *   requests get principal "shared-token" and no role (RBAC falls back to
 *   SDD_ROLE / default_role).
 * - Neither configured → authorized (auth disabled; loopback bind is the
 *   remaining guard).
 */
export function resolveBearerIdentity(
  authorizationHeader: string | undefined,
  table: readonly TokenTableEntry[],
  sharedToken: string,
): BearerIdentity {
  if (table.length === 0) {
    return { authorized: isBearerAuthorized(authorizationHeader, sharedToken) };
  }

  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) {
    return { authorized: false };
  }
  const presented = authorizationHeader.slice(prefix.length);
  const presentedSha = sha256Hex(presented);

  // Evaluate every entry (no early exit) to keep timing independent of match position.
  let matched: TokenTableEntry | undefined;
  for (const entry of table) {
    const hit = entry.token_sha256
      ? constantTimeEqual(presentedSha, entry.token_sha256.toLowerCase())
      : constantTimeEqual(presented, entry.token ?? "");
    if (hit && !matched) matched = entry;
  }

  if (!matched) return { authorized: false };
  return { authorized: true, principal: matched.principal, role: matched.role };
}
