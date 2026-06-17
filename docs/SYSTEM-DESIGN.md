# System Design

This document describes the target architecture for Specky as an enterprise-grade, deterministic Spec-Driven Development engine.

## Design Goals

- Local-first MCP server for SDD workflows.
- Deterministic, reproducible generated artifacts.
- Centralized enforcement for RBAC, phase rules, audit logging, and output normalization.
- Evidence-based quality gates.
- Documentation and diagrams generated in parallel with implementation.

## C4 Context

```mermaid
C4Context
  title Specky - System Context
  Person(user, "Developer or AI operator", "Uses an AI IDE to run SDD workflows")
  System(specky, "Specky", "Spec-Driven Development CLI and MCP server")
  System_Ext(mcpHost, "MCP Host", "VS Code Copilot, Claude Code, Cursor, Windsurf, or another MCP client")
  System_Ext(npm, "npm Registry", "Distributes specky-sdd package")
  System_Ext(github, "GitHub", "Repository, releases, PRs, issues, workflows")
  System_Ext(optionalMcp, "Optional external MCP servers", "GitHub, Azure, Terraform, Figma, Docker and document conversion integrations")

  Rel(user, mcpHost, "Invokes agents, prompts, and tools")
  Rel(mcpHost, specky, "Calls MCP tools over stdio or local HTTP")
  Rel(specky, github, "Produces payloads for PRs/issues and validates branch governance")
  Rel(specky, npm, "Is packaged and installed from")
  Rel(specky, optionalMcp, "Returns routing payloads for optional integrations")
```

## C4 Container

```mermaid
C4Container
  title Specky - Container View
  Person(user, "Developer or AI operator")
  System_Boundary(specky, "Specky") {
    Container(cli, "CLI", "Node.js TypeScript", "install, doctor, status, hooks, serve")
    Container(mcp, "MCP Server", "Node.js TypeScript", "Registers and executes SDD tools")
    Container(registry, "Tool Registry", "TypeScript", "Registers 57 MCP tools")
    Container(enforcement, "Tool Enforcement", "TypeScript", "RBAC, phase validation, audit, deterministic runtime")
    Container(services, "Service Layer", "TypeScript", "File, state, templates, analysis, docs, diagrams, testing")
    ContainerDb(workspace, "Workspace Files", "Markdown, JSON, source files", "Specs, docs, state, audit, generated artifacts")
  }

  Rel(user, cli, "Runs")
  Rel(user, mcp, "Calls through MCP host")
  Rel(cli, workspace, "Installs assets and validates config")
  Rel(mcp, registry, "Loads tool definitions")
  Rel(registry, enforcement, "Wraps tool handlers")
  Rel(enforcement, services, "Executes authorized handlers")
  Rel(services, workspace, "Reads and writes workspace-scoped artifacts")
```

## C4 Component

```mermaid
C4Component
  title Specky - MCP Server Components
  Container_Boundary(mcp, "MCP Server") {
    Component(wrapper, "Tool Enforcement Wrapper", "TypeScript", "Central pre/post execution policy")
    Component(rbac, "RbacEngine", "TypeScript", "Role-based tool access")
    Component(state, "StateMachine", "TypeScript", "Phase tracking, transition checks, HMAC state signature")
    Component(audit, "AuditLogger", "TypeScript", "Hash-chained audit trail")
    Component(runtime, "RuntimeContext", "TypeScript", "Clock, locale, deterministic mode")
    Component(evidence, "EvidenceGraph", "TypeScript", "Semantic gate evidence")
    Component(response, "ResponseBuilder", "TypeScript", "Normalized and enriched tool responses")
    Component(fileManager, "FileManager", "TypeScript", "Workspace-scoped I/O and atomic writes")
  }

  Rel(wrapper, rbac, "authorizes")
  Rel(wrapper, state, "validates phase")
  Rel(wrapper, audit, "logs start and result")
  Rel(wrapper, runtime, "uses deterministic context")
  Rel(wrapper, evidence, "evaluates gates")
  Rel(wrapper, response, "normalizes output")
  Rel(evidence, fileManager, "reads artifacts")
  Rel(response, state, "loads phase context")
```

## Tool Execution Sequence

```mermaid
sequenceDiagram
  participant Client as MCP Client
  participant Wrapper as Enforcement Wrapper
  participant RBAC as RbacEngine
  participant State as StateMachine
  participant Audit as AuditLogger
  participant Runtime as RuntimeContext
  participant Handler as Tool Handler
  participant Files as FileManager

  Client->>Wrapper: tool call(input)
  Wrapper->>RBAC: checkAccess(role, tool)
  RBAC-->>Wrapper: allow or deny
  Wrapper->>State: validatePhaseForTool(spec_dir, tool)
  State-->>Wrapper: allow or deny
  Wrapper->>Runtime: resolve clock and deterministic settings
  Wrapper->>Audit: log start(input hash)
  Wrapper->>Handler: execute(input, runtime)
  Handler->>Files: workspace-scoped read/write
  Files-->>Handler: artifact result
  Handler-->>Wrapper: result
  Wrapper->>Audit: log success(output hash)
  Wrapper-->>Client: normalized response
```

## Pipeline State Machine

```mermaid
stateDiagram-v2
  [*] --> Init
  Init --> Discover
  Discover --> Specify
  Specify --> Clarify
  Clarify --> Design
  Design --> Tasks
  Tasks --> Analyze
  Analyze --> Implement: gate APPROVE
  Analyze --> Tasks: CHANGES_NEEDED or BLOCK
  Implement --> Verify
  Verify --> Release
  Release --> [*]
```

## Artifact Data Flow

```mermaid
flowchart LR
  Input[Prompt, transcript, document, Figma payload] --> Spec[Specification]
  Spec --> Design[Design and architecture]
  Design --> Tasks[Tasks]
  Tasks --> Analysis[Evidence gate]
  Analysis --> Tests[Tests and PBT]
  Tests --> Verification[Verification]
  Verification --> Docs[Docs and diagrams]
  Docs --> Release[Release evidence]

  Spec -. traceability .-> Tasks
  Design -. coverage .-> Analysis
  Tests -. requirement coverage .-> Verification
  Verification -. release gate .-> Release
```

## Audit Chain

```mermaid
flowchart LR
  Seed[CHAIN_SEED] --> E1[Audit Entry 1]
  E1 --> H1[SHA-256 hash]
  H1 --> E2[Audit Entry 2]
  E2 --> H2[SHA-256 hash]
  H2 --> E3[Audit Entry 3]
```

Each entry stores the previous entry hash. A verification command or tool should detect missing, reordered, or modified entries.

## Security Boundary

The intended security boundary is the workspace root. File reads and writes should go through `FileManager`. Exceptions must be tracked as gaps until remediated.

The CLI can intentionally execute installed hook scripts through `specky hooks`; this is an explicit administrative command and should be documented separately from MCP tool execution.

## References

- [C4 model](https://c4model.com/)
- [Mermaid C4 syntax](https://mermaid.js.org/syntax/c4.html)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
