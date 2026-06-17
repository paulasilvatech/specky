import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocumentConverter } from "../../src/services/document-converter.js";
import { FileManager } from "../../src/services/file-manager.js";

describe("DocumentConverter", () => {
  let workspace: string;
  let converter: DocumentConverter;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "specky-doc-converter-"));
    mkdirSync(join(workspace, "docs"), { recursive: true });
    converter = new DocumentConverter(new FileManager(workspace));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
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

    await expect(converter.convert(absolutePath, "md")).rejects.toThrow("Absolute paths are not allowed");
  });

  it("rejects path traversal", async () => {
    await expect(converter.convert("../outside.md", "md")).rejects.toThrow("Path traversal is not allowed");
  });
});
