/**
 * Input & Conversion Schemas — sdd_import_document, sdd_figma_to_spec, sdd_batch_import.
 */

import { z } from "zod";
import { specDirSchema, forceSchema } from "./common.js";

export const importDocumentInputSchema = z.object({
  file_path: z
    .string()
    .min(1)
    .optional()
    .describe("Absolute or relative path to the document file (PDF, DOCX, PPTX, TXT, MD)."),
  raw_text: z
    .string()
    .optional()
    .describe("Raw text content to process directly instead of reading from file."),
  format: z
    .enum(["auto", "pdf", "docx", "pptx", "md", "txt", "vtt", "srt"])
    .default("auto")
    .describe("Document format. Use 'auto' for automatic detection from file extension."),
  spec_dir: specDirSchema,
}).strict().describe("Import a document and convert it to Markdown for SDD processing.");

export const figmaToSpecInputSchema = z.object({
  figma_file_key: z
    .string()
    .min(1)
    .describe("Figma file key extracted from the Figma URL."),
  figma_node_id: z
    .string()
    .optional()
    .describe("Specific Figma node ID to extract. If omitted, extracts entire file."),
  project_name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "Must be kebab-case")
    .describe("Kebab-case project name for the generated spec."),
  spec_dir: specDirSchema,
  force: forceSchema,
}).strict().describe("Extract design context from Figma and generate requirements specification. Outputs a payload for the AI client to call Figma MCP's get_design_context tool.");

export const batchImportInputSchema = z.object({
  documents_dir: z
    .string()
    .min(1)
    .describe("Directory containing documents to import (PDF, DOCX, PPTX, TXT, MD)."),
  spec_dir: specDirSchema,
  force: forceSchema,
}).strict().describe("Batch import all documents from a directory, converting each to Markdown and processing through the SDD pipeline.");
