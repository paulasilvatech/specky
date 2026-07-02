/**
 * http-auth.test.ts — the optional HTTP bearer-token gate.
 */
import { describe, expect, it } from "vitest";
import { isBearerAuthorized } from "../../src/utils/http-auth.js";

describe("isBearerAuthorized", () => {
  it("is disabled (authorizes everything) when no token is configured", () => {
    expect(isBearerAuthorized(undefined, "")).toBe(true);
    expect(isBearerAuthorized("Bearer anything", "")).toBe(true);
  });

  it("authorizes only the exact bearer token", () => {
    expect(isBearerAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isBearerAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isBearerAuthorized("Bearer s3cre", "s3cret")).toBe(false); // shorter
    expect(isBearerAuthorized("Bearer s3crett", "s3cret")).toBe(false); // longer
  });

  it("rejects missing or malformed headers when a token is required", () => {
    expect(isBearerAuthorized(undefined, "s3cret")).toBe(false);
    expect(isBearerAuthorized("", "s3cret")).toBe(false);
    expect(isBearerAuthorized("s3cret", "s3cret")).toBe(false); // no "Bearer " prefix
    expect(isBearerAuthorized("Basic s3cret", "s3cret")).toBe(false);
  });
});
