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
import { AuditLogger } from "./services/audit-logger.js";
import { MetricsGenerator } from "./services/metrics-generator.js";
import { registerMetricsTools } from "./tools/metrics.js";
import { ModelRoutingEngine } from "./services/model-routing-engine.js";
import { registerRoutingTools } from "./tools/routing.js";
import { ContextTieringEngine } from "./services/context-tiering-engine.js";
import { registerContextTools } from "./tools/context.js";
import { CognitiveDebtEngine } from "./services/cognitive-debt-engine.js";
import { IntentDriftEngine } from "./services/intent-drift-engine.js";
import { TestResultParser } from "./services/test-result-parser.js";
import { TestTraceabilityMapper } from "./services/test-traceability-mapper.js";
import { RateLimiter } from "./services/rate-limiter.js";
import { RbacEngine } from "./services/rbac-engine.js";
import { registerRbacTools } from "./tools/rbac.js";

// Resolve workspace root
const workspaceRoot = process.env["SDD_WORKSPACE"] || process.cwd();
console.error(`[specky] Workspace root: ${workspaceRoot}`);

// Load optional project config (.specky/config.yml)
const config = loadConfig(workspaceRoot);
if (config.templates_path) console.error(`[specky] Custom templates: ${config.templates_path}`);
if (config.audit_enabled) console.error(`[specky] Audit trail: enabled`);

// Initialize MCP server
const server = new McpServer(
  {
    name: SERVER_NAME,
    version: VERSION,
    title: "Specky",
    description: "Agentic Spec-Driven Development plugin — 13 agents, 57 MCP tools, 10-phase enforced pipeline, EARS notation, 22 prompts, 8 skills, 14 hooks.",
    websiteUrl: "https://getspecky.ai",
    icons: [
      {
        src: "https://raw.githubusercontent.com/paulasilvatech/specky/main/media/specky-brand-icon.svg",
        mimeType: "image/svg+xml",
      },
      {
        src: "https://raw.githubusercontent.com/paulasilvatech/specky/main/media/specky-icon-128.png",
        mimeType: "image/png",
        sizes: ["128x128"],
      },
    ],
  },
  {
    instructions: "Specky is a Spec-Driven Development engine. Start with sdd_init to create a project, then follow the 10-phase pipeline: Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release. Use sdd_get_status to check current phase. Reply LGTM at quality gates to advance.",
  },
);

// Initialize services (v1)
const fileManager = new FileManager(workspaceRoot);
const stateMachine = new StateMachine(fileManager, workspaceRoot);
const templateEngine = new TemplateEngine(fileManager, config.templates_path || undefined);
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
const auditLogger = new AuditLogger(
  workspaceRoot,
  config.audit_enabled,
  config.audit.export_format,
  config.audit.max_file_size_mb,
);
const rbacEngine = new RbacEngine(
  config.rbac.enabled ?? false,
  config.rbac.default_role ?? "contributor",
);
const metricsGenerator = new MetricsGenerator(fileManager);
const modelRoutingEngine = new ModelRoutingEngine();
const contextTieringEngine = new ContextTieringEngine();
const cognitiveDebtEngine = new CognitiveDebtEngine();
const intentDriftEngine = new IntentDriftEngine();
const testResultParser = new TestResultParser();
const testTraceabilityMapper = new TestTraceabilityMapper();

// Register all tools (57 total)
// v1 tools
registerPipelineTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerAnalysisTools(server, fileManager, stateMachine, templateEngine, intentDriftEngine);
registerUtilityTools(server, fileManager, stateMachine, templateEngine, codebaseScanner, intentDriftEngine);
registerTranscriptTools(server, fileManager, stateMachine, templateEngine, earsValidator, transcriptParser);

// v2+ tools
registerInputTools(server, fileManager, documentConverter, stateMachine);
registerQualityTools(server, fileManager, stateMachine, templateEngine, complianceEngine, crossAnalyzer, earsValidator);
registerVisualizationTools(server, fileManager, stateMachine, diagramGenerator);
registerInfrastructureTools(server, fileManager, stateMachine, iacGenerator);
registerEnvironmentTools(server, fileManager, stateMachine, iacGenerator, codebaseScanner);
registerIntegrationTools(server, fileManager, stateMachine, templateEngine, gitManager, workItemExporter);
registerDocumentationTools(server, fileManager, stateMachine, docGenerator);
registerTestingTools(server, fileManager, stateMachine, testGenerator, testResultParser, testTraceabilityMapper);
registerCheckpointTools(server, fileManager, stateMachine);
registerTurnkeyTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerPbtTools(server, fileManager, stateMachine, pbtGenerator);
registerMetricsTools(server, fileManager, stateMachine, metricsGenerator, cognitiveDebtEngine, intentDriftEngine);
registerRoutingTools(server, modelRoutingEngine);
registerContextTools(server, fileManager, stateMachine, contextTieringEngine);
registerRbacTools(server, rbacEngine);

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

    // Rate limiter — only active in HTTP mode when enabled in config
    const rateLimiter = config.rate_limit.enabled
      ? new RateLimiter(
          config.rate_limit.max_requests_per_minute ?? 60,
          config.rate_limit.burst ?? 10,
        )
      : null;

    if (rateLimiter) {
      console.error(
        `[specky] Rate limiting enabled: ${config.rate_limit.max_requests_per_minute} rpm, burst ${config.rate_limit.burst}`,
      );
    }

    const httpServer = http.createServer(async (req, res) => {
      if (req.url === "/mcp") {
        // Apply rate limiting before forwarding to MCP handler
        if (rateLimiter) {
          const clientId = req.socket.remoteAddress ?? "unknown";
          const check = rateLimiter.checkRateLimit(clientId);
          if (!check.allowed) {
            const retryAfterSec = Math.ceil((check.retry_after_ms ?? 1000) / 1000);
            res.writeHead(429, {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSec),
            });
            res.end(
              JSON.stringify({
                error: "Too Many Requests",
                retry_after_ms: check.retry_after_ms,
              }),
            );
            return;
          }
        }
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
