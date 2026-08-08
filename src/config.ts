/**
 * Strict workspace runtime configuration.
 *
 * The package-level config.yml documents shipped primitives. Runtime behavior
 * is governed only by mandatory .specky/config.yml, whose schema is complete
 * and closed. The installer is the sole bootstrap path for creating the file.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { CONFIG_SCHEMA_VERSION } from "./constants.js";
import { SUPPORTED_USE_CASE_CONTRACT_IDS, useCaseContractIdSchema } from "./contracts/use-case.js";

const safeRelativePath = z
  .string()
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path.startsWith("\\") &&
      !/^[a-zA-Z]:/.test(path) &&
      !path.split(/[/\\]/).includes("..") &&
      !path.includes("\0"),
    { message: "path must be workspace-relative (no absolute paths, no '..')." },
  );

export const configSchema = z
  .object({
    schema_version: z.literal(CONFIG_SCHEMA_VERSION),
    profile: z.enum(["standard", "enterprise"]),
    spec_root: safeRelativePath.min(1),
    numbering: z
      .object({
        strategy: z.literal("explicit"),
      })
      .strict(),
    contracts: z
      .object({
        require_explicit_selection: z.literal(true),
        enabled: z.array(useCaseContractIdSchema).min(1),
      })
      .strict(),
    templates_path: safeRelativePath,
    update_check: z.boolean(),
    audit_enabled: z.boolean(),
    rate_limit: z
      .object({
        enabled: z.boolean(),
        max_requests_per_minute: z.number().int().positive(),
        burst: z.number().int().positive(),
      })
      .strict(),
    audit: z
      .object({
        export_format: z.enum(["jsonl", "syslog", "otlp"]),
        max_file_size_mb: z.number().positive(),
        fail_closed: z.boolean(),
      })
      .strict(),
    rbac: z
      .object({
        enabled: z.boolean(),
        default_role: z.enum(["viewer", "contributor", "admin"]),
      })
      .strict(),
    installation: z
      .object({
        permission_profile: z.enum(["scoped", "prompt"]),
        integrations: z.array(z.enum(["github"])),
      })
      .strict(),
    pipeline: z
      .object({
        require_lgtm: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type SpeckyConfig = z.infer<typeof configSchema>;
export type SpeckyProfile = SpeckyConfig["profile"];

export class ConfigValidationError extends Error {
  constructor(
    readonly configPath: string,
    message: string,
  ) {
    super(`Invalid Specky workspace config at ${configPath}: ${message}`);
    this.name = "ConfigValidationError";
  }
}

export class ConfigCompatibilityError extends Error {
  constructor(
    readonly configPath: string,
    message: string,
  ) {
    super(`Incompatible Specky workspace config at ${configPath}: ${message}`);
    this.name = "ConfigCompatibilityError";
  }
}

export interface ProfileOverrides {
  argv?: readonly string[];
  env?: Record<string, string | undefined>;
}

export interface CreateConfigOptions {
  profile?: SpeckyProfile;
  permissionProfile?: SpeckyConfig["installation"]["permission_profile"];
  integrations?: SpeckyConfig["installation"]["integrations"];
  requireLgtm?: boolean;
}

export function createWorkspaceConfig(options: CreateConfigOptions = {}): SpeckyConfig {
  const profile = options.profile ?? "standard";
  const enterprise = profile === "enterprise";
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    profile,
    spec_root: ".specs",
    numbering: { strategy: "explicit" },
    contracts: {
      require_explicit_selection: true,
      enabled: [...SUPPORTED_USE_CASE_CONTRACT_IDS],
    },
    templates_path: "",
    update_check: true,
    audit_enabled: enterprise,
    rate_limit: {
      enabled: enterprise,
      max_requests_per_minute: 60,
      burst: 10,
    },
    audit: {
      export_format: "jsonl",
      max_file_size_mb: 10,
      fail_closed: enterprise,
    },
    rbac: {
      enabled: enterprise,
      default_role: "contributor",
    },
    installation: {
      permission_profile: options.permissionProfile ?? "scoped",
      integrations: options.integrations ?? [],
    },
    pipeline: {
      require_lgtm: options.requireLgtm ?? false,
    },
  };
}

export function serializeWorkspaceConfig(config: SpeckyConfig): string {
  return stringify(configSchema.parse(config), { lineWidth: 0 });
}

export function resolveProfile(
  configProfile: SpeckyProfile,
  overrides: ProfileOverrides = {},
): SpeckyProfile {
  const argv = overrides.argv ?? process.argv;
  const env = overrides.env ?? process.env;
  const flagValues = argv
    .filter((arg) => arg.startsWith("--profile="))
    .map((arg) => arg.slice("--profile=".length));
  const candidate =
    flagValues.at(-1) ??
    env["SPECKY_PROFILE"] ??
    (env["SPECKY_ENTERPRISE"] === "1" ? "enterprise" : undefined);

  if (candidate === undefined) return configProfile;
  if (candidate === "standard" || candidate === "enterprise") return candidate;
  throw new ConfigValidationError(
    "<profile override>",
    `unknown profile "${candidate}"; expected standard or enterprise`,
  );
}

export interface WorkspaceConfigFile {
  configPath: string;
  parsed: unknown;
}

export function formatConfigIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
    .join("; ");
}

export function readWorkspaceConfigFile(workspaceRoot: string): WorkspaceConfigFile {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  if (!existsSync(configPath)) {
    throw new ConfigValidationError(
      configPath,
      "file is required; run `specky install` to write a complete workspace contract",
    );
  }

  try {
    return { configPath, parsed: parse(readFileSync(configPath, "utf-8")) };
  } catch (error) {
    throw new ConfigValidationError(configPath, `malformed YAML: ${(error as Error).message}`);
  }
}

export function parseCurrentWorkspaceConfig(parsed: unknown, configPath: string): SpeckyConfig {
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if ("schema_version" in record && record["schema_version"] !== CONFIG_SCHEMA_VERSION) {
      const found = record["schema_version"];
      if (typeof found !== "number" || !Number.isInteger(found)) {
        throw new ConfigCompatibilityError(
          configPath,
          `schema_version must be the integer ${CONFIG_SCHEMA_VERSION}; found ${JSON.stringify(found)}`,
        );
      }
      const relation =
        found > CONFIG_SCHEMA_VERSION
          ? `schema version ${found} is newer than supported version ${CONFIG_SCHEMA_VERSION}; upgrade specky-sdd before using this workspace`
          : `schema version ${found} is older than supported version ${CONFIG_SCHEMA_VERSION}, and no automatic migration path is available`;
      throw new ConfigCompatibilityError(configPath, relation);
    }
    if (!("schema_version" in record) && "version" in record) {
      throw new ConfigCompatibilityError(
        configPath,
        `legacy package-versioned format detected (version ${JSON.stringify(record["version"])}); run \`specky upgrade\` to migrate it to config schema ${CONFIG_SCHEMA_VERSION}`,
      );
    }
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigValidationError(configPath, formatConfigIssues(result.error));
  }
  return result.data;
}

export function loadConfig(workspaceRoot: string, overrides: ProfileOverrides = {}): SpeckyConfig {
  const { configPath, parsed } = readWorkspaceConfigFile(workspaceRoot);
  const config = parseCurrentWorkspaceConfig(parsed, configPath);
  const profile = resolveProfile(config.profile, overrides);
  if (profile === config.profile) return config;

  const overridden = createWorkspaceConfig({
    profile,
    permissionProfile: config.installation.permission_profile,
    integrations: config.installation.integrations,
    requireLgtm: config.pipeline.require_lgtm,
  });
  return {
    ...config,
    profile,
    audit_enabled: overridden.audit_enabled,
    rate_limit: { ...config.rate_limit, enabled: overridden.rate_limit.enabled },
    audit: { ...config.audit, fail_closed: overridden.audit.fail_closed },
    rbac: { ...config.rbac, enabled: overridden.rbac.enabled },
  };
}

interface ConfigCacheEntry {
  mtimeMs: number;
  config: SpeckyConfig;
}

const configCache = new Map<string, ConfigCacheEntry>();

export function invalidateConfigCache(workspaceRoot: string): void {
  configCache.delete(workspaceRoot);
}

/**
 * mtime-aware wrapper around loadConfig: the workspace config is re-read and
 * re-parsed only when .specky/config.yml changes on disk. Tool invocations
 * call this on every resolve, so without it each call would re-hit the disk.
 *
 * First-load behavior is identical to loadConfig (a missing or invalid file
 * throws ConfigValidationError). Once a config has loaded successfully, a
 * temporarily missing file (e.g. mid-rename during an atomic rewrite) keeps
 * serving the last cached config instead of failing the process. Overrides
 * are assumed stable per workspace root, which holds for a server process
 * because they derive from process argv/env fixed at startup.
 */
export function loadConfigCached(
  workspaceRoot: string,
  overrides: ProfileOverrides = {},
): SpeckyConfig {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  const cached = configCache.get(workspaceRoot);

  let mtimeMs: number | undefined;
  try {
    mtimeMs = statSync(configPath).mtimeMs;
  } catch {
    // Missing or unreadable file: serve the cached config when available;
    // otherwise fall through so loadConfig raises the standard bootstrap error.
    if (cached) return cached.config;
  }

  if (cached && mtimeMs !== undefined && cached.mtimeMs === mtimeMs) {
    return cached.config;
  }

  const config = loadConfig(workspaceRoot, overrides);
  if (mtimeMs !== undefined) {
    configCache.set(workspaceRoot, { mtimeMs, config });
  }
  return config;
}
