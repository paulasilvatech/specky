# Editorial Spine: Trilingual Single-Source Pattern (paulasilva-ms)

The spine is the canonical structured content for a topic, used by every output format (deck, playbook, site, social post). It lives in `content/` at the workspace root and is the only place editorial truth is allowed to be edited. All formats consume the spine; none of them re-author it.

The spine pattern is shared with `paulasilvatech-ds`. The difference for MS material is in the **meta** keys (role, contact, signature) and the **trilingual policy** (the EN tagline does not get translated, see below).

## Why the spine exists

Without it, the same idea drifts across formats. The deck slide says one number; the workshop guide says another; the customer leave-behind inflates both. The spine fixes one truth per fact, in one place, in three languages.

## File layout (workspace root)

```
content/
├── content.json              # Spine: meta, layers/parts, narrative structure (trilingual)
├── i18n-en.json              # Slide-by-slide / section-by-section EN copy
├── i18n-pt.json              # Slide-by-slide / section-by-section PT-BR copy
├── i18n-es.json              # Slide-by-slide / section-by-section ES copy
└── Brand_Voice_*.md          # Voice canon (separate, see references/voice.md)
```

## `content.json`: what goes in

Same structure as paulasilvatech-ds spine, with these MS-identity overrides in `meta`:

```json
{
  "$version": "1.0.0",
  "$author": "Paula Silva",                    // not "AI-Native Software Engineer"
  "$date": "2026-04-22",

  "meta": {
    "en": {
      "title": "...",
      "subtitle": "...",
      "tagline": "Building the future of software development with AI and Agentic DevOps",
      "author": "Paula Silva",
      "role": "Software Global Black Belt",   // mandatory MS role string
      "contact": "paulasilva@microsoft.com",   // mandatory single channel
      "audience": "...",
      "duration": "...",
      "output": "..."
    },
    "pt-BR": {
      "title": "...",
      "subtitle": "...",
      "tagline": "Building the future of software development with AI and Agentic DevOps",  // EN, NOT translated
      "author": "Paula Silva",
      "role": "Software Global Black Belt",   // EN role, NOT translated
      "contact": "paulasilva@microsoft.com",
      ...
    },
    "es": {
      "tagline": "Building the future of software development with AI and Agentic DevOps",  // EN, NOT translated
      "role": "Software Global Black Belt",   // EN role, NOT translated
      ...
    }
  },

  "stack_layers": { ... },              // same shape as DS spine
  "narrative_structure": { ... }
}
```

What belongs here (same as DS):
- Meta (title, subtitle, tagline, author/role/contact, audience, duration, expected output).
- Conceptual primitives (layers, pillars, parts, phases).
- Narrative structure.
- Color/accent assignments.

What does NOT belong here:
- Slide-by-slide copy → `i18n-{locale}.json`.
- Body prose → playbook HTML or markdown guide.
- Style details → references and assets.
- **Personal socials** (`@paulasilvatech`, LinkedIn, agenticdevopsplatform.com), never appear in MS spine.

## MS-specific i18n rules

Three locale files, but two strings stay English-only across all three:

1. **Role**: `Software Global Black Belt` (never `Especialista Software Global Black Belt`, never `Especialista Software Microsoft`).
2. **Tagline**: `Building the future of software development with AI and Agentic DevOps` (never translated).

Everything else in i18n IS translated per locale (slide titles, body copy, section labels, stat descriptions).

Localize labels:
- EN: `Author / Role / Contact / Date`
- PT-BR: `Autora / Papel / Contato / Data`
- ES: `Autora / Rol / Contacto / Fecha`

Values stay English on role/tagline; everything else translates.

## Format consumers

| Format | How it consumes the spine |
|---|---|
| **Deck (HTML)** | Reads `i18n-{locale}.json` at runtime via `window.I18N`; uses `content.json` for chapter/section metadata at build time |
| **Playbook (HTML)** | Imports `content.json` for the narrative structure (chapter list, accents); body prose authored separately |
| **Markdown guide** | Frontmatter mirrors spine `meta` (with MS role + contact); body authored in MD |
| **PDF (from deck)** | Inherits the source HTML's locale; no separate spine consumption |
| **PPTX** | Manual port; use spine values verbatim |
| **Workshop one-pager / handout** | Pulls 3-5 key strings from spine; uses MS contact card |
| **Site (Astro)** | Rare for MS material, see `references/site.md` |

## Workflow

1. **Write the spine first.** Before any deck/playbook/handout, edit `content.json` to capture meta + layers + parts in EN. Port to PT-BR and ES.
2. **Write the audience-closest locale first.** Translation last, never first.
3. **Bump the spine version** when conceptual primitives change. Slide-text edits are not spine changes.
4. **Format files declare which spine version they consumed.** Re-render candidates when spine bumps.
5. **Never edit the same fact in two places.**

## Pre-publish checklist (MS spine)

- [ ] Role is `Software Global Black Belt` in all three locales (English, never translated)
- [ ] Tagline is the English form in all three locales (never translated)
- [ ] Contact is `paulasilva@microsoft.com` (single channel; no socials)
- [ ] No `AI-Native Software Engineer` anywhere in any locale of any spine file
- [ ] No `@paulasilvatech`, `paulanunes`, or `agenticdevopsplatform.com` in any spine file
- [ ] All three i18n files have the same key shape (trilingual integrity check)
- [ ] Every stat has a `source` key with paper / sample / year
- [ ] Format file (deck/playbook) declares which spine version it was rendered from

## Trilingual integrity check

```bash
# Compare key shapes across locales (requires jq)
for f in content/i18n-{en,pt,es}.json; do
  jq 'paths | join(".")' "$f" | sort > "/tmp/keys_$(basename $f .json).txt"
done
diff /tmp/keys_i18n-en.txt /tmp/keys_i18n-pt.txt
diff /tmp/keys_i18n-en.txt /tmp/keys_i18n-es.txt
```

Any diff is a translation drift bug.

## MS forbidden-strings audit (apply to spine + every i18n file)

```bash
for f in content/content.json content/i18n-*.json; do
  echo "=== $f ==="
  for s in "AI-Native Software Engineer" "@paulasilvatech" "paulanunes" \
           "agenticdevopsplatform" "Microsoft Americas" "Software GBB Americas" \
           "Construindo o futuro" "Construyendo el futuro"; do
    count=$(grep -c "$s" "$f" 2>/dev/null || echo 0)
    [ "$count" -gt 0 ] && echo "  FAIL '$s' appears $count time(s)"
  done
done
```

Any output means the MS spine is contaminated. Fix before delivering.
