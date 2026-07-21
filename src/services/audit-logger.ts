/**
 * AuditLogger — Enterprise audit trail for SDD tool calls.
 * Appends JSONL entries to .specs/NNN/.audit.jsonl when audit_enabled=true.
 *
 * v3.2.0 enhancements:
 *   - Hash-chaining: each entry includes SHA-256 hash of the previous entry line
 *   - Log rotation: when file exceeds max_file_size_mb, rotates to .audit.jsonl.1
 *   - Export formats: jsonl (default), syslog (RFC 5424), otlp (stub)
 *
 * v3.5.0 enterprise enhancements (all opt-in):
 *   - Tamper evidence: when an HMAC key is provided (SDD_AUDIT_HMAC_KEY or
 *     SDD_AUDIT_HMAC_KEY_FILE — held OUTSIDE the workspace), every entry is
 *     signed with HMAC-SHA256 over its serialized form (which includes
 *     previous_hash, chaining the signatures). A workspace-writing attacker
 *     can recompute the plain hash chain but cannot forge HMACs without the
 *     key. Truncation of the log tail is NOT detectable by the chain alone —
 *     anchor `current_hash` externally (e.g. in CI logs) to close that gap.
 *   - Fail-closed: when enabled, a failed audit write throws instead of being
 *     swallowed, so the enforcement layer can refuse to run unaudited tools.
 *
 * v3.12.0 hardening:
 *   - Per-file async write lock: concurrent log() calls serialize their whole
 *     read-tail → rotate → append cycle, so two callers can no longer read the
 *     same chain tail and append entries with duplicate previous_hash values.
 *   - Fail-open write failures warn on stderr instead of being silently
 *     swallowed (fail-closed still throws, unchanged).
 *   - resolveAuditFile rejects spec_dir values that escape the workspace root.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export interface AuditEntry {
  timestamp: string;
  tool: string;
  spec_dir: string;
  feature_number?: string;
  phase?: string;
  role?: string;
  /** Authenticated identity (HTTP token principal) or local fallback. */
  principal?: string;
  result: "success" | "error";
  summary?: string;
  input_hash?: string;
  output_hash?: string;
  previous_hash: string;
  /** HMAC-SHA256 signature — present only when an HMAC key is configured. */
  hmac?: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  audit_file_exists: boolean;
  total_entries: number;
  current_hash: string;
  errors: string[];
  /** True when an HMAC key was available and used for verification. */
  hmac_checked: boolean;
  /** Entries carrying an hmac field (signed entries). */
  signed_entries: number;
}

export interface AuditLoggerOptions {
  exportFormat?: "jsonl" | "syslog" | "otlp";
  maxFileSizeMb?: number;
  /** Secret for HMAC-SHA256 tamper evidence. Empty string disables signing. */
  hmacKey?: string;
  /** When true, a failed audit write throws (enforcement then denies the call). */
  failClosed?: boolean;
}

/** Seed value for the first entry's previous_hash field */
const CHAIN_SEED = "specky-audit-v1";

/** Max rotated log files to keep */
const MAX_ROTATIONS = 3;

/**
 * Resolve the audit HMAC key from the environment: SDD_AUDIT_HMAC_KEY wins,
 * else SDD_AUDIT_HMAC_KEY_FILE is read (trimmed). Returns "" when unset so the
 * feature stays off. The key file should live OUTSIDE the workspace with 0600
 * permissions — a key readable/writable from the workspace defeats the purpose.
 */
export function resolveAuditHmacKey(env: Record<string, string | undefined> = process.env): string {
  const direct = env["SDD_AUDIT_HMAC_KEY"];
  if (direct?.trim()) return direct.trim();

  const keyFile = env["SDD_AUDIT_HMAC_KEY_FILE"];
  if (keyFile?.trim()) {
    try {
      const key = readFileSync(keyFile.trim(), "utf-8").trim();
      if (key) return key;
      console.error(`[specky] Audit HMAC key file is empty: ${keyFile}`);
    } catch (err) {
      console.error(
        `[specky] Cannot read SDD_AUDIT_HMAC_KEY_FILE (${keyFile}): ${(err as Error).message}`,
      );
    }
  }
  return "";
}

/** HMAC-SHA256 over the serialized entry (without its hmac field). */
function signLine(baseLine: string, key: string): string {
  return createHmac("sha256", key).update(baseLine).digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export class AuditLogger {
  private lastHash: string = CHAIN_SEED;
  private readonly exportFormat: "jsonl" | "syslog" | "otlp";
  private readonly maxFileSizeMb: number;
  private readonly hmacKey: string;
  private readonly failClosed: boolean;

  constructor(
    private workspaceRoot: string,
    private enabled: boolean,
    exportFormatOrOptions: AuditLoggerOptions | "jsonl" | "syslog" | "otlp" = {},
    maxFileSizeMb: number = 10,
  ) {
    // Back-compat: the pre-3.5 signature was (root, enabled, exportFormat, maxFileSizeMb).
    const options: AuditLoggerOptions =
      typeof exportFormatOrOptions === "string"
        ? { exportFormat: exportFormatOrOptions, maxFileSizeMb }
        : exportFormatOrOptions;
    this.exportFormat = options.exportFormat ?? "jsonl";
    this.maxFileSizeMb = options.maxFileSizeMb ?? 10;
    this.hmacKey = options.hmacKey ?? "";
    this.failClosed = options.failClosed ?? false;
  }

  /** True when entries are signed (an HMAC key is configured). */
  get isTamperEvident(): boolean {
    return this.hmacKey.length > 0;
  }

  /** True when audit-write failures propagate instead of being swallowed. */
  get isFailClosed(): boolean {
    return this.failClosed;
  }

  /**
   * Per-audit-file serialization queue. Tool handlers can run concurrently (a
   * client pipelines requests, or HTTP mode fields parallel callers); without
   * this, two log() calls both read the same chain tail and append entries
   * with duplicate previous_hash values, corrupting the hash chain. The whole
   * read-hash → rotate → append cycle below runs inside withLock so it is
   * atomic per audit file. Mirrors StateMachine.withLock.
   */
  private static readonly locks = new Map<string, Promise<unknown>>();

  private withLock<T>(auditFile: string, fn: () => Promise<T>): Promise<T> {
    const key = resolve(auditFile);
    const prev = AuditLogger.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    // Keep the chain alive regardless of individual success/failure.
    AuditLogger.locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  /**
   * Log a tool call to the audit file.
   * No-ops when disabled. By default never throws — audit failures must not
   * break tool calls. In fail-closed mode the error propagates so the
   * enforcement wrapper can refuse to execute unaudited work.
   */
  async log(entry: AuditEntry): Promise<void> {
    if (!this.enabled) return;

    // Resolve outside the failure-tolerant zone: a path-traversal rejection is
    // a caller bug (or attack), not an I/O failure — it throws in both modes.
    const auditFile = this.resolveAuditFile(entry.spec_dir, entry.feature_number);

    await this.withLock(auditFile, async () => {
      try {
        await mkdir(dirname(auditFile), { recursive: true });

        // Rotate if needed before appending
        await this.rotateIfNeeded(auditFile);

        entry.previous_hash = await this.readCurrentChainHash(auditFile);

        // Serialize without hmac, sign, then append the signature as the final
        // field by string surgery — verification can strip it back off without
        // depending on JSON key-order round-trips.
        delete entry.hmac;
        const baseLine = JSON.stringify(entry);
        const signedLine = this.hmacKey
          ? `${baseLine.slice(0, -1)},"hmac":"${signLine(baseLine, this.hmacKey)}"}`
          : baseLine;
        const line = signedLine + "\n";

        if (this.exportFormat === "syslog") {
          await this.appendSyslog(auditFile, entry, line);
        } else if (this.exportFormat === "otlp") {
          console.error("[specky] OTLP export not yet implemented");
          await appendFile(auditFile, line, "utf-8");
        } else {
          await appendFile(auditFile, line, "utf-8");
        }

        // Advance chain: hash of the line just written
        this.lastHash = createHash("sha256").update(line.trimEnd()).digest("hex");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (this.failClosed) {
          throw new Error(`Audit write failed (fail-closed mode): ${message}`);
        }
        // Audit failures must never break the tool call — warn and drop the entry.
        console.error(
          `[specky] Audit write failed for ${auditFile}: ${message} (fail-open mode; entry dropped)`,
        );
      }
    });
  }

  /** Convenience: log a successful tool call */
  async logSuccess(
    tool: string,
    specDir: string,
    featureNumber?: string,
    phase?: string,
    summary?: string,
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      tool,
      spec_dir: specDir,
      feature_number: featureNumber,
      phase,
      result: "success",
      summary,
      previous_hash: this.lastHash,
    });
  }

  /** Convenience: log a failed tool call */
  async logError(
    tool: string,
    specDir: string,
    featureNumber?: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      tool,
      spec_dir: specDir,
      feature_number: featureNumber,
      result: "error",
      summary: errorMessage,
      previous_hash: this.lastHash,
    });
  }

  /** Expose current chain hash (for testing and external verification) */
  get currentHash(): string {
    return this.lastHash;
  }

  /** Reset chain hash (for testing) */
  resetChain(): void {
    this.lastHash = CHAIN_SEED;
  }

  /**
   * Verify audit integrity for an audit file: always checks the previous_hash
   * chain; additionally verifies HMAC signatures when a key is configured.
   * With the key, a rewritten/reordered log is detected even if the attacker
   * recomputed the plain hash chain.
   */
  async verifyChain(specDir: string): Promise<AuditVerificationResult> {
    const auditFile = this.resolveAuditFile(specDir);
    const hmacChecked = this.hmacKey.length > 0;
    try {
      const raw = await readFile(auditFile, "utf-8");
      const lines = raw.split("\n").filter((line) => line.trim().length > 0);
      const errors: string[] = [];
      let expectedPreviousHash = CHAIN_SEED;
      let currentHash = CHAIN_SEED;
      let signedEntries = 0;

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        let entry: Partial<AuditEntry>;
        try {
          entry = JSON.parse(line) as Partial<AuditEntry>;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Line ${index + 1}: invalid JSON (${message})`);
          continue;
        }

        if (entry.previous_hash !== expectedPreviousHash) {
          errors.push(`Line ${index + 1}: previous_hash mismatch`);
        }

        if (typeof entry.hmac === "string") signedEntries++;

        if (hmacChecked) {
          const hmacError = this.verifyLineHmac(line, entry, index + 1);
          if (hmacError) errors.push(hmacError);
        }

        currentHash = createHash("sha256").update(line).digest("hex");
        expectedPreviousHash = currentHash;
      }

      return {
        valid: errors.length === 0,
        audit_file_exists: true,
        total_entries: lines.length,
        current_hash: currentHash,
        errors,
        hmac_checked: hmacChecked,
        signed_entries: signedEntries,
      };
    } catch {
      return {
        valid: true,
        audit_file_exists: false,
        total_entries: 0,
        current_hash: CHAIN_SEED,
        errors: [],
        hmac_checked: hmacChecked,
        signed_entries: 0,
      };
    }
  }

  /** Check one line's HMAC. Returns an error string or null when valid. */
  private verifyLineHmac(
    line: string,
    entry: Partial<AuditEntry>,
    lineNumber: number,
  ): string | null {
    if (typeof entry.hmac !== "string") {
      return `Line ${lineNumber}: missing hmac (entry written without the signing key)`;
    }
    // The writer appends `,"hmac":"<hex>"}` as the final field; strip it to
    // recover the exact signed serialization.
    const marker = `,"hmac":"`;
    const markerIndex = line.lastIndexOf(marker);
    if (markerIndex === -1 || !line.endsWith(`"}`)) {
      return `Line ${lineNumber}: hmac field is not in canonical position`;
    }
    const baseLine = line.slice(0, markerIndex) + "}";
    const expected = signLine(baseLine, this.hmacKey);
    if (!constantTimeEqualHex(entry.hmac, expected)) {
      return `Line ${lineNumber}: hmac mismatch (entry modified or signed with a different key)`;
    }
    return null;
  }

  private resolveAuditFile(specDir: string, _featureNumber?: string): string {
    // Defense-in-depth: the spec_dir zod schema already rejects ".." and
    // absolute paths, but this path decides where we write — never trust a
    // single layer. Refuse anything that resolves outside the workspace root.
    const root = resolve(this.workspaceRoot);
    const resolvedDir = resolve(root, specDir);
    if (resolvedDir !== root && !resolvedDir.startsWith(root + sep)) {
      throw new Error(`Audit spec_dir escapes the workspace root: ${JSON.stringify(specDir)}`);
    }
    return join(this.workspaceRoot, specDir, ".audit.jsonl");
  }

  /** Read the hash of the current last audit entry from disk. */
  private async readCurrentChainHash(auditFile: string): Promise<string> {
    try {
      const raw = await readFile(auditFile, "utf-8");
      const lines = raw.split("\n").filter((line) => line.trim().length > 0);
      const lastLine = lines.at(-1);
      if (!lastLine) return CHAIN_SEED;
      const hash = createHash("sha256").update(lastLine).digest("hex");
      this.lastHash = hash;
      return hash;
    } catch {
      this.lastHash = CHAIN_SEED;
      return CHAIN_SEED;
    }
  }

  /** Rotate log files when size exceeds threshold */
  private async rotateIfNeeded(auditFile: string): Promise<void> {
    try {
      const fileStat = await stat(auditFile);
      const thresholdBytes = this.maxFileSizeMb * 1024 * 1024;
      if (fileStat.size <= thresholdBytes) return;

      // Rotate: .audit.jsonl.2 → .audit.jsonl.3, .1 → .2, current → .1
      for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
        const older = `${auditFile}.${i + 1}`;
        const newer = `${auditFile}.${i}`;
        try {
          await unlink(older);
        } catch {
          // file may not exist — ignore
        }
        try {
          await rename(newer, older);
        } catch {
          // file may not exist — ignore
        }
      }
      await rename(auditFile, `${auditFile}.1`);
    } catch {
      // File doesn't exist yet — nothing to rotate
    }
  }

  /** Write RFC 5424 syslog format to a parallel .audit.syslog file */
  private async appendSyslog(
    jsonlFile: string,
    entry: AuditEntry,
    jsonLine: string,
  ): Promise<void> {
    const syslogFile = jsonlFile.replace(".audit.jsonl", ".audit.syslog");
    // RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
    // PRI = facility(1=user) * 8 + severity(6=info, 3=error)
    const severity = entry.result === "error" ? 3 : 6;
    const pri = 1 * 8 + severity;
    const hostname = "specky";
    const appName = "specky-sdd";
    const procId = process.pid;
    const msgId = entry.tool;
    const msg = entry.summary ?? entry.result;
    const syslogLine = `<${pri}>1 ${entry.timestamp} ${hostname} ${appName} ${procId} ${msgId} - ${msg}\n`;

    await appendFile(syslogFile, syslogLine, "utf-8");
    // Also keep JSONL copy
    await appendFile(jsonlFile, jsonLine, "utf-8");
  }
}
