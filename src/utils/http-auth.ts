/**
 * http-auth.ts — bearer-token check for the optional HTTP transport.
 * Extracted as a pure function so it can be unit-tested.
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Returns true if the request is authorized.
 * - When `token` is empty, auth is disabled and every request is authorized.
 * - Otherwise the Authorization header must be `Bearer <token>`, compared in
 *   constant time (the token length is not secret, so a length check first is
 *   acceptable and avoids timingSafeEqual's equal-length requirement throwing).
 */
export function isBearerAuthorized(
  authorizationHeader: string | undefined,
  token: string,
): boolean {
  if (!token) return true;
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return false;
  const presented = Buffer.from(authorizationHeader.slice(prefix.length));
  const expected = Buffer.from(token);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
