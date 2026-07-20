/**
 * vscode-settings-writer.test.ts — merging Specky-required keys into
 * .vscode/settings.json for the GitHub Copilot harness.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SPECKY_VSCODE_SETTINGS,
  writeVscodeSettings,
} from "../../src/cli/lib/vscode-settings-writer.js";

const ALL_KEYS = Object.keys(SPECKY_VSCODE_SETTINGS);

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "specky-vscode-settings-"));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function settingsPath(subdir = ".vscode"): string {
  return join(workspace, subdir, "settings.json");
}

function readWritten(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function seed(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

describe("SPECKY_VSCODE_SETTINGS", () => {
  it("declares the expected Copilot and MCP keys", () => {
    expect(SPECKY_VSCODE_SETTINGS).toEqual({
      "chat.mcp.enabled": true,
      "chat.mcp.discovery.enabled": true,
      "chat.agent.enabled": true,
      "github.copilot.chat.codeGeneration.useInstructionFiles": true,
    });
  });
});

describe("writeVscodeSettings", () => {
  it("creates the settings file and missing parent directories", () => {
    const path = settingsPath(join(".vscode", "nested"));
    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.path).toBe(path);
    expect(result.written).toBe(true);
    expect(result.addedKeys).toEqual(ALL_KEYS);
    expect(existsSync(path)).toBe(true);
    expect(readWritten(path)).toEqual(SPECKY_VSCODE_SETTINGS);
  });

  it("merges required keys into an existing settings file without touching unrelated keys", () => {
    const path = settingsPath();
    const existing = { "editor.tabSize": 2, "files.exclude": { "**/dist": true } };
    seed(path, JSON.stringify(existing));

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(true);
    expect(result.addedKeys).toEqual(ALL_KEYS);
    const written = readWritten(path);
    expect(written["editor.tabSize"]).toBe(2);
    expect(written["files.exclude"]).toEqual({ "**/dist": true });
    for (const [key, value] of Object.entries(SPECKY_VSCODE_SETTINGS)) {
      expect(written[key]).toBe(value);
    }
  });

  it("never overwrites user-authored values for Specky keys", () => {
    const path = settingsPath();
    const existing = { "chat.mcp.enabled": false };
    seed(path, JSON.stringify(existing));

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(true);
    expect(result.addedKeys).toEqual(ALL_KEYS.filter((k) => k !== "chat.mcp.enabled"));
    expect(readWritten(path)["chat.mcp.enabled"]).toBe(false);
  });

  it("writes nothing when all required keys already exist", () => {
    const path = settingsPath();
    const original = JSON.stringify({ ...SPECKY_VSCODE_SETTINGS, "chat.agent.enabled": false });
    seed(path, original);

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(false);
    expect(result.addedKeys).toEqual([]);
    // File content is untouched byte-for-byte.
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("parses JSONC with line and block comments", () => {
    const path = settingsPath();
    seed(
      path,
      [
        "{",
        '  // "chat.mcp.enabled": false should NOT be parsed,',
        '  "editor.tabSize": 4, /* block comment */',
        '  "string": "value with // not-a-comment and /* no-op */"',
        "}",
      ].join("\n"),
    );

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(true);
    expect(result.addedKeys).toEqual(ALL_KEYS);
    const written = readWritten(path);
    expect(written["editor.tabSize"]).toBe(4);
    expect(written["string"]).toBe("value with // not-a-comment and /* no-op */");
  });

  it("treats an empty file as having no settings", () => {
    const path = settingsPath();
    seed(path, "   \n");

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(true);
    expect(result.addedKeys).toEqual(ALL_KEYS);
  });

  it("returns written:false without touching an unparseable settings file", () => {
    const path = settingsPath();
    const garbage = "{ not valid json at all";
    seed(path, garbage);

    const result = writeVscodeSettings(path, { dryRun: false });

    expect(result.written).toBe(false);
    expect(result.addedKeys).toEqual([]);
    expect(readFileSync(path, "utf8")).toBe(garbage);
  });

  it("dry run reports the keys it would add without writing anything", () => {
    const path = settingsPath();

    const result = writeVscodeSettings(path, { dryRun: true });

    expect(result.written).toBe(false);
    expect(result.addedKeys).toEqual(ALL_KEYS);
    expect(existsSync(path)).toBe(false);
  });

  it("dry run against an existing file reports only missing keys and leaves it untouched", () => {
    const path = settingsPath();
    const original = JSON.stringify({ "chat.mcp.enabled": false });
    seed(path, original);

    const result = writeVscodeSettings(path, { dryRun: true });

    expect(result.written).toBe(false);
    expect(result.addedKeys).toEqual(ALL_KEYS.filter((k) => k !== "chat.mcp.enabled"));
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("writes trailing newline-terminated, 2-space-indented JSON", () => {
    const path = settingsPath();

    writeVscodeSettings(path, { dryRun: false });

    const raw = readFileSync(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toBe(JSON.stringify(SPECKY_VSCODE_SETTINGS, null, 2) + "\n");
  });
});
