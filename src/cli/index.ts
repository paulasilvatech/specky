#!/usr/bin/env node
/**
 * cli/index.ts — Specky unified CLI entry point.
 *
 * Subcommands:
 *   specky init   [--ide=claude|copilot|both|auto] [--force] [--dry-run]
 *   specky doctor [--fix] [--verbose]
 *   specky status
 *   specky upgrade
 *   specky hooks  <list|test|run NAME>
 *   specky serve  [--http] [--port=N]
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
    --ide=<claude|copilot|both|auto>   Default: auto
    --force                             Overwrite existing files
    --dry-run                           Show changes without writing

  doctor                 Validate install integrity against install.lock
    --fix                               Repair missing/modified files
    --verbose                           Show all tracked files

  status                 Show install + pipeline status

  upgrade                Refresh installed assets (preserves .specs/)

  hooks <list|test|run NAME>
                         Manage installed hooks

  serve                  Start the MCP server (stdio by default)
    --http                              HTTP streaming transport
    --port=<N>                          HTTP port (default 3001)

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
      const ide = typeof ideRaw === "string" ? (ideRaw as "claude" | "copilot" | "both" | "auto") : "auto";
      return runInit({
        ide,
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
    case "upgrade": {
      const { runUpgrade } = await import("./commands/upgrade.js");
      return runUpgrade({ keepSpecs: flags["keep-specs"] === true });
    }
    case "hooks": {
      const { runHooks } = await import("./commands/hooks.js");
      const action = (positional[0] ?? "list") as "list" | "test" | "run";
      return runHooks({ action, name: positional[1] });
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

async function main(): Promise<void> {
  const binName = basename(process.argv[1] ?? "specky");
  const args = process.argv.slice(2);
  const isLegacyBin = binName === "specky-sdd" || binName.endsWith("specky-sdd");

  // Legacy back-compat: `specky-sdd` with no subcommand OR with --http maps to serve
  const knownCommands = new Set([
    "install", "init", "doctor", "status", "upgrade", "hooks", "serve",
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
      process.exit(code);
    }
  } catch (err) {
    console.error("[specky] Fatal error:", (err as Error).message);
    if (process.env["SPECKY_DEBUG"]) console.error((err as Error).stack);
    process.exit(1);
  }
}

main();
