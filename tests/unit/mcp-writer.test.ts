import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeMcpRegistration } from "../../src/cli/lib/mcp-writer.js";

describe("mcp-writer VS Code dual schema", () => {
  let workspace: string;

  afterEach(() => {
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("writes both servers and mcpServers for VS Code targets", () => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-mcp-writer-"));
    const path = resolve(workspace, ".vscode/mcp.json");
    writeMcpRegistration(path, { dryRun: false, useVscodeSchema: true });

    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      servers?: Record<string, unknown>;
      mcpServers?: Record<string, unknown>;
    };
    expect(parsed.servers?.specky).toBeDefined();
    expect(parsed.mcpServers?.specky).toBeDefined();
  });
});
