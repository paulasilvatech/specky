/**
 * Specky MCP Server — Constants
 * All shared constants, enums, and configuration values.
 */

/** Specky server version — matches package.json */
export const VERSION = "1.0.0";

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
} as const;

/** Template names matching files in templates/ directory */
export const TEMPLATE_NAMES = [
  "constitution",
  "specification",
  "design",
  "tasks",
  "analysis",
  "bugfix",
  "sync_report",
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
