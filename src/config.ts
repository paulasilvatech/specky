/**
 * SpeckyConfig — Optional `.specky/config.yml` support.
 * Reads project-local configuration and merges with defaults.
 *
 * Parsing uses the `yaml` library (safe by default — no code execution) and a
 * Zod schema for validation, replacing a hand-rolled line parser that could not
 * handle nested lists/quoting and did no validation.
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
      })
      .default({ export_format: "jsonl", max_file_size_mb: 10 }),
    rbac: z
      .object({
        enabled: z.boolean().default(false),
        default_role: z.enum(["viewer", "contributor", "admin"]).default("contributor"),
      })
      .default({ enabled: false, default_role: "contributor" }),
  })
  .strip();

export type SpeckyConfig = z.infer<typeof configSchema>;

const DEFAULT_CONFIG: SpeckyConfig = configSchema.parse({});

/**
 * Load `.specky/config.yml` from workspace root. Returns defaults if the file
 * is absent, unparseable, or fails validation (a bad value never crashes the
 * server — it falls back to the safe defaults, with a stderr warning).
 */
export function loadConfig(workspaceRoot: string): SpeckyConfig {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    return { ...DEFAULT_CONFIG };
  }

  let parsed: unknown;
  try {
    parsed = parse(raw) ?? {};
  } catch (err) {
    console.error(`[specky] Ignoring malformed .specky/config.yml: ${(err as Error).message}`);
    return { ...DEFAULT_CONFIG };
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      `[specky] Ignoring invalid .specky/config.yml: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
    return { ...DEFAULT_CONFIG };
  }
  return result.data;
}
