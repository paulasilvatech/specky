# Animations Reference

## Philosophy

Animations in the paulasilvatech DS are always purposeful and subtle. They guide attention, confirm interactions, and create a sense of craft. They never add delay or distract from content.

## Transition Values

### Standard transitions (copy-paste)

```css
/* Default: all properties, fast */
transition: background 0.15s, color 0.15s, border-color 0.15s;

/* Elevation on hover (cards, buttons) */
transition: transform 0.2s, box-shadow 0.25s;

/* Theme switching (background/color only) */
transition: background 0.2s, color 0.2s;

/* Arrow slide on hover */
transition: transform 0.2s;
```

### Timing reference

| Duration | Use case |
|----------|----------|
| `0.1s`   | Progress bar fill, immediate feedback |
| `0.15s`  | Color changes, background, border |
| `0.2s`   | Transform (translate, scale), theme toggle |
| `0.25s`  | Box-shadow |
| `0.3s`   | Opacity fades |
| `0.4s`   | Entrance animations |
| `0.6s`   | Slow reveals, diagram draw-in |

Always use `ease` or `ease-out`. Never `linear` for UI transitions.

## Hover States

### Card elevation

```css
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
}
[data-theme="dark"] .card:hover {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
}
```

### Button lift

```css
.btn--primary:hover {
  transform: translateY(-1px);
}
```

### Arrow slide (CTAs)

```css
.btn svg { transition: transform 0.2s; }
.btn:hover svg { transform: translateX(3px); }

/* Card arrow */
.card:hover .card__arrow svg {
  transform: translateX(4px);
  color: var(--card-accent);
}
```

### Link underline

```css
.prose a {
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.15s;
}
.prose a:hover {
  text-decoration-color: currentColor;
}
```

## Entrance Animations

Use `@keyframes` for elements that appear on first view. Stagger children with `animation-delay`.

### fadeUp (primary entrance)

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero__title    { animation: fadeUp 0.4s ease forwards; }
.hero__subtitle { animation: fadeUp 0.4s ease forwards; animation-delay: 0.08s; }
.hero__cta      { animation: fadeUp 0.4s ease forwards; animation-delay: 0.16s; }
```

### fadeIn (for diagrams, illustrations)

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.hero__art { animation: fadeIn 0.6s ease forwards; animation-delay: 0.2s; }
```

### Staggered card entrance

```css
.card { opacity: 0; animation: fadeUp 0.4s ease forwards; }
.card:nth-child(1) { animation-delay: 0.05s; }
.card:nth-child(2) { animation-delay: 0.10s; }
.card:nth-child(3) { animation-delay: 0.15s; }
.card:nth-child(4) { animation-delay: 0.20s; }
```

## Terminal Typing Animation

The Terminal component uses a JS-driven character-by-character typing effect.

```javascript
async function typeText(element, text, speed = 22) {
  for (const char of text) {
    element.textContent += char;
    await new Promise(r => setTimeout(r, speed));
  }
}

async function runSession(lines) {
  for (const line of lines) {
    const promptEl = createPromptLine(line.prompt);
    await typeText(promptEl.command, line.command, 22);
    await new Promise(r => setTimeout(r, 200));
    if (line.output) {
      await showOutput(line.output);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}
```

Speed values by context:

| Speed (ms/char) | Effect |
|-----------------|--------|
| `15-22` | Natural typing speed |
| `8-12`  | Fast command entry |
| `40-60` | Slow, deliberate typing for emphasis |

## Deck Slide Transitions (`deck-stage` web component)

The deck uses `deck-stage.js`, a custom web component. Slides are NOT animated with CSS transitions by default. The component hides/shows slides via `visibility: hidden` + `opacity: 0` without animation, to preserve iframe/video state.

To add a subtle cross-fade:

```css
/* In deck CSS */
::slotted(*) {
  transition: opacity 0.15s ease;
}
::slotted([data-deck-active]) {
  transition: opacity 0.2s ease;
}
```

The `deck-stage` component dispatches `slidechange` events you can listen to for driving additional animations (progress bar, slide number counter, speaker notes sync).

## Progress Bar Animation

```css
.progress-bar__fill {
  transition: width 0.1s ease;
  /* Optional: smooth the color change between chapters */
  transition: width 0.1s ease, background-color 0.3s ease;
}
```

## Dark Mode Transition

Apply `transition` only to background and color, never to border-radius or size. Too many transitioned properties cause performance issues.

```css
body {
  transition: background 0.2s, color 0.2s;
}
/* Limit to specific properties on components */
.card { transition: background 0.2s, border-color 0.2s; }
.meta-bar { transition: background 0.2s, border-color 0.2s; }
```

## Scroll-Based Animations (IntersectionObserver)

For elements that animate when scrolled into view:

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target); // animate once
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
```

```css
.animate-on-scroll {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.animate-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

## SVG Diagram Animations

For hand-crafted SVG diagrams, use CSS animations on groups:

```css
/* Node entrance */
.diagram-node {
  opacity: 0;
  animation: fadeUp 0.4s ease forwards;
}
.diagram-node:nth-child(1) { animation-delay: 0.1s; }
.diagram-node:nth-child(2) { animation-delay: 0.2s; }
.diagram-node:nth-child(3) { animation-delay: 0.3s; }
.diagram-node:nth-child(4) { animation-delay: 0.4s; }

/* Connector draw-in */
@keyframes drawLine {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}
.connector {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  pathLength: 1;
  animation: drawLine 0.6s ease forwards;
  animation-delay: 0.5s;
}
```

## Anti-patterns

- Never animate `width` or `height` directly (use `transform: scaleX/scaleY` instead)
- Never use `animation-duration` over `0.6s` for UI elements (feels sluggish)
- Never animate more than 3 properties simultaneously on the same element
- Never use bounce or elastic easing (`cubic-bezier` overshots) in professional contexts
- Never add `transition: all` (it catches unexpected properties and causes flicker)
