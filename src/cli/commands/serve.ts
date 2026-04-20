/**
 * serve.ts — `specky serve` — launch the MCP server.
 *
 * This is the canonical entry point that replaces the legacy direct invocation
 * of `specky-sdd`. When the legacy bin name is used, the dispatcher forwards
 * to this command automatically.
 */

export interface ServeOptions {
  http: boolean;
  port?: number;
}

export async function runServe(opts: ServeOptions): Promise<number> {
  // We simply import the existing entry point which starts the MCP server.
  // Flags like --http are read from process.argv by the server module itself,
  // so we just set them back into argv for compatibility.
  const extra: string[] = [];
  if (opts.http) extra.push("--http");
  if (opts.port) process.env["PORT"] = String(opts.port);
  // Append any flags the server might look for
  process.argv.push(...extra);

  await import("../../index.js");
  // Server runs until signal; never returns.
  return 0;
}
