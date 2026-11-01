"""G4b effects library (blur, glow, RGB split, glitch, shake, flicker, scanlines) — ffmpeg 5.1 parts.

Same definitions as the preview (lib/clips/editor/fx-library.ts → SVG filter + CSS transform):
  blur       gblur σ = v/100·16·S                       ↔ feGaussianBlur (edge-renormalised)
  glow       screen(src, gblur σ=24·S) at opacity 0.8·v  ↔ feGaussianBlur + feBlend screen + arithmetic
  rgbsplit   red ← d px, blue → d px, d = round(14·S·v)  ↔ channel feColorMatrix + feOffset, added
  glitch     two bands displaced horizontally on 0.1 s blocks (integer hash) ↔ feOffset sub-regions
  shake      zoom + offset on 1/15 s blocks (integer hash) ↔ CSS transform on the layer
  flicker    brightness × (1 − 0.3·v·hash) per frame     ↔ feComponentTransfer slope
  scanlines  multiply rows (period 4·S px) by 1 − 0.6·v  ↔ feImage + arithmetic multiply
S = short side / 1080. Frame index F = floor(t·30) (output time), so B-roll / adjustment layers
match the preview's frame; per-frame patterns are deterministic (no RNG).
Order (export and preview): grade → blur → glow → rgbsplit → glitch → sharpen → vignette →
scanlines → flicker → grain → shake.
"""
from __future__ import annotations

import math
from pathlib import Path

FX2_KEYS = ("blur", "glow", "rgbsplit", "glitch", "shake", "flicker", "scanlines")
HASH_A, HASH_B, HASH_M = 1103, 7919, 997


def unit(w: int, h: int) -> float:
    return min(w, h) / 1080.0


def jround(x: float) -> int:
    return int(math.floor(x + 0.5))


def fx_hash(k: int, salt: int) -> float:
    return ((k * HASH_A + salt * HASH_B) % HASH_M) / HASH_M


def blur_sigma(v: int, w: int, h: int) -> float:
    return v / 100 * 16 * unit(w, h)


GLOW_SIGMA = 24


def glow_opacity(v: int) -> float:
    return v / 100 * 0.8


def rgbsplit_px(v: int, w: int, h: int) -> int:
    return jround(v / 100 * 14 * unit(w, h))


def glitch_bands(v: int, w: int, h: int) -> list[dict]:
    """Static band geometry: [{h, salt_y, salt_x, maxY, amp}] (y / dx vary per 0.1 s block)."""
    amp = w * 0.12 * v / 100
    return [
        {"h": max(2, jround(h * 0.08)), "sy": 2, "sx": 3, "maxY": math.floor(h * 0.85), "amp": amp},
        {"h": max(2, jround(h * 0.04)), "sy": 4, "sx": 5, "maxY": math.floor(h * 0.9), "amp": amp * 0.6},
    ]


def glitch_threshold(v: int) -> float:
    return v / 100 * 0.6


def glitch_state(v: int, w: int, h: int, frame: int) -> list[tuple[int, int]]:
    """Per band (y0, dx) at export frame `frame` (dx = 0 when the block is inactive)."""
    k = frame // 3
    on = fx_hash(k, 1) < glitch_threshold(v)
    out = []
    for b in glitch_bands(v, w, h):
        y0 = math.floor(fx_hash(k, b["sy"]) * b["maxY"])
        dx = jround((fx_hash(k, b["sx"]) * 2 - 1) * b["amp"]) if on else 0
        out.append((y0, dx))
    return out


def shake_pad(v: int, w: int, h: int) -> int:
    return math.ceil(v / 100 * 0.04 * min(w, h))


def shake_size(v: int, w: int, h: int) -> tuple[int, int]:
    """Scaled frame (even) covering ±pad px of offset with a uniform zoom."""
    p = shake_pad(v, w, h)
    z = max((w + 2 * p) / w, (h + 2 * p) / h)
    return 2 * math.ceil(w * z / 2), 2 * math.ceil(h * z / 2)


def shake_offset(v: int, w: int, h: int, frame: int) -> tuple[int, int]:
    k = frame // 2
    a = shake_pad(v, w, h)
    return jround((fx_hash(k, 6) * 2 - 1) * a), jround((fx_hash(k, 7) * 2 - 1) * a)


def flicker_gain(v: int, frame: int) -> float:
    return 1 - v / 100 * 0.3 * fx_hash(frame, 8)


def scanline_period(w: int, h: int) -> int:
    return max(2, jround(4 * unit(w, h)))


def scanline_mask(v: int, w: int, h: int):
    import numpy as np

    p = scanline_period(w, h)
    dark = jround(255 * (1 - v / 100 * 0.6))
    rows = np.where((np.arange(h) % p) >= p // 2, dark, 255).astype("uint8")
    return np.repeat(rows[:, None], w, axis=1)


def has_fx2(fx: dict | None) -> bool:
    return bool(fx) and any(int(fx.get(k) or 0) for k in FX2_KEYS)


# ── ffmpeg expressions (F = export frame from output time) ─────────────────

_F = "floor(t*30+0.001)"


def _h(k_expr: str, salt: int) -> str:
    return f"mod(({k_expr})*{HASH_A}+{salt * HASH_B},{HASH_M})/{HASH_M}"


def _round(e: str) -> str:
    return f"floor(({e})+0.5)"


def pre_parts(cur: str, fx: dict, w: int, h: int, tag: str, en: str) -> tuple[list[str], str]:
    """blur → glow → rgbsplit → glitch (before sharpen). Returns (parts, label)."""
    parts: list[str] = []
    if fx.get("blur"):
        s = blur_sigma(int(fx["blur"]), w, h)
        parts.append(f"[{cur}]gblur=sigma={s:.4f}:steps=3{en}[{tag}bl]")
        cur = f"{tag}bl"
    if fx.get("glow"):
        s = GLOW_SIGMA * unit(w, h)
        o = glow_opacity(int(fx["glow"]))
        parts.append(f"[{cur}]split[{tag}g0][{tag}g1]")
        parts.append(f"[{tag}g1]gblur=sigma={s:.4f}:steps=3[{tag}g2]")
        parts.append(f"[{tag}g0][{tag}g2]blend=all_mode=screen:all_opacity={o:.4f}{en}[{tag}gl]")
        cur = f"{tag}gl"
    if fx.get("rgbsplit"):
        d = rgbsplit_px(int(fx["rgbsplit"]), w, h)
        if d:
            parts.append(f"[{cur}]rgbashift=rh={-d}:bh={d}:edge=smear{en}[{tag}rs]")
            cur = f"{tag}rs"
    if fx.get("glitch"):
        v = int(fx["glitch"])
        bands = glitch_bands(v, w, h)
        k = f"floor({_F}/3)"
        on = f"lt({_h(k, 1)},{glitch_threshold(v):.6f})"
        parts.append(f"[{cur}]split={len(bands) + 1}[{tag}q0]" + "".join(f"[{tag}q{i + 1}]" for i in range(len(bands))))
        base = f"{tag}q0"
        for i, b in enumerate(bands):
            y = f"floor({_h(k, b['sy'])}*{b['maxY']})"
            dx = _round(f"({_h(k, b['sx'])}*2-1)*{b['amp']:.4f}")
            parts.append(f"[{tag}q{i + 1}]crop={w}:{b['h']}:0:'{y}'[{tag}c{i}]")
            parts.append(
                f"[{base}][{tag}c{i}]overlay=x='if({on},{dx},{w})':y='{y}':eval=frame{en}[{tag}o{i}]"
            )
            base = f"{tag}o{i}"
        parts.append(f"[{base}]format=gbrp[{tag}gt]")
        cur = f"{tag}gt"
    return parts, cur


def post_parts(cur: str, fx: dict, w: int, h: int, work_dir: Path, tag: str, en: str) -> tuple[list[str], str]:
    """scanlines → flicker (after vignette, before grain)."""
    from clips_worker.color_fx import _q, _write_pgm

    parts: list[str] = []
    if fx.get("scanlines"):
        v = int(fx["scanlines"])
        mask = _write_pgm(Path(work_dir) / f"scan_{tag}_{v}_{w}x{h}.pgm", scanline_mask(v, w, h), w, h)
        parts.append(f"movie='{_q(mask)}':loop=0,setpts=N/(30*TB),format=gbrp[{tag}sm]")
        parts.append(f"[{cur}][{tag}sm]blend=all_mode=multiply:shortest=1{en}[{tag}sc]")
        cur = f"{tag}sc"
    if fx.get("flicker"):
        v = int(fx["flicker"])
        g = f"(1-{v / 100 * 0.3:.6f}*{_h('floor(T*30+0.001)', 8)})"
        parts.append(f"[{cur}]split[{tag}f0][{tag}f1]")
        parts.append(f"[{tag}f0][{tag}f1]blend=all_expr='A*{g}'{en}[{tag}fl]")
        cur = f"{tag}fl"
    return parts, cur


def shake_parts(cur: str, fx: dict, w: int, h: int, tag: str, en: str) -> tuple[list[str], str]:
    """shake (last): scale up + per-block crop, overlaid (timeline enable) on the unshaken frame."""
    if not fx.get("shake"):
        return [], cur
    v = int(fx["shake"])
    sw, sh = shake_size(v, w, h)
    a = shake_pad(v, w, h)
    k = f"floor({_F}/2)"
    ox = _round(f"({_h(k, 6)}*2-1)*{a}")
    oy = _round(f"({_h(k, 7)}*2-1)*{a}")
    parts = [
        f"[{cur}]split[{tag}k0][{tag}k1]",
        f"[{tag}k1]scale={sw}:{sh}:flags=bilinear,crop={w}:{h}:'{(sw - w) // 2}+{ox}':'{(sh - h) // 2}+{oy}'[{tag}k2]",
        f"[{tag}k0][{tag}k2]overlay=0:0{en}[{tag}sk]",
    ]
    return parts, f"{tag}sk"
