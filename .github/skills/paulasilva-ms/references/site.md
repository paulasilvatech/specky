# Astro Site Reference (paulasilva-ms)

Multi-page Astro sites are **rare** under MS identity. Most MS deliverables are decks, playbooks, or markdown guides, one HTML file per artifact, no static-site generator. A site is appropriate only when the material is a long-running enablement hub that needs trilingual routing, search, and multiple linked chapters.

When a site IS the right format, the technical pattern is identical to `paulasilvatech-ds`. The difference is only in identity, voice, and what cannot appear.

## When to use a site (MS-identity)

Use only if all of these are true:
- The material has 6+ chapters that warrant separate pages.
- Trilingual routing is required (EN/PT-BR/ES with language switcher).
- The audience returns repeatedly across weeks or months.
- The content is approved for public web hosting under the MS role.

If any of these is false, prefer:
- **HTML playbook**: see `references/playbook.md`, for self-contained long-form.
- **Markdown guide**: see `references/markdown-guide.md`, for living source documents.
- **Deck**: see `references/deck.md`, for talk material.

## Tech pattern (inherits from sister skill)

The full Astro stack (Astro 4.16+, MDX content collections, Tailwind + DS tokens, Pagefind search, dark mode, scrollspy TOC) is documented in `paulasilvatech-ds/references/site.md`. Follow that reference for:
- Directory structure.
- Component layer (content / diagrams / interactive).
- MDX content collections schema.
- Pagefind integration.
- Trilingual routing pattern.
- Build and deploy targets.

## MS-specific overrides

When forking the `paulasilvatech-ds` site pattern for MS material, replace:

| Element | paulasilvatech | paulasilva-ms |
|---|---|---|
| Author string | `Paula Silva, AI-Native Software Engineer` | `Paula Silva, Software Global Black Belt` |
| Contact | GitHub, LinkedIn, site | `paulasilva@microsoft.com` (single channel) |
| Footer socials | `@paulasilvatech` + `paulanunes` + `agenticdevopsplatform.com` | none, email only |
| Tagline | Localized per locale | English only, never translated |
| Domain | `agenticdevopsplatform.com` or personal | Microsoft-approved domain or subdomain |
| Analytics | Personal account | Microsoft-managed, follow MS data policy |
| OG image author | "Paula Silva, AI-Native Software Engineer" | "Paula Silva, Software Global Black Belt" |

## Forbidden in MS sites

A search-and-confirm pass on the entire built site must return zero hits for:
- `AI-Native Software Engineer`
- `@paulasilvatech`
- `paulanunes`
- `agenticdevopsplatform.com`
- `linkedin.com/in/paulanunes`
- `Microsoft Americas`, `Software GBB Americas`
- Translated forms of the role or tagline (`Especialista Software`, `Construindo o futuro`, `Construyendo el futuro`)

Run the audit from `references/identity.md` against the contents of `dist/` (post-build).

## Pre-launch checklist (MS site)

- [ ] All pages declare role as `Software Global Black Belt`
- [ ] Footer has only `paulasilva@microsoft.com`, no socials
- [ ] Tagline appears in English on EN, PT-BR, and ES pages
- [ ] No personal-identity strings in any rendered HTML, JSON, or sitemap
- [ ] Pagefind index does not surface any forbidden string
- [ ] OG / meta tags use the MS identity strings
- [ ] Privacy notice and cookie banner align with Microsoft data policy
- [ ] Domain ownership and DNS use Microsoft-approved infrastructure
- [ ] Analytics consent flow follows Microsoft data policy
- [ ] Forbidden-strings audit run against `dist/` returns zero hits

## When in doubt

If you are not sure a site is the right format for the MS material, it probably is not. Default to playbook or markdown guide. Sites carry a maintenance burden (build, deploy, content sync, dependency upgrades) that is rarely worth it for one-off enablement material.
