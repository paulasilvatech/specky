import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogger } from "../../src/services/audit-logger.js";

const CHAIN_SEED = "specky-audit-v1";

describe("AuditLogger — concurrency & hardening (v3.12.0)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "specky-audit-conc-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  // ── Race fix: hash-chain integrity under concurrency ───────────

  it("keeps the hash chain intact after 20 concurrent log() calls", async () => {
    const logger = new AuditLogger(tempDir, true);
    const N = 20;

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        logger.logSuccess("sdd_write_spec", ".specs", "001", "spec", `concurrent-call-${i}`),
      ),
    );

    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    const lines = readFileSync(auditFile, "utf-8").trim().split("\n");

    // No lost writes: every distinct summary landed exactly once.
    expect(lines).toHaveLength(N);
    const summaries = lines.map((line) => (JSON.parse(line) as { summary: string }).summary).sort();
    expect(summaries).toEqual(Array.from({ length: N }, (_, i) => `concurrent-call-${i}`).sort());

    // Every previous_hash links to the SHA-256 of the exact line before it.
    let expectedPrevious = CHAIN_SEED;
    for (const line of lines) {
      const entry = JSON.parse(line) as { previous_hash: string };
      expect(entry.previous_hash).toBe(expectedPrevious);
      expectedPrevious = createHash("sha256").update(line).digest("hex");
    }
    expect(logger.currentHash).toBe(expectedPrevious);

    // ...and the built-in verifier agrees the chain is intact.
    const verification = await logger.verifyChain(".specs");
    expect(verification.valid).toBe(true);
    expect(verification.total_entries).toBe(N);
    expect(verification.errors).toEqual([]);
  });

  it("serializes concurrent loggers sharing one audit file", async () => {
    // Two logger instances (e.g. per-request construction) still share the
    // per-file lock, so their entries interleave without corrupting the chain.
    const loggerA = new AuditLogger(tempDir, true);
    const loggerB = new AuditLogger(tempDir, true);

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 === 0 ? loggerA : loggerB).logSuccess(
          "sdd_init",
          ".specs",
          "001",
          "init",
          `call-${i}`,
        ),
      ),
    );

    const verification = await loggerA.verifyChain(".specs");
    expect(verification.valid).toBe(true);
    expect(verification.total_entries).toBe(10);
    expect(verification.errors).toEqual([]);
  });

  // ── Fail-open write failures warn on stderr ────────────────────

  it("warns on stderr when a fail-open audit write fails (EISDIR)", async () => {
    // Force EISDIR: the audit file path is a directory.
    mkdirSync(join(tempDir, ".specs", ".audit.jsonl"), { recursive: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = new AuditLogger(tempDir, true); // fail-open (default)
    await expect(logger.logSuccess("sdd_init", ".specs")).resolves.toBeUndefined();

    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(messages.some((m) => m.includes("[specky]") && m.includes("Audit write failed"))).toBe(
      true,
    );
  });

  it("fail-closed mode still throws and does not emit the fail-open warning", async () => {
    mkdirSync(join(tempDir, ".specs", ".audit.jsonl"), { recursive: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = new AuditLogger(tempDir, true, { failClosed: true });
    await expect(logger.logSuccess("sdd_init", ".specs")).rejects.toThrow(/fail-closed/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ── Path traversal defense-in-depth ────────────────────────────

  it("rejects spec_dir values that escape the workspace root", async () => {
    const logger = new AuditLogger(tempDir, true);

    await expect(logger.logSuccess("sdd_init", "../outside")).rejects.toThrow(/escapes/);
    await expect(logger.verifyChain("../outside")).rejects.toThrow(/escapes/);

    // Absolute paths outside the workspace are rejected too.
    const outside = mkdtempSync(join(tmpdir(), "specky-audit-outside-"));
    try {
      await expect(logger.logSuccess("sdd_init", outside)).rejects.toThrow(/escapes/);
      expect(existsSync(join(outside, ".audit.jsonl"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }

    // The rejection throws even in fail-open mode (it is not an I/O failure).
    expect(existsSync(join(tempDir, ".specs", ".audit.jsonl"))).toBe(false);
  });

  it("still accepts ordinary nested spec dirs", async () => {
    const logger = new AuditLogger(tempDir, true);
    await logger.logSuccess("sdd_init", join(".specs", "001"), "001");
    expect(existsSync(join(tempDir, ".specs", "001", ".audit.jsonl"))).toBe(true);

    const verification = await logger.verifyChain(join(".specs", "001"));
    expect(verification.valid).toBe(true);
    expect(verification.total_entries).toBe(1);
  });
});
