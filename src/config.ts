/**
 * SpeckyConfig — Optional `.specky/config.yml` support.
 * Reads project-local configuration and merges with defaults.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface SpeckyConfig {
  templates_path?: string;
  default_framework?: string;
  compliance_frameworks?: string[];
  audit_enabled?: boolean;
}

const DEFAULTS: Required<SpeckyConfig> = {
  templates_path: "",
  default_framework: "vitest",
  compliance_frameworks: ["general"],
  audit_enabled: false,
};

/**
 * Load `.specky/config.yml` from workspace root. Returns defaults if not found.
 * Uses simple YAML key-value parsing (no dependency on yaml library).
 */
export function loadConfig(workspaceRoot: string): Required<SpeckyConfig> {
  const configPath = join(workspaceRoot, ".specky", "config.yml");
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parseSimpleYaml(raw);
    return {
      templates_path: typeof parsed["templates_path"] === "string" ? parsed["templates_path"] : DEFAULTS.templates_path,
      default_framework: typeof parsed["default_framework"] === "string" ? parsed["default_framework"] : DEFAULTS.default_framework,
      compliance_frameworks: parseArrayValue(parsed["compliance_frameworks"]) || DEFAULTS.compliance_frameworks,
      audit_enabled: parsed["audit_enabled"] === "true" || parsed["audit_enabled"] === true ? true : DEFAULTS.audit_enabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function parseSimpleYaml(raw: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (value === "true") result[key] = true;
    else if (value === "false") result[key] = false;
    else result[key] = value;
  }
  return result;
}

function parseArrayValue(value: unknown): string[] | null {
  if (typeof value !== "string" || !value) return null;
  // Handle inline YAML array: [item1, item2]
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean);
  }
  // Handle comma-separated
  if (value.includes(",")) {
    return value.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [value];
}
