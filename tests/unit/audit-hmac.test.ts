/**
 * audit-hmac.test.ts — tamper-evident audit trail (enterprise, opt-in):
 *   - entries are HMAC-signed when a key is configured
 *   - verifyChain detects modified entries even when the attacker recomputes
 *     the plain hash chain (the workspace-writer threat model)
 *   - fail-closed mode: a failed audit write throws instead of being swallowed
 *   - resolveAuditHmacKey reads the key from env or a key file
 */
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditLogger, resolveAuditHmacKey } from "../../src/services/audit-logger.js";

const KEY = "test-hmac-key-0123456789abcdef";

function auditPath(workspace: string): string {
  return join(workspace, ".specs", ".audit.jsonl");
}

function readLines(workspace: string): string[] {
  return readFileSync(auditPath(workspace), "utf8").trim().split("\n");
}

async function logOnce(logger: AuditLogger, summary: string): Promise<void> {
  await logger.log({
    timestamp: "2026-07-02T00:00:00.000Z",
    tool: "sdd_get_status",
    spec_dir: ".specs",
    result: "success",
    summary,
    previous_hash: logger.currentHash,
  });
}

describe("AuditLogger HMAC signing", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-audit-hmac-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("signs each entry and verifyChain validates chain + signatures", async () => {
    const logger = new AuditLogger(workspace, true, { hmacKey: KEY });
    expect(logger.isTamperEvident).toBe(true);

    await logOnce(logger, "first");
    await logOnce(logger, "second");

    const lines = readLines(workspace);
    for (const line of lines) {
      const entry = JSON.parse(line) as { hmac?: string };
      expect(entry.hmac).toMatch(/^[0-9a-f]{64}$/);
    }

    const result = await logger.verifyChain(".specs");
    expect(result.valid).toBe(true);
    expect(result.hmac_checked).toBe(true);
    expect(result.signed_entries).toBe(2);
    expect(result.total_entries).toBe(2);
  });

  it("detects a modified entry even when the attacker recomputes the hash chain", async () => {
    const logger = new AuditLogger(workspace, true, { hmacKey: KEY });
    await logOnce(logger, "first");
    await logOnce(logger, "second");

    // Attacker (workspace write access, no key): change entry 1, then rebuild
    // the previous_hash chain so the plain chain still verifies.
    const lines = readLines(workspace);
    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    first["summary"] = "TAMPERED";
    delete first["hmac"];
    // Re-sign with the WRONG key (attacker does not have the real one)
    const forgedBase = JSON.stringify(first);
    const forgedHmac = createHmac("sha256", "attacker-key").update(forgedBase).digest("hex");
    const forgedLine = `${forgedBase.slice(0, -1)},"hmac":"${forgedHmac}"}`;

    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    second["previous_hash"] = createHash("sha256").update(forgedLine).digest("hex");
    delete second["hmac"];
    const secondBase = JSON.stringify(second);
    const secondHmac = createHmac("sha256", "attacker-key").update(secondBase).digest("hex");
    const secondLine = `${secondBase.slice(0, -1)},"hmac":"${secondHmac}"}`;

    writeFileSync(auditPath(workspace), `${forgedLine}\n${secondLine}\n`, "utf8");

    // Without the key, the rewritten chain looks fine (this is exactly why
    // the HMAC exists).
    const withoutKey = new AuditLogger(workspace, true);
    const plain = await withoutKey.verifyChain(".specs");
    expect(plain.valid).toBe(true);
    expect(plain.hmac_checked).toBe(false);

    // With the key, both forged entries are flagged.
    const verified = await logger.verifyChain(".specs");
    expect(verified.valid).toBe(false);
    expect(verified.errors.some((e) => e.includes("hmac mismatch"))).toBe(true);
  });

  it("flags entries written without the key once a key is configured", async () => {
    const unsigned = new AuditLogger(workspace, true);
    await logOnce(unsigned, "pre-enterprise entry");

    const signed = new AuditLogger(workspace, true, { hmacKey: KEY });
    const result = await signed.verifyChain(".specs");
    expect(result.valid).toBe(false);
    expect(result.signed_entries).toBe(0);
    expect(result.errors[0]).toContain("missing hmac");
  });

  it("keeps the previous_hash chain verifiable by verifiers without the key", async () => {
    const logger = new AuditLogger(workspace, true, { hmacKey: KEY });
    await logOnce(logger, "first");
    await logOnce(logger, "second");

    const withoutKey = new AuditLogger(workspace, true);
    const result = await withoutKey.verifyChain(".specs");
    expect(result.valid).toBe(true);
    expect(result.hmac_checked).toBe(false);
    expect(result.signed_entries).toBe(2);
  });
});

describe("AuditLogger fail-closed mode", () => {
  it("throws when the audit file cannot be written", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "specky-audit-failclosed-"));
    try {
      // Make `.specs` a regular FILE so mkdir/append under it fails.
      writeFileSync(join(workspace, ".specs"), "not a directory", "utf8");

      const failClosed = new AuditLogger(workspace, true, { failClosed: true });
      expect(failClosed.isFailClosed).toBe(true);
      await expect(logOnce(failClosed, "boom")).rejects.toThrow(/fail-closed/);

      // Default (fail-open) swallows the same failure.
      const failOpen = new AuditLogger(workspace, true);
      await expect(logOnce(failOpen, "swallowed")).resolves.toBeUndefined();
    } finally {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("resolveAuditHmacKey", () => {
  it("prefers SDD_AUDIT_HMAC_KEY, falls back to key file, else empty", () => {
    const workspace = mkdtempSync(join(tmpdir(), "specky-hmac-key-"));
    try {
      const keyFile = join(workspace, "audit.key");
      writeFileSync(keyFile, "  file-key\n", "utf8");

      expect(resolveAuditHmacKey({ SDD_AUDIT_HMAC_KEY: "env-key" })).toBe("env-key");
      expect(
        resolveAuditHmacKey({ SDD_AUDIT_HMAC_KEY: "env-key", SDD_AUDIT_HMAC_KEY_FILE: keyFile }),
      ).toBe("env-key");
      expect(resolveAuditHmacKey({ SDD_AUDIT_HMAC_KEY_FILE: keyFile })).toBe("file-key");
      expect(resolveAuditHmacKey({})).toBe("");
      expect(
        resolveAuditHmacKey({ SDD_AUDIT_HMAC_KEY_FILE: join(workspace, "missing.key") }),
      ).toBe("");
    } finally {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
