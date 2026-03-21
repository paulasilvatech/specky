Use $ARGUMENTS as the user's input for this SDD OneDrive batch command.

## Purpose

Process all meeting transcripts saved by the Copilot Studio transcription agent to the OneDrive Transcripts folder. Generates a complete SDD specification package for each transcript automatically.

## Workflow

1. Determine the OneDrive transcripts folder:
   - Default: `~/OneDrive/Recordings/Transcripts-Markdown/`
   - If $ARGUMENTS contains a path, use that instead
   - Common macOS variations:
     - `~/OneDrive - Microsoft/Recordings/Transcripts-Markdown/`
     - `~/Library/CloudStorage/OneDrive-Microsoft/Recordings/Transcripts-Markdown/`
     - `~/Library/CloudStorage/OneDrive-CompanyName/Recordings/Transcripts-Markdown/`

2. Call `sdd_batch_transcripts` with:
   - `transcripts_dir`: the resolved OneDrive folder path (relative to workspace root, or use SDD_WORKSPACE to set workspace to home dir)
   - `force`: false (do not overwrite existing specs)

3. Present the batch results:
   - Total transcripts found
   - How many succeeded / failed
   - Total EARS requirements generated across all meetings
   - List each meeting with its project name and feature number

4. For each generated spec package, briefly list:
   - Participants detected (from YAML frontmatter + Meeting Details table)
   - Topics extracted (from ## 3. Main Topics section)
   - Action Items (from ## 5. Action Items section)
   - Requirements count

## Copilot Studio Agent Format

The transcripts follow this exact Markdown format produced by the Copilot Studio transcription agent:

```markdown
---
title: "Meeting Title"
description: "One-sentence summary"
author: "Paula Silva"
date: "YYYY-MM-DD"
version: "1.0.0"
status: "approved"
type: "meeting-transcription"
language: "en | pt-BR | es"
tags: ["meeting", "transcription", "teams"]
---

# Meeting Title

> One-sentence meeting purpose statement.

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | Paula Silva | Initial transcription |

## Table of Contents
...

## 1. Executive Summary
- Bullet point summaries

## 2. Meeting Details
| Field | Value |
|-------|-------|
| **Participants** | Name1, Name2 |

## 3. Main Topics
1. Topic one
2. Topic two

## 4. Complete Transcription
**Speaker Name:** What they said...

## 5. Action Items
- [ ] Owner: Task description by deadline

## References
- Links mentioned
```

Specky auto-detects this format and extracts:
- **Title** from YAML frontmatter `title` field
- **Date** from YAML frontmatter `date` field
- **Language** from YAML frontmatter `language` field
- **Participants** from Meeting Details table + speaker names in transcription
- **Topics** from ## 3. Main Topics numbered list
- **Decisions** from transcription text (pattern matching)
- **Action Items** from ## 5. Action Items checkboxes
- **Requirements** from transcription content (NLP extraction)
- **Constraints** from transcription content (budget, deadlines, compliance)

## File Naming Convention

Copilot Studio agent saves files as: `{MeetingTitle}_v{version}_{YYYY-MM-DD}.md`
Example: `Sprint_Planning_Q2_v1.0.0_2026-03-20.md`

Specky converts to feature dirs: `.specs/001-sprint-planning-q2-v1-0-0-2026-03-20/`

## Supported Languages

The Copilot Studio agent outputs in English, Portuguese (pt-BR), or Spanish.
Specky handles all three — section headers are always in English, content stays in original language.

## Tools Used

- `sdd_batch_transcripts`: Main tool — processes all transcripts in the folder
- `sdd_import_transcript`: Preview — parse without generating specs
- `sdd_get_status`: Check status of any individual feature after processing

## Examples

```
/sdd:onedrive
/sdd:onedrive ~/OneDrive/Recordings/Transcripts-Markdown/
/sdd:onedrive /Users/paula/Library/CloudStorage/OneDrive-Microsoft/Recordings/Transcripts-Markdown/
```
