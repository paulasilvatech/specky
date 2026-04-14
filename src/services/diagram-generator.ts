/**
 * DiagramGenerator — Deterministic Mermaid diagram generation from spec artifacts.
 * All generation is pure string manipulation — no AI calls.
 */

import type { FileManager } from "./file-manager.js";
import type { DiagramSpec, AllDiagramsResult, DiagramType } from "../types.js";

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
   * Generate ALL diagram types for a feature from its artifacts.
   */
  async generateAllDiagrams(specDir: string, featureDir: string): Promise<AllDiagramsResult> {
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
    }
    if (designContent) {
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
    return { feature_number: featureNumber, diagrams, total_generated: diagrams.length };
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
    if (items.length === 0) return `flowchart TD\n  A[${this.sanitize(title)}]`;

    const nodes = items.slice(0, 12).map((item, i) => {
      const id = `N${i}`;
      const nextId = i < Math.min(items.length, 12) - 1 ? `N${i + 1}` : null;
      const node = `  ${id}["${this.sanitize(item.substring(0, 60))}"]`;
      const arrow = nextId ? `\n  ${id} --> ${nextId}` : "";
      return node + arrow;
    });
    return `flowchart TD\n${nodes.join("\n")}`;
  }

  private generateSequence(content: string, _title: string): string {
    const actors = this.extractActors(content);
    if (actors.length < 2) return `sequenceDiagram\n  participant User\n  participant System\n  User->>System: Request\n  System-->>User: Response`;

    const lines = [`sequenceDiagram`];
    for (const actor of actors.slice(0, 6)) {
      lines.push(`  participant ${this.sanitize(actor)}`);
    }
    // Generate interactions from content patterns
    const interactions = this.extractInteractions(content);
    for (const interaction of interactions.slice(0, 10)) {
      lines.push(`  ${this.sanitize(interaction.from)}->>${this.sanitize(interaction.to)}: ${this.sanitize(interaction.action.substring(0, 40))}`);
    }
    return lines.join("\n");
  }

  private generateERD(content: string, _title: string): string {
    const entities = this.extractEntities(content);
    if (entities.length === 0) return `erDiagram\n  ENTITY {\n    string id PK\n    string name\n  }`;

    const lines = [`erDiagram`];
    for (const entity of entities.slice(0, 8)) {
      lines.push(`  ${entity.name.toUpperCase().replace(/\s+/g, "_")} {`);
      lines.push(`    string id PK`);
      for (const attr of entity.attributes.slice(0, 6)) {
        lines.push(`    string ${attr.replace(/\s+/g, "_").toLowerCase()}`);
      }
      lines.push(`  }`);
    }
    // Add relationships
    for (let i = 0; i < entities.length - 1 && i < 7; i++) {
      const from = entities[i].name.toUpperCase().replace(/\s+/g, "_");
      const to = entities[i + 1].name.toUpperCase().replace(/\s+/g, "_");
      lines.push(`  ${from} ||--o{ ${to} : "has"`);
    }
    return lines.join("\n");
  }

  private generateClassDiagram(content: string, _title: string): string {
    const interfaces = this.extractInterfaces(content);
    if (interfaces.length === 0) return `classDiagram\n  class Service {\n    +execute()\n  }`;

    const lines = [`classDiagram`];
    for (const iface of interfaces.slice(0, 8)) {
      lines.push(`  class ${this.sanitize(iface.name)} {`);
      for (const method of iface.methods.slice(0, 5)) {
        lines.push(`    +${this.sanitize(method)}()`);
      }
      lines.push(`  }`);
    }
    return lines.join("\n");
  }

  private generateStateDiagram(content: string, _title: string): string {
    const states = this.extractStates(content);
    if (states.length === 0) return `stateDiagram-v2\n  [*] --> Active\n  Active --> Completed\n  Completed --> [*]`;

    const lines = [`stateDiagram-v2`, `  [*] --> ${this.sanitize(states[0])}`];
    for (let i = 0; i < states.length - 1; i++) {
      lines.push(`  ${this.sanitize(states[i])} --> ${this.sanitize(states[i + 1])}`);
    }
    lines.push(`  ${this.sanitize(states[states.length - 1])} --> [*]`);
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
      for (const sys of systems.slice(0, 6)) {
        const id = sys.replace(/\s+/g, "_").toLowerCase();
        lines.push(`  System(${id}, "${this.sanitize(sys)}", "${this.sanitize(sys)}")`);
      }
      lines.push(`  Rel(user, ${systems[0].replace(/\s+/g, "_").toLowerCase()}, "Uses")`);
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
    if (components.length === 0) {
      lines.push(`    Container(api, "API", "REST API")`);
      lines.push(`    ContainerDb(db, "Database", "Data storage")`);
    } else {
      for (const comp of components.slice(0, 8)) {
        const id = comp.replace(/\s+/g, "_").toLowerCase();
        lines.push(`    Container(${id}, "${this.sanitize(comp)}", "${this.sanitize(comp)}")`);
      }
    }
    lines.push(`  }`);
    lines.push(`  Rel(user, ${(components[0] || "api").replace(/\s+/g, "_").toLowerCase()}, "Uses")`);
    return lines.join("\n");
  }

  private generateGantt(content: string, title: string): string {
    const tasks = this.extractTasks(content);
    const lines = [
      `gantt`,
      `  title ${this.sanitize(title)}`,
      `  dateFormat YYYY-MM-DD`,
    ];
    let currentSection = "Setup";
    let taskCount = 0;
    for (const task of tasks.slice(0, 15)) {
      if (task.section && task.section !== currentSection) {
        currentSection = task.section;
        lines.push(`  section ${this.sanitize(currentSection)}`);
      }
      const id = `t${taskCount++}`;
      const duration = task.parallel ? "1d" : "2d";
      const dep = taskCount > 1 ? `, after t${taskCount - 2}` : "";
      lines.push(`  ${this.sanitize(task.name.substring(0, 40))} :${id}, ${duration}${dep}`);
    }
    return lines.join("\n");
  }

  private generatePie(content: string, title: string): string {
    // Extract categories and counts from content
    const categories = this.extractCategories(content);
    const lines = [`pie title ${this.sanitize(title)}`];
    if (categories.length === 0) {
      lines.push(`  "Functional" : 60`);
      lines.push(`  "Non-Functional" : 25`);
      lines.push(`  "Constraints" : 15`);
    } else {
      for (const cat of categories.slice(0, 8)) {
        lines.push(`  "${this.sanitize(cat.name)}" : ${cat.count}`);
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
    if (components.length === 0) {
      lines.push(`    Component(comp1, "Core Module", "Handles main logic")`);
      lines.push(`    Component(comp2, "Data Access", "Database operations")`);
      lines.push(`    Component(comp3, "API Layer", "External interface")`);
    } else {
      for (const comp of components.slice(0, 10)) {
        const id = comp.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "");
        lines.push(`    Component(${id}, "${this.sanitize(comp)}", "${this.sanitize(comp)}")`);
      }
    }
    lines.push(`  }`);
    // Add relationships between adjacent components
    const ids = components.length > 0
      ? components.slice(0, 10).map(c => c.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, ""))
      : ["comp1", "comp2", "comp3"];
    for (let i = 0; i < ids.length - 1; i++) {
      lines.push(`  Rel(${ids[i]}, ${ids[i + 1]}, "Uses")`);
    }
    return lines.join("\n");
  }

  private generateC4Code(content: string, _title: string): string {
    const interfaces = this.extractInterfaces(content);
    if (interfaces.length === 0) {
      return `classDiagram\n  class IService {\n    <<interface>>\n    +execute()\n    +validate()\n  }\n  class ServiceImpl {\n    +execute()\n    +validate()\n  }\n  IService <|.. ServiceImpl`;
    }
    const lines = [`classDiagram`];
    for (const iface of interfaces.slice(0, 10)) {
      lines.push(`  class ${this.sanitize(iface.name)} {`);
      lines.push(`    <<interface>>`);
      for (const method of iface.methods.slice(0, 6)) {
        lines.push(`    +${this.sanitize(method)}()`);
      }
      lines.push(`  }`);
    }
    // Add implementation relationships
    for (let i = 1; i < interfaces.length && i < 10; i++) {
      lines.push(`  ${this.sanitize(interfaces[0].name)} <|.. ${this.sanitize(interfaces[i].name)}`);
    }
    return lines.join("\n");
  }

  private generateActivity(content: string, title: string): string {
    const items = this.extractListItems(content);
    if (items.length === 0) return `flowchart TD\n  Start([Start]) --> Action1[Process]\n  Action1 --> End([End])`;
    const lines = [`flowchart TD`, `  Start([${this.sanitize(title)} - Start])`];
    let prevId = "Start";
    for (let i = 0; i < Math.min(items.length, 12); i++) {
      const item = items[i];
      const id = `A${i}`;
      // Detect decision points
      if (item.toLowerCase().includes("if ") || item.toLowerCase().includes("check") || item.toLowerCase().includes("validate")) {
        lines.push(`  ${id}{${this.sanitize(item.substring(0, 50))}}`);
        lines.push(`  ${prevId} --> ${id}`);
        if (i < items.length - 1) {
          lines.push(`  ${id} -->|Yes| A${i + 1}`);
          lines.push(`  ${id} -->|No| End([End])`);
        }
      } else {
        lines.push(`  ${id}[${this.sanitize(item.substring(0, 50))}]`);
        lines.push(`  ${prevId} --> ${id}`);
      }
      prevId = id;
    }
    lines.push(`  ${prevId} --> End([End])`);
    return lines.join("\n");
  }

  private generateUseCase(content: string, title: string): string {
    const actors = this.extractActors(content);
    const items = this.extractListItems(content);
    const lines = [`flowchart LR`];
    // Create actor nodes
    const actorList = actors.length > 0 ? actors.slice(0, 4) : ["User"];
    for (const actor of actorList) {
      lines.push(`  ${actor.replace(/\s+/g, "")}((${this.sanitize(actor)}))`);
    }
    // Create use case boundary
    lines.push(`  subgraph "${this.sanitize(title)}"`);
    const useCases = items.length > 0 ? items.slice(0, 8) : ["Login", "View Dashboard", "Export Data"];
    for (let i = 0; i < useCases.length; i++) {
      lines.push(`    UC${i}([${this.sanitize(useCases[i].substring(0, 40))}])`);
    }
    lines.push(`  end`);
    // Connect actors to use cases
    const primaryActor = actorList[0].replace(/\s+/g, "");
    for (let i = 0; i < Math.min(useCases.length, 8); i++) {
      lines.push(`  ${primaryActor} --> UC${i}`);
    }
    return lines.join("\n");
  }

  private generateDFD(content: string, _title: string): string {
    const entities = this.extractEntities(content);
    const components = this.extractComponents(content);
    const lines = [`flowchart LR`];
    // External entities
    const externals = entities.length > 0 ? entities.slice(0, 3) : [{ name: "User", attributes: [] }];
    for (const ext of externals) {
      const id = ext.name.replace(/\s+/g, "_").toLowerCase();
      lines.push(`  ${id}[/"${this.sanitize(ext.name)}"/]`);
    }
    // Processes
    const processes = components.length > 0 ? components.slice(0, 4) : ["Process Data"];
    for (let i = 0; i < processes.length; i++) {
      lines.push(`  P${i}((${this.sanitize(processes[i].substring(0, 30))}))`);
    }
    // Data stores
    lines.push(`  DS1[(Database)]`);
    lines.push(`  DS2[(Cache)]`);
    // Connect: external -> process -> store
    const extId = externals[0].name.replace(/\s+/g, "_").toLowerCase();
    if (processes.length > 0) {
      lines.push(`  ${extId} -->|Input| P0`);
      lines.push(`  P0 -->|Store| DS1`);
      if (processes.length > 1) {
        lines.push(`  P0 -->|Forward| P1`);
        lines.push(`  P1 -->|Cache| DS2`);
        lines.push(`  P1 -->|Response| ${extId}`);
      } else {
        lines.push(`  P0 -->|Response| ${extId}`);
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
    if (components.length > 0) {
      for (const comp of components.slice(0, 4)) {
        const id = comp.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "");
        lines.push(`    ${id}["${this.sanitize(comp)}"]`);
      }
    } else {
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
    const appIds = components.length > 0
      ? components.slice(0, 4).map(c => c.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, ""))
      : ["API", "Worker"];
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
    if (components.length > 0) {
      for (const comp of components.slice(0, 4)) {
        const id = comp.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "");
        lines.push(`    ${id}["${this.sanitize(comp)}"]`);
      }
    } else {
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
    const privateIds = components.length > 0
      ? components.slice(0, 4).map(c => c.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, ""))
      : ["AppServer", "WorkerNode"];
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
      items.push(match[1].trim());
    }
    return items;
  }

  private extractActors(content: string): string[] {
    const actors = new Set<string>();
    // Look for common actor patterns: "User", "System", "Admin", service names
    const patterns = /\b(User|System|Admin|Client|Server|API|Database|Service|Gateway|Queue|Cache)\b/gi;
    let match;
    while ((match = patterns.exec(content)) !== null) {
      actors.add(match[1]);
    }
    return Array.from(actors);
  }

  private extractInteractions(content: string): Array<{ from: string; to: string; action: string }> {
    const interactions: Array<{ from: string; to: string; action: string }> = [];
    // Look for "X sends/calls/returns to Y" patterns
    const regex = /(\w+)\s+(?:sends?|calls?|requests?|returns?|responds?)\s+(?:to\s+)?(\w+)/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      interactions.push({ from: match[1], to: match[2], action: match[0] });
    }
    if (interactions.length === 0) {
      interactions.push({ from: "User", to: "System", action: "Request" });
      interactions.push({ from: "System", to: "User", action: "Response" });
    }
    return interactions;
  }

  private extractEntities(content: string): Array<{ name: string; attributes: string[] }> {
    const entities: Array<{ name: string; attributes: string[] }> = [];
    // Look for entity-like headings followed by attribute lists
    const sections = content.split(/^#{2,3}\s+/m);
    for (const section of sections) {
      const lines = section.split("\n");
      const heading = lines[0]?.trim();
      if (!heading) continue;
      const attrs: string[] = [];
      for (const line of lines.slice(1)) {
        const attrMatch = line.match(/^[-*]\s+\*?\*?(\w[\w\s]*)\*?\*?/);
        if (attrMatch) attrs.push(attrMatch[1].trim());
      }
      if (attrs.length > 0) {
        entities.push({ name: heading, attributes: attrs });
      }
    }
    return entities;
  }

  private extractInterfaces(content: string): Array<{ name: string; methods: string[] }> {
    const interfaces: Array<{ name: string; methods: string[] }> = [];
    const regex = /(?:interface|class|service|module)\s+(\w+)/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      interfaces.push({ name: match[1], methods: ["execute", "validate", "process"] });
    }
    return interfaces;
  }

  private extractStates(content: string): string[] {
    const states: string[] = [];
    const regex = /\b(pending|active|processing|completed|failed|cancelled|approved|rejected|draft|published|archived)\b/gi;
    const seen = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      const state = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      if (!seen.has(state)) {
        seen.add(state);
        states.push(state);
      }
    }
    return states.length > 0 ? states : ["Pending", "Active", "Completed"];
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
    const regex = /^#{2,3}\s+(.+(?:Service|API|Gateway|Database|Cache|Queue|Worker|Engine|Manager|Controller))/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      components.push(match[1].trim());
    }
    if (components.length === 0) {
      // Fallback: extract from headings
      const headingRegex = /^#{2,3}\s+(.+)/gm;
      while ((match = headingRegex.exec(content)) !== null) {
        components.push(match[1].trim());
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

  private extractCategories(content: string): Array<{ name: string; count: number }> {
    const categories = new Map<string, number>();
    const regex = /### (REQ-([A-Z]+)-\d{3})/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const cat = match[2];
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }
    return Array.from(categories.entries()).map(([name, count]) => ({ name, count }));
  }

  private extractTopics(content: string): Array<{ name: string; subtopics: string[] }> {
    const topics: Array<{ name: string; subtopics: string[] }> = [];
    const sections = content.split(/^##\s+/m).filter(Boolean);
    for (const section of sections) {
      const lines = section.split("\n");
      const name = lines[0]?.trim();
      if (!name) continue;
      const subtopics: string[] = [];
      for (const line of lines.slice(1)) {
        const subMatch = line.match(/^###\s+(.+)/);
        if (subMatch) subtopics.push(subMatch[1].trim());
      }
      topics.push({ name, subtopics });
    }
    return topics;
  }

  // ─── Utility ───

  private sanitize(text: string): string {
    return text.replace(/["\[\]{}()<>|]/g, "").replace(/\n/g, " ").trim().substring(0, 80);
  }

  private async safeRead(_specDir: string, featureDir: string, fileName: string): Promise<string | null> {
    try {
      return await this.fileManager.readSpecFile(featureDir, fileName);
    } catch {
      return null;
    }
  }
}
