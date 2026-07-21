/**
 * token-table.test.ts — identity-based HTTP auth (enterprise, opt-in):
 *   - tokens file maps bearer tokens (plaintext or sha256) to principal + role
 *   - loading is fail-closed (malformed file throws)
 *   - without a table, the legacy shared-token behavior is preserved
 */
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadTokenTable,
  resolveBearerIdentity,
  sha256Hex,
  type TokenTableEntry,
} from "../../src/utils/token-table.js";

let workspace: string;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), "specky-token-table-"));
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function writeTokensFile(name: string, content: string): string {
  const filePath = join(workspace, name);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("loadTokenTable", () => {
  it("loads plaintext and sha256 entries", () => {
    const sha = createHash("sha256").update("secret-token-abc").digest("hex");
    const file = writeTokensFile(
      "tokens.yml",
      [
        "tokens:",
        "  - principal: alice",
        "    role: admin",
        `    token_sha256: "${sha}"`,
        "  - principal: ci-bot",
        "    role: viewer",
        '    token: "plaintext-token"',
      ].join("\n") + "\n",
    );

    const table = loadTokenTable(file);
    expect(table).toHaveLength(2);
    expect(table[0]).toMatchObject({ principal: "alice", role: "admin", token_sha256: sha });
    expect(table[1]).toMatchObject({ principal: "ci-bot", role: "viewer" });
  });

  it("throws on malformed files (fail-closed)", () => {
    const missingRole = writeTokensFile(
      "bad-role.yml",
      'tokens:\n  - principal: alice\n    token: "plaintext-token"\n',
    );
    expect(() => loadTokenTable(missingRole)).toThrow(/Invalid tokens file/);

    const bothForms = writeTokensFile(
      "both-forms.yml",
      [
        "tokens:",
        "  - principal: alice",
        "    role: admin",
        '    token: "plaintext-token"',
        `    token_sha256: "${"a".repeat(64)}"`,
      ].join("\n") + "\n",
    );
    expect(() => loadTokenTable(bothForms)).toThrow(/exactly one of/);

    const empty = writeTokensFile("empty.yml", "tokens: []\n");
    expect(() => loadTokenTable(empty)).toThrow(/Invalid tokens file/);

    const shortToken = writeTokensFile(
      "short.yml",
      'tokens:\n  - principal: alice\n    role: admin\n    token: "short"\n',
    );
    expect(() => loadTokenTable(shortToken)).toThrow(/Invalid tokens file/);

    expect(() => loadTokenTable(join(workspace, "does-not-exist.yml"))).toThrow();
  });
});

describe("resolveBearerIdentity", () => {
  const table: TokenTableEntry[] = [
    { principal: "alice", role: "admin", token_sha256: sha256Hex("alice-secret-token") },
    { principal: "bob", role: "viewer", token: "bob-plaintext-token" },
  ];

  it("maps tokens to principal + role (sha256 and plaintext forms)", () => {
    expect(resolveBearerIdentity("Bearer alice-secret-token", table, "")).toEqual({
      authorized: true,
      principal: "alice",
      role: "admin",
    });
    expect(resolveBearerIdentity("Bearer bob-plaintext-token", table, "")).toEqual({
      authorized: true,
      principal: "bob",
      role: "viewer",
    });
  });

  it("rejects unknown tokens and missing headers when a table is configured", () => {
    expect(resolveBearerIdentity("Bearer wrong-token", table, "").authorized).toBe(false);
    expect(resolveBearerIdentity(undefined, table, "").authorized).toBe(false);
    expect(resolveBearerIdentity("Basic abc", table, "").authorized).toBe(false);
    // The shared token is ignored once a table exists (named identities only).
    expect(resolveBearerIdentity("Bearer shared-secret", table, "shared-secret").authorized).toBe(
      false,
    );
  });

  it("preserves legacy shared-token behavior without a table", () => {
    expect(resolveBearerIdentity("Bearer shared-secret", [], "shared-secret")).toEqual({
      authorized: true,
    });
    expect(resolveBearerIdentity("Bearer nope", [], "shared-secret").authorized).toBe(false);
    // No table, no shared token → auth disabled
    expect(resolveBearerIdentity(undefined, [], "").authorized).toBe(true);
  });
});
