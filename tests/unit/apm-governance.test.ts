import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateLock, lockPath, serializeLock, verifyLock } from "../../src/cli/lib/apm/lock.js";
import { validateManifest } from "../../src/cli/lib/apm/manifest.js";
import { checkPolicy } from "../../src/cli/lib/apm/policy.js";

const REPO = resolve(import.meta.dirname, "../..");

describe("APM governance", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(resolve(tmpdir(), "specky-apm-"));
    for (const name of [".apm", "package.json", "apm.yml", "apm-policy.yml"]) {
      cpSync(resolve(REPO, name), resolve(workspace, name), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("validates the APM manifest against package.json and primitive paths", () => {
    const result = validateManifest(workspace);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects package/apm version drift", () => {
    writeFileSync(
      resolve(workspace, "apm.yml"),
      "name: specky-sdd\nversion: 0.0.0\ntargets: [github-copilot]\nprimitives:\n  agents: .apm/agents\nmcp:\n  servers:\n    - name: specky\n",
    );

    const result = validateManifest(workspace);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("apm.yml version");
  });

  it("generates and verifies apm.lock.yaml", () => {
    const lock = generateLock(workspace);
    writeFileSync(lockPath(workspace), serializeLock(lock));

    const result = verifyLock(workspace);
    expect(result.ok).toBe(true);
    expect(result.changed).toEqual([]);
    expect(Object.keys(lock.primitives)).toContain("apm.yml");
    expect(Object.keys(lock.primitives)).toContain("apm-policy.yml");
  });

  it("detects primitive drift against the lockfile", () => {
    const lock = generateLock(workspace);
    writeFileSync(lockPath(workspace), serializeLock(lock));
    writeFileSync(resolve(workspace, ".apm/agents/specky-orchestrator.agent.md"), "changed\n");

    const result = verifyLock(workspace);
    expect(result.ok).toBe(false);
    expect(result.changed).toContain(".apm/agents/specky-orchestrator.agent.md");
  });

  it("checks the default enterprise policy", () => {
    const result = checkPolicy(workspace);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects MCP servers outside the policy allowlist", () => {
    writeFileSync(
      resolve(workspace, "apm.yml"),
      "name: specky-sdd\nversion: 3.7.2\ntargets: [github-copilot]\nprimitives:\n  agents: .apm/agents\nmcp:\n  servers:\n    - name: untrusted\n",
    );

    const result = checkPolicy(workspace);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("untrusted");
  });

  it("rejects optional MCP capabilities outside policy", () => {
    writeFileSync(
      resolve(workspace, "apm-policy.yml"),
      "schemaVersion: 1\nmcp:\n  allowedServers:\n    - specky\n  optionalCapabilityServers: []\n",
    );

    const result = checkPolicy(workspace);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('optional MCP server "github"');
  });
});
