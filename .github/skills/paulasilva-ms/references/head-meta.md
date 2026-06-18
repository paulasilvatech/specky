# Head, favicon, and social preview (mandatory)

Every HTML deliverable in the paulasilva-ms identity (landing, deck, showcase, playbook index and chapters, any standalone page) must ship a self-contained `<head>` with the Microsoft favicon and the social preview meta. Self-contained means no external file references, so the artifact keeps its identity when moved or shared.

## 1. Favicon (inline Microsoft mark, always)

Use the four-color `</>` Microsoft mark inlined as an SVG data URI. Never reference an external `favicon.svg` file (it breaks when the HTML is moved).

```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201914%201062%22%3E%3Cpath%20fill%3D%22%23F25022%22%20d%3D%22M532%20131%20L36%20462%20L13%20497%20L13%20560%20L23%20582%20L48%20604%20L521%20923%20L539%20926%20L539%20699%20L547%20680%20L314%20530%20L527%20395%20L551%20371%20L558%20347%20L558%20155%20L547%20135%20Z%22%2F%3E%3Cpath%20fill%3D%22%237FBA00%22%20d%3D%22M551%20681%20L542%20693%20L540%20700%20L540%20917%20L546%20930%20L558%20940%20L571%20943%20L778%20943%20L788%20941%20L798%20935%20L809%20910%20L809%20702%20L807%20694%20L799%20682%20L784%20674%20L566%20674%20Z%22%2F%3E%3Cpath%20fill%3D%22%23FFB900%22%20d%3D%22M1390%2016%20L1208%2013%20L1184%2023%20L1171%2038%20L768%201009%20L768%201026%20L778%201038%20L957%201042%20L975%201037%20L995%201017%20L1346%20179%20L1349%20145%20L1367%20129%20L1401%2047%20L1402%2031%20Z%22%2F%3E%3Cpath%20fill%3D%22%2300A4EF%22%20d%3D%22M1369%20131%20L1350%20149%20L1349%20355%20L1354%20369%20L1385%20399%20L1592%20528%20L1373%20667%20L1354%20688%20L1349%20703%20L1349%20907%20L1361%20924%20L1377%20926%20L1871%20595%20L1893%20563%20L1894%20501%20L1885%20477%20L1863%20456%20L1398%20142%20Z%22%2F%3E%3C%2Fsvg%3E" />
```

The four fills are the Microsoft palette only: `#F25022`, `#7FBA00`, `#00A4EF`, `#FFB900`. Never use the personal palette in the favicon.

## 2. Social preview meta (Open Graph and Twitter)

Add a 1200x630 preview so shared links render a card. Keep the title and description in the page locale, write "GitHub Copilot" in full, and use no em dashes.

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="<localized title>" />
<meta property="og:description" content="<localized one-line summary>" />
<meta property="og:image" content="preview-en.png" />
<meta property="og:url" content="<canonical url or filename>" />
<meta property="og:locale" content="en_US" />
<meta property="og:locale:alternate" content="pt_BR" />
<meta property="og:locale:alternate" content="es_ES" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="<localized title>" />
<meta name="twitter:description" content="<localized one-line summary>" />
<meta name="twitter:image" content="preview-en.png" />
```

Locale codes: English `en_US`, Portuguese `pt_BR`, Spanish `es_ES`.

## 3. Preview image per language

The preview card is a 1200x630 image. Because social scrapers do not run JavaScript, the language a card shows is fixed at share time, so produce one preview per locale:

- For a single multilingual file (client-side language switch): set `og:locale` to the default locale you are sharing, add `og:locale:alternate` for the other two, and write `og:title` and `og:description` in that default locale. Reference `preview-<locale>.png`.
- For per-locale exports (the skill already exports one deck or page per locale): each exported HTML carries its own `og:locale`, its own localized `og:title` and `og:description`, and its own `preview-<locale>.png`.

Generate each preview by rendering the cover or hero in that locale at 1200x630 and saving `assets/preview-en.png`, `assets/preview-pt.png`, `assets/preview-es.png`. Name the file in `og:image` and `twitter:image` to match the locale of the exported page.

## Checklist before a page is done

1. Inline Microsoft favicon present (no external `favicon.svg` reference).
2. Open Graph and Twitter meta present, title and description localized to the page.
3. `og:locale` set, with `og:locale:alternate` for the other two languages.
4. A 1200x630 `preview-<locale>.png` exists and is referenced.
5. Favicon fills are the Microsoft palette only.
