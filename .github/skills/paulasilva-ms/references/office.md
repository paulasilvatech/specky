# Office Format Reference (paulasilva-ms)

Word, PowerPoint, Excel rules for Microsoft-identity output. These follow Microsoft document conventions, not the HTML/web Inter+JetBrains Mono system.

## Why different from HTML

Office documents will be edited and reused inside Microsoft (and by clients on Microsoft tooling). They need to:
- Open without font substitution warnings → use Segoe UI (default Windows / Office font)
- Match Microsoft brand expectations → Microsoft Blue `#0078D4` for accents
- Carry the formal MS authorship explicitly in every header/footer

## Typography (Office only)

| Element | Font | Size | Weight |
|---|---|---|---|
| Body text | Segoe UI | 11pt | Regular (400) |
| H1 / Title | Segoe UI | 24pt | Semibold (600) |
| H2 | Segoe UI | 18pt | Semibold (600) |
| H3 | Segoe UI | 14pt | Semibold (600) |
| Code / monospace | Consolas | 10pt | Regular |
| Footnote / caption | Segoe UI | 9pt | Regular |

Do not use Inter or JetBrains Mono in Office documents. They are not pre-installed on Windows and will substitute.

## Color palette (Office)

Microsoft brand colors. Use sparingly, most Office docs are mostly black-on-white.

| Token | Hex | Use |
|---|---|---|
| MS Blue | `#0078D4` | Primary accent, hyperlinks, header bar |
| MS Blue Dark | `#005A9E` | Visited links |
| Body ink | `#1A1A1A` | Body text |
| Subtle text | `#605E5C` | Footnotes, captions |
| Rule | `#E1DFDD` | Table borders, dividers |
| Background tint | `#F3F2F1` | Subtle table row stripe |

## Header / footer (mandatory in every Word doc)

**Header:** company line on the right, page number on the left.

```
                                              Paula Silva, Software Global Black Belt
```

**Footer:** document info on left, page count on right.

```
Document title v1.0.0  |  2026-04-24                                          Page 1 of N
```

The header and footer should appear on every page including the cover (no special first-page suppression).

## Cover page (Word)

```
[blank top quarter]

Document Title
Subtitle if needed

[short description, 2-3 lines]

Paula Silva
Software Global Black Belt
paulasilva@microsoft.com

Date · Version
```

Set the title in 28pt Segoe UI Semibold, subtitle in 16pt Regular, body in 11pt.

## PowerPoint slides

Slide deck for client presentations:

- 16:9 aspect ratio
- Master template uses Segoe UI throughout
- Slide title at 32pt Semibold, body bullets at 16pt
- Footer shows `Paula Silva | Software Global Black Belt | paulasilva@microsoft.com`
- Slide number bottom right

Content rules same as the HTML deck (see `references/deck.md`): one idea per slide, split a slide rather than cramming it, and no cap on slide count.

## Excel

For data deliverables, dashboards, or financial/operational tracking:

- First row: bold header in MS Blue `#0078D4` background, white text
- Subsequent rows: alternating background (`#F3F2F1` for even rows)
- Numbers right-aligned, text left-aligned
- Date columns formatted as ISO `2026-04-24`
- Sheet 1 is named `Summary`, additional sheets are named descriptively (not "Sheet1", "Sheet2")
- Workbook properties: Author = `Paula Silva, Software Global Black Belt`

For the full Excel module (the formula-driven dashboard pattern with KPI cards, native charts, metrics and explanations, the data-integrity rules, the build workflow, and a bundled openpyxl helper), see `excel.md` and `scripts/build_excel_dashboard.py`.

## Document properties (all Office formats)

Set these in File → Properties → Advanced Properties:

- **Title**: Document title
- **Author**: `Paula Silva, Software Global Black Belt`
- **Subject**: One-sentence description
- **Keywords**: comma-separated tags
- **Comments**: short summary

## Email (Outlook signature for paulasilva-ms)

```
Paula Silva
Software Global Black Belt
paulasilva@microsoft.com
```

Three lines, no logo, no tagline, no socials. Outlook will format as plain text or with the user's chosen font, do not embed an HTML signature with Inter / JetBrains Mono fonts.

## Anti-patterns

- Never use Inter or JetBrains Mono in Office files (font substitution issue)
- Never include personal socials (GitHub, LinkedIn, personal site) in Microsoft documents
- Never use `Microsoft Americas` or `Software GBB Americas` (deprecated), always `Software Global Black Belt`
- Never use Calibri / Times New Roman / Arial, Segoe UI is the standard
- Never put the four-color `</>` mark in Office documents (that is a web-identity mark)
