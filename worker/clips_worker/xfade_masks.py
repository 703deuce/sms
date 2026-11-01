"""G4b: shape / soft / slice / corner transitions — the B-layer weight of ffmpeg 5.1 vf_xfade.c.

The export runs these transitions with xfade itself (motion.XFADE_NAME); this module only models
the per-pixel weight so tests can check the preview's mask math (transitions.ts xfadeBWeight)
against the real filter. float32 like the C code; P = xfade progress (1 → 0, 1 = all A).
"""
from __future__ import annotations

import numpy as np

MASK_XFADE = (
    "smoothleft", "smoothright", "smoothup", "smoothdown",
    "circleopen", "circleclose", "vertopen", "vertclose", "horzopen", "horzclose",
    "radial", "diagtl", "diagtr", "diagbl", "diagbr",
    "hlslice", "hrslice", "vuslice", "vdslice",
    "wipetl", "wipetr", "wipebl", "wipebr",
)

f32 = np.float32


def _ss(e0, e1, x):
    t = np.clip((x - f32(e0)) / f32(e1 - e0), f32(0), f32(1)).astype(f32)
    return (t * t * (f32(3) - f32(2) * t)).astype(f32)


def _fract(a):
    return (a - np.floor(a)).astype(f32)


def window_progress(k: int, n: int) -> float:
    """xfade's progress at frame k of an n-frame window (float32 like vf_xfade: 1 − pts / duration)."""
    return float(f32(1) - f32(k) / f32(n))


def b_weight(name: str, progress: float, w: int, h: int) -> np.ndarray:
    """(h, w) float32 weight of input B (second xfade input) at `progress`."""
    P = f32(progress)
    y, x = np.mgrid[0:h, 0:w]
    xf, yf = x.astype(f32), y.astype(f32)
    W, H = f32(w), f32(h)
    if name == "smoothleft":
        return _ss(0, 1, f32(1) + xf / W - P * f32(2))
    if name == "smoothright":
        return _ss(0, 1, f32(1) + (W - 1 - xf) / W - P * f32(2))
    if name == "smoothup":
        return _ss(0, 1, f32(1) + yf / H - P * f32(2))
    if name == "smoothdown":
        return _ss(0, 1, f32(1) + (H - 1 - yf) / H - P * f32(2))
    if name in ("circleopen", "circleclose"):
        z = f32(np.hypot(f32(w // 2), f32(h // 2)))
        d = np.hypot((x - w // 2).astype(f32), (y - h // 2).astype(f32)).astype(f32) / z
        if name == "circleopen":
            return (f32(1) - _ss(0, 1, d + (P - f32(0.5)) * f32(3))).astype(f32)
        return _ss(0, 1, d + (f32(1) - P - f32(0.5)) * f32(3))
    if name in ("vertopen", "vertclose", "horzopen", "horzclose"):
        if name.startswith("vert"):
            c, v = f32(w / 2.0), xf
        else:
            c, v = f32(h / 2.0), yf
        a = np.abs((v - c) / c).astype(f32)
        base = f32(2) - a if name.endswith("open") else f32(1) + a
        return _ss(0, 1, base - P * f32(2))
    if name == "radial":
        ang = np.arctan2((x - w // 2).astype(f32), (y - h // 2).astype(f32)).astype(f32)
        return _ss(0, 1, ang - (P - f32(0.5)) * f32(np.pi * 2.5))
    if name.startswith("diag"):
        xx = xf / W if name in ("diagtl", "diagbl") else (W - 1 - xf) / W
        yy = yf / H if name in ("diagtl", "diagtr") else (H - 1 - yf) / H
        return _ss(0, 1, f32(1) + xx * yy - P * f32(2))
    if name in ("hlslice", "hrslice", "vuslice", "vdslice"):
        if name == "hlslice":
            v, ten = xf / W, f32(10) * xf / W
        elif name == "hrslice":
            v = (W - 1 - xf) / W
            ten = f32(10) * v
        elif name == "vuslice":
            v, ten = yf / H, f32(10) * yf / H
        else:
            v = (H - 1 - yf) / H
            ten = f32(10) * v
        s = _ss(-0.5, 0, v - P * f32(1.5))
        return np.where(s <= _fract(ten), f32(0), f32(1)).astype(f32)
    if name.startswith("wipe") and len(name) == 6:
        if name == "wipetl":
            a = (y <= int(H * P)) & (x <= int(W * P))
        elif name == "wipetr":
            a = (y <= int(H * P)) & (x > int(W * (f32(1) - P)))
        elif name == "wipebl":
            a = (y > int(H * (f32(1) - P))) & (x <= int(W * P))
        else:
            a = (y > int(H * (f32(1) - P))) & (x > int(W * (f32(1) - P)))
        return np.where(a, f32(0), f32(1)).astype(f32)
    raise ValueError(name)
