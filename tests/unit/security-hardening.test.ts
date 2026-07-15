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
import {
  createWorkspaceConfig,
  loadConfig,
  serializeWorkspaceConfig,
} from "../../src/config.js";
import { FileManager } from "../../src/services/file-manager.js";
import { requiredClaudeAllows } from "../../src/cli/lib/settings-merger.js";

describe("specDirSchema traversal guard", () => {
  it("accepts workspace-relative paths", () => {
    expect(specDirSchema.safeParse(".specs").success).toBe(true);
    expect(specDirSchema.safeParse("nested/specs").success).toBe(true);
    expect(specDirSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects absolute paths and parent traversal", () => {
    expect(specDirSchema.safeParse("/etc").success).toBe(false);
    expect(specDirSchema.safeParse("../../etc").success).toBe(false);
    expect(specDirSchema.safeParse("a/../../b").success).toBe(false);
    expect(specDirSchema.safeParse("C:/Windows").success).toBe(false);
    expect(specDirSchema.safeParse("bad\0byte").success).toBe(false);
  });
});

describe("FileManager.sanitizePath is absolute-path-safe on every OS", () => {
  const fm = new FileManager(mkdtempSync(resolve(tmpdir(), "specky-fm-guard-")));

  it("accepts workspace-relative paths", () => {
    expect(() => fm.sanitizePath("docs/input.md")).not.toThrow();
    expect(() => fm.sanitizePath(".specs")).not.toThrow();
  });

  it("rejects Windows drive-absolute paths regardless of runtime OS", () => {
    // Regression: the guard only checked "/" and "\\" prefixes, so "C:\\…"
    // slipped through on Windows (and would on POSIX too). This asserts the
    // fix on every platform, not just Windows CI.
    expect(() => fm.sanitizePath("C:\\Windows\\System32")).toThrow("Absolute paths are not allowed");
    expect(() => fm.sanitizePath("C:/Windows/System32")).toThrow("Absolute paths are not allowed");
    expect(() => fm.sanitizePath("d:relative")).toThrow("Absolute paths are not allowed");
  });

  it("rejects POSIX-absolute, UNC, and traversal paths", () => {
    expect(() => fm.sanitizePath("/etc/passwd")).toThrow("Absolute paths are not allowed");
    expect(() => fm.sanitizePath("\\\\server\\share")).toThrow("Absolute paths are not allowed");
    expect(() => fm.sanitizePath("../outside.md")).toThrow("Path traversal is not allowed");
  });
});

describe("loadConfig (.specky/config.yml)", () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), "specky-config-"));
    mkdirSync(resolve(ws, ".specky"), { recursive: true });
  });
  afterEach(() => rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  const write = (yaml: string): void =>
    writeFileSync(resolve(ws, ".specky", "config.yml"), yaml, "utf8");

  it("parses nested YAML with real types", () => {
    const config = createWorkspaceConfig();
    config.audit_enabled = true;
    config.rate_limit.enabled = true;
    config.rate_limit.max_requests_per_minute = 120;
    write(serializeWorkspaceConfig(config));
    const cfg = loadConfig(ws);
    expect(cfg.audit_enabled).toBe(true);
    expect(cfg.rate_limit.enabled).toBe(true);
    expect(cfg.rate_limit.max_requests_per_minute).toBe(120);
    expect(cfg.rate_limit.burst).toBe(10);
  });

  it("returns defaults when the file is absent", () => {
    const cfg = loadConfig(ws);
    expect(cfg.audit_enabled).toBe(false);
    expect(cfg.contracts.require_explicit_selection).toBe(true);
  });

  it("refuses an escaping templates_path without falling back", () => {
    const valid = serializeWorkspaceConfig(createWorkspaceConfig());
    write(valid.replace('templates_path: ""', "templates_path: ../../../../etc"));
    expect(() => loadConfig(ws)).toThrow(/workspace-relative/);
  });

  it("accepts a workspace-relative templates_path", () => {
    const config = createWorkspaceConfig();
    config.templates_path = "my-templates";
    write(serializeWorkspaceConfig(config));
    expect(loadConfig(ws).templates_path).toBe("my-templates");
  });

  it("rejects partial and unknown workspace configuration", () => {
    write("profile: standard\n");
    expect(() => loadConfig(ws)).toThrow(/version: Invalid input/);

    write(serializeWorkspaceConfig(createWorkspaceConfig()) + "unexpected: true\n");
    expect(() => loadConfig(ws)).toThrow(/Unrecognized key/);
  });
});

describe("installer pre-authorization is least-privilege", () => {
  const capabilities = [
    "workspace.read",
    "workspace.edit",
    "workspace.command.git",
    "workspace.command.test",
    "workspace.command.release-gates",
    "mcp.specky.sdd_get_status",
    "mcp.github.create_pull_request",
  ] as const;

  it("does not pre-authorize arbitrary code execution or network egress", () => {
    const allows = requiredClaudeAllows(capabilities, {
      profile: "scoped",
      workspace: wsForPermissions(),
      integrations: ["github"],
    });
    for (const dangerous of [
      "Bash(bash:*)", "Bash(sh:*)", "Bash(node:*)", "Bash(python:*)",
      "Bash(python3:*)", "Bash(rm:*)", "Bash(chmod:*)", "WebFetch", "WebSearch",
    ]) {
      expect(allows, `must not pre-authorize ${dangerous}`).not.toContain(dangerous);
    }
  });

  it("still grants the scoped commands the SDD flow needs", () => {
    const allows = requiredClaudeAllows(capabilities, {
      profile: "scoped",
      workspace: wsForPermissions(),
      integrations: ["github"],
    });
    for (const needed of ["Read", "Grep", "Edit", "Write", "Bash(git:*)", "Bash(npm:*)", "mcp__specky__sdd_get_status", "mcp__github__create_pull_request"]) {
      expect(allows).toContain(needed);
    }
  });

  it("leaves all permissions to host confirmation in the prompt profile", () => {
    expect(requiredClaudeAllows(capabilities, {
      profile: "prompt",
      workspace: wsForPermissions(),
      integrations: ["github"],
    })).toEqual([]);
  });
});

function wsForPermissions(): string {
  return mkdtempSync(resolve(tmpdir(), "specky-permission-profile-"));
}
