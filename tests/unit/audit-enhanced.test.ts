import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuditLogger } from "../../src/services/audit-logger.js";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("AuditLogger — enhanced (v3.2.0)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "specky-audit-enh-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Hash chaining ──────────────────────────────────────────────

  it("first entry has previous_hash equal to the seed 'specky-audit-v1'", async () => {
    const logger = new AuditLogger(tempDir, true);
    await logger.logSuccess("sdd_init", ".specs", "001", "init");
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    const line = readFileSync(auditFile, "utf-8").trim();
    const entry = JSON.parse(line);
    expect(entry.previous_hash).toBe("specky-audit-v1");
  });

  it("second entry's previous_hash equals SHA-256 of the first line", async () => {
    const logger = new AuditLogger(tempDir, true);
    await logger.logSuccess("sdd_init", ".specs");
    await logger.logSuccess("sdd_write_spec", ".specs");
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    const lines = readFileSync(auditFile, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const firstLine = lines[0];
    const secondEntry = JSON.parse(lines[1]);
    const expectedHash = createHash("sha256").update(firstLine).digest("hex");
    expect(secondEntry.previous_hash).toBe(expectedHash);
  });

  it("currentHash advances after each log call", async () => {
    const logger = new AuditLogger(tempDir, true);
    const hashBefore = logger.currentHash;
    await logger.logSuccess("sdd_init", ".specs");
    const hashAfter = logger.currentHash;
    expect(hashBefore).not.toBe(hashAfter);
  });

  it("resetChain resets currentHash to the seed", async () => {
    const logger = new AuditLogger(tempDir, true);
    await logger.logSuccess("sdd_init", ".specs");
    logger.resetChain();
    expect(logger.currentHash).toBe("specky-audit-v1");
  });

  it("does NOT write anything when disabled (hash chain still advances in memory only)", async () => {
    const logger = new AuditLogger(tempDir, false);
    await logger.logSuccess("sdd_init", ".specs");
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    expect(existsSync(auditFile)).toBe(false);
    // currentHash stays at seed when logger is disabled (no entries written)
    expect(logger.currentHash).toBe("specky-audit-v1");
  });

  // ── Log rotation ───────────────────────────────────────────────

  it("rotates log file when size exceeds max_file_size_mb", async () => {
    // Use 0.0001 MB threshold (~100 bytes) so any entry triggers rotation
    const logger = new AuditLogger(tempDir, true, "jsonl", 0.0001);
    const specDir = join(tempDir, ".specs");
    mkdirSync(specDir, { recursive: true });
    const auditFile = join(specDir, ".audit.jsonl");

    // Pre-populate the file to exceed threshold
    writeFileSync(auditFile, "x".repeat(200));

    await logger.logSuccess("sdd_init", ".specs");

    // Rotated file should exist
    expect(existsSync(`${auditFile}.1`)).toBe(true);
    // New audit file should contain only the new entry
    const content = readFileSync(auditFile, "utf-8");
    expect(content).toContain("sdd_init");
  });

  it("does not rotate when file is below threshold", async () => {
    const logger = new AuditLogger(tempDir, true, "jsonl", 100);
    await logger.logSuccess("sdd_init", ".specs");
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    expect(existsSync(`${auditFile}.1`)).toBe(false);
  });

  // ── Syslog format ──────────────────────────────────────────────

  it("writes RFC 5424 syslog line to .audit.syslog when format is syslog", async () => {
    const logger = new AuditLogger(tempDir, true, "syslog");
    await logger.logSuccess("sdd_init", ".specs", "001", "init", "success summary");
    const syslogFile = join(tempDir, ".specs", ".audit.syslog");
    expect(existsSync(syslogFile)).toBe(true);
    const content = readFileSync(syslogFile, "utf-8");
    // RFC 5424 starts with <PRI>1
    expect(content).toMatch(/^<\d+>1 /);
    expect(content).toContain("sdd_init");
  });

  it("syslog format also writes jsonl copy", async () => {
    const logger = new AuditLogger(tempDir, true, "syslog");
    await logger.logSuccess("sdd_write_spec", ".specs");
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    expect(existsSync(auditFile)).toBe(true);
  });

  it("syslog uses severity 6 (info) for success entries", async () => {
    const logger = new AuditLogger(tempDir, true, "syslog");
    await logger.logSuccess("sdd_init", ".specs");
    const syslogFile = join(tempDir, ".specs", ".audit.syslog");
    const content = readFileSync(syslogFile, "utf-8");
    // facility=1, severity=6 → PRI = 1*8+6 = 14
    expect(content).toMatch(/^<14>/);
  });

  it("syslog uses severity 3 (error) for error entries", async () => {
    const logger = new AuditLogger(tempDir, true, "syslog");
    await logger.logError("sdd_write_spec", ".specs", "001", "something failed");
    const syslogFile = join(tempDir, ".specs", ".audit.syslog");
    const content = readFileSync(syslogFile, "utf-8");
    // facility=1, severity=3 → PRI = 1*8+3 = 11
    expect(content).toMatch(/^<11>/);
  });

  // ── OTLP stub ──────────────────────────────────────────────────

  it("OTLP format still writes jsonl and logs a console.error placeholder", async () => {
    const stderrMessages: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => stderrMessages.push(String(args[0]));

    const logger = new AuditLogger(tempDir, true, "otlp");
    await logger.logSuccess("sdd_init", ".specs");

    console.error = originalError;

    expect(stderrMessages.some((m) => m.includes("OTLP"))).toBe(true);
    const auditFile = join(tempDir, ".specs", ".audit.jsonl");
    expect(existsSync(auditFile)).toBe(true);
  });
});
