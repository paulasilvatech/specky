/**
 * Diagrams & Visualization Schemas — sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const generateDiagramInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  diagram_type: z
    .enum([
      "flowchart", "sequence", "class", "er", "state",
      "c4_context", "c4_container", "c4_component", "c4_code",
      "activity", "use_case", "dfd", "deployment", "network_topology",
      "gantt", "pie", "mindmap",
    ])
    .describe("Type of Mermaid diagram to generate. 17 types covering all software engineering diagram categories."),
  source: z
    .enum(["spec", "design", "tasks", "constitution"])
    .describe("Which artifact to generate the diagram from."),
}).strict().describe("Generate a single Mermaid diagram from a specification artifact.");

export const generateAllDiagramsInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate ALL diagram types for a feature in one call. Produces architecture, sequence, ERD, flow, dependency, and traceability diagrams.");

export const generateUserStoriesInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  max_stories: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Maximum number of user stories to generate."),
}).strict().describe("Generate user stories with acceptance criteria and flow diagrams from SPECIFICATION.md. Each story includes a Mermaid flowchart of the user journey.");

export const figmaDiagramInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  diagram_type: z
    .enum(["architecture", "user_flow", "data_flow", "integration"])
    .describe("Type of diagram to generate for FigJam."),
}).strict().describe("Generate a FigJam-ready diagram payload from specification artifacts. Outputs structured data for the AI client to call Figma MCP's generate_diagram tool.");
