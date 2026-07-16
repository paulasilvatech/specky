/**
 * Strict workspace runtime configuration.
 *
 * The package-level config.yml documents shipped primitives. Runtime behavior
 * is governed only by mandatory .specky/config.yml, whose schema is complete
 * and closed. The installer is the sole bootstrap path for creating the file.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { VERSION } from "./constants.js";
import {
  SUPPORTED_USE_CASE_CONTRACT_IDS,
  useCaseContractIdSchema,
} from "./contracts/use-case.js";

const safeRelativePath = z.string().refine(
  (path) =>
    !path.startsWith("/") &&
    !path.startsWith("\\") &&
    !/^[a-zA-Z]:/.test(path) &&
    !path.split(/[/\\]/).includes("..") &&
    !path.includes("\0"),
  { message: "path must be workspace-relative (no absolute paths, no '..')." },
);

export const configSchema = z.object({
  version: z.literal(VERSION),
  profile: z.enum(["standard", "enterprise"]),
  spec_root: safeRelativePath.min(1),
  numbering: z.object({
    strategy: z.literal("explicit"),
  }).strict(),
  contracts: z.object({
    require_explicit_selection: z.literal(true),
    enabled: z.array(useCaseContractIdSchema).min(1),
  }).strict(),
  templates_path: safeRelativePath,
  update_check: z.boolean(),
  audit_enabled: z.boolean(),
  rate_limit: z.object({
    enabled: z.boolean(),
    max_requests_per_minute: z.number().int().positive(),
    burst: z.number().int().positive(),
  }).strict(),
  audit: z.object({
    export_format: z.enum(["jsonl", "syslog", "otlp"]),
    max_file_size_mb: z.number().positive(),
    fail_closed: z.boolean(),
  }).strict(),
  rbac: z.object({
    enabled: z.boolean(),
    default_role: z.enum(["viewer", "contributor", "admin"]),
  }).strict(),
  installation: z.object({
    permission_profile: z.enum(["scoped", "prompt"]),
    integrations: z.array(z.enum(["github"])),
  }).strict(),
  pipeline: z.object({
    require_lgtm: z.boolean(),
  }).strict(),
}).strict();

export type SpeckyConfig = z.infer<typeof configSchema>;
export type SpeckyProfile = SpeckyConfig["profile"];

export class ConfigValidationError extends Error {
  constructor(readonly configPath: string, message: string) {
    super(`Invalid Specky workspace config at ${configPath}: ${message}`);
    this.name = "ConfigValidationError";
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
    version: VERSION,
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
  const candidate = flagValues.at(-1)
    ?? env["SPECKY_PROFILE"]
    ?? (env["SPECKY_ENTERPRISE"] === "1" ? "enterprise" : undefined);

  if (candidate === undefined) return configProfile;
  if (candidate === "standard" || candidate === "enterprise") return candidate;
  throw new ConfigValidationError("<profile override>", `unknown profile "${candidate}"; expected standard or enterprise`);
}

export function loadConfig(workspaceRoot: string, overrides: ProfileOverrides = {}): SpeckyConfig {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  if (!existsSync(configPath)) {
    throw new ConfigValidationError(
      configPath,
      "file is required; run `specky install` to write a complete workspace contract",
    );
  }

  let parsed: unknown;
  try {
    parsed = parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    throw new ConfigValidationError(configPath, `malformed YAML: ${(error as Error).message}`);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new ConfigValidationError(configPath, issues);
  }

  const profile = resolveProfile(result.data.profile, overrides);
  if (profile === result.data.profile) return result.data;

  const overridden = createWorkspaceConfig({
    profile,
    permissionProfile: result.data.installation.permission_profile,
    integrations: result.data.installation.integrations,
    requireLgtm: result.data.pipeline.require_lgtm,
  });
  return {
    ...result.data,
    profile,
    audit_enabled: overridden.audit_enabled,
    rate_limit: { ...result.data.rate_limit, enabled: overridden.rate_limit.enabled },
    audit: { ...result.data.audit, fail_closed: overridden.audit.fail_closed },
    rbac: { ...result.data.rbac, enabled: overridden.rbac.enabled },
  };
}

