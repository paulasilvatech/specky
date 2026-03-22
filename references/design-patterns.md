---
title: Software Design Patterns Reference for Architecture and Design
version: 1.0.0
date: 2026-03-21
author: Specky
description: Curated reference of software design patterns used in SDD architecture and design phases
---

# Software Design Patterns Reference

## Introduction

This reference covers the design patterns most relevant to software systems designed with the **Spec-Driven Development (SDD)** methodology. Each pattern includes intent, structure, participants, when to use, when to avoid, and a pseudocode example to anchor the DESIGN.md author.

Use this guide during the **Design phase** (`sdd_write_design`) to select appropriate patterns and justify architecture decisions in DESIGN.md.

---

## Creational Patterns

### Factory Method

**Intent:** Define an interface for creating an object, but let subclasses decide which class to instantiate.

**When to use:**
- The exact type of object to create is determined at runtime
- You want to decouple client code from concrete implementations
- You anticipate adding new product types in the future

**When to avoid:**
- There are only one or two concrete implementations that will never change
- The overhead of the abstraction outweighs the flexibility benefit

**Example:**
```typescript
interface DocumentParser {
  parse(content: string): ParsedDocument;
}

class PdfParser implements DocumentParser { ... }
class DocxParser implements DocumentParser { ... }

function createParser(mimeType: string): DocumentParser {
  if (mimeType === "application/pdf") return new PdfParser();
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return new DocxParser();
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
```

**SDD usage:** `DocumentConverter` service uses this pattern to dispatch to format-specific parsers based on file extension.

---

### Builder

**Intent:** Separate the construction of a complex object from its representation so the same construction process can create different representations.

**When to use:**
- Object construction requires many parameters or multi-step initialization
- You want immutable objects with many optional fields
- The same construction process should produce different output types

**When to avoid:**
- The object is simple with few fields
- The object is mutable and doesn't require a staged construction

**Example:**
```typescript
class ReportBuilder {
  private title = "";
  private sections: Section[] = [];

  withTitle(title: string): this { this.title = title; return this; }
  addSection(section: Section): this { this.sections.push(section); return this; }
  build(): Report { return new Report(this.title, this.sections); }
}
```

**SDD usage:** `TemplateEngine.renderWithFrontmatter()` acts as a builder — assembles YAML frontmatter + Markdown body into a final document.

---

### Singleton

**Intent:** Ensure a class has only one instance and provide a global access point to it.

**When to use:**
- Shared resource management (connection pool, configuration, logger)
- When instantiating multiple instances would be incorrect or expensive

**When to avoid:**
- Unit testing scenarios where test isolation is critical
- When state leakage between tests is a concern (prefer dependency injection)

**Example:**
```typescript
class ConfigManager {
  private static instance: ConfigManager;
  private constructor() { /* load config */ }
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) ConfigManager.instance = new ConfigManager();
    return ConfigManager.instance;
  }
}
```

---

## Structural Patterns

### Adapter

**Intent:** Convert the interface of a class into another interface clients expect. Lets classes work together that couldn't otherwise because of incompatible interfaces.

**When to use:**
- Integrating a third-party library with an incompatible interface
- Wrapping legacy code with a modern interface
- Building a unified interface over multiple external APIs

**When to avoid:**
- The external interface is stable and simple — thin wrappers add unnecessary complexity

**Example:**
```typescript
// External SDK with shape we don't control
class ExternalMcpClient {
  sendRequest(payload: unknown): Promise<unknown> { ... }
}

// Our interface
interface McpGateway {
  call(tool: string, args: Record<string, unknown>): Promise<McpResult>;
}

class McpClientAdapter implements McpGateway {
  constructor(private client: ExternalMcpClient) {}
  async call(tool: string, args: Record<string, unknown>): Promise<McpResult> {
    const raw = await this.client.sendRequest({ tool, arguments: args });
    return parseMcpResult(raw);
  }
}
```

**SDD usage:** MCP-to-MCP routing in `sdd_create_pr` / `sdd_export_work_items` wraps GitHub/Azure DevOps MCP servers through adapter-style wrappers.

---

### Facade

**Intent:** Provide a simplified interface to a complex subsystem.

**When to use:**
- You want to provide a simple interface to a complex body of code
- You want to layer your subsystem and use a facade to define entry points at each level
- Clients should be shielded from the complexity of subsystems

**When to avoid:**
- The simplified interface still exposes too much complexity
- You need fine-grained control over the subsystem that the facade would hide

**Example:**
```typescript
class SpecPipelineFacade {
  constructor(
    private fileManager: FileManager,
    private stateMachine: StateMachine,
    private templateEngine: TemplateEngine,
  ) {}

  async runFullPipeline(featureDir: string): Promise<void> {
    await this.stateMachine.advance(featureDir, "init");
    const spec = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
    const analyzed = await this.analyzeSpec(spec);
    await this.fileManager.writeSpecFile(featureDir, "ANALYSIS.md", analyzed);
    await this.stateMachine.advance(featureDir, "analyze");
  }
}
```

**SDD usage:** Each MCP tool is a facade over the service layer. `sdd_auto_pipeline` is the highest-level facade — it wraps the full 10-phase pipeline.

---

### Composite

**Intent:** Compose objects into tree structures to represent part-whole hierarchies. Lets clients treat individual objects and compositions uniformly.

**When to use:**
- You need to represent hierarchies (file trees, requirement hierarchies, task trees)
- You want clients to ignore the difference between leaf and composite objects

**Example:**
```typescript
interface Requirement {
  id: string;
  validate(): ValidationResult;
}

class LeafRequirement implements Requirement {
  validate(): ValidationResult { return earsValidator.validate(this.text); }
}

class RequirementGroup implements Requirement {
  private children: Requirement[] = [];
  add(r: Requirement): void { this.children.push(r); }
  validate(): ValidationResult {
    const results = this.children.map((c) => c.validate());
    return aggregateResults(results);
  }
}
```

---

## Behavioral Patterns

### Strategy

**Intent:** Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from clients that use it.

**When to use:**
- You need different variants of an algorithm (e.g., different export formats, different diagram types)
- You want to eliminate conditional logic that selects behavior at runtime

**When to avoid:**
- There are only 2 strategies and they rarely change
- Clients must be aware of different strategies, which complicates client code

**Example:**
```typescript
interface ExportStrategy {
  export(tasks: Task[]): string;
}

class GitHubIssuesExporter implements ExportStrategy { ... }
class AzureBoardsExporter implements ExportStrategy { ... }
class JiraExporter implements ExportStrategy { ... }

class WorkItemExporter {
  constructor(private strategy: ExportStrategy) {}
  export(tasks: Task[]): string { return this.strategy.export(tasks); }
}
```

**SDD usage:** `WorkItemExporter` uses Strategy — the `platform` parameter (`github`, `azure_boards`, `jira`) selects the export strategy at runtime.

---

### State Machine

**Intent:** Allow an object to alter its behavior when its internal state changes. The object will appear to change its class.

**When to use:**
- An object's behavior depends on its state and must change at runtime
- Operations have large, multipart conditional statements that depend on the object's state

**When to avoid:**
- The state transitions are trivial and only 2-3 states exist
- Simpler boolean flags convey the same intent more clearly

**Example:**
```typescript
type Phase = "init" | "discover" | "specify" | "design" | "tasks" | "analyze" | "implement" | "verify" | "release";

class PipelineStateMachine {
  private state: Phase = "init";
  private readonly transitions: Record<Phase, Phase[]> = {
    init: ["discover"],
    discover: ["specify"],
    specify: ["clarify", "design"],
    clarify: ["design"],
    design: ["tasks"],
    tasks: ["analyze"],
    analyze: ["implement"],
    implement: ["verify"],
    verify: ["release"],
    release: [],
  };

  advance(to: Phase): void {
    if (!this.transitions[this.state].includes(to)) {
      throw new Error(`Invalid transition: ${this.state} → ${to}`);
    }
    this.state = to;
  }
}
```

**SDD usage:** `StateMachine` service implements this pattern to enforce the 10-phase SDD pipeline. Each `sdd_advance_phase` call transitions the state machine.

---

### Observer

**Intent:** Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically.

**When to use:**
- When a change to one object requires changing others, and you don't know how many objects need to change
- An object should notify other objects without assuming who those objects are

**When to avoid:**
- The number of observers is small and fixed
- The notification order matters and must be deterministic

**Example:**
```typescript
interface PipelineObserver {
  onPhaseChange(from: Phase, to: Phase, featureDir: string): void;
}

class StateMachine {
  private observers: PipelineObserver[] = [];
  subscribe(observer: PipelineObserver): void { this.observers.push(observer); }
  private notify(from: Phase, to: Phase, featureDir: string): void {
    for (const obs of this.observers) obs.onPhaseChange(from, to, featureDir);
  }
}
```

---

### Command

**Intent:** Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations.

**When to use:**
- You want to parameterize objects with an action to perform
- You need to support undo/redo
- You need to queue operations or log them for audit

**Example:**
```typescript
interface SpecCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

class WriteSpecCommand implements SpecCommand {
  async execute(): Promise<void> { await fileManager.writeSpecFile(...); }
  async undo(): Promise<void> { await fileManager.deleteSpecFile(...); }
}
```

---

## Architectural Patterns

### Layered Architecture (N-Tier)

**Intent:** Organize code into horizontal layers where each layer has a specific role and depends only on the layer directly below it.

**Layers in Specky:**
```
┌─────────────────────────────┐
│   MCP Tools (tools/)        │  ← Input validation, output formatting
├─────────────────────────────┤
│   Services (services/)      │  ← Business logic, domain rules
├─────────────────────────────┤
│   File Manager              │  ← I/O abstraction (single point of disk access)
└─────────────────────────────┘
```

**Rules:**
- Tools MUST NOT access the filesystem directly — always via `FileManager`
- Services MUST NOT import from tools
- `FileManager` MUST NOT contain business logic

---

### Repository Pattern

**Intent:** Mediate between the domain and data mapping layers using a collection-like interface for accessing domain objects.

**When to use:**
- To abstract data access and make business logic testable without I/O
- To centralize query logic for a data source

**SDD usage:** `FileManager` is a repository for spec artifacts. All reads/writes to `.specs/` go through `FileManager`, enabling easy mocking in tests.

---

### Pipeline / Chain of Responsibility

**Intent:** Pass a request along a chain of handlers. Each handler decides either to process the request or pass it to the next handler in the chain.

**When to use:**
- Multiple handlers may process a request
- You want to decouple sender from receivers
- The set of handlers can vary dynamically

**SDD usage:** `sdd_auto_pipeline` and `sdd_batch_transcripts` implement a pipeline — each phase feeds into the next, and any phase can short-circuit on error.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **God Object** | One class/service handles everything | Split into single-responsibility services |
| **Magic Numbers** | `if (status === 4)` | Use named constants or enums |
| **Primitive Obsession** | Passing raw strings for typed values (phase names, feature numbers) | Define types or value objects |
| **Shotgun Surgery** | One change requires modifying many files | Group related behavior using cohesion |
| **Feature Envy** | Method uses data from another class more than its own | Move method to the class whose data it uses |
| **Leaky Abstractions** | Implementation details bleed through the API | Strengthen interface boundaries |
| **Tight Coupling via New** | `new ConcreteService()` inside another service | Inject dependencies via constructor |

---

## Pattern Selection Guide

Use this table during the Design phase to select patterns for your DESIGN.md:

| Scenario | Recommended Pattern |
|---|---|
| Multiple output formats for the same data | Strategy |
| Complex multi-step object creation | Builder |
| Wrapping an incompatible external API | Adapter |
| Simplifying a complex subsystem | Facade |
| State-dependent behavior with transitions | State Machine |
| Hierarchical data structures | Composite |
| Pluggable algorithms | Strategy |
| Cross-cutting notifications | Observer |
| Undo/redo, queued operations | Command |
| Data access abstraction | Repository |
| Sequential processing with early exit | Pipeline |

---

## References

- Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
- Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley.
- [Refactoring Guru — Design Patterns](https://refactoring.guru/design-patterns) (comprehensive examples in TypeScript)
- [Microsoft — Cloud Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/)
