# -*- coding: utf-8 -*-
import re
from pathlib import Path

FILES = [
    "vitrine.html",
    "tarifs.html",
    "dashboard.html",
    "achats.html",
    "index.html",
    "inscription.html",
    "aide.html",
    "header.html",
    "header-client.html",
    "client-dashboard.html",
    "js/artisan.js",
]

REMAP = {
    "ic-artisan": "ic-briefcase",
    "ic-home": "ic-accueil",
}

SVG_OPEN = (
    '<svg class="bs-icon" viewBox="0 0 24 24" width="24" height="24" '
    'fill="none" stroke="currentColor" stroke-width="1.75" '
    'stroke-linecap="round" stroke-linejoin="round">'
)

PATTERN = re.compile(
    r"<svg(?:\s[^>]*)?>\s*<use href=\"#(ic-[a-z0-9-]+)\"\s*/>\s*</svg>",
    re.IGNORECASE,
)


def repl(match: re.Match) -> str:
    icon_id = REMAP.get(match.group(1), match.group(1))
    return f'{SVG_OPEN}<use href="#{icon_id}"/></svg>'


def main() -> None:
    for name in FILES:
        path = Path(name)
        text = path.read_text(encoding="utf-8")
        new, n = PATTERN.subn(repl, text)
        if n:
            path.write_text(new, encoding="utf-8", newline="\n")
            print(f"{name}: {n} svg use fixed")
        else:
            print(f"{name}: no match")


if __name__ == "__main__":
    main()
