/**
 * Input & Conversion Tools — sdd_import_document, sdd_figma_to_spec, sdd_batch_import.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { DocumentConverter } from "../services/document-converter.js";
import type { StateMachine } from "../services/state-machine.js";
import {
  importDocumentInputSchema,
  figmaToSpecInputSchema,
  batchImportInputSchema,
} from "../schemas/input.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED] Response exceeded 25,000 characters.";
}

export function registerInputTools(
  server: McpServer,
  fileManager: FileManager,
  documentConverter: DocumentConverter,
  stateMachine: StateMachine
): void {
  // ─── sdd_import_document ───
  server.registerTool(
    "sdd_import_document",
    {
      title: "Import Document",
      description:
        "Imports a document (PDF, DOCX, PPTX, TXT, MD, VTT, SRT) or raw text and converts it to Markdown for SDD processing. Returns the converted content, metadata, and word count.",
      inputSchema: importDocumentInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ file_path, raw_text, format, spec_dir }) => {
      try {
        if (!file_path && !raw_text) {
          throw new Error("Either file_path or raw_text must be provided.");
        }

        const result = file_path
          ? await documentConverter.convert(file_path, format)
          : documentConverter.convertRawText(raw_text!, "Imported Document");

        const detectedFormat = result.format;
        const needsMarkitdown = ["pdf", "docx", "pptx"].includes(detectedFormat || format);

        const output = {
          markdown: result.markdown,
          metadata: result.metadata,
          format: result.format,
          word_count: result.word_count,
          ...(result.page_count !== undefined && { page_count: result.page_count }),
          explanation:
            "The document has been converted to Markdown format. You can now use this content as input for the SDD specification pipeline (sdd_discover or sdd_gen_spec).",
          next_steps: [
            "Review the converted Markdown for accuracy and completeness.",
            "Use sdd_discover to analyze the content and identify features.",
            "Alternatively, copy key sections into your specification directly.",
          ],
          learning_note:
            "SDD processes work best with structured Markdown input. Converting documents first ensures consistent parsing and traceability across the pipeline.",
          recommended_servers: needsMarkitdown ? [{
            id: "markitdown",
            name: "Microsoft MarkItDown",
            purpose: "Enhanced conversion for PDF/DOCX/PPTX with better formatting, tables, and image handling",
            install_command: "Add to MCP settings: uvx markitdown-mcp",
            install_note: "Specky used its built-in converter. For better results, install MarkItDown MCP — the AI client will automatically use it when available.",
            required: false,
            status: "recommended",
            enhances: ["sdd_import_document", "sdd_batch_import"]
          }] : [],
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(output, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_import_document", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_figma_to_spec ───
  server.registerTool(
    "sdd_figma_to_spec",
    {
      title: "Figma to Spec",
      description:
        "Prepares a structured payload for extracting design context from a Figma file. The AI client should use the returned routing_instructions to call Figma MCP's get_design_context tool with the provided file key and node ID.",
      inputSchema: figmaToSpecInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ figma_file_key, figma_node_id, project_name, spec_dir, force }) => {
      try {
        const featureDir = join(spec_dir, `001-${project_name}`);

        const output = {
          figma_file_key,
          figma_node_id: figma_node_id || null,
          project_name,
          feature_dir: featureDir,
          routing_instructions: {
            step_1:
              "Call the Figma MCP tool 'get_design_context' with the figma_file_key" +
              (figma_node_id ? ` and figma_node_id '${figma_node_id}'` : "") +
              " to retrieve the design structure, components, and layout information.",
            step_2:
              "Parse the Figma design context to identify UI components, user flows, and interaction patterns.",
            step_3:
              `Use sdd_discover with the extracted design context to generate a specification in '${featureDir}'.`,
            step_4:
              "Proceed through the SDD pipeline: sdd_gen_spec, sdd_gen_design, sdd_gen_tasks.",
          },
          explanation:
            "This tool generates a routing payload for Figma-to-spec conversion. The AI client orchestrates the multi-step process: first fetching design context from Figma MCP, then feeding it into the SDD pipeline.",
          next_steps: [
            `Call Figma MCP's get_design_context with file key '${figma_file_key}'.`,
            "Extract component hierarchy, text content, and interaction flows from the Figma response.",
            `Feed the extracted context into sdd_discover targeting '${featureDir}'.`,
          ],
          learning_note:
            "Figma-to-spec conversion bridges visual design with formal requirements. The design context provides UI structure that maps to EARS requirements: components become features, interactions become behavioral requirements, and layout constraints become interface requirements.",
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_figma_to_spec", error as Error) }],
          isError: true,
        };
      }
    }
  );

  // ─── sdd_batch_import ───
  server.registerTool(
    "sdd_batch_import",
    {
      title: "Batch Import Documents",
      description:
        "Scans a directory for supported documents (PDF, DOCX, PPTX, TXT, MD) and converts each to Markdown. Returns an array of conversion results with total count and per-file metadata.",
      inputSchema: batchImportInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ documents_dir, spec_dir, force }) => {
      try {
        const supportedExtensions = [".pdf", ".docx", ".pptx", ".md", ".txt", ".vtt", ".srt"];
        const files = await fileManager.listFilesByExtension(documents_dir, supportedExtensions);

        if (files.length === 0) {
          const output = {
            results: [],
            total: 0,
            successful: 0,
            failed: 0,
            explanation:
              `No supported documents found in '${documents_dir}'. Supported formats: PDF, DOCX, PPTX, MD, TXT, VTT, SRT.`,
            next_steps: [
              "Verify the directory path is correct.",
              "Ensure the directory contains files with supported extensions.",
              "Use sdd_import_document for individual file imports.",
            ],
            learning_note:
              "Batch import scans for common document formats. If your files use non-standard extensions, rename them or use sdd_import_document with an explicit format parameter.",
          };
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
        }

        const results: Array<{
          file: string;
          status: "success" | "error";
          format?: string;
          word_count?: number;
          page_count?: number;
          markdown_preview?: string;
          error?: string;
        }> = [];

        let successful = 0;
        let failed = 0;

        for (const filePath of files) {
          try {
            const conversionResult = await documentConverter.convert(filePath);
            results.push({
              file: filePath,
              status: "success",
              format: conversionResult.format,
              word_count: conversionResult.word_count,
              ...(conversionResult.page_count !== undefined && { page_count: conversionResult.page_count }),
              markdown_preview: conversionResult.markdown.slice(0, 200) + (conversionResult.markdown.length > 200 ? "..." : ""),
            });
            successful++;
          } catch (err) {
            results.push({
              file: filePath,
              status: "error",
              error: (err as Error).message,
            });
            failed++;
          }
        }

        const output = {
          results,
          total: files.length,
          successful,
          failed,
          explanation:
            `Batch import complete: ${successful} of ${files.length} documents converted successfully.` +
            (failed > 0 ? ` ${failed} file(s) failed — see individual error messages.` : ""),
          next_steps: [
            "Review the converted documents for accuracy.",
            "Use sdd_import_document on individual files to get full Markdown content.",
            "Feed the converted content into sdd_discover to generate specifications.",
          ],
          learning_note:
            "Batch import provides an overview of available documents. For detailed content, use sdd_import_document on specific files. This two-step approach keeps responses manageable for large document sets.",
        };

        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(output, null, 2)) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_batch_import", error as Error) }],
          isError: true,
        };
      }
    }
  );
}
