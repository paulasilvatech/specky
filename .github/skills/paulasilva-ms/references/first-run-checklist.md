# First-run checklist

The single gate that makes a paulasilva-ms deliverable correct on the first execution. Walk the common block for every artifact, then the format-specific block for what you are producing. If an item fails, fix it and re-check, do not deliver.

The validators (`scripts/validate_html.py` for HTML, the build scripts' own output checks) cover the mechanical items. The rest need a human-style read.

## 0. Before producing anything

- [ ] The source content exists and is sufficient. If only a topic was given, the outline is drafted first, not invented at write time.
- [ ] Every metric, KPI, price, quote, and benchmark has a source, or is clearly framed as an assumption. Never fabricate numbers. For GitHub Copilot UBB figures, pull from the audited source, never invent.
- [ ] The right reference files were read for the artifact (see SKILL.md routing): identity and head-meta always; plus deck, landing, playbook, excel, office, svg-icons, or svg-quality as needed.

## 1. Identity rules (non-negotiable, every artifact)

- [ ] No em dashes anywhere. Use commas, colons, parentheses, or " · ".
- [ ] "GitHub Copilot" is always the full name, never abbreviated to "Copilot".
- [ ] Author is "Paula Silva", role is "Software Global Black Belt" with no region suffix.
- [ ] `paulasilva@microsoft.com` is the only contact; no personal social handles.
- [ ] No forbidden strings: `@paulasilvatech`, `paulanunes`, `Microsoft Americas`, `Software GBB Americas`, `Microsoft Global Black Belt`.
- [ ] Microsoft 4-color palette only (`#F25022`, `#7FBA00`, `#FFB900`, `#00A4EF`); Inter and JetBrains Mono fonts.
- [ ] The 4-square logo is the Microsoft palette variant, not the personal-brand variant.

## 2. HTML deliverables (landing, deck, playbook page)

- [ ] Inline Microsoft favicon from `references/head-meta.md` is present (never an external `favicon.svg`).
- [ ] Open Graph and Twitter social preview meta are present.
- [ ] `python3 scripts/validate_html.py <file.html>` exits 0 with no errors.
- [ ] If publishing with social previews, the `preview-<locale>.png` files exist: run `python3 scripts/validate_html.py <file.html> --check-assets`.
- [ ] The file opens and renders with zero console errors.
- [ ] Trilingual artifacts (EN, PT-BR, ES) have all three locales with no language leaking into another.

## 3. Trilingual playbook (no-build multi-page)

- [ ] All three locales build from a single source of content, per `references/playbook.md` and `references/editorial-spine.md`.
- [ ] Shared CSS and JS are linked, not duplicated per page.
- [ ] The search index and navigation resolve for every chapter.

## 4. Delivery

- [ ] The file follows the naming pattern `Name_vMAJOR_MINOR_PATCH_YYYY-MM-DD_<lang>.ext`.
- [ ] The file is written to the workspace `output/` folder and surfaced to the user.
- [ ] Data deliverables end with a References section citing every source.

## Format-specific checks (only when that derivative is requested)

### PDF from a deck (`deck_to_pdf.py`)

- [ ] Dependencies present (Playwright, Chromium, pypdf); the script preflights and prints exact install steps if not.
- [ ] The output PDF exists, is non-empty, and the page count equals the slide count.
- [ ] No identity warnings in the script output (forbidden strings, abbreviated product name).

### Native PPTX (`build_pptx.py`)

- [ ] Dependencies present (python-pptx, lxml); the script preflights if not.
- [ ] The output PPTX exists and is non-empty, and the slide count is greater than zero.
- [ ] Speaker notes were embedded for the chosen locale.
- [ ] Opened once in PowerPoint or LibreOffice to confirm shapes are native and editable, with no overflow or overlap.

### Excel dashboard (`build_excel_dashboard.py`)

- [ ] Dependency present (openpyxl); the script preflights if not.
- [ ] Source data integrity preserved (the snapshot or verify step did not report drift).
- [ ] Charts and formulas render in Excel without repair prompts.

### Speaker notes export (`export_notes.py`)

- [ ] One markdown file per locale was written.
- [ ] The generated files contain no em dashes.

### SVG (icons or full graphic)

- [ ] Follows `references/svg-icons.md` and `references/svg-quality.md` (viewBox, no raster, accessible title).
- [ ] Uses the Microsoft palette tokens, not arbitrary colors.
