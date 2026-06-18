# paulasilva-ms Identity Reference

Canonical strings, logo markup, and forbidden patterns for the Microsoft identity fork.

The paulasilva-ms identity shares the *shape* of the paulasilvatech visual system (same logo geometry, same component structure) but is a distinct identity. The palette in the logo, the author role, and the contact channel are all different. "Same shape, different identity" is the whole point of the fork. Never describe the two as interchangeable.

## Canonical strings (use exactly these)

```
Author name:    Paula Silva
Role (formal):  Software Global Black Belt
Role (full):    Paula Silva, Software Global Black Belt
Chrome-bar form: Paula Silva | Software Global Black Belt   (mono uppercase, letter-spacing 0.16em)
Contact:        paulasilva@microsoft.com   (single channel)
Tagline (EN):   Building the future of software development with AI and Agentic DevOps
```

The role is **Software Global Black Belt**. Not "Software GBB Americas", not "Microsoft Global Black Belt", not abbreviated. It stands alone, with no organization and no region.

The contact is **email only**. There is no public LinkedIn, no GitHub, and no website on Microsoft material.

The tagline is **English-only** for MS material. Do not translate it.

## The logo: Microsoft palette, never the personal palette

The mark is the four-color `</>` shape. The geometry is shared with paulasilvatech, but **the fill colors are the Microsoft palette**:

| Path | Microsoft color (use this) | Personal color (forbidden in MS output) |
|---|---|---|
| 1, red | `#F25022` | `#FF3133` |
| 2, green | `#7FBA00` | `#7ED956` |
| 3, yellow | `#FFB900` | `#FFDE59` |
| 4, blue | `#00A4EF` | `#39B8FF` |

If you see `#FF3133`, `#7ED956`, `#FFDE59`, or `#39B8FF` in an MS deliverable, that is the personal logo leaking in. It is a failed deliverable. Replace with the Microsoft palette above.

### `</>` SVG logo (used by the playbook and landing formats)

Inline only, never linked as an external file. Small size is 22px wide; for a hero or final-slide use, change the width to 120px and keep `height:auto`.

```html
<svg viewBox="0 0 1914 1062" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="paulasilva" style="width:22px;height:auto;flex-shrink:0;">
  <title>paulasilva</title>
  <path fill="#F25022" d="M532 131 L36 462 L13 497 L13 560 L23 582 L48 604 L521 923 L539 926 L539 699 L547 680 L314 530 L527 395 L551 371 L558 347 L558 155 L547 135 Z"/>
  <path fill="#7FBA00" d="M551 681 L542 693 L540 700 L540 917 L546 930 L558 940 L571 943 L778 943 L788 941 L798 935 L809 910 L809 702 L807 694 L799 682 L784 674 L566 674 Z"/>
  <path fill="#FFB900" d="M1390 16 L1208 13 L1184 23 L1171 38 L768 1009 L768 1026 L778 1038 L957 1042 L975 1037 L995 1017 L1346 179 L1349 145 L1367 129 L1401 47 L1402 31 Z"/>
  <path fill="#00A4EF" d="M1369 131 L1350 149 L1349 355 L1354 369 L1385 399 L1592 528 L1373 667 L1354 688 L1349 703 L1349 907 L1361 924 L1377 926 L1871 595 L1893 563 L1894 501 L1885 477 L1863 456 L1398 142 Z"/>
</svg>
```

Do not modify the path geometry or the `viewBox`. Only the four `fill` values and the `style` width are ever touched, and the fills are always the Microsoft palette.

### 2x2 squares mark (used by the deck format)

The deck engine does not use the SVG. Its chrome bar uses a 2x2 grid of small colored squares, built from four `<span>` elements styled by the engine CSS. The four squares are colored with the deck's `--ps-color-ms-*-500` tokens, which are the Microsoft palette. You do not author this; it is already in `assets/deck.html`. Just do not replace it with the personal-palette squares.

The two treatments (`</>` SVG for playbook and landing, 2x2 squares for the deck) are both canonical. Which one a format uses is fixed by that format's asset. Do not swap one for the other.

## Chrome bar text

Every deck, playbook, and landing page carries a chrome bar at the top. The text label in that bar is identity-locked:

```
Paula Silva | Software Global Black Belt
```

This string never translates and never gets a project-specific suffix. A chrome bar that reads `paulasilvatech · <project name>` is the personal identity leaking in; replace it with the canonical string above.

The exact markup differs slightly by format, and the format's asset is the source of truth:

- **Deck** (`assets/deck.html`): `<div class="deck-brand">` with `.deck-brand__squares` and `<span class="deck-brand__text">Paula Silva | Software Global Black Belt</span>`. Engine CSS styles it; the `.deck-brand__text` uses `--ps-font-mono` and `--ps-color-ink-3`.
- **Playbook** (`assets/playbook/index.html`): `<header class="chrome">` with `.chrome__brand`, the `</>` SVG as `.chrome__logo`, and `<span class="chrome__name">Paula Silva | Software Global Black Belt</span>`.
- **Landing** (`assets/landing.html`): `<a class="brand">` with `.brand__squares` and a `.brand__text` block.

In all three, the identity-locked string is the same. When you copy an asset to start a new deliverable, check that this string is correct and carries no project suffix.

## Cover slide meta-grid (decks)

Four columns, in this order. The deck is trilingual, so the labels carry `data-i18n` keys; the values are literal.

```html
<div class="meta-grid">
  <div class="meta-item"><span class="meta-label" data-i18n="labels.author">Author</span><span class="meta-value">Paula Silva</span></div>
  <div class="meta-item"><span class="meta-label" data-i18n="labels.role">Role</span><span class="meta-value">Software Global Black Belt</span></div>
  <div class="meta-item"><span class="meta-label" data-i18n="labels.duration">Duration</span><span class="meta-value" data-i18n="cover.duration">60 to 90 minutes</span></div>
  <div class="meta-item"><span class="meta-label" data-i18n="labels.date">Date</span><span class="meta-value">2026-05-14</span></div>
</div>
```

Localize the labels: EN (`Author / Role / Duration / Date`), PT-BR (`Autora / Papel / Duração / Data`), ES (`Autora / Rol / Duración / Fecha`). The role value stays in English in every locale.

## Final slide (decks)

The asset's closing slide (`assets/deck.html`, last `<section>`) is a dark slide with a three-column contact grid: contact, deck reference, next step. Copy that section and edit its text. It is already identity-correct.

If you need the simpler email-card variant instead, here it is, using the deck engine's `--ps-color-*` tokens:

```html
<section class="slide slide--dark" style="--accent: var(--ps-color-ms-blue-500);">
  <div class="eyebrow">Event name · Location · Date</div>
  <!-- 120px </> SVG logo, Microsoft palette -->
  <h1 class="section-title">Closing thought. <span class="accent-blue">Punchline.</span></h1>
  <p class="subtitle" style="font-style: italic;">Building the future of software development with AI and Agentic DevOps.</p>
  <div style="font-family: var(--ps-font-mono); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ps-color-dark-ink-3); margin-bottom: 14px;">
    Paula Silva | Software Global Black Belt
  </div>
  <a href="mailto:paulasilva@microsoft.com" style="display:inline-flex; align-items:center; gap:12px; padding:14px 20px; border:1px solid rgba(240,240,240,.2); border-radius:8px; text-decoration:none; color:var(--ps-color-dark-ink);">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;color:var(--ps-color-dark-ink-2);flex-shrink:0;">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>
    </svg>
    <span style="font-size:15px;">paulasilva@microsoft.com</span>
  </a>
</section>
```

Whichever variant you use, the contact is `paulasilva@microsoft.com` and nothing else. No LinkedIn, no GitHub, no personal site.

## Forbidden strings (never appear in MS output)

Search and confirm before delivering any MS-identity file. Each of these is an immediate fail:

| Forbidden string | Why | Use instead |
|---|---|---|
| `AI-Native Software Engineer` | Personal role | `Software Global Black Belt` |
| `@paulasilvatech` | Personal GitHub handle | (omit, no socials in MS) |
| `paulasilvatech ·` (as a chrome-bar label) | Personal brand label leaking into the chrome bar | `Paula Silva \| Software Global Black Belt` |
| `paulanunes` | Personal LinkedIn handle | (omit) |
| `agenticdevopsplatform.com` | Personal site | (omit) |
| `linkedin.com/in/paulanunes` | Personal LinkedIn URL | (omit) |
| `#FF3133`, `#7ED956`, `#FFDE59`, `#39B8FF` | Personal logo palette | Microsoft palette `#F25022 / #7FBA00 / #FFB900 / #00A4EF` |
| `Microsoft Americas` | Deprecated regional title | `Software Global Black Belt` (no region) |
| `Software GBB Americas` | Deprecated regional abbreviation | `Software Global Black Belt` |
| `Microsoft Global Black Belt` | Redundant "Microsoft" prefix | `Software Global Black Belt` |
| `Construindo o futuro do desenvolvimento de software` | Tagline in PT (personal-only) | EN tagline only on MS material |
| `Construyendo el futuro del desarrollo de software` | Tagline in ES (personal-only) | EN tagline only on MS material |

Note that `paulasilvatech` as a bare word is allowed when it names the design system itself (for example, "the paulasilvatech Design System"). It is forbidden as an author label, a handle, or a chrome-bar brand string.

## Pre-publish identity check (run before delivering)

```bash
file="path/to/deliverable.html"

echo "Forbidden strings audit (each must be 0):"
for s in "AI-Native Software Engineer" "@paulasilvatech" "paulanunes" \
         "agenticdevopsplatform" "Microsoft Americas" "Software GBB Americas" \
         "Microsoft Global Black Belt" "#FF3133" "#7ED956" "#FFDE59" "#39B8FF"; do
  count=$(grep -Fc "$s" "$file" 2>/dev/null || echo 0)
  echo "  '$s': $count"
done

echo ""
echo "Chrome-bar leak check (must be 0):"
count=$(grep -Ec "(deck-brand__text|chrome__name)[^>]*>[^<]*paulasilvatech" "$file" 2>/dev/null || echo 0)
echo "  personal brand label in chrome bar: $count"

echo ""
echo "Required strings (each must be >= 1):"
for s in "Software Global Black Belt" "paulasilva@microsoft.com"; do
  count=$(grep -Fc "$s" "$file" 2>/dev/null || echo 0)
  echo "  '$s': $count"
done
```
