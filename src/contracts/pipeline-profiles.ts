import { z } from "zod";
import type { ResolvedUseCaseContract, Workload } from "./use-case.js";

export interface DiscoveryQuestion {
    id: string;
    category: string;
    question: string;
    why_it_matters: string;
    required_evidence: string;
}

export interface DiscoveryInputs {
    projectIdea: string;
    codebaseSummary?: string;
    migrationSource?: string;
    migrationTarget?: string;
}

const WORKLOAD_QUESTIONS: Record<Workload, readonly Omit<DiscoveryQuestion, "id">[]> = {
    api: [
        {
            category: "API consumers and protocol",
            question: "Which named consumers call the API, through which protocol, and which compatibility versions must remain supported?",
            why_it_matters: "Consumer and protocol contracts determine versioning and compatibility obligations.",
            required_evidence: "Consumer inventory, protocol, current and target API versions",
        },
        {
            category: "API operations and authorization",
            question: "Which operations, request/response schemas, authentication methods, and authorization rules are required?",
            why_it_matters: "Operations cannot be designed safely without exact schemas and access rules.",
            required_evidence: "Operation table with methods, paths, schemas, authn and authz",
        },
        {
            category: "API failure contract",
            question: "What error model, idempotency behavior, retry semantics, quotas, and rate limits apply to each operation class?",
            why_it_matters: "Failure semantics and traffic policies are public API behavior.",
            required_evidence: "Error catalog, idempotency keys, retry policy, quota and rate-limit table",
        },
    ],
    "web-application": [
        {
            category: "User journeys",
            question: "Which named user journeys and UI states must the web application support from entry through completion or abandonment?",
            why_it_matters: "Journey and state coverage defines the actual interaction surface.",
            required_evidence: "Journey map including loading, empty, success, validation and failure states",
        },
        {
            category: "Accessibility and responsiveness",
            question: "Which accessibility standard, input methods, breakpoints, and responsive adaptations are mandatory?",
            why_it_matters: "Accessibility and viewport behavior must be designed, not inferred after implementation.",
            required_evidence: "Accessibility target, keyboard behavior, screen-reader semantics and breakpoint matrix",
        },
        {
            category: "Web integration",
            question: "How are sessions, browser security boundaries, client data, backend APIs, caching, and offline behavior managed?",
            why_it_matters: "Browser and backend boundaries define security, consistency and resilience.",
            required_evidence: "Session model, API dependencies, cache policy and offline decision",
        },
    ],
    service: [
        {
            category: "Service interface",
            question: "Which named callers invoke the service, through which protocols, and with which latency and availability objectives?",
            why_it_matters: "Callers, protocols and objectives define the service contract.",
            required_evidence: "Caller inventory, protocol schemas and SLO table",
        },
        {
            category: "Service dependencies",
            question: "Which downstream dependencies exist, and what timeout, retry, circuit-breaking and idempotency policies apply to each?",
            why_it_matters: "Dependency policies determine distributed failure behavior.",
            required_evidence: "Dependency matrix with ownership and resilience policy",
        },
        {
            category: "Service operations",
            question: "What deployment, scaling, health, telemetry, alerting and incident-response requirements govern the service?",
            why_it_matters: "A service is incomplete without an operability contract.",
            required_evidence: "Deployment topology, health model, telemetry fields and alert ownership",
        },
    ],
    cli: [
        {
            category: "Command grammar",
            question: "Which commands, subcommands, arguments, options, defaults and mutual-exclusion rules make up the CLI grammar?",
            why_it_matters: "The command grammar is the CLI public interface.",
            required_evidence: "Command tree with types, required flags and conflicts",
        },
        {
            category: "Process contract",
            question: "What is written to stdout and stderr, which exit codes are stable, and how do interactive and non-interactive modes differ?",
            why_it_matters: "Streams and exit codes determine automation reliability.",
            required_evidence: "Output schemas and exit-code catalog",
        },
        {
            category: "Platform compatibility",
            question: "Which shells, operating systems, configuration sources, authentication methods and installation mechanisms are supported?",
            why_it_matters: "Platform support must be bounded and testable.",
            required_evidence: "OS/shell matrix, config precedence and distribution channels",
        },
    ],
    library: [
        {
            category: "Public API",
            question: "Which exported modules, types, functions and extension points form the supported library API?",
            why_it_matters: "Only a named public surface can carry compatibility guarantees.",
            required_evidence: "Export map with signatures and stability level",
        },
        {
            category: "Consumer compatibility",
            question: "Which languages, runtimes, package managers and previous versions must consumers be able to use?",
            why_it_matters: "Consumer compatibility determines build and versioning constraints.",
            required_evidence: "Runtime/package compatibility matrix and deprecation policy",
        },
        {
            category: "Library behavior",
            question: "Which error types, resource ownership rules, performance limits and consumer examples define correct usage?",
            why_it_matters: "Errors, ownership and performance are observable library contracts.",
            required_evidence: "Error taxonomy, lifecycle rules, benchmarks and executable examples",
        },
    ],
    infrastructure: [
        {
            category: "Infrastructure topology",
            question: "Which providers, regions, environments, resource types, connectivity boundaries and availability zones are required?",
            why_it_matters: "Topology and provider choices define the deployable system.",
            required_evidence: "Environment-by-region topology and resource inventory",
        },
        {
            category: "Infrastructure state and identity",
            question: "Where is state stored, how is locking handled, which identities deploy and run resources, and which network paths are permitted?",
            why_it_matters: "State, identity and networking are core control-plane contracts.",
            required_evidence: "State backend, lock policy, identity/RBAC matrix and network flow table",
        },
        {
            category: "Infrastructure operations",
            question: "What drift, policy, cost, backup, disaster recovery, observability and lifecycle requirements apply?",
            why_it_matters: "Infrastructure reliability requires explicit operational controls.",
            required_evidence: "Policy gates, drift cadence, backup/DR objectives and ownership",
        },
    ],
};

function lifecycleQuestions(
    contract: ResolvedUseCaseContract,
    inputs: DiscoveryInputs,
): Omit<DiscoveryQuestion, "id">[] {
    if (contract.lifecycle === "greenfield") {
        return [
            {
                category: "Greenfield outcome",
                question: `For "${inputs.projectIdea}", what measurable outcome, release boundary, named stakeholders and explicit exclusions define success?`,
                why_it_matters: "A new system needs a bounded outcome before technology or architecture is selected.",
                required_evidence: "Outcome measures, in-scope and out-of-scope list, stakeholder owners",
            },
            {
                category: "Greenfield constraints",
                question: "Which technology, delivery, budget, data-residency, security and operational constraints are already decided versus still open?",
                why_it_matters: "Greenfield freedom must be separated from non-negotiable constraints.",
                required_evidence: "Decision register distinguishing fixed constraints from open choices",
            },
        ];
    }

    if (contract.lifecycle === "brownfield") {
        if (!inputs.codebaseSummary?.trim()) {
            throw new Error("brownfield discovery requires codebase_summary from sdd_scan_codebase.");
        }
        return [
            {
                category: "Brownfield baseline",
                question: `Given this codebase baseline: ${inputs.codebaseSummary}, which modules, owners, data stores and runtime boundaries are affected?`,
                why_it_matters: "Change scope must be anchored in the existing architecture.",
                required_evidence: "Affected-component inventory with owners and dependency edges",
            },
            {
                category: "Brownfield compatibility",
                question: "Which existing behaviors, interfaces, data formats, deployment processes and operational guarantees must remain unchanged?",
                why_it_matters: "Preserved behavior is an explicit regression contract.",
                required_evidence: "Compatibility matrix and regression-test inventory",
            },
            {
                category: "Brownfield integration",
                question: "Where will the change be introduced, how will it coexist with existing components, and what rollback boundary is available?",
                why_it_matters: "Insertion and rollback points determine implementation risk.",
                required_evidence: "Integration sequence, coexistence period and rollback trigger",
            },
        ];
    }

    if (!inputs.migrationSource?.trim() || !inputs.migrationTarget?.trim()) {
        throw new Error("migration discovery requires migration_source and migration_target.");
    }
    return [
        {
            category: "Migration source",
            question: `For source system "${inputs.migrationSource}", which behaviors, data sets, integrations, volumes and constraints must be inventoried?`,
            why_it_matters: "Migration scope begins with evidence from the source system.",
            required_evidence: "Source inventory with behavior, data, dependency and volume baselines",
        },
        {
            category: "Migration target",
            question: `For target "${inputs.migrationTarget}", which parity requirements, intentional changes and target-only constraints apply?`,
            why_it_matters: "Parity and intentional divergence must be distinguished explicitly.",
            required_evidence: "Source-to-target compatibility and divergence matrix",
        },
        {
            category: "Migration execution",
            question: "What data conversion, validation, coexistence, cutover, rollback and decommission sequence is required?",
            why_it_matters: "Migration safety is determined by transition mechanics, not only target design.",
            required_evidence: "Wave plan, validation gates, cutover criteria, rollback plan and decommission checklist",
        },
    ];
}

export function discoveryQuestionsForContract(
    contract: ResolvedUseCaseContract,
    inputs: DiscoveryInputs,
): DiscoveryQuestion[] {
    const questions = [
        ...lifecycleQuestions(contract, inputs),
        ...WORKLOAD_QUESTIONS[contract.workload],
    ];
    return questions.map((question, index) => ({
        id: `DQ-${String(index + 1).padStart(3, "0")}`,
        ...question,
    }));
}

const designText = z.string().min(10);

export const workloadDesignInputSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("api"),
        versioning_strategy: designText,
        error_model: designText,
        authentication: designText,
        rate_limits: designText,
    }).strict(),
    z.object({
        type: z.literal("web-application"),
        user_journeys: designText,
        ui_states: designText,
        accessibility: designText,
        responsive_behavior: designText,
        api_integration: designText,
    }).strict(),
    z.object({
        type: z.literal("service"),
        protocols: designText,
        dependencies: designText,
        failure_modes: designText,
        operability: designText,
        observability: designText,
    }).strict(),
    z.object({
        type: z.literal("cli"),
        command_grammar: designText,
        arguments: designText,
        exit_codes: designText,
        standard_streams: designText,
        shell_compatibility: designText,
    }).strict(),
    z.object({
        type: z.literal("library"),
        public_api: designText,
        compatibility: designText,
        versioning: designText,
        error_surface: designText,
        consumer_examples: designText,
    }).strict(),
    z.object({
        type: z.literal("infrastructure"),
        topology: designText,
        provider: designText,
        state_management: designText,
        identity: designText,
        network_security: designText,
    }).strict(),
]);
export type WorkloadDesignInput = z.infer<typeof workloadDesignInputSchema>;

const DESIGN_LABELS: Record<Workload, Record<string, string>> = {
    api: {
        versioning_strategy: "Versioning strategy",
        error_model: "Error model",
        authentication: "Authentication and authorization",
        rate_limits: "Quotas and rate limits",
    },
    "web-application": {
        user_journeys: "User journeys",
        ui_states: "UI states",
        accessibility: "Accessibility",
        responsive_behavior: "Responsive behavior",
        api_integration: "API integration",
    },
    service: {
        protocols: "Protocols and caller contract",
        dependencies: "Dependencies and ownership",
        failure_modes: "Failure modes and resilience",
        operability: "Deployment and operations",
        observability: "Observability and alerting",
    },
    cli: {
        command_grammar: "Command grammar",
        arguments: "Arguments and options",
        exit_codes: "Exit codes",
        standard_streams: "Standard streams",
        shell_compatibility: "Shell and OS compatibility",
    },
    library: {
        public_api: "Public API",
        compatibility: "Consumer compatibility",
        versioning: "Versioning and deprecation",
        error_surface: "Error surface and ownership",
        consumer_examples: "Consumer examples",
    },
    infrastructure: {
        topology: "Topology and environments",
        provider: "Provider and region policy",
        state_management: "State management and drift",
        identity: "Identity and RBAC",
        network_security: "Network security boundaries",
    },
};

export function renderWorkloadDesign(
    expectedWorkload: Workload,
    input: WorkloadDesignInput,
): string {
    if (input.type !== expectedWorkload) {
        throw new Error(`Design payload type ${input.type} does not match feature workload ${expectedWorkload}.`);
    }
    const labels = DESIGN_LABELS[expectedWorkload];
    return Object.entries(input)
        .filter(([key]) => key !== "type")
        .map(([key, value]) => `### ${labels[key]}\n\n${value}`)
        .join("\n\n");
}
