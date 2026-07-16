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
import { existsSync, mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { AuditLogger } from "../../src/services/audit-logger.js";
import { RbacEngine } from "../../src/services/rbac-engine.js";
import { ExecutionContextResolver } from "../../src/services/execution-context.js";
import { installToolEnforcement } from "../../src/tools/tool-enforcement.js";
import { resolveUseCaseContract } from "../../src/contracts/use-case.js";
import { Phase } from "../../src/constants.js";
import { testDocumentationConfig } from "../helpers/documentation-config.js";

const REPO = resolve(import.meta.dirname, "../..");
// The built-in template dir resolves relative to dist/; when running from
// src/ it does not exist, so tests mirror the repo templates into each
// workspace and use the custom-templates path.
const TEMPLATES_SRC = join(REPO, "templates");
const CUSTOM_TEMPLATES = ".specky-test-templates";
const DOCUMENT_USE_CASE = {
  lifecycle: "greenfield" as const,
  workload: "service" as const,
  execution_mode: "full" as const,
  capabilities: ["document-import"] as const,
  capability_config: {
    "document-import": {
      formats: ["docx", "md"] as const,
    },
  },
};

interface Harness {
  workspace: string;
  client: Client;
  close: () => Promise<void>;
}

async function buildHarness(
  workspace: string,
  phase: Phase = Phase.Analyze,
): Promise<Harness> {
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

  const contract = resolveUseCaseContract({
    lifecycle: "greenfield",
    workload: "service",
    execution_mode: "full",
    capabilities: ["compliance", "figma", "work-items", "release"],
    capability_config: {
      compliance: {
        frameworks: ["soc2"],
        control_pack_version: "2026.1",
        evidence_required: true,
      },
      figma: {
        extraction_scope: "node",
        require_component_properties: true,
        diagram_types: ["architecture", "user_flow", "data_flow", "integration"],
      },
      "work-items": {
        platform: "jira",
        include_subtasks: true,
        project_key: "CHK",
      },
      release: {
        branch_prefix: "spec/",
        base_branch: "develop",
        draft_pr: false,
        checkpoints: true,
        documentation: testDocumentationConfig(),
      },
    },
  });
  for (const feature of await fileManager.listFeatures(".specs")) {
    const state = stateMachine.createFeatureState({
      projectName: feature.name,
      feature: {
        number: feature.number,
        name: feature.name,
        directory: feature.directory,
      },
      contract,
    });
    state.current_phase = phase;
    for (const contractedPhase of contract.phases) {
      if (contractedPhase === phase) {
        state.phases[contractedPhase] = { status: "in_progress" };
        break;
      }
      state.phases[contractedPhase] = { status: "completed" };
    }
    state.gate_decision = {
      decision: "APPROVE",
      reasons: ["Test fixture"],
      coverage_percent: 100,
      gaps: [],
      decided_at: new Date().toISOString(),
    };
    await stateMachine.saveState(feature.directory, state);
  }

  const server = new McpServer({ name: "specky-test", version: "0.0.0" });
  installToolEnforcement(server, {
    auditLogger: new AuditLogger(workspace, false),
    rbacEngine: new RbacEngine(false, "contributor"),
    stateMachine,
    contextResolver: new ExecutionContextResolver(fileManager, stateMachine),
  });
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

/** Canonical Specky write_tasks table format (writers emit this). */
const TASKS_TABLE_MD = `# Tasks: Checkout

## Task Breakdown

| ID | Title | Parallel | Effort | Depends On | Traces To |
|----|-------|----------|--------|------------|-----------|
| T-001 | Build payment form | | M | — | REQ-CORE-001 |
| T-002 | Persist orders | [P] | S | T-001 | REQ-CORE-002 |
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
    for (const ws of workspaces.splice(0)) rmSync(ws, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

    it("exports work items from canonical TASKS.md table rows (not only checkboxes)", async () => {
      const ws = makeWorkspace("specky-export-table-");
      seedFeature(ws, ".specs/001-checkout-service", {
        "SPECIFICATION.md": SPEC_MD,
        "TASKS.md": TASKS_TABLE_MD,
      });
      const exporter = new WorkItemExporter(new FileManager(ws));
      const result = await exporter.export("github", ".specs", ".specs/001-checkout-service", false);

      expect(result.items).toHaveLength(2);
      expect((result.items[0] as GitHubWorkItem).title).toBe("[T-001] Build payment form");
      expect((result.items[0] as GitHubWorkItem).traces_to).toEqual(["REQ-CORE-001"]);
      expect((result.items[1] as GitHubWorkItem).title).toBe("[T-002] Persist orders");
      expect((result.items[1] as GitHubWorkItem).traces_to).toEqual(["REQ-CORE-002"]);
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

    it("sdd_export_work_items uses the persisted Jira contract and rejects per-call overrides", async () => {
      const { workspace } = seedExportWorkspace();
      const h = await buildHarness(workspace, Phase.Verify);
      cleanups.push(h.close);

      const res = await callTool(h.client, "sdd_export_work_items", {
        feature_number: "001",
        spec_dir: ".specs",
      });

      expect(res.isError).toBe(false);
      const items = res.payload["items"] as JiraWorkItem[];
      expect(items[0].fields.project.key).toBe("CHK");
      expect(items[0].fields.issuetype.name).toBe("Task");

      const override = await callTool(h.client, "sdd_export_work_items", {
        feature_number: "001",
        spec_dir: ".specs",
        platform: "github",
      });
      expect(override.isError).toBe(true);
      expect(override.raw).toContain("Unrecognized key");
    });
  });

  // ── Fix: persisted CHECKLIST.md carries the real table, not [TODO: …] ──
  it("sdd_checklist persists CHECKLIST.md with the real item table, date, totals, and gate decision", async () => {
    const ws = makeWorkspace("specky-checklist-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "DESIGN.md": "# Design\n\nREQ-CORE-001 is implemented by the PaymentService.\n",
    });
    const h = await buildHarness(ws, Phase.Analyze);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_checklist", {
      domain: "security",
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
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
    expect(persisted).toMatch(/## Gate Decision\r?\n\r?\n(APPROVE|CHANGES_NEEDED)/); // \r?\n: Windows checkouts render templates with CRLF
    // The response mirrors the persisted gate decision.
    expect(String(res.payload["gate_decision"])).toMatch(/^(APPROVE|CHANGES_NEEDED)/);
  });

  // ── Fix: persisted COMPLIANCE.md / VERIFICATION.md carry real tables, not [TODO: …] ──
  it("sdd_compliance_check persists COMPLIANCE.md without [TODO: placeholders", async () => {
    const ws = makeWorkspace("specky-compliance-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "DESIGN.md": "# Design\n\nAccess control, encryption, audit logging, and monitoring.\n",
    });
    const h = await buildHarness(ws, Phase.Analyze);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_compliance_check", {
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
      evidence: {
        "SOC2-CC6.1": ["SPECIFICATION.md#REQ-CORE-001"],
        "SOC2-CC7.2": ["DESIGN.md#Monitoring"],
        "SOC2-CC8.1": ["DESIGN.md#Change-management"],
        "SOC2-A1.2": ["DESIGN.md#Recovery"],
        "SOC2-CC6.6": ["DESIGN.md#Encryption"],
        "SOC2-CC7.3": ["DESIGN.md#Incident-response"],
      },
    });
    expect(res.isError).toBe(false);

    const persisted = readFileSync(join(ws, ".specs/001-checkout-service/COMPLIANCE.md"), "utf8");
    expect(persisted).not.toContain("[TODO:");
    expect(persisted).toContain("| SOC2-");
    expect(persisted).toMatch(/\*\*Date\*\*: \d{4}-\d{2}-\d{2}/);
    expect(persisted).toMatch(/## Recommendation\r?\n\r?\n.+/);
  });

  it("sdd_verify_tasks parses table TASKS.md and persists VERIFICATION.md without [TODO:", async () => {
    const ws = makeWorkspace("specky-verify-table-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "TASKS.md": TASKS_TABLE_MD,
    });
    writeFileSync(join(ws, "payment.ts"), "// T-001 Build payment form\n", "utf8");
    const h = await buildHarness(ws, Phase.Verify);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_verify_tasks", {
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
      code_paths: ["payment.ts"],
    });
    expect(res.isError).toBe(false);
    expect(res.payload["total_tasks"]).toBe(2);
    expect(res.raw).not.toContain("No tasks found");

    const persisted = readFileSync(join(ws, ".specs/001-checkout-service/VERIFICATION.md"), "utf8");
    expect(persisted).not.toContain("[TODO:");
    expect(persisted).toContain("| T-001 |");
    expect(persisted).toContain("| T-002 |");
  });

  // ── Fix: persisted CROSS_ANALYSIS.md carries alignment tables + recommendation ──
  it("sdd_cross_analyze persists CROSS_ANALYSIS.md with real alignment rows and a recommendation", async () => {
    const ws = makeWorkspace("specky-crossanalysis-");
    seedFeature(ws, ".specs/001-checkout-service", {
      "SPECIFICATION.md": SPEC_MD,
      "DESIGN.md": "# Design\n\nREQ-CORE-001 is implemented by the PaymentService.\n",
      "TASKS.md": "# Tasks\n\n- [ ] T-001: Build payment form (REQ-CORE-001)\n",
    });
    const h = await buildHarness(ws, Phase.Analyze);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_cross_analyze", {
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
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
    expect(persisted).toMatch(/## Recommendation\r?\n\r?\nConsistency score is \d+%/); // \r?\n: Windows checkouts render templates with CRLF
  });

  // ── Fix: sdd_figma_to_spec references tools that actually exist ──
  it("sdd_figma_to_spec step_4 routes to sdd_write_spec/design/tasks, not nonexistent sdd_gen_* tools", async () => {
    const ws = makeWorkspace("specky-figma-");
    seedFeature(ws, ".specs/001-checkout-ui", {});
    const h = await buildHarness(ws, Phase.Specify);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_figma_to_spec", {
      figma_file_key: "aBc123XyZ",
      figma_node_id: "12:34",
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
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

    const res = await callTool(h.client, "sdd_batch_import", {
      documents_dir: "docs",
      spec_dir: ".specs",
      use_case: DOCUMENT_USE_CASE,
      force: false,
    });

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

    const res = await callTool(h.client, "sdd_import_document", {
      file_path: "docs/report.docx",
      format: "docx",
      spec_dir: ".specs",
      use_case: DOCUMENT_USE_CASE,
    });

    expect(res.isError).toBe(true);
    expect(res.raw).toContain("compressed docx not supported natively");
    expect(res.raw).toContain("MarkItDown");
  });

  it("sdd_research writes only resolved evidence and reviewed sources", async () => {
    const ws = makeWorkspace("specky-research-evidence-");
    seedFeature(ws, ".specs/001-checkout-service", {});
    const h = await buildHarness(ws, Phase.Discover);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_research", {
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
      entries: [{
        id: "RQ-001",
        question: "Which idempotency strategy protects checkout retries?",
        context: "The payment operation can be retried by clients and gateways.",
        findings: "A client-supplied idempotency key uniquely identifies one payment attempt.",
        sources: ["DESIGN.md#Payment-idempotency", "ADR-004"],
        recommendation: "Persist idempotency keys with the payment result for the contracted retention period.",
        status: "resolved",
      }],
    });
    expect(res.isError).toBe(false);
    const research = readFileSync(join(ws, ".specs/001-checkout-service/RESEARCH.md"), "utf8");
    expect(research).toContain("A client-supplied idempotency key");
    expect(research).toContain("DESIGN.md#Payment-idempotency");
    expect(research).not.toContain("TODO");
    expect(research).not.toContain("none yet");
  });

  it("sdd_research rejects missing sources before writing", async () => {
    const ws = makeWorkspace("specky-research-invalid-");
    seedFeature(ws, ".specs/001-checkout-service", {});
    const h = await buildHarness(ws, Phase.Discover);
    cleanups.push(h.close);

    const res = await callTool(h.client, "sdd_research", {
      feature_number: "001",
      spec_dir: ".specs",
      force: false,
      entries: [{
        id: "RQ-001",
        question: "Which retry policy applies to checkout?",
        context: "Retries can duplicate payment operations.",
        findings: "The retry policy requires bounded exponential backoff.",
        sources: [],
        recommendation: "Use the reviewed bounded retry policy.",
        status: "resolved",
      }],
    });
    expect(res.isError).toBe(true);
    expect(existsSync(join(ws, ".specs/001-checkout-service/RESEARCH.md"))).toBe(false);
  });
});
