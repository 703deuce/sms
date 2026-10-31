"""E4 color looks (Adjust + Filters). Line-for-line mirror of new-app/lib/clips/editor/color.ts.

    rgb' = curve_c(clamp01(M · rgb + o))     sRGB-encoded 0..1

Export: the look is sampled into a 33³ .cube and applied with ffmpeg ``lut3d`` (5.1+, timeline
``enable``). The main video's looks are SOURCE-anchored, so they are applied once to
full_render.mp4 (source time) before the cut: cut.mp4 and the E3 transition handles (also cut from
full_render) inherit the right look per side with no change to the transition graph.
Parity: tests/fixtures/e4-parity.json is asserted by vitest and pytest.

G4a: specs with color-grade v2 fields (color_grade.py) are baked by color_grade.write_grade_cube
and may add frame-space effects (sharpen / vignette / grain, color_fx.py); E4-only specs keep the
exact E4 cube and key.
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
    from clips_worker.color_grade import has_grade_fields

    return not has_adj and (not preset or _num(spec.get("intensity", 100)) <= 0) and not has_grade_fields(spec)


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
    from clips_worker.color_grade import canon_grade, fnv1a, has_grade_fields

    if has_grade_fields(spec):
        parts.append("g" + fnv1a(canon_grade(spec)))
    return "".join(ch for ch in "_".join(parts) if ch.isalnum() or ch in "_-")


def write_cube(spec, path: Path, size: int = LUT_SIZE, lut: dict | None = None) -> Path:
    """.cube 3D LUT (R fastest) sampling the look on a size³ grid."""
    from clips_worker.color_grade import has_pointwise_v2, write_grade_cube

    if has_pointwise_v2(spec):
        return write_grade_cube(spec, path, lut=lut, size=size, title=look_key(spec))
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

ADJUST_KEYS_ALL = ADJUST_KEYS + ("exposure", "highlights", "shadows")


def normalize_spec(raw) -> dict | None:
    """Mirror of color.ts normalizeColorSpec (E4 fields + G4a grade fields)."""
    from clips_worker.color_grade import _ri, normalize_grade_fields

    if not isinstance(raw, dict):
        return None
    out: dict = {}
    if isinstance(raw.get("preset"), str) and raw["preset"] in COLOR_PRESETS:
        out["preset"] = raw["preset"]
        try:
            it = float(raw.get("intensity"))
        except (TypeError, ValueError):
            it = float("nan")
        if math.isfinite(it) and it != 100:
            out["intensity"] = _ri(_clamp(it, 0, 100))
    a = raw.get("adjust")
    if isinstance(a, dict):
        adj = {}
        for k in ADJUST_KEYS_ALL:
            try:
                n = float(a.get(k))
            except (TypeError, ValueError):
                continue
            if math.isfinite(n) and _ri(n) != 0:
                adj[k] = _ri(_clamp(n, ADJUST_MIN, ADJUST_MAX))
        if adj:
            out["adjust"] = adj
    out.update(normalize_grade_fields(raw))
    return None if is_identity_spec(out) else out


def _norm_color(c: dict) -> dict:
    """Specs normalized (G4a fields validated) so a malformed edit can never break the export."""
    out = dict(c)
    if c.get("video") is not None:
        out["video"] = normalize_spec(c.get("video"))
    segs = []
    for s in c.get("segments") or []:
        if isinstance(s, dict):
            segs.append({**s, "spec": normalize_spec(s.get("spec")) or {}})
    out["segments"] = segs
    if isinstance(c.get("broll"), dict):
        out["broll"] = {k: v for k, v in ((k, normalize_spec(v)) for k, v in c["broll"].items()) if v}
    return out


def color_edits(edits: dict) -> dict:
    c = edits.get("color")
    if not isinstance(c, dict):
        return {}
    cached = edits.get("_colorNorm") if isinstance(edits.get("_colorNorm"), dict) else None
    if cached is not None and cached.get("src") is c:
        return cached["norm"]
    return _norm_color(c)


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


def _lut_for(edits: dict, spec) -> dict | None:
    """Parsed user LUT for a spec (prepared by user_luts.prepare_user_luts as ``_lutData``)."""
    lut = spec.get("lut") if isinstance(spec, dict) else None
    if not isinstance(lut, dict):
        return None
    data = edits.get("_lutData") if isinstance(edits.get("_lutData"), dict) else {}
    return data.get(str(lut.get("id")))


def video_grade_ranges(edits: dict, clip_start_ms: int, clip_end_ms: int) -> list[tuple[int, int, dict]]:
    """[(srcFrom, srcTo, spec)] of the main video in SOURCE ms. G4a: with color keyframes on the
    Video target (output ms) each kept segment is cut at the COLOR_STEP_MS grid (mapped to source)
    and the keyframed Adjust values override the look — exactly what the preview evaluates."""
    from clips_worker.color_grade import color_tracks, spec_with_overrides, step_of, tracks_span_ms, COLOR_STEP_MS

    tracks = color_tracks(edits, "video")
    if not tracks:
        return source_look_ranges(edits, clip_start_ms, clip_end_ms)
    from clips_worker.clip_keep_segments import ordered_keep_segments

    c = color_edits(edits)
    cuts = {int(clip_start_ms), int(clip_end_ms)}
    for s in c.get("segments") or []:
        for k in ("fromMs", "toMs"):
            v = int(_num(s.get(k)))
            if clip_start_ms < v < clip_end_ms:
                cuts.add(v)
    segs = []
    o = 0
    span = tracks_span_ms(tracks)
    for a, b in ordered_keep_segments(edits):
        segs.append((a, b, o))
        for v in (a, b):
            if clip_start_ms < v < clip_end_ms:
                cuts.add(int(v))
        if span:
            for k in range(step_of(span[0]), step_of(span[1]) + 2):
                src = a + (k * COLOR_STEP_MS - o)
                if a < src < b and clip_start_ms < src < clip_end_ms:
                    cuts.add(int(src))
        o += b - a
    pts = sorted(cuts)
    out: list[tuple[int, int, dict]] = []
    for a, b in zip(pts, pts[1:]):
        base = video_spec_at_source(edits, a) or {}
        out_ms = next((so + (a - sa) for sa, sb, so in segs if sa <= a < sb), None)
        spec = spec_with_overrides(base, tracks, out_ms) if out_ms is not None else base
        if not spec or is_identity_spec(spec):
            continue
        if out and out[-1][1] == a and look_key(out[-1][2]) == look_key(spec):
            out[-1] = (out[-1][0], b, out[-1][2])
        else:
            out.append((a, b, spec))
    return out


def _probe_wh(path: Path) -> tuple[int, int]:
    import subprocess

    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0:s=x", str(path)], capture_output=True, text=True, check=True)
    w, h = r.stdout.strip().split("x")[:2]
    return int(w), int(h)


def full_render_color_graph(edits: dict, clip_start_ms: int, clip_end_ms: int, work_dir: Path,
                            size: tuple[int, int] | None = None) -> tuple[str, str] | None:
    """filter_complex for full_render.mp4 (t = (src − clip_start)/1000): one lut3d per distinct
    look (enable windows), then G4a sharpen / vignette / grain per distinct fx. → (graph, label)."""
    from clips_worker.color_fx import enable_expr, fx_groups, fx_parts

    ranges = video_grade_ranges(edits, clip_start_ms, clip_end_ms)
    if not ranges:
        return None
    by_key: dict[str, tuple[dict, list[tuple[int, int]]]] = {}
    for a, b, spec in ranges:
        k = look_key(spec)
        by_key.setdefault(k, (spec, []))[1].append((a, b))
    chain: list[str] = []
    whole = len(ranges) == 1 and ranges[0][0] <= clip_start_ms and ranges[0][1] >= clip_end_ms
    to_s = lambda spans: [((a - clip_start_ms) / 1000, (b - clip_start_ms) / 1000) for a, b in spans]  # noqa: E731
    for k, (spec, spans) in by_key.items():
        if is_pointwise_identity(spec):
            continue
        cube = write_cube(spec, Path(work_dir) / f"look_{k}.cube", lut=_lut_for(edits, spec))
        if whole:
            chain.append(f"lut3d=file='{cube}'")
            continue
        chain.append(f"lut3d=file='{cube}':enable='{enable_expr(to_s(spans))}'")
    parts = [f"[0:v]{','.join(chain) or 'null'}[c0]"]
    label = "c0"
    groups = fx_groups([(a, b, spec) for a, b, spec in ranges])
    if groups:
        w, h = size if size else (0, 0)
        for i, (fx, spans) in enumerate(groups):
            en = None if whole else enable_expr(to_s(spans))
            parts += fx_parts(label, f"fx{i}", fx, w, h, Path(work_dir), f"vfx{i}", en)
            label = f"fx{i}"
    return ";".join(parts), label


def is_pointwise_identity(spec) -> bool:
    """True when a spec only carries frame-space fx (no lut3d needed)."""
    from clips_worker.color_grade import has_pointwise_v2

    if not isinstance(spec, dict) or has_pointwise_v2(spec):
        return False
    rest = {k: v for k, v in spec.items() if k != "fx"}
    return is_identity_spec(rest)


def full_render_color_filter(edits: dict, clip_start_ms: int, clip_end_ms: int, work_dir: Path) -> str | None:
    """E4 -vf chain (looks only; kept for callers / tests that have no fx)."""
    g = full_render_color_graph(edits, clip_start_ms, clip_end_ms, work_dir)
    if not g:
        return None
    graph, _ = g
    return graph.split("]", 1)[1].rsplit("[", 1)[0] if ";" not in graph else None


def apply_full_render_color(full_render: Path, edits: dict, clip_start_ms: int, clip_end_ms: int,
                            work_dir: Path) -> Path:
    import subprocess

    from clips_worker.color_grade import has_fx

    ranges = video_grade_ranges(edits, clip_start_ms, clip_end_ms)
    if not ranges:
        return full_render
    size = _probe_wh(full_render) if any(has_fx(s) for _, _, s in ranges) else None
    g = full_render_color_graph(edits, clip_start_ms, clip_end_ms, work_dir, size)
    if not g:
        return full_render
    graph, label = g
    out = Path(work_dir) / "full_render_color.mp4"
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(full_render), "-filter_complex", f"{graph};[{label}]format=yuv420p[cv]",
         "-map", "[cv]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy",
         str(out)]
    )
    print(f"[clipper:color] full_render looks={graph.count('lut3d')} fx={graph.count('format=gbrp[')}", flush=True)
    return out


def broll_color_filter(edits: dict | None, item_id: str, work_dir: Path | None, *, w: int = 0, h: int = 0,
                       tag: str | None = None, start_s: float = 0.0, end_s: float = 0.0) -> str:
    """',lut3d=…' to append to a B-roll input chain, or ''. G4a: keyframed color (target
    ``broll:<id>``, local ms from the item start) adds stepped lut3d windows, and sharpen /
    vignette / grain add filter-complex parts (needs w, h and a unique tag)."""
    if not edits:
        return ""
    from clips_worker.color_fx import fx_parts
    from clips_worker.color_grade import color_tracks, has_fx, stepped_windows

    br = color_edits(edits).get("broll")
    base = br.get(item_id) if isinstance(br, dict) else None
    tracks = color_tracks(edits, f"broll:{item_id}")
    if base is None and not tracks:
        return ""
    wd = Path(work_dir or ".")
    if not tracks:
        if is_identity_spec(base):
            return ""
        windows = [(0.0, 0.0, base)]
        whole = True
    else:
        lo, hi = start_s * 1000, max(end_s * 1000, start_s * 1000 + 1)
        windows = stepped_windows(base or {}, tracks, lo, hi, origin=start_s * 1000)
        whole = False
    out = ""
    seen: dict[str, list] = {}
    for a, b, spec in windows:
        if is_pointwise_identity(spec):
            continue
        seen.setdefault(look_key(spec), [spec, []])[1].append((a, b))
    for k, (spec, spans) in seen.items():
        cube = write_cube(spec, wd / f"look_broll_{k}.cube", lut=_lut_for(edits, spec))
        if whole:
            out += f",lut3d=file='{cube}'"
        else:
            en = "+".join(f"gte(t,{a / 1000:.4f})*lt(t,{b / 1000:.4f})" for a, b in spans)
            out += f",lut3d=file='{cube}':enable='{en}'"
    if base and has_fx(base) and w > 0 and h > 0 and tag:
        # fx are static per item (not keyframed); the parts split the chain with labels.
        parts = fx_parts(f"{tag}i", f"{tag}o", base.get("fx") or {}, w, h, wd, tag)
        last = parts[-1][1:].split("]", 1)[0]
        out += f"[{tag}i];" + ";".join(parts[:-1]) + f";[{last}]null"
    return out
