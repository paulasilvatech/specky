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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { AuditLogger, resolveAuditHmacKey } from "./services/audit-logger.js";
import { loadTokenTable, resolveBearerIdentity, sha256Hex, type TokenTableEntry } from "./utils/token-table.js";
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
import { installToolEnforcement } from "./tools/tool-enforcement.js";
import { registerAuditTools } from "./tools/audit.js";

// Resolve workspace root
const workspaceRoot = process.env["SDD_WORKSPACE"] || process.cwd();
console.error(`[specky] Workspace root: ${workspaceRoot}`);

// Version-drift advisory: if the workspace's installed assets were written by
// a different Specky version, nudge toward `specky upgrade`. This is a local
// file comparison — zero network, stderr only (stdout is the MCP protocol
// channel), and it must never block server startup.
try {
  const installJsonPath = join(workspaceRoot, ".specky", "install.json");
  if (existsSync(installJsonPath)) {
    const installMeta = JSON.parse(readFileSync(installJsonPath, "utf8")) as { version?: unknown };
    if (typeof installMeta.version === "string" && installMeta.version !== VERSION) {
      console.error(
        `[specky] Installed assets are v${installMeta.version} but this server is v${VERSION} — run \`specky upgrade\` to refresh.`,
      );
    }
  }
} catch {
  // Absent or unreadable install.json is fine — no advisory.
}

// Load optional project config (.specky/config.yml). The profile may be
// forced from outside the workspace: --profile=enterprise flag, SPECKY_PROFILE
// env, or SPECKY_ENTERPRISE=1 shorthand.
const config = loadConfig(workspaceRoot);
const auditHmacKey = resolveAuditHmacKey();
if (config.templates_path) console.error(`[specky] Custom templates: ${config.templates_path}`);
if (config.profile === "enterprise") {
  console.error(
    `[specky] Profile: enterprise — audit=${config.audit_enabled ? "on" : "off"}` +
    ` (fail_closed=${config.audit.fail_closed ? "on" : "off"}, hmac=${auditHmacKey ? "on" : "off"})` +
    `, rbac=${config.rbac.enabled ? "on" : "off"} (default_role=${config.rbac.default_role})` +
    `, rate_limit=${config.rate_limit.enabled ? "on" : "off"}`,
  );
  if (config.audit_enabled && !auditHmacKey) {
    console.error(
      "[specky] WARNING: enterprise audit is hash-chained but NOT tamper-evident — " +
      "set SDD_AUDIT_HMAC_KEY or SDD_AUDIT_HMAC_KEY_FILE (key stored outside the workspace) to sign entries.",
    );
  }
} else if (config.audit_enabled) {
  console.error(`[specky] Audit trail: enabled${auditHmacKey ? " (HMAC-signed)" : ""}`);
}

// Initialize MCP server
const server = new McpServer(
  {
    name: SERVER_NAME,
    version: VERSION,
    title: "Specky",
    description: "Agentic Spec-Driven Development plugin — 13 agents, 58 MCP tools, 10-phase enforced pipeline, EARS notation, 22 prompts, 8 skills, 16 hooks.",
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
const auditLogger = new AuditLogger(workspaceRoot, config.audit_enabled, {
  exportFormat: config.audit.export_format,
  maxFileSizeMb: config.audit.max_file_size_mb,
  hmacKey: auditHmacKey,
  failClosed: config.audit.fail_closed,
});
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

installToolEnforcement(server, {
  auditLogger,
  rbacEngine,
  stateMachine,
});

// Register all tools (58 total)
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
registerAuditTools(server, auditLogger);

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

    // Bind to loopback by default. The HTTP transport has no authentication,
    // so exposing it on all interfaces is opt-in and must be explicit.
    const hostArg = args.find((a) => a.startsWith("--host="))?.slice("--host=".length);
    const host = hostArg || process.env["SDD_HTTP_HOST"] || "127.0.0.1";
    const isLoopback = host === "127.0.0.1" || host === "::1" || host === "localhost";

    // Optional bearer-token auth, two flavors:
    //   - SDD_HTTP_TOKEN: one shared token (no identity — RBAC falls back to
    //     SDD_ROLE / default_role).
    //   - SDD_HTTP_TOKENS_FILE: named tokens mapping to principal + role
    //     (identity-based RBAC). Fail-closed: a broken tokens file aborts startup.
    const authToken = process.env["SDD_HTTP_TOKEN"] || "";
    const tokensFile = process.env["SDD_HTTP_TOKENS_FILE"] || "";
    let tokenTable: TokenTableEntry[] = [];
    if (tokensFile) {
      try {
        tokenTable = loadTokenTable(tokensFile);
        console.error(
          `[specky] HTTP token table loaded: ${tokenTable.length} principal(s) from ${tokensFile}`,
        );
      } catch (err) {
        console.error(`[specky] FATAL: ${(err as Error).message}`);
        process.exit(1);
      }
    } else if (authToken) {
      console.error("[specky] HTTP bearer-token authentication enabled (shared token).");
    }
    const requireAuth = tokenTable.length > 0 || authToken.length > 0;
    if (!isLoopback && !requireAuth) {
      console.error(
        `[specky] WARNING: HTTP transport bound to non-loopback host "${host}" WITHOUT authentication. ` +
        "Set SDD_HTTP_TOKEN or SDD_HTTP_TOKENS_FILE and put it behind a TLS-terminating reverse proxy, or bind to 127.0.0.1.",
      );
    }
    if (config.profile === "enterprise" && config.rbac.enabled && tokenTable.length === 0) {
      console.error(
        "[specky] NOTE: RBAC is on but no SDD_HTTP_TOKENS_FILE is configured — roles come from " +
        "SDD_ROLE/default_role (self-asserted). Configure a token table for identity-based roles.",
      );
    }

    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );
    const http = await import("node:http");

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      // Reject cross-origin / rebinding requests: a browser page cannot POST to
      // the local server unless its Host header matches an allowed value.
      enableDnsRebindingProtection: true,
      allowedHosts: [`${host}:${port}`, `localhost:${port}`, `127.0.0.1:${port}`],
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
        // Authenticate before doing any work.
        const identity = resolveBearerIdentity(
          req.headers["authorization"],
          tokenTable,
          authToken,
        );
        if (!identity.authorized) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer",
          });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        // Attach the authenticated identity so the transport propagates it to
        // tool handlers as extra.authInfo (consumed by the RBAC enforcement
        // wrapper). `token` carries a fingerprint, never the secret itself.
        if (identity.principal) {
          (req as typeof req & { auth?: unknown }).auth = {
            token: sha256Hex(req.headers["authorization"] ?? ""),
            clientId: identity.principal,
            scopes: identity.role ? [`role:${identity.role}`] : [],
            extra: { principal: identity.principal, role: identity.role },
          };
        }
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

    httpServer.listen(port, host, () => {
      console.error(`[specky] HTTP server listening on ${host}:${port}`);
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
