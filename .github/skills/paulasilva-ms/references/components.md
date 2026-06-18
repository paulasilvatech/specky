# Components Reference

Complete atomic component library for the paulasilvatech Design System.
All components use CSS custom properties. Copy-paste ready.

## Table of Contents

- [1. Buttons](#1-buttons)
- [2. Cards](#2-cards)
- [3. Navigation / Meta Bar](#3-navigation--meta-bar)
- [4. Eyebrow Labels](#4-eyebrow-labels)
- [5. Layer Badges](#5-layer-badges)
- [6. Tags and Pills](#6-tags-and-pills)
- [7. Section Structure](#7-section-structure)
- [8. Code Blocks](#8-code-blocks)
- [9. Tables](#9-tables)
- [10. Progress Bar](#10-progress-bar)
- [11. Dark Mode Toggle](#11-dark-mode-toggle)
- [12. Search Input](#12-search-input)

---

## 1. Buttons

```html
<a href="#" class="btn btn--primary">
  Get started
  <svg viewBox="0 0 14 14"><path d="M1 7h12M8 2l5 5-5 5"/></svg>
</a>
<a href="#" class="btn btn--ghost">Learn more</a>
```

```css
.btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 24px; border-radius: 6px;
  font-family: var(--font-sans); font-size: 15px; font-weight: 500;
  text-decoration: none; border: 1px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
  letter-spacing: -0.002em; cursor: pointer;
}
.btn svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; transition: transform 0.2s; }
.btn:hover svg { transform: translateX(3px); }

.btn--primary { background: var(--ink); color: #fff; }
.btn--primary:hover { transform: translateY(-1px); background: #000; }
[data-theme="dark"] .btn--primary { background: #fff; color: #141414; }

.btn--ghost { background: transparent; color: var(--ink); border-color: var(--rule-2); }
.btn--ghost:hover { background: var(--bg-alt); }

.btn--small { padding: 8px 16px; font-size: 13px; }
```

---

## 2. Cards

### Standard card

```html
<div class="card" data-accent="blue">
  <div class="card__accent"></div>
  <div class="card__body">
    <p class="card__kicker">INFRA · 01</p>
    <h3 class="card__title">Infrastructure Layer</h3>
    <p class="card__desc">What agents can run on. Compute, networking, and runtime isolation.</p>
    <div class="card__meta">
      <span>Learn more</span>
      <span class="card__arrow"><svg viewBox="0 0 14 14"><path d="M1 7h12M8 2l5 5-5 5"/></svg></span>
    </div>
  </div>
</div>
```

```css
.card {
  background: var(--paper); border: 1px solid var(--rule);
  border-radius: 10px; overflow: hidden; text-decoration: none; color: inherit;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.25s;
  display: flex; flex-direction: column;
}
.card:hover { transform: translateY(-3px); border-color: var(--card-accent, var(--rule-2)); box-shadow: 0 10px 24px rgba(0,0,0,0.05); }
[data-theme="dark"] .card:hover { box-shadow: 0 10px 24px rgba(0,0,0,0.3); }
.card__accent { height: 4px; background: var(--card-accent, var(--ink-3)); flex-shrink: 0; }
.card__body { padding: 28px; display: flex; flex-direction: column; flex: 1; }
.card__kicker { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--card-accent); font-weight: 500; margin: 0 0 14px; }
.card__title { font-size: 22px; font-weight: 500; letter-spacing: -0.015em; line-height: 1.2; margin: 0 0 12px; }
.card__desc { font-size: 15px; line-height: 1.55; color: var(--ink-2); margin: 0 0 20px; flex: 1; }
.card__meta { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; color: var(--ink-3); display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--rule); }
.card__arrow svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; transition: transform 0.2s; }
.card:hover .card__arrow svg { transform: translateX(4px); color: var(--card-accent); }

/* Color variants */
[data-accent="blue"]   { --card-accent: var(--c-blue-500); }
[data-accent="green"]  { --card-accent: var(--c-green-500); }
[data-accent="yellow"] { --card-accent: var(--c-yellow-500); }
[data-accent="red"]    { --card-accent: var(--c-red-500); }
[data-accent="ink"]    { --card-accent: var(--ink); }
```

---

## 3. Navigation / Meta Bar

```html
<nav class="meta-bar">
  <a href="/" class="brand">
    <div class="brand__squares">
      <i style="background:#F25022"></i><i style="background:#7FBA00"></i>
      <i style="background:#00A4EF"></i><i style="background:#FFB900"></i>
    </div>
    <div class="brand__text">
      <span class="brand__title">Paula Silva</span>
      <span class="brand__sub">Software Global Black Belt</span>
    </div>
  </a>
  <div class="top-tools">
    <button class="tool-btn" onclick="toggleTheme()" aria-label="Toggle theme">
      <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>
    </button>
  </div>
</nav>
```

```css
.meta-bar { background: var(--paper); border-bottom: 1px solid var(--rule-2); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.08em; color: var(--ink-3); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); transition: background 0.2s, border-color 0.2s; }
.brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; }
.brand__squares { display: grid; grid-template-columns: 14px 14px; grid-template-rows: 14px 14px; gap: 2px; }
.brand__squares i { display: block; }
.brand__title { color: var(--ink); font-weight: 600; font-size: 14px; font-family: var(--font-sans); }
.brand__sub { font-size: 11px; letter-spacing: 0.12em; }
.tool-btn { width: 38px; height: 38px; border: 1px solid var(--rule-2); background: var(--paper); border-radius: 6px; color: var(--ink-2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
.tool-btn:hover { background: var(--bg-alt); color: var(--ink); }
.tool-btn svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.5; fill: none; }
```

---

## 4. Eyebrow Labels

```html
<p class="eyebrow eyebrow--blue">
  <span class="dot"></span> Infra Layer
</p>
```

```css
.eyebrow { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 500; display: inline-flex; align-items: center; gap: 10px; margin-bottom: 24px; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.eyebrow--blue  { color: var(--c-blue-700);   } .eyebrow--blue  .dot { background: var(--c-blue-500); }
.eyebrow--green { color: var(--c-green-700);  } .eyebrow--green .dot { background: var(--c-green-500); }
.eyebrow--yellow{ color: var(--c-yellow-700); } .eyebrow--yellow .dot { background: var(--c-yellow-500); }
.eyebrow--red   { color: var(--c-red-700);    } .eyebrow--red   .dot { background: var(--c-red-500); }
.eyebrow--ink   { color: var(--ink-3);        } .eyebrow--ink   .dot { background: var(--ink-3); }
```

---

## 5. Layer Badges

```html
<span class="badge badge--blue">01</span>
<span class="badge badge--green">02</span>
<span class="badge badge--yellow">03</span>
<span class="badge badge--red">04</span>
```

```css
.badge { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; flex-shrink: 0; }
.badge--blue   { background: var(--c-blue-500);   color: #fff; }
.badge--green  { background: var(--c-green-500);  color: #fff; }
.badge--yellow { background: var(--c-yellow-500); color: var(--ink); }
.badge--red    { background: var(--c-red-500);    color: #fff; }
```

---

## 6. Tags and Pills

```html
<span class="tag tag--blue">Infrastructure</span>
<span class="tag tag--green">Platform</span>
```

```css
.tag { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; font-weight: 500; text-transform: uppercase; }
.tag--blue   { background: var(--c-blue-50);   color: var(--c-blue-700); }
.tag--green  { background: var(--c-green-50);  color: var(--c-green-700); }
.tag--yellow { background: var(--c-yellow-50); color: var(--c-yellow-700); }
.tag--red    { background: var(--c-red-50);    color: var(--c-red-700); }
.tag--neutral{ background: var(--bg-alt);      color: var(--ink-3); }
```

---

## 7. Section Structure

```html
<section class="section">
  <div class="container">
    <div class="section__header">
      <p class="section__label">Section label</p>
      <h2 class="section__title">Section Title</h2>
      <p class="section__lead">One or two sentences describing what this section covers.</p>
    </div>
    <!-- section content -->
  </div>
</section>
```

```css
.section { padding: 80px 0; border-bottom: 1px solid var(--rule); }
.section:last-of-type { border-bottom: none; }
.section__label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); font-weight: 500; margin: 0 0 10px; }
.section__title { font-size: clamp(30px, 3.2vw, 42px); font-weight: 500; letter-spacing: -0.02em; line-height: 1.1; margin: 0 0 16px; text-wrap: balance; }
.section__lead { font-size: 18px; line-height: 1.55; color: var(--ink-2); max-width: var(--measure); margin: 0; }
.section__header { margin-bottom: 48px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 48px; }
```

---

## 8. Code Blocks

```css
pre {
  background: #1a1a18; color: #e8e8e4;
  border-radius: 8px; padding: 20px 24px;
  font-family: var(--font-mono); font-size: 14px; line-height: 1.6;
  overflow-x: auto; border: 1px solid #2e2e2a;
  tab-size: 2;
}
code { font-family: var(--font-mono); font-size: 0.875em; }
p code, li code {
  background: var(--bg-alt); color: var(--ink-2);
  padding: 2px 6px; border-radius: 3px; font-size: 0.85em;
  border: 1px solid var(--rule-2);
}
```

---

## 9. Tables

```css
table { width: 100%; border-collapse: collapse; font-size: 15px; }
th { background: var(--bg-alt); color: var(--ink); font-weight: 500; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-family: var(--font-mono); padding: 10px 16px; text-align: left; border-bottom: 2px solid var(--rule-2); }
td { padding: 12px 16px; border-bottom: 1px solid var(--rule); color: var(--ink-2); vertical-align: top; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg-alt); }
```

---

## 10. Progress Bar

```html
<div class="progress-bar">
  <div class="progress-bar__fill" style="width: 42%"></div>
</div>
```

```css
.progress-bar { height: 3px; background: var(--rule); position: fixed; top: 0; left: 0; right: 0; z-index: 200; }
.progress-bar__fill { height: 100%; background: var(--c-blue-500); transition: width 0.1s ease; }
```

---

## 11. Dark Mode Toggle

```javascript
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
(function() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
```

---

## 12. Search Input

```html
<div class="search">
  <svg class="search__icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></svg>
  <input class="search__input" type="text" placeholder="Search (press /)" />
  <kbd class="search__kbd">/</kbd>
</div>
```

```css
.search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--rule-2); border-radius: 6px; background: var(--bg); transition: border-color 0.15s; }
.search:focus-within { border-color: var(--c-blue-500); }
.search__icon { width: 14px; height: 14px; stroke: var(--ink-3); stroke-width: 2; fill: none; flex-shrink: 0; }
.search__input { border: none; background: transparent; font-family: var(--font-sans); font-size: 14px; color: var(--ink); outline: none; flex: 1; }
.search__kbd { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); background: var(--bg-alt); border: 1px solid var(--rule-2); border-radius: 3px; padding: 2px 5px; }
```
