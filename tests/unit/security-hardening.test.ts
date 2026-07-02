/**
 * security-hardening.test.ts — locks the Batch 3 defensive changes:
 *   - spec_dir rejects absolute paths and traversal
 *   - .specky/config.yml parses real YAML, validates, and refuses an escaping
 *     templates_path
 *   - the installer's pre-authorized allow-list stays least-privilege
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specDirSchema } from "../../src/schemas/common.js";
import { loadConfig } from "../../src/config.js";
import { SPECKY_REQUIRED_ALLOWS } from "../../src/cli/lib/settings-merger.js";

describe("specDirSchema traversal guard", () => {
  it("accepts workspace-relative paths", () => {
    expect(specDirSchema.safeParse(".specs").success).toBe(true);
    expect(specDirSchema.safeParse("nested/specs").success).toBe(true);
    expect(specDirSchema.parse(undefined)).toBe(".specs"); // default
  });

  it("rejects absolute paths and parent traversal", () => {
    expect(specDirSchema.safeParse("/etc").success).toBe(false);
    expect(specDirSchema.safeParse("../../etc").success).toBe(false);
    expect(specDirSchema.safeParse("a/../../b").success).toBe(false);
    expect(specDirSchema.safeParse("C:/Windows").success).toBe(false);
    expect(specDirSchema.safeParse("bad\0byte").success).toBe(false);
  });
});

describe("loadConfig (.specky/config.yml)", () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-config-"));
    mkdirSync(resolve(ws, ".specky"), { recursive: true });
  });
  afterEach(() => rmSync(ws, { recursive: true, force: true }));

  const write = (yaml: string): void =>
    writeFileSync(resolve(ws, ".specky", "config.yml"), yaml, "utf8");

  it("parses nested YAML with real types", () => {
    write("audit_enabled: true\nrate_limit:\n  enabled: true\n  max_requests_per_minute: 120\n");
    const cfg = loadConfig(ws);
    expect(cfg.audit_enabled).toBe(true);
    expect(cfg.rate_limit.enabled).toBe(true);
    expect(cfg.rate_limit.max_requests_per_minute).toBe(120);
    expect(cfg.rate_limit.burst).toBe(10); // default fills the gap
  });

  it("returns defaults when the file is absent", () => {
    const cfg = loadConfig(ws);
    expect(cfg.audit_enabled).toBe(false);
    expect(cfg.default_framework).toBe("vitest");
  });

  it("refuses an escaping templates_path and falls back to defaults", () => {
    write("templates_path: ../../../../etc\n");
    const cfg = loadConfig(ws);
    expect(cfg.templates_path).toBe(""); // rejected → default, not the escape
  });

  it("accepts a workspace-relative templates_path", () => {
    write("templates_path: my-templates\n");
    expect(loadConfig(ws).templates_path).toBe("my-templates");
  });
});

describe("installer pre-authorization is least-privilege", () => {
  it("does not pre-authorize arbitrary code execution or network egress", () => {
    for (const dangerous of [
      "Bash(bash:*)", "Bash(sh:*)", "Bash(node:*)", "Bash(python:*)",
      "Bash(python3:*)", "Bash(rm:*)", "Bash(chmod:*)", "WebFetch", "WebSearch",
    ]) {
      expect(SPECKY_REQUIRED_ALLOWS, `must not pre-authorize ${dangerous}`).not.toContain(dangerous);
    }
  });

  it("still grants the scoped commands the SDD flow needs", () => {
    for (const needed of ["Read", "Grep", "Edit", "Write", "Bash(git:*)", "Bash(npm:*)", "mcp__specky__*"]) {
      expect(SPECKY_REQUIRED_ALLOWS).toContain(needed);
    }
  });
});
