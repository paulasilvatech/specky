import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync, deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocumentConverter } from "../../src/services/document-converter.js";
import { FileManager } from "../../src/services/file-manager.js";

// ─── Fixture builders: real zip / PDF byte layouts, no dependencies ───

interface ZipFixtureEntry {
  name: string;
  data: Buffer;
  /** true = STORED (uncompressed), false = DEFLATE (what Office actually writes) */
  store: boolean;
}

/** Build a structurally valid zip (local headers + central directory + EOCD). */
function makeZip(entries: ZipFixtureEntry[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const method = entry.store ? 0 : 8;
    const payload = entry.store ? entry.data : deflateRawSync(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    localChunks.push(local, nameBuf, payload);
    centralChunks.push(central, nameBuf);
    offset += 30 + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

const CONTENT_TYPES_XML =
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';

function makeDocx(bodyText: string, store: boolean): Buffer {
  const documentXml =
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body></w:document>`;
  return makeZip([
    // [Content_Types].xml comes first, as in real DOCX — the old extractor
    // matched the literal path string here and returned this fragment as "text".
    { name: "[Content_Types].xml", data: Buffer.from(CONTENT_TYPES_XML, "utf8"), store },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8"), store },
  ]);
}

function makePptx(slideTexts: string[], store: boolean): Buffer {
  const entries: ZipFixtureEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(CONTENT_TYPES_XML, "utf8"), store },
  ];
  slideTexts.forEach((text, i) => {
    const slideXml =
      '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      `<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    entries.push({
      name: `ppt/slides/slide${i + 1}.xml`,
      data: Buffer.from(slideXml, "utf8"),
      store,
    });
  });
  return makeZip(entries);
}

/** Minimal PDF with an uncompressed text stream (BT … Tj … ET). */
function makePlainPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  return Buffer.from(
    "%PDF-1.4\n" +
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
      "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n" +
      `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n` +
      "%%EOF\n",
    "latin1",
  );
}

/** Minimal PDF whose content stream is FlateDecode-compressed (real-world shape). */
function makeFlatePdf(text: string): Buffer {
  const stream = deflateSync(Buffer.from(`BT /F1 12 Tf 72 720 Td (${text}) Tj ET`, "latin1"));
  const head = Buffer.from(
    "%PDF-1.4\n" +
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
      "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n" +
      `4 0 obj << /Length ${stream.length} /Filter /FlateDecode >> stream\n`,
    "latin1",
  );
  const tail = Buffer.from("\nendstream endobj\n%%EOF\n", "latin1");
  return Buffer.concat([head, stream, tail]);
}

describe("DocumentConverter", () => {
  let workspace: string;
  let converter: DocumentConverter;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-doc-converter-"));
    mkdirSync(join(workspace, "docs"), { recursive: true });
    converter = new DocumentConverter(new FileManager(workspace));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("converts workspace-relative Markdown files", async () => {
    writeFileSync(join(workspace, "docs", "input.md"), "# Title\n\nHello Specky", "utf8");

    const result = await converter.convert("docs/input.md", "md");

    expect(result.format).toBe("md");
    expect(result.markdown).toContain("Hello Specky");
    expect(result.metadata.title).toBe("Title");
  });

  it("converts workspace-relative text files", async () => {
    writeFileSync(join(workspace, "docs", "notes.txt"), "Plain notes", "utf8");

    const result = await converter.convert("docs/notes.txt", "txt");

    expect(result.format).toBe("txt");
    expect(result.markdown).toContain("# notes");
    expect(result.markdown).toContain("Plain notes");
  });

  it("rejects absolute paths", async () => {
    const absolutePath = join(workspace, "docs", "input.md");
    writeFileSync(absolutePath, "# Absolute", "utf8");

    await expect(converter.convert(absolutePath, "md")).rejects.toThrow(
      "Absolute paths are not allowed",
    );
  });

  it("rejects path traversal", async () => {
    await expect(converter.convert("../outside.md", "md")).rejects.toThrow(
      "Path traversal is not allowed",
    );
  });

  // ─── DOCX honesty (audit wf_c703f5af-3d8: compressed files returned
  //     binary garbage as markdown with status success) ───

  it("fails a compressed (real-world) DOCX with an actionable error instead of gibberish", async () => {
    const sentence = "The onboarding wizard shall collect company name and tax identifier.";
    writeFileSync(join(workspace, "docs", "report.docx"), makeDocx(sentence, false));

    await expect(converter.convert("docs/report.docx", "docx")).rejects.toThrow(
      /compressed docx not supported natively — convert to md\/txt or use the MarkItDown MCP integration/,
    );
  });

  it("extracts the real document body from an uncompressed (stored) DOCX", async () => {
    const sentence = "The onboarding wizard shall collect company name and tax identifier.";
    writeFileSync(join(workspace, "docs", "stored.docx"), makeDocx(sentence, true));

    const result = await converter.convert("docs/stored.docx", "docx");

    expect(result.format).toBe("docx");
    expect(result.markdown).toContain(sentence);
    // The old extractor returned a [Content_Types].xml fragment instead of the body.
    expect(result.markdown).not.toContain("ContentType=");
    expect(result.markdown).not.toContain("word/document.xml");
    expect(result.word_count).toBeGreaterThan(5);
  });

  it("fails a file without word/document.xml instead of returning empty success", async () => {
    writeFileSync(
      join(workspace, "docs", "notadocx.docx"),
      makeZip([{ name: "unrelated.txt", data: Buffer.from("hello", "utf8"), store: true }]),
    );

    await expect(converter.convert("docs/notadocx.docx", "docx")).rejects.toThrow(
      /not a readable DOCX|MarkItDown/,
    );
  });

  // ─── PPTX honesty ───

  it("fails a compressed (real-world) PPTX with an actionable error instead of gibberish", async () => {
    writeFileSync(
      join(workspace, "docs", "deck.pptx"),
      makePptx(["Roadmap: the search feature shall support fuzzy matching."], false),
    );

    await expect(converter.convert("docs/deck.pptx", "pptx")).rejects.toThrow(
      /compressed pptx not supported natively — convert to md\/txt or use the MarkItDown MCP integration/,
    );
  });

  it("extracts clean per-slide text (no zip-path artifacts) from a stored PPTX", async () => {
    writeFileSync(
      join(workspace, "docs", "stored.pptx"),
      makePptx(
        [
          "Roadmap: the search feature shall support fuzzy matching.",
          "The results page shall offer faceted filters.",
        ],
        true,
      ),
    );

    const result = await converter.convert("docs/stored.pptx", "pptx");

    expect(result.format).toBe("pptx");
    expect(result.page_count).toBe(2);
    expect(result.markdown).toContain("## Slide 1");
    expect(result.markdown).toContain("fuzzy matching");
    expect(result.markdown).toContain("## Slide 2");
    expect(result.markdown).toContain("faceted filters");
    // The old extractor prefixed slide text with the zip entry path.
    expect(result.markdown).not.toContain("ppt/slides/slide1.xml");
  });

  it("fails a PPTX with no slides instead of returning an empty deck as success", async () => {
    writeFileSync(
      join(workspace, "docs", "noslides.pptx"),
      makeZip([
        { name: "[Content_Types].xml", data: Buffer.from(CONTENT_TYPES_XML, "utf8"), store: true },
      ]),
    );

    await expect(converter.convert("docs/noslides.pptx", "pptx")).rejects.toThrow(
      /No slides found|MarkItDown/,
    );
  });

  // ─── PDF honesty (audit: FlateDecode PDFs returned word_count 0 as success) ───

  it("fails a FlateDecode (real-world) PDF instead of returning empty text as success", async () => {
    writeFileSync(
      join(workspace, "docs", "invoices-flate.pdf"),
      makeFlatePdf("The reporting module shall export monthly invoices as CSV."),
    );

    await expect(converter.convert("docs/invoices-flate.pdf", "pdf")).rejects.toThrow(
      /compressed pdf not supported natively — convert to md\/txt or use the MarkItDown MCP integration/,
    );
  });

  it("still extracts text from an uncompressed text-stream PDF", async () => {
    const sentence = "The reporting module shall export monthly invoices as CSV.";
    writeFileSync(join(workspace, "docs", "invoices-plain.pdf"), makePlainPdf(sentence));

    const result = await converter.convert("docs/invoices-plain.pdf", "pdf");

    expect(result.format).toBe("pdf");
    expect(result.markdown).toContain(sentence);
    expect(result.word_count).toBeGreaterThan(5);
  });

  it("fails a PDF with no text layer instead of empty success", async () => {
    writeFileSync(join(workspace, "docs", "blank.pdf"), Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"));

    await expect(converter.convert("docs/blank.pdf", "pdf")).rejects.toThrow(
      /No extractable text found/,
    );
  });
});
