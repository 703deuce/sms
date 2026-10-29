#!/usr/bin/env python3
"""Generate new-app/lib/clips/font-metrics/<Font>.json from the worker TTFs (single source)."""
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

FONTS = {
    "Anton": "Anton-Regular.ttf",
    "Montserrat Black": "Montserrat-Black.ttf",
    "Poppins": "Poppins-ExtraBold.ttf",
}
SRC = Path(__file__).resolve().parents[2] / "worker" / "prototype" / "v3" / "fonts"
# Anton/Montserrat may only exist in public/fonts/clip after sync — prefer worker v3 then clip public copy
CLIP_FONTS = Path(__file__).resolve().parents[1] / "public" / "fonts" / "clip"
OUT = Path(__file__).resolve().parents[1] / "lib" / "clips" / "font-metrics"
OUT.mkdir(parents=True, exist_ok=True)


def resolve_font(file: str) -> Path:
    p = SRC / file
    if p.is_file():
        return p
    p = CLIP_FONTS / file
    if p.is_file():
        return p
    raise FileNotFoundError(file)


for name, file in FONTS.items():
    f = TTFont(resolve_font(file))
    upm = f["head"].unitsPerEm
    os2, cmap, hmtx = f["OS/2"], f.getBestCmap(), f["hmtx"].metrics
    adv = {str(cp): hmtx[g][0] for cp, g in cmap.items() if cp < 0x2FFF}
    data = {
        "unitsPerEm": upm,
        "winAscent": os2.usWinAscent,
        "winDescent": os2.usWinDescent,
        "hheaAscent": f["hhea"].ascent,
        "hheaDescent": f["hhea"].descent,
        "capHeight": getattr(os2, "sCapHeight", int(upm * 0.7)),
        "spaceAdv": hmtx[cmap[32]][0],
        "defaultAdv": int(sum(adv.values()) / max(1, len(adv))),
        "assEmPerFontsize": round(upm / (os2.usWinAscent + os2.usWinDescent), 6),
        "adv": adv,
    }
    (OUT / f"{name.replace(' ', '')}.json").write_text(json.dumps(data, separators=(",", ":")))
    print(name, data["assEmPerFontsize"])
