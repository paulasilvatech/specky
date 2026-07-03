/**
 * config-profile.test.ts — the enterprise profile is strictly opt-in:
 *   - standard profile (the default) keeps every control OFF
 *   - enterprise flips the DEFAULTS of audit/rbac/rate-limit/fail-closed to ON
 *   - an explicit value in config.yml always wins over the profile default
 *   - the profile can be forced from outside the workspace (flag/env)
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, resolveProfile } from "../../src/config.js";

const NO_OVERRIDES = { argv: [] as string[], env: {} as Record<string, string> };

describe("profile resolution and enterprise defaults", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-config-profile-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function writeConfig(yaml: string): void {
    mkdirSync(join(workspace, ".specky"), { recursive: true });
    writeFileSync(join(workspace, ".specky", "config.yml"), yaml, "utf-8");
  }

  it("standard profile keeps every enterprise control off by default", () => {
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.profile).toBe("standard");
    expect(config.audit_enabled).toBe(false);
    expect(config.rbac.enabled).toBe(false);
    expect(config.rate_limit.enabled).toBe(false);
    expect(config.audit.fail_closed).toBe(false);
  });

  it("profile: enterprise in config.yml flips the security defaults on", () => {
    writeConfig("profile: enterprise\n");
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.profile).toBe("enterprise");
    expect(config.audit_enabled).toBe(true);
    expect(config.rbac.enabled).toBe(true);
    expect(config.rate_limit.enabled).toBe(true);
    expect(config.audit.fail_closed).toBe(true);
    // Non-security defaults are untouched
    expect(config.rbac.default_role).toBe("contributor");
    expect(config.audit.export_format).toBe("jsonl");
  });

  it("explicit config values win over enterprise profile defaults", () => {
    writeConfig(
      [
        "profile: enterprise",
        "audit_enabled: false",
        "rbac:",
        "  enabled: false",
        "rate_limit:",
        "  enabled: false",
        "audit:",
        "  fail_closed: false",
      ].join("\n") + "\n",
    );
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.profile).toBe("enterprise");
    expect(config.audit_enabled).toBe(false);
    expect(config.rbac.enabled).toBe(false);
    expect(config.rate_limit.enabled).toBe(false);
    expect(config.audit.fail_closed).toBe(false);
  });

  it("partial explicit values only pin what was written", () => {
    writeConfig("profile: enterprise\nrbac:\n  enabled: false\n");
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.rbac.enabled).toBe(false); // explicit
    expect(config.audit_enabled).toBe(true); // profile default
    expect(config.rate_limit.enabled).toBe(true); // profile default
  });

  it("SPECKY_PROFILE env forces enterprise without any config.yml", () => {
    const config = loadConfig(workspace, { argv: [], env: { SPECKY_PROFILE: "enterprise" } });
    expect(config.profile).toBe("enterprise");
    expect(config.audit_enabled).toBe(true);
    expect(config.rbac.enabled).toBe(true);
  });

  it("SPECKY_ENTERPRISE=1 is a shorthand for the enterprise profile", () => {
    const config = loadConfig(workspace, { argv: [], env: { SPECKY_ENTERPRISE: "1" } });
    expect(config.profile).toBe("enterprise");
    expect(config.audit_enabled).toBe(true);
  });

  it("--profile= flag beats env and config file", () => {
    writeConfig("profile: enterprise\n");
    const config = loadConfig(workspace, {
      argv: ["node", "specky", "serve", "--profile=standard"],
      env: { SPECKY_PROFILE: "enterprise" },
    });
    expect(config.profile).toBe("standard");
    expect(config.audit_enabled).toBe(false);
  });

  it("unknown profile values are ignored and fall through", () => {
    expect(resolveProfile("standard", { argv: ["--profile=galactic"], env: {} })).toBe("standard");
    expect(resolveProfile("enterprise", { argv: [], env: { SPECKY_PROFILE: "nope" } })).toBe(
      "enterprise",
    );
  });

  it("pipeline.require_lgtm defaults to false", () => {
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.pipeline.require_lgtm).toBe(false);
  });

  it("pipeline.require_lgtm is NOT flipped by the enterprise profile", () => {
    writeConfig("profile: enterprise\n");
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.profile).toBe("enterprise");
    // Human-review gating is a workflow choice, not a security control —
    // enterprise must not silently change advance-phase behavior.
    expect(config.pipeline.require_lgtm).toBe(false);
  });

  it("pipeline.require_lgtm can be enabled explicitly", () => {
    writeConfig("pipeline:\n  require_lgtm: true\n");
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.pipeline.require_lgtm).toBe(true);
  });

  it("update_check defaults to true (config.yml absent)", () => {
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.update_check).toBe(true);
  });

  it("update_check: false in config.yml disables the update banner", () => {
    writeConfig("update_check: false\n");
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.update_check).toBe(false);
  });

  it("update_check is NOT flipped by the enterprise profile", () => {
    // Not a security control — enterprise must leave it alone in both directions.
    writeConfig("profile: enterprise\n");
    expect(loadConfig(workspace, NO_OVERRIDES).update_check).toBe(true);

    writeConfig("profile: enterprise\nupdate_check: false\n");
    expect(loadConfig(workspace, NO_OVERRIDES).update_check).toBe(false);
  });

  it("enterprise defaults also apply when config.yml is absent or malformed", () => {
    const noFile = loadConfig(workspace, { argv: [], env: { SPECKY_PROFILE: "enterprise" } });
    expect(noFile.audit_enabled).toBe(true);

    writeConfig("profile: [unclosed\n");
    const malformed = loadConfig(workspace, { argv: [], env: { SPECKY_PROFILE: "enterprise" } });
    expect(malformed.profile).toBe("enterprise");
    expect(malformed.audit_enabled).toBe(true);
  });
});
