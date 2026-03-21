/**
 * Specky MCP Server — Type Definitions
 * All TypeScript interfaces and types used across the project.
 */

import { type Phase as PhaseEnum, type EarsPatternName, type TemplateName } from "./constants.js";

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

/** Re-export for convenience */
export type { EarsPatternName, TemplateName };
