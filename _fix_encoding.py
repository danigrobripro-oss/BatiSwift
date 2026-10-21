# -*- coding: utf-8 -*-
from pathlib import Path

FILES = [
    "vitrine.html",
    "tarifs.html",
    "dashboard.html",
    "achats.html",
    "carte-client.html",
]


def looks_mojibake(text: str) -> bool:
    return any(m in text for m in ("Ã", "Â", "â€", "ðŸ", "âš", "âœ", "â†", "â”", "â•"))


def to_original_bytes(text: str) -> bytes:
    text = text.lstrip("\ufeff")
    out = bytearray()
    for ch in text:
        o = ord(ch)
        if o <= 0xFF:
            out.append(o)
        else:
            try:
                out.extend(ch.encode("cp1252"))
            except UnicodeEncodeError:
                out.extend(ch.encode("utf-8"))
    return bytes(out)


def main() -> None:
    for name in FILES:
        path = Path(name)
        text = path.read_text(encoding="utf-8-sig")
        print(f"=== {name} markers={looks_mojibake(text)}")
        if not looks_mojibake(text):
            continue
        raw = to_original_bytes(text)
        try:
            fixed = raw.decode("utf-8")
        except UnicodeDecodeError as e:
            print(f"    utf-8 decode fail: {e}")
            fixed = raw.decode("utf-8", errors="replace")
            print("    using replacement")
        print(f"    still_markers={looks_mojibake(fixed)}")
        path.write_text(fixed, encoding="utf-8", newline="\n")
        print("    WRITTEN ok")


if __name__ == "__main__":
    main()
