# Specky — Complete Build Prompt for Claude Code (Opus)

> **Copy-paste this entire file into a Claude Code session pointed at the `specky/` directory.**
> **Model: claude-opus-4** | **Estimated: ~45 min agent execution**

---

## Who You Are

You are building **Specky** — an open-source MCP server for Spec-Driven Development (SDD).
Creator: **Paula Silva** @paulasilvatech @paulanunes85 | Americas Software GBB
License: MIT | Tagline: "The fun name, the serious engine."

---

## Current Workspace State (Audited 2026-03-20)

### EXISTS and CORRECT — Do NOT recreate:
```
package.json          ✅ name:"specky", bin entry, MCP SDK + Zod deps
tsconfig.json         ✅ strict:true, ES2022, Node16
src/constants.ts      ✅ Phase enum, 14 tool names, CHARACTER_LIMIT, templates
.specs/001-specky-mcp-server/CONSTITUTION.md   ✅ complete (dir already renamed to .specs/)
.specs/001-specky-mcp-server/SPECIFICATION.md  ✅ 43 EARS requirements
.specs/001-specky-mcp-server/DESIGN.md         ✅ 6 diagrams, 5 ADRs
.specs/001-specky-mcp-server/TASKS.md          ✅ 56 tasks, 6 phases
.specs/001-specky-mcp-server/ANALYSIS.md       ✅ gate: APPROVE
.claude/commands/sdd-spec.md                   ✅ uses $ARGUMENTS, full spec workflow
.claude/commands/sdd-design.md                 ✅ uses $ARGUMENTS, design workflow
.claude/commands/sdd-tasks.md                  ✅ uses $ARGUMENTS, task breakdown workflow
.claude/commands/sdd-analyze.md                ✅ uses $ARGUMENTS, quality gate workflow
.claude/commands/sdd-bugfix.md                 ✅ uses $ARGUMENTS, bugfix spec workflow
.github/agents/spec-engineer.agent.md          ✅ tools: all 14, full pipeline orchestrator
.github/agents/design-architect.agent.md       ✅ tools: design subset (7 tools)
.github/agents/task-planner.agent.md           ✅ tools: task subset (5 tools)
.github/agents/spec-reviewer.agent.md          ✅ tools: analysis subset (7 tools)
.vscode/mcp.json.example                       ✅ npx specky config with SDD_WORKSPACE
```

### MUST FIX FIRST:
1. ~~**Rename `specs/` → `.specs/`**~~ — DONE ✅
2. **Run `npm install`** — node_modules/ does not exist yet

### MUST CREATE — 24 files (9 already created in prior session):

**Source Code (13 files):**
```
src/types.ts                    All TypeScript interfaces (SddState, Phase, FeatureInfo, etc.)
src/index.ts                    Entry point: McpServer + stdio/HTTP transport
src/schemas/common.ts           Shared Zod schemas (spec_dir, feature_number, force)
src/schemas/pipeline.ts         8 pipeline tool input schemas (.strict())
src/schemas/utility.ts          6 utility tool input schemas (.strict())
src/services/file-manager.ts    Disk I/O, path sanitization, atomic writes
src/services/state-machine.ts   Phase tracking, transitions, .sdd-state.json persistence
src/services/template-engine.ts Template rendering, {{variable}} replacement, YAML frontmatter
src/services/ears-validator.ts  6-pattern EARS validation + improvement suggestions
src/services/codebase-scanner.ts Project structure + tech stack detection
src/tools/pipeline.ts           8 pipeline tools registered via server.registerTool()
src/tools/analysis.ts           2 analysis tools (sdd_run_analysis, sdd_check_sync)
src/tools/utility.ts            4 utility tools (get_status, get_template, scan_codebase, amend)
```

**Templates (7 files):**
```
templates/constitution.md       CONSTITUTION skeleton with {{variables}}
templates/specification.md      SPECIFICATION skeleton with EARS sections
templates/design.md             DESIGN skeleton with Mermaid + ADR sections
templates/tasks.md              TASKS skeleton with gates + task table
templates/analysis.md           ANALYSIS skeleton with traceability matrix
templates/bugfix.md             BUGFIX_SPEC skeleton (5 sections)
templates/sync-report.md        SYNC_REPORT skeleton
```

**~~GitHub Copilot Agents (4 files)~~** — DONE ✅ (created with tools: frontmatter)

**~~Claude Code Commands (5 files)~~** — DONE ✅ (all use $ARGUMENTS)

**Infrastructure (3 files — .vscode/mcp.json.example already created):**
```
Dockerfile                  Multi-stage, slim Node.js, HTTP mode
docker-compose.yml          HTTP mode on port 3200
LICENSE                     MIT with Paula Silva attribution
```

**Documentation (1 file — REPLACE existing):**
```
README.md                   New README per REQ-QUAL-005 (replaces old framework README)
```

### LEGACY FILES — Keep but do NOT modify:
```
CLAUDE.md, ARCHITECTURE.md, ONBOARDING.md, SKILL.md, apm.yml
SDD_MCP_Server_Architecture_Plan_v1.0.0_2026-03-20.md
agents/     (old framework agents — keep for reference)
hooks/      (old framework hooks — keep for reference)
references/ (ears-notation.md, spec-templates.md — keep)
sdd-market-analysis-2026/ (HTML site — keep)
```

---

## Critical Architecture Rules

### MCP SDK Pattern — ONLY use `server.registerTool()`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

server.registerTool(
  "sdd_init",
  {
    title: "Initialize SDD Pipeline",
    description: "Creates .specs/ directory, writes CONSTITUTION.md, initializes state machine.",
    inputSchema: { project_name: z.string().min(1).max(100).describe("Project name in kebab-case") },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async ({ project_name }) => {
    try {
      // implementation via services
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError("sdd_init", error as Error) }], isError: true };
    }
  }
);
```

### NEVER use `server.tool()` — it is deprecated.

### All Zod schemas use `.strict()`:
```typescript
const initInputSchema = z.object({
  project_name: z.string().min(1).max(100).describe("Project name in kebab-case"),
  spec_dir: z.string().default(".specs").describe("Spec directory path"),
}).strict();
```

### All tools MUST have annotations:
```typescript
annotations: {
  readOnlyHint: boolean,    // true for read-only tools
  destructiveHint: boolean, // true only if overwrites existing data
  idempotentHint: boolean,  // true if safe to call multiple times
  openWorldHint: boolean    // false for all (no external API calls)
}
```

### Error message format:
```
[TOOL_NAME] Error: {what happened}
→ Expected: {what should exist}
→ Found: {what actually exists}
→ Fix: {what to do next}
```

### Logging: ALL to stderr (never stdout — reserved for JSON-RPC):
```typescript
console.error("[specky] Server started on stdio");
```

### TypeScript: strict mode, ZERO `any` types. Use `unknown` + type guards instead.

### Tools write files via FileManager — they are NOT string generators.

### Thin Tools, Fat Services — tools validate input → call service → format output.

### Character limit: truncate responses > 25,000 chars with notice.

---

## Build Order (Follow TASKS.md phases exactly)

### PHASE 0: Fix Workspace
```
1. Rename specs/ → .specs/
2. Run npm install
3. Verify npm run build compiles (will fail — that's expected, just confirm toolchain works)
```

### PHASE 1: Project Scaffold (T-001 → T-008)
```
T-001: package.json           → EXISTS ✅ (skip)
T-002: tsconfig.json          → EXISTS ✅ (skip)
T-003: src/constants.ts       → EXISTS ✅ (skip)
T-004: src/types.ts           → CREATE all interfaces from DESIGN.md §7
T-005: src/index.ts           → CREATE McpServer + stdio + --http flag
T-006: shebang                → Add #!/usr/bin/env node to src/index.ts top
T-007: SIGINT/SIGTERM handler → In src/index.ts
T-008: Workspace resolution   → SDD_WORKSPACE env or process.cwd()

VERIFY: npm run build succeeds with zero errors
```

### PHASE 2: Services Layer (T-009 → T-021)
```
T-009:  FileManager constructor + sanitizePath()
T-010:  FileManager.writeSpecFile() — atomic write (temp + rename)
T-011:  FileManager.readSpecFile(), listSpecFiles(), fileExists(), listFeatures()
T-012:  FileManager.scanDirectory() — recursive with depth + excludes
T-013:  StateMachine.loadState() / saveState()
T-014:  StateMachine.canTransition() + advancePhase()
T-015:  TemplateEngine.render() — load template, replace {{vars}}
T-016:  TemplateEngine.renderWithFrontmatter() — YAML frontmatter
T-017:  EarsValidator.detectPattern() — 6 EARS patterns via regex
T-018:  EarsValidator.suggestImprovement()
T-019:  CodebaseScanner.detectTechStack() — read manifests
T-020:  CodebaseScanner.scan() — tree + tech stack
T-021:  Create all 7 template files in templates/

VERIFY: npm run build succeeds
```

### PHASE 3: Pipeline Tools (T-022 → T-031)
```
T-022:  src/schemas/common.ts — shared Zod schemas
T-023:  src/schemas/pipeline.ts — 8 pipeline schemas
T-024:  Register sdd_init
T-025:  Register sdd_discover
T-026:  Register sdd_write_spec
T-027:  Register sdd_clarify
T-028:  Register sdd_write_design
T-029:  Register sdd_write_tasks
T-030:  Register sdd_run_analysis
T-031:  Register sdd_advance_phase

VERIFY: npm run build succeeds
```

### PHASE 4: Utility Tools (T-032 → T-038)
```
T-032:  src/schemas/utility.ts — 6 utility schemas
T-033:  Register sdd_get_status
T-034:  Register sdd_get_template
T-035:  Register sdd_write_bugfix
T-036:  Register sdd_check_sync
T-037:  Register sdd_scan_codebase
T-038:  Register sdd_amend

VERIFY: npm run build succeeds, all 14 tools compile
```

### PHASE 5: Integration (T-039 → T-048) — ✅ ALREADY COMPLETE
```
T-039:  .github/agents/spec-engineer.agent.md    ✅ DONE (tools: all 14)
T-040:  .github/agents/design-architect.agent.md  ✅ DONE (tools: 7)
T-041:  .github/agents/task-planner.agent.md      ✅ DONE (tools: 5)
T-042:  .github/agents/spec-reviewer.agent.md     ✅ DONE (tools: 7)
T-043:  .claude/commands/sdd-spec.md              ✅ DONE ($ARGUMENTS)
T-044:  .claude/commands/sdd-design.md            ✅ DONE ($ARGUMENTS)
T-045:  .claude/commands/sdd-tasks.md             ✅ DONE ($ARGUMENTS)
T-046:  .claude/commands/sdd-analyze.md           ✅ DONE ($ARGUMENTS)
T-047:  .claude/commands/sdd-bugfix.md            ✅ DONE ($ARGUMENTS)
T-048:  .vscode/mcp.json.example                  ✅ DONE

VERIFIED: All agents have tools: frontmatter, all commands use $ARGUMENTS
Skip this phase — go directly from Phase 4 to Phase 6.
```

### PHASE 6: Quality + Release (T-049 → T-056)
```
T-049:  README.md — REPLACE existing with new Specky MCP Server README
T-050:  Dockerfile — multi-stage Node.js build
T-051:  docker-compose.yml — HTTP mode port 3200
T-052:  LICENSE — MIT with Paula Silva
T-053:  Verify npm run build — zero errors, zero any types
T-054:  Integration test: start server, verify MCP initialize response
T-055:  Verify all 14 tools have correct annotations
T-056:  Cross-reference: every REQ has implementation

VERIFY: Full build clean, docker build succeeds
```

---

## 14 MCP Tools Reference

### Pipeline Tools (8):
| Tool | Phase | R/W | Annotations (RO/Dest/Idemp/Open) |
|------|-------|-----|-----------------------------------|
| sdd_init | setup | Write | F/F/F/F |
| sdd_discover | 0 | Read | T/F/T/F |
| sdd_write_spec | 2 | Write | F/F/F/F |
| sdd_clarify | 3 | Read | T/F/T/F |
| sdd_write_design | 4 | Write | F/F/F/F |
| sdd_write_tasks | 5 | Write | F/F/F/F |
| sdd_run_analysis | 6 | Write | F/F/F/F |
| sdd_advance_phase | any | Write | F/F/F/F |

### Utility Tools (6):
| Tool | R/W | Annotations (RO/Dest/Idemp/Open) |
|------|-----|-----------------------------------|
| sdd_get_status | Read | T/F/T/F |
| sdd_get_template | Read | T/F/T/F |
| sdd_write_bugfix | Write | F/F/F/F |
| sdd_check_sync | Read | T/F/T/F |
| sdd_scan_codebase | Read | T/F/T/F |
| sdd_amend | Write | F/F/F/F |

---

## State Machine

```
init → discover → specify → clarify → design → tasks → analyze
```

Each phase requires predecessor files. State persists in `.specs/.sdd-state.json`.

### Phase Required Files:
| Phase | Required Before Advancing |
|-------|--------------------------|
| init | CONSTITUTION.md |
| discover | (discovery completed flag in state) |
| specify | SPECIFICATION.md |
| clarify | SPECIFICATION.md |
| design | DESIGN.md |
| tasks | TASKS.md |
| analyze | ANALYSIS.md |

---

## Data Models (from DESIGN.md §7 — implement in types.ts)

```typescript
interface SddState {
  version: string;
  project_name: string;
  current_phase: Phase;
  phases: Record<Phase, PhaseStatus>;
  features: string[];
  amendments: Amendment[];
  gate_decision: GateDecision | null;
}

interface PhaseStatus {
  status: "pending" | "in_progress" | "completed";
  started_at?: string;
  completed_at?: string;
}

type Phase = "init" | "discover" | "specify" | "clarify" | "design" | "tasks" | "analyze";

interface GateDecision {
  decision: "APPROVE" | "CHANGES_NEEDED" | "BLOCK";
  reasons: string[];
  coverage_percent: number;
  gaps: string[];
  decided_at: string;
}

interface FeatureInfo {
  number: string;
  name: string;
  directory: string;
  files: string[];
}

interface EarsRequirement {
  id: string;
  pattern: EarsPatternName;
  text: string;
  acceptance_criteria: string[];
  traces_to: string[];
}

interface DirectoryTree {
  name: string;
  type: "file" | "directory";
  children?: DirectoryTree[];
}

interface CodebaseSummary {
  tree: DirectoryTree;
  tech_stack: TechStack;
  total_files: number;
  total_dirs: number;
}

interface TechStack {
  language: string;
  framework?: string;
  package_manager: string;
  runtime: string;
}

interface TransitionResult {
  allowed: boolean;
  from_phase: Phase;
  to_phase: Phase;
  missing_files?: string[];
  error_message?: string;
}

interface ValidationResult {
  valid: boolean;
  pattern: EarsPatternName;
  suggestion?: string;
  issues?: string[];
}

interface Amendment {
  number: number;
  date: string;
  author: string;
  rationale: string;
  articles_affected: string[];
}
```

---

## Service Architecture (from DESIGN.md §4)

### FileManager — All disk I/O goes through here
```
constructor(workspaceRoot: string)
sanitizePath(path: string): string          // Rejects "..", absolute paths
ensureSpecDir(specDir: string): Promise<string>
writeSpecFile(featureDir, fileName, content, force?): Promise<string>  // Atomic: temp + rename
readSpecFile(featureDir, fileName): Promise<string>
fileExists(relativePath: string): Promise<boolean>
listSpecFiles(featureDir: string): Promise<string[]>
listFeatures(specDir: string): Promise<FeatureInfo[]>
scanDirectory(dir, depth, exclude): Promise<DirectoryTree>
readProjectFile(relativePath: string): Promise<string>
```

### StateMachine — Phase enforcement
```
constructor(fileManager: FileManager)
loadState(specDir: string): Promise<SddState>
saveState(specDir, state): Promise<void>
getCurrentPhase(specDir): Promise<Phase>
canTransition(specDir, targetPhase): Promise<TransitionResult>
advancePhase(specDir, featureNumber): Promise<SddState>
recordPhaseStart(specDir, phase): Promise<void>
recordPhaseComplete(specDir, phase): Promise<void>
getRequiredFiles(phase: Phase): string[]
getPhaseOrder(): Phase[]
```

### TemplateEngine — Template rendering
```
constructor(templateDir: string)
render(templateName, context): Promise<string>
renderWithFrontmatter(templateName, context): Promise<string>
getTemplate(templateName): Promise<string>           // Returns raw template
replaceVariables(template, context): string           // {{var}} → value, unknown → [TODO: var]
generateFrontmatter(context): string                  // YAML frontmatter block
```

### EarsValidator — EARS pattern detection
```
detectPattern(requirement: string): EarsPatternName
validate(requirement: string): ValidationResult
suggestImprovement(requirement: string): { pattern: string; suggestion: string }
validateAll(requirements: EarsRequirement[]): { valid: number; invalid: number; results: ValidationResult[] }
```

### CodebaseScanner — Project structure
```
constructor(fileManager: FileManager)
scan(depth, exclude): Promise<CodebaseSummary>
detectTechStack(): Promise<TechStack>
```

---

## Tool Registration Pattern (from DESIGN.md §5)

Each tool domain exports a registration function:

```typescript
// src/tools/pipeline.ts
export function registerPipelineTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator
): void {
  server.registerTool("sdd_init", { ... }, async (input) => { ... });
  server.registerTool("sdd_discover", { ... }, async (input) => { ... });
  // ... 6 more
}

// src/tools/analysis.ts
export function registerAnalysisTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine
): void {
  server.registerTool("sdd_run_analysis", { ... }, async (input) => { ... });
  server.registerTool("sdd_check_sync", { ... }, async (input) => { ... });
}

// src/tools/utility.ts
export function registerUtilityTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  codebaseScanner: CodebaseScanner
): void {
  server.registerTool("sdd_get_status", { ... }, async (input) => { ... });
  // ... 3 more
}
```

### index.ts wires everything:
```typescript
const fileManager = new FileManager(workspaceRoot);
const stateMachine = new StateMachine(fileManager);
const templateEngine = new TemplateEngine(templateDir);
const earsValidator = new EarsValidator();
const codebaseScanner = new CodebaseScanner(fileManager);

registerPipelineTools(server, fileManager, stateMachine, templateEngine, earsValidator);
registerAnalysisTools(server, fileManager, stateMachine, templateEngine);
registerUtilityTools(server, fileManager, stateMachine, templateEngine, codebaseScanner);
```

---

## GitHub Copilot Agent Format (REQ-INT-001)

```markdown
---
name: SDD Spec Engineer
description: Full pipeline orchestrator for Spec-Driven Development
tools:
  - sdd_init
  - sdd_discover
  - sdd_write_spec
  - sdd_clarify
  - sdd_write_design
  - sdd_write_tasks
  - sdd_run_analysis
  - sdd_advance_phase
  - sdd_get_status
  - sdd_get_template
  - sdd_write_bugfix
  - sdd_check_sync
  - sdd_scan_codebase
  - sdd_amend
---

# SDD Spec Engineer

## When to use
[workflow instructions...]
```

---

## Claude Code Command Format (REQ-INT-003)

```markdown
Use $ARGUMENTS as the user's input for this SDD command.

## Workflow

1. Parse $ARGUMENTS to extract the project name or feature idea
2. Call the appropriate MCP tool(s) in sequence
3. Present results and wait for user feedback
4. If user says LGTM, proceed to next phase

## Tools Used
- sdd_init: Initialize the pipeline
- sdd_discover: Get discovery questions
- sdd_write_spec: Write specification
```

---

## Verification Checklist (run after Phase 6)

```bash
# 1. Build compiles clean
npm run build

# 2. Zero any types
grep -r ": any" src/ --include="*.ts" | grep -v "node_modules" | wc -l
# Expected: 0

# 3. Server starts and responds to MCP initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js 2>/dev/null | head -1

# 4. All 14 tools visible
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"result\"][\"tools\"])} tools registered')"

# 5. Docker builds
docker build -t specky .

# 6. sdd_init creates files
mkdir -p /tmp/specky-test && cd /tmp/specky-test
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sdd_init","arguments":{"project_name":"test-project"}}}' | SDD_WORKSPACE=/tmp/specky-test node /path/to/dist/index.js 2>/dev/null
ls -la .specs/001-test-project/

# 7. Annotations present on all tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
for t in d['result']['tools']:
    ann = t.get('annotations', {})
    has_all = all(k in ann for k in ['readOnlyHint','destructiveHint','idempotentHint','openWorldHint'])
    status = '✅' if has_all else '❌ MISSING'
    print(f\"{status} {t['name']}\")
"
```

---

## START HERE

1. Fix workspace: rename `specs/` → `.specs/`, run `npm install`
2. Read all 5 spec files in `.specs/001-specky-mcp-server/`
3. Read existing `src/constants.ts` (already correct — do not recreate)
4. Build Phase 1 → verify `npm run build`
5. Build Phase 2 → verify `npm run build`
6. Build Phase 3 → verify `npm run build`
7. Build Phase 4 → verify `npm run build`
8. Build Phase 5 (agents + commands)
9. Build Phase 6 (README, Docker, LICENSE)
10. Run verification checklist

**Everything in English. All code in TypeScript strict mode. Zero `any` types. All tools use `server.registerTool()`. Paula Silva credited as creator everywhere.**
