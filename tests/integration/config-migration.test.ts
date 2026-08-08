import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  persistWorkspaceConfigMigration,
  prepareWorkspaceConfig,
} from "../../src/config-migrations.js";

const REPO = resolve(import.meta.dirname, "../..");
const CLI = resolve(REPO, "dist/cli/index.js");
const MIGRATION_SOURCES = [
  resolve(REPO, "src/config.ts"),
  resolve(REPO, "src/config-migrations.ts"),
  resolve(REPO, "src/cli/commands/init.ts"),
  resolve(REPO, "src/cli/index.ts"),
];
const LEGACY_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.1.yml");
const LEGACY_CATALOG_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.0-catalog.yml");
const EARLIEST_PARTIAL_CONFIG = resolve(REPO, "tests/fixtures/config-v3.3.0-partial.yml");
const LATEST_PARTIAL_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.0-partial.yml");

function runCli(workspace: string, ...args: string[]): ReturnType<typeof spawnSync> {
  const env = { ...process.env, SPECKY_NO_UPDATE_CHECK: "1" };
  delete env["SPECKY_PROFILE"];
  delete env["SPECKY_ENTERPRISE"];
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: workspace,
    encoding: "utf8",
    env,
    timeout: 30_000,
  });
}

beforeAll(() => {
  const builtAt = statSync(CLI).mtimeMs;
  const newestSource = Math.max(...MIGRATION_SOURCES.map((path) => statSync(path).mtimeMs));
  expect(
    builtAt,
    "dist is stale; run `npm run build` before integration tests",
  ).toBeGreaterThanOrEqual(newestSource);
});

describe("workspace config migration", () => {
  let workspace: string;
  let configPath: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-config-migration-"));
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    configPath = resolve(workspace, ".specky/config.yml");
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("migrates a complete v3.11.1 config and preserves every user choice", () => {
    copyFileSync(LEGACY_CONFIG, configPath);
    chmodSync(configPath, 0o660);
    const originalMode = statSync(configPath).mode & 0o777;
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "3.11.1", ide: "auto", targets: ["agent-skills"] }),
    );

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Migrated workspace config from package v3.11.1 to schema 1 (using an atomic rewrite).",
    );

    const migrated = parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(migrated).toEqual({
      schema_version: 1,
      profile: "enterprise",
      spec_root: "custom-specs",
      numbering: { strategy: "explicit" },
      contracts: {
        require_explicit_selection: true,
        enabled: ["greenfield-api-full"],
      },
      templates_path: "custom-templates",
      update_check: false,
      audit_enabled: false,
      rate_limit: {
        enabled: false,
        max_requests_per_minute: 137,
        burst: 23,
      },
      audit: {
        export_format: "otlp",
        max_file_size_mb: 42,
        fail_closed: false,
      },
      rbac: {
        enabled: false,
        default_role: "admin",
      },
      installation: {
        permission_profile: "prompt",
        integrations: ["github"],
      },
      pipeline: { require_lgtm: true },
    });
    expect("version" in migrated).toBe(false);
    expect(statSync(configPath).mode & 0o777).toBe(originalMode);
    expect(
      readdirSync(resolve(workspace, ".specky")).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
    const backups = readdirSync(resolve(workspace, ".specky")).filter((name) =>
      name.endsWith(".bak"),
    );
    expect(backups).toHaveLength(1);
    expect(readFileSync(resolve(workspace, ".specky", backups[0]!), "utf8")).toBe(
      readFileSync(LEGACY_CONFIG, "utf8"),
    );

    const installMetadata = JSON.parse(
      readFileSync(resolve(workspace, ".specky/install.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(installMetadata["permission_profile"]).toBe("prompt");
    expect(installMetadata["integrations"]).toEqual(["github"]);
  });

  it("migrates the published v3.12.0 package-versioned runtime config", () => {
    const config = readFileSync(LEGACY_CONFIG, "utf8").replace(
      "version: 3.11.1",
      "version: 3.12.0",
    );
    writeFileSync(configPath, config, "utf8");
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "3.12.0", ide: "auto", targets: ["agent-skills"] }),
    );

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Migrated workspace config from package v3.12.0 to schema 1");
    expect(parse(readFileSync(configPath, "utf8"))).toMatchObject({
      schema_version: 1,
      profile: "enterprise",
      spec_root: "custom-specs",
    });
  });

  it("migrates a v3.11.0 package catalog and preserves effective runtime choices", () => {
    copyFileSync(LEGACY_CATALOG_CONFIG, configPath);
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "3.11.0", ide: "auto", targets: ["agent-skills"] }),
    );

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Migrated workspace config from package v3.11.0 to schema 1 (using an atomic rewrite).",
    );
    expect(result.stdout).toContain(
      "Removed obsolete config fields: compliance_frameworks, default_framework.",
    );

    const migrated = parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(migrated).toMatchObject({
      schema_version: 1,
      profile: "enterprise",
      spec_root: "custom-specs",
      templates_path: "custom-templates",
      update_check: false,
      audit_enabled: false,
      rate_limit: {
        enabled: false,
        max_requests_per_minute: 137,
        burst: 23,
      },
      audit: {
        export_format: "otlp",
        max_file_size_mb: 42,
        fail_closed: false,
      },
      rbac: { enabled: false, default_role: "admin" },
      installation: { permission_profile: "prompt", integrations: ["github"] },
      pipeline: { require_lgtm: true },
    });
    expect(migrated["numbering"]).toEqual({ strategy: "explicit" });
    expect(migrated["contracts"]).toMatchObject({ require_explicit_selection: true });
    expect(migrated).not.toHaveProperty("default_framework");
    expect(migrated).not.toHaveProperty("compliance_frameworks");
    expect(migrated).not.toHaveProperty("hooks");
    expect(migrated).not.toHaveProperty("model_routing");
  });

  it("migrates a real unversioned v3.3.0 partial config", () => {
    copyFileSync(EARLIEST_PARTIAL_CONFIG, configPath);

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Migrated workspace config from unversioned Specky 3.x config to schema 1",
    );
    expect(result.stdout).toContain(
      "Removed obsolete config fields: compliance_frameworks, default_framework.",
    );

    expect(parse(readFileSync(configPath, "utf8"))).toMatchObject({
      schema_version: 1,
      profile: "standard",
      spec_root: ".specs",
      templates_path: "custom-templates",
      update_check: true,
      audit_enabled: true,
      rate_limit: { enabled: true, max_requests_per_minute: 137, burst: 23 },
      audit: { export_format: "otlp", max_file_size_mb: 42, fail_closed: false },
      rbac: { enabled: true, default_role: "admin" },
      installation: { permission_profile: "scoped", integrations: [] },
      pipeline: { require_lgtm: false },
    });
  });

  it("migrates a later unversioned v3.11.0 partial config", () => {
    copyFileSync(LATEST_PARTIAL_CONFIG, configPath);

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Migrated workspace config from unversioned Specky 3.x config");
    expect(parse(readFileSync(configPath, "utf8"))).toMatchObject({
      schema_version: 1,
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
  });

  it("bootstraps a current config for a pre-v3.3 workspace with no config file", () => {
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "3.2.1", ide: "copilot" }),
    );

    const result = runCli(workspace, "upgrade");
    expect(result.status, result.stderr).toBe(0);
    expect(parse(readFileSync(configPath, "utf8"))).toMatchObject({
      schema_version: 1,
      profile: "standard",
      spec_root: ".specs",
    });
  });

  it("prints an explicit incompatibility for a newer schema instead of Zod output", () => {
    const futureConfig = readFileSync(LEGACY_CONFIG, "utf8").replace(
      "version: 3.11.1",
      "schema_version: 2",
    );
    writeFileSync(configPath, futureConfig, "utf8");

    const result = runCli(workspace, "status");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "schema version 2 is newer than supported version 1; upgrade specky-sdd before using this workspace",
    );
    expect(result.stderr).not.toContain("Invalid input");
    expect(result.stderr).not.toContain("Zod");
  });

  it("reports invalid fields from a complete legacy config without treating it as a catalog", () => {
    const invalidConfig = readFileSync(LEGACY_CONFIG, "utf8").replace(
      "profile: enterprise",
      "profile: unsupported",
    );
    writeFileSync(configPath, invalidConfig, "utf8");

    const result = runCli(workspace, "upgrade");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("legacy package-versioned config cannot be migrated");
    expect(result.stderr).toContain("profile:");
    expect(result.stderr).not.toContain("legacy package catalog");
  });

  it("rejects a future package-versioned config without changing it", () => {
    const futureConfig = readFileSync(LEGACY_CONFIG, "utf8").replace(
      "version: 3.11.1",
      "version: 99.0.0",
    );
    writeFileSync(configPath, futureConfig, "utf8");

    const result = runCli(workspace, "upgrade");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("outside the supported automatic migration range");
    expect(readFileSync(configPath, "utf8")).toBe(futureConfig);
  });

  it("does not migrate when target validation fails", () => {
    const before = readFileSync(LEGACY_CONFIG, "utf8");
    writeFileSync(configPath, before, "utf8");

    const result = runCli(workspace, "init", "--target=unsupported");
    expect(result.status).toBe(1);
    expect(readFileSync(configPath, "utf8")).toBe(before);
  });

  it("does not commit migration when installation fails", () => {
    const before = readFileSync(LEGACY_CONFIG, "utf8");
    writeFileSync(configPath, before, "utf8");
    writeFileSync(resolve(workspace, ".agents"), "blocks agent-skills directory", "utf8");
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "3.11.1", ide: "auto", targets: ["agent-skills"] }),
    );

    const result = runCli(workspace, "upgrade");
    expect(result.status).toBe(1);
    expect(readFileSync(configPath, "utf8")).toBe(before);
  });

  it("keeps dry-run byte-identical and reports fields it would remove", () => {
    const before = readFileSync(EARLIEST_PARTIAL_CONFIG, "utf8");
    writeFileSync(configPath, before, "utf8");

    const result = runCli(workspace, "init", "--target=agent-skills", "--dry-run");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Would migrate workspace config");
    expect(result.stdout).toContain(
      "Would remove obsolete config fields: compliance_frameworks, default_framework.",
    );
    expect(readFileSync(configPath, "utf8")).toBe(before);
  });

  it("refuses to overwrite a config edited after migration preparation", () => {
    writeFileSync(configPath, readFileSync(LEGACY_CONFIG, "utf8"), "utf8");
    const prepared = prepareWorkspaceConfig(workspace);
    const concurrentEdit = "schema_version: 99\nowner: user\n";
    writeFileSync(configPath, concurrentEdit, "utf8");

    expect(() => persistWorkspaceConfigMigration(workspace, prepared)).toThrow(
      /changed while the upgrade was running/,
    );
    expect(readFileSync(configPath, "utf8")).toBe(concurrentEdit);
  });

  it("restores the original and preserves an edit made during migration commit", () => {
    const original = readFileSync(LEGACY_CONFIG, "utf8");
    writeFileSync(configPath, original, "utf8");
    const prepared = prepareWorkspaceConfig(workspace);
    const concurrentEdit = "schema_version: 99\nowner: concurrent-writer\n";

    expect(() =>
      persistWorkspaceConfigMigration(workspace, prepared, {
        afterInstall: (path) => writeFileSync(path, concurrentEdit, "utf8"),
      }),
    ).toThrow(/conflicting content preserved/);

    expect(readFileSync(configPath, "utf8")).toBe(original);
    const conflicts = readdirSync(resolve(workspace, ".specky")).filter((name) =>
      name.endsWith(".conflict"),
    );
    expect(conflicts).toHaveLength(1);
    expect(readFileSync(resolve(workspace, ".specky", conflicts[0]!), "utf8")).toBe(concurrentEdit);
  });
});
