---
title: "Specky — Project Constitution"
project_id: specky-mcp-server
version: 1.1.0
date: 2026-03-20
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
last_amended: 2026-03-21
amendment_count: 1
---

# Specky — Project Constitution

> **Specky** is a standalone MCP server that makes Spec-Driven Development (SDD) fully executable in VS Code (GitHub Copilot) and Claude Code. The fun name, the serious engine.

---

## Article 1: Project Charter

### 1.1 Vision Statement

Establish spec-driven development as an accessible practice by providing a free, open-source tool that transforms natural language into production-grade specifications — giving every developer the rigor of enterprise requirement engineering without the overhead.

### 1.2 Mission Statement

Build a professional, standalone MCP server that orchestrates the full SDD pipeline — from interactive discovery through EARS-notation requirements, architecture design, task breakdown, and quality gate analysis — writing real files to disk and enforcing phase discipline.

### 1.3 Creator & Maintainer

| Field | Value |
|-------|-------|
| **Creator** | Paula Silva |
| **GitHub** | [@paulasilvatech](https://github.com/paulasilvatech) |
| **Twitter/X** | [@paulanunes85](https://twitter.com/paulanunes85) |
| **Role** | Americas Software GBB |
| **License** | MIT |

### 1.4 Success Criteria

- **SC-001:** All 14 MCP tools register and respond correctly via stdio transport
- **SC-002:** Complete pipeline (init → analyze) runs successfully in VS Code with GitHub Copilot
- **SC-003:** Complete pipeline runs successfully in Claude Code via `/sdd:spec`
- **SC-004:** State machine enforces phase order — skipping phases returns actionable errors
- **SC-005:** `npx specky` starts the server with zero configuration
- **SC-006:** All generated spec files follow EARS notation and include YAML frontmatter
- **SC-007:** Publishable to npm as `specky` (or scoped `@specky/mcp-server`)
- **SC-008:** Docker image builds and runs in HTTP mode for remote teams

### 1.5 Constraints & Assumptions

| Constraint | Detail |
|------------|--------|
| **Runtime** | Node.js >= 18 (LTS) |
| **Language** | TypeScript 5.x with strict mode |
| **MCP SDK** | `@modelcontextprotocol/sdk` latest — uses `server.registerTool()` only |
| **Transport** | stdio (primary, for VS Code/Claude), Streamable HTTP (secondary, for Docker) |
| **Dependencies** | Minimal: MCP SDK, Zod. No database, no external APIs |
| **File I/O** | Tools write directly to `.specs/` in the user's workspace |
| **State** | Persisted in `.specs/.sdd-state.json` — no in-memory-only state |
| **Encoding** | UTF-8 for all files |
| **OS** | Cross-platform: macOS, Linux, Windows |

---

## Article 2: Naming Conventions

### 2.1 npm Package

| Field | Value |
|-------|-------|
| **Package name** | `specky` |
| **Binary** | `specky` (via `bin` in package.json) |
| **Invocation** | `npx specky` or `npx -y specky` |

### 2.2 MCP Tool Naming

All tools follow the pattern: `sdd_{verb}_{noun}`

| Pattern | Example | Rationale |
|---------|---------|-----------|
| `sdd_{verb}` | `sdd_init` | Single-resource actions |
| `sdd_{verb}_{noun}` | `sdd_write_spec` | Multi-resource actions |
| `sdd_{verb}_{noun}` | `sdd_get_status` | Read-only queries |

Reserved prefixes: `sdd_` (all tools must start with this for namespace isolation).

### 2.3 Spec Artifact Naming

All specification files are UPPERCASE Markdown:

| Artifact | Filename | Phase |
|----------|----------|-------|
| Constitution | `CONSTITUTION.md` | init |
| Specification | `SPECIFICATION.md` | specify |
| Design | `DESIGN.md` | design |
| Tasks | `TASKS.md` | tasks |
| Analysis | `ANALYSIS.md` | analyze |
| Bugfix Spec | `BUGFIX_SPEC.md` | any |
| Sync Report | `SYNC_REPORT.md` | any |

### 2.4 Feature Directory Naming

Features are numbered directories inside `.specs/`:

```
.specs/
├── 001-user-authentication/
│   ├── CONSTITUTION.md
│   ├── SPECIFICATION.md
│   ├── DESIGN.md
│   ├── TASKS.md
│   └── ANALYSIS.md
├── 002-payment-integration/
│   └── ...
└── .sdd-state.json
```

Format: `NNN-kebab-case-name` where NNN is zero-padded to 3 digits.

### 2.5 Requirement ID Format

Format: `REQ-{CATEGORY}-{SEQUENCE}`

Categories for Specky itself:

| Category | Scope |
|----------|-------|
| `CORE` | Core infrastructure (server, transport, entry point) |
| `PIPE` | Pipeline tools (init through analyze) |
| `UTIL` | Utility tools (status, template, scan, amend) |
| `SVC` | Services layer (FileManager, StateMachine, etc.) |
| `INT` | Integration (agents, commands, VS Code, Claude) |
| `QUAL` | Quality (testing, Docker, documentation) |

### 2.6 Source Code Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `file-manager.ts` |
| Classes | PascalCase | `FileManager` |
| Functions | camelCase | `writeSpecFile()` |
| Constants | UPPER_SNAKE | `CHARACTER_LIMIT` |
| Interfaces | PascalCase with `I` prefix optional | `SddState` or `ISddState` |
| Enums | PascalCase | `Phase.Specify` |
| Zod schemas | camelCase + `Schema` suffix | `initInputSchema` |

---

## Article 3: Architecture Principles

### 3.1 Standalone First

Specky is an **independent project** with its own `package.json`, build step, and release cycle. It does not depend on any other MCP server or infrastructure. Any developer can `npx specky` in any project.

### 3.2 Tools Write Files

MCP tools are **not string generators**. Every `sdd_write_*` tool creates real files on disk in the user's workspace. The agent orchestrates the conversation; Specky handles file I/O and state.

### 3.3 State Machine Enforces Order

The 7-phase pipeline (init → discover → specify → clarify → design → tasks → analyze) is enforced by a state machine. Each phase requires its predecessor's output files to exist. Attempting to skip phases returns an actionable error explaining what's missing.

### 3.4 Thin Tools, Fat Services

Tools are thin wrappers that validate input (Zod), call services, and format output. Business logic lives in services: `FileManager`, `StateMachine`, `TemplateEngine`, `EarsValidator`, `CodebaseScanner`.

### 3.5 Dual-Target Integration

Every feature works in both GitHub Copilot (`.github/agents/` with `tools:` frontmatter) and Claude Code (`.claude/commands/` with `$ARGUMENTS`). Neither platform is secondary.

### 3.6 Minimal Dependencies

Only two runtime dependencies: `@modelcontextprotocol/sdk` and `zod`. No database, no external API calls, no authentication. Templates are embedded `.md` files shipped with the package.

### 3.7 Stderr for Logging

All diagnostic output goes to `stderr` (never `stdout`, which is reserved for MCP JSON-RPC over stdio). Use `console.error()` for logging.

---

## Article 4: Quality Standards

### 4.1 TypeScript Strict Mode

`tsconfig.json` must have `"strict": true`. No use of `any` type. All async functions declare `Promise<T>` return types.

### 4.2 Zod Schemas with `.strict()`

Every tool input schema uses `z.object({...}).strict()` to reject unknown properties. This prevents silent data loss from typos.

### 4.3 MCP SDK Best Practices

All tools use `server.registerTool()` (never the deprecated `server.tool()`). Every tool includes: `title`, `description`, `inputSchema`, `outputSchema`, `annotations` (with `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).

### 4.4 Error Handling

All tool handlers wrap logic in try/catch. Errors return `{ content: [{ type: "text", text: "..." }], isError: true }` with actionable messages that tell the user exactly what to fix.

### 4.5 Character Limit

Responses exceeding 25,000 characters are truncated with a clear `[TRUNCATED — use sdd_get_template for the full content]` message.

### 4.6 Factual Integrity

Documentation and README must not fabricate metrics. Feature claims must be backed by working code. Comparison tables against competitors must be accurate and sourced.

---

## Article 5: Amendment Protocol

### 5.1 How to Amend

Amendments are recorded via the `sdd_amend` tool, which appends to the changelog in CONSTITUTION.md with:

| Field | Description |
|-------|-------------|
| **Amendment #** | Sequential number |
| **Date** | ISO 8601 date |
| **Author** | Who requested the change |
| **Rationale** | Why the change was needed |
| **Articles affected** | Which articles were modified |

### 5.2 Amendment Log

| # | Date | Author | Rationale | Articles |
|---|------|--------|-----------|----------|
| — | — | — | No amendments yet | — |

---

## Article 6: Scope Boundaries

### 6.1 In Scope

- Standalone MCP server with stdio and HTTP transport
- 14 MCP tools (8 pipeline + 6 utility)
- 5 services (FileManager, StateMachine, TemplateEngine, EarsValidator, CodebaseScanner)
- 7 Markdown templates embedded in the package
- 4 GitHub Copilot agent definitions (`.github/agents/`)
- 5 Claude Code command definitions (`.claude/commands/`)
- VS Code MCP configuration example (`.vscode/mcp.json`)
- Claude Desktop configuration example
- Dockerfile and docker-compose.yml for remote deployment
- README with installation, setup, and tool reference

### 6.2 Out of Scope

- Web UI or dashboard (this is a CLI/MCP tool, not a web app)
- Database or persistent storage beyond `.sdd-state.json`
- Authentication, authorization, or multi-user support
- CI/CD pipeline integration (future version)
- Git hook automation (future version)
- IDE extension/plugin (Specky is an MCP server, not a VS Code extension)
- Language support beyond English (future version)

---

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [GitHub Spec-Kit](https://github.com/github/spec-kit) — Spec-Driven Development methodology
- [EARS Notation](https://www.iaria.org/conferences2015/filesICCGI15/EARS_Tutorial.pdf)
- [GitHub Copilot Custom Agents](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-agents)
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp)
