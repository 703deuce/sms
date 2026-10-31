"""G3a: text animations (in / out / loop) for text items — CapCut / Descript "Animation".

Pure math shared with new-app/lib/clips/render-plan/text-anim.ts (byte-identical ASS; goldens in
tests/fixtures/render_plan). Only + - * / and comparisons (no sin/pow), so CPython and V8 agree on
every float. Text items burn as ASS in the hook stage; the editor preview draws the SAME ASS with
libass-wasm (EP2), so preview == export by construction.

edits.textItems[i].anim = {
  "in":  {"type": IN_TYPES, "unit": "block"|"line"|"word"|"char", "durMs": 100..5000},
  "out": {...same...},
  "loop": {"type": "pulse"|"bounce"|"wiggle"|"flicker", "periodMs": 300..4000},
}
Slide / zoom move the whole block (unit forced to "block"); fade / pop / typewriter can go by
line, word or character (typewriter by block = by character).
"""
from __future__ import annotations

IN_TYPES = ("fade", "pop", "zoom", "slide_up", "slide_down", "slide_left", "slide_right", "typewriter")
BLOCK_ONLY = ("zoom", "slide_up", "slide_down", "slide_left", "slide_right")
UNITS = ("block", "line", "word", "char")
LOOP_TYPES = ("pulse", "bounce", "wiggle", "flicker")
DUR_MIN, DUR_MAX, DUR_DEFAULT = 100, 5000, 500
PERIOD_MIN, PERIOD_MAX, PERIOD_DEFAULT = 300, 4000, 1000
SLIDE_Y_PCT = 8.0
SLIDE_X_PCT = 10.0


def _int_ms(v, lo: int, hi: int, default: int) -> int:
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
        return default
    return max(lo, min(hi, int(round(v))))


def norm_anim(raw) -> dict | None:
    """Builder-side normalisation (TS normAnim): unknown / junk keys dropped."""
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    for edge in ("in", "out"):
        a = raw.get(edge)
        if not isinstance(a, dict) or a.get("type") not in IN_TYPES:
            continue
        typ = a["type"]
        unit = a.get("unit") if a.get("unit") in UNITS else "block"
        if typ in BLOCK_ONLY:
            unit = "block"
        if typ == "typewriter" and unit == "block":
            unit = "char"
        out[edge] = {"type": typ, "unit": unit, "durMs": _int_ms(a.get("durMs"), DUR_MIN, DUR_MAX, DUR_DEFAULT)}
    lp = raw.get("loop")
    if isinstance(lp, dict) and lp.get("type") in LOOP_TYPES:
        out["loop"] = {"type": lp["type"], "periodMs": _int_ms(lp.get("periodMs"), PERIOD_MIN, PERIOD_MAX, PERIOD_DEFAULT)}
    return out or None


def fit_durations(anim: dict, length_ms: int) -> tuple[int, int]:
    """In / out lengths that fit the item (scaled down together when they would overlap)."""
    di = anim["in"]["durMs"] if "in" in anim else 0
    do = anim["out"]["durMs"] if "out" in anim else 0
    if di + do > length_ms and di + do > 0:
        di2 = (length_ms * di) // (di + do)
        return di2, length_ms - di2 if do else 0
    return di, do


def ease_out(p: float) -> float:
    q = 1.0 - p
    return 1.0 - q * q * q


def ease_back(p: float) -> float:
    q = p - 1.0
    return 1.0 + 2.70158 * q * q * q + 1.70158 * q * q


def _clamp01(v: float) -> float:
    return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)


def block_state(typ: str, p: float) -> dict:
    """Whole-block multipliers at progress p (0 = hidden edge, 1 = rest)."""
    p = _clamp01(p)
    e = ease_out(p)
    if typ == "fade":
        return {"op": e, "sc": 1.0, "dx": 0.0, "dy": 0.0}
    if typ == "pop":
        return {"op": _clamp01(p * 3.0), "sc": 0.3 + 0.7 * ease_back(p), "dx": 0.0, "dy": 0.0}
    if typ == "zoom":
        return {"op": e, "sc": 0.4 + 0.6 * e, "dx": 0.0, "dy": 0.0}
    if typ == "slide_up":
        return {"op": e, "sc": 1.0, "dx": 0.0, "dy": (1.0 - e) * SLIDE_Y_PCT}
    if typ == "slide_down":
        return {"op": e, "sc": 1.0, "dx": 0.0, "dy": -(1.0 - e) * SLIDE_Y_PCT}
    if typ == "slide_left":
        return {"op": e, "sc": 1.0, "dx": (1.0 - e) * SLIDE_X_PCT, "dy": 0.0}
    if typ == "slide_right":
        return {"op": e, "sc": 1.0, "dx": -(1.0 - e) * SLIDE_X_PCT, "dy": 0.0}
    return {"op": 1.0, "sc": 1.0, "dx": 0.0, "dy": 0.0}


def unit_state(typ: str, k: int, n: int, t: float, d: int) -> tuple[float, float]:
    """(opacity, fscy multiplier) of unit k of n at t ms into a d ms unit-wise animation."""
    if typ == "typewriter":
        return (1.0 if t * n >= k * d else 0.0), 1.0
    if n <= 1:
        ln, s = float(d), 0.0
    else:
        ln = d * 2 / (n + 1)
        s = (d - ln) / (n - 1)
    p = _clamp01((t - k * s) / ln) if ln > 0 else 1.0
    if typ == "pop":
        return _clamp01(p * 3.0), 0.3 + 0.7 * ease_back(p)
    return ease_out(p), 1.0


def loop_state(typ: str, t: float, period: int) -> dict:
    ph = (t % period) / period
    tri = 1.0 - abs(2.0 * ph - 1.0)
    sm = tri * tri * (3.0 - 2.0 * tri)
    if typ == "pulse":
        return {"op": 1.0, "sc": 1.0 + 0.08 * sm, "dy": 0.0, "rot": 0.0}
    if typ == "bounce":
        return {"op": 1.0, "sc": 1.0, "dy": -2.0 * sm, "rot": 0.0}
    if typ == "wiggle":
        return {"op": 1.0, "sc": 1.0, "dy": 0.0, "rot": 6.0 * (2.0 * sm - 1.0)}
    if typ == "flicker":
        return {"op": 1.0 - 0.6 * sm, "sc": 1.0, "dy": 0.0, "rot": 0.0}
    return {"op": 1.0, "sc": 1.0, "dy": 0.0, "rot": 0.0}


def split_units(text: str, unit: str) -> list[tuple[str, bool]]:
    """Display text → [(piece, is_unit)]; separators (spaces / newlines) are not units."""
    out: list[tuple[str, bool]] = []
    if unit == "line":
        lines = text.split("\n")
        for i, ln in enumerate(lines):
            if i:
                out.append(("\n", False))
            if ln:
                out.append((ln, True))
        return out
    cur = ""
    for ch in text:
        if ch in (" ", "\n"):
            if cur:
                out.append((cur, True))
                cur = ""
            out.append((ch, False))
        elif unit == "char":
            out.append((ch, True))
        else:
            cur += ch
    if cur:
        out.append((cur, True))
    return out


def frame_anim(anim: dict, t_ms: float, start: int, end: int, d_in: int, d_out: int) -> dict:
    """Block multipliers + the unit-wise animation (if any) active at output t_ms."""
    op, sc, dx, dy, rot = 1.0, 1.0, 0.0, 0.0, 0.0
    unit = None
    tl = t_ms - start
    tr = end - t_ms
    a_in = anim.get("in")
    if a_in and d_in > 0 and tl < d_in:
        if a_in["unit"] == "block":
            b = block_state(a_in["type"], tl / d_in)
            op, sc, dx, dy = op * b["op"], sc * b["sc"], dx + b["dx"], dy + b["dy"]
        else:
            unit = {"type": a_in["type"], "unit": a_in["unit"], "t": tl, "d": d_in, "rev": False}
    a_out = anim.get("out")
    if a_out and d_out > 0 and tr < d_out:
        if a_out["unit"] == "block":
            b = block_state(a_out["type"], tr / d_out)
            op, sc, dx, dy = op * b["op"], sc * b["sc"], dx + b["dx"], dy + b["dy"]
        elif unit is None:
            unit = {"type": a_out["type"], "unit": a_out["unit"], "t": tr, "d": d_out, "rev": True}
    lp = anim.get("loop")
    if lp:
        s = loop_state(lp["type"], tl, lp["periodMs"])
        op, sc, dy, rot = op * s["op"], sc * s["sc"], dy + s["dy"], rot + s["rot"]
    return {"op": op, "sc": sc, "dx": dx, "dy": dy, "rot": rot, "unit": unit}
