#!/usr/bin/env python3
"""
export_notes.py: extract speaker notes from a paulasilva-ms deck HTML into
one markdown file per locale.

Run this whenever a deck is generated. It reads the deck's const I18N block
and writes, next to the deck:

    {base}_notes_en.md
    {base}_notes_pt-br.md
    {base}_notes_es.md

where {base} is the deck file name with any trailing locale tag removed.
These .md files are the source `build_pptx.py` reads to populate the native
PowerPoint speaker-notes pane in the requested language.

Notes live in I18N[locale].notes as { s1: "...", s2: "..." }, keyed by
1-based slide index. A slide with no entry is simply omitted from the file.

Usage:
    python3 export_notes.py --input deck.html
    python3 export_notes.py -i deck.html --outdir ./notes
"""
import argparse, json, re
from pathlib import Path

LOCALES = ["en", "pt-BR", "es"]

def extract_i18n(html):
    m = re.search(r'const I18N = (\{.*?\n\});', html, re.S)
    if not m:
        raise SystemExit("ERROR: no `const I18N = {...}` found in the deck HTML.")
    return json.loads(m.group(1))

def extract_title(html, locale, i18n):
    # prefer I18N[locale].meta.title, fall back to <title>
    try:
        return i18n[locale]["meta"]["title"]
    except Exception:
        m = re.search(r'<title[^>]*>(.*?)</title>', html, re.S)
        return m.group(1).strip() if m else "Deck"

def slide_count(html):
    return len(re.findall(r'<section class="slide', html))

def main():
    ap = argparse.ArgumentParser(description="Export deck speaker notes to per-locale markdown.")
    ap.add_argument("--input", "-i", required=True, help="Path to the deck HTML file")
    ap.add_argument("--outdir", "-d", default=None, help="Output directory (default: alongside the deck)")
    args = ap.parse_args()

    deck = Path(args.input)
    html = deck.read_text(encoding="utf-8")
    i18n = extract_i18n(html)
    outdir = Path(args.outdir) if args.outdir else deck.parent
    outdir.mkdir(parents=True, exist_ok=True)
    base = re.sub(r'_(en|pt-br|es|multi)$', '', deck.stem, flags=re.I)
    total = slide_count(html)

    written = []
    for loc in LOCALES:
        if loc not in i18n:
            continue
        notes = i18n[loc].get("notes", {})
        title = extract_title(html, loc, i18n)
        lines = [f"# Speaker notes: {title} ({loc})", ""]
        present = 0
        for n in range(1, total + 1):
            note = notes.get(f"s{n}")
            if not note:
                continue
            present += 1
            lines.append(f"## Slide {n}")
            lines.append("")
            lines.append(note.strip())
            lines.append("")
        out = outdir / f"{base}_notes_{loc.lower()}.md"
        out.write_text("\n".join(lines), encoding="utf-8")
        written.append((out, present, total))

    for path, present, total in written:
        print(f"wrote: {path}  ({present}/{total} slides have notes)")
    if not written:
        print("no locales found in I18N; nothing written")

if __name__ == "__main__":
    main()
