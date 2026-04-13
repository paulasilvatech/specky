---
name: SDD Markdown Standard
description: "This skill should be used when generating or formatting SDD artifacts (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, ANALYSIS.md). Also trigger on 'sdd markdown', 'artifact format', or 'spec formatting'."
---

# SDD Markdown Standard

## Overview

Consistent markdown formatting across all SDD artifacts ensures readability, machine parsing, and professional presentation. Use this standard for CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, VERIFICATION.md, and ANALYSIS.md.

## Frontmatter Format

All SDD artifacts begin with YAML frontmatter:

```yaml
---
title: [Artifact Name]
phase: [0-9]
version: [X.Y.Z]
date: [YYYY-MM-DD]
author: [Name/Agent]
status: [DRAFT | IN_REVIEW | APPROVED]
revision_history:
  - version: "1.0.0"
    date: "2026-04-13"
    changes: "Initial version"
  - version: "1.0.1"
    date: "2026-04-14"
    changes: "Added security requirements"
---
```

## Heading Structure

Use hierarchical heading levels (H1-H4) with consistent naming:

```markdown
# Document Title (H1)
Top-level document heading, one per file

## Major Section (H2)
Primary content divisions

### Subsection (H3)
Detailed topic areas

#### Detail Level (H4)
Granular points within subsections
```

Do not skip heading levels. Proceed H1 → H2 → H3 → H4 sequentially.

## REQ-ID Format (Requirements)

Identify all requirements with globally unique IDs:

```
REQ-[DOMAIN]-[NNN]
```

Components:
- **REQ** — Fixed prefix for requirement
- **DOMAIN** — Two to four letter domain code (AUTH, PAYMENT, API, SEARCH, ADMIN)
- **NNN** — Three-digit sequential number within domain (001-999)

Examples:
- `REQ-AUTH-001` — Authentication requirement 1
- `REQ-PAYMENT-015` — Payment domain requirement 15
- `REQ-API-042` — API contract requirement 42

Usage in specifications:
```markdown
### Authentication
REQ-AUTH-001: The system shall validate credentials against the user database.

REQ-AUTH-002: If credentials are invalid, then system shall increment failed 
login counter and shall lock account after 5 failed attempts.

REQ-AUTH-003: When account is locked, then system should send security alert 
email to registered address.
```

Track requirements by domain and number sequentially. Never reuse IDs.

## Table Formatting

Use markdown table syntax with consistent column alignment:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Left align | Center | Right align |
| Data | Data | Data |
```

For multi-line cells, embed line breaks:
```markdown
| Requirement | Implementation | Status |
|---|---|---|
| REQ-AUTH-001<br/>Validate password | Password regex + hash check | Complete |
| REQ-AUTH-002<br/>Lock on 5 failures | Counter in user record | In progress |
```

For specification tables, include requirement IDs and status:

```markdown
| REQ-ID | Requirement | Status | Coverage |
|--------|-------------|--------|----------|
| REQ-AUTH-001 | Validate credentials | IMPLEMENTED | Unit tested |
| REQ-AUTH-002 | Lock account on failures | IMPLEMENTED | E2E tested |
| REQ-AUTH-003 | Send alert email | DEFERRED | Planned v2 |
```

## Mermaid Diagram Conventions

Embed system diagrams using Mermaid syntax for version control:

```markdown
### System Architecture

\`\`\`mermaid
graph LR
  A[API Gateway] --> B[Auth Service]
  A --> C[User Service]
  B --> D[(User DB)]
  C --> D
  C --> E[Cache]
\`\`\`
```

Supported diagram types:
- **graph/flowchart** — Process flows, decision trees
- **sequenceDiagram** — Message sequences between components
- **classDiagram** — Data models and relationships
- **stateDiagram** — State machines and workflows
- **erDiagram** — Entity relationship diagrams
- **gantt** — Timeline and schedule visualization

Keep diagrams simple and legible. Use descriptive node labels. Embed context above diagram:

```markdown
### Deployment Topology
Shows the runtime distribution across cloud infrastructure.

\`\`\`mermaid
graph TB
  Client[Client Browser]
  CDN[CloudFront CDN]
  ALB[Application Load Balancer]
  ECS1[ECS Task 1]
  ECS2[ECS Task 2]
  RDS[(RDS Aurora)]
  
  Client --> CDN
  CDN --> ALB
  ALB --> ECS1
  ALB --> ECS2
  ECS1 --> RDS
  ECS2 --> RDS
\`\`\`
```

## Code Block Formatting

Use fenced code blocks with language specification:

```markdown
\`\`\`javascript
// Code example with syntax highlighting
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
\`\`\`
```

For inline code, use backticks: `` `variable_name` ``

## Versioning Scheme

Track artifact versions separately from project version:

**Artifact Version:** `MAJOR.MINOR.PATCH`

- **MAJOR** — Breaking changes (restructure, significant requirement changes)
- **MINOR** — Additions without breaking changes (new sections, new requirements)
- **PATCH** — Corrections and clarifications (typos, wording improvements)

Increment independently per artifact. Include revision history in frontmatter:

```yaml
version: "1.2.3"
revision_history:
  - version: "1.2.3"
    date: "2026-04-15"
    author: "Claude Opus"
    changes: "Added security requirements REQ-SEC-001 to REQ-SEC-005"
  - version: "1.2.2"
    date: "2026-04-14"
    author: "Alice Smith"
    changes: "Clarified API response format in REQ-API-003"
  - version: "1.2.1"
    date: "2026-04-13"
    author: "Claude Opus"
    changes: "Fixed typo in REQ-AUTH-002"
```

## Lists and Nesting

Use consistent list formatting:

**Unordered lists:**
```markdown
- Top-level item
  - Nested item
    - Deeply nested item
```

**Ordered lists:**
```markdown
1. First step
   1. Sub-step
   2. Sub-step
2. Second step
```

**Mixed lists:**
```markdown
- Feature category
  1. Implementation detail
  2. Implementation detail
- Another category
  1. Implementation detail
```

## Special Section Patterns

### Conditional Requirements
```markdown
REQ-AUTH-004: If user role is admin, then system shall grant access to 
configuration panel. If user role is editor, then system shall grant read-only 
access to configuration panel. If user role is viewer, then system shall deny 
access to configuration panel.
```

### Prerequisites/Constraints
```markdown
### Constraints

- C-001: Must maintain backward compatibility with API v1
- C-002: Database migrations must support rollback
- C-003: Zero-downtime deployment required
- C-004: Maximum 100ms API response time at p99
```

### Approval Gates
```markdown
## Sign-Off

- [ ] Product Manager: [Name] — Date: ____
- [ ] Tech Lead: [Name] — Date: ____
- [ ] Security: [Name] — Date: ____
- [ ] Compliance: [Name] — Date: ____

**Status:** Draft (awaiting approvals)
```

## Markdown Linting Rules

Enforce consistency:
- One blank line between sections (not two)
- No trailing whitespace
- Consistent punctuation (periods at end of bullets with full sentences)
- No orphaned headers (avoid single H3 under H2 without content)
- Links formatted as `[text](url)` not raw URLs
- Line length target: 100 characters (hard limit 120)

Run markdown linter: `markdownlint sdd-artifacts/`
