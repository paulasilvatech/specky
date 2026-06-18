# PDF Generation from HTML Decks

This is the canonical pattern for converting any paulasilva-ms HTML deck (the engine bundled in `assets/deck.html`) into a vector PDF. The output is selectable text, not a screenshot. Every paulasilva-ms deck deliverable should ship in BOTH HTML and PDF format.

## Why vector PDF, not screenshots

A screenshot-based PDF (rasterized PNGs combined into a PDF) is **wrong** because:
- Text becomes uneditable, unsearchable, and unselectable
- File size balloons (10+ MB for a 40-slide deck)
- Resolution is fixed at capture time, no zoom-in clarity
- Accessibility tools cannot read it

Use Playwright's `page.pdf()` method, which renders the DOM directly to a vector PDF.

## Required tools

- Python 3.10+
- `playwright` (with chromium installed: `playwright install chromium`)
- `pypdf` (for merging per-slide PDFs)

```bash
pip install playwright pypdf
playwright install chromium
```

## The pattern (high level)

1. Load the deck HTML in headless Chromium
2. Inject CSS overrides (hide chrome, force animations to final state)
3. For each slide: navigate via `goToSlide(i)`, wait, generate per-slide PDF
4. Merge per-slide PDFs into one file using `pypdf`
5. Add document metadata (Title, Author, Subject, Creator)

## The full script

The reusable script lives at `scripts/deck_to_pdf.py`. Run it with:

```bash
python3 scripts/deck_to_pdf.py \
  --input /path/to/deck.html \
  --output /path/to/deck.pdf \
  --title "Hackathon SERPRO 2026 - Agentic DevOps Platform" \
  --author "Paula Silva, Software Global Black Belt" \
  --subject "Brasilia, 28 e 29 de abril de 2026"
```

If you need to tweak it inline for a one-off, copy the pattern below into a Python REPL or notebook.

## Critical CSS overrides

These are injected via `page.add_style_tag()` BEFORE generating any PDF. Without them, the output looks broken.

```css
/* Hide deck navigation chrome */
.deck-controls, .kbd-hint, .deck-progress { display: none !important; }
html, body { background: white !important; }

/* Force ALL animations to their final state.
   The deck engine uses fadeUp + stagger animations on .eyebrow, .title,
   .subtitle, .meta-grid, .stagger > *, etc. Without this override, slides
   with stagger lists export with the last items still at opacity 0.x or 0.0,
   because page.pdf() captures mid-animation. */
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-fill-mode: forwards !important;
  transition: none !important;
}
.slide[data-active="true"] .eyebrow,
.slide[data-active="true"] .title,
.slide[data-active="true"] .subtitle,
.slide[data-active="true"] .body-large,
.slide[data-active="true"] .meta-grid,
.slide[data-active="true"] .section-number,
.slide[data-active="true"] .section-title,
.slide[data-active="true"] .big-number,
.slide[data-active="true"] .stagger > *,
.slide[data-active="true"] .bar-fill {
  opacity: 1 !important;
  transform: none !important;
}
```

## Page.pdf() configuration

```python
page.pdf(
    path=per_slide_pdf_path,
    width='1600px',          # match deck stage width
    height='900px',          # match deck stage height (16:9 at this scale)
    print_background=True,   # crucial for dark slides and colored cards
    margin={'top':'0','bottom':'0','left':'0','right':'0'},
)
```

The deck engine renders into a 1600x900 viewport. Match these exact dimensions or backgrounds will not align.

## Why one PDF per slide, then merge

`page.pdf()` renders the **current viewport state** as a single page. The deck engine uses absolute positioning where all slides occupy the same coordinates and only the active one is visible, so a "full page" PDF would render only the first slide. The reliable approach is:

1. Navigate to slide i via `goToSlide(i)`
2. Wait ~500ms for any pending state update
3. Render that slide as a one-page PDF
4. Repeat for all slides
5. Merge with pypdf

## Document metadata

After merging, set proper PDF metadata so the file is self-identifying:

```python
writer.add_metadata({
    '/Title': 'Hackathon SERPRO 2026 - Agentic DevOps Platform',
    '/Author': 'Paula Silva, Software Global Black Belt',
    '/Subject': 'Brasilia, 28 e 29 de abril de 2026',
    '/Creator': 'paulasilva-ms',
})
```

For paulasilva-ms identity, `/Author` should always be `Paula Silva, Software Global Black Belt` (formal role, no comma alternatives like "AI-Native Software Engineer").

## File naming convention

The PDF filename mirrors the source HTML, just swap the extension:

```
Hackathon_SERPRO_2026_Deck_v3_0_0_2026-04-24_pt-br.html
                                                  ↓
Hackathon_SERPRO_2026_Deck_v3_0_0_2026-04-24_pt-br.pdf
```

Both files are written to a workspace `output/` folder for delivery.

## Validation checklist (run before delivering)

After generating, validate the PDF:

```python
from pypdf import PdfReader
r = PdfReader('output.pdf')
assert len(r.pages) == EXPECTED_SLIDE_COUNT
assert 'Software Global Black Belt' in r.pages[0].extract_text()
assert 'paulasilva@microsoft.com' in r.pages[0].extract_text() or \
       'paulasilva@microsoft.com' in r.pages[-1].extract_text()
# Sanity-check forbidden personal-identity strings
combined = '\n'.join(p.extract_text() for p in r.pages)
assert 'AI-Native Software Engineer' not in combined
assert '@paulasilvatech' not in combined
assert 'agenticdevopsplatform' not in combined
```

Also do a visual spot-check: convert 3-4 pages to PNG with `pdftoppm` and view.

## Common failures and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slides 2-N show only the cover content | `goToSlide()` not called or fails silently | Verify `typeof goToSlide !== 'undefined'` after page load. If undefined, the deck script crashed (often due to JS syntax error) |
| Last items in stagger lists are faded / invisible | Animations still mid-flight when `page.pdf()` runs | Apply the CSS override above (force opacity:1 and transform:none) |
| Backgrounds are white where they should be dark | `print_background: false` (the default) | Always pass `print_background=True` |
| PDF cuts off content / has weird page sizes | `page.pdf()` width/height don't match the deck stage | Use exactly `width='1600px'`, `height='900px'` (matching the deck stage) |
| File size > 10 MB | Probably rasterized somewhere (e.g., big PNG bg-images) | Inspect deck for `<img>` tags or CSS `background-image: url(...)`. SVG inline is cheaper |
| `goToSlide` is undefined | The `I18N` const is being redeclared in the same scope causing SyntaxError | Search for duplicate `const I18N` declarations. Each deck must have exactly one |
| Counter shows "1 / 50" hardcoded for a 41-slide deck | Counter HTML in `deck-controls` was copied from another deck | Update the literal `1 / N` in the HTML to match actual slide count, OR rely on the engine's auto-update |

## Edge cases

**Deck has lang-switcher (multi-locale):** PDF should be generated in ONE locale per file. Force the locale before the loop with `page.evaluate("setLocale('pt-BR')")` (or `'en'`, `'es'`). Generate separate PDFs per locale.

**Deck has interactive widgets (calculators, sims, video):** These render their initial state in PDF. Document this as a limitation and link the interactive HTML in the slide footer as the source of truth.

**Deck uses external fonts via Google Fonts:** Wait for font load before generating: `page.wait_for_load_state('networkidle')` and an additional ~1.5s delay.

**Deck embeds external images:** Make sure `wait_until='networkidle'` is set on `page.goto()` so images load before screenshots/PDFs.

## Why this is encoded in the skill

This pattern was validated on the SERPRO 2026 deck (41 slides, 3.69 MB output, all text selectable). The animation override and the per-slide loop are non-obvious, discovering them took several iterations. Codifying here prevents redoing the discovery on future decks.
