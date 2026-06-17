#!/usr/bin/env python3
"""
deck_to_pdf.py: Convert a paulasilva-ms HTML deck to vector PDF.

The deck must use the paulasilva-ms deck engine (assets/deck.html):
  - Each slide is a <section class="slide ..."> element
  - A global goToSlide(i) JavaScript function is available
  - Slides use 1600x900 stage dimensions

Output is a vector PDF with selectable text, embedded fonts, and proper metadata.

Usage:
  python3 deck_to_pdf.py \\
    --input  /path/to/deck.html \\
    --output /path/to/deck.pdf \\
    --title  "Event Name - Topic" \\
    --author "Paula Silva, Software Global Black Belt" \\
    --subject "Brief description"

Requirements:
  pip install playwright pypdf
  playwright install chromium
"""

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path


CSS_OVERRIDE = """
/* Hide deck navigation chrome from PDF output */
.deck-controls, .kbd-hint, .deck-progress { display: none !important; }
html, body { background: white !important; }

/* Force ALL animations to their final state.
   The deck engine animates eyebrow/title/subtitle/stagger items on slide
   activation. Without this, page.pdf() captures mid-animation and the
   bottom items of stagger lists end up faded out. */
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-fill-mode: forwards !important;
  transition: none !important;
}
.slide[data-active="true"] .eyebrow,
.slide[data-active="true"] .title,
.slide[data-active="true"] .subtitle,
.slide[data-active="true"] .body-large,
.slide[data-active="true"] .meta-grid,
.slide[data-active="true"] .section-number,
.slide[data-active="true"] .section-title,
.slide[data-active="true"] .big-number,
.slide[data-active="true"] .stagger > *,
.slide[data-active="true"] .bar-fill {
  opacity: 1 !important;
  transform: none !important;
}
"""


def render_deck_to_pdf(
    input_html: str,
    output_pdf: str,
    title: str = "",
    author: str = "Paula Silva, Software Global Black Belt",
    subject: str = "",
    creator: str = "paulasilva-ms",
    locale: str | None = None,
    width_px: int = 1600,
    height_px: int = 900,
    slide_settle_ms: int = 500,
    initial_settle_ms: int = 1500,
) -> dict:
    """
    Convert an HTML deck to a vector PDF.

    Returns a dict with keys: pages, size_bytes, output_path.
    Raises on failure (FileNotFoundError, RuntimeError).
    """
    try:
        from playwright.sync_api import sync_playwright
        from pypdf import PdfWriter, PdfReader
    except ImportError as exc:
        sys.exit(
            f"ERROR: a required dependency is missing ({exc.name}).\n"
            "  pip install -r scripts/requirements.txt\n"
            "  python -m playwright install chromium"
        )

    input_path = Path(input_html).resolve()
    if not input_path.is_file():
        raise FileNotFoundError(f"Input HTML not found: {input_path}")

    output_path = Path(output_pdf).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Per-slide PDFs go into a temp directory that we clean up at the end
    with tempfile.TemporaryDirectory(prefix="deck_pdf_") as tmpdir:
        tmpdir_path = Path(tmpdir)
        per_slide_pdfs = []

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": width_px, "height": height_px})
            page.goto(f"file://{input_path}", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(initial_settle_ms)

            # Optionally force a locale (for multi-locale decks)
            if locale:
                has_set_locale = page.evaluate("typeof setLocale !== 'undefined'")
                if has_set_locale:
                    page.evaluate(f"setLocale({locale!r})")
                    page.wait_for_timeout(300)

            # Inject the CSS override
            page.add_style_tag(content=CSS_OVERRIDE)

            # Verify the deck engine is available
            has_goto = page.evaluate("typeof goToSlide !== 'undefined'")
            if not has_goto:
                browser.close()
                raise RuntimeError(
                    "goToSlide() is not defined. The deck script may have a "
                    "JavaScript error (commonly: duplicate `const I18N` "
                    "declarations). Open the HTML in a browser and check the "
                    "console for syntax errors."
                )

            total = page.evaluate("document.querySelectorAll('.slide').length")
            if total == 0:
                browser.close()
                raise RuntimeError("No slides found. Expected `<section class='slide ...'>` elements.")

            print(f"Rendering {total} slides at {width_px}x{height_px}...")

            for i in range(total):
                page.evaluate(f"goToSlide({i})")
                page.wait_for_timeout(slide_settle_ms)

                slide_pdf = tmpdir_path / f"slide_{i+1:03d}.pdf"
                page.pdf(
                    path=str(slide_pdf),
                    width=f"{width_px}px",
                    height=f"{height_px}px",
                    print_background=True,
                    margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                )
                per_slide_pdfs.append(slide_pdf)

                if (i + 1) % 10 == 0 or (i + 1) == total:
                    print(f"  {i+1}/{total}")

            browser.close()

        # Merge all per-slide PDFs
        print(f"Merging {len(per_slide_pdfs)} pages...")
        writer = PdfWriter()
        for pdf_path in per_slide_pdfs:
            reader = PdfReader(str(pdf_path))
            for pg in reader.pages:
                writer.add_page(pg)

        # Add metadata
        metadata = {"/Creator": creator}
        if title:
            metadata["/Title"] = title
        if author:
            metadata["/Author"] = author
        if subject:
            metadata["/Subject"] = subject
        writer.add_metadata(metadata)

        with open(output_path, "wb") as f:
            writer.write(f)

    size = output_path.stat().st_size
    pages = len(writer.pages)
    print(f"\n✓ Output: {output_path}")
    print(f"  Pages: {pages}")
    print(f"  Size:  {size//1024} KB ({size/1024/1024:.2f} MB)")

    # Validate output: extract text from cover and verify identity strings
    reader = PdfReader(str(output_path))
    cover_text = reader.pages[0].extract_text() or ""
    last_text = reader.pages[-1].extract_text() or ""
    combined = cover_text + last_text

    warnings = []
    if "Software Global Black Belt" not in combined:
        warnings.append("Cover/last page does not contain 'Software Global Black Belt'")
    if "AI-Native Software Engineer" in combined:
        warnings.append("FORBIDDEN string 'AI-Native Software Engineer' found (personal identity leak)")
    if "@paulasilvatech" in combined:
        warnings.append("FORBIDDEN string '@paulasilvatech' found (personal handle leak)")
    if "agenticdevopsplatform" in combined.lower():
        warnings.append("FORBIDDEN string 'agenticdevopsplatform' found (personal site leak)")

    if warnings:
        print("\n⚠️  Validation warnings:")
        for w in warnings:
            print(f"  - {w}")

    return {
        "pages": pages,
        "size_bytes": size,
        "output_path": str(output_path),
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Convert a paulasilva-ms HTML deck to vector PDF.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--input", "-i", required=True, help="Path to deck HTML file")
    parser.add_argument("--output", "-o", required=True, help="Path for output PDF file")
    parser.add_argument("--title", default="", help="PDF metadata title")
    parser.add_argument(
        "--author",
        default="Paula Silva, Software Global Black Belt",
        help="PDF metadata author (default: paulasilva-ms canonical)",
    )
    parser.add_argument("--subject", default="", help="PDF metadata subject/description")
    parser.add_argument("--creator", default="paulasilva-ms", help="PDF metadata creator")
    parser.add_argument(
        "--locale",
        required=True,
        choices=["en", "pt-BR", "es"],
        help="REQUIRED. Locale to render the deck in before exporting. A PDF is a "
             "single-language deliverable; always state which language you want.",
    )
    parser.add_argument("--width", type=int, default=1600, help="Slide stage width in px (default: 1600)")
    parser.add_argument("--height", type=int, default=900, help="Slide stage height in px (default: 900)")
    parser.add_argument(
        "--settle-ms",
        type=int,
        default=500,
        help="ms to wait per slide before rendering (default: 500)",
    )

    args = parser.parse_args()

    try:
        result = render_deck_to_pdf(
            input_html=args.input,
            output_pdf=args.output,
            title=args.title,
            author=args.author,
            subject=args.subject,
            creator=args.creator,
            locale=args.locale,
            width_px=args.width,
            height_px=args.height,
            slide_settle_ms=args.settle_ms,
        )
        # Exit with error code if validation warnings, but file was still produced
        if result["warnings"]:
            sys.exit(2)
    except (FileNotFoundError, RuntimeError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
