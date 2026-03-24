import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "specky-config-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(tempDir);

    expect(config.templates_path).toBe("");
    expect(config.default_framework).toBe("vitest");
    expect(config.compliance_frameworks).toEqual(["general"]);
    expect(config.audit_enabled).toBe(false);
  });

  it("reads config from .specky/config.yml", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), [
      "templates_path: ./my-templates",
      "default_framework: jest",
      "compliance_frameworks: [hipaa, soc2, gdpr]",
      "audit_enabled: true",
    ].join("\n"));

    const config = loadConfig(tempDir);

    expect(config.templates_path).toBe("./my-templates");
    expect(config.default_framework).toBe("jest");
    expect(config.compliance_frameworks).toEqual(["hipaa", "soc2", "gdpr"]);
    expect(config.audit_enabled).toBe(true);
  });

  it("merges partial config with defaults", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), "default_framework: pytest\n");

    const config = loadConfig(tempDir);

    expect(config.default_framework).toBe("pytest");
    expect(config.templates_path).toBe(""); // default
    expect(config.compliance_frameworks).toEqual(["general"]); // default
    expect(config.audit_enabled).toBe(false); // default
  });

  it("handles comma-separated compliance frameworks", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), "compliance_frameworks: hipaa, pci_dss\n");

    const config = loadConfig(tempDir);

    expect(config.compliance_frameworks).toEqual(["hipaa", "pci_dss"]);
  });

  it("handles single compliance framework", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), "compliance_frameworks: soc2\n");

    const config = loadConfig(tempDir);

    expect(config.compliance_frameworks).toEqual(["soc2"]);
  });

  it("ignores comments and empty lines", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), [
      "# Specky configuration",
      "",
      "default_framework: playwright",
      "# audit_enabled: true",
    ].join("\n"));

    const config = loadConfig(tempDir);

    expect(config.default_framework).toBe("playwright");
    expect(config.audit_enabled).toBe(false);
  });

  it("handles malformed config gracefully", () => {
    const configDir = join(tempDir, ".specky");
    mkdirSync(configDir);
    writeFileSync(join(configDir, "config.yml"), "this is not valid yaml at all");

    const config = loadConfig(tempDir);
    // Should return defaults without crashing
    expect(config.default_framework).toBe("vitest");
  });
});
