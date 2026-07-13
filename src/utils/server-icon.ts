/**
 * Resolve MCP server icons for stdio transports.
 * VS Code and Cursor require file:// or data: URIs — HTTPS URLs are ignored.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface McpServerIcon {
  src: string;
  mimeType: string;
  sizes: string[];
}

/** Walk up from a module file until package.json is found. */
export function resolvePackageRoot(fromModuleUrl: string): string {
  let cur = dirname(fileURLToPath(fromModuleUrl));
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(cur, "package.json"))) return cur;
    cur = resolve(cur, "..");
  }
  throw new Error("[specky] Could not locate package root");
}

/** PNG icon shipped at site/specky-icon.png in the npm package. */
export function mcpServerIcons(pkgRoot: string): McpServerIcon[] {
  const pngPath = join(pkgRoot, "site", "specky-icon.png");
  if (!existsSync(pngPath)) return [];
  return [
    {
      src: pathToFileURL(pngPath).href,
      mimeType: "image/png",
      sizes: ["48x48", "96x96", "128x128"],
    },
  ];
}
