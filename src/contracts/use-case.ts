import { createHash } from "node:crypto";
import { z } from "zod";
import { PHASE_ORDER, Phase } from "../constants.js";
import type { DiagramType } from "../constants.js";

export const lifecycleSchema = z.enum(["greenfield", "brownfield", "migration"]);
export const workloadSchema = z.enum([
    "api",
    "web-application",
    "service",
    "cli",
    "library",
    "infrastructure",
]);
export const executionModeSchema = z.enum(["full", "rapid", "emergency"]);

export type Lifecycle = z.infer<typeof lifecycleSchema>;
export type Workload = z.infer<typeof workloadSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const capabilitySchema = z.enum([
    "compliance",
    "tdd",
    "iac",
    "dev-environment",
    "document-import",
    "transcript-import",
    "figma",
    "work-items",
    "release",
]);
export type Capability = z.infer<typeof capabilitySchema>;

const nonEmptyText = z.string().min(1);

export const capabilityConfigSchema = z.object({
    compliance: z.object({
        frameworks: z.array(z.enum(["hipaa", "soc2", "gdpr", "pci_dss", "iso27001"])).min(1),
        control_pack_version: z.literal("2026.1"),
        evidence_required: z.literal(true),
    }).strict().optional(),
    tdd: z.object({
        framework: z.enum(["vitest", "jest", "playwright", "pytest", "junit", "xunit"]),
        property_framework: z.enum(["fast-check", "hypothesis"]),
        output_dir: nonEmptyText,
        coverage_threshold: z.number().min(0).max(100),
        trace_marker: nonEmptyText,
        imports: nonEmptyText,
        bindings: z.array(z.object({
            requirement_id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
            test_name: nonEmptyText,
            body: z.string().min(10),
        }).strict()).min(1),
        property_imports: nonEmptyText,
        property_bindings: z.array(z.object({
            requirement_id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
            property_name: nonEmptyText,
            property_type: z.enum(["invariant", "state_transition", "conditional", "negative", "round_trip", "idempotence", "commutativity", "monotonicity"]),
            body: z.string().min(20),
        }).strict()).min(1),
    }).strict().optional(),
    iac: z.object({
        provider: z.literal("terraform"),
        cloud: z.enum(["azure", "aws", "gcp"]),
        resources: z.array(z.object({
            module: z.enum(["networking", "compute", "database", "cache", "storage", "messaging", "identity", "monitoring"]),
            service: nonEmptyText,
        }).strict()).min(1),
        state_backend: nonEmptyText,
        region_policy: nonEmptyText,
    }).strict().optional(),
    "dev-environment": z.object({
        language: z.enum(["TypeScript", "JavaScript", "Python", "Go"]),
        framework: nonEmptyText.optional(),
        runtime: nonEmptyText,
        package_manager: nonEmptyText,
        port: z.number().int().min(1024).max(65535),
        services: z.array(nonEmptyText),
        codespaces_machine: z.enum(["basicLinux32gb", "standardLinux32gb", "premiumLinux", "largePremiumLinux"]),
        extensions: z.array(nonEmptyText),
        base_image: nonEmptyText,
        features: z.array(nonEmptyText),
        include_compose: z.boolean(),
        multi_stage: z.boolean(),
    }).strict().optional(),
    "document-import": z.object({
        formats: z.array(z.enum(["pdf", "docx", "pptx", "md", "txt", "vtt", "srt"])).min(1),
    }).strict().optional(),
    "transcript-import": z.object({
        formats: z.array(z.enum(["vtt", "srt", "txt", "md"])).min(1),
        require_speaker_attribution: z.boolean(),
    }).strict().optional(),
    figma: z.object({
        extraction_scope: z.enum(["file", "node"]),
        require_component_properties: z.boolean(),
        diagram_types: z.array(z.enum(["architecture", "user_flow", "data_flow", "integration"])).min(1),
    }).strict().optional(),
    "work-items": z.object({
        platform: z.enum(["github", "azure_boards", "jira"]),
        include_subtasks: z.boolean(),
        project_key: nonEmptyText.optional(),
        area_path: nonEmptyText.optional(),
        iteration_path: nonEmptyText.optional(),
    }).strict().optional(),
    release: z.object({
        branch_prefix: z.string().regex(/^[A-Za-z0-9._/-]+$/),
        base_branch: z.string().regex(/^[A-Za-z0-9._/-]+$/),
        draft_pr: z.boolean(),
        checkpoints: z.boolean(),
    }).strict().optional(),
}).strict();
export type CapabilityConfig = z.infer<typeof capabilityConfigSchema>;

export const useCaseSelectionSchema = z.object({
    lifecycle: lifecycleSchema,
    workload: workloadSchema,
    execution_mode: executionModeSchema,
    capabilities: z.array(capabilitySchema),
    capability_config: capabilityConfigSchema,
}).strict();
export type UseCaseSelection = z.infer<typeof useCaseSelectionSchema>;

export interface ResolvedUseCaseContract extends UseCaseSelection {
    id: string;
    version: "1.0.0";
    fingerprint: string;
    phases: readonly Phase[];
    required_discovery_artifacts: readonly string[];
    required_design_sections: readonly string[];
    required_diagrams: readonly RequiredDiagramContract[];
}

export interface RequiredDiagramContract {
    type: DiagramType;
    source: "spec" | "design" | "tasks" | "constitution";
    title: string;
}

const phaseSchema = z.enum([
    Phase.Init,
    Phase.Discover,
    Phase.Specify,
    Phase.Clarify,
    Phase.Design,
    Phase.Tasks,
    Phase.Analyze,
    Phase.Implement,
    Phase.Verify,
    Phase.Release,
]);

export const resolvedUseCaseContractSchema = useCaseSelectionSchema.extend({
    id: z.string().min(1),
    version: z.literal("1.0.0"),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    phases: z.array(phaseSchema).min(1),
    required_discovery_artifacts: z.array(z.string().min(1)).min(1),
    required_design_sections: z.array(z.string().min(1)).min(1),
    required_diagrams: z.array(z.object({
        type: z.enum(["flowchart", "sequence", "class", "er", "state", "c4_context", "c4_container", "c4_component", "c4_code", "activity", "use_case", "dfd", "deployment", "network_topology", "gantt", "pie", "mindmap"]),
        source: z.enum(["spec", "design", "tasks", "constitution"]),
        title: z.string().min(3),
    }).strict()).min(1),
}).strict();

interface LifecycleContract {
    requiredDiscoveryArtifacts: readonly string[];
}

interface WorkloadContract {
    requiredDesignSections: readonly string[];
    requiredDiagrams: readonly RequiredDiagramContract[];
}

interface ExecutionModeContract {
    phases: readonly Phase[];
}

const LIFECYCLE_CONTRACTS: Record<Lifecycle, LifecycleContract> = {
    greenfield: { requiredDiscoveryArtifacts: ["RESEARCH.md"] },
    brownfield: { requiredDiscoveryArtifacts: ["RESEARCH.md", "CODEBASE_BASELINE.md", "COMPATIBILITY.md"] },
    migration: { requiredDiscoveryArtifacts: ["RESEARCH.md", "SOURCE_INVENTORY.md", "TARGET_INVENTORY.md", "MIGRATION_PLAN.md"] },
};

const WORKLOAD_CONTRACTS: Record<Workload, WorkloadContract> = {
    api: {
        requiredDesignSections: ["API contracts", "versioning", "error model", "authentication", "rate limits"],
        requiredDiagrams: [
            { type: "c4_context", source: "design", title: "API System Context" },
            { type: "sequence", source: "design", title: "API Request Sequence" },
            { type: "er", source: "design", title: "API Data Model" },
        ],
    },
    "web-application": {
        requiredDesignSections: ["user journeys", "UI states", "accessibility", "responsive behavior", "API integration"],
        requiredDiagrams: [
            { type: "activity", source: "spec", title: "User Journey" },
            { type: "state", source: "design", title: "UI State Model" },
            { type: "c4_container", source: "design", title: "Web Container Architecture" },
        ],
    },
    service: {
        requiredDesignSections: ["protocols", "dependencies", "failure modes", "operability", "observability"],
        requiredDiagrams: [
            { type: "c4_context", source: "design", title: "Service Context" },
            { type: "sequence", source: "design", title: "Service Interaction Sequence" },
            { type: "deployment", source: "design", title: "Service Deployment" },
        ],
    },
    cli: {
        requiredDesignSections: ["command grammar", "arguments", "exit codes", "standard streams", "shell compatibility"],
        requiredDiagrams: [
            { type: "flowchart", source: "spec", title: "Command Flow" },
            { type: "state", source: "design", title: "CLI Process States" },
            { type: "c4_code", source: "design", title: "CLI Code Structure" },
        ],
    },
    library: {
        requiredDesignSections: ["public API", "compatibility", "versioning", "error surface", "consumer examples"],
        requiredDiagrams: [
            { type: "class", source: "design", title: "Library Public API" },
            { type: "c4_code", source: "design", title: "Library Code Structure" },
            { type: "sequence", source: "design", title: "Consumer Interaction" },
        ],
    },
    infrastructure: {
        requiredDesignSections: ["topology", "provider", "state management", "identity", "network security"],
        requiredDiagrams: [
            { type: "deployment", source: "design", title: "Infrastructure Deployment" },
            { type: "network_topology", source: "design", title: "Network Topology" },
            { type: "c4_container", source: "design", title: "Resource Topology" },
        ],
    },
};

const EXECUTION_MODE_CONTRACTS: Record<ExecutionMode, ExecutionModeContract> = {
    full: { phases: PHASE_ORDER },
    rapid: {
        phases: [
            Phase.Init,
            Phase.Discover,
            Phase.Specify,
            Phase.Design,
            Phase.Tasks,
            Phase.Analyze,
            Phase.Implement,
            Phase.Verify,
            Phase.Release,
        ],
    },
    emergency: {
        phases: [
            Phase.Init,
            Phase.Specify,
            Phase.Tasks,
            Phase.Analyze,
            Phase.Implement,
            Phase.Verify,
            Phase.Release,
        ],
    },
};

const SUPPORTED_CONTRACT_IDS = [
    "greenfield-api-full", "greenfield-api-rapid", "greenfield-api-emergency",
    "greenfield-web-application-full", "greenfield-web-application-rapid", "greenfield-web-application-emergency",
    "greenfield-service-full", "greenfield-service-rapid", "greenfield-service-emergency",
    "greenfield-cli-full", "greenfield-cli-rapid", "greenfield-cli-emergency",
    "greenfield-library-full", "greenfield-library-rapid", "greenfield-library-emergency",
    "greenfield-infrastructure-full", "greenfield-infrastructure-rapid", "greenfield-infrastructure-emergency",
    "brownfield-api-full", "brownfield-api-rapid", "brownfield-api-emergency",
    "brownfield-web-application-full", "brownfield-web-application-rapid", "brownfield-web-application-emergency",
    "brownfield-service-full", "brownfield-service-rapid", "brownfield-service-emergency",
    "brownfield-cli-full", "brownfield-cli-rapid", "brownfield-cli-emergency",
    "brownfield-library-full", "brownfield-library-rapid", "brownfield-library-emergency",
    "brownfield-infrastructure-full", "brownfield-infrastructure-rapid", "brownfield-infrastructure-emergency",
    "migration-api-full", "migration-api-rapid", "migration-api-emergency",
    "migration-web-application-full", "migration-web-application-rapid", "migration-web-application-emergency",
    "migration-service-full", "migration-service-rapid", "migration-service-emergency",
    "migration-cli-full", "migration-cli-rapid", "migration-cli-emergency",
    "migration-library-full", "migration-library-rapid", "migration-library-emergency",
    "migration-infrastructure-full", "migration-infrastructure-rapid", "migration-infrastructure-emergency",
] as const;

export type UseCaseContractId = (typeof SUPPORTED_CONTRACT_IDS)[number];
export const useCaseContractIdSchema = z.enum(SUPPORTED_CONTRACT_IDS);

function stableFingerprint(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (typeof value !== "object" || value === null) return value;
    return Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .reduce<Record<string, unknown>>((result, key) => {
            result[key] = canonicalize((value as Record<string, unknown>)[key]);
            return result;
        }, {});
}

function validateCapabilityConfig(selection: UseCaseSelection): void {
    const capabilities = [...new Set(selection.capabilities)].sort((left, right) => left.localeCompare(right));
    const configured = Object.keys(selection.capability_config)
        .sort((left, right) => left.localeCompare(right));
    if (JSON.stringify(capabilities) !== JSON.stringify(configured)) {
        throw new Error(
            `capabilities and capability_config must declare the same keys; capabilities=${capabilities.join(",") || "none"}, configured=${configured.join(",") || "none"}`,
        );
    }

    const workItems = selection.capability_config["work-items"];
    if (workItems?.platform === "jira" && !workItems.project_key) {
        throw new Error("Jira work-items capability requires project_key.");
    }

    const tdd = selection.capability_config.tdd;
    if (tdd) {
        for (const binding of tdd.bindings) {
            if (/(?:\/\/|#|\/\*|\[)\s*TODO\b|expect\(true\)|assert\s+True|assertTrue\(true\)|Assert\.True\(true\)|toBeTruthy\(\)/i.test(binding.body)) {
                throw new Error(`TDD binding ${binding.requirement_id} contains a placeholder or trivial assertion.`);
            }
        }
        for (const binding of tdd.property_bindings) {
            if (!binding.body.includes(binding.requirement_id)) {
                throw new Error(`Property binding ${binding.requirement_id} must carry its requirement ID in executable code.`);
            }
            if (/(?:\/\/|#|\/\*|\[)\s*TODO\b|return\s+true\b|assert\s+True\b/i.test(binding.body)) {
                throw new Error(`Property binding ${binding.requirement_id} contains a placeholder or trivial property.`);
            }
        }
    }
}

export function resolveUseCaseContract(selection: UseCaseSelection): ResolvedUseCaseContract {
    const parsed = useCaseSelectionSchema.parse(selection);
    validateCapabilityConfig(parsed);
    const id = `${parsed.lifecycle}-${parsed.workload}-${parsed.execution_mode}` as UseCaseContractId;
    if (!SUPPORTED_CONTRACT_IDS.includes(id)) {
        throw new Error(`Unsupported use-case contract: ${id}`);
    }

    const lifecycle = LIFECYCLE_CONTRACTS[parsed.lifecycle];
    const workload = WORKLOAD_CONTRACTS[parsed.workload];
    const mode = EXECUTION_MODE_CONTRACTS[parsed.execution_mode];
    const snapshot = {
        id,
        version: "1.0.0" as const,
        ...parsed,
        capabilities: [...new Set(parsed.capabilities)].sort((left, right) => left.localeCompare(right)) as Capability[],
        capability_config: parsed.capability_config,
        phases: [...mode.phases],
        required_discovery_artifacts: [...lifecycle.requiredDiscoveryArtifacts],
        required_design_sections: [...workload.requiredDesignSections],
        required_diagrams: workload.requiredDiagrams.map((diagram) => ({ ...diagram })),
    };

    return {
        ...snapshot,
        fingerprint: stableFingerprint(snapshot),
    };
}

export function assertUseCaseContractFingerprint(contract: ResolvedUseCaseContract): void {
    validateCapabilityConfig(contract);
    const { fingerprint, ...snapshot } = contract;
    const expected = stableFingerprint(snapshot);
    if (fingerprint !== expected) {
        throw new Error(`Use-case contract fingerprint mismatch for ${contract.id}`);
    }
}

export const SUPPORTED_USE_CASE_CONTRACT_IDS: readonly UseCaseContractId[] = SUPPORTED_CONTRACT_IDS;
