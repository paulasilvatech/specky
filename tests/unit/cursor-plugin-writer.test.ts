import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURSOR_PLUGIN_LOGO,
  writeCursorPluginManifest,
} from "../../src/cli/lib/cursor-plugin-writer.js";
import { packageRoot } from "../../src/cli/lib/paths.js";

describe("cursor-plugin-writer", () => {
  let workspace: string;

  afterEach(() => {
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("writes plugin manifest and copies logo for Cursor Agent Plugins UI", () => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-cursor-plugin-"));
    const pkg = packageRoot();

    const result = writeCursorPluginManifest(workspace, pkg, { dryRun: false });
    expect(result.action).toBe("created");

    const manifestPath = resolve(workspace, ".cursor-plugin/plugin.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name: string;
      logo: string;
      mcpServers: string;
    };
    expect(manifest.name).toBe("specky");
    expect(manifest.logo).toBe(CURSOR_PLUGIN_LOGO);
    expect(manifest.mcpServers).toBe(".cursor/mcp.json");

    const logoPath = resolve(workspace, CURSOR_PLUGIN_LOGO);
    expect(existsSync(logoPath)).toBe(true);
  });
});
