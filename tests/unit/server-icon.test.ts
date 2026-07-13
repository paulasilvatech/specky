import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mcpServerIcons, resolvePackageRoot } from "../../src/utils/server-icon.js";

describe("server-icon", () => {
  it("resolves package root from this test module", () => {
    const root = resolvePackageRoot(import.meta.url);
    expect(existsSync(join(root, "package.json"))).toBe(true);
    expect(existsSync(join(root, "site", "specky-icon.png"))).toBe(true);
  });

  it("returns a file:// PNG icon with sizes for stdio MCP clients", () => {
    const root = resolvePackageRoot(import.meta.url);
    const icons = mcpServerIcons(root);
    expect(icons).toHaveLength(1);
    expect(icons[0]?.mimeType).toBe("image/png");
    expect(icons[0]?.src).toMatch(/^file:\/\//);
    expect(icons[0]?.sizes).toEqual(["48x48", "96x96", "128x128"]);
    expect(existsSync(fileURLToPath(icons[0]!.src))).toBe(true);
  });
});
