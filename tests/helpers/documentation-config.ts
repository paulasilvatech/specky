import type { DocumentationConfig } from "../../src/contracts/use-case.js";

export function testDocumentationConfig(
    types: DocumentationConfig["types"] = ["full", "runbook", "onboarding", "journey"],
): DocumentationConfig {
    return {
        types,
        version: "test-1.0.0",
        deployment_steps: ["Deploy the reviewed test artifact."],
        health_checks: ["Verify the contracted test health check."],
        monitoring_checks: ["Verify the contracted test alert."],
        troubleshooting: [{
            symptom: "Test failure",
            cause: "Fixture dependency unavailable",
            resolution: "Restore the fixture dependency",
        }],
        rollback_steps: ["Restore the prior reviewed test artifact."],
        support_contacts: ["test-on-call@example.test"],
        onboarding_steps: ["Run the fixture test suite."],
    };
}
