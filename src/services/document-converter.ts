/**
 * DocumentConverter — Converts PDF, DOCX, PPTX, TXT, MD to Markdown.
 * MVP implementation uses built-in parsing. Enhanced conversion with
 * mammoth/pdfjs-dist available when those dependencies are installed.
 */

import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import type { FileManager } from "./file-manager.js";
import type { DocumentConversionResult, DocumentFormat } from "../types.js";

/** Strip XML/HTML tags iteratively until none remain (CodeQL-safe) */
function stripXmlTags(input: string): string {
  let result = input;
  let prev = "";
  while (result !== prev) {
    prev = result;
    result = result.replace(/<[^<]*>/g, " ");
  }
  return result;
}

export class DocumentConverter {
  constructor(_fileManager: FileManager) {}

  /**
   * Auto-detect format and convert to Markdown.
   */
  async convert(filePath: string, format: DocumentFormat = "auto"): Promise<DocumentConversionResult> {
    const detectedFormat = format === "auto" ? this.detectFormat(filePath) : format;

    switch (detectedFormat) {
      case "md":
        return this.convertMarkdown(filePath);
      case "txt":
        return this.convertText(filePath);
      case "docx":
        return this.convertDocx(filePath);
      case "pdf":
        return this.convertPdf(filePath);
      case "pptx":
        return this.convertPptx(filePath);
      case "vtt":
      case "srt":
        return this.convertTranscript(filePath, detectedFormat);
      default:
        throw new Error(`Unsupported format: ${detectedFormat}. Supported: pdf, docx, pptx, md, txt, vtt, srt`);
    }
  }

  /**
   * Convert raw text content to Markdown.
   */
  convertRawText(text: string, title?: string): DocumentConversionResult {
    const markdown = title ? `# ${title}\n\n${text}` : text;
    const sections = this.extractSections(markdown);
    return {
      format: "txt",
      markdown,
      metadata: { title, sections },
      word_count: this.countWords(markdown),
    };
  }

  /**
   * Detect format from file extension.
   */
  private detectFormat(filePath: string): DocumentFormat {
    const ext = extname(filePath).toLowerCase().replace(".", "");
    const formatMap: Record<string, DocumentFormat> = {
      md: "md", markdown: "md",
      txt: "txt", text: "txt",
      pdf: "pdf",
      docx: "docx", doc: "docx",
      pptx: "pptx", ppt: "pptx",
      vtt: "vtt",
      srt: "srt",
    };
    return formatMap[ext] || "txt";
  }

  /**
   * Markdown pass-through.
   */
  private async convertMarkdown(filePath: string): Promise<DocumentConversionResult> {
    const content = await readFile(filePath, "utf-8");
    const sections = this.extractSections(content);
    const title = sections.length > 0 ? sections[0] : basename(filePath, ".md");
    return {
      format: "md",
      markdown: content,
      metadata: { title, sections, source_file: filePath },
      word_count: this.countWords(content),
    };
  }

  /**
   * Plain text → Markdown with basic structure.
   */
  private async convertText(filePath: string): Promise<DocumentConversionResult> {
    const content = await readFile(filePath, "utf-8");
    const title = basename(filePath, extname(filePath));
    const markdown = `# ${title}\n\n${content}`;
    return {
      format: "txt",
      markdown,
      metadata: { title, sections: [title], source_file: filePath },
      word_count: this.countWords(content),
    };
  }

  /**
   * DOCX → Markdown via XML extraction from zip.
   * MVP: extracts paragraph text from document.xml.
   * Enhanced: use mammoth when available.
   */
  private async convertDocx(filePath: string): Promise<DocumentConversionResult> {
    try {
      // Try mammoth first if available
      // @ts-ignore -- optional dependency, gracefully handled
      const mammoth = await import("mammoth").catch(() => null);
      if (mammoth) {
        const result = await mammoth.convertToMarkdown({ path: filePath });
        const sections = this.extractSections(result.value);
        return {
          format: "docx",
          markdown: result.value,
          metadata: { title: sections[0] || basename(filePath, ".docx"), sections, source_file: filePath },
          word_count: this.countWords(result.value),
        };
      }
    } catch { /* fall through to basic extraction */ }

    // Basic extraction: read as buffer, find text patterns
    const content = await readFile(filePath);
    const text = this.extractTextFromXmlZip(content, "word/document.xml");
    const title = basename(filePath, ".docx");
    const markdown = `# ${title}\n\n${text}`;
    return {
      format: "docx",
      markdown,
      metadata: { title, sections: [title], source_file: filePath },
      word_count: this.countWords(text),
    };
  }

  /**
   * PDF → Markdown via text extraction.
   * MVP: basic text layer extraction.
   * Enhanced: use pdfjs-dist when available.
   */
  private async convertPdf(filePath: string): Promise<DocumentConversionResult> {
    try {
      // @ts-ignore -- optional dependency, gracefully handled
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => null);
      if (pdfjs) {
        const data = new Uint8Array(await readFile(filePath));
        const doc = await pdfjs.getDocument({ data }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: { str?: string }) => item.str || "")
            .join(" ");
          pages.push(pageText);
        }
        const text = pages.join("\n\n---\n\n");
        const title = basename(filePath, ".pdf");
        const markdown = `# ${title}\n\n${text}`;
        return {
          format: "pdf",
          markdown,
          metadata: { title, sections: [title], source_file: filePath },
          page_count: doc.numPages,
          word_count: this.countWords(text),
        };
      }
    } catch { /* fall through */ }

    // Fallback: basic text extraction from PDF bytes
    const buffer = await readFile(filePath);
    const text = this.extractTextFromPdfBuffer(buffer);
    const title = basename(filePath, ".pdf");
    const markdown = `# ${title}\n\n${text}\n\n> Note: Basic PDF text extraction. Install pdfjs-dist for enhanced conversion.`;
    return {
      format: "pdf",
      markdown,
      metadata: { title, sections: [title], source_file: filePath },
      word_count: this.countWords(text),
    };
  }

  /**
   * PPTX → Markdown via XML extraction from zip.
   * MVP: extracts text from slide XML files.
   */
  private async convertPptx(filePath: string): Promise<DocumentConversionResult> {
    const content = await readFile(filePath);
    const slides: string[] = [];

    // PPTX is a zip with ppt/slides/slide1.xml, slide2.xml, etc.
    for (let i = 1; i <= 100; i++) {
      const slideText = this.extractTextFromXmlZip(content, `ppt/slides/slide${i}.xml`);
      if (!slideText) break;
      slides.push(`## Slide ${i}\n\n${slideText}`);
    }

    const title = basename(filePath, ".pptx");
    const markdown = `# ${title}\n\n${slides.join("\n\n---\n\n")}`;
    return {
      format: "pptx",
      markdown,
      metadata: { title, sections: slides.map((_, i) => `Slide ${i + 1}`), source_file: filePath },
      page_count: slides.length,
      word_count: this.countWords(markdown),
    };
  }

  /**
   * Transcript (VTT/SRT) → Markdown.
   */
  private async convertTranscript(filePath: string, format: DocumentFormat): Promise<DocumentConversionResult> {
    const content = await readFile(filePath, "utf-8");
    // Strip VTT/SRT timestamps and formatting, keep speaker text
    const lines = content.split("\n");
    const textLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, timestamps, WEBVTT header, numeric cue IDs
      if (!trimmed) continue;
      if (trimmed === "WEBVTT") continue;
      if (/^\d+$/.test(trimmed)) continue;
      if (/^\d{2}:\d{2}/.test(trimmed)) continue;
      if (/-->/.test(trimmed)) continue;
      textLines.push(trimmed);
    }
    const text = textLines.join("\n");
    const title = basename(filePath, `.${format}`);
    const markdown = `# Transcript: ${title}\n\n${text}`;
    return {
      format,
      markdown,
      metadata: { title, sections: [title], source_file: filePath },
      word_count: this.countWords(text),
    };
  }

  /**
   * Extract text from an XML file inside a zip buffer.
   * Used for DOCX (word/document.xml) and PPTX (ppt/slides/slideN.xml).
   */
  private extractTextFromXmlZip(zipBuffer: Buffer, xmlPath: string): string {
    // Simple zip parsing: find the XML file by name in the zip central directory
    const bufStr = zipBuffer.toString("binary");
    const pathIndex = bufStr.indexOf(xmlPath);
    if (pathIndex === -1) return "";

    // Find the local file header for this entry
    // Look backwards from the central directory entry to find the actual data
    // For MVP, extract all text between XML tags using regex
    const escapedPath = xmlPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const xmlMatch = bufStr.match(new RegExp(`${escapedPath}.*?PK`, "s"));
    if (!xmlMatch) return "";

    // Extract text content from XML tags (strip all tags iteratively)
    const xmlContent = xmlMatch[0];
    const textContent = stripXmlTags(xmlContent)
      .replace(/\s+/g, " ")
      .replace(/PK$/, "")
      .trim();

    // Clean up non-printable characters
    return textContent.replace(/[^\x20-\x7E\n\r\t]/g, "").trim();
  }

  /**
   * Basic text extraction from PDF buffer.
   * Looks for text streams between BT and ET markers.
   */
  private extractTextFromPdfBuffer(buffer: Buffer): string {
    const content = buffer.toString("binary");
    const textParts: string[] = [];

    // Extract text from PDF text objects (between BT and ET)
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(content)) !== null) {
      const block = match[1];
      // Extract text from Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textParts.push(tjMatch[1]);
      }
    }

    return textParts.join(" ").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  }

  /**
   * Extract section headings from Markdown.
   */
  private extractSections(markdown: string): string[] {
    const sections: string[] = [];
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(markdown)) !== null) {
      sections.push(match[1].trim());
    }
    return sections;
  }

  /**
   * Count words in text.
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }
}
