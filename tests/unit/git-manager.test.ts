/**
 * git-manager.test.ts — branch naming and PR payload generation.
 * GitManager never shells out to git; it builds payloads for the AI client,
 * so tests only need a temp workspace with spec artifacts.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileManager } from "../../src/services/file-manager.js";
import { GitManager } from "../../src/services/git-manager.js";

const FEATURE_DIR = ".specs/001-user-auth";

const workspaces: string[] = [];

function setup(): { workspace: string; git: GitManager } {
  const workspace = mkdtempSync(join(tmpdir(), "specky-git-manager-"));
  workspaces.push(workspace);
  return { workspace, git: new GitManager(new FileManager(workspace)) };
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("GitManager.generateBranchInfo", () => {
  it("builds the default feature branch payload", () => {
    const { git } = setup();

    const info = git.generateBranchInfo("001", "user-auth");

    expect(info).toEqual({
      name: "feature/001-user-auth",
      feature_number: "001",
      convention: "feature/<number>-<kebab-case-name>",
      command_hint: "git checkout -b feature/001-user-auth main",
    });
  });

  it("honours a custom prefix and base branch", () => {
    const { git } = setup();

    const info = git.generateBranchInfo("042", "payment-flow", "bugfix/", "develop");

    expect(info.name).toBe("bugfix/042-payment-flow");
    expect(info.convention).toBe("bugfix/<number>-<kebab-case-name>");
    expect(info.command_hint).toBe("git checkout -b bugfix/042-payment-flow develop");
  });
});

describe("GitManager.generatePrPayload", () => {
  it("assembles title, body, labels, and requirement coverage from spec artifacts", async () => {
    const { workspace, git } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    const specLines = [
      "# Specification",
      "",
      "### REQ-AUTH-001: Login",
      "The system shall authenticate users; see REQ-AUTH-001.",
      "### REQ-AUTH-002: Logout",
      "The system shall terminate sessions.",
      ...Array.from({ length: 20 }, (_, i) => `filler line ${i + 1}`),
    ];
    writeFileSync(join(workspace, FEATURE_DIR, "SPECIFICATION.md"), specLines.join("\n"));
    writeFileSync(
      join(workspace, FEATURE_DIR, "TASKS.md"),
      "- [x] T-001: Implement login (REQ-AUTH-001)\n- [ ] T-002: Implement logout (REQ-AUTH-002)\n",
    );

    const payload = await git.generatePrPayload(FEATURE_DIR, "001", "main");

    expect(payload.title).toBe("[001] user auth");
    expect(payload.base_branch).toBe("main");
    expect(payload.head_branch).toBe("feature/001-user-auth");
    expect(payload.labels).toEqual(["sdd", "feature/001"]);
    expect(payload.requirements_covered).toEqual(["REQ-AUTH-001", "REQ-AUTH-002"]);
    // spec summary is truncated to the first 20 lines
    expect(payload.spec_summary).toBe(specLines.slice(0, 20).join("\n"));
    expect(payload.body).toContain("## Summary");
    expect(payload.body).toContain(payload.spec_summary);
    expect(payload.body).toContain("## Tasks: 1/2 completed");
    expect(payload.body).toContain("## Requirements Covered\n- REQ-AUTH-001\n- REQ-AUTH-002");
    expect(payload.body).toContain("- `.specs/001-user-auth/SPECIFICATION.md`");
    expect(payload.body).toContain("- `.specs/001-user-auth/DESIGN.md`");
    expect(payload.body).toContain("- `.specs/001-user-auth/TASKS.md`");
    expect(payload.routing_instructions).toEqual({
      mcp_server: "github",
      tool_name: "create_pull_request",
      note: "Call GitHub MCP create_pull_request with this payload",
    });
  });

  it("derives the head branch and title from the feature directory name", async () => {
    const { git } = setup();

    const payload = await git.generatePrPayload(".specs/007-multi-word-name", "007", "main");

    expect(payload.title).toBe("[007] multi word name");
    expect(payload.head_branch).toBe("feature/007-multi-word-name");
  });

  it("uses an explicit head branch when provided", async () => {
    const { git } = setup();

    const payload = await git.generatePrPayload(FEATURE_DIR, "001", "develop", "hotfix/001-custom");

    expect(payload.head_branch).toBe("hotfix/001-custom");
    expect(payload.base_branch).toBe("develop");
  });

  it("still builds a payload when SPECIFICATION.md and TASKS.md are absent", async () => {
    const { git } = setup();

    const payload = await git.generatePrPayload(".specs/042-payment-flow", "042", "develop");

    expect(payload.title).toBe("[042] payment flow");
    expect(payload.head_branch).toBe("feature/042-payment-flow");
    expect(payload.spec_summary).toBe("");
    expect(payload.requirements_covered).toEqual([]);
    expect(payload.body).toContain("## Summary");
    expect(payload.body).toContain("## Requirements Covered");
    expect(payload.body).not.toContain("- REQ-");
  });

  it("reports 'Tasks: none parsed' when TASKS.md has no parseable tasks", async () => {
    const { workspace, git } = setup();
    mkdirSync(join(workspace, FEATURE_DIR), { recursive: true });
    writeFileSync(
      join(workspace, FEATURE_DIR, "TASKS.md"),
      "# Tasks\n\nNo actionable entries yet.\n",
    );

    const payload = await git.generatePrPayload(FEATURE_DIR, "001", "main");

    expect(payload.body).toContain("## Tasks: none parsed");
  });
});
