# Deck Format Reference

The canonical HTML deck pattern for paulasilva-ms. One engine, one reference file. Used for SERPRO Hackathon, Context Platform Stack, and every client-facing or internal presentation under the Microsoft identity.

> This file replaces the older split between `deck.md` and `deck-engine-v5.md`. There is only one deck engine. If you find a reference to `deck-engine-v5.md` or to a file called `deck_5.html` anywhere, it is stale: the engine lives in `assets/deck.html` and this is its only reference.

## The golden rule: copy the asset, do not rebuild it

`assets/deck.html` is a complete, working, 51-slide trilingual deck. It already contains the entire engine (the `<style>` block, lines 13 to 1260, and the `<script>` block, lines 3008 to 6053). You do not reconstruct that engine, and you do not paste it in by hand. You copy the whole file and then swap content.

The reason this matters: the engine is roughly 1,250 lines of CSS and 3,000 lines of JavaScript, tuned over many decks. Navigation, the overview modal, staggered animations, the chrome bar color sync, and the PDF export path all depend on that exact code. Any attempt to retype or summarize it produces a deck that looks plausible and then breaks the moment someone presses an arrow key. So the workflow is always:

1. Copy `assets/deck.html` to the project workspace under the correct file name (see Step 6 of SKILL.md).
2. Leave the `<style>` and `<script>` blocks untouched.
3. Replace the slide content inside `<div class="deck" id="deck">` with the new deck's slides.
4. Replace the `const I18N = { ... }` object near the top of the `<script>` block with the new deck's content, keeping the same key structure.
5. Update `<title>`, the `<meta name="author">`, and the cover slide's date.
6. Run the validation checklist at the end of this file.

If a deck genuinely needs a structure the asset cannot express, raise that with Paula before improvising. The asset is the contract.

## Identity and voice are not optional for a deck

Before writing slide content, read two files and keep them open:

- `references/identity.md` for the canonical cover slide, final slide, logo markup, and the forbidden-strings list. The deck is Microsoft-identity output. The role is `Software Global Black Belt`, the contact is `paulasilva@microsoft.com` and nothing else, and the logo uses the Microsoft palette. A deck that ships `AI-Native Software Engineer`, `@paulasilvatech`, a LinkedIn link, or `agenticdevopsplatform.com` is a failed deliverable, full stop.
- `references/voice.md` for banned vocabulary and the Microsoft tone calibration. Slide text is short, which makes every word visible. Generic phrasing shows more on a slide than in a paragraph.

## Token namespace: the deck uses `--ps-color-*`

This is the single most common reason deck colors come out wrong, so read this carefully.

SKILL.md Step 1 documents the design-system tokens with short names (`--c-blue-500`, `--ink`, `--paper`). Those names are correct for the playbook and landing formats. **The deck engine does not use them.** `assets/deck.html` defines and consumes its own namespaced set:

| Concept | Deck engine token | Do NOT use (wrong for deck) |
|---|---|---|
| MS blue 500 | `--ps-color-ms-blue-500` | `--c-blue-500` |
| MS green 500 | `--ps-color-ms-green-500` | `--c-green-500` |
| MS yellow 500 | `--ps-color-ms-yellow-500` | `--c-yellow-500` |
| MS red 500 | `--ps-color-ms-red-500` | `--c-red-500` |
| Primary text | `--ps-color-ink`, `--ps-color-ink-2`, `--ps-color-ink-3` | `--ink`, `--ink-2`, `--ink-3` |
| Surfaces | `--ps-color-paper`, `--ps-color-bg`, `--ps-color-bg-alt` | `--paper`, `--bg`, `--bg-alt` |
| Rules | `--ps-color-rule`, `--ps-color-rule-2` | `--rule`, `--rule-2` |
| Dark-slide text | `--ps-color-dark-ink`, `--ps-color-dark-ink-2`, `--ps-color-dark-ink-3` | `--dark-ink`, `--dark-ink-*` |
| Dark-slide rule | `--ps-color-dark-rule` | `--dark-rule` |
| Mono font | `--ps-font-mono` | `--font-mono` |
| Sans font | `--ps-font-sans` | `--font-sans` |

If you write `style="--accent: var(--c-blue-500)"` on a slide in this engine, the variable does not exist, the accent silently falls back to nothing, and the slide loses its color. Because you are copying the asset rather than rebuilding it, the simplest safeguard is to copy an existing slide of the type you need and edit its text, so the token names come along correctly. Every example in this file uses the real `--ps-color-*` names for the same reason.

## The deck is trilingual by default

`assets/deck.html` is built for EN, PT-BR, and ES with a live language switcher. Content does not live in the HTML text nodes; it lives in the `const I18N` object in the `<script>` block, and every visible element carries a `data-i18n="some.key"` attribute that the engine resolves on load and on language change.

So when you replace slide content, you are really doing two things in lockstep: writing the `<section>` markup with `data-i18n` keys, and writing the matching entries under `I18N.en`, `I18N["pt-BR"]`, and `I18N.es`. A `data-i18n` key with no entry in `I18N` renders blank.

**If a deck must be single-locale**, do not leave half-wired `data-i18n` attributes in place. Either keep all three locales (preferred, it is the asset's natural state), or remove the `data-i18n` attributes from the slides you author and let the literal HTML text stand. Do not redeclare `const I18N` a second time; that throws a `SyntaxError`, which makes `goToSlide` undefined and kills navigation entirely.

## What the engine gives you

- **Chrome bar** (top left): the `</>` logo plus `Paula Silva | Software Global Black Belt`. Its text color auto-adapts to light when a dark slide is active.
- **Progress bar** (top, full width): thin accent-colored bar tracking position.
- **Navigation**: arrow keys, space, page-up/down, home/end, plus the on-screen `←` `→` buttons.
- **Overview modal** (`O` or `Esc`): grid of every slide, click to jump.
- **Counter** (bottom right): `1 / N`.
- **Staggered entrance animations**: `fadeUp` on `.eyebrow`, `.title`, `.subtitle`, `.body-large`, `.section-number`, `.section-title`, and any direct children of a `.stagger` container.
- **Language switcher**: EN / PT-BR / ES, wired to `I18N`.
- **Stage dimensions**: exactly 1600x900. The PDF export path in `references/pdf-generation.md` depends on this. Do not change it.

## Speaker notes (trilingual)

The engine has a built-in speaker-notes panel. Press `N` during the presentation to toggle it; it sits at the bottom of the screen, re-renders as you move between slides, and follows the language switcher. It is hidden in PDF and print output, so it never leaks into a deliverable.

Notes live in the same `I18N` object as the slide content, under a `notes` key per locale, with one entry per slide indexed `s1`, `s2`, and so on:

```js
"en": {
  ...
  "notes": {
    "s1": "Open on the cost framing. The room already believes agents are useful; the question is why they stall.",
    "s4": "Spend the most time here. Ask which of the three patterns the audience recognizes from their own estate."
  }
}
```

A slide with no `notes` entry shows a muted "No notes for this slide" when the panel is open, so notes are optional and can be filled in slide by slide. Author them in all three locales the same way you author slide content; a missing locale falls back to English. Notes are presenter guidance, not slide text: what to emphasize, what to skip if short on time, the question to ask, the anecdote to tell.

When the deck is generated, also run `scripts/export_notes.py` against it. It reads `I18N[locale].notes` and writes one markdown file per locale next to the deck: `{base}_notes_en.md`, `{base}_notes_pt-br.md`, `{base}_notes_es.md`. These are a readable artifact on their own, and they are the file `build_pptx.py` reads to fill the native PowerPoint notes pane. The `I18N.notes` block stays the single source; the `.md` files are derived from it, never hand-maintained in parallel.

## Exporting to PDF and PPTX, always per locale

Every paulasilva-ms deck ships in three formats from one source: the HTML deck itself, a vector PDF, and a native editable PPTX. The HTML is trilingual and switches live. **The PDF and the PPTX are each single-language deliverables, so both export scripts require `--locale`.** There is no default; always state the language you want.

```bash
# 1. speaker notes -> one markdown file per locale (run right after generating the deck)
python3 scripts/export_notes.py --input deck.html

# 2. vector PDF, in the locale you name
python3 scripts/deck_to_pdf.py --input deck.html --output deck_en.pdf --locale en

# 3. native editable PPTX, in the locale you name (slide content AND speaker notes)
python3 scripts/build_pptx.py --input deck.html --output deck_en.pptx --locale en
```

`build_pptx.py` produces a genuinely native PowerPoint file: every box, line, table, and word is an editable shape, nothing is a flattened image. It also writes the speaker notes into the native PowerPoint notes pane, in the requested locale, read from the matching `{base}_notes_{locale}.md`. Fonts are Segoe UI and Consolas, which are present on every Office install.

## The deck manifest (required for PPTX export)

`build_pptx.py` does not screen-scrape the rendered HTML. It reads a small JSON manifest embedded in the deck:

```html
<script type="application/json" id="deck-manifest">
[ { "type": "cover", "content": { ... } },
  { "type": "question-grid", "content": { ... } } ]
</script>
```

One entry per slide. `type` is the slide archetype; `content` maps that archetype's fields to `I18N` key paths (so the manifest stays language-neutral and the HTML remains the single source). A deck without this manifest cannot be exported to PPTX, so author the manifest alongside the slides whenever the deck will need a PowerPoint version.

The PPTX archetypes and the `content` shape each one expects:

| `type` | content fields |
|---|---|
| `cover` | `eyebrow`, `title_segs` (list of `{k, accent?}`), `subtitle`, `duration`, `date` |
| `divider` | `eyebrow`, `number` (literal, e.g. `"II"`), `title`, `subtitle` |
| `list` | `eyebrow`, `title`, `items` (list of `{num, k}`), optional `caption` |
| `question-grid` | `eyebrow`, `title`, `cards` (list of `{accent, label, q, hint}`), optional `caption` |
| `pillar-grid` | `eyebrow`, `title`, `pillars` (list of `{accent, num, title, body}`), optional `caption` |
| `layer-rows` | `eyebrow`, `title`, `rows` (list of `{accent, label, name, desc}`), optional `caption` |
| `roadmap-rows` | `eyebrow`, `title`, `rows` (list of `{accent, phase, text, duration}`), optional `caption` |
| `chapter-cover` | `number` (literal), `tag`, `title`, `sub` |
| `two-col` | `eyebrow`, `title`, `cols` (list of `{accent, label, title, body}`), optional `caption` |
| `final` | `eyebrow`, `title`, `body`, `contact` (list of `{label, lines}`) |

Text fields are `I18N` key paths resolved per locale. Structural fields (`accent` color name, `number` and `label` literals like `"Layer 4"`) are written directly in the manifest. In `final`, a `lines` entry prefixed `$LIT$` is a literal string, not an i18n key. Each archetype's renderer estimates how its content wraps and sizes the boxes accordingly; if a slide overflows, that is the signal to split it, the same rule as the HTML deck.

## Editorial contract

A deck is a live presentation, not a document. Each slide is one compressed argument. This is about the density of a single slide, not the length of the deck.

**There is no limit on how many slides a deck has.** A deck is as long as the material requires. The SERPRO and Context Platform Stack decks run past 50 slides. Do not trim content to hit a slide count, and do not cram a slide to avoid adding another. When in doubt, add a slide.

What keeps a *single slide* working: one main idea, one supporting visual, and list items a viewer can absorb in the time you will spend on the slide. If a slide is carrying more than about seven items, or a paragraph longer than three or four lines, that is usually the signal to split it into two slides, not to shrink the type. Full prose, long code walkthroughs, and exhaustive lists read better in a playbook (`references/playbook.md`); a deck points at them, it does not reproduce them.

## Slide types

The basic slide types are below. But do not stop at a deck of plain bulleted lists: the design system has a deep catalog of slide patterns, and a good deck uses them to carry meaning visually.

**The pattern catalog lives in `assets/showcase.html`.** Open it in a browser; it renders every pattern live across roughly 70 sections. The deck-relevant ones include `big-number` and `stat-pair` for a single number that matters, `split-layout` for before/after or this-versus-that, `question-grid` and `pillar-grid` for three or four parallel ideas, `layer-pyramid` for a stacked or layered model, `code-block` with a header for code, the architecture and flow diagrams (`flow-arr`, `sequence-diagram`, `deployment-diagram`, `network-diagram`, `decision-tree`, `loop-cycle`), the charts (`chart-radar`, `chart-gauge`, `chart-donut`), and the UI simulations (`sim-browser`, `sim-terminal`, `sim-vscode`, `sim-copilot`, `sim-cli`). The asset's own 51 slides are the other half of the catalog: they show these patterns wired into a real deck with `data-i18n`.

So the real workflow for a content slide is: pick the pattern that fits the idea, find it in `assets/showcase.html` or in `assets/deck.html`, copy that markup, and edit the text. Reach for a plain `list-numbered` slide only when the idea genuinely is just a list. All examples below use the real engine tokens.

### Cover slide (first slide, the only one with `data-active="true"`)

```html
<section class="slide slide--light" data-active="true" style="--accent: var(--ps-color-ms-blue-500);">
  <div class="eyebrow" data-i18n="cover.eyebrow">Event name</div>
  <h1 class="title">
    <span data-i18n="cover.part1">Opening line</span>
    <span class="accent-blue" data-i18n="cover.keyword1">keyword</span>
  </h1>
  <p class="subtitle" data-i18n="cover.subtitle">One-sentence pitch, max 30 words.</p>
  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label" data-i18n="labels.author">Author</span><span class="meta-value">Paula Silva</span></div>
    <div class="meta-item"><span class="meta-label" data-i18n="labels.role">Role</span><span>Software Global Black Belt</span></div>
    <div class="meta-item"><span class="meta-label" data-i18n="labels.duration">Duration</span><span class="meta-value" data-i18n="cover.duration">60 to 90 minutes</span></div>
    <div class="meta-item"><span class="meta-label" data-i18n="labels.date">Date</span><span class="meta-value">2026-05-14</span></div>
  </div>
</section>
```

The role string is hardcoded text, not a `data-i18n` key, because it never translates. The meta-grid labels do translate. See `references/identity.md` for the canonical localization of those labels.

### Light slide (default content)

```html
<section class="slide slide--light" style="--accent: var(--ps-color-ms-blue-500);">
  <div class="eyebrow" data-i18n="sec.eyebrow">Section label</div>
  <h2 class="title title--medium" data-i18n="sec.title">The main point in one line.</h2>
  <p class="body-large" data-i18n="sec.body">Optional supporting paragraph, max 3 lines.</p>
  <div class="list-numbered stagger">
    <div class="list-numbered__item"><span class="list-numbered__num">01</span><span class="list-numbered__text" data-i18n="sec.item1">Item one.</span></div>
  </div>
</section>
```

`.title` sizes: `.title` (XL), `.title--medium`, `.title--small`.

### Paper slide

`<section class="slide slide--paper">`, a slightly different neutral background. Use sparingly to break the rhythm of consecutive light slides.

### Dark slide / section divider

```html
<section class="slide slide--dark" style="--accent: var(--ps-color-ms-blue-500);">
  <div class="eyebrow" data-i18n="part2.eyebrow">Part II</div>
  <div class="section-number">II</div>
  <h1 class="section-title" data-i18n="part2.title">Section title.</h1>
  <p class="subtitle" data-i18n="part2.sub">Optional one-line context.</p>
</section>
```

The chrome bar adapts to light text automatically when a dark slide is active. This is handled by `syncSlideTheme(i)` in the engine; you do not wire it.

### Final slide

The asset's closing slide is a dark slide with a three-column contact grid (contact, deck reference, next step). Copy the last `<section>` of `assets/deck.html` and edit the text. Whatever variant you use, the final slide obeys the identity rules: `Software Global Black Belt`, `paulasilva@microsoft.com` as the only contact channel, no LinkedIn, no GitHub, no personal site. The canonical email-card variant is in `references/identity.md`.

## Accent colors per slide

Each slide sets its accent through an inline `style="--accent: var(--ps-color-ms-blue-500);"`. Match the accent to the section's topic:

| Theme / topic | Accent token |
|---|---|
| Infrastructure, technical, "how" | `--ps-color-ms-blue-500` |
| Platform, foundation, success | `--ps-color-ms-green-500` |
| Context, knowledge, evaluation | `--ps-color-ms-yellow-500` |
| Intent, problem, urgency, danger | `--ps-color-ms-red-500` |

The accent drives the eyebrow color, the `list-numbered` number color, the progress bar, and any accent spans inside the title.

## Title with colored accent words

Inside a `.title`, the spans `.accent-blue`, `.accent-green`, `.accent-yellow`, `.accent-red` colorize keywords. They are defined in the engine CSS as `.title .accent-blue { color: var(--ps-color-ms-blue-500); }` and so on.

```html
<h2 class="title title--medium">
  Stack fixed. <span class="accent-yellow">Focus on process</span>, not technology.
</h2>
```

## Pitfalls, learned the hard way

- **Never redeclare `const I18N`.** If you keep the engine's `I18N` and also define your own, JS throws a `SyntaxError`, `goToSlide` becomes undefined, and navigation breaks completely.
- **Never use `display: none` on a slide.** The engine toggles `data-active` and uses opacity and visibility. Forcing `display: none` breaks the overview modal.
- **A `data-i18n` key with no `I18N` entry renders blank.** Author the markup and the three locales together.
- **Do not retype the engine.** Copy `assets/deck.html`; keep the `<style>` and `<script>` blocks intact.
- **Do not use `--c-*` tokens in the deck.** This engine is `--ps-color-*`. See the namespace table above.
- **The counter literal is a placeholder.** The `<span id="counter">1 / N</span>` in the chrome HTML is overwritten by the engine on the first `goToSlide` call, but the initial paint shows whatever literal is there. Set it to your real slide count to avoid a flash of the wrong number.
- **Stage is exactly 1600x900.** PDF generation depends on it.

## Pre-publish deck checklist

- [ ] Started from a copy of `assets/deck.html`, engine `<style>` and `<script>` blocks untouched
- [ ] Cover slide has `data-active="true"`, and it is the only slide that does
- [ ] Counter literal (`1 / N`) matches the real slide count
- [ ] Every slide accent uses a `--ps-color-ms-*-500` token, mapped to the section topic
- [ ] No `--c-*` tokens anywhere in authored slides
- [ ] Every `data-i18n` key has an entry in `I18N.en`, `I18N["pt-BR"]`, and `I18N.es` (or the deck is deliberately single-locale with no stray `data-i18n` attributes)
- [ ] No em dashes anywhere
- [ ] No banned vocabulary (`references/voice.md`)
- [ ] Identity check passes: `Software Global Black Belt`, `paulasilva@microsoft.com`, Microsoft logo palette, and zero forbidden strings (`references/identity.md`)
- [ ] Navigation works in the browser: arrows advance, no console errors
- [ ] Overview modal opens with `O`
- [ ] PDF generation succeeds (`references/pdf-generation.md`)
