# SVG Icons Reference

The paulasilvatech icon system. Icons are inline SVG (never external files), monoline (1.5px stroke at 24x24 viewBox), and use `currentColor` so they inherit text color.

## Why inline, monoline, currentColor

| Decision | Why |
|---|---|
| **Inline SVG** (not `<img>` or icon font) | Crisp at any zoom, scriptable, themeable, no extra HTTP requests, no FOUT |
| **Monoline (stroke-based)** | Works at every size, matches the editorial weight of Inter, doesn't compete with content |
| **`currentColor` for stroke/fill** | Icon picks up text color automatically, dark mode works for free |
| **24x24 viewBox** | Standard size, snaps to pixel grid at 16/24/32px display |
| **1.5px stroke width** | Optical match for body text weight (400-500) |

## Base template

Every icon follows this shape:

```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <!-- paths here -->
</svg>
```

The `aria-hidden="true"` is mandatory unless the icon is the only content of an interactive element (then use `role="img" aria-label="..."`).

## Standard sizes

| Use | Size | Stroke |
|---|---|---|
| Inline with body text | 16px | 1.5 |
| Buttons, list bullets | 18px | 1.5 |
| Card headers, eyebrow accents | 24px | 1.5 |
| Hero icons, large feature blocks | 48-72px | 1.75 (slightly heavier) |

For sizes above 48px, bump stroke-width to 1.75 to maintain visual weight.

## Color treatment

```html
<!-- Default: matches text color -->
<svg ... stroke="currentColor">...</svg>

<!-- Accent variant: pass via inline style -->
<svg ... stroke="currentColor" style="color: var(--c-blue-500);">...</svg>

<!-- Filled accent badge -->
<span class="badge--blue">
  <svg ... stroke="currentColor" style="color: white;">...</svg>
</span>
```

Never hardcode `stroke="#00A4EF"`. Always go through `currentColor` + parent `color`.

## Icon catalog (12 essentials)

These cover 90% of needs in slides, cards, navigation, and content.

### 1. Arrow right (next, advance, link)

```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 12h14M13 5l7 7-7 7"/>
</svg>
```

### 2. Check (success, completed, validated)

```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 6L9 17l-5-5"/>
</svg>
```

### 3. X (close, error, cancel)

```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 6L6 18M6 6l12 12"/>
</svg>
```

### 4. External link

```html
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  <polyline points="15 3 21 3 21 9"/>
  <line x1="10" y1="14" x2="21" y2="3"/>
</svg>
```

### 5. Mail (contact, email)

```html
<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M22 7l-10 6L2 7"/>
</svg>
```

### 6. GitHub

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6C20.6 21.8 24 17.3 24 12c0-6.6-5.4-12-12-12z"/>
</svg>
```

### 7. LinkedIn

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
  <path d="M19 0h-14c-2.8 0-5 2.2-5 5v14c0 2.8 2.2 5 5 5h14c2.8 0 5-2.2 5-5v-14c0-2.8-2.2-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.3c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8zm13.5 12.3h-3v-5.6c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.7h-3v-11h2.9v1.5h.04c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7v6.4z"/>
</svg>
```

### 8. Search

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/>
  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
</svg>
```

### 9. Code (technical, developer)

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="16 18 22 12 16 6"/>
  <polyline points="8 6 2 12 8 18"/>
</svg>
```

### 10. Lock (security, private)

```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>
```

### 11. Lightbulb (idea, hint, learning)

```html
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.5c.7.7 1 1.6 1 2.5v1h6v-1c0-.9.3-1.8 1-2.5A7 7 0 0 0 12 2z"/>
</svg>
```

### 12. Warning (alert, caution)

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
  <line x1="12" y1="9" x2="12" y2="13"/>
  <line x1="12" y1="17" x2="12.01" y2="17"/>
</svg>
```

## Layer-aware icons (for cards/sections)

When an icon represents a layer, give it the layer's accent color via parent `color`:

```html
<!-- Infrastructure card -->
<div class="card" style="color: var(--c-blue-500);">
  <svg ... stroke="currentColor"><!-- server / cloud icon --></svg>
  <h3 style="color: var(--ink);">Infrastructure</h3>
</div>

<!-- Platform card -->
<div class="card" style="color: var(--c-green-500);">
  <svg ... stroke="currentColor"><!-- platform / package icon --></svg>
  <h3 style="color: var(--ink);">Platform</h3>
</div>
```

## Animated icons

For loading spinners or pulse effects:

```html
<!-- Pulse on hover (apply to parent .icon-button) -->
<style>
  .icon-button:hover svg { animation: pulse 0.6s ease-in-out; }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.15); }
  }
</style>
```

For a true loading spinner, use a separate SVG with built-in animation:

```html
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
  <path d="M22 12a10 10 0 0 0-10-10" stroke-linecap="round">
    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
  </path>
</svg>
```

## Icon library file

For projects with 20+ icons, consolidate into a single SVG sprite:

```html
<!-- Top of body, hidden -->
<svg style="display:none;" aria-hidden="true">
  <symbol id="icon-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7"/>
  </symbol>
  <!-- more symbols -->
</svg>

<!-- Use anywhere via -->
<svg width="16" height="16"><use href="#icon-arrow-right"/></svg>
```

This deduplicates SVG payloads, one definition, infinite uses, browser caches the symbol.

## Anti-patterns

- Never use icon fonts (Font Awesome, Material Icons via webfont). They cause FOUT, fail accessibility, and are heavier than inline SVG.
- Never use `<img src="icon.svg">` for inline icons. Loses theme inheritance, adds HTTP request, can't be animated.
- Never hardcode colors with hex on the `stroke` attribute. Use `currentColor`.
- Never set width/height with CSS only. Set both inline (`width="16" height="16"`) so the icon doesn't render full-size before CSS loads.
- Never omit `aria-hidden="true"` (decorative) or `role="img" aria-label="..."` (meaningful).
