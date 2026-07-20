import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  createWorkspaceConfig,
  loadConfig,
  loadConfigCached,
  resolveProfile,
  type SpeckyConfig,
  serializeWorkspaceConfig,
} from "../../src/config.js";
import { SUPPORTED_USE_CASE_CONTRACT_IDS } from "../../src/contracts/use-case.js";

const NO_OVERRIDES = { argv: [] as string[], env: {} as Record<string, string> };

describe("strict workspace configuration", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-config-profile-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function writeConfig(config: SpeckyConfig): void {
    mkdirSync(join(workspace, ".specky"), { recursive: true });
    writeFileSync(
      join(workspace, ".specky", "config.yml"),
      serializeWorkspaceConfig(config),
      "utf-8",
    );
  }

  function writeRaw(yaml: string): void {
    mkdirSync(join(workspace, ".specky"), { recursive: true });
    writeFileSync(join(workspace, ".specky", "config.yml"), yaml, "utf-8");
  }

  it("rejects a missing runtime config and requires the installer bootstrap", () => {
    expect(() => loadConfig(workspace, NO_OVERRIDES)).toThrow(/file is required/);
    writeConfig(createWorkspaceConfig());
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config).toMatchObject({
      profile: "standard",
      spec_root: ".specs",
      numbering: { strategy: "explicit" },
      audit_enabled: false,
      rbac: { enabled: false },
      rate_limit: { enabled: false },
      audit: { fail_closed: false },
      pipeline: { require_lgtm: false },
    });
    expect(config.contracts.require_explicit_selection).toBe(true);
    expect(config.contracts.enabled).toEqual(SUPPORTED_USE_CASE_CONTRACT_IDS);
  });

  it("generates enterprise security controls independently of functional contracts", () => {
    writeConfig(createWorkspaceConfig({ profile: "enterprise" }));
    const config = loadConfig(workspace, NO_OVERRIDES);
    expect(config.profile).toBe("enterprise");
    expect(config.audit_enabled).toBe(true);
    expect(config.rbac.enabled).toBe(true);
    expect(config.rate_limit.enabled).toBe(true);
    expect(config.audit.fail_closed).toBe(true);
    expect(config.pipeline.require_lgtm).toBe(false);
    expect(config.contracts.enabled).toEqual(SUPPORTED_USE_CASE_CONTRACT_IDS);
  });

  it("preserves explicit security values in a complete config", () => {
    const config = createWorkspaceConfig({ profile: "enterprise" });
    config.audit_enabled = false;
    config.rbac.enabled = false;
    config.rate_limit.enabled = false;
    config.audit.fail_closed = false;
    writeConfig(config);

    const loaded = loadConfig(workspace, NO_OVERRIDES);
    expect(loaded.audit_enabled).toBe(false);
    expect(loaded.rbac.enabled).toBe(false);
    expect(loaded.rate_limit.enabled).toBe(false);
    expect(loaded.audit.fail_closed).toBe(false);
  });

  it("supports environment and flag profile overrides with deterministic precedence", () => {
    writeConfig(createWorkspaceConfig());
    expect(
      loadConfig(workspace, {
        argv: [],
        env: { SPECKY_PROFILE: "enterprise" },
      }).profile,
    ).toBe("enterprise");
    expect(
      loadConfig(workspace, {
        argv: [],
        env: { SPECKY_ENTERPRISE: "1" },
      }).profile,
    ).toBe("enterprise");

    writeConfig(createWorkspaceConfig({ profile: "enterprise" }));
    const overridden = loadConfig(workspace, {
      argv: ["node", "specky", "serve", "--profile=standard"],
      env: { SPECKY_PROFILE: "enterprise" },
    });
    expect(overridden.profile).toBe("standard");
    expect(overridden.audit_enabled).toBe(false);
    expect(overridden.rbac.enabled).toBe(false);
  });

  it("rejects unknown profile overrides", () => {
    expect(() =>
      resolveProfile("standard", {
        argv: ["--profile=galactic"],
        env: {},
      }),
    ).toThrow(ConfigValidationError);
    expect(() =>
      resolveProfile("enterprise", {
        argv: [],
        env: { SPECKY_PROFILE: "nope" },
      }),
    ).toThrow(/unknown profile/);
  });

  it("persists explicit LGTM and update-check choices", () => {
    const config = createWorkspaceConfig({ requireLgtm: true });
    config.update_check = false;
    writeConfig(config);
    const loaded = loadConfig(workspace, NO_OVERRIDES);
    expect(loaded.pipeline.require_lgtm).toBe(true);
    expect(loaded.update_check).toBe(false);
  });

  it("rejects malformed, partial, unknown, and escaping config instead of falling back", () => {
    writeRaw("profile: [unclosed\n");
    expect(() => loadConfig(workspace, NO_OVERRIDES)).toThrow(/malformed YAML/);

    writeRaw("profile: standard\n");
    expect(() => loadConfig(workspace, NO_OVERRIDES)).toThrow(/version: Invalid input/);

    const unknown = serializeWorkspaceConfig(createWorkspaceConfig()) + "unknown_field: true\n";
    writeRaw(unknown);
    expect(() => loadConfig(workspace, NO_OVERRIDES)).toThrow(/Unrecognized key/);

    const valid = serializeWorkspaceConfig(createWorkspaceConfig());
    writeRaw(valid.replace('templates_path: ""', "templates_path: ../../etc"));
    expect(() => loadConfig(workspace, NO_OVERRIDES)).toThrow(/workspace-relative/);
  });
});

describe("loadConfigCached", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-config-cache-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function configPath(): string {
    return join(workspace, ".specky", "config.yml");
  }

  function writeConfig(config: SpeckyConfig): void {
    mkdirSync(join(workspace, ".specky"), { recursive: true });
    writeFileSync(configPath(), serializeWorkspaceConfig(config), "utf-8");
  }

  const T0 = new Date("2026-01-01T00:00:00.000Z");
  const T1 = new Date("2026-01-01T00:00:05.000Z");

  it("matches loadConfig on first load and re-throws the missing-file error", () => {
    expect(() => loadConfigCached(workspace, NO_OVERRIDES)).toThrow(/file is required/);
    writeConfig(createWorkspaceConfig());
    expect(loadConfigCached(workspace, NO_OVERRIDES)).toEqual(loadConfig(workspace, NO_OVERRIDES));
  });

  it("serves repeat calls from cache while the file mtime is unchanged", () => {
    writeConfig(createWorkspaceConfig());
    utimesSync(configPath(), T0, T0);
    expect(loadConfigCached(workspace, NO_OVERRIDES).pipeline.require_lgtm).toBe(false);

    // Rewrite with different content but pin the original mtime: the cache
    // must NOT re-parse, proving repeat calls avoid the disk read + parse.
    writeConfig(createWorkspaceConfig({ requireLgtm: true }));
    utimesSync(configPath(), T0, T0);
    expect(loadConfigCached(workspace, NO_OVERRIDES).pipeline.require_lgtm).toBe(false);
  });

  it("re-parses when the file mtime changes", () => {
    writeConfig(createWorkspaceConfig());
    utimesSync(configPath(), T0, T0);
    expect(loadConfigCached(workspace, NO_OVERRIDES).pipeline.require_lgtm).toBe(false);

    writeConfig(createWorkspaceConfig({ requireLgtm: true }));
    utimesSync(configPath(), T1, T1);
    expect(loadConfigCached(workspace, NO_OVERRIDES).pipeline.require_lgtm).toBe(true);
  });

  it("keeps serving the cached config when the file disappears after a successful load", () => {
    writeConfig(createWorkspaceConfig());
    const loaded = loadConfigCached(workspace, NO_OVERRIDES);
    rmSync(configPath());
    expect(loadConfigCached(workspace, NO_OVERRIDES)).toEqual(loaded);
  });
});
