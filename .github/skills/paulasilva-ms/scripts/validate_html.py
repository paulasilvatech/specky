#!/usr/bin/env python3
"""Validate an HTML deliverable against the paulasilva-ms identity rules.

Hard gate. Exits non-zero on any error so a deliverable cannot be presented
while it violates the identity, the favicon rule, the social-preview rule, or
the copy rules. Run it on every HTML output (landing, deck, showcase, playbook
page, any standalone page) before presenting.

Checks:
  1. Inline Microsoft favicon (SVG data URI, Microsoft 4-color palette).
  2. No external favicon.svg reference.
  3. Social preview meta (Open Graph and Twitter) with og:locale.
  4. Microsoft identity: contact email present, role string present.
  5. No personal-brand leaks (personal social handles, personal palette).
  6. No em dashes. "GitHub Copilot" never abbreviated to bare "Copilot".

Usage:
    python validate_html.py <file.html> [<file2.html> ...] [--check-assets]

With --check-assets, referenced local preview images (og:image, twitter:image)
must exist on disk; this is opt-in so a draft without previews still validates.

See references/head-meta.md and references/identity.md for the rules.
"""

import os
import re
import sys

MS_PALETTE = ("F25022", "7FBA00", "FFB900", "00A4EF")
PERSONAL_PALETTE = ("FF3133", "7ED956", "FFDE59", "39B8FF")
# Personal-brand patterns that must never appear in an MS deliverable.
PERSONAL_BRAND = [
    r"github\.com/paulasilvatech",
    r"linkedin\.com/in/",
    r"paulanovais",
    r"@paulasilvatech",
    r"twitter\.com/\w",
    r"x\.com/paula",
]
OG_REQUIRED = [
    "og:title", "og:description", "og:image", "og:locale",
    "twitter:card", "twitter:image",
]


def validate(path, check_assets=False):
    errors = []
    try:
        content = open(path, encoding="utf-8").read()
    except OSError as exc:
        return [f"cannot read file: {exc}"]

    # 1. Inline Microsoft favicon.
    fav = re.search(r'rel=["\']icon["\'][^>]*href=["\'](data:image/svg\+xml,[^"\']*)["\']', content)
    if not fav:
        errors.append("missing inline Microsoft favicon (data:image/svg+xml). See references/head-meta.md")
    elif not all(c in fav.group(1) for c in MS_PALETTE):
        errors.append("favicon does not use the Microsoft 4-color palette")

    # 2. No external favicon reference.
    if re.search(r'href=["\'][^"\']*favicon\.svg["\']', content):
        errors.append("external favicon.svg reference found (must inline the data URI)")

    # 3. Social preview meta.
    missing = [m for m in OG_REQUIRED if m not in content]
    if missing:
        errors.append(f"social preview meta missing: {missing}. See references/head-meta.md")

    # 4. Microsoft identity.
    if "paulasilva@microsoft.com" not in content:
        errors.append("Microsoft contact email (paulasilva@microsoft.com) not found")
    if "Software Global Black Belt" not in content:
        errors.append("role string 'Software Global Black Belt' not found")

    # 5. Personal-brand leaks (ignore lines that forbid them in rule text).
    for pat in PERSONAL_BRAND:
        for m in re.finditer(pat, content, re.I):
            line_start = content.rfind("\n", 0, m.start()) + 1
            line_end = content.find("\n", m.start())
            line = content[line_start:line_end if line_end != -1 else len(content)]
            if re.search(r"forbidden|never|must not|do not|don't|no mention|avoid", line, re.I):
                continue
            errors.append(f"personal-brand leak: '{m.group(0)}'")
            break
    if any(c in content for c in PERSONAL_PALETTE):
        errors.append("personal palette color found (forbidden in MS output)")

    # 6. Copy rules.
    if "\u2014" in content:
        errors.append("em dash found (forbidden); use commas, parentheses, or restructure")
    if re.search(r"(?<![A-Za-z])Copilot\b", content) and "GitHub Copilot" not in content:
        errors.append("bare 'Copilot' without 'GitHub Copilot'")

    # 7. Asset existence (opt-in): referenced local preview images must exist.
    if check_assets:
        errors.extend(_missing_assets(path, content))

    return errors


def _missing_assets(path, content):
    """Return errors for og:image/twitter:image local files that do not exist."""
    refs = re.findall(
        r'<meta[^>]*(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]*content=["\']([^"\']+)["\']',
        content,
    )
    refs += re.findall(
        r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)["\']',
        content,
    )
    base = os.path.dirname(os.path.abspath(path))
    out = []
    for ref in sorted(set(refs)):
        if ref.startswith(("http://", "https://", "data:")):
            continue
        if not os.path.isfile(os.path.normpath(os.path.join(base, ref))):
            out.append(f"preview asset missing: {ref} (generate it before publishing)")
    return out


def main(argv):
    args = argv[1:]
    check_assets = "--check-assets" in args
    files = [a for a in args if not a.startswith("--")]
    if not files:
        print("usage: python validate_html.py <file.html> [...] [--check-assets]")
        return 2
    total = 0
    for path in files:
        errs = validate(path, check_assets=check_assets)
        if errs:
            total += len(errs)
            print(f"FAIL {path}")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"OK   {path}")
    if total:
        print(f"\n{total} error(s). Fix before presenting; do not ship an off-identity deliverable.")
        return 1
    print("\nAll HTML deliverables pass the paulasilva-ms identity gate.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
