#!/usr/bin/env python3
"""Generate caption-font-metrics.json from worker TTF paths (fontTools)."""
from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = {
    "Poppins": ROOT / "worker/prototype/v3/fonts/Poppins-ExtraBold.ttf",
}


def metrics_for(path: Path) -> dict:
    tt = TTFont(str(path))
    head = tt["head"]
    upm = head.unitsPerEm
    os2 = tt.get("OS/2")
    if os2 is not None:
        asc = int(os2.sTypoAscender)
        desc = abs(int(os2.sTypoDescender))
    else:
        asc = int(head.yMax)
        desc = abs(int(head.yMin))
    win = asc + desc
    return {
        "unitsPerEm": upm,
        "winAscent": asc,
        "winDescent": desc,
        "cssEmPerAssFontsize": round(upm / win, 6) if win else 1.0,
    }


def main() -> None:
    out: dict[str, dict] = {}
    for name, path in FONTS.items():
        if not path.is_file():
            raise SystemExit(f"missing font: {path}")
        out[name] = metrics_for(path)
    dest = ROOT / "new-app/lib/clips/caption-font-metrics.json"
    dest.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
