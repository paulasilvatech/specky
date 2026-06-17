# Architecture Diagrams Reference

Patterns for system architecture, data flow, sequence, deployment, and infrastructure diagrams. This complements `diagrams.md` (which covers Mermaid basics and SVG fundamentals) with specific patterns for architecture work.

## Choosing the right diagram type

| Goal | Type | Tool |
|---|---|---|
| Show how requests flow through services | **Sequence diagram** | Mermaid `sequenceDiagram` or hand SVG |
| Show how components relate (boxes + lines) | **Component diagram** | Mermaid `flowchart` or hand SVG |
| Show data shape and relationships | **ER diagram** | Mermaid `erDiagram` |
| Show what's deployed where (cloud, region, env) | **Deployment diagram** | Hand SVG (Mermaid weak here) |
| Show layered architecture (n-tier) | **Layer stack diagram** | Hand SVG, see DS layer-stack pattern |
| Show network paths, VPCs, subnets | **Network topology** | Hand SVG with grid layout |
| Show state transitions | **State diagram** | Mermaid `stateDiagram-v2` |
| Show timing of events | **Timing diagram** | Mermaid `gantt` (approximation) |
| Show org/structure hierarchy | **Tree / org chart** | Mermaid `flowchart TD` |

## Universal rules (apply to all architecture diagrams)

1. **Every node has a layer color.** Map to `--c-blue-500` (infra), `--c-green-500` (platform), `--c-yellow-500` (context), `--c-red-500` (intent), `--ink` (neutral / external).
2. **Direction matters.** Read top-to-bottom or left-to-right. Mixing causes confusion.
3. **No more than 12 nodes per diagram.** If you need more, split into focused sub-diagrams.
4. **Label every edge.** What flows on this line? "HTTP", "AMQP", "writes", "polls every 5s".
5. **No floating elements.** Every node connects to at least one other node, or it doesn't belong here.
6. **External systems use dashed borders.** Internal systems use solid borders. Distinguishes "what we control" from "what we depend on".
7. **No emojis as node icons.** Use SVG icons instead. Emojis render inconsistently and look amateur in technical diagrams.

## Sequence diagrams (Mermaid)

For request flow, agent orchestration, message-passing.

```
sequenceDiagram
  participant U as User
  participant API as API Gateway
  participant AG as Agent
  participant DB as Database

  U->>API: POST /analyze
  API->>AG: invoke(payload)
  AG->>DB: SELECT context
  DB-->>AG: rows
  AG-->>API: result
  API-->>U: 200 OK
```

Rules:
- Use `participant X as Label` to control display name (avoid using full sentences as IDs)
- Solid arrow (`->>`) for synchronous calls, dashed (`-->>`) for responses
- Group related messages with `Note over A,B: comment`
- Cap at 8 participants and 30 messages per diagram

Style overrides for paulasilvatech (apply via `%%{init: ...}%%` directive):

```
%%{init: {'theme':'base','themeVariables':{
  'primaryColor':'#00A4EF',
  'primaryTextColor':'#1A1A1A',
  'lineColor':'#737373',
  'fontFamily':'Inter, sans-serif'
}}}%%
sequenceDiagram
  ...
```

## Component / flowchart diagrams (Mermaid)

For showing boxes-and-arrows architecture.

```
flowchart LR
  U[User] --> LB[Load Balancer]
  LB --> API[API Service]
  API --> Q[(Queue)]
  Q --> W[Worker]
  W --> DB[(PostgreSQL)]
  W --> CACHE[(Redis)]

  classDef infra fill:#00A4EF,stroke:#0076AC,color:white
  classDef data fill:#FFB900,stroke:#B88500,color:#1A1A1A
  class LB,API,W infra
  class Q,DB,CACHE data
```

Rules:
- `LR` (left-right) for request flows. `TD` (top-down) for hierarchies / decision trees.
- Use shapes meaningfully: `[]` rectangle (service), `[()]` cylinder (data store), `{}` rhombus (decision), `(())` circle (event), `>...]` parallelogram (input).
- Apply `classDef` for layer colors (don't inline-style each node).

## Deployment diagrams (hand SVG)

Mermaid is weak for deployment views (cloud regions, VPCs, container groupings). Use SVG with a grid:

```html
<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" font-family="Inter, sans-serif">
  <!-- Region container -->
  <rect x="20" y="20" width="760" height="460" rx="8"
        fill="none" stroke="#CECEC7" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="40" y="48" font-size="11" font-family="JetBrains Mono" fill="#737373"
        letter-spacing="0.12em">REGION · BRAZILSOUTH</text>

  <!-- VPC container -->
  <rect x="40" y="68" width="380" height="380" rx="6"
        fill="#F7F7F5" stroke="#E5E5E0" stroke-width="1"/>
  <text x="56" y="92" font-size="11" font-family="JetBrains Mono" fill="#737373"
        letter-spacing="0.12em">VPC · 10.0.0.0/16</text>

  <!-- Service node inside VPC -->
  <rect x="60" y="110" width="160" height="60" rx="4"
        fill="#00A4EF" stroke="#0076AC" stroke-width="1.5"/>
  <text x="140" y="138" text-anchor="middle" font-size="13" fill="white">API Service</text>
  <text x="140" y="156" text-anchor="middle" font-size="10" font-family="JetBrains Mono"
        fill="rgba(255,255,255,0.85)">10.0.1.10</text>

  <!-- Connection line -->
  <line x1="220" y1="140" x2="320" y2="140" stroke="#737373" stroke-width="1.5"/>
  <text x="270" y="135" text-anchor="middle" font-size="10" fill="#737373">HTTPS</text>
</svg>
```

Layout grid: snap nodes to 20px or 40px increments. Visual rhythm matters more than exact dimensions.

## Layer stack diagram (hand SVG)

The signature paulasilvatech architecture viz: stacked layers with the four DS colors, optional accent badges per layer.

```html
<svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" font-family="Inter, sans-serif">
  <!-- Intent layer (top, red) -->
  <rect x="40" y="40" width="520" height="60" rx="4" fill="#F25022"/>
  <text x="60" y="68" fill="white" font-size="14" font-weight="500">Intent</text>
  <text x="60" y="86" fill="rgba(255,255,255,0.85)" font-size="11"
        font-family="JetBrains Mono">specs · personas · prompts</text>

  <!-- Context layer (yellow) -->
  <rect x="40" y="115" width="520" height="60" rx="4" fill="#FFB900"/>
  <text x="60" y="143" fill="#1A1A1A" font-size="14" font-weight="500">Context</text>
  <text x="60" y="161" fill="rgba(26,26,26,0.7)" font-size="11"
        font-family="JetBrains Mono">code · docs · MCP servers</text>

  <!-- Platform layer (green) -->
  <rect x="40" y="190" width="520" height="60" rx="4" fill="#7FBA00"/>
  <text x="60" y="218" fill="white" font-size="14" font-weight="500">Platform</text>
  <text x="60" y="236" fill="rgba(255,255,255,0.85)" font-size="11"
        font-family="JetBrains Mono">agents · tools · orchestration</text>

  <!-- Infrastructure layer (bottom, blue) -->
  <rect x="40" y="265" width="520" height="60" rx="4" fill="#00A4EF"/>
  <text x="60" y="293" fill="white" font-size="14" font-weight="500">Infrastructure</text>
  <text x="60" y="311" fill="rgba(255,255,255,0.85)" font-size="11"
        font-family="JetBrains Mono">compute · storage · network</text>
</svg>
```

Order top-to-bottom: Intent → Context → Platform → Infrastructure (the same order as the layered DS color story).

## Network topology (hand SVG)

For showing subnets, security groups, traffic paths. Use a "rack" grid.

Pattern:
- Internet at top (cloud icon)
- Public subnet directly below (LBs, NAT gateways)
- Private subnet below (services, workers)
- Data subnet at bottom (DBs, caches)
- Vertical lines for traffic flow, labeled with port/protocol

Visual conventions:
- Public: solid boundary, top
- Private: solid boundary, middle
- Data: solid boundary, bottom, often with a dashed `subnet` annotation
- External (third-party APIs): dashed boundary, off to the side

## Decision trees / process flows (Mermaid TD)

For showing branching logic, decision points, agent routing.

```
flowchart TD
  Start([Receive request]) --> Auth{Authenticated?}
  Auth -- No  --> Reject[Return 401]
  Auth -- Yes --> Route{Type?}
  Route -- Read  --> Cache[Try cache]
  Cache -- Hit  --> Return1[Return cached]
  Cache -- Miss --> Fetch[Query DB]
  Route -- Write --> Validate[Validate payload]
  Validate --> Save[Save to DB]
  Save --> Return2[Return 201]
```

Rules:
- Start nodes use stadium shape `([...])`
- End nodes use double-bordered `[[...]]` or just plain rectangles
- Decision points use rhombus `{...}` with yes/no on edges
- Don't go more than 4 levels deep, split into sub-flows

## Anti-patterns (architecture diagrams)

- **The everything diagram**: 30+ nodes, every service shown, no clear story. Split into focused diagrams per concern.
- **Inconsistent direction**: arrows pointing every which way. Pick one primary direction (LR or TD) and stick to it.
- **Unlabeled edges**: lines between nodes with no label. The edge IS the architecture; without labels, you have boxes floating in space.
- **Color salad**: every node a different color. Apply layer colors meaningfully (infra blue, platform green, etc.); use neutral gray for utility nodes.
- **Tiny text**: 8pt labels nobody can read. Minimum 11pt for labels, 13pt for node names.
- **Mermaid for things Mermaid is bad at**: don't force a deployment diagram into `flowchart`. Switch to hand SVG.
- **Floating notes / legends**: if your diagram needs a 5-line legend to be understood, the diagram is unclear. Refactor.

## Pre-publish checklist

- [ ] Diagram has a single, primary direction (LR or TD)
- [ ] Every node has a layer color OR neutral gray (no random palette)
- [ ] Every edge is labeled
- [ ] Node count ≤ 12 (or split into multiple)
- [ ] External systems shown with dashed borders
- [ ] No emoji icons (use SVG instead)
- [ ] Labels readable at slide-render size (≥ 11pt at 1600x900)
- [ ] Diagram renders without errors (test in browser, not just preview)
