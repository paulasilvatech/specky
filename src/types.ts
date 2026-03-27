/**
 * Specky MCP Server — Type Definitions
 * All TypeScript interfaces and types used across the project.
 */

import { type Phase as PhaseEnum, type EarsPatternName, type TemplateName, type WorkItemPlatform, type DiagramType, type ComplianceFramework, type ChecklistDomain, type DocumentFormat, type IacProvider, type CloudProvider } from "./constants.js";

/** Re-export Phase type from constants for convenience */
export type Phase = PhaseEnum;

/** Status of a single pipeline phase */
export interface PhaseStatus {
  status: "pending" | "in_progress" | "completed";
  started_at?: string;
  completed_at?: string;
}

/** Gate decision after analysis phase */
export interface GateDecision {
  decision: "APPROVE" | "CHANGES_NEEDED" | "BLOCK";
  reasons: string[];
  coverage_percent: number;
  gaps: string[];
  decided_at: string;
}

/** Amendment to CONSTITUTION.md */
export interface Amendment {
  number: number;
  date: string;
  author: string;
  rationale: string;
  articles_affected: string[];
}

/** Full pipeline state persisted in .sdd-state.json */
export interface SddState {
  version: string;
  project_name: string;
  current_phase: PhaseEnum;
  phases: Record<PhaseEnum, PhaseStatus>;
  features: string[];
  amendments: Amendment[];
  gate_decision: GateDecision | null;
}

/** Information about a feature directory */
export interface FeatureInfo {
  number: string;
  name: string;
  directory: string;
  files: string[];
}

/** A single EARS requirement */
export interface EarsRequirement {
  id: string;
  pattern: EarsPatternName;
  text: string;
  acceptance_criteria: string[];
  traces_to: string[];
}

/** Recursive directory tree node */
export interface DirectoryTree {
  name: string;
  type: "file" | "directory";
  children?: DirectoryTree[];
}

/** Tech stack detection result */
export interface TechStack {
  language: string;
  framework?: string;
  package_manager: string;
  runtime: string;
}

/** Full codebase scan result */
export interface CodebaseSummary {
  tree: DirectoryTree;
  tech_stack: TechStack;
  total_files: number;
  total_dirs: number;
}

/** Result of a phase transition check */
export interface TransitionResult {
  allowed: boolean;
  from_phase: PhaseEnum;
  to_phase: PhaseEnum;
  missing_files?: string[];
  error_message?: string;
}

/** Result of validating a single EARS requirement */
export interface ValidationResult {
  valid: boolean;
  pattern: EarsPatternName;
  suggestion?: string;
  issues?: string[];
}

/** Result of validating multiple EARS requirements */
export interface BatchValidationResult {
  valid: number;
  invalid: number;
  results: ValidationResult[];
}

/** EARS improvement suggestion */
export interface EarsImprovement {
  pattern: EarsPatternName;
  suggestion: string;
}

/** Context for template rendering */
export interface TemplateContext {
  title?: string;
  version?: string;
  date?: string;
  author?: string;
  status?: string;
  feature_id?: string;
  [key: string]: string | string[] | undefined;
}

/** Tool error format */
export interface ToolError {
  tool_name: string;
  message: string;
  expected?: string;
  found?: string;
  fix?: string;
}

/** Parsed transcript from VTT/SRT/TXT */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp?: string;
}

/** Structured extraction from a meeting transcript */
export interface TranscriptAnalysis {
  title: string;
  participants: string[];
  duration_estimate: string;
  segments: TranscriptSegment[];
  topics: TranscriptTopic[];
  decisions: string[];
  action_items: string[];
  requirements_raw: string[];
  constraints_mentioned: string[];
  open_questions: string[];
  full_text: string;
}

/** Topic extracted from transcript */
export interface TranscriptTopic {
  name: string;
  summary: string;
  speakers: string[];
  key_points: string[];
}

/** Input for auto-pipeline from transcript */
export interface AutoPipelineResult {
  project_name: string;
  feature_dir: string;
  files_created: string[];
  transcript_source: string;
  participants: string[];
  topics_extracted: number;
  requirements_generated: number;
  decisions_captured: number;
  gate_decision: string;
  next_action: string;
}

// ─── Document Conversion ───

/** Result of converting a document to Markdown */
export interface DocumentConversionResult {
  format: DocumentFormat;
  markdown: string;
  metadata: DocumentMetadata;
  page_count?: number;
  word_count: number;
}

/** Metadata extracted from a document */
export interface DocumentMetadata {
  title?: string;
  author?: string;
  date?: string;
  sections: string[];
  source_file?: string;
}

// ─── Work Item Export (MCP-to-MCP) ───

/** Structured payload for exporting work items to external platforms */
export interface WorkItemExportResult {
  platform: WorkItemPlatform;
  items: WorkItemPayload[];
  metadata: WorkItemMetadata;
  routing_instructions: RoutingInstructions;
}

/** Individual work item payload */
export interface WorkItemPayload {
  task_id: string;
  title: string;
  description: string;
  traces_to: string[];
  effort?: string;
  dependencies: string[];
  acceptance_criteria: string[];
}

/** Platform-specific work item metadata */
export interface WorkItemMetadata {
  feature_number: string;
  feature_name: string;
  total_items: number;
  generated_at: string;
}

/** Instructions for the AI client on which MCP server to call */
export interface RoutingInstructions {
  mcp_server: string;
  tool_name: string;
  note: string;
}

/** GitHub Issue payload format */
export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone?: string;
}

/** Azure Boards Work Item payload format */
export interface AzureBoardsPayload {
  title: string;
  description: string;
  work_item_type: "User Story" | "Task" | "Bug" | "Feature" | "Epic";
  area_path?: string;
  iteration_path?: string;
  tags: string[];
  acceptance_criteria?: string;
}

/** Jira Issue payload format */
export interface JiraPayload {
  summary: string;
  description: string;
  issue_type: "Story" | "Task" | "Bug" | "Epic";
  project_key: string;
  labels: string[];
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
}

// ─── Cross-Artifact Analysis ───

/** Result of cross-artifact consistency analysis */
export interface CrossAnalysisResult {
  spec_design_alignment: AlignmentCheck[];
  design_tasks_alignment: AlignmentCheck[];
  orphaned_requirements: string[];
  orphaned_tasks: string[];
  missing_designs: string[];
  consistency_score: number;
  explanation: string;
  diagram: string;
}

/** Single alignment check between two artifacts */
export interface AlignmentCheck {
  source_id: string;
  target_id: string;
  status: "aligned" | "misaligned" | "missing";
  detail: string;
}

// ─── Checklist ───

/** Quality checklist item */
export interface ChecklistItem {
  id: string;
  category: string;
  check: string;
  status: "pass" | "fail" | "pending";
  evidence?: string;
  mandatory: boolean;
}

/** Quality checklist result */
export interface ChecklistResult {
  domain: ChecklistDomain;
  items: ChecklistItem[];
  pass_count: number;
  fail_count: number;
  pending_count: number;
  mandatory_pass_rate: number;
  explanation: string;
  next_steps: string;
}

// ─── Research ───

/** Research entry for resolving unknowns */
export interface ResearchEntry {
  id: string;
  question: string;
  findings: string;
  sources: string[];
  recommendation: string;
  status: "resolved" | "open" | "deferred";
}

// ─── Compliance ───

/** Compliance check result */
export interface ComplianceResult {
  framework: ComplianceFramework;
  controls_checked: number;
  controls_passed: number;
  controls_failed: number;
  controls_na: number;
  findings: ComplianceFinding[];
  overall_status: "compliant" | "non_compliant" | "partial";
  explanation: string;
  next_steps: string;
}

/** Individual compliance finding */
export interface ComplianceFinding {
  control_id: string;
  control_name: string;
  description: string;
  status: "pass" | "fail" | "na";
  evidence?: string;
  remediation?: string;
}

// ─── Diagrams ───

/** Diagram specification */
export interface DiagramSpec {
  type: DiagramType;
  title: string;
  source: string;
  mermaid_code: string;
}

/** Result of generating all diagrams for a feature */
export interface AllDiagramsResult {
  feature_number: string;
  diagrams: DiagramSpec[];
  total_generated: number;
}

// ─── User Stories ───

/** User story with flow diagram */
export interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  acceptance_criteria: string[];
  flow_diagram: string;
  independent_test: string;
}

/** User stories generation result */
export interface UserStoriesResult {
  stories: UserStory[];
  total_count: number;
  diagram: string;
  explanation: string;
}

// ─── Infrastructure as Code ───

/** IaC generation result */
export interface IacResult {
  provider: IacProvider;
  files: IacFile[];
  variables: IacVariable[];
  explanation: string;
  next_steps: string;
  diagram: string;
}

/** Individual IaC file */
export interface IacFile {
  path: string;
  content: string;
  description: string;
}

/** IaC variable definition */
export interface IacVariable {
  name: string;
  type: string;
  description: string;
  default?: string;
  required: boolean;
}

/** IaC validation result */
export interface IacValidationResult {
  provider: IacProvider;
  cloud: CloudProvider;
  payload: Record<string, unknown>;
  routing_instructions: RoutingInstructions;
  explanation: string;
}

// ─── Dev Environment ───

/** Dev environment setup result */
export interface DevEnvironmentResult {
  type: "docker" | "codespaces" | "devcontainer";
  files: IacFile[];
  routing_instructions?: RoutingInstructions;
  explanation: string;
  next_steps: string;
}

// ─── PR & Branch ───

/** PR payload for GitHub MCP */
export interface PrPayload {
  title: string;
  body: string;
  base_branch: string;
  head_branch: string;
  labels: string[];
  spec_summary: string;
  requirements_covered: string[];
  routing_instructions: RoutingInstructions;
}

/** Branch info payload */
export interface BranchInfo {
  name: string;
  feature_number: string;
  convention: string;
  command_hint: string;
}

// ─── Implementation ───

/** Implementation plan with ordered tasks */
export interface ImplementationPlan {
  feature_number: string;
  phases: ImplementationPhase[];
  total_tasks: number;
  parallel_opportunities: number;
  estimated_checkpoints: number;
  diagram: string;
  explanation: string;
  next_steps: string;
}

/** Phase within implementation plan */
export interface ImplementationPhase {
  name: string;
  tasks: ImplementationTask[];
  checkpoint: boolean;
}

/** Task within implementation phase */
export interface ImplementationTask {
  id: string;
  title: string;
  file_path?: string;
  parallel: boolean;
  dependencies: string[];
  traces_to: string[];
}

// ─── Verification ───

/** Task verification result */
export interface VerificationResult {
  task_id: string;
  claimed_status: string;
  verified_status: string;
  evidence: string[];
  phantom: boolean;
}

/** Full verification report */
export interface VerificationReport {
  feature_number: string;
  results: VerificationResult[];
  total_tasks: number;
  verified_count: number;
  phantom_count: number;
  pass_rate: number;
  explanation: string;
  diagram: string;
}

// ─── Metrics ───

/** Project metrics dashboard */
export interface ProjectMetrics {
  phases_completed: number;
  total_phases: number;
  completion_percent: number;
  requirements_count: number;
  ears_valid: number;
  ears_invalid: number;
  tasks_count: number;
  tasks_complete: number;
  parallel_opportunities: number;
  coverage_percent: number;
  compliance_status: string;
  work_items_exported: number;
  open_research_items: number;
  checklist_pass_rate: number;
  diagrams_generated: number;
  drift_score: number;
  explanation: string;
  diagram: string;
}

// ─── Documentation ───

/** Auto-generated documentation result */
export interface DocumentationResult {
  type: "full" | "api" | "runbook" | "onboarding" | "journey" | "all";
  content: string;
  file_path: string;
  sections: string[];
  explanation: string;
}

// ─── MCP Ecosystem Recommendations ───

/** Recommended external MCP server that enhances a Specky tool */
export interface RecommendedServer {
  id: string;
  name: string;
  purpose: string;
  install_command: string;
  install_note: string;
  required: boolean;
  status: "available" | "recommended" | "required";
  enhances: string[];
}

/** Ecosystem check result */
export interface EcosystemCheckResult {
  specky_version: string;
  total_tools: number;
  recommended_servers: RecommendedServer[];
  explanation: string;
  next_steps: string;
}

// ─── Pipeline Validation ───

/** Result of validating whether a tool can execute in the current phase */
export interface PhaseValidation {
  allowed: boolean;
  current_phase: PhaseEnum;
  expected_phases: PhaseEnum[];
  error_message?: string;
}

/** Context passed during phase handoff to guide the AI client */
export interface HandoffContext {
  completed_phase: PhaseEnum;
  next_phase: PhaseEnum;
  artifacts_produced: string[];
  summary_of_work: string;
  what_comes_next: string;
  methodology_note: string;
}

/** Parallel execution hints for the AI client */
export interface ParallelHint {
  can_run_now: string[];
  must_wait_for: string[];
  explanation: string;
}

/** Enriched tool response envelope with educational content */
export interface ToolResponseEnvelope {
  status: string;
  phase_context: {
    current_phase: PhaseEnum;
    phase_progress: string;
    phases_completed: PhaseEnum[];
    completion_percent: number;
  };
  handoff?: HandoffContext;
  parallel_opportunities?: ParallelHint;
  educational_note: string;
  methodology_tip: string;
  [key: string]: unknown;
}

// ─── Educative Output (standard response envelope) ───

/** Standard response fields for educative/interactive outputs */
export interface EducativeOutput {
  explanation: string;
  next_steps: string;
  learning_note: string;
  diagram?: string;
  recommended_servers?: RecommendedServer[];
}

// ─── Checkpoints ───

/** Checkpoint snapshot of spec artifacts */
export interface Checkpoint {
  id: string;
  label: string;
  created_at: string;
  phase: string;
  phases: Record<string, PhaseStatus>;
  gate_decision: GateDecision | null;
  artifacts: string[];
  artifact_contents: Record<string, string>;
}

/** Re-export for convenience */
export type { EarsPatternName, TemplateName, WorkItemPlatform, DiagramType, ComplianceFramework, ChecklistDomain, DocumentFormat, IacProvider, CloudProvider };
