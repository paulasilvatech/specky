#!/usr/bin/env node
/**
 * finalize-build.mjs — Post-tsc steps:
 *   1. Ensure every bin entry in dist/ has a Node shebang.
 *   2. Set executable bit (Unix only).
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BINS = [
  resolve(ROOT, "dist/index.js"),           // legacy MCP server entry
  resolve(ROOT, "dist/cli/index.js"),       // unified CLI
];

for (const file of BINS) {
  if (!existsSync(file)) {
    console.warn(`[finalize-build] skip missing ${file}`);
    continue;
  }
  const content = readFileSync(file, "utf8");
  if (!content.startsWith("#!")) {
    writeFileSync(file, "#!/usr/bin/env node\n" + content, "utf8");
    console.log(`[finalize-build] shebang -> ${file}`);
  }
  if (process.platform !== "win32") {
    try {
      chmodSync(file, 0o755);
    } catch (err) {
      console.warn(`[finalize-build] chmod failed for ${file}: ${err.message}`);
    }
  }
}

console.log("[finalize-build] done");
