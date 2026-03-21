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

// Resolve workspace root
const workspaceRoot = process.env["SDD_WORKSPACE"] || process.cwd();
console.error(`[specky] Workspace root: ${workspaceRoot}`);

// Initialize MCP server
const server = new McpServer({
  name: SERVER_NAME,
  version: VERSION,
});

// Initialize services
const fileManager = new FileManager(workspaceRoot);
const stateMachine = new StateMachine(fileManager);
const templateEngine = new TemplateEngine(fileManager);
const earsValidator = new EarsValidator();
const codebaseScanner = new CodebaseScanner(fileManager);
const transcriptParser = new TranscriptParser(fileManager);

// Register all tools (16 total)
registerPipelineTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerAnalysisTools(server, fileManager, stateMachine, templateEngine);
registerUtilityTools(server, fileManager, stateMachine, templateEngine, codebaseScanner);
registerTranscriptTools(server, fileManager, stateMachine, templateEngine, earsValidator, transcriptParser);

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
