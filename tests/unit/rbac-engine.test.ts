import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RbacEngine, type RbacRole } from "../../src/services/rbac-engine.js";

describe("RbacEngine", () => {
  // ── Disabled mode (default) ────────────────────────────────────

  describe("when RBAC is disabled", () => {
    let engine: RbacEngine;

    beforeEach(() => {
      engine = new RbacEngine(false, "contributor");
    });

    it("allows any tool for viewer role", () => {
      expect(engine.checkAccess("viewer", "sdd_create_pr").allowed).toBe(true);
    });

    it("allows any tool for contributor role", () => {
      expect(engine.checkAccess("contributor", "sdd_create_pr").allowed).toBe(true);
    });

    it("allows any tool for admin role", () => {
      expect(engine.checkAccess("admin", "sdd_init").allowed).toBe(true);
    });

    it("isEnabled returns false", () => {
      expect(engine.isEnabled).toBe(false);
    });
  });

  // ── Admin role ─────────────────────────────────────────────────

  describe("admin role (enabled)", () => {
    let engine: RbacEngine;

    beforeEach(() => {
      engine = new RbacEngine(true, "admin");
    });

    it("allows all tools without restriction", () => {
      const tools = ["sdd_init", "sdd_create_pr", "sdd_check_access", "sdd_write_spec"];
      for (const tool of tools) {
        expect(engine.checkAccess("admin", tool).allowed).toBe(true);
      }
    });

    it("allows sdd_create_pr (release gate tool)", () => {
      expect(engine.checkAccess("admin", "sdd_create_pr").allowed).toBe(true);
    });
  });

  // ── Contributor role ───────────────────────────────────────────

  describe("contributor role (enabled)", () => {
    let engine: RbacEngine;

    beforeEach(() => {
      engine = new RbacEngine(true, "contributor");
    });

    it("allows pipeline tools", () => {
      const tools = ["sdd_init", "sdd_write_spec", "sdd_write_design", "sdd_write_tasks"];
      for (const tool of tools) {
        expect(engine.checkAccess("contributor", tool).allowed).toBe(true);
      }
    });

    it("allows utility tools", () => {
      expect(engine.checkAccess("contributor", "sdd_get_status").allowed).toBe(true);
      expect(engine.checkAccess("contributor", "sdd_check_sync").allowed).toBe(true);
    });

    it("blocks sdd_create_pr (release gate)", () => {
      const result = engine.checkAccess("contributor", "sdd_create_pr");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("admin role");
    });

    it("allows all viewer tools", () => {
      for (const tool of RbacEngine.VIEWER_TOOLS) {
        expect(engine.checkAccess("contributor", tool).allowed).toBe(true);
      }
    });
  });

  // ── Viewer role ────────────────────────────────────────────────

  describe("viewer role (enabled)", () => {
    let engine: RbacEngine;

    beforeEach(() => {
      engine = new RbacEngine(true, "viewer");
    });

    it("allows sdd_get_status", () => {
      expect(engine.checkAccess("viewer", "sdd_get_status").allowed).toBe(true);
    });

    it("allows sdd_get_template", () => {
      expect(engine.checkAccess("viewer", "sdd_get_template").allowed).toBe(true);
    });

    it("allows sdd_model_routing", () => {
      expect(engine.checkAccess("viewer", "sdd_model_routing").allowed).toBe(true);
    });

    it("allows sdd_context_status", () => {
      expect(engine.checkAccess("viewer", "sdd_context_status").allowed).toBe(true);
    });

    it("allows sdd_check_access", () => {
      expect(engine.checkAccess("viewer", "sdd_check_access").allowed).toBe(true);
    });

    it("blocks sdd_write_spec (write operation)", () => {
      const result = engine.checkAccess("viewer", "sdd_write_spec");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("contributor or admin");
    });

    it("blocks sdd_create_pr (release gate)", () => {
      const result = engine.checkAccess("viewer", "sdd_create_pr");
      expect(result.allowed).toBe(false);
    });

    it("blocks sdd_run_analysis", () => {
      expect(engine.checkAccess("viewer", "sdd_run_analysis").allowed).toBe(false);
    });

    it("all VIEWER_TOOLS are allowed for viewer", () => {
      for (const tool of RbacEngine.VIEWER_TOOLS) {
        expect(engine.checkAccess("viewer", tool).allowed).toBe(
          true,
          `Expected viewer to access ${tool}`,
        );
      }
    });
  });

  // ── Static constants ───────────────────────────────────────────

  it("VIEWER_TOOLS is a non-empty readonly array", () => {
    expect(RbacEngine.VIEWER_TOOLS.length).toBeGreaterThan(0);
  });

  it("BLOCKED_FOR_CONTRIBUTOR contains sdd_create_pr", () => {
    expect(RbacEngine.BLOCKED_FOR_CONTRIBUTOR).toContain("sdd_create_pr");
  });

  it("VIEWER_TOOLS does not contain sdd_create_pr", () => {
    expect(RbacEngine.VIEWER_TOOLS).not.toContain("sdd_create_pr");
  });

  // ── Default role ───────────────────────────────────────────────

  it("roleDefault returns the configured default role", () => {
    const engine = new RbacEngine(true, "viewer");
    expect(engine.roleDefault).toBe("viewer");
  });
});
