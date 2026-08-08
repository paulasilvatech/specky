import { createHash, randomUUID } from "node:crypto";
import {
    closeSync,
    fchmodSync,
    fchownSync,
    fsyncSync,
    linkSync,
    openSync,
    readFileSync,
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
    createWorkspaceConfig,
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

const legacyCatalogConfigSchema = z
    .object({
        version: packageVersionSchema,
        profile: configSchema.shape.profile.optional(),
        templates_path: configSchema.shape.templates_path.optional(),
        default_framework: z.string().optional(),
        update_check: configSchema.shape.update_check.optional(),
        compliance_frameworks: z.array(z.string()).optional(),
        audit_enabled: configSchema.shape.audit_enabled.optional(),
        rate_limit: configSchema.shape.rate_limit.partial().optional(),
        audit: configSchema.shape.audit.partial().optional(),
        rbac: configSchema.shape.rbac.partial().optional(),
        installation: configSchema.shape.installation.partial().optional(),
        pipeline: z.looseObject({
            require_lgtm: configSchema.shape.pipeline.shape.require_lgtm.optional(),
        }),
        hooks: z.record(z.string(), z.unknown()),
        specs_dir: configSchema.shape.spec_root,
        skills_dir: z.string(),
        branching: z.record(z.string(), z.unknown()),
        model_routing: z.record(z.string(), z.unknown()),
    })
    .strict();

const legacyPartialConfigSchema = z
    .object({
        profile: configSchema.shape.profile.optional(),
        templates_path: configSchema.shape.templates_path.optional(),
        default_framework: z.string().optional(),
        update_check: configSchema.shape.update_check.optional(),
        compliance_frameworks: z.array(z.string()).optional(),
        audit_enabled: configSchema.shape.audit_enabled.optional(),
        rate_limit: configSchema.shape.rate_limit.partial().optional(),
        audit: configSchema.shape.audit.partial().optional(),
        rbac: configSchema.shape.rbac.partial().optional(),
        installation: configSchema.shape.installation.partial().optional(),
        pipeline: configSchema.shape.pipeline.partial().optional(),
    })
    .strict();

const LEGACY_PARTIAL_KEYS = new Set(Object.keys(legacyPartialConfigSchema.shape));

export interface WorkspaceConfigMigration {
    source: string;
    packageVersion?: string;
    removedFields: readonly string[];
    sourceHash: string;
}

export interface WorkspaceConfigMigrationResult {
    config: SpeckyConfig;
    migration?: WorkspaceConfigMigration;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
}

function comparePackageVersions(left: string, right: string): number {
    const parseVersion = (value: string): number[] =>
        value
            .split("-", 1)[0]!
            .split(".")
            .map((part) => Number.parseInt(part, 10));
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);
    for (let index = 0; index < 3; index++) {
        const difference = leftParts[index]! - rightParts[index]!;
        if (difference !== 0) return difference;
    }
    return 0;
}

function supportsLegacyCatalog(version: string): boolean {
    return (
        comparePackageVersions(version, "3.4.0") >= 0 && comparePackageVersions(version, "3.11.1") < 0
    );
}

function supportsCompletePackageConfig(version: string): boolean {
    return (
        comparePackageVersions(version, "3.11.1") >= 0 && comparePackageVersions(version, "3.12.0") <= 0
    );
}

function obsoleteFields(config: {
    compliance_frameworks?: readonly string[];
    default_framework?: string;
}): string[] {
    return [
        ...(config.compliance_frameworks === undefined ? [] : ["compliance_frameworks"]),
        ...(config.default_framework === undefined ? [] : ["default_framework"]),
    ].sort((left, right) => left.localeCompare(right));
}

function migrateLegacyCatalog(
    parsed: Record<string, unknown>,
    configPath: string,
    sourceHash: string,
): WorkspaceConfigMigrationResult {
    const result = legacyCatalogConfigSchema.safeParse(parsed);
    if (!result.success) {
        throw new ConfigCompatibilityError(
            configPath,
            `legacy package catalog cannot be migrated automatically: ${formatConfigIssues(result.error)}`,
        );
    }

    const legacy = result.data;
    const profileSupported = comparePackageVersions(legacy.version, "3.5.0") >= 0;
    const installationSupported = comparePackageVersions(legacy.version, "3.11.0") >= 0;
    const pipelineSupported = comparePackageVersions(legacy.version, "3.6.0") >= 0;
    const updateCheckSupported = comparePackageVersions(legacy.version, "3.7.0") >= 0;
    const profile = profileSupported ? (legacy.profile ?? "standard") : "standard";
    const config = createWorkspaceConfig({
        profile,
        permissionProfile: installationSupported ? legacy.installation?.permission_profile : undefined,
        integrations: installationSupported ? legacy.installation?.integrations : undefined,
        requireLgtm: pipelineSupported ? legacy.pipeline.require_lgtm : undefined,
    });
    const migrated = configSchema.parse({
        ...config,
        spec_root: legacy.specs_dir,
        templates_path: legacy.templates_path ?? config.templates_path,
        update_check: updateCheckSupported
            ? (legacy.update_check ?? config.update_check)
            : config.update_check,
        audit_enabled: legacy.audit_enabled ?? config.audit_enabled,
        rate_limit: { ...config.rate_limit, ...legacy.rate_limit },
        audit: { ...config.audit, ...legacy.audit },
        rbac: { ...config.rbac, ...legacy.rbac },
        installation: installationSupported
            ? { ...config.installation, ...legacy.installation }
            : config.installation,
    });

    return {
        config: migrated,
        migration: {
            source: `package v${legacy.version}`,
            packageVersion: legacy.version,
            removedFields: obsoleteFields(legacy),
            sourceHash,
        },
    };
}

function migrateLegacyPartial(
    parsed: Record<string, unknown>,
    configPath: string,
    sourceHash: string,
): WorkspaceConfigMigrationResult {
    const result = legacyPartialConfigSchema.safeParse(parsed);
    if (!result.success) {
        throw new ConfigCompatibilityError(
            configPath,
            `unversioned v3.2.x-v3.3.x config cannot be migrated automatically: ${formatConfigIssues(result.error)}`,
        );
    }
    const legacy = result.data;
    const config = createWorkspaceConfig({
        profile: legacy.profile,
        permissionProfile: legacy.installation?.permission_profile,
        integrations: legacy.installation?.integrations,
        requireLgtm: legacy.pipeline?.require_lgtm,
    });
    const migrated = configSchema.parse({
        ...config,
        profile: legacy.profile ?? config.profile,
        templates_path: legacy.templates_path ?? config.templates_path,
        update_check: legacy.update_check ?? config.update_check,
        audit_enabled: legacy.audit_enabled ?? config.audit_enabled,
        rate_limit: { ...config.rate_limit, ...legacy.rate_limit },
        audit: { ...config.audit, ...legacy.audit },
        rbac: { ...config.rbac, ...legacy.rbac },
        installation: { ...config.installation, ...legacy.installation },
        pipeline: { ...config.pipeline, ...legacy.pipeline },
    });
    return {
        config: migrated,
        migration: {
            source: "unversioned Specky 3.x config",
            removedFields: obsoleteFields(legacy),
            sourceHash,
        },
    };
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "string" ? error.code : undefined;
}

function restoreDisplacedConfig(displacedPath: string, configPath: string): boolean {
    try {
        linkSync(displacedPath, configPath);
        unlinkSync(displacedPath);
        return true;
    } catch (error) {
        if (errorCode(error) === "EEXIST") return false;
        throw error;
    }
}

function stageConfig(configPath: string, content: string, tempPath: string): void {
    const metadata = statSync(configPath);
    try {
        const fileDescriptor = openSync(tempPath, "wx", metadata.mode & 0o777);
        try {
            writeFileSync(fileDescriptor, content, "utf8");
            if (process.platform !== "win32") {
                fchownSync(fileDescriptor, metadata.uid, metadata.gid);
            }
            fchmodSync(fileDescriptor, metadata.mode & 0o777);
            fsyncSync(fileDescriptor);
        } finally {
            closeSync(fileDescriptor);
        }
    } catch (error) {
        try {
            unlinkSync(tempPath);
        } catch {
            // The staged file may not have been created.
        }
        throw error;
    }
}

function assertHardLinkSupport(tempPath: string, probePath: string, configPath: string): void {
    try {
        linkSync(tempPath, probePath);
    } catch (error) {
        throw new ConfigCompatibilityError(
            configPath,
            `atomic config migration is unavailable on this filesystem (${String(errorCode(error) ?? "link failed")}); no migration was written`,
        );
    } finally {
        try {
            unlinkSync(probePath);
        } catch {
            // The capability probe may not have been linked.
        }
    }
}

function sameFile(leftPath: string, rightPath: string): boolean {
    try {
        const left = statSync(leftPath);
        const right = statSync(rightPath);
        return left.dev === right.dev && left.ino === right.ino;
    } catch {
        return false;
    }
}

function assertConfigHash(
    path: string,
    expectedHash: string,
    configPath: string,
    phase: "before" | "during",
): void {
    if (hashContent(readFileSync(path, "utf8")) === expectedHash) return;
    throw new ConfigCompatibilityError(
        configPath,
        `workspace config changed ${phase} migration commit`,
    );
}

function linkStagedConfig(tempPath: string, configPath: string): void {
    try {
        linkSync(tempPath, configPath);
    } catch (error) {
        if (errorCode(error) !== "EEXIST") throw error;
        throw new ConfigCompatibilityError(
            configPath,
            "workspace config was recreated during migration commit",
        );
    }
}

function rollbackConfigCommit(
    configPath: string,
    displacedPath: string,
    conflictPath: string,
    installed: boolean,
    error: unknown,
): void {
    let quarantined = false;
    if (installed) {
        try {
            renameSync(configPath, conflictPath);
            quarantined = true;
        } catch (renameError) {
            if (errorCode(renameError) !== "ENOENT") throw renameError;
        }
    }
    const restored = restoreDisplacedConfig(displacedPath, configPath);
    if (error instanceof ConfigCompatibilityError) {
        if (quarantined) error.message += `; conflicting content preserved at ${conflictPath}`;
        if (!restored) error.message += `; original preserved at ${displacedPath}`;
    }
}

function writeConfigAtomically(
    configPath: string,
    content: string,
    expectedHash: string,
    beforeInstall?: (configPath: string) => void,
    afterInstall?: (configPath: string) => void,
): string {
    const token = randomUUID();
    const tempPath = join(dirname(configPath), `.${basename(configPath)}.${token}.tmp`);
    const probePath = join(dirname(configPath), `.${basename(configPath)}.${token}.probe`);
    const displacedPath = join(dirname(configPath), `.${basename(configPath)}.${token}.original`);
    const conflictPath = join(dirname(configPath), `.${basename(configPath)}.${token}.conflict`);
    const backupPath = join(
        dirname(configPath),
        `${basename(configPath)}.before-schema-1.${token}.bak`,
    );

    stageConfig(configPath, content, tempPath);
    const migratedHash = hashContent(content);
    let displaced = false;
    let installed = false;
    try {
        assertHardLinkSupport(tempPath, probePath, configPath);
        renameSync(configPath, displacedPath);
        displaced = true;
        assertConfigHash(displacedPath, expectedHash, configPath, "before");
        beforeInstall?.(configPath);
        linkStagedConfig(tempPath, configPath);
        installed = true;
        afterInstall?.(configPath);
        assertConfigHash(displacedPath, expectedHash, configPath, "during");
        if (!sameFile(configPath, tempPath)) {
            throw new ConfigCompatibilityError(
                configPath,
                "workspace config was replaced during migration commit",
            );
        }
        assertConfigHash(configPath, migratedHash, configPath, "during");

        renameSync(displacedPath, backupPath);
        displaced = false;
        return backupPath;
    } catch (error) {
        if (displaced) rollbackConfigCommit(configPath, displacedPath, conflictPath, installed, error);
        throw error;
    } finally {
        try {
            unlinkSync(tempPath);
        } catch {
            // The staged inode may already be linked at the destination.
        }
    }
}

export function prepareWorkspaceConfig(workspaceRoot: string): WorkspaceConfigMigrationResult {
    const { configPath, raw, parsed } = readWorkspaceConfigFile(workspaceRoot);
    const sourceHash = hashContent(raw);
    if (!isRecord(parsed) || "schema_version" in parsed) {
        return { config: parseCurrentWorkspaceConfig(parsed, configPath) };
    }

    if (!("version" in parsed)) {
        const hasLegacyKey = Object.keys(parsed).some((key) => LEGACY_PARTIAL_KEYS.has(key));
        return hasLegacyKey
            ? migrateLegacyPartial(parsed, configPath, sourceHash)
            : { config: parseCurrentWorkspaceConfig(parsed, configPath) };
    }

    const version = packageVersionSchema.safeParse(parsed["version"]);
    if (!version.success) {
        throw new ConfigCompatibilityError(configPath, `version: ${formatConfigIssues(version.error)}`);
    }
    if (supportsLegacyCatalog(version.data)) {
        return migrateLegacyCatalog(parsed, configPath, sourceHash);
    }
    if (!supportsCompletePackageConfig(version.data)) {
        throw new ConfigCompatibilityError(
            configPath,
            `package-versioned config ${version.data} is outside the supported automatic migration range 3.4.0 through 3.12.0`,
        );
    }

    const result = legacyPackageVersionedConfigSchema.safeParse(parsed);
    if (!result.success) {
        throw new ConfigCompatibilityError(
            configPath,
            `legacy package-versioned config cannot be migrated automatically: ${formatConfigIssues(result.error)}`,
        );
    }
    const { version: packageVersion, ...settings } = result.data;
    return {
        config: configSchema.parse({ schema_version: CONFIG_SCHEMA_VERSION, ...settings }),
        migration: {
            source: `package v${packageVersion}`,
            packageVersion,
            removedFields: [],
            sourceHash,
        },
    };
}

export function persistWorkspaceConfigMigration(
    workspaceRoot: string,
    prepared: WorkspaceConfigMigrationResult | undefined,
    commitHooks: {
        beforeInstall?: (configPath: string) => void;
        afterInstall?: (configPath: string) => void;
    } = {},
): string | undefined {
    if (!prepared?.migration) return undefined;
    const configPath = join(workspaceRoot, ".specky", "config.yml");
    let currentHash: string;
    try {
        currentHash = hashContent(readFileSync(configPath, "utf8"));
    } catch {
        throw new ConfigCompatibilityError(
            configPath,
            "workspace config changed or disappeared while the upgrade was running; no migration was written",
        );
    }
    if (currentHash !== prepared.migration.sourceHash) {
        throw new ConfigCompatibilityError(
            configPath,
            "workspace config changed while the upgrade was running; no migration was written",
        );
    }
    const backupPath = writeConfigAtomically(
        configPath,
        serializeWorkspaceConfig(prepared.config),
        prepared.migration.sourceHash,
        commitHooks.beforeInstall,
        commitHooks.afterInstall,
    );
    invalidateConfigCache(workspaceRoot);
    return backupPath;
}
