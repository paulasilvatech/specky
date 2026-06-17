# Images Reference

Patterns for using images across paulasilvatech materials: AI-generated illustrations, screenshots, photo treatments, decorative imagery, and asset paths. Default rule: **all visual assets are in English**, regardless of the document locale.

## Image categories

| Category | Use | Tool / source |
|---|---|---|
| **AI-generated illustrations** | Hero images, conceptual visuals, abstract content | Midjourney, DALL-E, Imagen, Recraft |
| **Screenshots (real product)** | Documentation accuracy, archival reference | Native OS screenshot |
| **Simulations (faux UI)** | Flexible mockups for slides/landings | See `simulations.md` |
| **Photographs (people, environments)** | Speaker bios, workshop venues, real-world context | Unsplash, Pexels, original |
| **Decorative imagery** | Texture, gradient, abstract background | Generated patterns, sparingly |
| **Diagrams** | Architecture, flow, structure | Mermaid, hand SVG (see `diagrams.md`) |

## Universal rules

1. **English only.** Visual assets in EN regardless of document locale (PT-BR, ES decks still use English images). Reason: assets are reused across locales; maintaining 3 versions is costly.
2. **Inline SVG over raster** when possible. SVG is scalable, themeable, smaller, and crisp at any resolution.
3. **No real PII in images.** Mockup screenshots use fake emails, fake names, fake API keys (`<your-key-here>`).
4. **Alt text always.** Even decorative images need `alt=""` (empty for decorative). Functional images need descriptive alt.
5. **No copyright violations.** Use only: original work, AI-generated, CC0/CC-BY licensed, or properly licensed stock.
6. **Compress before shipping.** PNGs through TinyPNG, JPGs at quality 80-85, WebP for web.

## AI-generated illustrations

For hero images, conceptual section openers, abstract content visuals.

### Prompting style for paulasilvatech

Aim for: **clean, editorial, isometric or schematic, limited palette matching DS layer colors**. Avoid: photorealistic faces, generic stock-style imagery, busy compositions, AI-clichés (glowing brains, robot hands, network meshes).

Example prompts that work:

```
Editorial isometric illustration of a layered software architecture, four
horizontal layers in red/yellow/green/blue, minimalist, clean lines,
no people, no text, white background, top-down perspective, depth via
shadow, vector art aesthetic
```

```
Abstract schematic of agents passing context through a pipeline,
geometric forms, monochrome with single accent color (#00A4EF),
flat design, no human figures, evoking modular composition,
1024x576 aspect ratio for slide hero
```

Models that produce paulasilvatech-aligned style:
- **Recraft**: best for vector/editorial aesthetic, can output SVG
- **Imagen 3**: clean compositions, good for isometric
- **Midjourney** with `--style raw --ar 16:9` and the right reference

### Embedding AI images

Always include a model attribution comment in the HTML:

```html
<!-- AI-generated via Recraft v3, prompt logged in /assets/prompts/hero-stack.md -->
<img src="/assets/hero-stack.webp"
     alt="Layered architecture diagram showing four colored horizontal layers"
     width="1600" height="900"
     loading="lazy" decoding="async">
```

Save the original prompt in `/assets/prompts/{filename}.md` for reproducibility.

## Screenshots

For documentation accuracy. Real product UI captured natively.

### Capture rules

- **Hide personal data.** Real avatars, real emails, real billing, blur or replace.
- **Use a clean profile.** New incognito window or a dedicated demo account.
- **Standard window dimensions.** 1440x900 or 1600x900, matches deck stage.
- **No browser chrome unless relevant.** Crop to the content area.
- **Retina capture.** Always at @2x density for sharp display.

### Embedding

Wrap in a `<figure>` with caption:

```html
<figure class="screenshot">
  <img src="/assets/screenshots/copilot-agent-mode.png"
       alt="GitHub Copilot in agent mode, showing tool calls and a multi-step plan"
       width="1600" height="900"
       loading="lazy">
  <figcaption>GitHub Copilot, agent mode, executing a multi-step refactor.</figcaption>
</figure>
```

CSS:

```css
.screenshot {
  margin: 32px 0;
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-alt);
}
.screenshot img { width: 100%; height: auto; display: block; }
.screenshot figcaption {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--ink-3);
  font-style: italic;
  background: var(--paper);
  border-top: 1px solid var(--rule);
}
```

## Photographs

For people, venues, real-world context. Used in speaker bios, workshop pages, event recaps.

### Treatment

- **Subtle desaturation** (90-95%) for editorial consistency
- **Slight cool-tone shift** to align with DS palette
- **Round corners 8px** for portrait shots in cards

```css
.photo {
  border-radius: 8px;
  overflow: hidden;
}
.photo img {
  width: 100%;
  height: auto;
  display: block;
  filter: saturate(0.92) contrast(1.02);
}
.photo--portrait { aspect-ratio: 1; object-fit: cover; }
.photo--landscape { aspect-ratio: 16/9; object-fit: cover; }
```

### Sources (free, attribution-friendly)

- **Unsplash**: broad library, CC0
- **Pexels**: broad library, CC0
- **Lummi**: AI-friendly stock, free tier
- **Picsum Photos**: placeholder images for prototyping (`https://picsum.photos/1600/900`)

Always prefer original work when the photo is of a real workshop/event you led.

## Decorative imagery

Sparingly. Used for: section openers, hero backgrounds, subtle texture.

Patterns that work in paulasilvatech:

```css
/* Subtle dot grid background */
.bg--dotgrid {
  background-image:
    radial-gradient(circle, var(--rule-2) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Gradient mesh (for hero backgrounds, very subtle) */
.bg--mesh {
  background:
    radial-gradient(at 20% 30%, rgba(0,164,239,0.08), transparent 50%),
    radial-gradient(at 80% 70%, rgba(127,186,0,0.08), transparent 50%),
    radial-gradient(at 50% 100%, rgba(255,185,0,0.06), transparent 50%);
}

/* Diagonal stripe (very thin, very faint) */
.bg--stripes {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 19px,
    rgba(115,115,115,0.04) 19px,
    rgba(115,115,115,0.04) 20px
  );
}
```

Avoid: full-bleed image backgrounds with text overlay (legibility issues), stock illustrations of "diverse business teams", emoji rain, particle systems.

## File organization

For projects with 10+ images:

```
project/
├── assets/
│   ├── hero/
│   │   ├── stack-architecture.webp
│   │   ├── stack-architecture@2x.webp
│   │   └── prompts/
│   │       └── stack-architecture.md  ← AI prompt log
│   ├── screenshots/
│   │   ├── copilot-agent.png
│   │   └── github-actions-run.png
│   ├── photos/
│   │   ├── speaker-paula.jpg
│   │   └── workshop-brasilia-2026.jpg
│   ├── icons/
│   │   └── icons-sprite.svg  ← consolidated SVG sprite (see svg-icons.md)
│   └── decorative/
│       └── dotgrid-bg.svg
```

## Image formats

| Format | Use | Why |
|---|---|---|
| **SVG** | Logos, icons, diagrams, illustrations with simple shapes | Vector, themeable, smallest |
| **WebP** | Photos, complex AI illustrations | Best compression for web |
| **PNG** | Screenshots needing alpha channel, lossless requirement | Sharper than JPG for UI |
| **JPG** | Photos when WebP not supported (rare) | Fallback only |
| **AVIF** | Future-proofing photos (better than WebP), if browser support is acceptable | Smallest for photos |

Do not use GIF. Use animated WebP or short MP4 instead.

## Performance

- **Lazy load** below-the-fold images: `loading="lazy"`
- **Async decode**: `decoding="async"`
- **Width/height attributes always**: prevents layout shift
- **srcset + sizes** for responsive: serve smaller images to smaller viewports
- **Largest image on a page < 200KB** as a target (rare exceptions for hero photography)

## Anti-patterns

- Localizing images (PT version, EN version, ES version), keep them English-only
- Stock photos of "people in tech", feels generic, prefer original
- AI-generated faces or hands, uncanny valley, distracting
- Animated GIFs (use WebP/MP4 instead)
- Decorative images without `alt=""` (screen readers announce filename instead)
- Real customer screenshots without consent and PII removal
- Embedding 4MB hero images (compress!)
- Putting text inside images (not searchable, not translatable, not accessible, use HTML overlay)
