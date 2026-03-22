import { describe, it, expect, beforeEach } from "vitest";
import { ComplianceEngine } from "../../src/services/compliance-engine.js";

describe("ComplianceEngine", () => {
  let engine: ComplianceEngine;

  beforeEach(() => {
    engine = new ComplianceEngine();
  });

  // ── getFrameworks ─────────────────────────────────────────────────────
  describe("getFrameworks", () => {
    it("returns all 6 supported frameworks", () => {
      const frameworks = engine.getFrameworks();
      expect(frameworks).toContain("hipaa");
      expect(frameworks).toContain("soc2");
      expect(frameworks).toContain("gdpr");
      expect(frameworks).toContain("pci_dss");
      expect(frameworks).toContain("iso27001");
      expect(frameworks).toContain("general");
      expect(frameworks).toHaveLength(6);
    });
  });

  // ── getControls ────────────────────────────────────────────────────────
  describe("getControls", () => {
    it("returns HIPAA controls with mandatory flags", () => {
      const controls = engine.getControls("hipaa");
      expect(controls.length).toBeGreaterThan(0);
      expect(controls.every(c => c.id.startsWith("HIPAA-"))).toBe(true);
      expect(controls.some(c => c.mandatory)).toBe(true);
    });

    it("returns SOC2 controls", () => {
      const controls = engine.getControls("soc2");
      expect(controls.some(c => c.id.startsWith("SOC2-"))).toBe(true);
    });
  });

  // ── checkCompliance ────────────────────────────────────────────────────
  describe("checkCompliance — general framework", () => {
    const richSpec = `
      ## Authentication
      The system shall implement authentication with mfa support and session management.
      All inputs shall be validated and sanitized to prevent xss and injection attacks.
      ## Authorization
      Role-based access control (rbac) shall enforce least privilege.
      ## Logging
      The system shall implement comprehensive logging and monitoring for observability.
      ## Error Handling
      Graceful error handling with fallback mechanisms shall be implemented.
      ## Data Protection
      Sensitive data shall be encrypted and secured.
    `;

    it("reaches compliant status when all keywords are present", () => {
      const result = engine.checkCompliance("general", richSpec, "");
      expect(result.overall_status).toBe("compliant");
      expect(result.controls_failed).toBe(0);
      expect(result.controls_passed).toBe(result.controls_checked);
    });

    it("returns non_compliant status when spec is empty", () => {
      const result = engine.checkCompliance("general", "", "");
      expect(result.overall_status).toBe("non_compliant");
      expect(result.controls_passed).toBe(0);
    });

    it("returns partial status when only some controls are covered", () => {
      const partialSpec = "The system shall implement authentication with login and password protection.";
      const result = engine.checkCompliance("general", partialSpec, "");
      expect(result.overall_status).toBe("partial");
      expect(result.controls_passed).toBeGreaterThan(0);
      expect(result.controls_failed).toBeGreaterThan(0);
    });

    it("combines spec and design content for keyword matching", () => {
      const specContent = "The system shall authenticate users.";
      const designContent = "The design uses rbac authorization and role-based permission enforcement.";
      const result = engine.checkCompliance("general", specContent, designContent);
      const authControl = result.findings.find(f => f.control_id === "GEN-3");
      expect(authControl?.status).toBe("pass");
    });
  });

  describe("checkCompliance — HIPAA", () => {
    it("passes HIPAA encryption control when keywords present", () => {
      const spec = "The system shall encrypt PHI at rest using AES-256 and in transit using TLS 1.3.";
      const result = engine.checkCompliance("hipaa", spec, "");
      const encControl = result.findings.find(f => f.control_id === "HIPAA-3");
      expect(encControl?.status).toBe("pass");
    });

    it("fails HIPAA-4 PHI Protection when no PHI keywords in spec", () => {
      const result = engine.checkCompliance("hipaa", "The system shall log events.", "");
      const phiControl = result.findings.find(f => f.control_id === "HIPAA-4");
      // No PHI keywords → should fail
      expect(phiControl?.status).toBe("fail");
      expect(phiControl?.remediation).toBeTruthy();
    });
  });

  describe("checkCompliance — GDPR", () => {
    it("passes GDPR-17 Right to Erasure when delete keyword present", () => {
      const spec = "The system shall allow users to delete their account and all associated data (right to erasure).";
      const result = engine.checkCompliance("gdpr", spec, "");
      const erasureControl = result.findings.find(f => f.control_id === "GDPR-17");
      expect(erasureControl?.status).toBe("pass");
    });

    it("includes explanation and next_steps in result", () => {
      const result = engine.checkCompliance("gdpr", "", "");
      expect(result.explanation).toBeTruthy();
      expect(result.next_steps).toBeTruthy();
    });
  });

  describe("checkCompliance — result shape", () => {
    it("always returns all required fields", () => {
      const result = engine.checkCompliance("soc2", "some spec content", "some design");
      expect(result).toHaveProperty("framework", "soc2");
      expect(result).toHaveProperty("controls_checked");
      expect(result).toHaveProperty("controls_passed");
      expect(result).toHaveProperty("controls_failed");
      expect(result).toHaveProperty("controls_na");
      expect(result).toHaveProperty("findings");
      expect(result).toHaveProperty("overall_status");
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it("controls_checked equals the number of controls in framework", () => {
      const controls = engine.getControls("pci_dss");
      const result = engine.checkCompliance("pci_dss", "", "");
      expect(result.controls_checked).toBe(controls.length);
    });

    it("controls_passed + controls_failed + controls_na equals controls_checked", () => {
      const result = engine.checkCompliance("iso27001", "access control authentication logging", "");
      expect(result.controls_passed + result.controls_failed + result.controls_na).toBe(result.controls_checked);
    });
  });
});
