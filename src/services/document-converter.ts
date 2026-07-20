/**
 * DocumentConverter — Converts PDF, DOCX, PPTX, TXT, MD to Markdown.
 * MVP implementation uses built-in parsing. Enhanced conversion with
 * mammoth/pdfjs-dist available when those dependencies are installed.
 *
 * HONESTY CONTRACT: the built-in extractor only handles uncompressed
 * (stored) Office zips and uncompressed PDF text streams. Compressed
 * content — which is what Word/PowerPoint/PDF exporters actually
 * produce — FAILS with an actionable error instead of returning
 * gibberish or empty text presented as success.
 */

import { basename, extname } from "node:path";
import type { DocumentConversionResult, DocumentFormat } from "../types.js";
import type { FileManager } from "./file-manager.js";

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

/** Decode the five predefined XML entities. */
function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Actionable failure for compressed content the built-in extractor cannot read. */
function unsupportedCompressedError(format: string): Error {
  return new Error(
    `compressed ${format} not supported natively — convert to md/txt or use the MarkItDown MCP integration (add to MCP settings: uvx markitdown-mcp). ` +
      `Specky's built-in extractor only reads uncompressed (stored) ${format} content; real-world ${format} files from Office/PDF exporters are compressed and would otherwise yield garbage.`,
  );
}

/** A single entry parsed from a zip's local file headers. */
interface ZipEntry {
  name: string;
  /** 0 = stored (uncompressed), 8 = deflate. */
  compressionMethod: number;
  data: Buffer;
}

const ZIP_LOCAL_HEADER_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Parse zip local file headers without decompressing anything.
 * Enough structure to (a) locate an entry by exact name, (b) know whether
 * its data is stored or compressed, and (c) slice the stored bytes.
 */
function parseZipEntries(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = zipBuffer.indexOf(ZIP_LOCAL_HEADER_SIGNATURE);

  while (offset !== -1 && offset + 30 <= zipBuffer.length) {
    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    let compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraLength = zipBuffer.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + nameLength + extraLength;
    if (dataStart > zipBuffer.length) break;

    const name = zipBuffer.toString("utf8", offset + 30, offset + 30 + nameLength);

    if (compressedSize === 0) {
      // Data-descriptor entries record sizes after the data; scan to the next header.
      const next = zipBuffer.indexOf(ZIP_LOCAL_HEADER_SIGNATURE, dataStart);
      compressedSize = (next === -1 ? zipBuffer.length : next) - dataStart;
    }
    const dataEnd = Math.min(dataStart + compressedSize, zipBuffer.length);
    entries.push({ name, compressionMethod, data: zipBuffer.subarray(dataStart, dataEnd) });

    offset = zipBuffer.indexOf(ZIP_LOCAL_HEADER_SIGNATURE, dataEnd);
  }

  return entries;
}

/** Extract the joined text of all `<tag …>text</tag>` runs from OOXML. */
function extractXmlRunText(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const runRegex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([^<]*)</${escaped}>`, "g");
  const parts: string[] = [];
  for (const match of xml.matchAll(runRegex)) {
    if (match[1]) parts.push(decodeXmlEntities(match[1]));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export class DocumentConverter {
  constructor(private readonly fileManager: FileManager) {}

  /**
   * Auto-detect format and convert to Markdown.
   */
  async convert(
    filePath: string,
    format: DocumentFormat = "auto",
  ): Promise<DocumentConversionResult> {
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
        throw new Error(
          `Unsupported format: ${detectedFormat}. Supported: pdf, docx, pptx, md, txt, vtt, srt`,
        );
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
      md: "md",
      markdown: "md",
      txt: "txt",
      text: "txt",
      pdf: "pdf",
      docx: "docx",
      doc: "docx",
      pptx: "pptx",
      ppt: "pptx",
      vtt: "vtt",
      srt: "srt",
    };
    return formatMap[ext] || "txt";
  }

  /**
   * Markdown pass-through.
   */
  private async convertMarkdown(filePath: string): Promise<DocumentConversionResult> {
    const content = await this.fileManager.readProjectFile(filePath);
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
    const content = await this.fileManager.readProjectFile(filePath);
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
   * Built-in extraction only handles uncompressed (stored) zips — compressed
   * DOCX (what Word writes) fails honestly instead of returning gibberish.
   * Enhanced: use mammoth when available.
   */
  private async convertDocx(filePath: string): Promise<DocumentConversionResult> {
    try {
      // Try mammoth first if available
      // @ts-expect-error -- optional dependency, gracefully handled
      const mammoth = await import("mammoth").catch(() => null);
      if (mammoth) {
        const result = await mammoth.convertToMarkdown({
          path: this.fileManager.sanitizePath(filePath),
        });
        const sections = this.extractSections(result.value);
        return {
          format: "docx",
          markdown: result.value,
          metadata: {
            title: sections[0] || basename(filePath, ".docx"),
            sections,
            source_file: filePath,
          },
          word_count: this.countWords(result.value),
        };
      }
    } catch {
      /* fall through to basic extraction */
    }

    // Basic extraction: parse the zip's local headers and read the stored document body
    const content = await this.fileManager.readProjectFileBuffer(filePath);
    const entry = parseZipEntries(content).find((e) => e.name === "word/document.xml");
    if (!entry) {
      throw new Error(
        `No word/document.xml found in '${filePath}' — this is not a readable DOCX file. Convert it to md/txt or use the MarkItDown MCP integration (uvx markitdown-mcp).`,
      );
    }
    if (entry.compressionMethod !== 0) {
      throw unsupportedCompressedError("docx");
    }

    const xml = entry.data.toString("utf8");
    const runText = extractXmlRunText(xml, "w:t");
    const text = runText || stripXmlTags(xml).replace(/\s+/g, " ").trim();
    if (!text) {
      throw new Error(
        `No readable text extracted from '${filePath}'. The document body is empty or uses features the built-in extractor cannot handle — use the MarkItDown MCP integration (uvx markitdown-mcp).`,
      );
    }

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
      // @ts-expect-error -- optional dependency, gracefully handled
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => null);
      if (pdfjs) {
        const data = new Uint8Array(await this.fileManager.readProjectFileBuffer(filePath));
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
    } catch {
      /* fall through */
    }

    // Fallback: basic text extraction from PDF bytes.
    // Fails honestly when nothing can be extracted — a compressed or image-only
    // PDF must not become an empty "success".
    const buffer = await this.fileManager.readProjectFileBuffer(filePath);
    const text = this.extractTextFromPdfBuffer(buffer);
    if (!text) {
      const binary = buffer.toString("binary");
      if (/\/(?:Flate|LZW|DCT|RunLength|CCITTFax|JBIG2|JPX)Decode/.test(binary)) {
        throw unsupportedCompressedError("pdf");
      }
      throw new Error(
        `No extractable text found in '${filePath}'. The PDF has no uncompressed text layer (it may be scanned or image-only) — convert it to md/txt or use the MarkItDown MCP integration (uvx markitdown-mcp).`,
      );
    }
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
   * Built-in extraction only handles uncompressed (stored) zips — compressed
   * PPTX (what PowerPoint writes) fails honestly instead of returning gibberish.
   */
  private async convertPptx(filePath: string): Promise<DocumentConversionResult> {
    const content = await this.fileManager.readProjectFileBuffer(filePath);

    // PPTX is a zip with ppt/slides/slide1.xml, slide2.xml, etc.
    const slideEntries = parseZipEntries(content)
      .map((entry) => {
        const match = entry.name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        return match ? { entry, index: Number(match[1]) } : null;
      })
      .filter((s): s is { entry: ZipEntry; index: number } => s !== null)
      .sort((a, b) => a.index - b.index);

    if (slideEntries.length === 0) {
      throw new Error(
        `No slides found in '${filePath}' — this is not a readable PPTX file. Convert it to md/txt or use the MarkItDown MCP integration (uvx markitdown-mcp).`,
      );
    }
    if (slideEntries.some((s) => s.entry.compressionMethod !== 0)) {
      throw unsupportedCompressedError("pptx");
    }

    const slides: string[] = [];
    for (const { entry, index } of slideEntries) {
      const xml = entry.data.toString("utf8");
      const runText = extractXmlRunText(xml, "a:t");
      const slideText = runText || stripXmlTags(xml).replace(/\s+/g, " ").trim();
      if (slideText) slides.push(`## Slide ${index}\n\n${slideText}`);
    }

    if (slides.length === 0) {
      throw new Error(
        `No readable slide text extracted from '${filePath}'. The slides are empty or use features the built-in extractor cannot handle — use the MarkItDown MCP integration (uvx markitdown-mcp).`,
      );
    }

    const title = basename(filePath, ".pptx");
    const markdown = `# ${title}\n\n${slides.join("\n\n---\n\n")}`;
    return {
      format: "pptx",
      markdown,
      metadata: { title, sections: slides.map((_, i) => `Slide ${i + 1}`), source_file: filePath },
      page_count: slideEntries.length,
      word_count: this.countWords(markdown),
    };
  }

  /**
   * Transcript (VTT/SRT) → Markdown.
   */
  private async convertTranscript(
    filePath: string,
    format: DocumentFormat,
  ): Promise<DocumentConversionResult> {
    const content = await this.fileManager.readProjectFile(filePath);
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
   * Basic text extraction from PDF buffer.
   * Looks for text streams between BT and ET markers.
   */
  private extractTextFromPdfBuffer(buffer: Buffer): string {
    const content = buffer.toString("binary");
    const textParts: string[] = [];

    // Extract text from PDF text objects (between BT and ET)
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    for (const match of content.matchAll(btEtRegex)) {
      const block = match[1];
      // Extract text from Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      for (const tjMatch of block.matchAll(tjRegex)) {
        textParts.push(tjMatch[1]);
      }
    }

    return textParts
      .join(" ")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract section headings from Markdown.
   */
  private extractSections(markdown: string): string[] {
    const sections: string[] = [];
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    for (const match of markdown.matchAll(headingRegex)) {
      sections.push(match[1].trim());
    }
    return sections;
  }

  /**
   * Count words in text.
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }
}
