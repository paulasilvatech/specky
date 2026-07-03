/**
 * exports-quality.test.ts — promise-delivery regressions found by executing
 * the real server (audit wf_c703f5af-3d8):
 *
 *   1. sdd_export_work_items returned byte-identical generic items for
 *      github/azure_boards/jira and silently discarded the documented
 *      jira project_key, azure area_path/iteration_path, and include_subtasks.
 *   2. Persisted CHECKLIST.md rendered '[TODO: items]/[TODO: date]/
 *      [TODO: total_items]/[TODO: gate_decision]' and CROSS_ANALYSIS.md
 *      rendered '[TODO: spec_design_alignment]/[TODO: design_tasks_alignment]/
 *      [TODO: recommendation]' — the tools computed the real data but never
 *      passed it to the TemplateEngine.
 *   3. sdd_figma_to_spec step_4 referenced NONEXISTENT tools
 *      (sdd_gen_spec/sdd_gen_design/sdd_gen_tasks).
 *   4. sdd_batch_import counted compressed (real-world) DOCX conversions —
 *      which produced binary garbage — as "successful".
 */
import { mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FileManager } from "../../src/services/file-manager.js";
import { StateMachine } from "../../src/services/state-machine.js";
import { TemplateEngine } from "../../src/services/template-engine.js";
import { EarsValidator } from "../../src/services/ears-validator.js";
import { ComplianceEngine } from "../../src/services/compliance-engine.js";
import { CrossAnalyzer } from "../../src/services/cross-analyzer.js";
import { GitManager } from "../../src/services/git-manager.js";
import { DocumentConverter } from "../../src/services/document-converter.js";
import {
  WorkItemExporter,
  type GitHubWorkItem,
  type JiraWorkItem,
  type AzureBoardsWorkItem,
} from "../../src/services/work-item-exporter.js";
import { registerQualityTools } from "../../src/tools/quality.js";
import { registerInputTools } from "../../src/tools/input.js";
import { registerIntegrationTools } from "../../src/tools/integration.js";

const REPO = resolve(import.meta.dirname, "../..");
// The built-in template dir resolves relative to dist/; when running from
// src/ it does not exist, so tests mirror the repo templates into each
// workspace and use the custom-templates path.
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(workspace: string): Promise<Harness> {
  cpSync(TEMPLATES_SRC, join(workspace, CUSTOM_TEMPLATES), { recursive: true });

  const fileManager = new FileManager(workspace);
  const stateMachine = new StateMachine(fileManager, workspace);
  const templateEngine = new TemplateEngine(fileManager, CUSTOM_TEMPLATES);
  const earsValidator = new EarsValidator();
  const complianceEngine = new ComplianceEngine();
  const crossAnalyzer = new CrossAnalyzer(fileManager);
  const gitManager = new GitManager(fileManager);
  const workItemExporter = new WorkItemExporter(fileManager);
  const documentConverter = new DocumentConverter(fileManager);

  const server = new McpServer({ name: "specky-test", version: "0.0.0" });
  registerQualityTools(server, fileManager, stateMachine, templateEngine, complianceEngine, crossAnalyzer, earsValidator);
  registerInputTools(server, fileManager, documentConverter, stateMachine);
  registerIntegrationTools(server, fileManager, stateMachine, templateEngine, gitManager, workItemExporter);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "exports-quality", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    workspace,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; payload: Record<string, unknown>; raw: string }> {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as Array<{ type: string; text?: string }>;
  const raw = content[0]?.text ?? "{}";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = { _raw: raw };
  }
  return { isError: res.isError === true, payload, raw };
}

const SPEC_MD = `# Specification: checkout service

## Requirements

- REQ-CORE-001: When a customer submits the payment form, the system shall validate the card input using defined validation rules, OAuth2 authentication, RBAC authorization, encryption at rest and in transit, secrets rotation, and audit logging of security events.
- REQ-CORE-002: When an order is confirmed, the system shall persist the order.
`;

const TASKS_MD = `# Tasks

- [ ] T-001: Build payment form (REQ-CORE-001)
  - [ ] Add card number validation
  - [ ] Add expiry date validation
- [x] T-002: Persist orders (REQ-CORE-002)
`;

function seedFeature(workspace: string, featureDir: string, files: Record<string, string>): void {
  const dir = join(workspace, featureDir);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
}

/** Minimal DEFLATE-compressed zip masquerading as a real-world DOCX. */
function makeCompressedDocx(bodyText: string): Buffer {
  const documentXml =
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body></w:document>`;
  const nameBuf = Buffer.from("word/document.xml", "utf8");
  const payload = deflateRawSync(Buffer.from(documentXml, "utf8"));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // method 8 = DEFLATE
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(documentXml.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  return Buffer.concat([local, nameBuf, payload, eocd]);
}

describe("export & quality-report regressions", () => {
  const cleanups: Array<() => Promise<void>> = [];
  const workspaces: string[] = [];

  function makeWorkspace(prefix: string): string {
    const ws = mkdtempSync(join(tmpdir(), prefix));
    workspaces.push(ws);
    return ws;
  }

  afterEach(async () => {
    for (const close of cleanups.splice(0)) await close();
    for (const ws of workspaces.splice(0)) rmSync(ws, { recursive: true, force: true });
  });

  // ── Fix: sdd_export_work_items produces target-specific payload shapes ──
  describe("WorkItemExporter platform payloads", () => {
    function seedExportWorkspace(): { exporter: WorkItemExporter; workspace: string } {
      const ws = makeWorkspace("specky-export-");
      seedFeature(ws, ".specs/001-checkout-service", {
        "SPECIFICATION.md": SPEC_MD,
        "TASKS.md": TASKS_MD,
      });
      return { exporter: new WorkItemExporter(new FileManager(ws)), workspace: ws };
    }

    it("github, jira, and azure_boards payloads are NOT byte-identical", async () => {
      const { exporter } = seedExportWorkspace();
      const featureDir = ".specs/001-checkout-service";
      const options = { project_key: "CHK", area_path: "Shop\\Checkout", iteration_path: "Shop\\Sprint 1" };

      const github = await exporter.export("github", ".specs", featureDir, true, options);
      const jira = await exporter.export("jira", ".specs", featureDir, true, options);
      const azure = await exporter.export("azure_boards", ".specs", featureDir, true, options);

      const [g, j, a] = [github.items, jira.items, azure.items].map((items) => JSON.stringify(items));
      expect(g).not.toBe(j);
      expect(g).not.toBe(a);
      expect(j).not.toBe(a);
    });

    it("github items use {title, body, labels[]} with REQ/task traceability", async () => {
      const { exporter } = seedExportWorkspace();
      const result = await exporter.export("github", ".specs", ".specs/001-checkout-service", true);
      const item = result.items[0] as GitHubWorkItem;

      expect(item.title).toBe("[T-001] Build payment form");
      // Title must not duplicate the traces_to suffix from the TASKS.md line.
      expect(item.title).not.toContain("REQ-");
      expect(item.body).toContain("REQ-CORE-001");
      expect(item.labels).toContain("feature/001");
      expect(item.labels).toContain("REQ-CORE-001");
      expect(item.task_id).toBe("T-001");
      expect(item.traces_to).toEqual(["REQ-CORE-001"]);
      // include_subtasks=true renders the indented bullets.
      expect(item.body).toContain("Add card number validation");
    });

    it("jira items use {fields: {project.key, summary, description, issuetype.name}} honoring project_key", async () => {
      const { exporter } = seedExportWorkspace();
      const result = await exporter.export("jira", ".specs", ".specs/001-checkout-service", true, { project_key: "CHK" });
      const item = result.items[0] as JiraWorkItem;

      expect(item.fields.project.key).toBe("CHK");
      expect(item.fields.issuetype.name).toBe("Task");
      expect(item.fields.summary).toBe("[T-001] Build payment form");
      expect(item.fields.description).toContain("REQ-CORE-001");
      expect(item.traces_to).toEqual(["REQ-CORE-001"]);
      expect(result.metadata.project_key).toBe("CHK");
    });

    it("jira export FAILS without a project_key instead of silently discarding it", async () => {
      const { exporter } = seedExportWorkspace();
      await expect(
        exporter.export("jira", ".specs", ".specs/001-checkout-service", true)
      ).rejects.toThrow(/project_key is required for the jira platform/);
    });

    it("azure_boards items use System.* fields honoring area_path and iteration_path", async () => {
      const { exporter } = seedExportWorkspace();
      const result = await exporter.export("azure_boards", ".specs", ".specs/001-checkout-service", true, {
        area_path: "Shop\\Checkout",
        iteration_path: "Shop\\Sprint 1",
      });
      const item = result.items[0] as AzureBoardsWorkItem;

      expect(item.work_item_type).toBe("Task");
      expect(item.fields["System.Title"]).toBe("[T-001] Build payment form");
      expect(item.fields["System.AreaPath"]).toBe("Shop\\Checkout");
      expect(item.fields["System.IterationPath"]).toBe("Shop\\Sprint 1");
      expect(item.fields["System.Description"]).toContain("REQ-CORE-001");
    });

    it("azure_boards items omit AreaPath/IterationPath when not provided", async () => {
      const { exporter } = seedExportWorkspace();
      const result = await exporter.export("azure_boards", ".specs", ".specs/001-checkout-service", true);
      const item = result.items[0] as AzureBoardsWorkItem;

      expect(item.fields).not.toHaveProperty("System.AreaPath");
      expect(item.fields).not.toHaveProperty("System.IterationPath");
    });

    it("include_subtasks=false excludes the subtask bullets", async () => {
      const { exporter } = seedExportWorkspace();
      const withSub = await exporter.export("github", ".specs", ".specs/001-checkout-service", true);
      const withoutSub = await exporter.export("github", ".specs", ".specs/001-checkout-service", false);

      expect((withSub.items[0] as GitHubWorkItem).body).toContain("Add card number validation");
      expect((withoutSub.items[0] as GitHubWorkItem).body).not.toContain("Add card number validation");
      expect(withoutSub.metadata.include_subtasks).toBe(false);
    });

    it("sdd_export_work_items tool passes documented params through to the payload", async () => {
      const { workspace } = seedExportWorkspace();
      const h = await buildHarness(workspace);
      cleanups.push(h.close);

      const res = await callTool(h.client, "sdd_export_work_items", {
        platform: "jira",
        feature_number: "001",
        spec_dir: ".specs",
        project_key: "CHK",
      });

      expect(res.isError).toBe(false);
      const items = res.payload["items"] as JiraWorkItem[];
      expect(items[0].fields.project.key).toBe("CHK");
      expect(items[0].fields.issuetype.name).toBe("Task");

      const missingKey = await callTool(h.client, "sdd_export_work_items", {
        platform: "jira",
        feature_number: "001",
        spec_dir: ".specs",
      });
      expect(missingKey.isError).toBe(true);
      expect(missingKey.raw).toContain("project_key is required for the jira platform");
    });
  });

  // ── Fix: persisted CHECKLIST.md carries the real table, not [TODO: …] ──
  it("sdd_checklist persists CHECKLIST.md with the real item table, date, totals, and gate decision", async () => {
    const ws = makeWorkspace("specky-checklist-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "DESIGN.md": "# Design\n\nREQ-CORE-001 is implemented by the PaymentService.\n",
    });
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_checklist", {
      domain: "security",
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(res.isError).toBe(false);

    const persisted = readFileSync(join(ws, ".specs/001-checkout-service/CHECKLIST.md"), "utf8");
    expect(persisted).not.toContain("[TODO:");
    // Real per-item table rows, not a placeholder.
    expect(persisted).toContain("| SEC-01 |");
    expect(persisted).toContain("| SEC-08 |");
    expect(persisted).toMatch(/\| SEC-01 \|.*\| Yes \| (pass|fail|pending) \|/);
    // Real totals and gate decision.
    expect(persisted).toContain("- **Total**: 8");
    expect(persisted).toMatch(/## Gate Decision\n\n(APPROVE|CHANGES_NEEDED)/);
    // The response mirrors the persisted gate decision.
    expect(String(res.payload["gate_decision"])).toMatch(/^(APPROVE|CHANGES_NEEDED)/);
  });

  // ── Fix: persisted CROSS_ANALYSIS.md carries alignment tables + recommendation ──
  it("sdd_cross_analyze persists CROSS_ANALYSIS.md with real alignment rows and a recommendation", async () => {
    const ws = makeWorkspace("specky-crossanalysis-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "DESIGN.md": "# Design\n\nREQ-CORE-001 is implemented by the PaymentService.\n",
      "TASKS.md": "# Tasks\n\n- [ ] T-001: Build payment form (REQ-CORE-001)\n",
    });
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_cross_analyze", {
      feature_number: "001",
      spec_dir: ".specs",
    });
    expect(res.isError).toBe(false);

    const persisted = readFileSync(join(ws, ".specs/001-checkout-service/CROSS_ANALYSIS.md"), "utf8");
    expect(persisted).not.toContain("[TODO:");
    // Spec → Design table: REQ-CORE-001 aligned, REQ-CORE-002 missing.
    expect(persisted).toContain("| REQ-CORE-001 | Yes | REQ-CORE-001 referenced in DESIGN.md |");
    expect(persisted).toContain("| REQ-CORE-002 | No | REQ-CORE-002 NOT found in DESIGN.md |");
    // Design → Tasks table rows.
    expect(persisted).toContain("| REQ-CORE-001 | Yes | REQ-CORE-001 has implementing tasks |");
    expect(persisted).toContain("| REQ-CORE-002 | No | REQ-CORE-002 has NO implementing tasks |");
    // Recommendation section carries the computed guidance.
    expect(persisted).toMatch(/## Recommendation\n\nConsistency score is \d+%/);
  });

  // ── Fix: sdd_figma_to_spec references tools that actually exist ──
  it("sdd_figma_to_spec step_4 routes to sdd_write_spec/design/tasks, not nonexistent sdd_gen_* tools", async () => {
    const ws = makeWorkspace("specky-figma-");
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_figma_to_spec", {
      figma_file_key: "aBc123XyZ",
      figma_node_id: "12:34",
      project_name: "checkout-ui",
      spec_dir: ".specs",
    });

    expect(res.isError).toBe(false);
    const routing = res.payload["routing_instructions"] as Record<string, string>;
    expect(routing["step_4"]).toContain("sdd_write_spec");
    expect(routing["step_4"]).toContain("sdd_write_design");
    expect(routing["step_4"]).toContain("sdd_write_tasks");
    expect(res.raw).not.toContain("sdd_gen_spec");
    expect(res.raw).not.toContain("sdd_gen_design");
    expect(res.raw).not.toContain("sdd_gen_tasks");
  });

  // ── Fix: compressed Office files are failures, not empty/garbage "successes" ──
  it("sdd_batch_import counts a compressed DOCX as failed with the actionable reason", async () => {
    const ws = makeWorkspace("specky-batchimport-");
    mkdirSync(join(ws, "docs"), { recursive: true });
    writeFileSync(join(ws, "docs", "good.md"), "# PRD\n\nThe system shall export invoices.\n", "utf8");
    writeFileSync(join(ws, "docs", "report.docx"), makeCompressedDocx("The wizard shall collect the tax identifier."));
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_batch_import", { documents_dir: "docs", spec_dir: ".specs" });

    expect(res.isError).toBe(false);
    expect(res.payload["total"]).toBe(2);
    expect(res.payload["successful"]).toBe(1);
    expect(res.payload["failed"]).toBe(1);
    const results = res.payload["results"] as Array<{ file: string; status: string; error?: string }>;
    const docxResult = results.find((r) => r.file.endsWith("report.docx"));
    expect(docxResult?.status).toBe("error");
    expect(docxResult?.error).toMatch(/compressed docx not supported natively/);
  });

  it("sdd_import_document errors (isError) on a compressed DOCX instead of reporting success with garbage", async () => {
    const ws = makeWorkspace("specky-importdoc-");
    mkdirSync(join(ws, "docs"), { recursive: true });
    writeFileSync(join(ws, "docs", "report.docx"), makeCompressedDocx("The wizard shall collect the tax identifier."));
    const h = await buildHarness(ws);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_import_document", { file_path: "docs/report.docx", spec_dir: ".specs" });

    expect(res.isError).toBe(true);
    expect(res.raw).toContain("compressed docx not supported natively");
    expect(res.raw).toContain("MarkItDown");
  });
});
