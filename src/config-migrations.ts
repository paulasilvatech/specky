import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import {
  ConfigCompatibilityError,
  configSchema,
  formatConfigIssues,
  invalidateConfigCache,
  parseCurrentWorkspaceConfig,
  readWorkspaceConfigFile,
  type SpeckyConfig,
  serializeWorkspaceConfig,
} from "./config.js";
import { CONFIG_SCHEMA_VERSION } from "./constants.js";

const packageVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "expected a Specky package version");

const legacyPackageVersionedConfigSchema = configSchema
  .omit({ schema_version: true })
  .extend({ version: packageVersionSchema })
  .strict();

export interface WorkspaceConfigMigrationResult {
  config: SpeckyConfig;
  migratedFromPackageVersion?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function writeConfigAtomically(configPath: string, content: string): void {
  const mode = statSync(configPath).mode & 0o777;
  const tempPath = join(dirname(configPath), `.${basename(configPath)}.${randomUUID()}.tmp`);

  try {
    const fileDescriptor = openSync(tempPath, "wx", mode);
    try {
      writeFileSync(fileDescriptor, content, "utf8");
      fsyncSync(fileDescriptor);
    } finally {
      closeSync(fileDescriptor);
    }
    renameSync(tempPath, configPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The rename may have completed, or the temporary file was never created.
    }
    throw error;
  }
}

export function prepareWorkspaceConfig(
  workspaceRoot: string,
  options: { write: boolean },
): WorkspaceConfigMigrationResult {
  const { configPath, parsed } = readWorkspaceConfigFile(workspaceRoot);
  if (!isRecord(parsed) || !("version" in parsed) || "schema_version" in parsed) {
    return { config: parseCurrentWorkspaceConfig(parsed, configPath) };
  }

  const result = legacyPackageVersionedConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigCompatibilityError(
      configPath,
      `legacy package-versioned config cannot be migrated automatically: ${formatConfigIssues(result.error)}`,
    );
  }

  const { version, ...settings } = result.data;
  const config = configSchema.parse({
    schema_version: CONFIG_SCHEMA_VERSION,
    ...settings,
  });

  if (options.write) {
    writeConfigAtomically(configPath, serializeWorkspaceConfig(config));
    invalidateConfigCache(workspaceRoot);
  }

  return { config, migratedFromPackageVersion: version };
}
