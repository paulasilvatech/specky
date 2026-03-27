#!/usr/bin/env node
/**
 * Specky MCP Server — Entry Point
 * Spec-Driven Development engine for AI agents.
 *
 * Creator: Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB
 * License: MIT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { VERSION, SERVER_NAME, DEFAULT_HTTP_PORT } from "./constants.js";
import { FileManager } from "./services/file-manager.js";
import { StateMachine } from "./services/state-machine.js";
import { TemplateEngine } from "./services/template-engine.js";
import { EarsValidator } from "./services/ears-validator.js";
import { CodebaseScanner } from "./services/codebase-scanner.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerTranscriptTools } from "./tools/transcript.js";
import { TranscriptParser } from "./services/transcript-parser.js";

// v2.0 imports — new services
import { DocumentConverter } from "./services/document-converter.js";
import { DiagramGenerator } from "./services/diagram-generator.js";
import { IacGenerator } from "./services/iac-generator.js";
import { WorkItemExporter } from "./services/work-item-exporter.js";
import { CrossAnalyzer } from "./services/cross-analyzer.js";
import { ComplianceEngine } from "./services/compliance-engine.js";
import { DocGenerator } from "./services/doc-generator.js";
import { GitManager } from "./services/git-manager.js";

// v2.0 imports — new tool groups
import { registerInputTools } from "./tools/input.js";
import { registerQualityTools } from "./tools/quality.js";
import { registerVisualizationTools } from "./tools/visualization.js";
import { registerInfrastructureTools } from "./tools/infrastructure.js";
import { registerEnvironmentTools } from "./tools/environment.js";
import { registerIntegrationTools } from "./tools/integration.js";
import { registerDocumentationTools } from "./tools/documentation.js";
import { TestGenerator } from "./services/test-generator.js";
import { registerTestingTools } from "./tools/testing.js";
import { registerCheckpointTools } from "./tools/checkpoint.js";
import { registerTurnkeyTools } from "./tools/turnkey.js";
import { PbtGenerator } from "./services/pbt-generator.js";
import { registerPbtTools } from "./tools/pbt.js";
import { loadConfig } from "./config.js";

// Resolve workspace root
const workspaceRoot = process.env["SDD_WORKSPACE"] || process.cwd();
console.error(`[specky] Workspace root: ${workspaceRoot}`);

// Load optional project config (.specky/config.yml)
const config = loadConfig(workspaceRoot);
if (config.templates_path) console.error(`[specky] Custom templates: ${config.templates_path}`);
if (config.audit_enabled) console.error(`[specky] Audit trail: enabled`);

// Initialize MCP server
const server = new McpServer({
  name: SERVER_NAME,
  version: VERSION,
});

// Initialize services (v1)
const fileManager = new FileManager(workspaceRoot);
const stateMachine = new StateMachine(fileManager);
const templateEngine = new TemplateEngine(fileManager);
const earsValidator = new EarsValidator();
const codebaseScanner = new CodebaseScanner(fileManager);
const transcriptParser = new TranscriptParser(fileManager);

// Initialize services (v2)
const documentConverter = new DocumentConverter(fileManager);
const diagramGenerator = new DiagramGenerator(fileManager);
const iacGenerator = new IacGenerator(fileManager);
const workItemExporter = new WorkItemExporter(fileManager);
const crossAnalyzer = new CrossAnalyzer(fileManager);
const complianceEngine = new ComplianceEngine();
const docGenerator = new DocGenerator(fileManager, stateMachine);
const gitManager = new GitManager(fileManager);
const testGenerator = new TestGenerator(fileManager);
const pbtGenerator = new PbtGenerator(fileManager);

// Register all tools (53 total)
// v1 tools
registerPipelineTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerAnalysisTools(server, fileManager, stateMachine, templateEngine);
registerUtilityTools(server, fileManager, stateMachine, templateEngine, codebaseScanner);
registerTranscriptTools(server, fileManager, stateMachine, templateEngine, earsValidator, transcriptParser);

// v2+ tools
registerInputTools(server, fileManager, documentConverter, stateMachine);
registerQualityTools(server, fileManager, stateMachine, templateEngine, complianceEngine, crossAnalyzer, earsValidator);
registerVisualizationTools(server, fileManager, stateMachine, diagramGenerator);
registerInfrastructureTools(server, fileManager, stateMachine, iacGenerator);
registerEnvironmentTools(server, fileManager, stateMachine, iacGenerator, codebaseScanner);
registerIntegrationTools(server, fileManager, stateMachine, templateEngine, gitManager, workItemExporter);
registerDocumentationTools(server, fileManager, stateMachine, docGenerator);
registerTestingTools(server, fileManager, stateMachine, testGenerator);
registerCheckpointTools(server, fileManager, stateMachine);
registerTurnkeyTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerPbtTools(server, fileManager, stateMachine, pbtGenerator);

// Graceful shutdown
let isShuttingDown = false;

function handleShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.error(`[specky] Received ${signal}, shutting down gracefully...`);
  server.close().then(() => {
    console.error("[specky] Server closed.");
    process.exit(0);
  }).catch((err: unknown) => {
    console.error("[specky] Error during shutdown:", err);
    process.exit(1);
  });
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

// Start server
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useHttp = args.includes("--http");

  if (useHttp) {
    const port = parseInt(process.env["PORT"] || String(DEFAULT_HTTP_PORT), 10);
    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );
    const http = await import("node:http");

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await server.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
      if (req.url === "/mcp") {
        await transport.handleRequest(req, res);
      } else if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version: VERSION }));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    httpServer.listen(port, () => {
      console.error(`[specky] HTTP server listening on port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[specky] Server started on stdio (v${VERSION})`);
  }
}

main().catch((err: unknown) => {
  console.error("[specky] Fatal error:", err);
  process.exit(1);
});
