#!/usr/bin/env node
/**
 * cli/index.ts — Specky unified CLI entry point.
 *
 * Subcommands:
 *   specky init   [--target=TARGET[,TARGET...]] [--force] [--dry-run]
 *   specky compile [--target=TARGET[,TARGET...]] [--dry-run]
 *   specky doctor [--fix] [--verbose]
 *   specky status
 *   specky upgrade
 *   specky hooks  <list|test|run NAME>
 *   specky apm    <validate|lock|verify-lock|policy|audit|sbom>
 *   specky serve  [--http] [--port=N] [--profile=enterprise]
 *   specky --version | -v
 *   specky --help  | -h
 *
 * Backwards compat:
 *   Invoking as `specky-sdd` with no subcommand OR with `--http` maps to
 *   `specky serve`. This preserves existing MCP client configs that use
 *   `npx -y specky-sdd`.
 */
import { basename } from "node:path";
import { VERSION } from "../constants.js";

type ArgMap = Record<string, string | boolean>;

function parseFlags(args: string[]): { positional: string[]; flags: ArgMap } {
  const positional: string[] = [];
  const flags: ArgMap = {};
  for (const a of args) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = true;
      }
    } else if (a.startsWith("-") && a.length > 1) {
      flags[a.slice(1)] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function printHelp(): void {
  console.log(`Specky v${VERSION} — Spec-Driven Development CLI

Usage:
  specky <command> [options]

Commands:
  install                Install Specky assets into the current workspace
  init                   Alias of 'install' (same command)
    --target=<targets>                  comma-list: copilot, claude, cursor,
                                        opencode, agent-skills, both, all, auto
    --ide=<claude|copilot|both|auto>   Default: auto
                                        Deprecated alias for --target
    --force                             Overwrite existing files
    --dry-run                           Show changes without writing

  doctor                 Validate install integrity against install.lock
    --fix                               Repair missing/modified files
    --verbose                           Show all tracked files

  status                 Show install + pipeline status

  compile                Compile instruction primitives into root context files
    --target=<targets>                  comma-list: copilot, claude, cursor,
                                        opencode, agent-skills, both, all
    --dry-run                           Show output paths without writing

  upgrade                Refresh installed assets (preserves .specs/)

  hooks <list|test|run NAME>
                         Manage installed hooks

  apm <validate|lock|verify-lock|policy|audit|sbom>
                         Validate APM manifest, lock primitives, enforce
                         governance policy, and export primitive SBOM

  serve                  Start the MCP server (stdio by default)
    --http                              HTTP streaming transport
    --port=<N>                          HTTP port (default 3200)
    --host=<addr>                       HTTP bind address (default 127.0.0.1;
                                        set 0.0.0.0 only behind an auth proxy)
    --profile=<standard|enterprise>     Config profile (enterprise defaults
                                        audit/RBAC/rate-limit to ON)

  --version, -v          Print version
  --help, -h             Print this help

Documentation:  https://github.com/paulasilvatech/specky
`);
}

async function dispatch(command: string, rest: string[]): Promise<number> {
  const { positional, flags } = parseFlags(rest);

  switch (command) {
    case "install":
    case "init": {
      const { runInit } = await import("./commands/init.js");
      const ideRaw = flags["ide"];
      const targetRaw = flags["target"];
      const ide = typeof ideRaw === "string" ? (ideRaw as "claude" | "copilot" | "both" | "auto") : "auto";
      return runInit({
        ide,
        target: typeof targetRaw === "string" ? targetRaw : undefined,
        force: flags["force"] === true,
        dryRun: flags["dry-run"] === true,
      });
    }
    case "doctor": {
      const { runDoctor } = await import("./commands/doctor.js");
      return runDoctor({
        fix: flags["fix"] === true,
        verbose: flags["verbose"] === true,
      });
    }
    case "status": {
      const { runStatus } = await import("./commands/status.js");
      return runStatus({});
    }
    case "compile": {
      const { runCompile } = await import("./commands/compile.js");
      const targetRaw = flags["target"];
      return runCompile({
        target: typeof targetRaw === "string" ? targetRaw : undefined,
        dryRun: flags["dry-run"] === true,
      });
    }
    case "upgrade": {
      const { runUpgrade } = await import("./commands/upgrade.js");
      return runUpgrade({ keepSpecs: flags["keep-specs"] === true });
    }
    case "hooks": {
      const { runHooks } = await import("./commands/hooks.js");
      const action = (positional[0] ?? "list") as "list" | "test" | "run";
      return runHooks({ action, name: positional[1] });
    }
    case "apm": {
      const { apmCommand } = await import("./commands/apm.js");
      return apmCommand(positional);
    }
    case "serve": {
      const { runServe } = await import("./commands/serve.js");
      const portFlag = flags["port"];
      return runServe({
        http: flags["http"] === true,
        port: typeof portFlag === "string" ? Number(portFlag) : undefined,
      });
    }
    case "help":
    case "--help":
    case "-h": {
      printHelp();
      return 0;
    }
    case "--version":
    case "-v": {
      console.log(`specky v${VERSION}`);
      return 0;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      console.error(`Run \`specky --help\` for usage.`);
      return 2;
    }
  }
}

/**
 * Commands after which the once-daily update banner may print. `serve` (and
 * the legacy serve routing) is deliberately absent — the MCP server makes
 * zero outbound calls, ever.
 */
const UPDATE_BANNER_COMMANDS = new Set([
  "install", "init", "doctor", "status", "upgrade", "--version", "-v",
]);

/**
 * Best-effort update banner (Layer 2 of update awareness). Runs AFTER the
 * command so it can never delay or corrupt command output, prints to stderr
 * only, and swallows every failure — the command's exit code is untouched.
 */
async function maybePrintUpdateBanner(command: string): Promise<void> {
  if (!UPDATE_BANNER_COMMANDS.has(command)) return;
  try {
    const { loadConfig } = await import("../config.js");
    // Workspace-level hard disable (.specky/config.yml). Absent file → default true.
    if (!loadConfig(process.cwd()).update_check) return;
    const { checkForUpdate } = await import("./lib/update-check.js");
    const latest = await checkForUpdate({});
    if (latest) {
      console.error(
        `Update available: specky-sdd v${VERSION} → v${latest}  →  npm install -g specky-sdd@latest && specky upgrade`,
      );
    }
  } catch {
    // Never let the update check affect the command outcome.
  }
}

async function main(): Promise<void> {
  const binName = basename(process.argv[1] ?? "specky");
  const args = process.argv.slice(2);
  const isLegacyBin = binName === "specky-sdd" || binName.endsWith("specky-sdd");

  // Legacy back-compat: `specky-sdd` with no subcommand OR with --http maps to serve
  const knownCommands = new Set([
    "install", "init", "doctor", "status", "compile", "upgrade", "hooks", "apm", "serve",
    "help", "--help", "-h", "--version", "-v",
  ]);

  const firstArg = args[0];
  const hasKnownCommand = firstArg !== undefined && knownCommands.has(firstArg);

  let command: string;
  let rest: string[];
  if (hasKnownCommand) {
    command = firstArg!;
    rest = args.slice(1);
  } else if (isLegacyBin || firstArg === "--http") {
    // Legacy: route directly to serve
    command = "serve";
    rest = args;
  } else if (firstArg === undefined) {
    command = "help";
    rest = [];
  } else {
    command = firstArg;
    rest = args.slice(1);
  }

  try {
    const code = await dispatch(command, rest);
    if (typeof code === "number" && command !== "serve") {
      await maybePrintUpdateBanner(command);
      process.exit(code);
    }
  } catch (err) {
    console.error("[specky] Fatal error:", (err as Error).message);
    if (process.env["SPECKY_DEBUG"]) console.error((err as Error).stack);
    process.exit(1);
  }
}

main();
