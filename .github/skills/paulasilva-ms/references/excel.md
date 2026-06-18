# Excel (paulasilva-ms Office standard)

The full Excel standard for Microsoft-identity data deliverables: workbooks that open on a formula-driven dashboard, with KPI cards, native charts, metrics, and short explanations. This is the depth behind the short Excel section in `office.md`. Use it whenever you build, restyle, or audit an `.xlsx` for Paula Silva.

A bundled, self-contained helper lives at `scripts/build_excel_dashboard.py` (openpyxl, standard library only). Import its primitives or run it as a CLI to enhance a workbook in place.

## When to use

- Turning a raw data export or an analyst workbook into a professional, modern deliverable.
- Adding a dashboard sheet (`Painel` in PT-BR, `Dashboard`/`Summary` in EN) to an existing workbook.
- Restyling sheets to the Microsoft Office look (Segoe UI, Microsoft Blue headers, gridlines off).
- Auditing that a workbook is on-standard before it ships.

## Non-negotiable: data integrity first

- **Never fabricate, estimate, or retype a number.** Audited financial, billing, usage, and ROI values are canonical. The dashboard must **reference** existing cells by formula (for example `='Resumo do Impacto'!C9`), never hardcode the value.
- Before and after any change, snapshot every existing cell and assert nothing changed (the bundled script does this and exits non-zero on any drift).
- Treat tiny float repr differences (for example `1459.8709000000001` vs `1459.8709`) as identical doubles, not data changes.
- End data deliverables with a source line: which audited sheets or workbook the numbers came from.

## Visual standard

- **Fonts**: Segoe UI 11pt for body, Consolas for monospace or code. Never Inter or JetBrains Mono in Office (that is the web identity), never Calibri / Arial / Times New Roman.
- **Table header row**: bold white text on Microsoft Blue `#0078D4`, wrapped, row height about 24, white thin borders between header cells.
- **Data rows**: zebra striping with `#F3F2F1` on alternating rows, only where the cell has no existing fill.
- **Alignment**: numbers right-aligned, text left-aligned, dates ISO `2026-04-24`.
- **Number formats**: thousands as `#,##0`, currency as `"US$ "#,##0` or `"US$ "#,##0.00`, never invent precision the source does not have.
- **Gridlines off** on every sheet (`sheet_view.showGridLines = False`); the layout, not the grid, carries structure.
- **Freeze panes** below the header row, and an `auto_filter` over the table range.
- **Column widths** sized to content (roughly longest value + 2, capped near 46).
- **Tab color**: Microsoft Blue `#0078D4` on the dashboard tab.
- Never put the four-color `</>` web mark in an Office file.

## Palette (Office)

| Token | Hex | Use |
| --- | --- | --- |
| Microsoft Blue | `#0078D4` | header fill, eyebrow, primary accent, tab color |
| Ink | `#201F1E` | titles and KPI values |
| Gray | `#605E5C` | captions, secondary text |
| Zebra | `#F3F2F1` | alternating data rows |
| Line | `#E1DFDD` | thin borders |
| KPI accents | `#0078D4 #F25022 #107C10 #FFB900 #038387 #5C2D91` | rotate across KPI cards |

The four Microsoft logo colors may appear as chart series or KPI accents, but the logo mark itself never goes in the workbook.

## Dashboard anatomy

Insert the dashboard as the first sheet (index 0), or index 1 when a cover sheet exists. Structure top to bottom:

1. **Title block**: an eyebrow (9pt bold Microsoft Blue, for example `GITHUB COPILOT  ·  USAGE-BASED BILLING`), a 26pt bold ink title, and an 11pt gray subtitle that states the source and period.
2. **KPI cards** in bands of three. Each card is a 3-row stack: a label row (9pt bold white on an accent fill), a value row (20pt bold ink, the cell holds a **formula** that references the detail sheets, with a number format), and a caption row (9pt gray, one line of context). Cards rotate through the KPI accents.
3. **Native charts** that reference existing ranges: a bar chart for ranked categories (top models by cost), a column chart for scenarios, a line chart for a monthly trend. One series per chart, legend off, series colored from the palette.
4. **A "How to read" / "Como ler" section**: a 12pt bold ink heading then 3 to 5 bullet lines (first line ink, rest gray) that explain the source, the scenarios, and any audited limitation.
5. **A footer**: 8.5pt italic gray, the source and `Paula Silva, Software Global Black Belt, Microsoft` plus a confidentiality note.

Keep dashboard copy in the workbook's own language (PT-BR for BTG client workbooks, EN for instruments). Never let one language leak into another.

## Workbook properties

Set on every workbook:

- **Author** and **lastModifiedBy**: `Paula Silva, Software Global Black Belt`
- **Title**: the document title
- **Subject**: one sentence, for example `GitHub Copilot Usage-Based Billing`
- **Keywords**: comma-separated tags
- **Description**: short summary
- **Category** and **Company** (`Microsoft`) when supported

## Build workflow

1. **Read** every sheet and snapshot all non-empty cells (sheet, coordinate, value).
2. **Map the KPI cells**: find the exact detail cells the dashboard will reference, and confirm each holds the expected audited value (open with `data_only=True` to read the last computed values).
3. **Insert** the dashboard sheet and lay out the title, KPI cards (formulas only), charts, explanation, and footer.
4. **Restyle** existing sheets: swap the font family to Segoe UI (preserve size, bold, italic, color), detect the table header row, apply the blue header, zebra, freeze panes, auto filter, and content-based widths. Turn gridlines off.
5. **Set** workbook properties.
6. **Verify**: reload, assert every snapshotted cell is unchanged (float repr noise aside), and confirm the dashboard has the expected charts and formula KPIs.
7. **Archive** the prior file to the folder's `archive/` (for example `name_pre-dashboard.xlsx`) and keep only the latest in the folder root, per the document-organization rule.

## Using the bundled script

`scripts/build_excel_dashboard.py` ships the primitives used above: `restyle`, `set_props`, `dash_base`, `kpi`, `cards_band`, `section`, `bullets`, `footer`, and chart helpers (`bar`, `colchart`, `line`), plus a `snapshot` / `verify_unchanged` integrity pair.

As a library (recommended, so the dashboard is tailored to the real cells):

```python
import openpyxl
from build_excel_dashboard import (snapshot, verify_unchanged, restyle,
    set_props, dash_base, cards_band, bar, section, bullets, footer)

wb = openpyxl.load_workbook("BTG_Analise_Impacto.xlsx")
snap = snapshot(wb)                       # capture before any change
existing = list(wb.sheetnames)

ws = wb.create_sheet("Painel", 0)
dash_base(ws, "GITHUB COPILOT  ·  USAGE-BASED BILLING",
          "Analise de Impacto · BTG Pactual",
          "Auditoria do billing de abril de 2026. Valores vem das abas de detalhe.")
cards_band(ws, 6, [
    ("CUSTO DE TOKENS / MES", "='Resumo do Impacto'!C9", "Pre-desconto, auditado", '"US$ "#,##0'),
    ("SEAT REVENUE", "='Resumo do Impacto'!C10", "Business + Enterprise", '"US$ "#,##0'),
    ("OVERAGE PADRAO / MES", "='Resumo do Impacto'!C13", "Acima do incluido", '"US$ "#,##0'),
])
# charts reference existing ranges only; see the script docstring for Reference usage
for nm in existing:
    restyle(wb[nm])
set_props(wb, "BTG · Analise de Impacto", "Auditoria do billing de abril de 2026.")
wb.save("BTG_Analise_Impacto.xlsx")
verify_unchanged("BTG_Analise_Impacto.xlsx", snap)   # raises if any audited cell drifted
```

As a CLI smoke test (restyle every sheet, add an empty `Dashboard`, set properties, assert no data drift):

```bash
python3 scripts/build_excel_dashboard.py input.xlsx output.xlsx
```

## Pre-ship checklist

1. Dashboard is the first (or post-cover) sheet, gridlines off, tab Microsoft Blue.
2. Every KPI value is a formula that references an existing cell, no retyped numbers.
3. Charts reference existing ranges and render (open the file to confirm).
4. Author is `Paula Silva, Software Global Black Belt`; title, subject, keywords set.
5. Headers are white on `#0078D4`, data rows zebra, numbers right-aligned, dates ISO.
6. No em dashes, `GitHub Copilot` written in full, one language per workbook.
7. Snapshot verify passes: no audited cell changed.
8. Prior version archived to `archive/`, only the latest in the folder root.

## Anti-patterns

- Retyping an audited number into a KPI card instead of referencing it by formula.
- Inter or JetBrains Mono, Calibri, Arial, or Times New Roman in an Office file.
- Leaving gridlines on, or naming sheets `Sheet1` / `Sheet2`.
- The four-color `</>` web mark inside the workbook.
- Personal socials or the deprecated `Software GBB Americas` role string.
- Mixing languages inside one workbook, or an em dash anywhere.
