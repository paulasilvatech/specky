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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO = resolve(import.meta.dirname, "../..");
const CLI = resolve(REPO, "dist/cli/index.js");
const LEGACY_CONFIG = resolve(REPO, "tests/fixtures/config-v3.11.1.yml");

function runCli(workspace: string, command: string): ReturnType<typeof spawnSync> {
  const env = { ...process.env, SPECKY_NO_UPDATE_CHECK: "1" };
  delete env["SPECKY_PROFILE"];
  delete env["SPECKY_ENTERPRISE"];
  return spawnSync(process.execPath, [CLI, command], {
    cwd: workspace,
    encoding: "utf8",
    env,
    timeout: 30_000,
  });
}

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

  it("migrates the real N-1 config through runInit and preserves every user choice", () => {
    const packageManifest = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) as {
      version: string;
    };
    expect(packageManifest.version).toBe("3.12.1");

    copyFileSync(LEGACY_CONFIG, configPath);
    chmodSync(configPath, 0o640);
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

    const installMetadata = JSON.parse(
      readFileSync(resolve(workspace, ".specky/install.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(installMetadata["permission_profile"]).toBe("prompt");
    expect(installMetadata["integrations"]).toEqual(["github"]);
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
});
