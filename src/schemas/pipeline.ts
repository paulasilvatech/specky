/**
 * Zod schemas for all 8 pipeline tool inputs.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema, forceSchema } from "./common.js";

export const initInputSchema = z.object({
  project_name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "Must be kebab-case (lowercase, hyphens)")
    .describe("Project name in kebab-case"),
  spec_dir: specDirSchema,
  principles: z
    .array(z.string())
    .optional()
    .describe("Project guiding principles"),
  constraints: z
    .array(z.string())
    .optional()
    .describe("Project constraints"),
}).strict();

export const discoverInputSchema = z.object({
  project_idea: z
    .string()
    .min(1)
    .max(5000)
    .describe("Description of the project idea"),
  codebase_summary: z
    .string()
    .optional()
    .describe("Output from sdd_scan_codebase for context"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();

export const writeSpecInputSchema = z.object({
  feature_name: z
    .string()
    .min(1)
    .max(200)
    .describe("Human-readable feature name"),
  feature_number: featureNumberSchema,
  discovery_answers: z
    .record(z.string(), z.string())
    .describe("Answers to discovery questions (question_id → answer)"),
  requirements: z
    .array(
      z.object({
        id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/, "Must match REQ-{CAT}-{SEQ} format"),
        ears_pattern: z.string().describe("EARS pattern name"),
        text: z.string().min(10).describe("Requirement text in EARS notation"),
        acceptance_criteria: z.array(z.string()).min(1).describe("Testable acceptance criteria"),
      }).strict()
    )
    .min(1)
    .describe("Requirements in EARS notation"),
  spec_dir: specDirSchema,
  force: forceSchema,
}).strict();

export const clarifyInputSchema = z.object({
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();

export const writeDesignInputSchema = z.object({
  architecture_overview: z
    .string()
    .min(10)
    .describe("High-level architecture description"),
  mermaid_diagrams: z
    .array(
      z.object({
        title: z.string().describe("Diagram title"),
        type: z.string().describe("Mermaid diagram type (flowchart, sequenceDiagram, etc.)"),
        code: z.string().describe("Mermaid diagram code"),
      }).strict()
    )
    .min(1)
    .describe("Mermaid diagrams"),
  adrs: z
    .array(
      z.object({
        title: z.string().describe("ADR title"),
        decision: z.string().describe("The decision made"),
        rationale: z.string().describe("Why this decision was made"),
        consequences: z.string().describe("Consequences of this decision"),
      }).strict()
    )
    .optional()
    .describe("Architecture Decision Records"),
  api_contracts: z
    .array(
      z.object({
        endpoint: z.string().describe("API endpoint path"),
        method: z.string().describe("HTTP method"),
        description: z.string().describe("Endpoint description"),
        request: z.string().optional().describe("Request body schema"),
        response: z.string().optional().describe("Response body schema"),
      }).strict()
    )
    .optional()
    .describe("API contracts"),
  system_context: z
    .string()
    .optional()
    .describe("System context: who uses the system and what external systems it integrates with (C4 Level 1)"),
  container_architecture: z
    .string()
    .optional()
    .describe("Container architecture: deployable units and communication patterns (C4 Level 2)"),
  component_design: z
    .string()
    .optional()
    .describe("Component design: internal modules/services and responsibilities (C4 Level 3)"),
  code_level_design: z
    .string()
    .optional()
    .describe("Code-level design: key classes, interfaces, and patterns (C4 Level 4)"),
  data_models: z
    .string()
    .optional()
    .describe("Data model: entities, relationships, and storage strategy"),
  infrastructure: z
    .string()
    .optional()
    .describe("Infrastructure: deployment, scaling, monitoring, and operations"),
  security_architecture: z
    .string()
    .optional()
    .describe("Security: authentication, authorization, encryption, and threat model"),
  error_handling: z
    .string()
    .optional()
    .describe("Error handling: detection, logging, propagation, and recovery"),
  cross_cutting: z
    .string()
    .optional()
    .describe("Cross-cutting concerns: logging, monitoring, caching, configuration"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
  force: forceSchema,
}).strict();

export const writeTasksInputSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().regex(/^T-\d{3}$/, "Must match T-{SEQ} format"),
        title: z.string().describe("Task title"),
        description: z.string().describe("Task description"),
        effort: z.enum(["S", "M", "L"]).describe("Effort estimate"),
        dependencies: z.array(z.string()).default([]).describe("Task IDs this depends on"),
        parallel: z.boolean().default(false).describe("Can run in parallel with siblings"),
        traces_to: z.array(z.string()).default([]).describe("Requirement IDs this implements"),
      }).strict()
    )
    .min(1)
    .describe("Implementation tasks"),
  pre_impl_gates: z
    .array(
      z.object({
        id: z.string().describe("Gate ID"),
        check: z.string().describe("Gate check description"),
        constitution_article: z.string().describe("Constitution article reference"),
      }).strict()
    )
    .default([])
    .describe("Pre-implementation gates"),
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
  force: forceSchema,
}).strict();

export const runAnalysisInputSchema = z.object({
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
  force: forceSchema,
}).strict();

export const advancePhaseInputSchema = z.object({
  spec_dir: specDirSchema,
  feature_number: featureNumberSchema,
}).strict();
