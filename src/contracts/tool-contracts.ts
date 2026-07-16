import { Phase, TOOL_NAMES, TOTAL_TOOLS } from "../constants.js";
import type { Capability } from "./use-case.js";

export type ToolScope = "bootstrap" | "workspace" | "feature" | "batch" | "stateless";
export type ToolStateScope = "none" | "workspace" | "feature";
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export interface ToolContract {
    scope: ToolScope;
    state: ToolStateScope;
    phases: "any" | readonly Phase[];
    reads: readonly string[];
    writes: readonly string[];
    capability?: Capability;
}

const ANY = "any" as const;

export const TOOL_CONTRACTS = {
    [TOOL_NAMES.INIT]: { scope: "bootstrap", state: "none", phases: [Phase.Init], reads: ["use-case contract"], writes: ["CONSTITUTION.md", ".sdd-state.json", ".sdd-state.json.sig"] },
    [TOOL_NAMES.DISCOVER]: { scope: "feature", state: "feature", phases: [Phase.Init, Phase.Discover], reads: ["use-case contract", "codebase summary"], writes: ["feature state"] },
    [TOOL_NAMES.WRITE_SPEC]: { scope: "feature", state: "feature", phases: [Phase.Discover, Phase.Specify, Phase.Analyze], reads: ["CONSTITUTION.md", "discovery answers"], writes: ["SPECIFICATION.md", "feature package", "feature state"] },
    [TOOL_NAMES.CLARIFY]: { scope: "feature", state: "feature", phases: [Phase.Specify, Phase.Clarify], reads: ["SPECIFICATION.md"], writes: ["feature state"] },
    [TOOL_NAMES.WRITE_DESIGN]: { scope: "feature", state: "feature", phases: [Phase.Clarify, Phase.Design, Phase.Analyze], reads: ["SPECIFICATION.md", "use-case contract"], writes: ["DESIGN.md", "feature state"] },
    [TOOL_NAMES.WRITE_TASKS]: { scope: "feature", state: "feature", phases: [Phase.Design, Phase.Tasks, Phase.Analyze], reads: ["SPECIFICATION.md", "DESIGN.md"], writes: ["TASKS.md", "feature state"] },
    [TOOL_NAMES.RUN_ANALYSIS]: { scope: "feature", state: "feature", phases: [Phase.Tasks, Phase.Analyze], reads: ["CONSTITUTION.md", "SPECIFICATION.md", "DESIGN.md", "TASKS.md"], writes: ["ANALYSIS.md", "gate decision", "feature state"] },
    [TOOL_NAMES.ADVANCE_PHASE]: { scope: "feature", state: "feature", phases: ANY, reads: ["phase artifacts", "feature state"], writes: ["feature state", "gate history"] },

    [TOOL_NAMES.GET_STATUS]: { scope: "workspace", state: "workspace", phases: ANY, reads: ["feature directories", "feature states"], writes: [] },
    [TOOL_NAMES.GET_TEMPLATE]: { scope: "stateless", state: "none", phases: ANY, reads: ["named template"], writes: [] },
    [TOOL_NAMES.WRITE_BUGFIX]: { scope: "feature", state: "feature", phases: ANY, reads: ["bug context"], writes: ["BUGFIX.md"] },
    [TOOL_NAMES.CHECK_SYNC]: { scope: "feature", state: "feature", phases: ANY, reads: ["SPECIFICATION.md", "source code"], writes: ["SYNC-REPORT.md", "drift history"] },
    [TOOL_NAMES.SCAN_CODEBASE]: { scope: "workspace", state: "none", phases: ANY, reads: ["workspace files"], writes: [] },
    [TOOL_NAMES.AMEND]: { scope: "feature", state: "feature", phases: ANY, reads: ["CONSTITUTION.md"], writes: ["CONSTITUTION.md", "feature state"] },

    [TOOL_NAMES.IMPORT_TRANSCRIPT]: { scope: "feature", state: "feature", phases: [Phase.Discover, Phase.Specify], reads: ["transcript"], writes: ["TRANSCRIPT.md", "feature state"], capability: "transcript-import" },
    [TOOL_NAMES.AUTO_PIPELINE]: { scope: "batch", state: "none", phases: ANY, reads: ["transcript", "use-case contract"], writes: ["feature package", "feature state"], capability: "transcript-import" },
    [TOOL_NAMES.BATCH_TRANSCRIPTS]: { scope: "batch", state: "none", phases: [Phase.Discover, Phase.Specify], reads: ["transcripts", "use-case contracts"], writes: ["feature packages", "feature states"], capability: "transcript-import" },
    [TOOL_NAMES.IMPORT_DOCUMENT]: { scope: "workspace", state: "none", phases: [Phase.Discover, Phase.Specify], reads: ["source document"], writes: ["converted document"], capability: "document-import" },
    [TOOL_NAMES.BATCH_IMPORT]: { scope: "batch", state: "none", phases: [Phase.Discover, Phase.Specify], reads: ["source documents"], writes: ["converted documents"], capability: "document-import" },
    [TOOL_NAMES.FIGMA_TO_SPEC]: { scope: "feature", state: "feature", phases: [Phase.Discover, Phase.Specify], reads: ["Figma payload"], writes: ["specification input"], capability: "figma" },

    [TOOL_NAMES.CHECKLIST]: { scope: "feature", state: "feature", phases: [Phase.Tasks, Phase.Analyze], reads: ["SPECIFICATION.md", "DESIGN.md"], writes: ["CHECKLIST.md"] },
    [TOOL_NAMES.VERIFY_TASKS]: { scope: "feature", state: "feature", phases: [Phase.Implement, Phase.Verify], reads: ["TASKS.md", "source code"], writes: ["VERIFICATION.md"] },
    [TOOL_NAMES.COMPLIANCE_CHECK]: { scope: "feature", state: "feature", phases: [Phase.Tasks, Phase.Analyze], reads: ["SPECIFICATION.md", "DESIGN.md", "compliance control pack"], writes: ["COMPLIANCE.md"], capability: "compliance" },
    [TOOL_NAMES.CROSS_ANALYZE]: { scope: "feature", state: "feature", phases: [Phase.Tasks, Phase.Analyze], reads: ["SPECIFICATION.md", "DESIGN.md", "TASKS.md"], writes: ["CROSS-ANALYSIS.md"] },
    [TOOL_NAMES.VALIDATE_EARS]: { scope: "feature", state: "feature", phases: ANY, reads: ["requirements"], writes: [] },

    [TOOL_NAMES.GENERATE_DIAGRAM]: { scope: "feature", state: "feature", phases: ANY, reads: ["specified artifact"], writes: ["DIAGRAMS.md"] },
    [TOOL_NAMES.GENERATE_ALL_DIAGRAMS]: { scope: "feature", state: "feature", phases: ANY, reads: ["SPECIFICATION.md", "DESIGN.md"], writes: ["DIAGRAMS.md"] },
    [TOOL_NAMES.GENERATE_USER_STORIES]: { scope: "feature", state: "feature", phases: ANY, reads: ["SPECIFICATION.md"], writes: ["USER-STORIES.md"] },
    [TOOL_NAMES.FIGMA_DIAGRAM]: { scope: "feature", state: "feature", phases: ANY, reads: ["DESIGN.md"], writes: ["Figma payload"], capability: "figma" },

    [TOOL_NAMES.GENERATE_IAC]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["DESIGN.md", "IaC capability contract"], writes: ["IaC files"], capability: "iac" },
    [TOOL_NAMES.VALIDATE_IAC]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["IaC files", "IaC capability contract"], writes: ["IaC validation evidence"], capability: "iac" },
    [TOOL_NAMES.GENERATE_DOCKERFILE]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["DESIGN.md", "dev-environment capability contract"], writes: ["Dockerfile", "docker-compose.yml"], capability: "dev-environment" },
    [TOOL_NAMES.SETUP_LOCAL_ENV]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["DESIGN.md", "dev-environment capability contract"], writes: ["docker-compose.yml", ".env.example"], capability: "dev-environment" },
    [TOOL_NAMES.SETUP_CODESPACES]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["dev-environment capability contract"], writes: ["Codespaces configuration"], capability: "dev-environment" },
    [TOOL_NAMES.GENERATE_DEVCONTAINER]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["DESIGN.md", "dev-environment capability contract"], writes: [".devcontainer/devcontainer.json"], capability: "dev-environment" },

    [TOOL_NAMES.CREATE_BRANCH]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["branch contract", "Git state"], writes: ["Git branch command"], capability: "release" },
    [TOOL_NAMES.EXPORT_WORK_ITEMS]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["TASKS.md", "work-items capability contract"], writes: ["work item payloads"], capability: "work-items" },
    [TOOL_NAMES.CREATE_PR]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["feature artifacts", "release capability contract"], writes: ["pull request payload"], capability: "release" },
    [TOOL_NAMES.IMPLEMENT]: { scope: "feature", state: "feature", phases: [Phase.Analyze, Phase.Implement], reads: ["TASKS.md", "DESIGN.md"], writes: ["implementation plan"] },
    [TOOL_NAMES.RESEARCH]: { scope: "feature", state: "feature", phases: ANY, reads: ["research question", "use-case contract"], writes: ["RESEARCH.md"] },

    [TOOL_NAMES.GENERATE_DOCS]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["feature artifacts"], writes: ["documentation"], capability: "release" },
    [TOOL_NAMES.GENERATE_API_DOCS]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["DESIGN.md", "API contract"], writes: ["API-REFERENCE.md"], capability: "release" },
    [TOOL_NAMES.GENERATE_RUNBOOK]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["DESIGN.md", "operational contract"], writes: ["RUNBOOK.md"], capability: "release" },
    [TOOL_NAMES.GENERATE_ONBOARDING]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["feature artifacts"], writes: ["ONBOARDING.md"], capability: "release" },
    [TOOL_NAMES.GENERATE_ALL_DOCS]: { scope: "feature", state: "feature", phases: [Phase.Verify, Phase.Release], reads: ["feature artifacts", "release capability contract"], writes: ["documentation set"], capability: "release" },

    [TOOL_NAMES.METRICS]: { scope: "feature", state: "feature", phases: ANY, reads: ["feature artifacts", "feature state"], writes: ["metrics report"] },
    [TOOL_NAMES.GENERATE_TESTS]: { scope: "feature", state: "feature", phases: [Phase.Implement, Phase.Verify], reads: ["SPECIFICATION.md", "TDD capability contract"], writes: ["test files"], capability: "tdd" },
    [TOOL_NAMES.VERIFY_TESTS]: { scope: "feature", state: "feature", phases: [Phase.Implement, Phase.Verify], reads: ["test results", "TDD capability contract"], writes: ["VERIFICATION.md"], capability: "tdd" },
    [TOOL_NAMES.GENERATE_PBT]: { scope: "feature", state: "feature", phases: [Phase.Implement, Phase.Verify], reads: ["SPECIFICATION.md", "TDD capability contract"], writes: ["property-based tests"], capability: "tdd" },
    [TOOL_NAMES.TURNKEY_SPEC]: { scope: "feature", state: "feature", phases: [Phase.Discover, Phase.Specify], reads: ["use-case contract", "requirements"], writes: ["feature package", "feature state"] },

    [TOOL_NAMES.CHECKPOINT]: { scope: "feature", state: "feature", phases: ANY, reads: ["feature artifacts", "feature state"], writes: ["checkpoint"] },
    [TOOL_NAMES.RESTORE]: { scope: "feature", state: "feature", phases: ANY, reads: ["checkpoint"], writes: ["feature artifacts", "feature state"] },
    [TOOL_NAMES.LIST_CHECKPOINTS]: { scope: "feature", state: "feature", phases: ANY, reads: ["checkpoints"], writes: [] },
    [TOOL_NAMES.CHECK_ECOSYSTEM]: { scope: "workspace", state: "none", phases: ANY, reads: ["MCP ecosystem configuration"], writes: [] },
    [TOOL_NAMES.MODEL_ROUTING]: { scope: "stateless", state: "none", phases: ANY, reads: ["model routing contract"], writes: [] },
    [TOOL_NAMES.CONTEXT_STATUS]: { scope: "feature", state: "feature", phases: ANY, reads: ["feature state", "context contract"], writes: [] },
    [TOOL_NAMES.CHECK_ACCESS]: { scope: "stateless", state: "none", phases: ANY, reads: ["RBAC policy"], writes: [] },
    [TOOL_NAMES.VERIFY_AUDIT]: { scope: "workspace", state: "none", phases: ANY, reads: ["audit log"], writes: [] },
} as const satisfies Record<ToolName, ToolContract>;

export function getToolContract(toolName: string): ToolContract {
    const contract = (TOOL_CONTRACTS as Record<string, ToolContract | undefined>)[toolName];
    if (!contract) {
        throw new Error(`No explicit tool contract registered for ${toolName}`);
    }
    return contract;
}

export function assertToolContractCompleteness(): void {
    const registeredNames = Object.values(TOOL_NAMES);
    const contractNames = Object.keys(TOOL_CONTRACTS);
    if (registeredNames.length !== TOTAL_TOOLS) {
        throw new Error(`TOOL_NAMES declares ${registeredNames.length} tools; TOTAL_TOOLS is ${TOTAL_TOOLS}`);
    }

    const missing = registeredNames.filter((name) => !(name in TOOL_CONTRACTS));
    const orphaned = contractNames.filter((name) => !registeredNames.includes(name as ToolName));
    if (missing.length > 0 || orphaned.length > 0) {
        throw new Error(`Tool contract mismatch. Missing: ${missing.join(", ") || "none"}. Orphaned: ${orphaned.join(", ") || "none"}.`);
    }
}

assertToolContractCompleteness();
