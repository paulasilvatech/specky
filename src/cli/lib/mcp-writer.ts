/**
 * mcp-writer.ts — Write MCP server registration into .vscode/mcp.json and .mcp.json.
 *
 * Both files follow similar schemas: `{ "mcpServers": { "<name>": { command, args } } }`.
 * We use `npx -y specky-sdd serve` so the user doesn't need a global install.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface McpServerEntry {
  command: string;
  args: string[];
}

interface McpConfig {
  mcpServers?: Record<string, McpServerEntry>;
  servers?: Record<string, McpServerEntry>;
  [k: string]: unknown;
}

const DEFAULT_SERVER: McpServerEntry = {
  command: "npx",
  args: ["-y", "specky-sdd@latest", "serve"],
};

function readJson(path: string): McpConfig {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as McpConfig;
  } catch (err) {
    throw new Error(`[specky] Cannot parse ${path}: ${(err as Error).message}`);
  }
}

function writeJson(path: string, data: McpConfig, dryRun: boolean): void {
  if (dryRun) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Merge a Specky server entry into the given MCP config file.
 * - VS Code mcp.json uses `{ "servers": { ... } }` (new schema) or
 *   `{ "mcpServers": { ... } }` (legacy). We write both to be safe.
 * - Claude .mcp.json uses `{ "mcpServers": { ... } }`.
 */
export function writeMcpRegistration(
  path: string,
  opts: { dryRun: boolean; serverName?: string; useVscodeSchema?: boolean },
): { path: string; written: boolean; action: "created" | "merged" | "unchanged" } {
  const name = opts.serverName ?? "specky";
  const existing = readJson(path);
  const before = JSON.stringify(existing);

  if (opts.useVscodeSchema) {
    existing.servers = existing.servers ?? {};
    existing.servers[name] = DEFAULT_SERVER;
  } else {
    existing.mcpServers = existing.mcpServers ?? {};
    existing.mcpServers[name] = DEFAULT_SERVER;
  }

  const after = JSON.stringify(existing);
  if (before === after) {
    return { path, written: false, action: "unchanged" };
  }
  const action: "created" | "merged" = existsSync(path) ? "merged" : "created";
  writeJson(path, existing, opts.dryRun);
  return { path, written: !opts.dryRun, action };
}
