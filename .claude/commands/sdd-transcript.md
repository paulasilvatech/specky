Use $ARGUMENTS as the user's input for this SDD transcript command.

## Purpose

Automatically convert a meeting transcript (Teams VTT, Zoom SRT, or any text) into a complete SDD specification package. One command, full pipeline.

## Workflow

1. Parse $ARGUMENTS to identify:
   - **File path**: If $ARGUMENTS contains a file path (e.g., `meeting.vtt`, `transcript.txt`), use it as `file_path`
   - **Project name**: Extract or ask for a kebab-case project name
   - If $ARGUMENTS is empty, ask the user: "Provide the transcript file path and project name (e.g., `/sdd:transcript meeting.vtt my-project`)"

2. Call `sdd_auto_pipeline` with:
   - `file_path`: the transcript file path
   - `project_name`: the project name in kebab-case
   - This single call will:
     - Parse the VTT/SRT/TXT/MD transcript
     - Extract participants, topics, decisions, action items
     - Generate EARS requirements automatically
     - Write CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, ANALYSIS.md, and TRANSCRIPT.md

3. Present the results to the user:
   - Show participants detected
   - Show topics extracted
   - Show number of requirements generated
   - Show decisions captured
   - Show gate decision (APPROVE / CHANGES_NEEDED / BLOCK)

4. Ask the user to review each file:
   - "Review `.specs/001-{project}/SPECIFICATION.md` — are the EARS requirements accurate?"
   - "Review `.specs/001-{project}/DESIGN.md` — add Mermaid diagrams if needed"
   - "Review `.specs/001-{project}/TASKS.md` — adjust priorities and effort"

## Alternative: Import Only

If the user only wants to see what's in the transcript without generating specs:
- Call `sdd_import_transcript` with the file path
- Present the extracted data: topics, decisions, action items, requirements
- Ask if they want to proceed with `sdd_auto_pipeline`

## Supported Formats

- `.vtt` — Microsoft Teams, WebVTT standard
- `.srt` — Zoom, SubRip subtitle format
- `.txt` — Plain text (Speaker: text format)
- `.md` — Markdown (**Speaker:** text format)
- Otter.ai exports (TXT format)
- Google Meet exports (SRT format)

## Tools Used

- `sdd_auto_pipeline`: Full automated pipeline from transcript (primary)
- `sdd_import_transcript`: Parse transcript only, no file generation (preview mode)
- `sdd_get_status`: Check pipeline status after generation

## Examples

```
/sdd:transcript meeting.vtt ecommerce-platform
/sdd:transcript ./transcripts/sprint-planning.srt my-api
/sdd:transcript notes.txt project-alpha
```
