# Contributing to Specky

Thank you for your interest in contributing to Specky. This guide covers the v3.2.x architecture, development patterns, and submission process.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [How to Add a New Tool](#how-to-add-a-new-tool)
4. [How to Add a New Template](#how-to-add-a-new-template)
5. [How to Add a New Service](#how-to-add-a-new-service)
6. [How to Add a New Compliance Framework](#how-to-add-a-new-compliance-framework)
7. [How to Add a New Diagram Type](#how-to-add-a-new-diagram-type)
8. [Code Style](#code-style)
9. [Tool Pattern](#tool-pattern)
10. [Testing](#testing)
11. [Pull Request Guidelines](#pull-request-guidelines)

---

## Architecture Overview

Specky v3.2.1 is an MCP server that exposes **57 tools** organized into a 10-phase Spec-Driven Development pipeline. The codebase comprises **66 source files**, **23 templates**, and is structured as follows:

```
src/
├── index.ts                  Entry point: creates MCP server, wires all services and tools
├── constants.ts              Enums, tool names, config values, type aliases
├── types.ts                  All TypeScript interfaces (zero `any`)
├── schemas/                  10 Zod validation schemas
│   ├── common.ts             Shared schemas (spec_dir, feature_number, force)
│   ├── pipeline.ts           Schemas for 8 pipeline tools
│   ├── utility.ts            Schemas for 6 utility tools
│   ├── transcript.ts         Schemas for 3 transcript tools
│   ├── input.ts              Schemas for document import and Figma conversion
│   ├── quality.ts            Schemas for checklist, compliance, cross-analysis
│   ├── visualization.ts      Schemas for diagram generation and user stories
│   ├── infrastructure.ts     Schemas for IaC generation and validation
│   ├── environment.ts        Schemas for dev environment setup
│   └── integration.ts        Schemas for Git, work items, PR, implement, research
├── services/                 26 service classes (business logic)
│   ├── file-manager.ts       All disk I/O (atomic writes, path sanitization)
│   ├── state-machine.ts      10-phase pipeline enforcement
│   ├── template-engine.ts    Markdown template rendering with {{variables}}
│   ├── ears-validator.ts     EARS pattern detection and validation (pure, no I/O)
│   ├── codebase-scanner.ts   Tech stack detection via file system analysis
│   ├── transcript-parser.ts  VTT/SRT/MD/TXT parsing and requirement extraction
│   ├── document-converter.ts PDF/DOCX/PPTX import and conversion
│   ├── diagram-generator.ts  Mermaid diagram generation (17 types) from spec artifacts
│   ├── iac-generator.ts      Terraform, Bicep, Dockerfile, devcontainer generation
│   ├── work-item-exporter.ts GitHub Issues, Azure Boards, Jira export payloads
│   ├── cross-analyzer.ts     Multi-spec cross-cutting concern analysis
│   ├── compliance-engine.ts  HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001 controls
│   ├── doc-generator.ts      Full docs, API docs, runbooks, onboarding guides
│   ├── git-manager.ts        Branch creation and PR payload generation
│   ├── methodology.ts        SDD methodology enforcement and guidance
│   ├── dependency-graph.ts   Dependency graph analysis for parallel execution
│   ├── response-builder.ts   Enriched interactive response construction
│   └── pbt-generator.ts      Property-based test generation (fast-check/hypothesis)
└── tools/                    14 tool registration files (thin handlers)
    ├── pipeline.ts           8 pipeline tools (init through advance_phase)
    ├── analysis.ts           1 analysis tool (sdd_check_sync)
    ├── utility.ts            5 utility tools (status, template, bugfix, scan, amend)
    ├── transcript.ts         3 transcript tools (import, auto-pipeline, batch)
    ├── input.ts              3 input tools (document import, batch, Figma)
    ├── quality.ts            5 quality tools (checklist, verify, compliance, cross, EARS)
    ├── visualization.ts      4 visualization tools (diagram, all diagrams, stories, Figma)
    ├── infrastructure.ts     3 infrastructure tools (IaC, validate, Dockerfile)
    ├── environment.ts        3 environment tools (local, Codespaces, devcontainer)
    ├── integration.ts        5 integration tools (branch, work items, PR, implement, research)
    ├── documentation.ts      4 documentation tools (docs, API, runbook, onboarding)
    ├── pbt.ts                1 property-based testing tool
    ├── turnkey.ts            1 turnkey specification tool
    └── checkpoint.ts         3 checkpoint/restore tools

templates/                    21 Markdown templates with {{variable}} placeholders
```

### Key Principles

1. **Thin Tools, Fat Services** -- Tools only validate input, call a service, and format the response. All logic lives in services.
2. **FileManager owns all I/O** -- No other code reads or writes files directly.
3. **Zero `any` types** -- Use `unknown` and type guards instead.
4. **All Zod schemas use `.strict()`** -- No extra fields allowed.
5. **All tools have annotations** -- `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.
6. **Logging to stderr only** -- stdout is reserved for JSON-RPC.
7. **Educative outputs** -- Every tool response includes `next_steps` and `learning_note` fields to guide the AI client.
8. **MCP-to-MCP routing** -- Integration tools produce payloads designed for forwarding to other MCP servers (GitHub, Docker, Terraform).

### Plugin Structure

The repository also ships a **Copilot plugin** with agents, skills, prompts, hooks, and the MCP server config at the repo root. Key directories:

```
specky/
├── apm.yml                      ← APM manifest (version, MCP dependency)
├── plugin.json                  ← Plugin metadata (agents, commands, skills)
├── agents/                      ← 13 agent .agent.md files
├── commands/                    ← 22 prompt .prompt.md files
├── skills/                      ← 8 SKILL.md directories
├── hooks/                       ← sdd-hooks.json + 14 shell scripts
├── instructions/                ← copilot-instructions.md
├── config.yml                   ← Pipeline configuration
├── .mcp.json                    ← MCP server config (mcpServers key)
├── install.sh                   ← Fallback installer (auto-detects APM)
├── src/                         ← MCP engine (TypeScript, published to npm)
└── package.json                 ← npm package config
```

The `plugin.json` at root is the source of truth. `.github/plugin/plugin.json` is a symlink for backward compatibility with `copilot plugin install`. Changes to agents, prompts, or skills should be made in the root directories (`agents/`, `commands/`, `skills/`).

### Service Layer

| Service | File | Purpose |
|---------|------|---------|
| FileManager | `file-manager.ts` | Atomic file writes, path resolution, directory creation, file reading |
| StateMachine | `state-machine.ts` | 10-phase pipeline enforcement with required-file gates |
| TemplateEngine | `template-engine.ts` | Load and render Markdown templates with variable substitution |
| EarsValidator | `ears-validator.ts` | Classify and validate EARS notation patterns (pure function, no I/O) |
| CodebaseScanner | `codebase-scanner.ts` | Detect tech stack, frameworks, and project structure |
| TranscriptParser | `transcript-parser.ts` | Parse VTT, SRT, MD, TXT transcripts into structured segments |
| DocumentConverter | `document-converter.ts` | Convert PDF, DOCX, PPTX files into Markdown for spec ingestion |
| DiagramGenerator | `diagram-generator.ts` | Generate Mermaid diagrams from SPECIFICATION.md and DESIGN.md |
| IacGenerator | `iac-generator.ts` | Generate Terraform, Bicep, Dockerfile, and devcontainer configs |
| WorkItemExporter | `work-item-exporter.ts` | Export tasks as GitHub Issues, Azure Boards work items, or Jira tickets |
| CrossAnalyzer | `cross-analyzer.ts` | Analyze cross-cutting concerns across multiple spec directories |
| ComplianceEngine | `compliance-engine.ts` | Check specs against HIPAA, SOC2, GDPR, PCI-DSS, ISO 27001 controls |
| DocGenerator | `doc-generator.ts` | Generate full documentation, API docs, runbooks, onboarding guides |
| GitManager | `git-manager.ts` | Generate branch names and PR payloads for MCP-to-MCP routing |
| PbtGenerator | `pbt-generator.ts` | Generate property-based tests using fast-check or Hypothesis |
| Methodology | `methodology.ts` | SDD methodology enforcement and guidance |
| DependencyGraph | `dependency-graph.ts` | Dependency graph analysis for parallel execution |
| ResponseBuilder | `response-builder.ts` | Enriched interactive response construction for all tools |

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/paulasilvatech/specky.git
cd specky

# Install dependencies
npm install

# Build
npm run build

# Development mode (auto-reload on changes)
npm run dev

# Test MCP handshake
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js 2>/dev/null
```

---

## How to Add a New Tool

Follow these steps to add a tool named `sdd_my_tool`.

### Step 1: Add the tool name to `constants.ts`

```typescript
export const TOOL_NAMES = {
  // ... existing tools
  MY_TOOL: "sdd_my_tool",
} as const;
```

### Step 2: Create the Zod schema

In `src/schemas/` (use an existing file if the tool belongs to an existing category, or create a new schema file):

```typescript
import { z } from "zod";
import { specDirSchema } from "./common.js";

export const myToolInputSchema = z.object({
  some_param: z.string().min(1).describe("What this parameter does"),
  spec_dir: specDirSchema,
}).strict();  // .strict() is REQUIRED on all schemas
```

### Step 3: Register the tool

In `src/tools/` (existing category file or new file):

```typescript
server.registerTool(
  "sdd_my_tool",
  {
    title: "Human-Readable Title",
    description: "Description for the AI client explaining when to use this tool.",
    inputSchema: myToolInputSchema,
    annotations: {
      readOnlyHint: true,       // true if no files are written
      destructiveHint: false,    // true if it overwrites existing data
      idempotentHint: true,      // true if safe to call multiple times
      openWorldHint: false,      // true only if the tool calls external APIs
    },
  },
  async ({ some_param, spec_dir }) => {
    try {
      const result = await someService.doSomething(some_param);
      const response = {
        ...result,
        next_steps: "What the AI client should do after this tool completes.",
        learning_note: "Why this step matters in the SDD pipeline.",
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `[sdd_my_tool] Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);
```

### Step 4: Wire it in `index.ts`

If you created a new tool file, import its registration function and call it in `index.ts` with the appropriate service dependencies.

### Step 5: Update agents

Add the tool name to the relevant agent(s) in `agents/` and `.github/agents/` (the `tools:` frontmatter list).

### Step 6: Verify

```bash
npm run build
# Tool should appear in the MCP tools/list response
```

---

## How to Add a New Template

1. Create `templates/my-template.md` with `{{variable}}` placeholders.
2. Add the template name to the `TEMPLATE_NAMES` array in `src/constants.ts`:
   ```typescript
   export const TEMPLATE_NAMES = [
     // ... existing templates
     "my_template",
   ] as const;
   ```
3. The `TemplateEngine` automatically maps names to files: `my_template` resolves to `templates/my-template.md`.
4. Use the template in your service or tool via `templateEngine.render("my_template", variables)`.

---

## How to Add a New Service

1. Create `src/services/my-service.ts` with a class.
2. Add interfaces and types to `src/types.ts`.
3. If the service needs file access, accept `FileManager` in the constructor. Never read or write files directly.
4. Instantiate the service in `src/index.ts` and pass it to the tool registration function(s) that need it.
5. Keep services focused on a single domain. If a service grows beyond 300 lines, consider splitting it.

Example skeleton:

```typescript
import type { FileManager } from "./file-manager.js";

export class MyService {
  constructor(private readonly fileManager: FileManager) {}

  async doSomething(param: string): Promise<MyResult> {
    // Business logic here
    // Use this.fileManager for any I/O
  }
}
```

---

## How to Add a New Compliance Framework

Compliance frameworks live in `src/services/compliance-engine.ts` as a static `FRAMEWORKS` record.

1. Add the framework type to `ComplianceFramework` in `src/constants.ts`:
   ```typescript
   export type ComplianceFramework = "hipaa" | "soc2" | "gdpr" | "pci_dss" | "iso27001" | "general" | "fedramp";
   ```

2. Add the control definitions in `src/services/compliance-engine.ts`:
   ```typescript
   fedramp: [
     {
       id: "FEDRAMP-AC1",
       name: "Access Control Policy",
       description: "Develop and enforce access control policy",
       keywords: ["access control", "policy", "authorization"],
       mandatory: true,
     },
     // ... additional controls
   ],
   ```

3. Update the `complianceCheckInputSchema` in `src/schemas/quality.ts` to include the new framework in its enum.

4. Add a `compliance.md` template section if needed, or the existing template will handle it generically.

Each control requires:
- `id`: Unique identifier (e.g., `FEDRAMP-AC1`)
- `name`: Human-readable control name
- `description`: What the control requires
- `keywords`: Array of strings the engine matches against spec content
- `mandatory`: Whether the control must pass for compliance

---

## How to Add a New Diagram Type

Diagram types are generated by `src/services/diagram-generator.ts` as Mermaid syntax.

1. Add the type to `DiagramType` in `src/constants.ts`:
   ```typescript
   export type DiagramType = "flowchart" | "sequence" | "class" | "er" | "state" | "c4_context" | "c4_container" | "gantt" | "pie" | "mindmap" | "my_new_type";
   ```

2. Add a generation method in `DiagramGenerator`:
   ```typescript
   private generateMyNewType(specContent: string, designContent: string): string {
     // Parse spec/design content and produce Mermaid syntax
     return `graph TD\n  A[Start] --> B[End]`;
   }
   ```

3. Wire it into the `generate()` dispatch method so the type string routes to your new method.

4. Update the `generateDiagramInputSchema` in `src/schemas/visualization.ts` to include the new type in its enum.

---

## Code Style

- **TypeScript strict mode** -- `strict: true` in `tsconfig.json`, no implicit any, no unused variables.
- **Zero `any`** -- Use `unknown` with type guards. The build must produce zero `any` references in source.
- **Zod `.strict()`** -- Every input schema object must call `.strict()` to reject unknown fields.
- **Error format** -- `[TOOL_NAME] Error: {message}\n-> Fix: {action}`.
- **Logging** -- `console.error("[specky] message")` only. Never use `console.log` (stdout is JSON-RPC).
- **Constants** -- All constant values, tool names, and enums go in `constants.ts`.
- **Types** -- All interfaces and type aliases go in `types.ts`. No inline type definitions in tools.
- **Imports** -- Use `type` imports for types that are only used in type position (`import type { ... }`).

---

## Tool Pattern

Every tool follows this pattern: **thin tool -> validate -> service -> format -> return with educative fields**.

```
Input (JSON from AI client)
  |
  v
Zod schema validation (.strict())
  |
  v
Service method call (all business logic)
  |
  v
Format response with educative fields:
  - result data
  - next_steps: what the AI client should do next
  - learning_note: why this step matters in the SDD pipeline
  |
  v
Return as MCP text content (JSON stringified)
```

The `next_steps` field is critical for MCP-to-MCP routing. For example, `sdd_create_branch` returns a `next_steps` field telling the AI client to call GitHub MCP's `create_branch` tool. The `sdd_export_work_items` tool returns payloads with `routing_instructions` that specify which external MCP server and tool to call.

---

## Testing

### Running Tests

```bash
# Run all unit tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

### Test Architecture

Tests live in `tests/unit/` and cover all services except `file-manager.ts` (which is the I/O boundary and tested via integration tests).

| Test File | Service | Tests |
|-----------|---------|-------|
| `ears-validator.test.ts` | EarsValidator | EARS patterns, validation, suggestImprovement, validateAll |
| `compliance-engine.test.ts` | ComplianceEngine | 6 frameworks, control matching, status classification |
| `state-machine.test.ts` | StateMachine | Phase transitions, blocking, file gates, state persistence |
| `cross-analyzer.test.ts` | CrossAnalyzer | Alignment scoring, orphaned detection, empty spec handling |
| `diagram-generator.test.ts` | DiagramGenerator | 17 diagram types, user story flows, batch generation |
| `template-engine.test.ts` | TemplateEngine | Variable replacement, frontmatter, `{{#each}}` loops |
| `codebase-scanner.test.ts` | CodebaseScanner | Tech stack detection (Node, Python, Go, Rust, Java) |

### Writing Tests

- Use `vi.fn()` mocks for `FileManager` — never do real I/O in unit tests
- Pure services (EarsValidator, ComplianceEngine) can be tested without mocks
- Test file naming: `tests/unit/<service-name>.test.ts`
- Coverage thresholds: 80% lines/functions, 70% branches (enforced in `vitest.config.ts`)

### Adding Tests for a New Service

1. Create `tests/unit/my-service.test.ts`
2. Import the service and mock FileManager if needed:
   ```typescript
   import { describe, it, expect, vi } from "vitest";
   import { MyService } from "../../src/services/my-service.js";

   const makeFileManager = () => ({
     readSpecFile: vi.fn(),
     writeSpecFile: vi.fn(),
     fileExists: vi.fn(),
   });
   ```
3. Run `npm test` to verify
4. Run `npm run test:coverage` to check coverage meets thresholds

### Pre-Submission Checklist

```bash
# All must pass before submitting a PR
npm run build          # Zero TypeScript errors
npm test               # All unit tests green
npm run test:coverage  # Coverage above thresholds
```

Manual testing approach:
- Each tool should be tested via the MCP JSON-RPC interface or through Claude Code / GitHub Copilot.
- Pipeline tools should be tested in sequence (init -> discover -> specify -> clarify -> design -> tasks -> analyze -> implement -> verify -> release).
- Confirm that `.strict()` schemas reject unexpected input fields.
- Verify that educative fields (`next_steps`, `learning_note`) are present in every tool response.

---

## Pull Request Guidelines

1. **Fork the repo** and create a feature branch: `git checkout -b feature/my-tool`.
2. **One concern per PR.** Do not mix new tools with refactors.
3. **Build must pass:** `npm run build` with zero errors, zero `any` types.
4. **Include in your PR description:**
   - What the change does and why.
   - Which tool(s), service(s), or template(s) are affected.
   - Which SDD pipeline phase(s) the change touches.
   - How to test it (MCP command or Claude Code workflow).
5. **Schema changes** require updating both the Zod schema and `types.ts`.
6. **New tools** must include annotations, educative output fields, and be added to the relevant agent frontmatter.
7. **New constants** (tool names, template names, type aliases) go in `constants.ts`, not inline.
8. **No breaking changes** to existing tool input schemas without a major version bump.

---

**Created by [Paula Silva](https://github.com/paulasilvatech)** | Americas Software GBB | MIT License
