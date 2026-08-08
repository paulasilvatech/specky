import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";
import {
  persistWorkspaceConfigMigration,
  prepareWorkspaceConfig,
} from "../../src/config-migrations.js";

const REPO = resolve(import.meta.dirname, "../..");
const COMPLETE_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.1.yml");
const CATALOG_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.0-catalog.yml");
const EARLY_PARTIAL_CONFIG = resolve(REPO, "tests/fixtures/config-v3.3.0-partial.yml");
const LATE_PARTIAL_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.0-partial.yml");

describe("workspace config migration internals", () => {
  let workspace: string;
  let configPath: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-config-migrations-unit-"));
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    configPath = resolve(workspace, ".specky/config.yml");
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function fixture(path: string): string {
    return readFileSync(path, "utf8");
  }

  function write(raw: string): void {
    writeFileSync(configPath, raw, "utf8");
  }

  it("leaves a current schema config unchanged", () => {
    const raw = serializeWorkspaceConfig(createWorkspaceConfig());
    write(raw);

    const prepared = prepareWorkspaceConfig(workspace);

    expect(prepared.migration).toBeUndefined();
    expect(persistWorkspaceConfigMigration(workspace, prepared)).toBeUndefined();
    expect(readFileSync(configPath, "utf8")).toBe(raw);
  });

  it("rejects a document with no current or recognized legacy fields", () => {
    write("unknown: true\n");
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/schema_version/);

    write("[]\n");
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/expected object/);
  });

  it("migrates a minimal unversioned config with defaults", () => {
    write("audit_enabled: true\n");
    chmodSync(configPath, 0o660);
    const original = readFileSync(configPath, "utf8");

    const prepared = prepareWorkspaceConfig(workspace);
    expect(prepared.config).toMatchObject({
      profile: "standard",
      templates_path: "",
      update_check: true,
      audit_enabled: true,
      installation: { permission_profile: "scoped", integrations: [] },
      pipeline: { require_lgtm: false },
    });

    expect(prepared.migration?.removedFields).toEqual([]);

    const backupPath = persistWorkspaceConfigMigration(workspace, prepared);
    expect(backupPath).toMatch(/\.bak$/);
    expect(readFileSync(backupPath!, "utf8")).toBe(original);
    expect(statSync(configPath).mode & 0o777).toBe(0o660);
    expect(parse(readFileSync(configPath, "utf8"))).toMatchObject({ schema_version: 1 });
    expect(
      readdirSync(resolve(workspace, ".specky")).filter((name) =>
        /\.(tmp|probe|original)$/.test(name),
      ),
    ).toEqual([]);
  });

  it("uses current defaults when an unversioned config only contains an obsolete field", () => {
    write("default_framework: jest\n");

    const prepared = prepareWorkspaceConfig(workspace);

    expect(prepared.config).toMatchObject({
      profile: "standard",
      templates_path: "",
      update_check: true,
      audit_enabled: false,
      rate_limit: { enabled: false, max_requests_per_minute: 60, burst: 10 },
      audit: { export_format: "jsonl", max_file_size_mb: 10, fail_closed: false },
      rbac: { enabled: false, default_role: "contributor" },
      installation: { permission_profile: "scoped", integrations: [] },
      pipeline: { require_lgtm: false },
    });
    expect(prepared.migration?.removedFields).toEqual(["default_framework"]);
  });

  it("preserves all later unversioned optional settings", () => {
    write(fixture(LATE_PARTIAL_CONFIG));
    const prepared = prepareWorkspaceConfig(workspace);

    expect(prepared.config).toMatchObject({
      profile: "enterprise",
      templates_path: "custom-templates",
      update_check: false,
      audit_enabled: false,
      rate_limit: { enabled: false, max_requests_per_minute: 137, burst: 23 },
      audit: { export_format: "otlp", max_file_size_mb: 42, fail_closed: false },
      rbac: { enabled: false, default_role: "admin" },
      installation: { permission_profile: "prompt", integrations: ["github"] },
      pipeline: { require_lgtm: true },
    });
    expect(prepared.migration?.removedFields).toEqual([
      "compliance_frameworks",
      "default_framework",
    ]);
  });

  it("rejects invalid recognized unversioned settings", () => {
    write("audit_enabled: invalid\n");
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/unversioned.*cannot be migrated/);
  });

  it.each([
    ["3.4.0", "standard", true, "scoped", false],
    ["3.5.0", "enterprise", true, "scoped", false],
    ["3.6.0", "enterprise", true, "scoped", true],
    ["3.7.0", "enterprise", false, "scoped", true],
    ["3.11.0", "enterprise", false, "prompt", true],
  ] as const)(
    "applies only settings supported by package catalog v%s",
    (version, profile, updateCheck, permissionProfile, requireLgtm) => {
      write(fixture(CATALOG_CONFIG).replace('version: "3.11.0"', `version: "${version}"`));

      const prepared = prepareWorkspaceConfig(workspace);

      expect(prepared.config.profile).toBe(profile);
      expect(prepared.config.update_check).toBe(updateCheck);
      expect(prepared.config.installation.permission_profile).toBe(permissionProfile);
      expect(prepared.config.pipeline.require_lgtm).toBe(requireLgtm);
      expect(prepared.config.spec_root).toBe("custom-specs");
    },
  );

  it("uses historical defaults for omitted optional v3.7 catalog settings", () => {
    write(
      stringify({
        version: "3.7.0",
        pipeline: { phases: [] },
        hooks: {},
        specs_dir: ".specs",
        skills_dir: ".apm/skills",
        branching: {},
        model_routing: {},
      }),
    );

    const prepared = prepareWorkspaceConfig(workspace);

    expect(prepared.config).toMatchObject({
      profile: "standard",
      templates_path: "",
      update_check: true,
      audit_enabled: false,
      rate_limit: { enabled: false },
      audit: { fail_closed: false },
      rbac: { enabled: false },
      installation: { permission_profile: "scoped", integrations: [] },
      pipeline: { require_lgtm: false },
    });
  });

  it("rejects malformed catalogs and package versions outside the published range", () => {
    write(fixture(CATALOG_CONFIG).replace("skills_dir: .apm/skills", "skills_dir: 42"));
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/package catalog cannot be migrated/);

    write(fixture(COMPLETE_CONFIG).replace("version: 3.11.1", "version: 3.3.0"));
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/outside the supported/);

    write(fixture(COMPLETE_CONFIG).replace("version: 3.11.1", "version: latest"));
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/expected a Specky package version/);

    write(fixture(COMPLETE_CONFIG).replace("version: 3.11.1", "version: 99.0.0"));
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(/outside the supported/);
  });

  it.each(["3.11.1", "3.12.0"])("prepares complete package config v%s", (version) => {
    write(fixture(COMPLETE_CONFIG).replace("version: 3.11.1", `version: ${version}`));

    const prepared = prepareWorkspaceConfig(workspace);

    expect(prepared.migration?.packageVersion).toBe(version);
    expect(prepared.config).toMatchObject({
      schema_version: 1,
      profile: "enterprise",
      spec_root: "custom-specs",
    });
  });

  it("rejects an invalid complete package config", () => {
    write(fixture(COMPLETE_CONFIG).replace("profile: enterprise", "profile: unsupported"));
    expect(() => prepareWorkspaceConfig(workspace)).toThrow(
      /package-versioned.*cannot be migrated/,
    );
  });

  it("refuses persistence when the source disappears or changes", () => {
    write(fixture(COMPLETE_CONFIG));
    const missing = prepareWorkspaceConfig(workspace);
    unlinkSync(configPath);
    expect(() => persistWorkspaceConfigMigration(workspace, missing)).toThrow(/disappeared/);

    write(fixture(COMPLETE_CONFIG));
    const changed = prepareWorkspaceConfig(workspace);
    write("schema_version: 99\n");
    expect(() => persistWorkspaceConfigMigration(workspace, changed)).toThrow(/changed/);
  });

  it("restores the original and quarantines in-place commit-window edits", () => {
    const original = fixture(COMPLETE_CONFIG);
    write(original);
    const prepared = prepareWorkspaceConfig(workspace);
    const concurrent = "schema_version: 99\nowner: concurrent\n";

    expect(() =>
      persistWorkspaceConfigMigration(workspace, prepared, {
        afterInstall: (path) => writeFileSync(path, concurrent, "utf8"),
      }),
    ).toThrow(/conflicting content preserved/);

    expect(readFileSync(configPath, "utf8")).toBe(original);
    const conflict = readdirSync(resolve(workspace, ".specky")).find((name) =>
      name.endsWith(".conflict"),
    );
    expect(conflict).toBeDefined();
    expect(readFileSync(resolve(workspace, ".specky", conflict!), "utf8")).toBe(concurrent);
  });

  it("restores the original and quarantines commit-window path replacements", () => {
    const original = fixture(EARLY_PARTIAL_CONFIG);
    write(original);
    const prepared = prepareWorkspaceConfig(workspace);
    const replacement = "schema_version: 99\nowner: replacement\n";

    expect(() =>
      persistWorkspaceConfigMigration(workspace, prepared, {
        afterInstall: (path) => {
          unlinkSync(path);
          writeFileSync(path, replacement, "utf8");
        },
      }),
    ).toThrow(/conflicting content preserved/);

    expect(readFileSync(configPath, "utf8")).toBe(original);
    const conflict = readdirSync(resolve(workspace, ".specky")).find((name) =>
      name.endsWith(".conflict"),
    );
    expect(conflict).toBeDefined();
    expect(readFileSync(resolve(workspace, ".specky", conflict!), "utf8")).toBe(replacement);
  });

  it("preserves both files when a writer recreates config before staged install", () => {
    const original = fixture(COMPLETE_CONFIG);
    write(original);
    const prepared = prepareWorkspaceConfig(workspace);
    const concurrent = "schema_version: 99\nowner: early-writer\n";

    expect(() =>
      persistWorkspaceConfigMigration(workspace, prepared, {
        beforeInstall: (path) => writeFileSync(path, concurrent, "utf8"),
      }),
    ).toThrow(/original preserved/);

    expect(readFileSync(configPath, "utf8")).toBe(concurrent);
    const displaced = readdirSync(resolve(workspace, ".specky")).find((name) =>
      name.endsWith(".original"),
    );
    expect(displaced).toBeDefined();
    expect(readFileSync(resolve(workspace, ".specky", displaced!), "utf8")).toBe(original);
  });
});
