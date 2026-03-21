# Contributing to Specky

Thank you for your interest in contributing to Specky! This guide explains how the project is structured, how to set up your development environment, and how to submit changes.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Development Setup](#development-setup)
3. [How to Add a New Tool](#how-to-add-a-new-tool)
4. [How to Add a New Template](#how-to-add-a-new-template)
5. [How to Add a New Service](#how-to-add-a-new-service)
6. [Code Style](#code-style)
7. [Testing](#testing)
8. [Submitting a Pull Request](#submitting-a-pull-request)

---

## Project Architecture

```
src/
├── index.ts              ← Entry point: creates MCP server, wires services + tools
├── constants.ts          ← All enums, tool names, config values
├── types.ts              ← All TypeScript interfaces (zero `any`)
├── schemas/              ← Zod validation schemas for tool inputs
│   ├── common.ts         ← Shared schemas (spec_dir, feature_number, force)
│   ├── pipeline.ts       ← Schemas for 8 pipeline tools
│   ├── utility.ts        ← Schemas for 6 utility tools
│   └── transcript.ts     ← Schemas for 3 transcript tools
├── services/             ← Business logic (fat services)
│   ├── file-manager.ts   ← All disk I/O (atomic writes, path sanitization)
│   ├── state-machine.ts  ← 7-phase pipeline enforcement
│   ├── template-engine.ts← Markdown template rendering
│   ├── ears-validator.ts ← EARS pattern detection (pure, no I/O)
│   ├── codebase-scanner.ts← Tech stack detection
│   └── transcript-parser.ts← VTT/SRT/MD/TXT parsing
└── tools/                ← Thin tool handlers (validate → call service → format)
    ├── pipeline.ts       ← 8 pipeline tools
    ├── analysis.ts       ← 1 analysis tool (sdd_check_sync)
    ├── utility.ts        ← 5 utility tools
    └── transcript.ts     ← 3 transcript tools

templates/                ← Markdown templates with {{variables}}
```

### Key Principles

1. **Thin Tools, Fat Services** — Tools only validate input, call a service, and format the response. All logic lives in services.
2. **FileManager owns all I/O** — No other code reads or writes files directly.
3. **Zero `any` types** — Use `unknown` + type guards instead.
4. **All Zod schemas use `.strict()`** — No extra fields allowed.
5. **All tools have annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.
6. **Logging to stderr only** — stdout is reserved for JSON-RPC.

---

## Development Setup

```bash
# Clone
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

Example: adding `sdd_my_tool`.

### Step 1: Add the name to `constants.ts`

```typescript
export const TOOL_NAMES = {
  // ... existing tools
  MY_TOOL: "sdd_my_tool",
} as const;
```

### Step 2: Create the Zod schema

In `src/schemas/` (existing file or new one):

```typescript
export const myToolInputSchema = z.object({
  some_param: z.string().min(1).describe("What this parameter does"),
  spec_dir: specDirSchema,
}).strict();  // ← .strict() is REQUIRED
```

### Step 3: Register the tool

In `src/tools/` (existing file or new one):

```typescript
server.registerTool(
  "sdd_my_tool",
  {
    title: "Human-readable Title",
    description: "Description for the AI to understand when to use this tool.",
    inputSchema: myToolInputSchema,
    annotations: {
      readOnlyHint: true,       // true if no files are written
      destructiveHint: false,    // true if it overwrites data
      idempotentHint: true,      // true if safe to call multiple times
      openWorldHint: false,      // always false (no external API calls)
    },
  },
  async ({ some_param, spec_dir }) => {
    try {
      // Call services — never do I/O directly
      const result = await someService.doSomething(some_param);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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

If you created a new tool file, import and call its registration function in `index.ts`.

### Step 5: Update agents

Add the tool name to the relevant agent(s) in `.github/agents/` (the `tools:` frontmatter list).

---

## How to Add a New Template

1. Create `templates/my-template.md` with `{{variable}}` placeholders
2. Add the name to `TEMPLATE_NAMES` array in `constants.ts`
3. The `TemplateEngine` will automatically find it (name maps to file: `my_template` → `my-template.md`)

---

## How to Add a New Service

1. Create `src/services/my-service.ts` with a class
2. Add interfaces to `src/types.ts`
3. Instantiate in `src/index.ts` and inject into tool registration functions
4. Services that need file access must receive `FileManager` in their constructor

---

## Code Style

- **TypeScript strict mode** — no implicit any, no unused variables
- **Zero `any`** — use `unknown` and type guards
- **Errors** — format as `[TOOL_NAME] Error: {message}\n→ Fix: {action}`
- **Logging** — `console.error("[specky] message")` (never `console.log`)
- **Constants** — all magic values go in `constants.ts`

---

## Testing

```bash
# Build must pass cleanly
npm run build

# Zero any types
grep -r ": any" src/ --include="*.ts" | wc -l
# Expected: 0

# MCP handshake works
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js 2>/dev/null | head -1
# Expected: JSON with serverInfo.name = "specky"
```

---

## Submitting a Pull Request

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-tool`
3. Make your changes
4. Verify: `npm run build` passes, zero `any` types
5. Submit PR with:
   - What the change does
   - Which requirements it covers (if applicable)
   - How to test it

---

**Created by [Paula Silva](https://github.com/paulasilvatech)** | Americas Software GBB | MIT License
