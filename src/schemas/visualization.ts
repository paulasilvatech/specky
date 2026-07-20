/**
 * Diagrams & Visualization Schemas — sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram.
 */

import { z } from "zod";
import { featureNumberSchema, forceSchema, specDirSchema } from "./common.js";

export const generateDiagramInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    diagram_type: z
      .enum([
        "flowchart",
        "sequence",
        "class",
        "er",
        "state",
        "c4_context",
        "c4_container",
        "c4_component",
        "c4_code",
        "activity",
        "use_case",
        "dfd",
        "deployment",
        "network_topology",
        "gantt",
        "pie",
        "mindmap",
      ])
      .describe("A diagram type required by the selected feature workload contract."),
    mermaid_code: z.string().min(10),
    evidence_refs: z.array(z.string().min(3)).min(1),
  })
  .strict()
  .describe("Generate a single Mermaid diagram from a specification artifact.");

export const generateAllDiagramsInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    force: forceSchema,
    diagrams: z
      .array(
        z
          .object({
            diagram_type: z.enum([
              "flowchart",
              "sequence",
              "class",
              "er",
              "state",
              "c4_context",
              "c4_container",
              "c4_component",
              "c4_code",
              "activity",
              "use_case",
              "dfd",
              "deployment",
              "network_topology",
              "gantt",
              "pie",
              "mindmap",
            ]),
            mermaid_code: z.string().min(10),
            evidence_refs: z.array(z.string().min(3)).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .describe(
    "Generate ALL diagram types for a feature in one call. Produces architecture, sequence, ERD, flow, dependency, and traceability diagrams.",
  );

export const generateUserStoriesInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    stories: z
      .array(
        z
          .object({
            requirement_id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
            role: z.string().min(3),
            goal: z.string().min(5),
            benefit: z.string().min(5),
            priority: z.enum(["P1", "P2", "P3", "P4"]),
            acceptance_criteria: z.array(z.string().min(5)).min(1),
            independent_test: z.string().min(10),
            flow_steps: z.array(z.string().min(3)).min(2),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .describe(
    "Generate user stories with acceptance criteria and flow diagrams from SPECIFICATION.md. Each story includes a Mermaid flowchart of the user journey.",
  );

export const figmaDiagramInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    diagram_type: z
      .enum(["architecture", "user_flow", "data_flow", "integration"])
      .describe("Type of diagram to generate for FigJam."),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^\w+$/),
            label: z.string().min(1),
            type: z.enum(["user", "component", "service", "database", "external"]),
          })
          .strict(),
      )
      .min(2),
    connections: z
      .array(
        z
          .object({
            from: z.string().regex(/^\w+$/),
            to: z.string().regex(/^\w+$/),
            label: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    evidence_refs: z.array(z.string().min(3)).min(1),
  })
  .strict()
  .describe(
    "Generate a FigJam-ready diagram payload from specification artifacts. Outputs structured data for the AI client to call Figma MCP's generate_diagram tool.",
  );
