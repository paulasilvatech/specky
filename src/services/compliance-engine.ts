/**
 * ComplianceEngine — Static compliance framework controls with keyword matching.
 * Pure service, no dependencies.
 */
import type { ComplianceResult, ComplianceFinding, ComplianceFramework } from "../types.js";

interface Control {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  mandatory: boolean;
}

const FRAMEWORKS: Record<ComplianceFramework, Control[]> = {
  hipaa: [
    { id: "HIPAA-1", name: "Access Control", description: "Implement technical policies for access to ePHI", keywords: ["access control", "authentication", "authorization", "rbac", "role-based"], mandatory: true },
    { id: "HIPAA-2", name: "Audit Controls", description: "Implement mechanisms to record and examine access to ePHI", keywords: ["audit", "logging", "audit trail", "audit log", "monitor"], mandatory: true },
    { id: "HIPAA-3", name: "Encryption", description: "Encrypt ePHI at rest and in transit", keywords: ["encrypt", "tls", "ssl", "aes", "at rest", "in transit", "https"], mandatory: true },
    { id: "HIPAA-4", name: "PHI Protection", description: "Protect personally identifiable health information", keywords: ["phi", "pii", "health information", "patient data", "hipaa", "protected health"], mandatory: true },
    { id: "HIPAA-5", name: "Integrity Controls", description: "Protect ePHI from improper alteration or destruction", keywords: ["integrity", "validation", "checksum", "tamper", "immutable"], mandatory: true },
    { id: "HIPAA-6", name: "Transmission Security", description: "Guard against unauthorized access to ePHI during transmission", keywords: ["transmission", "transport", "tls", "vpn", "secure channel"], mandatory: true },
  ],
  soc2: [
    { id: "SOC2-CC6.1", name: "Logical Access", description: "Restrict logical access to information assets", keywords: ["access control", "authentication", "mfa", "2fa", "sso"], mandatory: true },
    { id: "SOC2-CC7.2", name: "System Monitoring", description: "Monitor system components for anomalies", keywords: ["monitoring", "alerting", "observability", "metrics", "logging", "dashboards"], mandatory: true },
    { id: "SOC2-CC8.1", name: "Change Management", description: "Authorize, design, develop, configure, document, test, approve changes", keywords: ["change management", "version control", "approval", "review", "pull request"], mandatory: true },
    { id: "SOC2-A1.2", name: "Data Recovery", description: "Backup and recovery procedures", keywords: ["backup", "recovery", "disaster", "restore", "failover", "redundancy"], mandatory: true },
    { id: "SOC2-CC6.6", name: "Encryption", description: "Encrypt data at rest and in transit", keywords: ["encrypt", "tls", "https", "at rest", "in transit"], mandatory: true },
    { id: "SOC2-CC7.3", name: "Incident Response", description: "Respond to identified security incidents", keywords: ["incident", "response", "breach", "security event", "escalation"], mandatory: true },
  ],
  gdpr: [
    { id: "GDPR-6", name: "Lawful Processing", description: "Process data with legal basis", keywords: ["consent", "legal basis", "legitimate interest", "contract", "lawful"], mandatory: true },
    { id: "GDPR-17", name: "Right to Erasure", description: "Support data deletion requests", keywords: ["delete", "erasure", "right to be forgotten", "data removal", "purge"], mandatory: true },
    { id: "GDPR-20", name: "Data Portability", description: "Allow data export in machine-readable format", keywords: ["export", "portability", "download", "machine-readable", "json", "csv"], mandatory: true },
    { id: "GDPR-25", name: "Data Protection by Design", description: "Integrate data protection from the onset", keywords: ["privacy by design", "data protection", "minimize", "pseudonym", "anonymize"], mandatory: true },
    { id: "GDPR-33", name: "Breach Notification", description: "Notify authorities within 72 hours of breach", keywords: ["breach", "notification", "72 hours", "data protection officer", "dpo"], mandatory: true },
    { id: "GDPR-35", name: "Impact Assessment", description: "Conduct DPIA for high-risk processing", keywords: ["impact assessment", "dpia", "risk assessment", "high risk"], mandatory: false },
  ],
  pci_dss: [
    { id: "PCI-1", name: "Firewall Configuration", description: "Install and maintain firewall configuration", keywords: ["firewall", "network security", "segmentation", "dmz", "ingress", "egress"], mandatory: true },
    { id: "PCI-3", name: "Protect Stored Data", description: "Protect stored cardholder data", keywords: ["cardholder", "card data", "pan", "cvv", "encrypt", "mask", "tokenize"], mandatory: true },
    { id: "PCI-4", name: "Encrypt Transmission", description: "Encrypt transmission of cardholder data", keywords: ["tls", "encrypt", "transmission", "transport", "https"], mandatory: true },
    { id: "PCI-6", name: "Secure Systems", description: "Develop and maintain secure systems", keywords: ["secure development", "vulnerability", "patch", "owasp", "code review"], mandatory: true },
    { id: "PCI-8", name: "Identify Users", description: "Identify and authenticate access to system components", keywords: ["authentication", "identity", "mfa", "password", "unique id"], mandatory: true },
    { id: "PCI-10", name: "Track and Monitor", description: "Track and monitor all access to network resources", keywords: ["logging", "monitoring", "audit trail", "track", "access log"], mandatory: true },
  ],
  iso27001: [
    { id: "ISO-A5", name: "Information Security Policies", description: "Management direction for information security", keywords: ["security policy", "information security", "governance", "management"], mandatory: true },
    { id: "ISO-A6", name: "Organization of Info Security", description: "Internal organization and mobile devices", keywords: ["organization", "roles", "responsibilities", "mobile", "teleworking"], mandatory: true },
    { id: "ISO-A9", name: "Access Control", description: "Business requirements of access control", keywords: ["access control", "authentication", "authorization", "privilege"], mandatory: true },
    { id: "ISO-A10", name: "Cryptography", description: "Ensure proper and effective use of cryptography", keywords: ["cryptography", "encrypt", "key management", "certificate"], mandatory: true },
    { id: "ISO-A12", name: "Operations Security", description: "Ensure correct and secure operations", keywords: ["operations", "change management", "capacity", "backup", "logging"], mandatory: true },
    { id: "ISO-A16", name: "Incident Management", description: "Consistent approach to managing security incidents", keywords: ["incident", "response", "reporting", "evidence", "lessons learned"], mandatory: true },
  ],
  general: [
    { id: "GEN-1", name: "Input Validation", description: "Validate all user inputs", keywords: ["validation", "sanitize", "input", "xss", "injection"], mandatory: true },
    { id: "GEN-2", name: "Authentication", description: "Implement proper authentication", keywords: ["authentication", "login", "password", "mfa", "session"], mandatory: true },
    { id: "GEN-3", name: "Authorization", description: "Implement proper authorization", keywords: ["authorization", "permission", "role", "access control", "rbac"], mandatory: true },
    { id: "GEN-4", name: "Logging", description: "Implement comprehensive logging", keywords: ["logging", "log", "audit", "monitoring", "observability"], mandatory: true },
    { id: "GEN-5", name: "Error Handling", description: "Handle errors securely", keywords: ["error handling", "exception", "fallback", "graceful", "recovery"], mandatory: true },
    { id: "GEN-6", name: "Data Protection", description: "Protect sensitive data", keywords: ["encrypt", "sensitive", "protect", "secure", "hash"], mandatory: true },
  ],
};

export class ComplianceEngine {
  checkCompliance(framework: ComplianceFramework, specContent: string, designContent: string): ComplianceResult {
    const controls = FRAMEWORKS[framework] || FRAMEWORKS.general;
    const combined = `${specContent}\n${designContent}`.toLowerCase();
    const findings: ComplianceFinding[] = [];
    let passed = 0, failed = 0, na = 0;

    for (const control of controls) {
      const found = control.keywords.some(kw => combined.includes(kw.toLowerCase()));
      if (found) {
        findings.push({ control_id: control.id, control_name: control.name, description: control.description, status: "pass", evidence: `Keywords matched in specification/design` });
        passed++;
      } else {
        findings.push({ control_id: control.id, control_name: control.name, description: control.description, status: "fail", remediation: `Add ${control.name.toLowerCase()} requirements to specification or design.` });
        failed++;
      }
    }

    const overall = failed === 0 ? "compliant" : (passed > failed ? "partial" : "non_compliant");
    return {
      framework, controls_checked: controls.length, controls_passed: passed, controls_failed: failed, controls_na: na, findings, overall_status: overall,
      explanation: `Checked ${controls.length} ${framework.toUpperCase()} controls. ${passed} passed, ${failed} need attention.`,
      next_steps: failed > 0 ? `Address ${failed} failing controls in SPECIFICATION.md or DESIGN.md, then re-run compliance check.` : "All controls addressed. Ready to proceed.",
    };
  }

  getFrameworks(): ComplianceFramework[] {
    return Object.keys(FRAMEWORKS) as ComplianceFramework[];
  }

  getControls(framework: ComplianceFramework): Control[] {
    return FRAMEWORKS[framework] || FRAMEWORKS.general;
  }
}
