# SVG Diagram Quality Reference

The discipline that separates "amateur" diagrams from "professional, didactic, complete" ones. Apply every rule on every diagram. No exceptions.

This reference encodes the quality bar that emerged from the Legacy Modernization deck v1.0.0 work, where 5 SVG diagrams (cost equation, 5R framework, 5-layer architecture, 7-phase journey, strangler fig) were rebuilt to match the reference standard set by Context Platform Stack v2.0.0.

## The five non-negotiable rules

### 1. SVG `<text>` does not auto-wrap. Use `<tspan x dy>` for multi-line.

**Anti-pattern (text overflows the card):**
```html
<text x="60" y="160" font-size="12" fill="#3A3A3A">No code change. Stable, low-risk, end-of-life systems.</text>
```
At 12px font with 224px card width, that string runs ~280px and gets clipped. The reader sees `No code change. Stable, low-risk, end-of-li...`.

**Correct pattern (`tspan` with explicit x and dy):**
```html
<text x="60" y="160" font-size="12" fill="#3A3A3A">
  <tspan x="60">No code change.</tspan>
  <tspan x="60" dy="16">Stable systems</tspan>
  <tspan x="60" dy="16">near end of life.</tspan>
</text>
```

The `x` on each tspan resets the line origin; `dy="16"` is the line-height in pixels (typically 14-18 depending on font-size).

### 2. Pre-measure every text element against its container width.

Approximate rule of thumb at 12px Inter font:
- 1 em ≈ 6.5px
- Average character width ≈ 6-7px
- Card content width 224px (after 20px padding) holds ~32-35 chars per line

If a string exceeds the budget, either split it with `<tspan>` or shorten it. Both are valid; the diagram-design choice is yours, but **never let it overflow**.

### 3. Padding rules (consistent across all diagrams).

| Container | Padding | Why |
|---|---|---|
| Card outer (rect → text) | 20px left, 14-20px top | Reading comfort at projection size |
| Header band (within card) | 20px left, 22px below top | Header text feels grounded |
| Between cards | 12-16px gap | Visual rhythm without crowding |
| viewBox margins | 28-40px from edges | SVG never touches frame |

### 4. Each card has a consistent header structure.

```
[colored band: 56px tall]
  ├─ kicker (mono 10px uppercase, 1.5em letter-spacing) at 80-84 from top
  └─ name (sans 18-22px, weight 500) at 100-108 from top
[body: 220-280px tall]
  ├─ tagline (sans 13px, weight 600, accent color), first line of body
  ├─ description (sans 12px, regular, ink-2 color), multi-line via tspan
  ├─ rule line (1px ink-rule, full width), at ~60% of body height
  ├─ label/value pairs (mono 10px label, sans 13-14px value)
  └─ italic footnote (sans 11px, ink-3), at the bottom
```

This 4-zone hierarchy is the signature of a DS-compliant card. Every layer-stack, comparison grid, or framework matrix should follow it.

### 5. Color usage is semantic, not decorative.

| Color | When | Examples |
|---|---|---|
| Blue (`#00A4EF`) | Infrastructure, foundation, "what is" | Workspace layer, Phase 1 Assessment |
| Yellow (`#FFB900`) | Platform, authoring, "what I invoke" | MCP tools, Phase 2 Carving, Phase 5 Coexistence |
| Green (`#7FBA00`) | Context, validation, runtime | Refactor (R03), Phase 3 Translation, Phase 6 Testing |
| Red (`#F25022`) | Intent, danger, urgency, end | Replace (R05), Phase 4 Performance, Phase 7 Cutover, anti-patterns |
| Gray (`#737373`) | Neutral, retain, deprecated | R01 Retain, perimeter (dashed border), legend |
| Dark (`#1A1A1A`) | Core agent, source of truth | Central node in hub-and-spoke, mainframe in strangler fig |

If you find yourself using an off-palette color (purple, orange, custom), the diagram is going to feel inconsistent across the deck.

## Pre-publish checklist (run on every SVG before shipping)

- [ ] Every `<text>` with content longer than ~32 chars uses `<tspan>` for line breaks
- [ ] No text element extends past its containing rect's right edge
- [ ] No element overlaps another element (rect, text, line, polygon)
- [ ] Card heights are consistent within the same diagram
- [ ] Card widths are consistent within the same row
- [ ] Headers (the colored band on top of cards) have uniform height across all cards
- [ ] Padding from card edge to first text is consistent (typically 20px)
- [ ] All colors come from the DS palette (no off-palette hexes)
- [ ] Footer/legend section sits below a 1px rule line, not floating
- [ ] viewBox aspect ratio fits within slide content area (typically 1400 × 360-480)
- [ ] Mono kickers use letter-spacing 1.5-1.8 (consistent uppercase rhythm)
- [ ] Italic footnotes (font-style: italic) are reserved for "rule of thumb" content
- [ ] Arrows have visible polygon arrowheads at the destination
- [ ] Connection lines are 1.5-2px stroke-width (anything thinner is invisible at projection scale)

## The "didactic" test

A diagram is didactic if a reader, given 20 seconds and zero context, can answer three questions:

1. **What is this showing?** → The diagram has a one-line header explaining the topic.
2. **What is the structural relationship?** → The visual hierarchy (left-to-right, top-to-bottom, hub-and-spoke, layer stack) is obvious.
3. **What should I take away?** → A footnote, italic line, or contrast (e.g., before/after) makes the conclusion explicit.

If a reader has to study the diagram for 60 seconds to understand it, the diagram is too dense, split it.

## Examples that meet the bar

| Diagram | viewBox | Pattern | Reference deck |
|---|---|---|---|
| Cost equation flip (before/after) | 1400×400 | Two-panel comparison with phase labels + horizontal bars proportional to % | Legacy Modernization deck slide 8 |
| Gartner 5R framework | 1400×420 | 5-column grid with consistent card structure | Legacy Modernization deck slide 10 |
| 5-layer reference architecture | 1400×480 | Vertical stacked layers with consistent label-box + content split | Legacy Modernization deck slide 19 |
| 7-phase journey | 1400×380 | Horizontal timeline with arrow connectors between cards | Legacy Modernization deck slide 24 |
| Strangler fig coexistence | 1400×420 | Hub-and-spoke with router + two destinations + bidirectional CDC bridge | Legacy Modernization deck slide 27 |
| Contracts between four layers | 1400×520 | Layer stack with bidirectional contract arrows between layers | Context Platform Stack deck |

## Anti-patterns (never ship a diagram with these)

- **Single-line text overflowing the card right edge.** This is the most common failure. Use `<tspan>` always.
- **Inconsistent card heights** within a row, creating a jagged top/bottom edge.
- **Off-palette colors** like purple `#8A2BE2` or pink `#FF69B4`. The DS has 4 brand colors + 3 inks; that is enough.
- **Tiny text** below 11px at projection scale. Minimum 11px for kickers, 12px for body.
- **Floating arrows** without polygon heads.
- **Dense diagrams with 30+ elements.** Split into 2-3 focused diagrams.
- **Decorative elements** (drop shadows, gradients, decorative borders) that distract from the data. Keep it minimal.
- **Emojis as icons.** Use inline SVG icons or the brand mark. Emojis render inconsistently and look amateur.

## When in doubt

Open `assets/showcase.html`, navigate to the SVG diagrams section, and copy the pattern. If your diagram does not look like one of the cataloged patterns, either it is genuinely novel (rare) or it is amateur (common).

## Related references

- `references/architecture-diagrams.md`, sequence, component, deployment, network topology, layer stack
- `references/diagrams.md`, Mermaid basics + generic SVG patterns
- `references/svg-icons.md`, 12-icon catalog and icon system
- `references/components.md`, atomic components used inside diagrams (cards, eyebrows, labels)
