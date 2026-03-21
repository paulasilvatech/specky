/**
 * Specky MCP Server — Constants
 * All shared constants, enums, and configuration values.
 */

/** Specky server version — matches package.json */
export const VERSION = "2.0.0";

/** Server name for MCP handshake */
export const SERVER_NAME = "specky";

/** Maximum response size in characters before truncation */
export const CHARACTER_LIMIT = 25_000;

/** Default directory for SDD specifications */
export const DEFAULT_SPEC_DIR = ".specs";

/** State file name */
export const STATE_FILE = ".sdd-state.json";

/** Default HTTP port for Streamable HTTP transport */
export const DEFAULT_HTTP_PORT = 3200;

/** Default scan depth for codebase scanner */
export const DEFAULT_SCAN_DEPTH = 3;

/** Maximum scan depth allowed */
export const MAX_SCAN_DEPTH = 5;

/** Default exclude patterns for codebase scanning */
export const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = [
  "node_modules",
  ".git",
  "dist",
  ".next",
  "__pycache__",
  ".venv",
  "target",
  "build",
  "coverage",
];

/**
 * SDD Pipeline phases in order.
 * Each phase requires its predecessor to be completed.
 */
export enum Phase {
  Init = "init",
  Discover = "discover",
  Specify = "specify",
  Clarify = "clarify",
  Design = "design",
  Tasks = "tasks",
  Analyze = "analyze",
  Implement = "implement",
  Verify = "verify",
  Release = "release",
}

/** Ordered array of all phases for iteration */
export const PHASE_ORDER: readonly Phase[] = [
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
];

/** Maps each phase to the required file(s) that must exist before advancing past it */
export const PHASE_REQUIRED_FILES: Record<Phase, readonly string[]> = {
  [Phase.Init]: ["CONSTITUTION.md"],
  [Phase.Discover]: [],
  [Phase.Specify]: ["SPECIFICATION.md"],
  [Phase.Clarify]: ["SPECIFICATION.md"],
  [Phase.Design]: ["DESIGN.md"],
  [Phase.Tasks]: ["TASKS.md"],
  [Phase.Analyze]: ["ANALYSIS.md"],
  [Phase.Implement]: ["CHECKLIST.md"],
  [Phase.Verify]: ["VERIFICATION.md"],
  [Phase.Release]: [],
};

/** All MCP tool names — prefixed with sdd_ */
export const TOOL_NAMES = {
  // Pipeline tools
  INIT: "sdd_init",
  DISCOVER: "sdd_discover",
  WRITE_SPEC: "sdd_write_spec",
  CLARIFY: "sdd_clarify",
  WRITE_DESIGN: "sdd_write_design",
  WRITE_TASKS: "sdd_write_tasks",
  RUN_ANALYSIS: "sdd_run_analysis",
  ADVANCE_PHASE: "sdd_advance_phase",
  // Utility tools
  GET_STATUS: "sdd_get_status",
  GET_TEMPLATE: "sdd_get_template",
  WRITE_BUGFIX: "sdd_write_bugfix",
  CHECK_SYNC: "sdd_check_sync",
  SCAN_CODEBASE: "sdd_scan_codebase",
  AMEND: "sdd_amend",
  // Transcript automation tools
  IMPORT_TRANSCRIPT: "sdd_import_transcript",
  AUTO_PIPELINE: "sdd_auto_pipeline",
  BATCH_TRANSCRIPTS: "sdd_batch_transcripts",
  // Input & Conversion
  IMPORT_DOCUMENT: "sdd_import_document",
  BATCH_IMPORT: "sdd_batch_import",
  FIGMA_TO_SPEC: "sdd_figma_to_spec",
  // Quality & Validation
  CHECKLIST: "sdd_checklist",
  VERIFY_TASKS: "sdd_verify_tasks",
  COMPLIANCE_CHECK: "sdd_compliance_check",
  CROSS_ANALYZE: "sdd_cross_analyze",
  VALIDATE_EARS: "sdd_validate_ears",
  // Diagrams & Visualization
  GENERATE_DIAGRAM: "sdd_generate_diagram",
  GENERATE_ALL_DIAGRAMS: "sdd_generate_all_diagrams",
  GENERATE_USER_STORIES: "sdd_generate_user_stories",
  FIGMA_DIAGRAM: "sdd_figma_diagram",
  // Infrastructure as Code
  GENERATE_IAC: "sdd_generate_iac",
  VALIDATE_IAC: "sdd_validate_iac",
  GENERATE_DOCKERFILE: "sdd_generate_dockerfile",
  // Dev Environment
  SETUP_LOCAL_ENV: "sdd_setup_local_env",
  SETUP_CODESPACES: "sdd_setup_codespaces",
  GENERATE_DEVCONTAINER: "sdd_generate_devcontainer",
  // Integration & Export
  CREATE_BRANCH: "sdd_create_branch",
  EXPORT_WORK_ITEMS: "sdd_export_work_items",
  CREATE_PR: "sdd_create_pr",
  IMPLEMENT: "sdd_implement",
  RESEARCH: "sdd_research",
  // Documentation
  GENERATE_DOCS: "sdd_generate_docs",
  GENERATE_API_DOCS: "sdd_generate_api_docs",
  GENERATE_RUNBOOK: "sdd_generate_runbook",
  GENERATE_ONBOARDING: "sdd_generate_onboarding",
  // Metrics
  METRICS: "sdd_metrics",
} as const;

// Input & Conversion
export const TOOL_IMPORT_DOCUMENT = "sdd_import_document";
export const TOOL_BATCH_IMPORT = "sdd_batch_import";
export const TOOL_FIGMA_TO_SPEC = "sdd_figma_to_spec";

// Quality & Validation
export const TOOL_CHECKLIST = "sdd_checklist";
export const TOOL_VERIFY_TASKS = "sdd_verify_tasks";
export const TOOL_COMPLIANCE_CHECK = "sdd_compliance_check";
export const TOOL_CROSS_ANALYZE = "sdd_cross_analyze";
export const TOOL_VALIDATE_EARS = "sdd_validate_ears";

// Diagrams & Visualization
export const TOOL_GENERATE_DIAGRAM = "sdd_generate_diagram";
export const TOOL_GENERATE_ALL_DIAGRAMS = "sdd_generate_all_diagrams";
export const TOOL_GENERATE_USER_STORIES = "sdd_generate_user_stories";
export const TOOL_FIGMA_DIAGRAM = "sdd_figma_diagram";

// Infrastructure as Code
export const TOOL_GENERATE_IAC = "sdd_generate_iac";
export const TOOL_VALIDATE_IAC = "sdd_validate_iac";
export const TOOL_GENERATE_DOCKERFILE = "sdd_generate_dockerfile";

// Dev Environment
export const TOOL_SETUP_LOCAL_ENV = "sdd_setup_local_env";
export const TOOL_SETUP_CODESPACES = "sdd_setup_codespaces";
export const TOOL_GENERATE_DEVCONTAINER = "sdd_generate_devcontainer";

// Integration & Export
export const TOOL_CREATE_BRANCH = "sdd_create_branch";
export const TOOL_EXPORT_WORK_ITEMS = "sdd_export_work_items";
export const TOOL_CREATE_PR = "sdd_create_pr";
export const TOOL_IMPLEMENT = "sdd_implement";
export const TOOL_RESEARCH = "sdd_research";

// Documentation
export const TOOL_GENERATE_DOCS = "sdd_generate_docs";
export const TOOL_GENERATE_API_DOCS = "sdd_generate_api_docs";
export const TOOL_GENERATE_RUNBOOK = "sdd_generate_runbook";
export const TOOL_GENERATE_ONBOARDING = "sdd_generate_onboarding";

// Metrics
export const TOOL_METRICS = "sdd_metrics";

/** Template names matching files in templates/ directory */
export const TEMPLATE_NAMES = [
  "constitution",
  "specification",
  "design",
  "tasks",
  "analysis",
  "bugfix",
  "sync_report",
  "research",
  "data_model",
  "checklist",
  "cross_analysis",
  "work_items",
  "verification",
  "compliance",
  "user_stories",
  "api_docs",
  "runbook",
  "onboarding",
  "terraform",
  "dockerfile",
  "devcontainer",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** EARS pattern names */
export const EARS_PATTERNS = [
  "ubiquitous",
  "event_driven",
  "state_driven",
  "optional",
  "unwanted",
  "complex",
  "unknown",
] as const;

export type EarsPatternName = (typeof EARS_PATTERNS)[number];

/** Supported work item platforms */
export type WorkItemPlatform = "github" | "azure_boards" | "jira";

/** Supported diagram types */
export type DiagramType = "flowchart" | "sequence" | "class" | "er" | "state" | "c4_context" | "c4_container" | "gantt" | "pie" | "mindmap";

/** Supported compliance frameworks */
export type ComplianceFramework = "hipaa" | "soc2" | "gdpr" | "pci_dss" | "iso27001" | "general";

/** Supported checklist domains */
export type ChecklistDomain = "security" | "accessibility" | "performance" | "testing" | "documentation" | "deployment" | "general";

/** Supported document formats for import */
export type DocumentFormat = "auto" | "pdf" | "docx" | "pptx" | "md" | "txt" | "vtt" | "srt";

/** Supported IaC providers */
export type IacProvider = "terraform" | "bicep";

/** Supported cloud providers for validation */
export type CloudProvider = "azure" | "aws" | "gcp";

/** Package manifest files for tech stack detection, in priority order */
export const PACKAGE_MANIFESTS: readonly string[] = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
];
