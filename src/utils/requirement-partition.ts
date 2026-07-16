const NONFUNCTIONAL_KEYWORDS =
    /\b(security|secur|encrypt|auth|gdpr|hipaa|pci|compliance|performance|latency|throughput|availab|scalability|reliab|observab|monitor|logging|backup|disaster|sla|uptime)\b/i;

export function partitionFunctionalNonFunctional<T extends { id: string; text: string }>(
    requirements: T[],
): { functional: T[]; nonfunctional: T[] } {
    const functional: T[] = [];
    const nonfunctional: T[] = [];
    for (const requirement of requirements) {
        if (NONFUNCTIONAL_KEYWORDS.test(requirement.text) || /^REQ-NFR-/i.test(requirement.id)) {
            nonfunctional.push(requirement);
        } else {
            functional.push(requirement);
        }
    }
    return { functional, nonfunctional };
}
