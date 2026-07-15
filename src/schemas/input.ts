/**
 * Input & Conversion Schemas — sdd_import_document, sdd_figma_to_spec, sdd_batch_import.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema, forceSchema } from "./common.js";
import { useCaseSelectionSchema } from "../contracts/use-case.js";

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
    .describe("Explicit document format; auto is an intentional detection mode"),
  spec_dir: specDirSchema,
  use_case: useCaseSelectionSchema,
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
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  force: forceSchema,
}).strict().describe("Extract design context from Figma and generate requirements specification. Outputs a payload for the AI client to call Figma MCP's get_design_context tool.");

export const batchImportInputSchema = z.object({
  documents_dir: z
    .string()
    .min(1)
    .describe("Directory containing documents to import (PDF, DOCX, PPTX, TXT, MD)."),
  spec_dir: specDirSchema,
  use_case: useCaseSelectionSchema,
  force: forceSchema,
}).strict().describe("Batch import all documents from a directory, converting each to Markdown and processing through the SDD pipeline.");
