/**
 * Diagrams & Visualization Schemas — sdd_generate_diagram, sdd_generate_all_diagrams, sdd_generate_user_stories, sdd_figma_diagram.
 */

import { z } from "zod";
import { AUTO_DIAGRAM_TYPES } from "../services/content-diagram-generator.js";
import { featureNumberSchema, forceSchema, specDirSchema } from "./common.js";

const DIAGRAM_TYPES = [
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
] as const;

const diagramTypeSchema = z.enum(DIAGRAM_TYPES);
const generationModeSchema = z
  .enum(["explicit", "auto"])
  .default("explicit")
  .describe(
    "explicit (default): validate and write caller-supplied Mermaid. auto: Specky synthesizes the diagram from SPECIFICATION.md/DESIGN.md content.",
  );

const AUTO_TYPE_SET = new Set<string>(AUTO_DIAGRAM_TYPES);

export const generateDiagramInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    mode: generationModeSchema,
    diagram_type: diagramTypeSchema.describe(
      "A diagram type required by the selected feature workload contract.",
    ),
    mermaid_code: z.string().min(10).optional(),
    evidence_refs: z.array(z.string().min(3)).min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "auto") {
      if (value.mermaid_code !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mermaid_code"],
          message: "mermaid_code must be omitted in auto mode; Specky synthesizes the diagram.",
        });
      }
      if (value.evidence_refs !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidence_refs"],
          message: "evidence_refs must be omitted in auto mode; Specky derives evidence.",
        });
      }
      if (!AUTO_TYPE_SET.has(value.diagram_type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diagram_type"],
          message: `auto mode supports only ${[...AUTO_TYPE_SET].join(", ")}. Use mode=explicit for ${value.diagram_type}.`,
        });
      }
      return;
    }
    if (value.mermaid_code === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mermaid_code"],
        message: "mermaid_code is required in explicit mode.",
      });
    }
    if (value.evidence_refs === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_refs"],
        message: "evidence_refs is required in explicit mode.",
      });
    }
  })
  .describe("Generate a single Mermaid diagram from a specification artifact.");

export const generateAllDiagramsInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    force: forceSchema,
    mode: generationModeSchema,
    diagrams: z
      .array(
        z
          .object({
            diagram_type: diagramTypeSchema,
            mermaid_code: z.string().min(10),
            evidence_refs: z.array(z.string().min(3)).min(1),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "auto") {
      if (value.diagrams !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diagrams"],
          message:
            "diagrams must be omitted in auto mode; Specky synthesizes every contracted diagram it supports.",
        });
      }
      return;
    }
    if (value.diagrams === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diagrams"],
        message: "diagrams is required in explicit mode.",
      });
    }
  })
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
