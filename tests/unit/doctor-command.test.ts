import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDoctor } from "../../src/cli/commands/doctor.js";
import { runInit } from "../../src/cli/commands/init.js";
import { hashFile } from "../../src/cli/lib/asset-copier.js";
import { SPECKY_REQUIRED_ALLOWS } from "../../src/cli/lib/settings-merger.js";
import { createWorkspaceConfig, serializeWorkspaceConfig } from "../../src/config.js";
import { STATE_FILE, VERSION } from "../../src/constants.js";

// --- Module mocks ---------------------------------------------------------

// Isolate --fix repair from the real init pipeline.
vi.mock("../../src/cli/commands/init.js", () => ({
  runInit: vi.fn(async () => 0),
}));

// --- Helpers ---------------------------------------------------------------

function makeWorkspace(): string {
  return mkdtempSync(resolve(tmpdir(), "specky-doctor-"));
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Write a valid strict workspace config at .specky/config.yml. */
function writeWorkspaceConfig(workspace: string): void {
  writeFile(
    resolve(workspace, ".specky/config.yml"),
    serializeWorkspaceConfig(createWorkspaceConfig()),
  );
}

/** Create a file under .specky and return its lock entry [rel, sha256]. */
function trackFile(workspace: string, rel: string, content: string): [string, string] {
  const abs = resolve(workspace, ".specky", rel);
  writeFile(abs, content);
  return [rel, hashFile(abs)];
}

function writeLock(workspace: string, entries: Array<[string, string]>): void {
  writeJson(resolve(workspace, ".specky/install.lock"), {
    version: VERSION,
    generated_at: new Date().toISOString(),
    files: Object.fromEntries(entries),
  });
}

function writeInstallMeta(workspace: string, meta: Record<string, unknown>): void {
  writeJson(resolve(workspace, ".specky/install.json"), {
    version: VERSION,
    installed_at: new Date().toISOString(),
    ...meta,
  });
}

/** Seed the .claude tree and .mcp.json so every Claude install check passes. */
function seedClaudeInstall(workspace: string): void {
  writeJson(resolve(workspace, ".mcp.json"), {
    mcpServers: { specky: { command: "specky", args: ["serve"] } },
  });
  writeJson(resolve(workspace, ".claude/settings.json"), {
    permissions: { allow: [...SPECKY_REQUIRED_ALLOWS] },
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "specky run hook" }] }],
    },
  });
  for (let i = 1; i <= 13; i++) {
    writeFile(resolve(workspace, `.claude/agents/specky-agent-${i}.md`), `# agent ${i}\n`);
  }
  for (let i = 1; i <= 22; i++) {
    writeFile(resolve(workspace, `.claude/commands/specky-cmd-${i}.md`), `# command ${i}\n`);
  }
  for (let i = 1; i <= 14; i++) {
    mkdirSync(resolve(workspace, `.claude/skills/specky-skill-${i}`), { recursive: true });
  }
  for (let i = 1; i <= 16; i++) {
    writeFile(resolve(workspace, `.claude/hooks/scripts/hook-${i}.sh`), "exit 0\n");
  }
  writeFile(resolve(workspace, ".claude/rules/specky-sdd.md"), "# rule\n");
}

/**
 * Seed a fully healthy workspace: valid config, claude target assets, and an
 * install.lock whose checksums match everything on disk.
 */
function seedHealthyWorkspace(workspace: string): void {
  writeWorkspaceConfig(workspace);
  writeInstallMeta(workspace, { targets: ["claude"] });
  seedClaudeInstall(workspace);
  writeLock(workspace, [
    // Track the real config.yml so the lock matches what loadConfig parses.
    ["config.yml", hashFile(resolve(workspace, ".specky/config.yml"))],
    trackFile(workspace, "assets/guide.md", "# guide\n"),
  ]);
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let workspace: string;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  workspace = makeWorkspace();
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// --- runDoctor -------------------------------------------------------------

describe("runDoctor", () => {
  it("exits 2 when install.lock is missing", async () => {
    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("No install.lock"));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("npx specky init"));
  });

  it("passes a healthy install with a matching install.lock", async () => {
    seedHealthyWorkspace(workspace);

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`Lock version: ${VERSION}`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Files tracked: 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Target scope: claude"));
    expect(logSpy).toHaveBeenCalledWith("[specky doctor] ✅ Install is healthy.");
  });

  it("detects checksum mismatches and exits 1", async () => {
    seedHealthyWorkspace(workspace);
    writeFile(resolve(workspace, ".specky/assets/guide.md"), "local edits\n");

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("Modified files (local edits detected):");
    expect(logSpy).toHaveBeenCalledWith("  - assets/guide.md");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Repair: `npx specky init --force`"),
    );
  });

  it("detects tracked files missing from disk", async () => {
    seedHealthyWorkspace(workspace);
    rmSync(resolve(workspace, ".specky/assets/guide.md"));

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("Missing files:");
    expect(logSpy).toHaveBeenCalledWith("  - assets/guide.md");
  });

  it("ignores lock entries that resolve to directories", async () => {
    writeWorkspaceConfig(workspace);
    writeInstallMeta(workspace, { targets: [] });
    mkdirSync(resolve(workspace, ".specky/assets"), { recursive: true });
    writeLock(workspace, [["assets", "deadbeef"]]);

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Files tracked: 1"));
  });

  it("prints the integrity summary and per-file lists in verbose mode", async () => {
    seedHealthyWorkspace(workspace);
    writeFile(resolve(workspace, ".specky/assets/guide.md"), "local edits\n");

    const code = await runDoctor({ fix: false, verbose: true, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("✅ OK:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("✏️  Modified: 1"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("❌ Missing:  0"));
    expect(logSpy).toHaveBeenCalledWith("  - assets/guide.md");
  });

  it("--fix re-runs init with force against the resolved targets", async () => {
    seedHealthyWorkspace(workspace);
    rmSync(resolve(workspace, ".specky/assets/guide.md"));
    const runInitMock = vi.mocked(runInit);
    runInitMock.mockClear();
    runInitMock.mockResolvedValue(0);

    const code = await runDoctor({ fix: true, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("--fix requested"));
    expect(runInitMock).toHaveBeenCalledWith({
      force: true,
      dryRun: false,
      target: "claude",
      workspace,
    });
  });

  it("--fix propagates a non-zero exit code from init", async () => {
    seedHealthyWorkspace(workspace);
    rmSync(resolve(workspace, ".specky/assets/guide.md"));
    const runInitMock = vi.mocked(runInit);
    runInitMock.mockClear();
    runInitMock.mockResolvedValue(3);

    await expect(runDoctor({ fix: true, verbose: false, workspace })).resolves.toBe(3);
  });

  it("does not invoke init without --fix", async () => {
    seedHealthyWorkspace(workspace);
    rmSync(resolve(workspace, ".specky/assets/guide.md"));
    const runInitMock = vi.mocked(runInit);
    runInitMock.mockClear();

    await runDoctor({ fix: false, verbose: false, workspace });

    expect(runInitMock).not.toHaveBeenCalled();
  });

  it("fails configuration checks when target directories are missing", async () => {
    writeWorkspaceConfig(workspace);
    writeInstallMeta(workspace, { targets: ["claude"] });
    writeLock(workspace, []);

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    // .mcp.json missing, no agents/commands/skills/hooks directories on disk.
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("file missing"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Claude agents"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("0/13 present"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("0/22 present"));
  });

  it("warns about version drift between installed assets and the CLI", async () => {
    writeWorkspaceConfig(workspace);
    writeInstallMeta(workspace, { version: "0.0.0-ancient", targets: [] });
    writeLock(workspace, []);

    await runDoctor({ fix: false, verbose: false, workspace });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Version drift: installed assets are v0.0.0-ancient but this CLI is v${VERSION}`,
      ),
    );
  });

  it("fails when the workspace config is missing", async () => {
    writeInstallMeta(workspace, { targets: [] });
    writeLock(workspace, []);

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Workspace config"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("file is required"));
  });

  it("maps a legacy ide field in install.json to targets", async () => {
    writeWorkspaceConfig(workspace);
    writeInstallMeta(workspace, { ide: "copilot" });
    writeLock(workspace, []);

    await runDoctor({ fix: false, verbose: false, workspace });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Target scope: copilot (recorded as legacy ide=copilot"),
    );
  });

  it("infers targets from workspace signals without install metadata", async () => {
    writeWorkspaceConfig(workspace);
    mkdirSync(resolve(workspace, ".claude"), { recursive: true });
    writeLock(workspace, []);

    await runDoctor({ fix: false, verbose: false, workspace });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("inferred from workspace signals"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Target scope: claude"));
  });

  it("reports an empty target scope when nothing is installed", async () => {
    writeWorkspaceConfig(workspace);
    writeLock(workspace, []);

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("no install metadata or IDE signals found"),
    );
  });

  it("detects legacy root feature state", async () => {
    seedHealthyWorkspace(workspace);
    writeJson(resolve(workspace, `.specs/${STATE_FILE}`), { version: "5.0.0" });

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("legacy root state detected"));
  });

  it("accepts the canonical per-feature signed state layout", async () => {
    seedHealthyWorkspace(workspace);
    writeJson(resolve(workspace, `.specs/001-demo/${STATE_FILE}`), { version: "5.0.0" });
    writeFile(resolve(workspace, `.specs/001-demo/${STATE_FILE}.sig`), "signature\n");

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("canonical per-feature layout"));
  });

  it("flags feature directories missing signed state", async () => {
    seedHealthyWorkspace(workspace);
    writeJson(resolve(workspace, `.specs/002-unsigned/${STATE_FILE}`), { version: "5.0.0" });

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("002-unsigned: missing signed state"),
    );
  });

  it("flags feature state with the wrong version", async () => {
    seedHealthyWorkspace(workspace);
    writeJson(resolve(workspace, `.specs/003-stale/${STATE_FILE}`), { version: "4.2.0" });
    writeFile(resolve(workspace, `.specs/003-stale/${STATE_FILE}.sig`), "signature\n");

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("003-stale: version 4.2.0"));
  });

  it("requires the GitHub MCP entry when the github integration is recorded", async () => {
    seedHealthyWorkspace(workspace);
    writeInstallMeta(workspace, { targets: ["claude"], integrations: ["github"] });
    // Re-lock so install.json changes are not part of integrity anyway.
    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("github entry missing"));

    // Registering the github server clears the failure.
    writeJson(resolve(workspace, ".mcp.json"), {
      mcpServers: {
        specky: { command: "specky", args: ["serve"] },
        github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
      },
    });
    await expect(runDoctor({ fix: false, verbose: false, workspace })).resolves.toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("GitHub MCP registered"));
  });

  it("passes the prompt permission profile without allow rules", async () => {
    seedHealthyWorkspace(workspace);
    writeInstallMeta(workspace, { targets: ["claude"], permission_profile: "prompt" });
    writeJson(resolve(workspace, ".claude/settings.json"), {
      permissions: { allow: [] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "specky run hook" }] }],
      },
    });

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("prompt profile"));
  });

  it("fails when required Claude allow rules are missing", async () => {
    seedHealthyWorkspace(workspace);
    writeJson(resolve(workspace, ".claude/settings.json"), {
      permissions: { allow: ["Read"] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "specky run hook" }] }],
      },
    });

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("missing"));
  });

  it("skips Claude hooks enforcement on Copilot co-installs", async () => {
    seedHealthyWorkspace(workspace);
    writeInstallMeta(workspace, { targets: ["claude", "copilot"] });
    // Strip hooks from settings — tolerated because copilot co-install strips them.
    writeJson(resolve(workspace, ".claude/settings.json"), {
      permissions: { allow: [...SPECKY_REQUIRED_ALLOWS] },
    });

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(1); // copilot target dirs are absent, but hooks pass
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("intentionally omitted (Copilot co-install"),
    );
  });

  it("uses the current working directory when no workspace is given", async () => {
    const original = process.cwd();
    process.chdir(workspace);
    try {
      const code = await runDoctor({ fix: false, verbose: false });
      expect(code).toBe(2);
      // process.cwd() resolves macOS /var symlinks, so compare against it directly.
      expect(logSpy).toHaveBeenCalledWith(`[specky doctor] Workspace: ${process.cwd()}`);
    } finally {
      process.chdir(original);
    }
  });

  it("reads assets from disk only for lock-tracked files", async () => {
    seedHealthyWorkspace(workspace);
    // An untracked extra file inside .specky must not affect integrity.
    writeFile(resolve(workspace, ".specky/scratch.txt"), "untracked\n");

    const code = await runDoctor({ fix: false, verbose: false, workspace });

    expect(code).toBe(0);
    expect(existsSync(resolve(workspace, ".specky/scratch.txt"))).toBe(true);
  });
});
