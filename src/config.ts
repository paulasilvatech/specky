/**
 * SpeckyConfig — Optional `.specky/config.yml` support.
 * Reads project-local configuration and merges with defaults.
 *
 * Parsing uses the `yaml` library (safe by default — no code execution) and a
 * Zod schema for validation, replacing a hand-rolled line parser that could not
 * handle nested lists/quoting and did no validation.
 *
 * Profiles: `standard` (default) keeps every enterprise control opt-in and
 * off. `enterprise` flips the *defaults* of audit_enabled, rbac.enabled,
 * rate_limit.enabled, and audit.fail_closed to true — an explicit value in
 * config.yml always wins over the profile default, so an enterprise deployment
 * can still switch an individual control off. The profile itself can come from
 * config.yml (`profile: enterprise`), the `SPECKY_PROFILE` env var, the
 * `SPECKY_ENTERPRISE=1` shorthand, or the server's `--profile=enterprise` flag
 * (flag > env > config file).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

/** Reject absolute paths and parent-directory traversal in path-valued config. */
const safeRelativePath = z.string().refine(
  (p) =>
    p === "" ||
    (!p.startsWith("/") &&
      !p.startsWith("\\") &&
      !/^[a-zA-Z]:/.test(p) &&
      !p.split(/[/\\]/).includes("..") &&
      !p.includes("\0")),
  { message: "templates_path must be a workspace-relative path (no absolute paths, no '..')." },
);

const configSchema = z
  .object({
    profile: z.enum(["standard", "enterprise"]).default("standard"),
    templates_path: safeRelativePath.default(""),
    default_framework: z.string().default("vitest"),
    compliance_frameworks: z.array(z.string()).default(["general"]),
    audit_enabled: z.boolean().default(false),
    rate_limit: z
      .object({
        enabled: z.boolean().default(false),
        max_requests_per_minute: z.number().int().positive().default(60),
        burst: z.number().int().positive().default(10),
      })
      .default({ enabled: false, max_requests_per_minute: 60, burst: 10 }),
    audit: z
      .object({
        export_format: z.enum(["jsonl", "syslog", "otlp"]).default("jsonl"),
        max_file_size_mb: z.number().positive().default(10),
        fail_closed: z.boolean().default(false),
      })
      .default({ export_format: "jsonl", max_file_size_mb: 10, fail_closed: false }),
    rbac: z
      .object({
        enabled: z.boolean().default(false),
        default_role: z.enum(["viewer", "contributor", "admin"]).default("contributor"),
      })
      .default({ enabled: false, default_role: "contributor" }),
    pipeline: z
      .object({
        // Server-side LGTM enforcement: when true, sdd_advance_phase refuses to
        // complete the specify/design/tasks quality gates unless the caller
        // passes lgtm: true. Off by default (zero behavior change) and NOT
        // flipped by the enterprise profile — human-review gating is a workflow
        // choice, not a security control.
        require_lgtm: z.boolean().default(false),
      })
      .default({ require_lgtm: false }),
  })
  .strip();

export type SpeckyConfig = z.infer<typeof configSchema>;
export type SpeckyProfile = SpeckyConfig["profile"];

const DEFAULT_CONFIG: SpeckyConfig = configSchema.parse({});

/** Inputs that can force the profile from outside config.yml (flag > env). */
export interface ProfileOverrides {
  argv?: readonly string[];
  env?: Record<string, string | undefined>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve the active profile. Precedence: `--profile=` flag > `SPECKY_PROFILE`
 * env > `SPECKY_ENTERPRISE=1` shorthand > config.yml `profile:` > standard.
 * Unknown values are ignored with a stderr warning (never crash the server).
 */
export function resolveProfile(
  configProfile: SpeckyProfile,
  overrides: ProfileOverrides = {},
): SpeckyProfile {
  const argv = overrides.argv ?? process.argv;
  const env = overrides.env ?? process.env;

  const flagValue = argv
    .filter((a) => a.startsWith("--profile="))
    .at(-1)
    ?.slice("--profile=".length);
  const candidates: Array<string | undefined> = [
    flagValue,
    env["SPECKY_PROFILE"],
    env["SPECKY_ENTERPRISE"] === "1" ? "enterprise" : undefined,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    if (candidate === "standard" || candidate === "enterprise") return candidate;
    console.error(
      `[specky] Ignoring unknown profile "${candidate}" (valid: standard, enterprise).`,
    );
  }
  return configProfile;
}

/**
 * Enterprise profile flips the *defaults* of the security controls to ON.
 * A value explicitly present in config.yml always wins, so `rawConfig` (the
 * parsed YAML before Zod defaults) is consulted to tell "user said false"
 * apart from "user said nothing".
 */
function applyEnterpriseDefaults(config: SpeckyConfig, rawConfig: unknown): SpeckyConfig {
  const raw = isRecord(rawConfig) ? rawConfig : {};
  const rawRbac = isRecord(raw["rbac"]) ? raw["rbac"] : {};
  const rawRateLimit = isRecord(raw["rate_limit"]) ? raw["rate_limit"] : {};
  const rawAudit = isRecord(raw["audit"]) ? raw["audit"] : {};

  return {
    ...config,
    audit_enabled: "audit_enabled" in raw ? config.audit_enabled : true,
    rbac: {
      ...config.rbac,
      enabled: "enabled" in rawRbac ? config.rbac.enabled : true,
    },
    rate_limit: {
      ...config.rate_limit,
      enabled: "enabled" in rawRateLimit ? config.rate_limit.enabled : true,
    },
    audit: {
      ...config.audit,
      fail_closed: "fail_closed" in rawAudit ? config.audit.fail_closed : true,
    },
  };
}

/**
 * Load `.specky/config.yml` from workspace root. Returns defaults if the file
 * is absent, unparseable, or fails validation (a bad value never crashes the
 * server — it falls back to the safe defaults, with a stderr warning).
 *
 * `overrides` lets the server entry point (and tests) inject argv/env for
 * profile resolution instead of reading globals.
 */
export function loadConfig(workspaceRoot: string, overrides: ProfileOverrides = {}): SpeckyConfig {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    return finalizeConfig({ ...DEFAULT_CONFIG }, {}, overrides);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw) ?? {};
  } catch (err) {
    console.error(`[specky] Ignoring malformed .specky/config.yml: ${(err as Error).message}`);
    return finalizeConfig({ ...DEFAULT_CONFIG }, {}, overrides);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      `[specky] Ignoring invalid .specky/config.yml: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
    return finalizeConfig({ ...DEFAULT_CONFIG }, {}, overrides);
  }
  return finalizeConfig(result.data, parsed, overrides);
}

function finalizeConfig(
  config: SpeckyConfig,
  rawConfig: unknown,
  overrides: ProfileOverrides,
): SpeckyConfig {
  const profile = resolveProfile(config.profile, overrides);
  const resolved = { ...config, profile };
  return profile === "enterprise" ? applyEnterpriseDefaults(resolved, rawConfig) : resolved;
}
