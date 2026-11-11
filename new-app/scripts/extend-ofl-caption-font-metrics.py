#!/usr/bin/env python3
"""Generate additive CSS/libass em-size metrics for the eight pinned OFL faces.
Preserves existing document metrics exactly; fails closed when a TTF is absent.
"""
from __future__ import annotations
import json
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = ROOT / "worker/v3/fonts/t6"
DEST = ROOT / "new-app/lib/clips/caption-font-metrics.json"
NEW = {
    "Rubik": "Rubik.ttf",
    "Gabarito": "Gabarito.ttf",
    "Fira Sans Condensed": "FiraSansCondensed-Bold.ttf",
    "DM Serif Display": "DMSerifDisplay-Regular.ttf",
    "Playfair Display": "PlayfairDisplay.ttf",
    "Caveat": "Caveat.ttf",
    "Space Grotesk": "SpaceGrotesk.ttf",
    "Space Mono": "SpaceMono-Regular.ttf",
}

data = json.loads(DEST.read_text(encoding="utf-8"))
for family, filename in NEW.items():
    path = FONT_DIR / filename
    font = TTFont(path)
    head, os2 = font["head"], font["OS/2"]
    asc, desc = int(os2.sTypoAscender), abs(int(os2.sTypoDescender))
    total = asc + desc
    if total <= 0: raise ValueError(f"invalid metrics for {family}")
    data[family] = {
        "unitsPerEm": head.unitsPerEm,
        "winAscent": asc, "winDescent": desc,
        "cssEmPerAssFontsize": round(head.unitsPerEm / total, 6),
    }
    print("[font-metrics]", family, data[family]["cssEmPerAssFontsize"])
DEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
