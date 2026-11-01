"""G4b per-B-roll layer effects: shape mask (keyframable), chroma key, blend mode, reverse.

Mirror of new-app/lib/clips/editor/layer-fx.ts (parity fixture tests/fixtures/g4b_parity.json).
Export side (ffmpeg 5.1):
  mask     low-res gray frames (MASK_SHORT px short side, one per 100 ms step) → rawvideo input →
           bilinear scale → alphamerge (multiplied with the key alpha when both are on)
  key      format=rgba,colorkey=0xRRGGBB:similarity:blend[,despill]
  blend    the layer is placed on a transparent frame, `blend` (top = composite, bottom = layer)
           then alphamerge with the layer alpha and overlay → CSS mix-blend-mode semantics
  reverse  reversed copy of the used media range, rendered in 2 s chunks (bounded memory)
"""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

MASK_SHAPES = ("rect", "ellipse", "linear", "mirror")
BLEND_MODES = ("normal", "multiply", "screen", "overlay", "darken", "lighten", "difference", "exclusion",
               "hardlight", "addition")
MASK_SHORT = 160
MASK_STEP_MS = 100
MASK_MAX_KEYS = 16
REVERSE_MAX_MS = 60_000
DEFAULT_MASK = {"shape": "rect", "x": 50, "y": 50, "w": 60, "h": 40, "rot": 0, "feather": 10}
DEFAULT_KEY = {"color": "#00ff00", "sim": 40, "blend": 10, "spill": 50}
_HEX = re.compile(r"^#[0-9a-f]{6}$")
_TARGET = re.compile(r"^(?:(?:broll|text|adjust):[A-Za-z0-9_~.:-]{1,128}|video)$")
TEXT_FX_CAP = 6
FX_FEATURES = {
    "broll": {"mask": True, "key": True, "blend": True, "reverse": True},
    "video": {"mask": True, "key": True, "blend": False, "reverse": False},
    "text": {"mask": True, "key": False, "blend": True, "reverse": False},
    "adjust": {"mask": True, "key": False, "blend": True, "reverse": False},
}
GEOM = ("x", "y", "w", "h", "rot", "feather")
_RANGES = {"x": (-50, 150), "y": (-50, 150), "w": (1, 200), "h": (1, 200), "rot": (-180, 180), "feather": (0, 100)}


def _fin(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
    elif isinstance(v, str) and v.strip():
        try:
            f = float(v)
        except ValueError:
            return None
    else:
        return None
    return f if math.isfinite(f) else None


def _jround(x: float) -> int:
    return int(math.floor(x + 0.5))


def _r2(v: float):
    r = math.floor(v * 100 + 0.5) / 100
    return int(r) if r == int(r) else r


def _geom(o: dict, base: dict) -> dict:
    out = {}
    for k in GEOM:
        n = _fin(o.get(k))
        lo, hi = _RANGES[k]
        out[k] = base[k] if n is None else _r2(min(hi, max(lo, n)))
    return out


def normalize_mask(raw):
    if not isinstance(raw, dict) or raw.get("shape") not in MASK_SHAPES:
        return None
    out = {"shape": raw["shape"], **_geom(raw, DEFAULT_MASK)}
    if raw.get("invert") is True:
        out["invert"] = True
    if isinstance(raw.get("keys"), list):
        by_ms: dict[int, dict] = {}
        for k in raw["keys"]:
            if not isinstance(k, dict):
                continue
            ms = _fin(k.get("ms"))
            if ms is None or ms < 0:
                continue
            m = _jround(min(ms, 3_600_000))
            by_ms[m] = {"ms": m, **_geom(k, out)}
        keys = [by_ms[m] for m in sorted(by_ms)][:MASK_MAX_KEYS]
        if keys:
            out["keys"] = keys
    return out


def normalize_chroma_key(raw):
    if not isinstance(raw, dict):
        return None
    color = raw.get("color").lower() if isinstance(raw.get("color"), str) else ""
    if not _HEX.match(color):
        return None
    out = {"color": color}
    for k in ("sim", "blend", "spill"):
        v = _fin(raw.get(k))
        out[k] = _jround(min(100, max(0, DEFAULT_KEY[k] if v is None else v)))
    return out


def fx_target_of(target: str) -> str | None:
    if target == "video":
        return "video"
    if target.startswith("broll:"):
        return "broll"
    if target.startswith("text:"):
        return "text"
    if target.startswith("adjust:"):
        return "adjust"
    return None


def features_for(target: str) -> dict:
    kind = fx_target_of(target)
    return FX_FEATURES[kind] if kind else {}


def _strip_row(row: dict) -> dict | None:
    kind = fx_target_of(row.get("target", ""))
    if not kind:
        return None
    f = FX_FEATURES[kind]
    out: dict = {"target": row["target"]}
    if f["mask"] and row.get("mask"):
        out["mask"] = row["mask"]
    if f["key"] and row.get("key"):
        out["key"] = row["key"]
    if f["blend"] and row.get("blend"):
        out["blend"] = row["blend"]
    if f["reverse"] and row.get("reverse"):
        out["reverse"] = True
    return out if len(out) > 1 else None


def normalize_layer_fx(raw) -> list[dict]:
    by_t: dict[str, dict] = {}
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict):
            continue
        t = r.get("target")
        if not isinstance(t, str) or not _TARGET.match(t):
            continue
        row: dict = {"target": t}
        m = normalize_mask(r.get("mask"))
        if m:
            row["mask"] = m
        k = normalize_chroma_key(r.get("key"))
        if k:
            row["key"] = k
        b = r.get("blend")
        if isinstance(b, str) and b != "normal" and b in BLEND_MODES:
            row["blend"] = b
        if r.get("reverse") is True:
            row["reverse"] = True
        stripped = _strip_row(row)
        if stripped:
            by_t[t] = stripped
    out = [by_t[k] for k in sorted(by_t)]
    text_rows = [r for r in out if r["target"].startswith("text:")]
    if len(text_rows) > TEXT_FX_CAP:
        drop = {r["target"] for r in text_rows[TEXT_FX_CAP:]}
        out = [r for r in out if r["target"] not in drop]
    return out[:200]


def layer_fx_for(edits: dict | None, target: str) -> dict:
    if not edits:
        return {}
    for r in normalize_layer_fx(edits.get("layerFx")):
        if r["target"] == target:
            return r
    return {}


def layer_fx_of(edits: dict | None, item_id: str) -> dict:
    return layer_fx_for(edits, f"broll:{item_id}")


def mask_geom_at(mask: dict, local_ms: float) -> dict:
    keys = mask.get("keys") or []
    base = {k: mask[k] for k in GEOM}
    if not keys:
        return base
    t = math.floor(max(0.0, local_ms) / MASK_STEP_MS) * MASK_STEP_MS
    pick = lambda k: {g: k[g] for g in GEOM}  # noqa: E731
    if t <= keys[0]["ms"]:
        return pick(keys[0])
    if t >= keys[-1]["ms"]:
        return pick(keys[-1])
    for a, b in zip(keys, keys[1:]):
        if a["ms"] <= t < b["ms"]:
            u = (t - a["ms"]) / (b["ms"] - a["ms"])
            return {g: a[g] + (b[g] - a[g]) * u for g in GEOM}
    return pick(keys[-1])


def mask_grid(w: int, h: int) -> tuple[int, int]:
    k = MASK_SHORT / max(1, min(w, h))
    return max(2, _jround(w * k)), max(2, _jround(h * k))


def mask_alpha(shape: str, g: dict, invert: bool, w: int, h: int):
    """(mh, mw) uint8 — same math as layer-fx.ts maskAlpha."""
    import numpy as np

    mw, mh = mask_grid(w, h)
    cx, cy = g["x"] / 100 * w, g["y"] / 100 * h
    hw, hh = g["w"] / 100 * w * 0.5, g["h"] / 100 * h * 0.5
    th = g["rot"] * math.pi / 180
    c, s = math.cos(th), math.sin(th)
    f = g["feather"] / 100 * min(w, h) * 0.25
    py = (np.arange(mh)[:, None] + 0.5) * h / mh
    px = (np.arange(mw)[None, :] + 0.5) * w / mw
    dx, dy = px - cx, py - cy
    u = dx * c + dy * s
    v = -dx * s + dy * c
    if shape == "rect":
        qx, qy = np.abs(u) - hw, np.abs(v) - hh
        d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0)
    elif shape == "ellipse":
        d = (np.hypot(u / hw, v / hh) - 1) * min(hw, hh)
    elif shape == "linear":
        d = v + 0 * u
    else:
        d = np.abs(v) - hh + 0 * u
    if f > 0:
        t = np.clip((d + f / 2) / f, 0, 1)
        m = 1 - t * t * (3 - 2 * t)
    else:
        m = (d <= 0).astype(float)
    if invert:
        m = 1 - m
    return np.floor(m * 255 + 0.5).astype("uint8")


def chroma_params(k: dict) -> dict:
    n = int(k["color"][1:], 16)
    rgb = ((n >> 16) & 255, (n >> 8) & 255, n & 255)
    sim = math.floor((0.01 + k["sim"] / 100 * 0.49) * 1e4 + 0.5) / 1e4
    blend = math.floor(k["blend"] / 100 * 0.3 * 1e4 + 0.5) / 1e4
    typ = 1 if rgb[2] > rgb[1] else 0
    dominant = rgb[2] > rgb[0] if typ == 1 else (rgb[1] > rgb[0] and rgb[1] >= rgb[2])
    despill = {"type": typ, "amount": math.floor(k["spill"] / 100 * 1e4 + 0.5) / 1e4} if k["spill"] > 0 and dominant else None
    return {"rgb": rgb, "similarity": sim, "blend": blend, "despill": despill}


def key_chain(k: dict) -> str:
    """',format=rgba,colorkey=…' — alpha from the UNGRADED pixels (the colour branch is separate)."""
    p = chroma_params(k)
    r, g, b = p["rgb"]
    return f",format=rgba,colorkey=0x{r:02x}{g:02x}{b:02x}:{p['similarity']}:{p['blend']}"


def despill_chain(k: dict) -> str:
    """',format=rgba,despill=…' on the colour branch (before the grade), or '' when off."""
    d = chroma_params(k)["despill"]
    if not d:
        return ""
    sc = {"red": 0, "green": 0, "blue": 0}
    sc["blue" if d["type"] else "green"] = -d["amount"]
    return (f",format=rgba,despill=type={'blue' if d['type'] else 'green'}:mix=0.5:expand=0:red={sc['red']}"
            f":green={sc['green']}:blue={sc['blue']}")


def write_mask_frames(mask: dict, dur_s: float, w: int, h: int, path: Path) -> tuple[Path, int, int, int]:
    """Raw gray frames at 10 fps (one per MASK_STEP_MS step; a single frame when not keyframed)."""
    mw, mh = mask_grid(w, h)
    n = 1 if not mask.get("keys") else max(1, math.ceil(dur_s * 1000 / MASK_STEP_MS))
    path = Path(path)
    with path.open("wb") as fh:
        prev_sig, prev = None, None
        for i in range(n):
            g = mask_geom_at(mask, i * MASK_STEP_MS)
            sig = tuple(g[k] for k in GEOM)
            if sig != prev_sig:
                prev = mask_alpha(mask["shape"], g, bool(mask.get("invert")), w, h).tobytes()
                prev_sig = sig
            fh.write(prev)
    return path, mw, mh, n


# ── reverse ────────────────────────────────────────────────────────────────

def reversed_media(src: Path, in_s: float, dur_s: float, w: int, h: int, out: Path, chunk_s: float = 2.0,
                   pre_vf: str | None = None, fps: int = 30) -> Path:
    """Reversed copy of src[in_s, in_s + dur_s) scaled to cover w × h (30 fps, no audio).

    Output frame k = source time in_s + dur_s − (k + 1)/30 (the item plays its range backwards).
    Chunks are cut from the END of the range first so each 2 s piece is reversed in memory."""
    out = Path(out)
    dur_s = max(0.1, min(dur_s, REVERSE_MAX_MS / 1000))
    parts: list[Path] = []
    n = math.ceil(dur_s / chunk_s - 1e-9)
    vf = (f"{pre_vf + ',' if pre_vf else ''}fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase,"
          f"crop={w}:{h},reverse,setsar=1")
    for i in range(n):
        a = in_s + i * chunk_s
        d = min(chunk_s, in_s + dur_s - a)
        p = out.with_name(f"{out.stem}_c{i}.mp4")
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{d:.3f}", "-i", str(src),
                               "-an", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
                               "-pix_fmt", "yuv420p", str(p)])
        parts.append(p)
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in reversed(parts)))
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                           str(out)])
    return out


# ── blend composite ────────────────────────────────────────────────────────

def blend_composite(parts: list[str], cur: str, layer: str, out: str, mode: str, w: int, h: int,
                    s0: float = 0.0, s1: float = 1e9) -> str:
    """[cur] + full-frame [layer] (rgba / yuva, transparent outside the item) → [out] with `mode`.

    ffmpeg blend: top = composite (cur), bottom = layer — so overlay / hardlight condition on the
    same side as CSS mix-blend-mode (backdrop = composite, source = layer). The blended colour is
    used where the layer is opaque (alphamerge with the layer's alpha, then overlay).
    """
    fm = "addition" if mode == "addition" else mode
    parts.append(f"[{cur}]split[{out}c0][{out}cx]")
    parts.append(f"[{out}cx]trim=start={s0:.6f}:end={s1:.6f}[{out}c1]")
    parts.append(f"[{layer}]format=gbrap,split[{out}l0][{out}l1]")
    parts.append(f"[{out}l1]alphaextract[{out}la]")
    parts.append(f"[{out}l0]format=gbrp[{out}lc]")
    parts.append(f"[{out}c1]format=gbrp[{out}cg]")
    parts.append(f"[{out}cg][{out}lc]blend=all_mode={fm}:shortest=1[{out}bl]")
    parts.append(f"[{out}bl][{out}la]alphamerge[{out}ba]")
    parts.append(f"[{out}c0][{out}ba]overlay=0:0:eof_action=pass:format=auto:"
                 f"enable='between(t,{s0:.6f},{s1:.6f})',format=yuv420p[{out}]")
    return out


def key_pixel(rgb, k: dict) -> tuple[int, tuple[int, int, int]]:
    """CPU twin of ffmpeg 5.1 colorkey (alpha, ungraded pixel) + despill (colour) for one 8-bit pixel —
    the WebGL mirror's formula (layer-fx.ts keyPixel)."""
    p = chroma_params(k)
    r, g, b = (int(v) for v in rgb)
    kr, kg, kb = p["rgb"]
    diff = math.sqrt(((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) / (255.0 * 255.0 * 3.0))
    if p["blend"] > 0.0001:
        a = int(min(1.0, max(0.0, (diff - p["similarity"]) / p["blend"])) * 255.0)
    else:
        a = 255 if diff > p["similarity"] else 0
    d = p["despill"]
    if d:
        import numpy as np

        f = np.float32
        rf, gf, bf = f(r) / f(255), f(g) / f(255), f(b) / f(255)
        half = f(0.5)
        if d["type"]:
            sm = max(bf - (rf * half + gf * half), f(0))
            bf = max(bf + sm * f(-d["amount"]), f(0))
        else:
            sm = max(gf - (rf * half + bf * half), f(0))
            gf = max(gf + sm * f(-d["amount"]), f(0))
        r, g, b = (int(min(255, max(0, int(v * f(255))))) for v in (rf, gf, bf))
    return a, (r, g, b)
