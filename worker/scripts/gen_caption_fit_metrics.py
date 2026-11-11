#!/usr/bin/env python3
"""E3fix2: caption line-fit font metrics (worker + editor preview share ONE table).

Writes byte-identical copies to
  worker/clips_worker/caption_font_metrics.json   (captions_ass / caption_fit.py)
  new-app/lib/clips/caption-fit-metrics.json       (lib/clips/caption-fit.ts)
from the TTFs the export burns with (worker/prototype/v3/fonts, worker/v3/fonts/t6).
Keys are the libass font names resolve_ass_font_name() returns. Advances are the default
instance (hmtx) for variable fonts; libass sizes a face by usWinAscent + usWinDescent.

    pip install fonttools && python worker/scripts/gen_caption_fit_metrics.py
"""
from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
V3 = ROOT / "worker" / "prototype" / "v3" / "fonts"
T6 = ROOT / "worker" / "v3" / "fonts" / "t6"
FONTS = {
    "Poppins ExtraBold": V3 / "Poppins-ExtraBold.ttf",
    "Anton": V3 / "Anton-Regular.ttf",
    "Montserrat Black": V3 / "Montserrat-Black.ttf",
    "Bangers": T6 / "Bangers.ttf",
    "Inter": T6 / "Inter.ttf",
    "Lato": T6 / "Lato.ttf",
    "Bebas Neue": T6 / "BebasNeue.ttf",
    "Luckiest Guy": T6 / "LuckiestGuy.ttf",
    "Archivo Black": T6 / "ArchivoBlack.ttf",
    "Oswald": T6 / "Oswald.ttf",
    "Rubik": T6 / "Rubik.ttf",
    "Gabarito": T6 / "Gabarito.ttf",
    "Fira Sans Condensed": T6 / "FiraSansCondensed-Bold.ttf",
    "DM Serif Display": T6 / "DMSerifDisplay-Regular.ttf",
    "Playfair Display": T6 / "PlayfairDisplay.ttf",
    "Caveat": T6 / "Caveat.ttf",
    "Space Grotesk": T6 / "SpaceGrotesk.ttf",
    "Space Mono": T6 / "SpaceMono-Regular.ttf",
    "Noto Sans Arabic": T6 / "NotoSansArabic.ttf",
    "Noto Sans Devanagari": T6 / "NotoSansDevanagari.ttf",
    "Noto Sans Thai": T6 / "NotoSansThai.ttf",
    "Noto Sans JP": T6 / "NotoSansJP.ttf",
    "Noto Emoji": T6 / "NotoEmoji.ttf",
}
MAX_CP = 0x250  # Latin + Latin-1 + Latin Extended-A/B; anything else uses defaultAdv
OUTS = [
    ROOT / "worker" / "clips_worker" / "caption_font_metrics.json",
    ROOT / "new-app" / "lib" / "clips" / "caption-fit-metrics.json",
]


def font_row(path: Path) -> dict:
    f = TTFont(path)
    upm = f["head"].unitsPerEm
    os2, cmap, hmtx = f["OS/2"], f.getBestCmap(), f["hmtx"].metrics
    adv_all = {cp: hmtx[g][0] for cp, g in cmap.items() if cp < 0x2FFF}
    return {
        "unitsPerEm": upm,
        "assEmPerFontsize": round(upm / (os2.usWinAscent + os2.usWinDescent), 6),
        "defaultAdv": int(sum(adv_all.values()) / max(1, len(adv_all))),
        "adv": {str(cp): a for cp, a in sorted(adv_all.items()) if cp < MAX_CP},
    }


def main() -> None:
    data = {name: font_row(p) for name, p in FONTS.items()}
    text = json.dumps(data, separators=(",", ":"), sort_keys=True) + "\n"
    for out in OUTS:
        out.write_text(text)
        print(out.relative_to(ROOT), len(text))


if __name__ == "__main__":
    main()
