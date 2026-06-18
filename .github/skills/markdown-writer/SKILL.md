---
name: markdown-writer
description: "Creates professional Markdown documents with YAML frontmatter, versioning, author attribution, table of contents, and consistent formatting. Use for Markdown documents, README, ADR, spec, guide, changelog, runbook, RFC, technical docs, and converting PPTX or PowerPoint files to narrative Markdown reading editions with markitdown. Trigger on 'md file', 'markdown', '.md', 'documento markdown', 'criar um readme', 'escrever documentação', 'write a spec', 'draft a guide', 'convert PPTX to Markdown', 'extract PPTX', or 'PowerPoint to Markdown'. Do not use for creating PPTX presentations, Word documents, diagrams, or PDFs."
---
 
# Markdown Writer
 
Create professional, well-structured Markdown documents following enterprise best practices with proper metadata, versioning, and attribution.
 
## Quick Start
 
When this skill triggers:
 
1. Determine the document type (README, ADR, Spec, Guide, Changelog, Runbook, RFC, or general)
2. If the source is PPTX or PowerPoint and the target is Markdown, use the PPTX to Markdown Reading Edition workflow below
3. Apply the appropriate template and structure from this skill
4. Write the full document with YAML frontmatter, TOC, and all required sections
5. Save to `output/md/` with filename pattern `{Title}_v{version}_{YYYY-MM-DD}.md`
6. If a previous version exists, archive it to `output/md/archive/` first

## PPTX to Markdown Reading Edition

Use this workflow when the user asks to convert, extract, rewrite, or transform a PPTX or PowerPoint file into Markdown. This is not for creating a presentation. It is for creating a complete Markdown reading edition from an existing deck.

### Required conversion approach

1. Use markitdown first, preferably the `mcp_markitdown_convert_to_markdown` tool when available. For multiple local files, a local `MarkItDown().convert(path).text_content` script is acceptable if markitdown is installed in a temporary virtual environment.
2. Treat the raw markitdown output as source material, not as the final document. Do not ship a fragmented slide dump.
3. Preserve every slide in order, including all extracted on-slide text and all speaker notes.
4. Treat speaker notes as the primary narrative. They usually contain the complete spoken story and must not be dropped.
5. Create a continuous-prose reading edition. Each slide becomes a section, but the content should read like a document, not like a transcript of disconnected text boxes.
6. Remove extraction noise such as image placeholder lines, repeated deck chrome, repeated brand headers, and page numbers. Do not invent descriptions for images that were not present in the extracted text.
7. Render complete sentences as paragraphs. Keep short labels, metrics, stage names, and genuine enumerations under a short list such as `Shown on the slide:`.
8. Keep tables, formulas, URLs, and metrics exactly as extracted. Never invent or recalculate values.
9. Include a `## References` section that cites the source PPTX path.

### Output structure

Use this structure for each converted deck:

```markdown
---
title: "Deck Title"
description: "Complete reading edition of the source presentation."
author: "Paula Silva"
date: "YYYY-MM-DD"
version: "2.0.0"
status: "extracted"
tags: ["pptx-extract", "presentation", "narrative", "reading-edition"]
source: "pptx/source-file.pptx"
---

# Deck Title

> Complete reading edition of the presentation. Every slide is reproduced in order, and the points shown on each slide plus the speaker notes are woven together as continuous prose.

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0.0 | YYYY-MM-DD | Paula Silva | Continuous-prose reading edition |

## Contents

- [Slide 1: Title](#slide-1)

<a id="slide-1"></a>

## Slide 1: Title

Opening paragraph from the slide or speaker notes.

Shown on the slide:

- Short label
- Metric or stage name

Additional narrative from the speaker notes.

## References

- Source presentation: `pptx/source-file.pptx`.
```

### Quality bar

Before delivering a PPTX conversion, verify:

- The document is not just a bullet extraction.
- Speaker notes are included as readable prose.
- Repeated slide chrome and image placeholder noise are removed.
- Every source slide has a corresponding Markdown section.
- Frontmatter, change log, contents, and references are present.
- The output lives under the repository's Markdown folder, for example `md/<topic>/`, when the repository organizes documents by file type.

## Frontmatter (MANDATORY)
 
Every markdown document MUST start with YAML frontmatter. This metadata enables tooling, search, and version tracking, without it the document is just loose text.
 
```yaml
---
title: "Document Title"
description: "One-sentence summary of the document purpose"
author: "Paula Silva"
date: "YYYY-MM-DD"
version: "1.0.0"
status: "draft | review | approved | archived"
tags: ["tag1", "tag2"]
---
```
 
### Versioning Rules
 
Use [Semantic Versioning](https://semver.org/) so readers can tell at a glance how much changed:
 
- **Major (X.0.0):** Breaking changes, full rewrites, scope changes
- **Minor (1.X.0):** New sections, significant content additions
- **Patch (1.0.X):** Typos, formatting fixes, minor clarifications
### Change Log Table
 
For documents that evolve over time, include a change log right after the frontmatter so readers see the history immediately:
 
```markdown
## Change Log
 
| Version | Date       | Author      | Changes         |
|---------|------------|-------------|-----------------|
| 1.0.0   | 2026-03-09 | Paula Silva | Initial version |
```
 
## Document Structure
 
### Standard Structure
 
Every document follows this skeleton. The consistency makes documents predictable and scannable:
 
```markdown
---
[frontmatter]
---
 
# Document Title
 
> One-sentence purpose statement.
 
## Change Log
[version table]
 
## Table of Contents
[auto or manual TOC]
 
## 1. Section Title
[content]
 
### 1.1 Subsection
[content]
 
## 2. Next Section
[content]
 
## References
[cited sources with hyperlinks]
```
 
### Heading Rules
 
Headings create the document's navigation hierarchy. Breaking these rules makes TOC generation fail and confuses readers:
 
- `# H1`, document title only (exactly one per document)
- `## H2`, major sections (numbered: `## 1. Introduction`)
- `### H3`, subsections (numbered: `### 1.1 Overview`)
- `#### H4`, sub-subsections (use sparingly)
- Never skip heading levels (no H1 → H3)
### Table of Contents
 
For documents with more than 3 sections, include a TOC after the Change Log. Use markdown links to headings:
 
```markdown
## Table of Contents
 
- [1. Introduction](#1-introduction)
- [2. Architecture](#2-architecture)
  - [2.1 Components](#21-components)
  - [2.2 Data Flow](#22-data-flow)
- [3. Deployment](#3-deployment)
- [References](#references)
```
 
## Content Guidelines
 
### Text
 
- Keep paragraphs under 4 sentences, dense walls of text lose readers
- Use active voice: "The system processes..." not "The data is processed by..."
- One idea per paragraph
- Use bold for key terms on first introduction: **Model Context Protocol (MCP)**
- Use inline code for technical terms: `docker compose up`, `SKILL.md`
### Lists
 
- Use bullet lists (`-`) for unordered items (3+ items)
- Use numbered lists (`1.`) for sequential steps
- Keep list items parallel in structure (all start with verbs, or all are nouns)
- Nest at most 2 levels deep
### Tables
 
- Use tables for structured data with 3+ columns
- Always include a header row
- Align columns consistently (left for text, right for numbers)
- Keep cell content concise (< 50 chars per cell)
```markdown
| Feature     | Status      | Owner |
|-------------|-------------|-------|
| Auth module | Done        | @jane |
| API gateway | In progress | @john |
```
 
### Code Blocks
 
- Always specify the language for syntax highlighting: ` ```python `
- Keep code blocks under 30 lines, split larger examples
- Add a brief description before each code block
- Use inline code for short references: `variable`, `function()`
### Links and References
 
- Use descriptive link text: [MCP SDK documentation](https://url) not [click here](https://url)
- External links: always include the full URL
- Internal links: use relative paths from document root
- All metrics, statistics, or market claims need source hyperlinks
- Add a `## References` section at the end with numbered citations
### Images and Diagrams
 
- Use descriptive alt text: `![Architecture diagram showing the 3-tier deployment](./img/architecture.png)`
- Store images in an `img/` or `assets/` subfolder
- Prefer Mermaid diagrams over images when possible (version-controlled, editable)
## Document Type Templates
 
Use the appropriate template based on what the user needs. Each type has sections that readers of that type expect to find.
 
### README
 
Key sections: Overview, Quick Start, Prerequisites, Installation, Usage, Configuration, Contributing, License
 
### ADR (Architecture Decision Record)
 
```markdown
---
title: "ADR-NNN: Decision Title"
author: "Paula Silva"
date: "YYYY-MM-DD"
version: "1.0.0"
status: "proposed | accepted | deprecated | superseded"
tags: ["adr", "architecture"]
---
 
# ADR-NNN: Decision Title
 
## Status
Accepted
 
## Context
[What is the issue or problem that motivates this decision?]
 
## Decision
[What is the change proposed or decided?]
 
## Consequences
[What are the positive and negative results of this decision?]
 
## References
[Links to related ADRs, specs, or external resources]
```
 
### Specification
 
Key sections: Overview, Scope, Requirements (Functional / Non-functional), Design, API / Interface, Data Model, Security, Testing, References
 
### Guide / How-To
 
Key sections: Overview, Prerequisites, Step-by-step Instructions (numbered), Troubleshooting, FAQ, References
 
### Changelog
 
Follow [Keep a Changelog](https://keepachangelog.com/) format with Added, Changed, Deprecated, Removed, Fixed, Security subsections per version entry.
 
### Runbook
 
Key sections: Overview, Symptoms, Diagnosis Steps, Resolution Steps, Prevention, Escalation Path, References
 
### RFC (Request for Comments)
 
Key sections: Summary, Problem Statement, Proposal, Alternatives Considered, Decision, Implementation Plan, Open Questions, References
 
## Factual Integrity
 
This matters because documents get shared, cited, and relied upon for decisions:
 
- Never fabricate metrics, KPIs, ROI figures, market data, or statistics
- Only use data from: workspace context, user-provided materials, or credible official sources
- Credible sources include: Gartner, Forrester, IDC, McKinsey, Microsoft Learn, GitHub Blog, GitHub Blog, IEEE, ACM, HBR, official vendor docs
- Every data claim should include a hyperlink to its source
- If no credible source exists, state as assumption or omit entirely
## File Management
 
### Saving
 
- Filename pattern: `{Title}_v{version}_{YYYY-MM-DD}.md`
  - Example: `Platform_Architecture_ADR_v1.0.0_2026-03-09.md`
- Save to: `output/md/`
- Create the directory if it doesn't exist
### Versioning existing files
 
- Before overwriting, move the previous version to `output/md/archive/`
- Update the Change Log table with the new version entry
- Bump the version number in YAML frontmatter
## Quality Checklist
 
Before delivering the document, verify:
 
- YAML frontmatter present with title, author, date, version, status
- Exactly one H1 (document title)
- Heading levels are sequential (no skipping)
- Table of Contents present (for documents > 3 sections)
- Change Log present (for versioned documents)
- All code blocks have language specified
- All links are descriptive (no "click here")
- All data claims have source hyperlinks
- References section present with cited sources
- No placeholder text (TODO, TBD, [fill in])
- Paragraphs are under 4 sentences
- Lists are parallel in structure
- Filename follows the naming pattern
 