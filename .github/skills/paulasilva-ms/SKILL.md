---
name: paulasilva-ms
description: Apply the paulasilva-ms Design System (Microsoft identity) to any visual or editorial output signed by Paula Silva as Software Global Black Belt. Forks the paulasilvatech DS, keeping the same logo shape and tokens but using the Microsoft 4-color palette in the logo, with different author attribution, role string, and contact (single email, no socials). Use for Microsoft-facing material, internal decks, workshop guides, client proposals, formal documents, multi-page playbooks, runbooks. Also covers deck export to vector PDF and to native editable PPTX (both per locale, with trilingual speaker notes), and the no-build multi-page trilingual playbook pattern (EN, PT-BR, ES). Trigger on "MS identity", "identidade Microsoft", "Software Global Black Belt", "paulasilva-ms", "deck Microsoft", "playbook multi-page", "playbook trilingue", "gerar PDF do deck", "deck to PDF", "deck to PPTX", "PPTX editavel", "speaker notes", or any Microsoft-authored output. Required to keep personal and corporate channels separated.
---

# paulasilva-ms Skill (v1.8.0)

Microsoft identity fork of the paulasilvatech Design System for Paula Silva, Software Global Black Belt. Same visual system shape, formal author attribution, single-channel contact, multi-page trilingual playbook architecture.

## What's new in v1.8.0

Native editable PPTX export for decks.

| Change | Detail |
|---|---|
| `scripts/build_pptx.py` ⭐ **new** | Turns a paulasilva-ms HTML deck into a fully native, editable PowerPoint file. Every box, line, table, and word is a native shape; nothing is a flattened image. Reads an embedded JSON manifest plus the deck's `I18N` block, so the HTML stays the single source. Renders 10 slide archetypes (cover, divider, list, question-grid, pillar-grid, layer-rows, roadmap-rows, chapter-cover, two-col, final). Writes speaker notes into the native PowerPoint notes pane. `--locale` is required. |
| `scripts/export_notes.py` ⭐ **new** | Exports the deck's `I18N[locale].notes` to one markdown file per locale (`{base}_notes_en.md`, `_pt-br.md`, `_es.md`). These are the files `build_pptx.py` reads for the PowerPoint notes pane. Run it whenever a deck is generated. |
| `scripts/deck_to_pdf.py` **`--locale` now required** | A PDF is a single-language deliverable, so the language must always be stated. No default locale. |
| `references/deck.md` | New sections: the export workflow (PDF and PPTX, both per locale), the deck manifest spec, the 10 PPTX archetypes and their content shape, the speaker-notes markdown export. |

## What's new in v1.7.2

Deck capability and editorial pass.

| Change | Detail |
|---|---|
| `assets/deck.html` ⭐ **speaker notes added** | The engine now has a trilingual speaker-notes panel. Notes live in `I18N[locale].notes` keyed `s1`, `s2`, and so on; press `N` to toggle the panel; it follows the language switcher and is hidden in PDF and print output. Documented in `references/deck.md`. |
| `references/deck.md` **no length caps** | The old "editorial contract" capped items per slide and implied a deck length. Reframed: there is no limit on slide count, a deck is as long as the material requires. The per-slide guidance is now about density, not a cap. |
| `references/deck.md` **pattern catalog routing** | The deck path now explicitly routes to `assets/showcase.html` as the catalog of slide patterns (big-number, split-layout, question-grid, pillar-grid, layer-pyramid, diagrams, charts, UI simulations), so decks are built with the full visual vocabulary, not just plain lists. |
| `references/office.md` | Removed the per-slide bullet cap, aligned with the deck.md density guidance. |

## What's new in v1.7.1

Deck path correctness pass. The deck reference docs had drifted away from the actual `assets/deck.html` engine, which caused decks to come out with wrong colors, broken layout, and identity leaks.

| Fixed | What was wrong |
|---|---|
| `references/deck.md` ⭐ **rewritten and consolidated** | `deck.md` and `deck-engine-v5.md` were two near-duplicate, partly contradictory files. Merged into one. Now points at the real `assets/deck.html` (the old docs referenced a non-existent `deck_5.html`), documents the real `--ps-color-*` token namespace the engine uses, and gives a clear copy-the-asset workflow instead of "paste 140KB of script here". |
| `references/deck-engine-v5.md` **removed** | Merged into `references/deck.md`. Its final-slide template also shipped forbidden personal strings (LinkedIn, personal site). |
| `references/identity.md` **rewritten** | The logo SVG markup used the personal palette (`#FF3133 ...`), which is forbidden in MS output. Corrected to the Microsoft palette. Now also documents the 2x2 squares chrome the deck actually uses, and the chrome-bar leak check. |
| `assets/deck.html` | The chrome bar still read `paulasilvatech · context platform stack` (personal brand label). Corrected to the identity-locked `Paula Silva \| Software Global Black Belt`. |
| `SKILL.md` Step 4 routing | Deck path now also loads `identity.md` and `voice.md`, which it previously did not. |

## What's new in v1.7.0

Major rework of the playbook pattern, from single-page to multi-page with single-source trilingual content.

| New / rewritten | Purpose |
|---|---|
| `assets/playbook/` ⭐ **new folder** | Multi-page playbook template, replaces the old single-page `assets/playbook.html`. One HTML per chapter, shared CSS and JS in `shared/`, single-source trilingual content in `shared/content/*.js`, no toolchain. Chrome bar with `</>` SVG logo (Microsoft 4-color palette: `#F25022 / #7FBA00 / #FFB900 / #00A4EF`) plus role text. Landing page with hero, stat-grid, chapter-grid. Chapter pages with breadcrumb, doc-hero, 3-column layout (TOC, content, scrollspy), pagenav. Search modal triggered by `/` key. Keyboard shortcuts. Dark mode with low-contrast fixes for active TOC item, eyebrows, footnote refs. |
| `references/playbook.md` ⭐ **rewritten** | Full reference for the new multi-page architecture: directory layout, identity-locked strings, `data-i18n` attribute system, content module shape, engine behavior, search index format, validation checklist, common mistakes. |

## What was added in v1.6.0

| New | Purpose |
|---|---|
| `references/svg-quality.md` | Five non-negotiable rules for SVG diagrams (`<tspan>` for multi-line, padding, card hierarchy, semantic color, palette discipline), pre-publish checklist, didactic test, anti-patterns. |

## What was added in v1.5.0

Four reference files brought to parity with the sister skill:

| New / Updated | Purpose |
|---|---|
| `references/markdown-guide.md` | Long-form `.md` pattern with MS frontmatter (role, contact, no socials), MS-first citation hierarchy, signature block. |
| `references/editorial-spine.md` | Trilingual `content.json` + `i18n-{locale}.json` pattern with MS overrides (English-only role/tagline) and forbidden-strings audit. |
| `references/site.md` | Astro multi-page site (rare for MS material), usage criteria, MS-specific overrides, pre-launch identity audit. |

## What was added in v1.4.0

- `assets/showcase.html`, all-in-one visual reference rendering every pattern of the MS identity: typography, colors, components, 12-icon catalog, cards, simulations (browser, terminal, VS Code, GitHub Copilot Chat), architecture diagrams, deck slides (cover, light, paper, dark, final), Office signatures, Astro site preview, playbook 3-col layout. Includes interactive components (sliders, radio pill groups, live result displays), deck layout patterns (big number, stat pair, split before/after, question grid, pillar grid, layer pyramid), deck chrome (brand bar with 2x2 colored squares).

## When to use this skill vs paulasilvatech-ds

| Use **paulasilva-ms** | Use **paulasilvatech-ds** |
|---|---|
| Internal Microsoft material | Personal, community, public material |
| Client-facing decks under MS role | Open-source playbooks, blog posts, articles |
| Workshop guides for enterprise customers | Conference talks, GitHub repos |
| Anything signed `Software Global Black Belt` | Anything signed `AI-Native Software Engineer` |

**Never mix.** A single deliverable uses one identity start to finish.

## Step 1, load tokens and fonts

Same DS token shape as paulasilvatech-ds, with Microsoft palette in the logo. The token names below (`--c-*`, `--ink`, `--paper`) are used by the playbook and landing formats. **The deck format is the exception**: `assets/deck.html` uses its own namespaced set (`--ps-color-ms-blue-500`, `--ps-color-ink`, `--ps-font-mono`, and so on). When building a deck, follow `references/deck.md`, which documents that namespace. Do not use `--c-*` tokens in deck slides; they are undefined in the deck engine and accents will silently fail.

```css
:root {
  --c-red-50: #FFF0EB;     --c-red-500: #F25022;    --c-red-700: #B33816;
  --c-green-50: #F1F8E3;   --c-green-500: #7FBA00;  --c-green-700: #5A8500;
  --c-blue-50: #E5F6FD;    --c-blue-500: #00A4EF;   --c-blue-700: #0076AC;
  --c-yellow-50: #FFF7E0;  --c-yellow-500: #FFB900; --c-yellow-700: #B88500;
  --ink: #1A1A1A;     --ink-2: #3A3A3A;    --ink-3: #737373;
  --paper: #FFFFFF;   --bg: #F7F7F5;       --bg-alt: #ECECE8;
  --rule: #E5E5E0;    --rule-2: #CECEC7;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
[data-theme="dark"] {
  --ink: #F0F0F0;     --ink-2: #C7C7C2;    --ink-3: #A8A8A4;
  --paper: #1C1C1A;   --bg: #141414;       --bg-alt: #242420;
  --rule: #2E2E2A;    --rule-2: #3A3A36;
  --accent-ink: var(--c-blue-500);  /* brighter for dark legibility */
  --accent-50: rgba(0, 164, 239, 0.12);
}
```

Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

## Step 2, logo (Microsoft palette)

The `</>` SVG logo uses **Microsoft 4-color palette**, not paulasilvatech personal:

| Path | Microsoft color | Personal (forbidden in MS) |
|---|---|---|
| 1, red | `#F25022` | `#FF3133` |
| 2, green | `#7FBA00` | `#7ED956` |
| 3, yellow | `#FFB900` | `#FFDE59` |
| 4, blue | `#00A4EF` | `#39B8FF` |

Inline only, never link external SVG file. Full markup in `references/identity.md`.

## Step 3, identity strings (MS-specific, mandatory)

These canonical strings are **non-negotiable** for any MS-identity output:

| Field | Value |
|---|---|
| Author | `Paula Silva` |
| Role | `Software Global Black Belt` |
| Chrome bar form | `Paula Silva | Software Global Black Belt` (mono uppercase, letter-spacing 0.16em) |
| Contact | `paulasilva@microsoft.com` (mailto link, single channel) |
| Tagline (EN only) | `Building the future of software development with AI and Agentic DevOps` |

**Forbidden in MS-identity output:**
- `AI-Native Software Engineer` (that is the personal role)
- `@paulasilvatech` (personal GitHub)
- `paulanunes`, LinkedIn (personal)
- `agenticdevopsplatform.com` (personal site)
- `Microsoft Americas`, `Software GBB Americas` (deprecated, use just `Software Global Black Belt`)
- The personal logo palette `#FF3133 / #7ED956 / #FFDE59 / #39B8FF`

## Step 4, identify output format and load reference

| Format | Read |
|---|---|
| Deck (HTML, slide-based) | `references/deck.md`, plus `references/identity.md` and `references/voice.md` |
| Multi-page playbook (3+ chapters, trilingual) ⭐ | `references/playbook.md`, copy `assets/playbook/` |
| Markdown guide / long-form `.md` | `references/markdown-guide.md` |
| Email / Memo / Office | `references/office.md` |
| Excel workbook, dashboard, charts, KPIs (data deliverable) | `references/excel.md` plus `scripts/build_excel_dashboard.py` |
| Convert deck HTML to PDF (vector, per locale) | `references/pdf-generation.md` plus `scripts/deck_to_pdf.py` |
| Convert deck HTML to native editable PPTX (per locale) | `references/deck.md` (export section) plus `scripts/build_pptx.py` and `scripts/export_notes.py` |
| Editorial spine plus i18n (trilingual content.json, MS-identity rules) | `references/editorial-spine.md` |
| Astro multi-page site (rare for MS material) | `references/site.md` |
| Landing page | `references/landing.md` |
| Any HTML output (favicon plus social preview, mandatory) | `references/head-meta.md` |

> **Every HTML deliverable** (landing, deck, showcase, playbook, any page) must apply `references/head-meta.md`: the inline Microsoft favicon (never an external `favicon.svg`) and the Open Graph and Twitter social preview, with `og:locale` and a 1200x630 `preview-<locale>.png` per language.

## Step 5, editorial rules (apply to every output)

- **No em dashes (`—`)**, no en-dashes (`–`) in ranges. Use comma, period, hyphen.
- **No banned vocabulary**: revolutionary, game-changer, world-class, cutting-edge, leverage (verb), synergy. See `references/voice.md`.
- **Sentence case** for headings (not Title Case).
- **ISO dates**: `2026-04-24`.
- **Full product names**: `GitHub Copilot` not `Copilot`, `Azure AI Foundry` not `AI Foundry`.
- **Microsoft-friendly tone**: didactic, professional but warm, technically precise. Avoid hype, keep Paula's pedagogical voice.
- **Visual assets always in EN** regardless of locale (SVG diagram labels, terminal output stay English).

## Step 6, file naming

```
{Title}_v{M_M_M}_{YYYY-MM-DD}_{locale}.{ext}
```

Examples:
```
Hackathon_SERPRO_2026_Deck_v3_0_0_2026-04-24_pt-br.html
Workshop_Guide_AgenticDevOps_v1_0_0_2026-05-01_en.html
ContextStack_Playbook_v1_0_0_2026-05-04_multi/    (multi-page folder)
```

Locale codes: `en`, `pt-br`, `es`, `multi` (for multi-page trilingual playbooks).

## Step 7, multi-page playbook quick start

1. Copy `assets/playbook/` into the project workspace, rename if needed.
2. Edit `shared/content/landing.js` for project topic, chapter list, accents.
3. For each chapter: clone `chapter-01-foundation.html`, change `<body data-page="chapter-NN">`, swap content module include, write `shared/content/chapter-NN.js` with all three locales (EN, PT-BR, ES).
4. Add per-locale entries to `shared/search-index.js`.
5. Run validation: no em-dashes, no forbidden strings, JS syntax clean, all three locales present, identity-locked EN strings hardcoded.
6. Open `index.html?lang=en`, `?lang=pt-br`, `?lang=es` in browser. Test light + dark theme.

Full pattern in `references/playbook.md`.

## Step 8, mandatory validation gate (every HTML output)

Before presenting any HTML deliverable, apply `references/head-meta.md` (inline Microsoft favicon plus social preview per locale) and run the identity gate. It exits non-zero on any violation, so a deliverable cannot ship off-identity:

```bash
# identity and structure gate
python3 scripts/validate_html.py <file.html> [<file2.html> ...]

# add --check-assets when the page ships social previews, to confirm the
# referenced preview-<locale>.png files exist on disk
python3 scripts/validate_html.py <file.html> --check-assets
```

It enforces: inline Microsoft favicon (Microsoft palette, no external `favicon.svg`), social preview meta (Open Graph and Twitter with `og:locale` and a `preview-<locale>.png`), the Microsoft contact email and role string, no personal-brand leaks (personal social handles, the personal palette `#FF3133 / #7ED956 / #FFDE59 / #39B8FF`), no em dashes, and "GitHub Copilot" written in full. Fix every reported error, then rerun until it passes. Do not present a deliverable that fails the gate.

Then walk `references/first-run-checklist.md` end to end. It is the single gate that makes the first run correct: it covers the identity rules, the per-format checks (HTML, playbook, PDF, PPTX, Excel, notes, SVG), sourcing, and delivery. The validators cover the mechanical items; the checklist covers the rest.

## Step 9, export a deck to PDF or PPTX (when requested)

A deck ships in three formats from one HTML source. The HTML is trilingual and switches live; the PDF and the PPTX are each single-language, so **both export scripts require `--locale`**. There is no default.

When generating a deck, also run `export_notes.py` so the speaker-notes markdown files exist for the PPTX step.

```bash
# speaker notes -> one .md per locale (run right after generating the deck)
python3 scripts/export_notes.py --input deck.html

# vector PDF, in the named locale
python3 scripts/deck_to_pdf.py \
  --input deck.html --output deck_en.pdf --locale en \
  --title "Event Name" --author "Paula Silva, Software Global Black Belt" \
  --subject "Brief description"

# native editable PPTX, in the named locale (slide content AND speaker notes)
python3 scripts/build_pptx.py --input deck.html --output deck_en.pptx --locale en
```

`deck_to_pdf.py` renders one vector PDF page per slide via Playwright, merges with pypdf, adds metadata, and hides nav chrome. `build_pptx.py` builds a genuinely native PowerPoint file (every element an editable shape, no flattened images) and fills the native notes pane in the requested locale, read from `{base}_notes_{locale}.md`. It needs the deck to carry a `<script id="deck-manifest">` block; see the export sections of `references/deck.md` for the manifest spec and the 10 archetypes.

See `references/pdf-generation.md` for the PDF pattern and troubleshooting, and `references/deck.md` for the PPTX manifest and archetype reference.

## Anti-patterns (never do these in MS-identity output)

- Sign as `AI-Native Software Engineer`, that is paulasilvatech identity, not MS.
- Use the personal logo palette `#FF3133 / #7ED956 / #FFDE59 / #39B8FF`. The MS logo is always Microsoft `#F25022 / #7FBA00 / #FFB900 / #00A4EF`.
- Include GitHub, LinkedIn, or site links in MS material. The single contact is the email.
- Use em dashes anywhere.
- Modify the `</>` logo proportions or path geometry.
- Paraphrase the canonical role string. It is `Software Global Black Belt`, full stop.
- Invent metrics, customer names, or internal Microsoft data.
- Overwrite a published version. Bump version (v3_0_0 → v3_1_0) and archive the prior file.
- Use a hash router for new playbooks. The v1.7.0 architecture is multi-page, each chapter is its own URL.

## Reference files (load on demand)

### Visual showcase
- `assets/showcase.html` ⭐ all-in-one rendered reference, every MS-identity pattern displayed live (48 sections). Open in browser, navigate via sidebar. Use as the visual spec when markdown is not enough.

### Working templates
- `assets/playbook/` ⭐ **v1.7.0 multi-page playbook template**, fully trilingual, no toolchain, ready to copy and customize.
- `assets/deck.html`, deck reference.
- `assets/landing.html`, landing page reference.

### Identity & voice
- `references/identity.md`, full SVG logo markup, canonical strings, forbidden patterns checklist, pre-publish identity audit script.
- `references/voice.md`, brand voice: banned vocabulary, tone calibration, MS-vs-personal examples side by side.

### Format references
- `references/deck.md` ⭐ **consolidated in v1.7.1**, the single canonical deck reference: copy-the-asset workflow, the `--ps-color-*` token namespace, slide types, accent mapping, animation classes, navigation, pitfalls, pre-publish checklist.
- `references/landing.md`, hero, format cards, stack-at-a-glance, theme JS for landing pages.
- `references/playbook.md` ⭐ **rewritten in v1.7.0**, full multi-page architecture: directory layout, content module shape, engine behavior, search index, validation checklist.
- `references/markdown-guide.md`, long-form `.md` guides, MS frontmatter, signature block, citation rules, naming.
- `references/site.md`, Astro multi-page site (rare for MS material, usage guidelines and forbidden-strings audit).
- `references/office.md`, Word, PowerPoint, Excel rules: Segoe UI, Microsoft Blue `#0078D4`, header/footer, signature.
- `references/excel.md` ⭐ the full Excel module: the Office workbook standard plus the formula-driven dashboard pattern (KPI cards, native charts, metrics, explanations), data-integrity rules, the build workflow, and the pre-ship checklist. Pairs with `scripts/build_excel_dashboard.py`.
- `references/pdf-generation.md`, full PDF generation pattern from HTML decks: Playwright config, CSS overrides, troubleshooting, edge cases.

### Editorial references
- `references/editorial-spine.md`, trilingual `content.json` plus `i18n-{locale}.json` single-source pattern, MS overrides (English-only role/tagline), forbidden-strings audit.

### Visual asset references
- `references/components.md`, atomic component library: cards, buttons, eyebrow, badges, code blocks, tables, progress bars, dark mode toggle, search.
- `references/animations.md`, hover, fadeUp, terminal typing, progress bar, scroll-based, SVG diagram animations.
- `references/svg-quality.md`, five non-negotiable rules for SVG diagrams (tspan multi-line, padding, card hierarchy, semantic color), pre-publish checklist, didactic test, anti-patterns.
- `references/svg-icons.md`, inline SVG icon system: 12-icon catalog, sizes (16, 18, 24, 48, 72), animated spinner, sprite sheets.
- `references/diagrams.md`, Mermaid plus hand-crafted SVG, generic node patterns, icon standards.
- `references/architecture-diagrams.md`, sequence, component, deployment, network topology, layer stack, decision trees.
- `references/simulations.md`, browser, terminal, VS Code, GitHub Copilot Chat faux UIs.
- `references/images.md`, AI-generated, screenshots, photos, decorative imagery, formats, performance.

### Bundled scripts
- `scripts/deck_to_pdf.py`, converts any paulasilva-ms deck HTML to a vector PDF in a named locale (`--locale` required), with MS-identity validation built in (warns if `AI-Native Software Engineer` or `@paulasilvatech` leak in MS material).
- `scripts/build_pptx.py`, converts a paulasilva-ms deck HTML to a native, fully editable PPTX in a named locale (`--locale` required), with native PowerPoint speaker notes. Reads the deck's embedded `deck-manifest` and `I18N` blocks. See the export sections of `references/deck.md`.
- `scripts/export_notes.py`, exports a deck's speaker notes to one markdown file per locale; the source `build_pptx.py` reads for the notes pane.
- `scripts/build_excel_dashboard.py`, builds a paulasilva-ms Office Excel dashboard non-destructively (openpyxl, standard library): restyle helpers, KPI cards, native chart helpers, workbook properties, and a snapshot/verify pair that asserts no audited cell changed. Import the primitives, or run `python3 scripts/build_excel_dashboard.py input.xlsx output.xlsx` as a smoke test. See `references/excel.md`.
- `scripts/requirements.txt`, the Python dependencies for the derivative scripts (`deck_to_pdf.py`, `build_pptx.py`, `build_excel_dashboard.py`). Install with `pip install -r scripts/requirements.txt`, then `python -m playwright install chromium` for the PDF path. The scripts preflight their dependencies and print these steps if anything is missing.

### Final gate
- `references/first-run-checklist.md`, the end-to-end checklist every deliverable passes before delivery: identity rules, per-format checks, sourcing, and delivery. Read it last, before presenting.
