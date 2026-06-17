---
name: Playbook reference
purpose: Long-form HTML reference document (3+ chapters) under MS identity
version: 1.7.0
last-updated: 2026-05-04
applies-to: paulasilva-ms
---

# paulasilva-ms playbook reference

Long-form editorial HTML for Microsoft-facing material. Multi-page architecture, single-source trilingual content (EN, PT-BR, ES), no toolchain.

## Directory layout

The working template is `assets/playbook/`. Copy this folder when starting a new playbook and rename `chapter-01-foundation.html` and the matching content module:

```
playbook/
├── index.html                        Home (landing page)
├── chapter-01-foundation.html        Chapter HTML shell, one per chapter
├── chapter-02-platform.html
├── chapter-NN-slug.html
└── shared/
    ├── tokens.css                    DS tokens, dark mode, .acc-* classes
    ├── playbook.css                  Layout + components (chrome, landing, doc-hero, callout, sim-term, etc.)
    ├── playbook.js                   Engine: i18n, theme, scrollspy, search modal, dynamic renderers
    ├── icons-sprite.js               SVG sprite injection (solves file:// CORS for <use href>)
    ├── search-index.js               Search index per locale: { 'en': [...], 'pt-br': [...], 'es': [...] }
    └── content/
        ├── ui.js                     UI strings (chrome, breadcrumb, footer, search modal, pagenav)
        ├── landing.js                Home content (hero, stats, chapter cards) per locale
        └── chapter-NN.js             One module per chapter, per locale
```

## Identity strings (locked, EN-only)

These never translate. They appear hardcoded in the HTML and never inside the content modules.

| Field | Value |
|---|---|
| Author | `Paula Silva` |
| Role | `Software Global Black Belt` |
| Chrome bar text | `Paula Silva | Software Global Black Belt` |
| Contact | `paulasilva@microsoft.com` |
| Tagline | `Building the future of software development with AI and Agentic DevOps` |

The chrome bar shows the `</>` SVG logo (4 paths) using the **Microsoft 4-color palette**, not the paulasilvatech personal palette:

| Path | Color |
|---|---|
| 1 (red) | `#F25022` |
| 2 (green) | `#7FBA00` |
| 3 (yellow) | `#FFB900` |
| 4 (blue) | `#00A4EF` |

**Forbidden in MS playbooks**: `AI-Native Software Engineer`, `@paulasilvatech`, GitHub or LinkedIn handles, `agenticdevopsplatform.com`, `Microsoft Americas`, `Software GBB Americas`. The personal palette `#FF3133 / #7ED956 / #FFDE59 / #39B8FF` must never appear in the logo SVG.

## Layout

Chrome bar (sticky top, 56px tall):
- `<a class="chrome__brand">` with the SVG logo and the role text.
- Spacer `<div class="chrome__spacer">` to push tools right.
- Version pill `<span class="chrome__version">v1.0.0 · 2026-05-04</span>`.
- Language switcher pills: `<div class="lang-switch"><button data-lang-switch="en">EN</button> ... PT, ES</div>`.
- Search button (opens modal).
- Theme toggle button.

Home page (`index.html`):
- `<section class="landing__hero">` with eyebrow (mono uppercase, blue dot), gradient title with `.hl-blue/.hl-green/.hl-yellow/.hl-red` highlights, lead, and 4-item meta grid (Author, Role, Contact, Reading time).
- `<div class="stat-grid">` with 4 stats, each `.acc-blue/green/yellow/red` for top border + number.
- `<h2 class="landing__chapter-label">` then `<div class="chapter-grid stagger" data-chapter-grid>`. The grid is filled at runtime by `playbook.js` from `PLAYBOOK_LANDING[lang].chapters`.
- Reading-tips callout (`.callout`) with keyboard shortcuts.

Chapter page (one HTML per chapter):
- Breadcrumb (`.breadcrumb` with `<a>Home</a> › current`).
- `.doc-hero` with `.doc-hero__eyebrow` (square num + label), `.doc-hero__title`, `.doc-hero__lead`.
- Three-column `.layout`: `.toc` (left, fixed list of all chapters with `data-page` attr for active state), `.content.chapter-body` (center, prose), `.onpage` (right, scrollspy filled at runtime from H2 ids).
- Bottom `<nav class="pagenav">` with `.pagenav__item--prev` and `.pagenav__item--next` cards (rendered at runtime with current locale ?lang= appended).

Footer:
- `.footer-card` (left): name, role, mailto link.
- `.footer-meta` (right): version, tagline (italic, EN-only).

## Single-source trilingual content

Each language has its own object under the same global. The engine reads the active language and renders.

`shared/content/ui.js`:
```js
window.PLAYBOOK_UI = {
  'en':    { chrome: {...}, breadcrumb: {...}, toc: {...}, search: {...}, callouts: {...}, ... },
  'pt-br': { ... same shape, translated ... },
  'es':    { ... }
};
```

`shared/content/landing.js`:
```js
window.PLAYBOOK_LANDING = {
  'en': {
    pageTitle, metaDescription,
    eyebrow1, eyebrow2, title, lead,
    metaLabels: { author, role, contact, readingTime },
    metaValues: { readingTime },
    statLabels: { layers, chapters, checks, actions },
    chaptersLabel,
    chapters: [
      { num: '00', accent: 'intro', title, lead, tag },
      ...
    ]
  },
  'pt-br': {...},
  'es': {...}
};
```

`shared/content/chapter-NN.js`:
```js
window.PLAYBOOK_CHAPTER_01 = {
  'en': {
    pageTitle, metaDescription,
    breadcrumbCurrent, eyebrow, title, lead,
    sections: {
      whyFoundation: { h2, p1, p2, calloutText },
      threeLayers:   { h2, p1, layer1H3, layer1P, layer2H3, layer2P },
      bootstrap:     { h2, p1, p2 },
      checklist:     { h2, p1, items: [...] },
      mondayMorning: { h2, p1, items: [...] },
      references:    { h2, p1, items: [{ url, linkText, tail }, ...] }
    },
    pagenav: { prev: { num, title, href }, next: { ... } }
  },
  'pt-br': {...},
  'es': {...}
};
```

The HTML uses three attribute systems to bind to these objects:
- `data-i18n="path.to.string"`, sets `textContent`
- `data-i18n-html="path.to.html"`, sets `innerHTML` (for the gradient title with span highlights)
- `data-i18n-attr="placeholder:path.to.string; aria-label:path.to.string"`, sets multiple attributes

The chapter body has anchored host elements that the engine fills:
- `<div class="chapter-body">` with the `<h2 id="...">` cells and inline `<p>` paragraphs all carrying `data-i18n` paths
- `<div class="checklist" id="prod-checklist">` filled from `sections.checklist.items`
- `<ol data-monday-list>` filled from `sections.mondayMorning.items`
- `<ul data-references-list>` filled from `sections.references.items`
- `<ul class="onpage__list" data-onpage-list>` filled at runtime from H2 ids

## Engine behavior

`playbook.js` does, in order:
1. Read language from `?lang=` URL param, fallback to localStorage, fallback to `navigator.language`, fallback to `en`.
2. Read theme from localStorage, fallback to `prefers-color-scheme`, fallback to `light`.
3. Apply theme attribute on `<html>` and update theme button icon.
4. Bind language-switch button click to `applyLang(...)`.
5. `applyLang` does:
   - `renderI18N`: walks `data-i18n*` attributes, fills text/HTML/attributes.
   - `renderLangPills`: sets `aria-pressed="true"` on the active button.
   - Page-specific renderers if elements exist: `renderChapterGrid`, `renderChecklist`, `renderMondayList`, `renderReferences`, `renderOnpage`, `renderPagenav`.
   - `appendLangToInternalLinks`: rewrites all relative `<a href>` to carry `?lang=` so locale survives navigation between chapters.
   - `setActiveTOC`: highlights the current chapter in the left TOC based on `<body data-page="...">`.
   - Persists language to localStorage and updates URL via `history.replaceState`.
   - Dispatches `lang:change` custom event for late-binding consumers (scrollspy, search).
6. Sets up reading progress bar, on-page scrollspy, search modal, keyboard shortcuts, IntersectionObserver for `.reveal` and `.stagger`.

## Search

Search index lives in `shared/search-index.js`:
```js
window.PLAYBOOK_INDEX = {
  'en':    [{ chapter, title, text, url }, ...],
  'pt-br': [...],
  'es':    [...]
};
```

The engine binds to `<button data-action="open-search">` and a modal at `#search-overlay`. Scoring: title prefix 100, title contains 70, chapter contains 50, text contains 30. Top 12 results. Arrow keys navigate, Enter opens, Esc closes.

URLs in the index already include the matching `?lang=` so a result clicked in PT-BR keeps the user in PT-BR.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Open search modal |
| `j` / `k` | Next chapter / previous chapter |
| `g` | Scroll to top |
| `t` | Toggle theme |
| `h` | Go to home (`index.html?lang=...`) |
| `Esc` | Close search modal |

## Authoring a new playbook

1. Copy `assets/playbook/` into your project. Rename `chapter-01-foundation.html` and `shared/content/chapter-01.js` if the slug changes.
2. Edit `shared/content/landing.js` to set the project topic, chapter list, accents.
3. For each chapter: create `chapter-NN-slug.html` from the `chapter-01` template, change `body data-page="chapter-NN"`, the breadcrumb id reference, and the script include for the matching content module.
4. Author the chapter content module under `shared/content/chapter-NN.js` with all three locales.
5. Add a corresponding entry in each locale of `shared/search-index.js`.
6. Run the validation commands below.

## Validation checklist

Before delivery:

```bash
# No em-dashes or en-dashes
grep -rn '—\|–' . && echo "❌ FAIL"

# JS syntax check
for f in shared/playbook.js shared/icons-sprite.js shared/search-index.js shared/content/*.js; do
  node -c "$f" || echo "❌ $f"
done

# Forbidden identity strings
grep -rE '(AI-Native Software Engineer|@paulasilvatech|paulanunes|agenticdevopsplatform|Microsoft Americas|Software GBB Americas)' .

# Forbidden personal palette in logo SVG
grep -rE 'FF3133|7ED956|FFDE59|39B8FF' . && echo "❌ wrong logo colors"

# All three languages present in every content module
for f in shared/content/*.js; do
  for lang in 'en' 'pt-br' 'es'; do
    grep -q "'$lang'" "$f" || echo "❌ $f missing $lang"
  done
done

# Identity-locked strings present in every HTML
for f in *.html; do
  grep -q 'Software Global Black Belt' "$f" || echo "❌ $f missing role"
  grep -q 'paulasilva@microsoft.com' "$f" || echo "❌ $f missing email"
done
```

Open every page in a browser, switch through `EN | PT | ES` and through light/dark theme. The TOC active item, doc-hero eyebrow, callout label, and footnote refs must remain legible in both themes. The `--accent-50` and `--accent-ink` overrides in dark mode handle this automatically.

## Common mistakes

- Using the paulasilvatech personal palette `#FF3133 / #7ED956 / #FFDE59 / #39B8FF` in the logo SVG. The MS playbook always uses Microsoft `#F25022 / #7FBA00 / #FFB900 / #00A4EF`.
- Putting `Paula Silva` or `Software Global Black Belt` inside a content module, then translating it. These strings stay in the HTML, hardcoded EN, never in JSON.
- Forgetting to append `?lang=` to chapter cross-links. The engine handles internal `<a>` automatically, but external scripts may bypass it. Always test all three languages by clicking through chapters.
- Using `<use href="external.svg#id">`. The `icons-sprite.js` injects an inline sprite at body start, so all `<use href="#i-name">` resolve under `file://` and over HTTP equally.
- Single-page hash routes. The v1.7.0 architecture is multi-page; each chapter is its own URL. There is no `#/chapter/01` router.
