---
name: svg-professional
description: >
  Create publication-quality SVG diagrams, charts, and infographics with professional connector routing,
  pixel-perfect alignment, and polished visual design. Covers all SVG types: flowcharts, architecture diagrams,
  quadrant charts, scatter plots, timelines, org charts, matrices, process maps, and any data visualization
  rendered as SVG. Use this skill whenever the user asks to create, improve, or fix any SVG file — even if they
  just say "diagram", "chart", "visual", "infographic", "fluxo", "diagrama", "quadrante", or "make me an SVG".
  Also trigger when the user shares an existing SVG and asks to improve its quality, fix alignment, or make it
  look more professional. This skill is specifically for hand-crafted SVG markup (not libraries like D3 or
  chart.js); for interactive HTML dashboards, use a dashboard skill instead.
---

# Professional SVG Creation

This skill produces SVGs that look like they came from a senior information designer using Visio or Figma — not
like auto-generated markup. The difference between amateur and professional SVG comes down to five disciplines:
connector routing, spatial math, typographic hierarchy, color semantics, and text-fit awareness. Master all five
and every SVG you produce will look polished.

Before writing any SVG code, read the two golden reference files in `references/`:
- `references/golden-flowchart.svg` — A 4-flow horizontal diagram with orthogonal routing, forked paths, metric badges, section backgrounds, and a legend. This is the canonical example for any diagram with boxes and arrows.
- `references/golden-quadrant.svg` — A scatter-plot quadrant chart with axes, gridlines, data dots with leader lines, and a 4-item legend. This is the canonical example for any chart with plotted data points.

Study whichever reference matches the requested SVG type. If the request doesn't match either exactly, blend techniques from both.

---

## 1. Planning Phase (before writing any SVG code)

Every SVG starts with spatial math on paper, not in code. Skipping this step is the #1 cause of overlapping
elements, clipped text, and misaligned arrows.

### 1.1 Choose canvas dimensions

Pick `viewBox` dimensions that give breathing room. Typical sizes:

| Type | viewBox | Orientation |
|------|---------|-------------|
| Flowchart (3-4 columns) | `0 0 1120 720` | Landscape |
| Flowchart (5+ columns) | `0 0 1400 720` | Wide landscape |
| Vertical flow | `0 0 720 1100` | Portrait |
| Quadrant / scatter | `0 0 1200 1800` | Tall portrait |
| Timeline | `0 0 1200 600` | Wide landscape |
| Matrix / table | `0 0 1100 800` | Landscape |
| Org chart | `0 0 1000 1200` | Portrait |

Set both `viewBox` and explicit `width`/`height` attributes so the SVG scales predictably.

### 1.2 Define the spatial grid

Before writing a single `<rect>`, calculate every element's position on paper:

1. **Reserve margins**: title block (top ~90px), legend (bottom ~60px), section labels (left ~100px if rotated), metric badges (right ~130px if used).
2. **Compute center lines**: for each row/section, calculate `center_y`. All boxes in that row share this value. Example: section background y=232, h=130 → `center_y = 297`.
3. **Size boxes to fit text**: estimate text width at ~7.5px per character at font-size 13. A label "Terraform / Bicep" (17 chars) needs ~128px, so the box width should be at least 148px (128 + 20px padding).
4. **Compute anchor points**: for a box at `(x, y, w, h)`, the four anchors are:
   - right-center: `(x+w, y+h/2)`
   - left-center: `(x, y+h/2)`
   - top-center: `(x+w/2, y)`
   - bottom-center: `(x+w/2, y+h)`
5. **Verify no overlaps**: ensure the rightmost box + gap doesn't collide with the badge column. Ensure forked paths have enough vertical spread between target boxes (minimum 40px center-to-center).

Write these calculations as comments in the SVG before drawing anything.

### 1.3 Text-fit rule

This is critical: **never break a word across two lines**. If a label like "CONTAINERIZATION" won't fit
horizontally in the available space, you have three options (in order of preference):

1. **Rotate the text -90°** using `transform="rotate(-90 cx cy)"` with `text-anchor="middle"` so it reads vertically.
2. **Use a shorter synonym** ("CONTAINERS" instead of "CONTAINERIZATION").
3. **Increase the available space** — widen the gutter, section, or box.

Never split "PROVISION" / "ING" across two lines. Apply this same rule to box labels, axis labels, legend text, and any other text element.

---

## 2. Connector Routing (for diagrams with arrows)

This is what separates amateur from professional diagrams. Every arrow follows these five rules:

### 2.1 Orthogonal routing

Arrows follow paths at 90° angles only (horizontal + vertical segments). Never use diagonal lines between boxes.
Use `<path>` elements, not `<line>`, because paths support multi-segment routing.

### 2.2 Smooth corner routing

At every 90° turn, use a quadratic Bézier curve (`Q`) instead of a sharp corner. Standard radius: 8-10px.

**Pattern for a right-then-down turn at point (cx, cy) with radius r=8:**
```
... H(cx-8) Q cx,cy cx,(cy+8) V ...
```

**Full example — horizontal exit, turn down, turn right into target:**
```svg
<path d="M553,157 H598 Q608,157 608,167 V173 Q608,183 618,183 H659"
      stroke="#B4B2A9" stroke-width="1.3" fill="none" marker-end="url(#arr)"/>
```

This path: goes right to x=598, curves down (608,157→608,167), goes down to y=173, curves right (608,183→618,183), then goes right to x=659.

### 2.3 Anchor point discipline

Every arrow starts at the exact center of a box edge and ends at the exact center of the target box edge. Compute these from the box's `(x, y, w, h)` — never eyeball them.

### 2.4 Endpoint snapping

End the path 1px before the target box edge. The arrow marker's `refX` positions the triangular tip exactly at the endpoint, so it touches the border without overlapping.

### 2.5 Arrow marker definition

Use a single reusable marker in `<defs>`. The canonical marker:

```svg
<defs>
  <marker id="arr" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
    <path d="M1,1.2 L8,4 L1,6.8" fill="#B4B2A9" stroke="none"/>
  </marker>
</defs>
```

The marker color (`#B4B2A9`) is deliberately muted — arrows are guides, not the focal point.

---

## 3. Visual Design System

### 3.1 Color palette

The default palette uses Microsoft brand colors for accent and warm grays for structure. Adapt the accent colors to the client's brand if needed, but always keep the neutral grays.

**Accent colors (Microsoft default):**
| Name | Hex | Usage |
|------|-----|-------|
| Blue | `#0078D4` | Primary accent, Azure services |
| Green | `#7FBA00` | Success, outputs, production |
| Yellow | `#FFB900` | Caution, generated artifacts |
| Red | `#F25022` | Security, alerts |
| Dark amber | `#BA7517` | Text variant for yellow (better contrast on white) |

**Neutral colors (always use these):**
| Name | Hex | Usage |
|------|-----|-------|
| Near-black | `#2C2C2A` | Primary text, titles |
| Dark gray | `#5F5E5A` | Axis titles, secondary headings |
| Medium gray | `#888780` | Subtitles, descriptions, muted text |
| Light gray | `#B4B2A9` | Arrows, borders, axis lines, leader lines |
| Pale gray | `#D3D1C7` | Gridlines, dividers |
| Off-white | `#E8E6DF` | Separator lines, legend borders |

### 3.2 Section backgrounds

Group related content with faintly tinted rectangles. The key is extreme subtlety — opacity between 0.03 and 0.05. These create visual lanes without competing with the actual content.

```svg
<rect x="40" y="92" width="1040" height="130" rx="8" fill="#0078D4" opacity="0.03"/>
```

### 3.3 Accent bar

Place a 4-color bar (3px tall) under the title to add brand polish:

```svg
<rect x="60"  y="74" width="60" height="3" rx="1.5" fill="#0078D4"/>
<rect x="124" y="74" width="60" height="3" rx="1.5" fill="#7FBA00"/>
<rect x="188" y="74" width="60" height="3" rx="1.5" fill="#FFB900"/>
<rect x="252" y="74" width="60" height="3" rx="1.5" fill="#F25022"/>
```

### 3.4 Metric badges

Use pill-shaped badges with tinted backgrounds to highlight KPIs. Align all badges in a vertical column at the right margin, vertically centered on each row's `center_y`:

```svg
<rect x="920" y="143" width="110" height="28" rx="14" fill="#0078D4" opacity="0.07"/>
<text x="975" y="162" text-anchor="middle" font-size="12" font-weight="600" fill="#0078D4">~85% faster</text>
```

The column alignment is essential — all badges share the same x position.

### 3.5 AI-assisted node indicator

When a box represents an AI/copilot step, add a small circle with a star icon inside:

```svg
<circle cx="393" cy="157" r="8" fill="#0078D4" opacity="0.15"/>
<text x="393" y="161" font-size="9" fill="#0078D4" text-anchor="middle" font-weight="700">✦</text>
```

---

## 4. Typography

### 4.1 Font stack

Always use the system font stack for cross-platform rendering:

```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif
```

### 4.2 Type scale

| Role | font-size | font-weight | fill color |
|------|-----------|-------------|------------|
| Main title | 24-28 | 700 | `#2C2C2A` |
| Subtitle | 14-16 | 400 | `#888780` |
| Box primary label | 13-14 | 600 | `#2C2C2A` or accent |
| Box secondary label | 11 | 400 | `#888780` |
| Section label (rotated) | 10 | 700 | accent, opacity 0.40-0.45 |
| Axis label | 14 | 400 | `#888780` |
| Axis title | 15 | 400 | `#5F5E5A` |
| Legend text | 12-13 | 500 | `#2C2C2A` |
| Badge text | 12 | 600 | accent color |

### 4.3 Vertical centering in boxes

For a box at `(x, y, w, h)`:
- **Single-line text**: `text_y = y + h/2 + font_size/3` (approximate visual center).
- **Two-line text**: `line1_y = y + h*0.43`, `line2_y = y + h*0.74` (for h=46 and font-sizes 13+11).

Always use `text-anchor="middle"` with `text_x = x + w/2`.

---

## 5. Chart-Specific Patterns

### 5.1 Quadrant / scatter charts

See `references/golden-quadrant.svg` for the full pattern. Key elements:

- **Quadrant backgrounds**: 4 rectangles with semantic colors at opacity 0.04.
- **Dividers**: dashed lines (`stroke-dasharray="6 4"`) in `#D3D1C7`.
- **Axes**: solid lines in `#B4B2A9`, with gridlines at `stroke-width="0.4"` and `stroke-dasharray="3 5"`.
- **Data dots**: `<circle>` with fill=accent, stroke=white, stroke-width=3. This gives a floating-dot effect.
- **Leader lines**: subtle lines (stroke-width=0.7, opacity=0.4) connecting dots to their labels. These prevent labels from cluttering the chart.
- **Quadrant names**: large text (font-size 20, font-weight 600) in accent color at opacity 0.35 — visible but not dominant.

### 5.2 Timeline diagrams

- Use a single horizontal axis line with labeled tick marks.
- Place event cards above or alternating above/below the axis.
- Connect cards to the axis with vertical leader lines.
- Use section backgrounds for time phases (e.g., Q1, Q2).

### 5.3 Matrix / table layouts

- Use alternating row backgrounds (white and a very faint gray at opacity 0.03).
- Align all text to consistent x positions (like a table grid).
- Use section headers with accent-colored left borders.

### 5.4 Org charts

- Use vertical connector routing (top-center to bottom-center).
- Center children under parents with horizontal distribution.
- Apply the same Q-curve corners for orthogonal routing.

---

## 6. Legend

Every SVG with more than 2 visual categories needs a legend. Place it at the bottom, separated by a thin horizontal line:

```svg
<line x1="40" y1="660" x2="1080" y2="660" stroke="#E8E6DF" stroke-width="1"/>
```

Legend items use mini-samples of the actual visual elements (circles, colored rectangles, badge shapes) — not
just colored squares. This makes the legend self-documenting.

---

## 7. Quality Checklist

Before delivering any SVG, verify:

- [ ] All text is in **English** (unless the user explicitly requests another language)
- [ ] No word is broken across two lines
- [ ] Every arrow uses orthogonal routing with Q-curve corners
- [ ] Every arrow starts and ends at exact anchor points (computed from box dimensions)
- [ ] Boxes in the same row share the same `center_y`
- [ ] Badges/metrics align in a vertical column (same x)
- [ ] Section backgrounds use opacity ≤ 0.05
- [ ] Accent bar appears under the title
- [ ] A legend exists if there are ≥ 2 visual categories
- [ ] The SVG has a clear `viewBox` and explicit `width`/`height`
- [ ] Comments document the spatial grid (center_y values, anchor points)
- [ ] There is at least 30px gap between any badge and the nearest box
- [ ] Font stack is set on the root `<svg>` element

---

## 8. SVG Code Structure

Organize the SVG code in this order (matching the golden references):

1. `<defs>` — markers, filters, gradients
2. Title block — main title, subtitle, accent bar
3. Section backgrounds — tinted rectangles
4. Section labels — rotated text in left gutter
5. Metric badges — aligned column at right margin
6. Content sections — boxes, arrows, data points (one commented section per flow/group)
7. Legend — separator line + legend items

Use `<!-- ============= -->` comment blocks to separate each section for readability.
