import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apmCommand } from "../../src/cli/commands/apm.js";
import { runHooks } from "../../src/cli/commands/hooks.js";
import { runInit } from "../../src/cli/commands/init.js";
import { runServe } from "../../src/cli/commands/serve.js";
import { runUpgrade } from "../../src/cli/commands/upgrade.js";

const REPO = resolve(import.meta.dirname, "../..");

// --- Module mocks ---------------------------------------------------------

// Prevent the MCP server entry point from actually starting during runServe.
vi.mock("../../src/index.js", () => ({}));

// Isolate runUpgrade from the real init pipeline.
vi.mock("../../src/cli/commands/init.js", () => ({
  runInit: vi.fn(async () => 0),
}));

// Redirect packageRoot() to a temp copy so `apm lock` never writes into the repo.
const { apmRootRef } = vi.hoisted(() => ({ apmRootRef: { current: "" } }));
vi.mock("../../src/cli/lib/paths.js", async (importActual) => {
  const actual = await importActual<typeof import("../../src/cli/lib/paths.js")>();
  return { ...actual, packageRoot: () => apmRootRef.current };
});

// --- Helpers ---------------------------------------------------------------

function makeWorkspace(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

function makeApmRoot(): string {
  const root = makeWorkspace("specky-apm-cmd-");
  for (const name of [".apm", "package.json", "apm.yml", "apm-policy.yml"]) {
    cpSync(resolve(REPO, name), resolve(root, name), { recursive: true });
  }
  return root;
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- runServe ---------------------------------------------------------------

describe("runServe", () => {
  let savedArgv: string[];
  let savedPort: string | undefined;

  beforeEach(() => {
    savedArgv = [...process.argv];
    savedPort = process.env.PORT;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.argv = savedArgv;
    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
  });

  it("returns 0 with default options and leaves PORT unset", async () => {
    const code = await runServe({ http: false });
    expect(code).toBe(0);
    expect(process.env.PORT).toBeUndefined();
    expect(process.argv.includes("--http")).toBe(false);
  });

  it("forwards --http and PORT for custom options", async () => {
    const code = await runServe({ http: true, port: 4321 });
    expect(code).toBe(0);
    expect(process.argv.includes("--http")).toBe(true);
    expect(process.env.PORT).toBe("4321");
  });
});

// --- runUpgrade --------------------------------------------------------------

describe("runUpgrade", () => {
  let workspace: string;
  const runInitMock = vi.mocked(runInit);

  beforeEach(() => {
    workspace = makeWorkspace("specky-upgrade-");
    runInitMock.mockClear();
    runInitMock.mockResolvedValue(0);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("runs init with ide=auto when no previous install exists", async () => {
    const code = await runUpgrade({ keepSpecs: true, workspace });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No previous install detected"));
    expect(runInitMock).toHaveBeenCalledWith({
      force: true,
      dryRun: false,
      ide: "auto",
      target: undefined,
      workspace,
    });
  });

  it("re-detects the IDE from install.json metadata", async () => {
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "1.0.0", ide: "claude" }),
    );

    await runUpgrade({ keepSpecs: true, workspace });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Previous version: v1.0.0, ide=claude"),
    );
    expect(runInitMock).toHaveBeenCalledWith(
      expect.objectContaining({ ide: "claude", target: undefined }),
    );
  });

  it("prefers stored targets over the ide field", async () => {
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    writeFileSync(
      resolve(workspace, ".specky/install.json"),
      JSON.stringify({ version: "1.0.0", ide: "claude", targets: ["cursor", "claude"] }),
    );

    await runUpgrade({ keepSpecs: true, workspace });
    expect(runInitMock).toHaveBeenCalledWith(
      expect.objectContaining({ ide: "auto", target: "cursor,claude" }),
    );
  });

  it("tolerates unreadable install metadata", async () => {
    mkdirSync(resolve(workspace, ".specky"), { recursive: true });
    writeFileSync(resolve(workspace, ".specky/install.json"), "not-json{");

    const code = await runUpgrade({ keepSpecs: true, workspace });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Previous install metadata unreadable"),
    );
    expect(runInitMock).toHaveBeenCalledWith(expect.objectContaining({ ide: "auto" }));
  });

  it("propagates a non-zero exit code from init", async () => {
    runInitMock.mockResolvedValue(3);
    await expect(runUpgrade({ keepSpecs: true, workspace })).resolves.toBe(3);
  });
});

// --- runHooks ----------------------------------------------------------------

describe("runHooks", () => {
  let workspace: string;
  let hooksDir: string;

  function writeHook(name: string, body: string): void {
    writeFileSync(resolve(hooksDir, name), body);
  }

  beforeEach(() => {
    workspace = makeWorkspace("specky-hooks-");
    hooksDir = resolve(workspace, ".claude/hooks/scripts");
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("fails with exit 2 when no hooks directory exists", async () => {
    const code = await runHooks({ action: "list", workspace });
    expect(code).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("No hooks directory found"));
  });

  it("lists discovered hook scripts", async () => {
    mkdirSync(hooksDir, { recursive: true });
    writeHook("a.mjs", "process.exit(0);\n");
    writeHook("b.sh", "exit 0\n");
    writeHook("ignored.txt", "nope\n");

    const code = await runHooks({ action: "list", workspace });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("2 hook(s):");
    expect(logSpy).toHaveBeenCalledWith("  a.mjs");
    expect(logSpy).toHaveBeenCalledWith("  b.sh");
  });

  it("runs a named hook with or without extension", async () => {
    mkdirSync(hooksDir, { recursive: true });
    writeHook("hello.mjs", "process.exit(0);\n");

    await expect(runHooks({ action: "run", name: "hello", workspace })).resolves.toBe(0);
    await expect(runHooks({ action: "run", name: "hello.mjs", workspace })).resolves.toBe(0);
  });

  it("fails with exit 2 when the hook name is missing or unknown", async () => {
    mkdirSync(hooksDir, { recursive: true });
    writeHook("hello.mjs", "process.exit(0);\n");

    await expect(runHooks({ action: "run", workspace })).resolves.toBe(2);
    await expect(runHooks({ action: "run", name: "nope", workspace })).resolves.toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Missing hook name"));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Hook not found: nope"));
  });

  it("test action passes when hooks exit cleanly (exit 2 is tolerated)", async () => {
    mkdirSync(hooksDir, { recursive: true });
    writeHook("ok.mjs", "process.exit(0);\n");
    writeHook("blocking.mjs", "process.exit(2);\n");

    await expect(runHooks({ action: "test", workspace })).resolves.toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("All hooks ran without crashes"));
  });

  it("test action fails when a hook crashes (exit > 2)", async () => {
    mkdirSync(hooksDir, { recursive: true });
    writeHook("bad.mjs", "process.exit(3);\n");

    await expect(runHooks({ action: "test", workspace })).resolves.toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("1 crashed"));
  });
});

// --- apmCommand ----------------------------------------------------------------

describe("apmCommand", () => {
  beforeEach(() => {
    apmRootRef.current = makeApmRoot();
  });

  afterEach(() => {
    if (apmRootRef.current) {
      rmSync(apmRootRef.current, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      apmRootRef.current = "";
    }
  });

  it("validate passes against a well-formed manifest", () => {
    expect(apmCommand(["validate"])).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("apm.yml valid"));
  });

  it("validate fails when the manifest drifts from package.json", () => {
    writeFileSync(
      resolve(apmRootRef.current, "apm.yml"),
      "name: specky-sdd\nversion: 0.0.0\ntargets: [github-copilot]\nprimitives:\n  agents: .apm/agents\nmcp:\n  servers:\n    - name: specky\n",
    );
    expect(apmCommand(["validate"])).toBe(2);
  });

  it("lock --dry-run reports without writing the lockfile", () => {
    expect(apmCommand(["lock", "--dry-run"])).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("dry-run"));
    expect(existsSync(resolve(apmRootRef.current, "apm.lock.yaml"))).toBe(false);
  });

  it("lock writes apm.lock.yaml which verify-lock accepts", () => {
    expect(apmCommand(["lock"])).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Wrote apm.lock.yaml"));
    expect(apmCommand(["verify-lock"])).toBe(0);
  });

  it("verify-lock fails on drift and on a missing lockfile", () => {
    // No lockfile yet → error path.
    expect(apmCommand(["verify-lock"])).toBe(2);

    apmCommand(["lock"]);
    writeFileSync(
      resolve(apmRootRef.current, ".apm/agents/specky-orchestrator.agent.md"),
      "changed\n",
    );
    expect(apmCommand(["verify-lock"])).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Lock verification failed"));
  });

  it("policy passes against the packaged policy file", () => {
    expect(apmCommand(["policy"])).toBe(0);
    expect(apmCommand(["policy", "check"])).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("apm-policy.yml checks passed"));
  });

  it("policy fails when the policy file disallows packaged primitives", () => {
    writeFileSync(resolve(apmRootRef.current, "apm-policy.yml"), "mcp:\n  allowlist: []\n");
    expect(apmCommand(["policy"])).toBe(2);
  });

  it("audit propagates the audit script exit code", () => {
    // The temp package root has no scripts/ directory, so the spawned node
    // process exits non-zero and apmCommand surfaces that.
    const code = apmCommand(["audit"]);
    expect(code).not.toBe(0);
  });

  it("sbom emits a CycloneDX document on stdout", () => {
    expect(apmCommand(["sbom"])).toBe(0);
    const last = logSpy.mock.calls.at(-1)?.[0] as string;
    const sbom = JSON.parse(last) as {
      bomFormat: string;
      specVersion: string;
      metadata: { component: { name: string } };
      components: Array<{ name: string; hashes: Array<{ alg: string }> }>;
    };
    expect(sbom.bomFormat).toBe("CycloneDX");
    expect(sbom.specVersion).toBe("1.5");
    expect(sbom.metadata.component.name).toBe("specky-sdd");
    expect(sbom.components.length).toBeGreaterThan(0);
    expect(sbom.components[0]?.hashes[0]?.alg).toBe("SHA-256");
  });

  it("prints usage for help and missing subcommands", () => {
    expect(apmCommand(["help"])).toBe(0);
    expect(apmCommand([])).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("specky apm <subcommand>"));
  });

  it("rejects unknown subcommands with exit 1", () => {
    expect(apmCommand(["bogus"])).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown apm subcommand: bogus"));
  });
});
