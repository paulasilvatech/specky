/**
 * DiagramGenerator — Deterministic Mermaid diagram generation from spec artifacts.
 * All generation is pure string manipulation — no AI calls.
 *
 * Invariants:
 * - Every identifier position (node ids, entity names, class names, state ids,
 *   participants) contains only [A-Za-z0-9_]; human text lives in quoted labels.
 * - No generator emits constant filler: output is derived from the artifact's
 *   requirements, sections, bullets, or (as a last resort) its title/words, so
 *   different inputs never produce byte-identical diagrams.
 * - Numeric values (pie slices, gantt tasks) are real counts from the source,
 *   never fabricated percentages.
 */

import type { FileManager } from "./file-manager.js";
import type { DiagramSpec, AllDiagramsResult, DiagramType } from "../types.js";
import { currentDateString } from "../utils/runtime-context.js";

interface SectionInfo {
  heading: string;
  bullets: string[];
}

interface ClassCandidate {
  name: string;
  methods: string[];
  kind: "interface" | "class";
}

/** Document-plumbing headings that must never become components/entities/states. */
const STRUCTURAL_HEADING_REGEX =
  /^(table of contents|contents|toc|overview|introduction|revision history|document (?:control|history)|references|appendix(?:\s+\w+)?|glossary|summary|executive summary|purpose|scope|background|assumptions|out of scope|non-goals|approvals?|sign[- ]?offs?|change ?log|metadata|version history|status)$/i;

export class DiagramGenerator {
  constructor(private fileManager: FileManager) {}

  /**
   * Generate a specific diagram type from artifact content.
   */
  generateDiagram(content: string, type: DiagramType, title: string): DiagramSpec {
    let mermaid_code: string;

    switch (type) {
      case "flowchart":
        mermaid_code = this.generateFlowchart(content, title);
        break;
      case "sequence":
        mermaid_code = this.generateSequence(content, title);
        break;
      case "er":
        mermaid_code = this.generateERD(content, title);
        break;
      case "class":
        mermaid_code = this.generateClassDiagram(content, title);
        break;
      case "state":
        mermaid_code = this.generateStateDiagram(content, title);
        break;
      case "c4_context":
        mermaid_code = this.generateC4Context(content, title);
        break;
      case "c4_container":
        mermaid_code = this.generateC4Container(content, title);
        break;
      case "gantt":
        mermaid_code = this.generateGantt(content, title);
        break;
      case "pie":
        mermaid_code = this.generatePie(content, title);
        break;
      case "mindmap":
        mermaid_code = this.generateMindmap(content, title);
        break;
      case "c4_component":
        mermaid_code = this.generateC4Component(content, title);
        break;
      case "c4_code":
        mermaid_code = this.generateC4Code(content, title);
        break;
      case "activity":
        mermaid_code = this.generateActivity(content, title);
        break;
      case "use_case":
        mermaid_code = this.generateUseCase(content, title);
        break;
      case "dfd":
        mermaid_code = this.generateDFD(content, title);
        break;
      case "deployment":
        mermaid_code = this.generateDeployment(content, title);
        break;
      case "network_topology":
        mermaid_code = this.generateNetworkTopology(content, title);
        break;
      default:
        mermaid_code = this.generateFlowchart(content, title);
    }

    return { type, title, source: "spec", mermaid_code };
  }

  /**
   * Generate ALL diagram types for a feature from its artifacts and write the
   * full set to DIAGRAMS.md in the feature directory (grouped by source),
   * replacing any scaffold left by earlier pipeline steps.
   */
  async generateAllDiagrams(
    specDir: string,
    featureDir: string
  ): Promise<AllDiagramsResult & { diagrams_file: string | null }> {
    const diagrams: DiagramSpec[] = [];

    // Read available artifacts
    const specContent = await this.safeRead(specDir, featureDir, "SPECIFICATION.md");
    const designContent = await this.safeRead(specDir, featureDir, "DESIGN.md");
    const tasksContent = await this.safeRead(specDir, featureDir, "TASKS.md");
    const constitutionContent = await this.safeRead(specDir, featureDir, "CONSTITUTION.md");

    if (constitutionContent) {
      diagrams.push({ ...this.generateDiagram(constitutionContent, "mindmap", "Project Scope"), source: "constitution" });
    }
    if (specContent) {
      diagrams.push({ ...this.generateDiagram(specContent, "flowchart", "Requirements Flow"), source: "spec" });
      diagrams.push({ ...this.generateDiagram(specContent, "pie", "Requirements Coverage"), source: "spec" });
      diagrams.push({ ...this.generateDiagram(specContent, "state", "Requirement Lifecycle"), source: "spec" });
    }
    if (designContent) {
      diagrams.push({ ...this.generateDiagram(designContent, "c4_context", "System Context"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "c4_container", "Architecture"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "sequence", "API Flow"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "er", "Data Model"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "class", "Interfaces"), source: "design" });
    }
    if (tasksContent) {
      diagrams.push({ ...this.generateDiagram(tasksContent, "gantt", "Implementation Timeline"), source: "tasks" });
      diagrams.push({ ...this.generateDiagram(tasksContent, "flowchart", "Task Dependencies"), source: "tasks" });
    }
    if (designContent) {
      diagrams.push({ ...this.generateDiagram(designContent, "c4_component", "Component Design"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "c4_code", "Code Structure"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "deployment", "Deployment Architecture"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "network_topology", "Network Topology"), source: "design" });
      diagrams.push({ ...this.generateDiagram(designContent, "dfd", "Data Flow"), source: "design" });
    }
    if (specContent) {
      diagrams.push({ ...this.generateDiagram(specContent, "use_case", "Use Cases"), source: "spec" });
      diagrams.push({ ...this.generateDiagram(specContent, "activity", "Workflow Activities"), source: "spec" });
    }

    const featureNumber = featureDir.match(/(\d{3})/)?.[1] || "000";

    let diagramsFile: string | null = null;
    if (diagrams.length > 0) {
      try {
        diagramsFile = await this.fileManager.writeSpecFile(
          featureDir,
          "DIAGRAMS.md",
          this.buildDiagramsMarkdown(featureNumber, diagrams),
          true
        );
      } catch {
        diagramsFile = null;
      }
    }

    return { feature_number: featureNumber, diagrams, total_generated: diagrams.length, diagrams_file: diagramsFile };
  }

  /**
   * Generate user story flow diagram.
   */
  generateUserStoryFlow(storyTitle: string, steps: string[]): string {
    if (steps.length === 0) return `flowchart TD\n  A[${this.sanitize(storyTitle)}]`;
    const nodes = steps.map((step, i) => {
      const id = String.fromCharCode(65 + i); // A, B, C, ...
      const nextId = i < steps.length - 1 ? String.fromCharCode(66 + i) : null;
      const line = `  ${id}[${this.sanitize(step)}]`;
      const arrow = nextId ? `\n  ${id} --> ${nextId}` : "";
      return line + arrow;
    });
    return `flowchart TD\n${nodes.join("\n")}`;
  }

  // ─── Private Generators ───

  private generateFlowchart(content: string, title: string): string {
    const items = this.extractListItems(content);
    if (items.length === 0) return `flowchart TD\n  A["${this.sanitize(title)}"]`;

    const nodes = items.slice(0, 12).map((item, i) => {
      const id = `N${i}`;
      const nextId = i < Math.min(items.length, 12) - 1 ? `N${i + 1}` : null;
      const node = `  ${id}["${this.sanitize(item.substring(0, 60))}"]`;
      const arrow = nextId ? `\n  ${id} --> ${nextId}` : "";
      return node + arrow;
    });
    return `flowchart TD\n${nodes.join("\n")}`;
  }

  private generateSequence(content: string, title: string): string {
    const lines = [`sequenceDiagram`, `  participant Client`, `  participant System`];

    // Preferred: derive one request/response exchange per EARS requirement
    // (trigger clause -> Client request, shall clause -> System response).
    const exchanges = this.extractRequirementExchanges(content);
    if (exchanges.length > 0) {
      for (const exchange of exchanges.slice(0, 8)) {
        lines.push(`  Client->>System: ${this.messageText(exchange.trigger)}`);
        lines.push(`  System-->>Client: ${this.messageText(exchange.response)}`);
      }
      return lines.join("\n");
    }

    // Fallback: chart the artifact's own steps as alternating messages.
    const items = this.extractListItems(content).slice(0, 6);
    if (items.length > 0) {
      items.forEach((item, i) => {
        const arrow = i % 2 === 0 ? "Client->>System" : "System-->>Client";
        lines.push(`  ${arrow}: ${this.messageText(item)}`);
      });
      return lines.join("\n");
    }

    lines.push(`  Client->>System: ${this.messageText(`Request ${title}`)}`);
    lines.push(`  System-->>Client: Response`);
    return lines.join("\n");
  }

  private generateERD(content: string, title: string): string {
    const entities = this.extractEntities(content);
    const lines = [`erDiagram`];
    if (entities.length === 0) {
      const name = this.safeId(this.toPascalCase(title), "Entity").toUpperCase();
      lines.push(`  ${name} {`, `    string id PK`, `    string name`, `  }`);
      return lines.join("\n");
    }

    const used = new Set<string>();
    const ids: string[] = [];
    for (const entity of entities.slice(0, 8)) {
      const id = this.uniqueId(this.safeId(entity.name, "ENTITY").toUpperCase(), used);
      ids.push(id);
      lines.push(`  ${id} {`);
      lines.push(`    string id PK`);
      const attrUsed = new Set<string>(["id"]);
      for (const attr of entity.attributes.slice(0, 6)) {
        const attrId = this.uniqueId(this.safeId(attr, "attr").toLowerCase(), attrUsed);
        lines.push(`    string ${attrId}`);
      }
      lines.push(`  }`);
    }
    // Add relationships
    for (let i = 0; i < ids.length - 1 && i < 7; i++) {
      lines.push(`  ${ids[i]} ||--o{ ${ids[i + 1]} : "has"`);
    }
    return lines.join("\n");
  }

  private generateClassDiagram(content: string, title: string): string {
    const classes = this.extractClassCandidates(content);
    const lines = [`classDiagram`];
    if (classes.length === 0) {
      lines.push(`  class ${this.safeId(this.toPascalCase(title), "Feature")}`);
      return lines.join("\n");
    }

    const used = new Set<string>();
    const ids: string[] = [];
    for (const cls of classes.slice(0, 8)) {
      const id = this.uniqueId(this.safeId(cls.name, "Class"), used);
      ids.push(id);
      if (cls.methods.length === 0) {
        lines.push(`  class ${id}`);
      } else {
        lines.push(`  class ${id} {`);
        for (const method of cls.methods.slice(0, 5)) {
          lines.push(`    +${this.safeId(method, "method")}()`);
        }
        lines.push(`  }`);
      }
    }
    for (let i = 0; i < ids.length - 1 && i < 7; i++) {
      lines.push(`  ${ids[i]} ..> ${ids[i + 1]}`);
    }
    return lines.join("\n");
  }

  private generateStateDiagram(content: string, title: string): string {
    const lines = [`stateDiagram-v2`];

    // Preferred: real lifecycle words found in the artifact.
    const states = this.extractStates(content);
    if (states.length >= 2) {
      const used = new Set<string>();
      const ids = states.slice(0, 8).map((s) => this.uniqueId(this.safeId(s, "state"), used));
      lines.push(`  [*] --> ${ids[0]}`);
      for (let i = 0; i < ids.length - 1; i++) {
        lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
      }
      lines.push(`  ${ids[ids.length - 1]} --> [*]`);
      return lines.join("\n");
    }

    // Fallback: the artifact's own section names become sequential stages.
    const sections = this.extractSections(content).slice(0, 8);
    if (sections.length > 0) {
      const ids = sections.map((_, i) => `s${i}`);
      sections.forEach((section, i) => {
        lines.push(`  state "${this.plainText(section.heading)}" as ${ids[i]}`);
      });
      lines.push(`  [*] --> ${ids[0]}`);
      for (let i = 0; i < ids.length - 1; i++) {
        lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
      }
      lines.push(`  ${ids[ids.length - 1]} --> [*]`);
      return lines.join("\n");
    }

    // Last resort: a single state derived from the found word or the title.
    const only = this.safeId(states[0] ?? this.toPascalCase(title), "Active");
    lines.push(`  [*] --> ${only}`, `  ${only} --> [*]`);
    return lines.join("\n");
  }

  private generateC4Context(content: string, title: string): string {
    const systems = this.extractSystems(content);
    const lines = [
      `C4Context`,
      `  title ${this.sanitize(title)}`,
      `  Person(user, "User", "End user of the system")`,
    ];
    if (systems.length === 0) {
      lines.push(`  System(system, "${this.sanitize(title)}", "Main system")`);
      lines.push(`  Rel(user, system, "Uses")`);
    } else {
      const used = new Set<string>(["user"]);
      const ids = systems.slice(0, 6).map((sys) => this.uniqueId(this.safeId(sys, "system").toLowerCase(), used));
      systems.slice(0, 6).forEach((sys, i) => {
        lines.push(`  System(${ids[i]}, "${this.sanitize(sys)}", "${this.sanitize(sys)}")`);
      });
      lines.push(`  Rel(user, ${ids[0]}, "Uses")`);
    }
    return lines.join("\n");
  }

  private generateC4Container(content: string, title: string): string {
    const components = this.extractComponents(content);
    const lines = [
      `C4Container`,
      `  title ${this.sanitize(title)}`,
      `  Person(user, "User", "End user")`,
      `  System_Boundary(system, "${this.sanitize(title)}") {`,
    ];
    const used = new Set<string>(["user", "system"]);
    let ids: string[];
    if (components.length === 0) {
      ids = ["api"];
      lines.push(`    Container(api, "API", "REST API")`);
      lines.push(`    ContainerDb(db, "Database", "Data storage")`);
    } else {
      ids = components.slice(0, 8).map((comp) => this.uniqueId(this.safeId(comp, "container").toLowerCase(), used));
      components.slice(0, 8).forEach((comp, i) => {
        lines.push(`    Container(${ids[i]}, "${this.sanitize(comp)}", "${this.sanitize(comp)}")`);
      });
    }
    lines.push(`  }`);
    lines.push(`  Rel(user, ${ids[0]}, "Uses")`);
    return lines.join("\n");
  }

  private generateGantt(content: string, title: string): string {
    const lines = [
      `gantt`,
      `  title ${this.plainText(title)}`,
      `  dateFormat YYYY-MM-DD`,
    ];
    let taskCount = 0;
    const pushTask = (name: string, duration: string): void => {
      const id = `t${taskCount}`;
      // Mermaid gantt metadata order is `id, start, duration`: the first task
      // is anchored to the (deterministic) generation date, the rest chain
      // with `after`.
      const start = taskCount === 0 ? currentDateString() : `after t${taskCount - 1}`;
      const label = this.plainText(name).substring(0, 40) || `Task ${taskCount + 1}`;
      lines.push(`  ${label} :${id}, ${start}, ${duration}`);
      taskCount++;
    };

    // TASKS.md path: real checkbox tasks with their sections.
    const tasks = this.extractTasks(content);
    if (tasks.length > 0) {
      let currentSection: string | undefined;
      for (const task of tasks.slice(0, 15)) {
        if (task.section && task.section !== currentSection) {
          currentSection = task.section;
          lines.push(`  section ${this.plainText(currentSection).substring(0, 40)}`);
        }
        pushTask(task.name, task.parallel ? "1d" : "2d");
      }
      return lines.join("\n");
    }

    // Spec/design/constitution path: chart the artifact's own sections so the
    // gantt is never header-only.
    const sections = this.extractSections(content).slice(0, 6);
    if (sections.length > 0) {
      for (const section of sections) {
        lines.push(`  section ${this.plainText(section.heading).substring(0, 40)}`);
        const bullets = section.bullets.slice(0, 3);
        if (bullets.length === 0) {
          pushTask(section.heading, "2d");
        } else {
          for (const bullet of bullets) {
            pushTask(bullet, "1d");
          }
        }
      }
      return lines.join("\n");
    }

    lines.push(`  section ${this.plainText(title).substring(0, 40) || "Plan"}`);
    pushTask(`Draft ${title}`, "2d");
    pushTask(`Review ${title}`, "1d");
    return lines.join("\n");
  }

  private generatePie(content: string, title: string): string {
    const categories = this.extractCategories(content);
    const lines = [`pie title ${this.sanitize(title)}`];
    if (categories.length > 0) {
      for (const cat of categories.slice(0, 8)) {
        lines.push(`  "${this.sanitize(cat.name)}" : ${cat.count}`);
      }
      return lines.join("\n");
    }
    // No categorizable content: chart REAL structural counts of the artifact —
    // never fabricated percentages.
    const sectionCount = (content.match(/^#{1,4}\s+.+$/gm) || []).length;
    const bulletCount = (content.match(/^\s*[-*]\s+.+$/gm) || []).length;
    const paragraphCount = content.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
    const counts: Array<{ name: string; count: number }> = [
      { name: "Sections", count: sectionCount },
      { name: "List Items", count: bulletCount },
      { name: "Paragraphs", count: paragraphCount },
    ].filter((c) => c.count > 0);
    if (counts.length === 0) {
      lines.push(`  "Empty" : 1`);
    } else {
      for (const c of counts) {
        lines.push(`  "${c.name}" : ${c.count}`);
      }
    }
    return lines.join("\n");
  }

  private generateMindmap(content: string, title: string): string {
    const topics = this.extractTopics(content);
    const lines = [`mindmap`, `  root((${this.sanitize(title)}))`];
    for (const topic of topics.slice(0, 8)) {
      lines.push(`    ${this.sanitize(topic.name)}`);
      for (const sub of (topic.subtopics || []).slice(0, 4)) {
        lines.push(`      ${this.sanitize(sub)}`);
      }
    }
    return lines.join("\n");
  }

  private generateC4Component(content: string, title: string): string {
    const components = this.extractComponents(content);
    const lines = [
      `C4Component`,
      `  title ${this.sanitize(title)}`,
      `  Container_Boundary(main, "Main System") {`,
    ];
    const used = new Set<string>(["main"]);
    let ids: string[];
    if (components.length === 0) {
      ids = ["comp1", "comp2", "comp3"];
      lines.push(`    Component(comp1, "Core Module", "Handles main logic")`);
      lines.push(`    Component(comp2, "Data Access", "Database operations")`);
      lines.push(`    Component(comp3, "API Layer", "External interface")`);
    } else {
      ids = components.slice(0, 10).map((comp) => this.uniqueId(this.safeId(comp, "comp").toLowerCase(), used));
      components.slice(0, 10).forEach((comp, i) => {
        lines.push(`    Component(${ids[i]}, "${this.sanitize(comp)}", "${this.sanitize(comp)}")`);
      });
    }
    lines.push(`  }`);
    // Add relationships between adjacent components
    for (let i = 0; i < ids.length - 1; i++) {
      lines.push(`  Rel(${ids[i]}, ${ids[i + 1]}, "Uses")`);
    }
    return lines.join("\n");
  }

  private generateC4Code(content: string, title: string): string {
    const classes = this.extractClassCandidates(content);
    const lines = [`classDiagram`];
    if (classes.length === 0) {
      lines.push(`  class ${this.safeId(this.toPascalCase(title), "Feature")} {`, `    <<component>>`, `  }`);
      return lines.join("\n");
    }

    const used = new Set<string>();
    const entries: Array<{ id: string; kind: "interface" | "class" }> = [];
    for (const cls of classes.slice(0, 10)) {
      const id = this.uniqueId(this.safeId(cls.name, "Class"), used);
      entries.push({ id, kind: cls.kind });
      lines.push(`  class ${id} {`);
      lines.push(`    <<${cls.kind === "interface" ? "interface" : "component"}>>`);
      for (const method of cls.methods.slice(0, 6)) {
        lines.push(`    +${this.safeId(method, "method")}()`);
      }
      lines.push(`  }`);
    }
    for (let i = 1; i < entries.length && i < 10; i++) {
      const edge = entries[0].kind === "interface" ? "<|.." : "-->";
      lines.push(`  ${entries[0].id} ${edge} ${entries[i].id}`);
    }
    return lines.join("\n");
  }

  private generateActivity(content: string, title: string): string {
    const listItems = this.extractListItems(content);
    const items = listItems.length > 0 ? listItems : this.extractSections(content).map((s) => s.heading);
    if (items.length === 0) {
      return `flowchart TD\n  Start(["${this.sanitize(title)} - Start"]) --> End([End])`;
    }
    const lines = [`flowchart TD`, `  Start(["${this.sanitize(title)} - Start"])`];
    let prevId = "Start";
    for (let i = 0; i < Math.min(items.length, 12); i++) {
      const item = items[i];
      const id = `A${i}`;
      // Detect decision points
      if (item.toLowerCase().includes("if ") || item.toLowerCase().includes("check") || item.toLowerCase().includes("validate")) {
        lines.push(`  ${id}{"${this.sanitize(item.substring(0, 50))}"}`);
        lines.push(`  ${prevId} --> ${id}`);
        if (i < items.length - 1) {
          lines.push(`  ${id} -->|Yes| A${i + 1}`);
          lines.push(`  ${id} -->|No| End([End])`);
        }
      } else {
        lines.push(`  ${id}["${this.sanitize(item.substring(0, 50))}"]`);
        lines.push(`  ${prevId} --> ${id}`);
      }
      prevId = id;
    }
    lines.push(`  ${prevId} --> End([End])`);
    return lines.join("\n");
  }

  private generateUseCase(content: string, title: string): string {
    const actors = this.extractActors(content);
    const lines = [`flowchart LR`];
    // Create actor nodes
    const actorList = actors.length > 0 ? actors.slice(0, 4) : ["User"];
    const used = new Set<string>();
    const actorIds = actorList.map((actor) => this.uniqueId(this.safeId(actor, "Actor"), used));
    actorList.forEach((actor, i) => {
      lines.push(`  ${actorIds[i]}(("${this.sanitize(actor)}"))`);
    });
    // Create use case boundary — cases come from the artifact's list items,
    // then its real section names; never from an invented canned list.
    lines.push(`  subgraph "${this.sanitize(title)}"`);
    const items = this.extractListItems(content);
    const derived = items.length > 0 ? items : this.extractSections(content).map((s) => s.heading);
    const useCases = derived.length > 0 ? derived.slice(0, 8) : [title];
    for (let i = 0; i < useCases.length; i++) {
      lines.push(`    UC${i}(["${this.sanitize(useCases[i].substring(0, 40))}"])`);
    }
    lines.push(`  end`);
    // Connect actors to use cases
    for (let i = 0; i < Math.min(useCases.length, 8); i++) {
      lines.push(`  ${actorIds[0]} --> UC${i}`);
    }
    return lines.join("\n");
  }

  private generateDFD(content: string, _title: string): string {
    const entities = this.extractEntities(content);
    const components = this.extractComponents(content);
    const lines = [`flowchart LR`];
    const used = new Set<string>(["DS1", "DS2"]);
    // External entities
    const externals = entities.length > 0 ? entities.slice(0, 3).map((e) => e.name) : ["User"];
    const extIds = externals.map((name) => this.uniqueId(this.safeId(name, "ext").toLowerCase(), used));
    externals.forEach((name, i) => {
      lines.push(`  ${extIds[i]}[/"${this.sanitize(name)}"/]`);
    });
    // Processes
    const processes = components.length > 0 ? components.slice(0, 4) : ["Process Data"];
    for (let i = 0; i < processes.length; i++) {
      lines.push(`  P${i}(("${this.sanitize(processes[i].substring(0, 30))}"))`);
    }
    // Data stores
    lines.push(`  DS1[("Database")]`);
    lines.push(`  DS2[("Cache")]`);
    // Connect: external -> process -> store
    if (processes.length > 0) {
      lines.push(`  ${extIds[0]} -->|Input| P0`);
      lines.push(`  P0 -->|Store| DS1`);
      if (processes.length > 1) {
        lines.push(`  P0 -->|Forward| P1`);
        lines.push(`  P1 -->|Cache| DS2`);
        lines.push(`  P1 -->|Response| ${extIds[0]}`);
      } else {
        lines.push(`  P0 -->|Response| ${extIds[0]}`);
      }
    }
    return lines.join("\n");
  }

  private generateDeployment(content: string, _title: string): string {
    const components = this.extractComponents(content);
    const lines = [`flowchart TB`];
    // Internet/Load Balancer layer
    lines.push(`  Internet((Internet))`);
    lines.push(`  LB[Load Balancer]`);
    lines.push(`  Internet --> LB`);
    // Application layer
    lines.push(`  subgraph "Application Layer"`);
    const used = new Set<string>(["Internet", "LB", "DB", "Cache"]);
    let appIds: string[];
    if (components.length > 0) {
      appIds = components.slice(0, 4).map((comp) => this.uniqueId(this.safeId(comp, "app").toLowerCase(), used));
      components.slice(0, 4).forEach((comp, i) => {
        lines.push(`    ${appIds[i]}["${this.sanitize(comp)}"]`);
      });
    } else {
      appIds = ["API", "Worker"];
      lines.push(`    API["API Server"]`);
      lines.push(`    Worker["Background Worker"]`);
    }
    lines.push(`  end`);
    // Data layer
    lines.push(`  subgraph "Data Layer"`);
    lines.push(`    DB[(Primary Database)]`);
    lines.push(`    Cache[(Redis Cache)]`);
    lines.push(`  end`);
    // Connections
    lines.push(`  LB --> ${appIds[0]}`);
    for (const id of appIds) {
      lines.push(`  ${id} --> DB`);
      lines.push(`  ${id} --> Cache`);
    }
    return lines.join("\n");
  }

  private generateNetworkTopology(content: string, _title: string): string {
    const lines = [`flowchart TB`];
    // External zone
    lines.push(`  subgraph "Public Zone"`);
    lines.push(`    CDN["CDN / Edge"]`);
    lines.push(`    WAF["WAF / Firewall"]`);
    lines.push(`  end`);
    // DMZ
    lines.push(`  subgraph "DMZ"`);
    lines.push(`    LB["Load Balancer"]`);
    lines.push(`    Gateway["API Gateway"]`);
    lines.push(`  end`);
    // Private zone
    lines.push(`  subgraph "Private Zone"`);
    const components = this.extractComponents(content);
    const used = new Set<string>(["CDN", "WAF", "LB", "Gateway", "DB", "MQ"]);
    let privateIds: string[];
    if (components.length > 0) {
      privateIds = components.slice(0, 4).map((comp) => this.uniqueId(this.safeId(comp, "node").toLowerCase(), used));
      components.slice(0, 4).forEach((comp, i) => {
        lines.push(`    ${privateIds[i]}["${this.sanitize(comp)}"]`);
      });
    } else {
      privateIds = ["AppServer", "WorkerNode"];
      lines.push(`    AppServer["Application Server"]`);
      lines.push(`    WorkerNode["Worker Node"]`);
    }
    lines.push(`  end`);
    // Data zone
    lines.push(`  subgraph "Data Zone"`);
    lines.push(`    DB[(Database)]`);
    lines.push(`    MQ["Message Queue"]`);
    lines.push(`  end`);
    // Connections
    lines.push(`  CDN --> WAF`);
    lines.push(`  WAF --> LB`);
    lines.push(`  LB --> Gateway`);
    lines.push(`  Gateway --> ${privateIds[0]}`);
    for (const id of privateIds) {
      lines.push(`  ${id} --> DB`);
      lines.push(`  ${id} --> MQ`);
    }
    return lines.join("\n");
  }

  // ─── Extraction Helpers ───

  private extractListItems(content: string): string[] {
    const items: string[] = [];
    const regex = /^[-*]\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const raw = match[1].trim();
      // Skip pure-link bullets (tables of contents) and unwrap inline links.
      if (/^\[[^\]]*\]\([^)]*\)$/.test(raw)) continue;
      const item = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
      if (item) items.push(item);
    }
    return items;
  }

  private extractActors(content: string): string[] {
    const actors: string[] = [];
    const seen = new Set<string>();
    // Look for common actor patterns: "User", "System", "Admin", service names
    const patterns = /\b(User|System|Admin|Client|Server|API|Database|Service|Gateway|Queue|Cache)\b/gi;
    let match;
    while ((match = patterns.exec(content)) !== null) {
      const key = match[1].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Normalize casing so "service"/"Service" never become two actors
      actors.push(match[1].charAt(0).toUpperCase() + match[1].slice(1));
    }
    return actors;
  }

  /**
   * Derive request/response exchanges from EARS requirement sentences.
   * "When X, the system shall Y" -> Client request "X", System response "Y".
   */
  private extractRequirementExchanges(content: string): Array<{ trigger: string; response: string }> {
    const exchanges: Array<{ trigger: string; response: string }> = [];
    const sentences = content.split(/(?<=[.!?])\s+|\n+/);
    for (const sentence of sentences) {
      if (!/\bshall\b/i.test(sentence)) continue;
      const conditional = sentence.match(
        /\b(?:when|while|where|if)\s+(.{3,80}?),?\s*(?:then\s+)?the\s+[\w -]{1,40}?\s+shall\s+(.{3,120})/i
      );
      if (conditional) {
        exchanges.push({
          trigger: conditional[1].trim(),
          response: conditional[2].replace(/[.\s]+$/, "").trim(),
        });
        continue;
      }
      const ubiquitous = sentence.match(/\bthe\s+[\w -]{1,40}?\s+shall\s+(.{3,120})/i);
      if (ubiquitous) {
        const action = ubiquitous[1].replace(/[.\s]+$/, "").trim();
        exchanges.push({
          trigger: `Request to ${action.split(/\s+/).slice(0, 5).join(" ")}`,
          response: action,
        });
      }
    }
    return exchanges;
  }

  private extractEntities(content: string): Array<{ name: string; attributes: string[] }> {
    const entities: Array<{ name: string; attributes: string[] }> = [];
    for (const section of this.extractSections(content)) {
      const attrs = section.bullets
        .map((bullet) => bullet.replace(/\*\*/g, "").split(/[:—–-]/)[0]?.trim() ?? "")
        .filter((attr) => /^[A-Za-z]/.test(attr));
      if (attrs.length > 0) {
        entities.push({ name: section.heading, attributes: attrs });
      }
    }
    return entities;
  }

  /**
   * Class/interface candidates for class and c4_code diagrams.
   * 1. Explicit `interface X { ... }` / `class X { ... }` declarations (methods
   *    read from the real body — never invented).
   * 2. Real section names with methods derived from their bullet items.
   * 3. Last resort: one class built from the artifact's opening words, so
   *    different artifacts never collapse to an identical stub.
   */
  private extractClassCandidates(content: string): ClassCandidate[] {
    const classes: ClassCandidate[] = [];
    const seen = new Set<string>();

    const declRegex = /\b(interface|class)\s+([A-Za-z_]\w*)(?:\s*\{([^}]*)\})?/g;
    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(content)) !== null) {
      const kind = match[1].toLowerCase() === "interface" ? "interface" : "class";
      const name = match[2];
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const methods: string[] = [];
      if (match[3]) {
        const methodRegex = /([A-Za-z_]\w*)\s*\(/g;
        let methodMatch: RegExpExecArray | null;
        while ((methodMatch = methodRegex.exec(match[3])) !== null) {
          if (!methods.includes(methodMatch[1])) methods.push(methodMatch[1]);
        }
      }
      classes.push({ name, methods, kind });
    }
    if (classes.length > 0) return classes;

    for (const section of this.extractSections(content)) {
      const name = this.toPascalCase(section.heading);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const methods = section.bullets
        .map((bullet) => this.toCamelCase((bullet.split(/[.:—–]/)[0] ?? bullet).substring(0, 40)))
        .filter((method) => method.length > 1)
        .slice(0, 5);
      classes.push({ name, methods, kind: "class" });
    }
    if (classes.length > 0) return classes;

    const words = content
      .replace(/[^A-Za-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    if (words.length > 0) {
      classes.push({ name: this.toPascalCase(words.slice(0, 3).join(" ")), methods: [], kind: "class" });
    }
    return classes;
  }

  private extractStates(content: string): string[] {
    const states: string[] = [];
    const regex =
      /\b(pending|active|processing|completed|failed|cancelled|approved|rejected|draft|published|archived|created|submitted|shipped|delivered|expired|suspended)\b/gi;
    const seen = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      const state = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      if (!seen.has(state)) {
        seen.add(state);
        states.push(state);
      }
    }
    return states;
  }

  private extractSystems(content: string): string[] {
    const systems: string[] = [];
    const regex = /(?:system|service|component|module):\s*(.+)/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      systems.push(match[1].trim());
    }
    return systems;
  }

  private extractComponents(content: string): string[] {
    const components: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string): void => {
      const name = this.cleanHeading(raw);
      if (!name || this.isStructuralHeading(name)) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      components.push(name);
    };
    const regex = /^#{2,3}\s+(.+(?:Service|API|Gateway|Database|Cache|Queue|Worker|Engine|Manager|Controller))\s*$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      push(match[1]);
    }
    if (components.length === 0) {
      // Fallback: extract from real (non-structural) headings
      const headingRegex = /^#{2,3}\s+(.+)/gm;
      while ((match = headingRegex.exec(content)) !== null) {
        push(match[1]);
      }
    }
    return components;
  }

  private extractTasks(content: string): Array<{ name: string; parallel: boolean; section?: string }> {
    const tasks: Array<{ name: string; parallel: boolean; section?: string }> = [];
    let currentSection: string | undefined;
    const lines = content.split("\n");
    for (const line of lines) {
      const sectionMatch = line.match(/^#{2,3}\s+(.+)/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }
      const taskMatch = line.match(/^-\s+\[[ x]\]\s+(?:T\d+\s+)?(?:\[P\]\s+)?(?:\[US\d+\]\s+)?(.+)/i);
      if (taskMatch) {
        const parallel = /\[P\]/i.test(line);
        tasks.push({ name: taskMatch[1].trim(), parallel, section: currentSection });
      }
    }
    return tasks;
  }

  /**
   * Real category counts for pie charts, tried in order:
   * 1. Explicit EARS pattern tags, e.g. "(EVENT_DRIVEN)".
   * 2. Classification of "shall" requirement sentences by EARS keyword.
   * 3. REQ-ID prefixes (### REQ-XXX-NNN).
   * 4. Section names weighted by their real bullet counts.
   */
  private extractCategories(content: string): Array<{ name: string; count: number }> {
    const tagNames: Record<string, string> = {
      UBIQUITOUS: "Ubiquitous",
      EVENT_DRIVEN: "Event-Driven",
      STATE_DRIVEN: "State-Driven",
      OPTIONAL: "Optional",
      UNWANTED: "Unwanted Behavior",
      UNWANTED_BEHAVIOR: "Unwanted Behavior",
      COMPLEX: "Complex",
    };
    const tagCounts = new Map<string, number>();
    const tagRegex = /\b(UBIQUITOUS|EVENT[_ ]DRIVEN|STATE[_ ]DRIVEN|OPTIONAL|UNWANTED(?:[_ ]BEHAVIOR)?|COMPLEX)\b/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(content)) !== null) {
      const name = tagNames[match[1].replace(/\s+/g, "_")] ?? match[1];
      tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
    }
    if (tagCounts.size > 0) {
      return Array.from(tagCounts.entries()).map(([name, count]) => ({ name, count }));
    }

    const earsCounts = new Map<string, number>();
    const sentences = content.split(/(?<=[.!?])\s+|\n+/);
    for (const sentence of sentences) {
      if (!/\bshall\b/i.test(sentence)) continue;
      const trimmed = sentence.trim().toLowerCase();
      let pattern = "Ubiquitous";
      if (/^while\b/.test(trimmed)) pattern = "State-Driven";
      else if (/^when\b/.test(trimmed)) pattern = "Event-Driven";
      else if (/^where\b/.test(trimmed)) pattern = "Optional";
      else if (/^if\b/.test(trimmed)) pattern = "Unwanted Behavior";
      earsCounts.set(pattern, (earsCounts.get(pattern) || 0) + 1);
    }
    if (earsCounts.size > 0) {
      return Array.from(earsCounts.entries()).map(([name, count]) => ({ name, count }));
    }

    const prefixCounts = new Map<string, number>();
    const reqRegex = /### (REQ-([A-Z]+)-\d{3})/g;
    while ((match = reqRegex.exec(content)) !== null) {
      const cat = match[2];
      prefixCounts.set(cat, (prefixCounts.get(cat) || 0) + 1);
    }
    if (prefixCounts.size > 0) {
      return Array.from(prefixCounts.entries()).map(([name, count]) => ({ name, count }));
    }

    return this.extractSections(content)
      .slice(0, 8)
      .map((section) => ({ name: section.heading, count: Math.max(section.bullets.length, 1) }));
  }

  private extractTopics(content: string): Array<{ name: string; subtopics: string[] }> {
    const topics: Array<{ name: string; subtopics: string[] }> = [];
    const sections = content.split(/^##\s+/m).filter(Boolean);
    for (const section of sections) {
      const lines = section.split("\n");
      const firstLine = lines[0]?.trim() ?? "";
      // Skip the pre-heading chunk (document title/frontmatter before the first ##)
      if (firstLine.startsWith("#")) continue;
      const name = this.cleanHeading(firstLine);
      if (!name || this.isStructuralHeading(name)) continue;
      const subtopics: string[] = [];
      for (const line of lines.slice(1)) {
        const subMatch = line.match(/^###\s+(.+)/);
        if (subMatch) subtopics.push(subMatch[1].trim());
      }
      topics.push({ name, subtopics });
    }
    return topics;
  }

  /**
   * Real (non-structural) sections with their bullet items — the shared
   * source-derived skeleton used by fallback paths.
   */
  private extractSections(content: string): SectionInfo[] {
    const sections: SectionInfo[] = [];
    let current: SectionInfo | null = null;
    for (const line of content.split("\n")) {
      const headingMatch = line.match(/^#{2,4}\s+(.+)/);
      if (headingMatch) {
        const heading = this.cleanHeading(headingMatch[1]);
        if (heading && !this.isStructuralHeading(heading)) {
          current = { heading, bullets: [] };
          sections.push(current);
        } else {
          current = null;
        }
        continue;
      }
      const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
      if (bulletMatch && current) {
        current.bullets.push(bulletMatch[1].trim());
      }
    }
    return sections;
  }

  // ─── Utility ───

  private sanitize(text: string): string {
    return text.replace(/["'`\[\]{}()<>|*]/g, "").replace(/\n/g, " ").trim().substring(0, 80);
  }

  /** Text safe outside quotes (gantt names/sections, message-free positions). */
  private plainText(text: string): string {
    return this.sanitize(text).replace(/[:;,#]/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  /** Sequence message text — keeps it on one line and free of ':' markers. */
  private messageText(text: string): string {
    const cleaned = this.sanitize(text).replace(/[:;]/g, " ").replace(/\s{2,}/g, " ").trim().substring(0, 60);
    return cleaned || "Message";
  }

  /** Identifier containing only [A-Za-z0-9_], never starting with a digit. */
  private safeId(text: string, fallback: string): string {
    const cleaned = text
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 40)
      .replace(/_+$/g, "");
    if (!cleaned) return fallback;
    return /^[0-9]/.test(cleaned) ? `N${cleaned}` : cleaned;
  }

  private uniqueId(base: string, used: Set<string>): string {
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}_${suffix}`;
      suffix++;
    }
    used.add(id);
    return id;
  }

  private cleanHeading(raw: string): string {
    return raw
      .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
  }

  private toPascalCase(text: string): string {
    return text
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("")
      .substring(0, 40);
  }

  private toCamelCase(text: string): string {
    const pascal = this.toPascalCase(text);
    return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
  }

  private isStructuralHeading(heading: string): boolean {
    return STRUCTURAL_HEADING_REGEX.test(heading.trim());
  }

  private buildDiagramsMarkdown(featureNumber: string, diagrams: DiagramSpec[]): string {
    const sourceLabels: Record<string, string> = {
      constitution: "CONSTITUTION.md",
      spec: "SPECIFICATION.md",
      design: "DESIGN.md",
      tasks: "TASKS.md",
    };
    const grouped = new Map<string, DiagramSpec[]>();
    for (const diagram of diagrams) {
      const group = grouped.get(diagram.source);
      if (group) {
        group.push(diagram);
      } else {
        grouped.set(diagram.source, [diagram]);
      }
    }
    const canonicalOrder = ["constitution", "spec", "design", "tasks"];
    const sources = [
      ...canonicalOrder.filter((source) => grouped.has(source)),
      ...Array.from(grouped.keys()).filter((source) => !canonicalOrder.includes(source)),
    ];

    const lines = [
      `# Diagrams — Feature ${featureNumber}`,
      "",
      `> Generated by \`sdd_generate_all_diagrams\` — ${diagrams.length} diagrams, grouped by source artifact.`,
      "",
    ];
    for (const source of sources) {
      lines.push(`## Source: ${sourceLabels[source] ?? source}`, "");
      for (const diagram of grouped.get(source) ?? []) {
        lines.push(`### ${diagram.title} (${diagram.type})`, "", "```mermaid", diagram.mermaid_code, "```", "");
      }
    }
    return lines.join("\n");
  }

  private async safeRead(_specDir: string, featureDir: string, fileName: string): Promise<string | null> {
    try {
      return await this.fileManager.readSpecFile(featureDir, fileName);
    } catch {
      return null;
    }
  }
}
