"""G3b: shapes, stickers and progress bars on the Text lane — ASS vector drawings (\\p1).

Mirror of new-app/lib/clips/render-plan/text-shapes.ts (byte-identical ASS; goldens in
tests/fixtures/render_plan). Every drawing lives in a 1000 x 1000 unit box (text_shapes.json, the
SAME bytes as new-app/lib/clips/render-plan/text-shapes.json) scaled to the item's px size; each
part starts with ``m 0 0 m W H`` so libass anchors every part on the same box (\\an5 = its centre),
which keeps multi-colour stickers aligned. Burned with the text items (same ASS, same libass in the
editor preview), so preview == export by construction.

edits.textItems[i] with
  kind "shape":    shape = {"type": <text_shapes.json shapes>, "w": px@1920, "h": px@1920}; fill = style.color
  kind "sticker":  sticker = <text_shapes.json stickers>; size = style.size (px@1920, square)
  kind "progress": progress = {"w": % of frame width, "h": px@1920, "track": "#hex"|None,
                               "trackOpacity": 0..100}; fill = style.color, grows over the item
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

SHAPE_KINDS = ("shape", "sticker", "progress")
SHAPE_MIN, SHAPE_MAX = 8, 3840
PROGRESS_H_MIN, PROGRESS_H_MAX = 2, 120
PROGRESS_W_MIN, PROGRESS_W_MAX = 10, 100
PROGRESS_CLIP_PAD = 2


@lru_cache(maxsize=1)
def library() -> dict:
    return json.loads((Path(__file__).resolve().parent / "text_shapes.json").read_text())


def item_kind(it: dict) -> str:
    k = it.get("kind")
    return k if k in SHAPE_KINDS else "text"


def _num(v, lo: float, hi: float, default: float) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    if f != f or f in (float("inf"), float("-inf")):
        return default
    return min(hi, max(lo, f))


def shape_spec(it: dict) -> dict | None:
    """Normalised geometry of a shape / sticker / progress item (None = nothing to draw)."""
    kind = item_kind(it)
    lib = library()
    if kind == "shape":
        sh = it.get("shape") if isinstance(it.get("shape"), dict) else {}
        typ = sh.get("type")
        if typ not in lib["shapes"]:
            return None
        return {"kind": kind, "type": typ, "w": _num(sh.get("w"), SHAPE_MIN, SHAPE_MAX, 400),
                "h": _num(sh.get("h"), SHAPE_MIN, SHAPE_MAX, 400)}
    if kind == "sticker":
        sid = it.get("sticker")
        if sid not in lib["stickers"]:
            return None
        return {"kind": kind, "type": sid}
    if kind == "progress":
        p = it.get("progress") if isinstance(it.get("progress"), dict) else {}
        track = p.get("track") if is_hex(p.get("track")) else None
        return {"kind": kind, "w": _num(p.get("w"), PROGRESS_W_MIN, PROGRESS_W_MAX, 100),
                "h": _num(p.get("h"), PROGRESS_H_MIN, PROGRESS_H_MAX, 16), "track": track,
                "trackOpacity": _num(p.get("trackOpacity"), 0, 100, 35)}
    return None


def scale_path(d: str, w: float, h: float) -> str:
    """Unit-box path (0..1000) → px: x' = round(x·W/1000), y' = round(y·H/1000)."""
    out: list[str] = []
    axis = 0
    for tok in d.split():
        if tok.isalpha():
            out.append(tok)
            axis = 0
            continue
        v = float(tok)
        out.append(str(round(v * (w if axis == 0 else h) / 1000)))
        axis ^= 1
    return " ".join(out)


def box_prefix(w: float, h: float) -> str:
    return f"m 0 0 m {round(w)} {round(h)} "


def is_hex(v) -> bool:
    """"#RRGGBB" (the only colour form the editor stores)."""
    return isinstance(v, str) and len(v) == 7 and v[0] == "#" and all(c in "0123456789abcdefABCDEF" for c in v[1:])


def bgr(hex_rgb: str) -> str:
    h = str(hex_rgb or "").strip().lstrip("#")
    if len(h) != 6 or not all(c in "0123456789abcdefABCDEF" for c in h):
        h = "FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H{b:02X}{g:02X}{r:02X}&"


def shape_size_px(spec: dict, it: dict, fw: int, fh: int) -> tuple[float, float]:
    """(W, H) of the drawing box in PlayRes px."""
    if spec["kind"] == "shape":
        return round(spec["w"] * fh / 1920, 2), round(spec["h"] * fh / 1920, 2)
    if spec["kind"] == "sticker":
        st = it.get("style") if isinstance(it.get("style"), dict) else {}
        s = round(_num(st.get("size"), 24, 960, 240) * fh / 1920, 2)
        return s, s
    return round(spec["w"] * fw / 100, 2), round(spec["h"] * fh / 1920, 2)


def shape_parts(spec: dict, w: float, h: float) -> list[tuple[str | None, str]]:
    """[(colour or None = the item colour, px path with the box prefix)] in draw order."""
    lib = library()
    pre = box_prefix(w, h)
    if spec["kind"] == "shape":
        return [(None, pre + scale_path(lib["shapes"][spec["type"]]["d"], w, h))]
    if spec["kind"] == "sticker":
        return [(p["c"], pre + scale_path(p["d"], w, h)) for p in lib["stickers"][spec["type"]]["parts"]]
    return []


def progress_path(w: float, h: float, fill_w: int) -> str:
    return box_prefix(w, h) + f"m 0 0 l {fill_w} 0 {fill_w} {round(h)} 0 {round(h)}"
