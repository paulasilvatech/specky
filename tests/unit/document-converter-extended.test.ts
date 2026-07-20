import { describe, expect, it } from "vitest";
import { DocumentConverter } from "../../src/services/document-converter.js";
import type { FileManager } from "../../src/services/file-manager.js";
import type { DocumentFormat } from "../../src/types.js";

// ─── Mocked FileManager: in-memory file map, no disk access ───

function makeFileManager(files: Record<string, string | Buffer>): FileManager {
  return {
    sanitizePath: (p: string) => p,
    readProjectFile: async (p: string) => {
      const f = files[p];
      if (f === undefined) throw new Error(`ENOENT: no such file '${p}'`);
      return Buffer.isBuffer(f) ? f.toString("utf8") : f;
    },
    readProjectFileBuffer: async (p: string) => {
      const f = files[p];
      if (f === undefined) throw new Error(`ENOENT: no such file '${p}'`);
      return Buffer.isBuffer(f) ? f : Buffer.from(f, "utf8");
    },
  } as unknown as FileManager;
}

function makeConverter(files: Record<string, string | Buffer> = {}): DocumentConverter {
  return new DocumentConverter(makeFileManager(files));
}

// ─── Fixture builders: real zip / PDF byte layouts, no dependencies ───

interface ZipFixtureEntry {
  name: string;
  data: Buffer;
  /** Record 0 as the compressed size to emulate a data-descriptor entry. */
  sizeInHeader?: number;
}

/** Build a zip from local file headers (enough for the built-in extractor). */
function makeStoredZip(entries: ZipFixtureEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression method: 0 = stored
    local.writeUInt32LE(entry.sizeInHeader ?? entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, entry.data);
  }
  return Buffer.concat(chunks);
}

function makeDocxBuffer(documentXml: string): Buffer {
  return makeStoredZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from('<?xml version="1.0"?><Types/>', "utf8"),
    },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
  ]);
}

function docxXmlWithRuns(runs: string[]): string {
  const body = runs.map((r) => `<w:p><w:r>${r}</w:r></w:p>`).join("");
  return `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

/** Minimal PDF with the given content stream objects, uncompressed. */
function makePdfWithStreams(streams: string[]): Buffer {
  const objects = streams
    .map((s, i) => `${i + 1} 0 obj << /Length ${s.length} >> stream\n${s}\nendstream endobj\n`)
    .join("");
  return Buffer.from(`%PDF-1.4\n${objects}%%EOF\n`, "latin1");
}

// ─── Format auto-detection ───

describe("DocumentConverter — format auto-detection", () => {
  it("detects md from .md and .markdown extensions", async () => {
    const converter = makeConverter({
      "a.md": "# Alpha",
      "b.markdown": "# Beta",
    });

    expect((await converter.convert("a.md")).format).toBe("md");
    expect((await converter.convert("b.markdown")).format).toBe("md");
  });

  it("detects txt from .txt and .text extensions", async () => {
    const converter = makeConverter({ "a.txt": "hello", "b.text": "world" });

    expect((await converter.convert("a.txt")).format).toBe("txt");
    expect((await converter.convert("b.text")).format).toBe("txt");
  });

  it("detects docx from .doc and .docx extensions", async () => {
    const docx = makeDocxBuffer(docxXmlWithRuns(["<w:t>Body text here</w:t>"]));
    const converter = makeConverter({ "a.doc": docx, "b.docx": docx });

    expect((await converter.convert("a.doc")).format).toBe("docx");
    expect((await converter.convert("b.docx")).format).toBe("docx");
  });

  it("detects pdf case-insensitively from .PDF", async () => {
    const pdf = makePdfWithStreams(["BT (Hello PDF) Tj ET"]);
    const converter = makeConverter({ "REPORT.PDF": pdf });

    expect((await converter.convert("REPORT.PDF")).format).toBe("pdf");
  });

  it("detects vtt and srt transcript formats", async () => {
    const converter = makeConverter({
      "meeting.vtt": "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello there",
      "captions.srt": "1\n00:00:01,000 --> 00:00:02,000\nHello there",
    });

    expect((await converter.convert("meeting.vtt")).format).toBe("vtt");
    expect((await converter.convert("captions.srt")).format).toBe("srt");
  });

  it("falls back to txt for unknown extensions", async () => {
    const converter = makeConverter({ "data.weird": "some content" });

    const result = await converter.convert("data.weird");

    expect(result.format).toBe("txt");
    expect(result.markdown).toContain("some content");
  });

  it("throws an actionable error for an explicit unsupported format", async () => {
    const converter = makeConverter({ "a.bin": "x" });

    await expect(converter.convert("a.bin", "bin" as DocumentFormat)).rejects.toThrow(
      /Unsupported format: bin\. Supported: pdf, docx, pptx, md, txt, vtt, srt/,
    );
  });
});

// ─── PDF text extraction (BT/ET blocks, Tj operators) ───

describe("DocumentConverter — PDF text extraction", () => {
  it("extracts text from multiple BT/ET blocks and joins them", async () => {
    const pdf = makePdfWithStreams([
      "BT /F1 12 Tf (First block) Tj ET",
      "BT /F1 12 Tf (Second block) Tj ET",
    ]);
    const converter = makeConverter({ "doc.pdf": pdf });

    const result = await converter.convert("doc.pdf", "pdf");

    expect(result.markdown).toContain("First block");
    expect(result.markdown).toContain("Second block");
    expect(result.markdown.indexOf("First block")).toBeLessThan(
      result.markdown.indexOf("Second block"),
    );
  });

  it("extracts multiple Tj operators within a single BT/ET block", async () => {
    const pdf = makePdfWithStreams(["BT (Alpha) Tj (Beta) Tj (Gamma) Tj ET"]);
    const converter = makeConverter({ "doc.pdf": pdf });

    const result = await converter.convert("doc.pdf", "pdf");

    expect(result.markdown).toContain("Alpha Beta Gamma");
  });

  it("adds the basic-extraction note to the markdown", async () => {
    const pdf = makePdfWithStreams(["BT (Note check) Tj ET"]);
    const converter = makeConverter({ "doc.pdf": pdf });

    const result = await converter.convert("doc.pdf", "pdf");

    expect(result.markdown).toContain(
      "> Note: Basic PDF text extraction. Install pdfjs-dist for enhanced conversion.",
    );
  });

  it("uses the file basename as title and reports it as the only section", async () => {
    const pdf = makePdfWithStreams(["BT (content) Tj ET"]);
    const converter = makeConverter({ "reports/annual.pdf": pdf });

    const result = await converter.convert("reports/annual.pdf", "pdf");

    expect(result.metadata.title).toBe("annual");
    expect(result.metadata.sections).toEqual(["annual"]);
    expect(result.metadata.source_file).toBe("reports/annual.pdf");
    expect(result.markdown.startsWith("# annual\n\n")).toBe(true);
  });

  it("replaces non-printable bytes in extracted text with spaces", async () => {
    // \x00 and \x07 are outside the printable ASCII range kept by the extractor.
    const pdf = makePdfWithStreams(["BT (Clean\x00Text\x07Here) Tj ET"]);
    const converter = makeConverter({ "doc.pdf": pdf });

    const result = await converter.convert("doc.pdf", "pdf");

    expect(result.markdown).toContain("Clean Text Here");
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting control bytes are stripped
    expect(result.markdown).not.toMatch(/[\x00-\x08]/);
  });

  it("throws for a PDF with BT/ET blocks but no Tj text and no compression filter", async () => {
    const pdf = makePdfWithStreams(["BT /F1 12 Tf 72 720 Td ET"]);
    const converter = makeConverter({ "empty.pdf": pdf });

    await expect(converter.convert("empty.pdf", "pdf")).rejects.toThrow(
      /No extractable text found in 'empty\.pdf'/,
    );
  });

  it("throws the compressed-content error for LZW-compressed PDFs", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n4 0 obj << /Filter /LZWDecode >> stream\nrandom bytes\nendstream endobj\n%%EOF\n",
      "latin1",
    );
    const converter = makeConverter({ "lzw.pdf": pdf });

    await expect(converter.convert("lzw.pdf", "pdf")).rejects.toThrow(
      /compressed pdf not supported natively/,
    );
  });

  it("throws the compressed-content error for image-only (DCTDecode) PDFs", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n5 0 obj << /Filter /DCTDecode >> stream\njpeg bytes\nendstream endobj\n%%EOF\n",
      "latin1",
    );
    const converter = makeConverter({ "scan.pdf": pdf });

    await expect(converter.convert("scan.pdf", "pdf")).rejects.toThrow(
      /compressed pdf not supported natively/,
    );
  });

  it("counts only the extracted text words, not the title or note", async () => {
    const pdf = makePdfWithStreams(["BT (one two three four) Tj ET"]);
    const converter = makeConverter({ "doc.pdf": pdf });

    const result = await converter.convert("doc.pdf", "pdf");

    expect(result.word_count).toBe(4);
  });
});

// ─── DOCX text extraction (OOXML tags) ───

describe("DocumentConverter — DOCX text extraction", () => {
  it("joins multiple w:t runs with single spaces", async () => {
    const docx = makeDocxBuffer(
      docxXmlWithRuns(["<w:t>First paragraph</w:t>", "<w:t>Second paragraph</w:t>"]),
    );
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("First paragraph Second paragraph");
  });

  it("reads w:t runs that carry attributes such as xml:space", async () => {
    const docx = makeDocxBuffer(docxXmlWithRuns(['<w:t xml:space="preserve">Spaced text</w:t>']));
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("Spaced text");
  });

  it("decodes the five predefined XML entities in w:t runs", async () => {
    const docx = makeDocxBuffer(
      docxXmlWithRuns([
        "<w:t>Fish &amp; Chips &lt;tag&gt; &quot;quoted&quot; &apos;apostrophe&apos;</w:t>",
      ]),
    );
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain(`Fish & Chips <tag> "quoted" 'apostrophe'`);
  });

  it("preserves UTF-8 multibyte characters from the document body", async () => {
    const docx = makeDocxBuffer(docxXmlWithRuns(["<w:t>Café müller — naïve</w:t>"]));
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("Café müller — naïve");
  });

  it("falls back to stripping XML tags when no w:t runs contain text", async () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body>Loose body text<w:p><w:r><w:t></w:t></w:r></w:p></w:body></w:document>';
    const docx = makeDocxBuffer(xml);
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("Loose body text");
  });

  it("collapses whitespace in the joined run text", async () => {
    const docx = makeDocxBuffer(docxXmlWithRuns(["<w:t>Too   many\n\tspaces   here</w:t>"]));
    const converter = makeConverter({ "doc.docx": docx });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("Too many spaces here");
  });

  it("reads document.xml entries written with a data descriptor (size 0 in header)", async () => {
    const zip = makeStoredZip([
      {
        name: "word/document.xml",
        data: Buffer.from(docxXmlWithRuns(["<w:t>Descriptor entry text</w:t>"]), "utf8"),
        sizeInHeader: 0,
      },
      { name: "word/styles.xml", data: Buffer.from("<w:styles/>", "utf8") },
    ]);
    const converter = makeConverter({ "doc.docx": zip });

    const result = await converter.convert("doc.docx", "docx");

    expect(result.markdown).toContain("Descriptor entry text");
  });

  it("throws when the document body yields no readable text", async () => {
    const docx = makeDocxBuffer(
      '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t></w:t></w:r></w:p></w:body></w:document>',
    );
    const converter = makeConverter({ "empty.docx": docx });

    await expect(converter.convert("empty.docx", "docx")).rejects.toThrow(
      /No readable text extracted from 'empty\.docx'/,
    );
  });

  it("throws for a malformed zip that contains no word/document.xml", async () => {
    const converter = makeConverter({ "broken.docx": Buffer.from("not a zip at all", "utf8") });

    await expect(converter.convert("broken.docx", "docx")).rejects.toThrow(
      /No word\/document\.xml found in 'broken\.docx'/,
    );
  });

  it("uses the file basename as title and section", async () => {
    const docx = makeDocxBuffer(docxXmlWithRuns(["<w:t>Body</w:t>"]));
    const converter = makeConverter({ "reports/quarterly.docx": docx });

    const result = await converter.convert("reports/quarterly.docx", "docx");

    expect(result.metadata.title).toBe("quarterly");
    expect(result.metadata.sections).toEqual(["quarterly"]);
    expect(result.markdown.startsWith("# quarterly\n\n")).toBe(true);
  });
});

// ─── PPTX text extraction ───

describe("DocumentConverter — PPTX text extraction", () => {
  function slideXml(text: string): Buffer {
    return Buffer.from(
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
      "utf8",
    );
  }

  it("orders slides numerically, not lexicographically (slide2 before slide10)", async () => {
    const zip = makeStoredZip([
      { name: "ppt/slides/slide10.xml", data: slideXml("Tenth slide") },
      { name: "ppt/slides/slide2.xml", data: slideXml("Second slide") },
      { name: "ppt/slides/slide1.xml", data: slideXml("First slide") },
    ]);
    const converter = makeConverter({ "deck.pptx": zip });

    const result = await converter.convert("deck.pptx", "pptx");

    const first = result.markdown.indexOf("First slide");
    const second = result.markdown.indexOf("Second slide");
    const tenth = result.markdown.indexOf("Tenth slide");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(tenth);
    expect(result.page_count).toBe(3);
  });

  it("ignores slide-like entries that do not match the slideN.xml pattern", async () => {
    const zip = makeStoredZip([
      { name: "ppt/slides/slide1.xml", data: slideXml("Real slide") },
      { name: "ppt/slides/_rels/slide1.xml.rels", data: Buffer.from("<Relationships/>", "utf8") },
      { name: "ppt/slides/slideLayout1.xml", data: slideXml("Layout text") },
    ]);
    const converter = makeConverter({ "deck.pptx": zip });

    const result = await converter.convert("deck.pptx", "pptx");

    expect(result.page_count).toBe(1);
    expect(result.markdown).toContain("Real slide");
    expect(result.markdown).not.toContain("Layout text");
  });

  it("skips slides with no extractable text and throws when all slides are empty", async () => {
    const zip = makeStoredZip([
      { name: "ppt/slides/slide1.xml", data: slideXml("") },
      { name: "ppt/slides/slide2.xml", data: slideXml("Kept slide") },
    ]);
    const converter = makeConverter({ "deck.pptx": zip });

    const result = await converter.convert("deck.pptx", "pptx");

    expect(result.markdown).not.toContain("## Slide 1\n");
    expect(result.markdown).toContain("## Slide 2");
    expect(result.markdown).toContain("Kept slide");
    expect(result.metadata.sections).toEqual(["Slide 1"]);

    const allEmpty = makeStoredZip([{ name: "ppt/slides/slide1.xml", data: slideXml("") }]);
    const emptyConverter = makeConverter({ "empty.pptx": allEmpty });
    await expect(emptyConverter.convert("empty.pptx", "pptx")).rejects.toThrow(
      /No readable slide text extracted from 'empty\.pptx'/,
    );
  });

  it("decodes XML entities in slide text", async () => {
    const zip = makeStoredZip([
      { name: "ppt/slides/slide1.xml", data: slideXml("Rocks &amp; Hard Places") },
    ]);
    const converter = makeConverter({ "deck.pptx": zip });

    const result = await converter.convert("deck.pptx", "pptx");

    expect(result.markdown).toContain("Rocks & Hard Places");
  });
});

// ─── Transcripts (VTT / SRT) ───

describe("DocumentConverter — transcript conversion", () => {
  it("strips WEBVTT header, timestamps, and cue arrows", async () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:04.000",
      "Welcome everyone.",
      "",
      "00:00:05.000 --> 00:00:09.000",
      "Let's begin.",
    ].join("\n");
    const converter = makeConverter({ "call.vtt": vtt });

    const result = await converter.convert("call.vtt", "vtt");

    expect(result.markdown).toContain("# Transcript: call");
    expect(result.markdown).toContain("Welcome everyone.");
    expect(result.markdown).toContain("Let's begin.");
    expect(result.markdown).not.toContain("WEBVTT");
    expect(result.markdown).not.toContain("-->");
    expect(result.markdown).not.toContain("00:00:01.000");
  });

  it("strips numeric SRT cue identifiers", async () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:02,000",
      "First line",
      "",
      "2",
      "00:00:03,000 --> 00:00:04,000",
      "Second line",
    ].join("\n");
    const converter = makeConverter({ "subs.srt": srt });

    const result = await converter.convert("subs.srt", "srt");

    expect(result.markdown).toContain("First line\nSecond line");
    expect(result.word_count).toBe(4);
  });

  it("keeps speaker text that is not a timestamp or number", async () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nAlice: 42 items shipped in Q3";
    const converter = makeConverter({ "standup.vtt": vtt });

    const result = await converter.convert("standup.vtt", "vtt");

    expect(result.markdown).toContain("Alice: 42 items shipped in Q3");
  });
});

// ─── convertRawText and section extraction ───

describe("DocumentConverter — convertRawText and section extraction", () => {
  it("wraps raw text in a level-1 heading when a title is given", () => {
    const converter = makeConverter();

    const result = converter.convertRawText("Body content here.", "My Title");

    expect(result.format).toBe("txt");
    expect(result.markdown).toBe("# My Title\n\nBody content here.");
    expect(result.metadata.title).toBe("My Title");
    expect(result.metadata.sections).toEqual(["My Title"]);
  });

  it("returns the text unchanged when no title is given", () => {
    const converter = makeConverter();

    const result = converter.convertRawText("Just text.");

    expect(result.markdown).toBe("Just text.");
    expect(result.metadata.title).toBeUndefined();
    expect(result.metadata.sections).toEqual([]);
  });

  it("handles empty input without throwing", () => {
    const converter = makeConverter();

    const result = converter.convertRawText("");

    expect(result.markdown).toBe("");
    expect(result.word_count).toBe(0);
    expect(result.metadata.sections).toEqual([]);
  });

  it("extracts level 1-3 headings as sections, ignoring deeper levels", () => {
    const converter = makeConverter();
    const markdown = "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five";

    const result = converter.convertRawText(markdown);

    expect(result.metadata.sections).toEqual(["One", "Two", "Three"]);
  });

  it("does not treat headings without a space after # as sections", () => {
    const converter = makeConverter();

    const result = converter.convertRawText("#NoSpace\n\n# Real Heading");

    expect(result.metadata.sections).toEqual(["Real Heading"]);
  });

  it("trims whitespace around heading text", () => {
    const converter = makeConverter();

    const result = converter.convertRawText("##    Padded Heading   ");

    expect(result.metadata.sections).toEqual(["Padded Heading"]);
  });
});

// ─── Markdown / text pass-through edge cases ───

describe("DocumentConverter — markdown and text edge cases", () => {
  it("falls back to the file basename as title when markdown has no headings", async () => {
    const converter = makeConverter({ "notes/plain.md": "No headings here." });

    const result = await converter.convert("notes/plain.md", "md");

    expect(result.metadata.title).toBe("plain");
    expect(result.metadata.sections).toEqual([]);
  });

  it("uses the first heading as the markdown title", async () => {
    const converter = makeConverter({ "guide.md": "## Second\n\n# First\n\n### Third" });

    const result = await converter.convert("guide.md", "md");

    expect(result.metadata.title).toBe("Second");
    expect(result.metadata.sections).toEqual(["Second", "First", "Third"]);
  });

  it("counts words across whitespace variants", async () => {
    const converter = makeConverter({ "doc.md": "one  two\nthree\tfour   \n\n five" });

    const result = await converter.convert("doc.md", "md");

    expect(result.word_count).toBe(5);
  });

  it("converts empty text files without throwing", async () => {
    const converter = makeConverter({ "empty.txt": "" });

    const result = await converter.convert("empty.txt", "txt");

    expect(result.markdown).toBe("# empty\n\n");
    expect(result.word_count).toBe(0);
    expect(result.metadata.sections).toEqual(["empty"]);
  });

  it("treats .html files as plain text (no dedicated HTML converter)", async () => {
    const converter = makeConverter({
      "page.html": "<h1>Heading</h1><p>Paragraph text</p>",
    });

    const result = await converter.convert("page.html");

    expect(result.format).toBe("txt");
    expect(result.metadata.title).toBe("page");
    expect(result.markdown).toContain("<h1>Heading</h1><p>Paragraph text</p>");
  });

  it("preserves UTF-8 content in text files", async () => {
    const converter = makeConverter({ "intl.txt": "Ünïcödé tëxt — 日本語" });

    const result = await converter.convert("intl.txt", "txt");

    expect(result.markdown).toContain("Ünïcödé tëxt — 日本語");
  });

  it("propagates FileManager read errors", async () => {
    const converter = makeConverter({});

    await expect(converter.convert("missing.md", "md")).rejects.toThrow(/ENOENT/);
  });
});
