"""E4 color looks (Adjust + Filters). Line-for-line mirror of new-app/lib/clips/editor/color.ts.

    rgb' = curve_c(clamp01(M · rgb + o))     sRGB-encoded 0..1

Export: the look is sampled into a 33³ .cube and applied with ffmpeg ``lut3d`` (5.1+, timeline
``enable``). The main video's looks are SOURCE-anchored, so they are applied once to
full_render.mp4 (source time) before the cut: cut.mp4 and the E3 transition handles (also cut from
full_render) inherit the right look per side with no change to the transition graph.
Parity: tests/fixtures/e4-parity.json is asserted by vitest and pytest.
"""
from __future__ import annotations

import math
from pathlib import Path

ADJUST_KEYS = ("brightness", "contrast", "saturation", "temperature", "tint", "vibrance")
ADJUST_MIN, ADJUST_MAX = -100, 100
CURVE_N = 4
LUT_SIZE = 33
_IDT = [0.0, 0.25, 0.5, 0.75, 1.0]
LR, LG, LB = 0.2126, 0.7152, 0.0722
I3 = [1.0, 0, 0, 0, 1.0, 0, 0, 0, 1.0]

COLOR_PRESETS: dict[str, dict] = {
    "vivid": {"adjust": {"saturation": 35, "contrast": 12, "vibrance": 20}},
    "warm": {"adjust": {"temperature": 45, "saturation": 8, "brightness": 3}},
    "cool": {"adjust": {"temperature": -45, "tint": 5}},
    "bw": {"adjust": {"saturation": -100, "contrast": 15}},
    "film": {"adjust": {"saturation": -10, "temperature": 10},
             "curve": [[0.06, 0.22, 0.5, 0.78, 0.95]] * 3},
    "fade": {"adjust": {"contrast": -25, "brightness": 6, "saturation": -20}},
    "teal_orange": {"adjust": {"saturation": 10, "contrast": 8},
                    "curve": [[0, 0.22, 0.52, 0.8, 1], [0.02, 0.25, 0.5, 0.75, 0.98], [0.08, 0.3, 0.5, 0.7, 0.92]]},
    "noir": {"adjust": {"saturation": -100, "contrast": 40}, "curve": [[0, 0.18, 0.5, 0.8, 1]] * 3},
    "vintage": {"matrix": [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
                "adjust": {"contrast": -15, "brightness": 4}},
}


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def _mul(a: list[float], b: list[float]) -> list[float]:
    return [sum(a[i * 3 + k] * b[k * 3 + j] for k in range(3)) for i in range(3) for j in range(3)]


def _mul_v(a: list[float], v: list[float]) -> list[float]:
    return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
            a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]


def _sat_mat(s: float, wr: float = LR, wg: float = LG, wb: float = LB) -> list[float]:
    t = 1 - s
    return [t * wr + s, t * wg, t * wb, t * wr, t * wg + s, t * wb, t * wr, t * wg, t * wb + s]


def _num(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return f if math.isfinite(f) else 0.0


def _adjust_affine(a: dict) -> tuple[list[float], list[float]]:
    def g(k: str) -> float:
        return _clamp(_num(a.get(k, 0)), ADJUST_MIN, ADJUST_MAX) / 100

    temp = g("temperature") * 0.12
    tint = g("tint") * 0.08
    m = [1 + temp + tint / 2, 0, 0, 0, 1 - tint, 0, 0, 0, 1 - temp + tint / 2]
    m = _mul(_sat_mat(1 + g("saturation")), m)
    m = _mul(_sat_mat(1 + 0.6 * g("vibrance"), 0.3, 0.6, 0.1), m)
    c = 1 + g("contrast")
    m = [x * c for x in m]
    co = 0.5 * (1 - c)
    b = g("brightness") * 0.25
    return m, [co + b, co + b, co + b]


def is_identity_spec(spec) -> bool:
    if not isinstance(spec, dict):
        return True
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    has_adj = any(_num(adj.get(k, 0)) != 0 for k in ADJUST_KEYS)
    preset = spec.get("preset")
    return not has_adj and (not preset or _num(spec.get("intensity", 100)) <= 0)


def look_for_spec(spec) -> dict:
    m = list(I3)
    o = [0.0, 0.0, 0.0]
    curve = None
    spec = spec if isinstance(spec, dict) else {}
    p = COLOR_PRESETS.get(str(spec.get("preset") or ""))
    if p:
        t = _clamp(_num(spec.get("intensity", 100)), 0, 100) / 100
        pm = list(p.get("matrix") or I3)
        po = [0.0, 0.0, 0.0]
        if p.get("adjust"):
            am, ao = _adjust_affine(p["adjust"])
            pm = _mul(am, pm)
            po = ao
        m = [x + (pm[i] - x) * t for i, x in enumerate(I3)]
        o = [po[i] * t for i in range(3)]
        if p.get("curve"):
            curve = [[_IDT[i] + (v - _IDT[i]) * t for i, v in enumerate(tab)] for tab in p["curve"]]
    adj = spec.get("adjust")
    if isinstance(adj, dict):
        am, ao = _adjust_affine(adj)
        o = [v + ao[i] for i, v in enumerate(_mul_v(am, o))]
        m = _mul(am, m)
    return {"m": m, "o": o, "curve": curve}


def _curve_at(tab: list[float], x: float) -> float:
    f = _clamp(x, 0, 1) * CURVE_N
    k = min(CURVE_N - 1, int(math.floor(f)))
    return tab[k] + (f - k) * (tab[k + 1] - tab[k])


def apply_look(look: dict, rgb) -> list[float]:
    mv = _mul_v(look["m"], list(rgb))
    v = [_clamp(x + look["o"][i], 0, 1) for i, x in enumerate(mv)]
    c = look.get("curve")
    if not c:
        return v
    return [_curve_at(c[0], v[0]), _curve_at(c[1], v[1]), _curve_at(c[2], v[2])]


def look_key(spec) -> str:
    if is_identity_spec(spec):
        return "id"
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    parts = [str(spec.get("preset") or "-"), str(round(_num(spec.get("intensity", 100))))]
    parts += [str(round(_num(adj.get(k, 0)))) for k in ADJUST_KEYS]
    return "".join(ch for ch in "_".join(parts) if ch.isalnum() or ch in "_-")


def write_cube(spec, path: Path, size: int = LUT_SIZE) -> Path:
    """.cube 3D LUT (R fastest) sampling the look on a size³ grid."""
    look = look_for_spec(spec)
    n = size - 1
    lines = [f"TITLE \"{look_key(spec)}\"", f"LUT_3D_SIZE {size}", "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"]
    for bi in range(size):
        for gi in range(size):
            for ri in range(size):
                r, g, b = apply_look(look, (ri / n, gi / n, bi / n))
                lines.append(f"{r:.6f} {g:.6f} {b:.6f}")
    path.write_text("\n".join(lines) + "\n", encoding="ascii")
    return path


# ── resolution ──────────────────────────────────────────────────────────────

def color_edits(edits: dict) -> dict:
    c = edits.get("color")
    return c if isinstance(c, dict) else {}


def has_color(edits: dict) -> bool:
    c = color_edits(edits)
    if c.get("video") and not is_identity_spec(c.get("video")):
        return True
    if any(isinstance(s, dict) and not is_identity_spec(s.get("spec")) for s in (c.get("segments") or [])):
        return True
    br = c.get("broll") if isinstance(c.get("broll"), dict) else {}
    return any(not is_identity_spec(v) for v in br.values())


def video_spec_at_source(edits: dict, src_ms: float):
    c = color_edits(edits)
    segs = [s for s in (c.get("segments") or []) if isinstance(s, dict)]
    for s in reversed(segs):
        if _num(s.get("fromMs")) <= src_ms < _num(s.get("toMs")):
            spec = s.get("spec")
            return None if is_identity_spec(spec) else spec
    v = c.get("video")
    return None if is_identity_spec(v) else v


def broll_spec(edits: dict, item_id: str):
    br = color_edits(edits).get("broll")
    spec = br.get(item_id) if isinstance(br, dict) else None
    return None if is_identity_spec(spec) else spec


def source_look_ranges(edits: dict, clip_start_ms: int, clip_end_ms: int) -> list[tuple[int, int, dict]]:
    """[(srcFrom, srcTo, spec)] partition of [clip_start, clip_end) with a non-identity look."""
    c = color_edits(edits)
    cuts = {int(clip_start_ms), int(clip_end_ms)}
    for s in c.get("segments") or []:
        if not isinstance(s, dict):
            continue
        for k in ("fromMs", "toMs"):
            v = int(_num(s.get(k)))
            if clip_start_ms < v < clip_end_ms:
                cuts.add(v)
    pts = sorted(cuts)
    out: list[tuple[int, int, dict]] = []
    for a, b in zip(pts, pts[1:]):
        spec = video_spec_at_source(edits, a)
        if spec is None:
            continue
        if out and out[-1][1] == a and look_key(out[-1][2]) == look_key(spec):
            out[-1] = (out[-1][0], b, out[-1][2])
        else:
            out.append((a, b, spec))
    return out


def full_render_color_filter(edits: dict, clip_start_ms: int, clip_end_ms: int, work_dir: Path) -> str | None:
    """-vf chain for full_render.mp4 (t = (src − clip_start)/1000). One lut3d per distinct look."""
    ranges = source_look_ranges(edits, clip_start_ms, clip_end_ms)
    if not ranges:
        return None
    by_key: dict[str, tuple[dict, list[tuple[int, int]]]] = {}
    for a, b, spec in ranges:
        k = look_key(spec)
        by_key.setdefault(k, (spec, []))[1].append((a, b))
    chain: list[str] = []
    whole = len(ranges) == 1 and ranges[0][0] <= clip_start_ms and ranges[0][1] >= clip_end_ms
    for k, (spec, spans) in by_key.items():
        cube = write_cube(spec, Path(work_dir) / f"look_{k}.cube")
        if whole:
            chain.append(f"lut3d=file='{cube}'")
            continue
        expr = "+".join(
            f"gte(t,{(a - clip_start_ms) / 1000:.4f})*lt(t,{(b - clip_start_ms) / 1000:.4f})" for a, b in spans
        )
        chain.append(f"lut3d=file='{cube}':enable='{expr}'")
    return ",".join(chain)


def apply_full_render_color(full_render: Path, edits: dict, clip_start_ms: int, clip_end_ms: int,
                            work_dir: Path) -> Path:
    import subprocess

    vf = full_render_color_filter(edits, clip_start_ms, clip_end_ms, work_dir)
    if not vf:
        return full_render
    out = Path(work_dir) / "full_render_color.mp4"
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(full_render), "-vf", f"{vf},format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", str(out)]
    )
    print(f"[clipper:color] full_render looks={vf.count('lut3d')}", flush=True)
    return out


def broll_color_filter(edits: dict | None, item_id: str, work_dir: Path | None) -> str:
    """',lut3d=…' to append to a B-roll input chain, or ''."""
    if not edits:
        return ""
    spec = broll_spec(edits, item_id)
    if spec is None:
        return ""
    cube = write_cube(spec, Path(work_dir or ".") / f"look_broll_{look_key(spec)}.cube")
    return f",lut3d=file='{cube}'"
