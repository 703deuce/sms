"""G4a color grade v2 — line-for-line mirror of new-app/lib/clips/editor/color-grade.ts.

A spec with any G4a field (exposure / highlights / shadows, curves, wheels, HSL ranges, a user LUT,
sharpen / vignette / grain) is graded as::

    x1 = hsl(mix(x, userLUT(x), lutIntensity))            "3D stage" (only with HSL or a LUT)
    x2 = Tpre_c(x1)                                         exposure, 256-entry table per channel
    x3 = clamp01(M · x2 + o)                                E4 affine (preset + Adjust sliders)
    x4 = Tpost_c(x3)                                        preset curve → highlights / shadows →
                                                            lift / gamma / gain → master → R/G/B curve
    then (spatial, frame space): sharpen 5×5 → vignette (multiply) → grain (grain-merge)

Tables are sampled at 256 points and read with linear interpolation — exactly the SVG
feComponentTransfer ``table`` semantics the preview uses. Export: the pointwise part is baked into
a GRID³ .cube for ffmpeg ``lut3d`` (tetrahedral); the preview either runs the same SVG chain (no 3D
stage) or samples the SAME baked grid in WebGL with the same tetrahedral formula (3D stage).
Legacy E4-only specs are untouched (color.py write_cube / look_key unchanged).
Parity: new-app/tests/fixtures/g4a-parity.json, asserted by vitest and pytest.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np

V2_ADJUST = ("exposure", "highlights", "shadows")
HSL_RANGES = ("red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta")
HSL_CENTERS = (0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 280.0, 320.0)
CURVE_CHANNELS = ("m", "r", "g", "b")
WHEELS = ("lift", "gamma", "gain")
FX_KEYS = ("sharpen", "vignette", "grain")
# G4b effects library (fx_library.py); canonical string adds them as an "e" part only when set.
FX2_KEYS = ("blur", "glow", "rgbsplit", "glitch", "shake", "flicker", "scanlines")
FX_ALL = FX_KEYS + FX2_KEYS
TABLE_N = 255  # 256-entry tables
GRID = 33
CURVE_MAX_POINTS = 8
LUT_MAX_SIZE = 65
# Keyframed color is evaluated on this output-ms grid (preview and export use the same steps).
COLOR_STEP_MS = 100
GRAIN_FRAMES = 8
GRAIN_PAD = 32  # cells of padding for the per-frame offset


def _clamp(v, lo, hi):
    return min(hi, max(lo, v))


def _num(v, d: float = 0.0) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return d
    return f if math.isfinite(f) else d


def _ri(v: float) -> int:
    """JS Math.round."""
    return int(math.floor(v + 0.5))


def _r3(v: float) -> float:
    return math.floor(v * 1000 + 0.5) / 1000


# ── normalization (mirrors color-grade.ts normalizeGradeFields) ─────────────

def normalize_curve(raw) -> list[list[float]] | None:
    if not isinstance(raw, list):
        return None
    pts: list[list[float]] = []
    for p in raw:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        x, y = _num(p[0], -1), _num(p[1], -1)
        if not (0 <= x <= 1) or not (-0.0001 <= y <= 1.0001):
            continue
        pts.append([_r3(x), _r3(_clamp(y, 0, 1))])
    pts.sort(key=lambda q: q[0])
    out: list[list[float]] = []
    for p in pts:
        if out and p[0] - out[-1][0] < 0.01:
            out[-1] = p  # later point wins on a near-duplicate x
        else:
            out.append(p)
    out = out[:CURVE_MAX_POINTS]
    if len(out) < 2:
        return None
    if len(out) == 2 and out[0] == [0.0, 0.0] and out[1] == [1.0, 1.0]:
        return None
    return out


def normalize_wheel(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    x, y, l = _num(raw.get("x")), _num(raw.get("y")), _num(raw.get("l"))
    r = math.hypot(x, y)
    if r > 1:
        x, y = x / r, y / r
    w = {"x": _r3(x), "y": _r3(y), "l": _r3(_clamp(l, -1, 1))}
    return None if w["x"] == 0 and w["y"] == 0 and w["l"] == 0 else w


def normalize_grade_fields(raw: dict) -> dict:
    """The G4a fields of a ColorSpec (adjust v2 keys are handled with the E4 adjust)."""
    out: dict = {}
    cv = raw.get("curves")
    if isinstance(cv, dict):
        c = {k: normalize_curve(cv.get(k)) for k in CURVE_CHANNELS}
        c = {k: v for k, v in c.items() if v}
        if c:
            out["curves"] = c
    wh = raw.get("wheels")
    if isinstance(wh, dict):
        w = {k: normalize_wheel(wh.get(k)) for k in WHEELS}
        w = {k: v for k, v in w.items() if v}
        if w:
            out["wheels"] = w
    hs = raw.get("hsl")
    if isinstance(hs, dict):
        h: dict = {}
        for k in HSL_RANGES:
            v = hs.get(k)
            if not isinstance(v, dict):
                continue
            a = {q: _ri((_clamp(_num(v.get(q)), -100, 100))) for q in ("h", "s", "l")}
            if any(a.values()):
                h[k] = a
        if h:
            out["hsl"] = h
    lut = raw.get("lut")
    if isinstance(lut, dict) and isinstance(lut.get("id"), str) and 0 < len(lut["id"]) <= 64:
        it = _ri((_clamp(_num(lut.get("intensity"), 100), 0, 100)))
        if it > 0:
            out["lut"] = {"id": lut["id"], **({"intensity": it} if it != 100 else {})}
    fx = raw.get("fx")
    if isinstance(fx, dict):
        f = {k: _ri((_clamp(_num(fx.get(k)), 0, 100))) for k in FX_ALL}
        f = {k: v for k, v in f.items() if v}
        if f:
            out["fx"] = f
    return out


def has_grade_fields(spec) -> bool:
    if not isinstance(spec, dict):
        return False
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    if any(_num(adj.get(k)) != 0 for k in V2_ADJUST):
        return True
    return any(spec.get(k) for k in ("curves", "wheels", "hsl", "lut", "fx"))


def has_pointwise_v2(spec) -> bool:
    if not isinstance(spec, dict):
        return False
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    if any(_num(adj.get(k)) != 0 for k in V2_ADJUST):
        return True
    return any(spec.get(k) for k in ("curves", "wheels", "hsl", "lut"))


def needs_3d(spec) -> bool:
    return isinstance(spec, dict) and bool(spec.get("hsl") or spec.get("lut"))


def spec_fx(spec) -> dict:
    fx = spec.get("fx") if isinstance(spec, dict) else None
    return {k: int(fx.get(k) or 0) for k in FX_ALL} if isinstance(fx, dict) else {k: 0 for k in FX_ALL}


def has_fx(spec) -> bool:
    return any(spec_fx(spec).values())


def _fmt(v: float) -> str:
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def canon_grade(spec) -> str:
    """Canonical string of the G4a fields (stable across TS / Python)."""
    if not isinstance(spec, dict):
        return ""
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    parts = ["a" + ",".join(str(_ri((_num(adj.get(k))))) for k in V2_ADJUST)]
    cv = spec.get("curves") or {}
    for k in CURVE_CHANNELS:
        if cv.get(k):
            parts.append(f"c{k}" + ";".join(f"{_fmt(p[0])},{_fmt(p[1])}" for p in cv[k]))
    wh = spec.get("wheels") or {}
    for k in WHEELS:
        if wh.get(k):
            w = wh[k]
            parts.append(f"w{k}{_fmt(w['x'])},{_fmt(w['y'])},{_fmt(w['l'])}")
    hs = spec.get("hsl") or {}
    for k in HSL_RANGES:
        if hs.get(k):
            v = hs[k]
            parts.append(f"h{k}{v['h']},{v['s']},{v['l']}")
    if spec.get("lut"):
        parts.append(f"l{spec['lut']['id']},{int(spec['lut'].get('intensity', 100))}")
    fx = spec_fx(spec)
    if any(fx[k] for k in FX_KEYS):
        parts.append("f" + ",".join(str(fx[k]) for k in FX_KEYS))
    if any(fx[k] for k in FX2_KEYS):
        parts.append("e" + ",".join(f"{k}{fx[k]}" for k in FX2_KEYS if fx[k]))
    return "|".join(parts)


def fnv1a(s: str) -> str:
    h = 0x811C9DC5
    for ch in s.encode("utf-8"):
        h ^= ch
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


# ── 1D tables ───────────────────────────────────────────────────────────────

def srgb_dec(x: float) -> float:
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4


def srgb_enc(y: float) -> float:
    return 12.92 * y if y <= 0.0031308 else 1.055 * y ** (1 / 2.4) - 0.055


def curve_slopes(pts: list[list[float]]) -> list[float]:
    """Fritsch–Carlson monotone cubic tangents."""
    n = len(pts)
    d = [(pts[k + 1][1] - pts[k][1]) / (pts[k + 1][0] - pts[k][0]) for k in range(n - 1)]
    m = [0.0] * n
    m[0] = d[0]
    m[n - 1] = d[n - 2]
    for k in range(1, n - 1):
        m[k] = (d[k - 1] + d[k]) / 2 if d[k - 1] * d[k] > 0 else 0.0
    for k in range(n - 1):
        if d[k] == 0:
            m[k] = 0.0
            m[k + 1] = 0.0
            continue
        a = m[k] / d[k]
        b = m[k + 1] / d[k]
        s = a * a + b * b
        if s > 9:
            t = 3 / math.sqrt(s)
            m[k] = t * a * d[k]
            m[k + 1] = t * b * d[k]
    return m


def curve_eval(pts: list[list[float]], m: list[float], x: float) -> float:
    n = len(pts)
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[n - 1][0]:
        return pts[n - 1][1]
    k = 0
    while k < n - 2 and x >= pts[k + 1][0]:
        k += 1
    h = pts[k + 1][0] - pts[k][0]
    t = (x - pts[k][0]) / h
    t2 = t * t
    t3 = t2 * t
    y = ((2 * t3 - 3 * t2 + 1) * pts[k][1] + (t3 - 2 * t2 + t) * h * m[k]
         + (-2 * t3 + 3 * t2) * pts[k + 1][1] + (t3 - t2) * h * m[k + 1])
    return _clamp(y, 0.0, 1.0)


_PHI = (0.0, 2 * math.pi / 3, 4 * math.pi / 3)


def wheel_d(w: dict | None, c: int) -> float:
    if not w:
        return 0.0
    return w["l"] + w["x"] * math.cos(_PHI[c]) + w["y"] * math.sin(_PHI[c])


def tone_hs(y: float, hi: float, sh: float) -> float:
    y = y + sh * 0.6 * y * (1 - y) * (1 - y)
    y = y + hi * 0.6 * y * y * (1 - y)
    return _clamp(y, 0.0, 1.0)


def pre_table(spec) -> list[float] | None:
    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    ev = _clamp(_num(adj.get("exposure")), -100, 100) / 100 * 2
    if ev == 0:
        return None
    g = 2.0 ** ev
    return [srgb_enc(min(1.0, srgb_dec(i / TABLE_N) * g)) for i in range(TABLE_N + 1)]


def post_tables(spec, preset_curve) -> list[list[float]] | None:
    """Per-channel 256 tables: preset curve → highlights/shadows → wheels → master → channel."""
    from clips_worker.color import _curve_at

    adj = spec.get("adjust") if isinstance(spec.get("adjust"), dict) else {}
    hi = _clamp(_num(adj.get("highlights")), -100, 100) / 100
    sh = _clamp(_num(adj.get("shadows")), -100, 100) / 100
    wh = spec.get("wheels") or {}
    cv = spec.get("curves") or {}
    if not preset_curve and hi == 0 and sh == 0 and not wh and not cv:
        return None
    mpts = cv.get("m")
    mm = curve_slopes(mpts) if mpts else None
    out = []
    for c, ck in enumerate(("r", "g", "b")):
        cpts = cv.get(ck)
        cm = curve_slopes(cpts) if cpts else None
        lift = 0.25 * wheel_d(wh.get("lift"), c)
        gain = 1 + 0.5 * wheel_d(wh.get("gain"), c)
        gexp = 2.0 ** (-0.75 * wheel_d(wh.get("gamma"), c))
        tab = []
        for i in range(TABLE_N + 1):
            y = i / TABLE_N
            if preset_curve:
                y = _curve_at(preset_curve[c], y)
            y = tone_hs(y, hi, sh)
            y = _clamp(gain * (y + lift * (1 - y)), 0.0, 1.0)
            y = y ** gexp
            if mpts:
                y = curve_eval(mpts, mm, y)
            if cpts:
                y = curve_eval(cpts, cm, y)
            tab.append(y)
        out.append(tab)
    return out


def table_apply(tab, x):
    """Linear interpolation of a 256 table (SVG feFuncX type=table); x: ndarray in [0,1]."""
    t = np.asarray(tab, dtype=np.float64)
    f = np.clip(x, 0.0, 1.0) * TABLE_N
    k = np.minimum(TABLE_N - 1, np.floor(f)).astype(np.int64)
    return t[k] + (f - k) * (t[k + 1] - t[k])


# ── 3D stage ────────────────────────────────────────────────────────────────

def tetra(grid: np.ndarray, size: int, rgb: np.ndarray) -> np.ndarray:
    """ffmpeg vf_lut3d interp_tetrahedral. grid: (size³, 3) in .cube order (R fastest);
    rgb: (N, 3) already scaled to [0, size − 1]."""
    lm = size - 1
    s = np.clip(rgb, 0, lm)
    p = np.floor(s).astype(np.int64)
    n = np.minimum(p + 1, lm)
    d = s - p

    def c(ri, gi, bi):
        return grid[(bi * size + gi) * size + ri]

    pr, pg, pb = p[:, 0], p[:, 1], p[:, 2]
    nr, ng, nb = n[:, 0], n[:, 1], n[:, 2]
    dr, dg, db = d[:, 0:1], d[:, 1:2], d[:, 2:3]
    c000 = c(pr, pg, pb)
    c111 = c(nr, ng, nb)
    out = np.empty_like(c000)
    rg = (dr > dg)[:, 0]
    gb = (dg > db)[:, 0]
    rb = (dr > db)[:, 0]
    bg = (db > dg)[:, 0]
    br = (db > dr)[:, 0]
    m1 = rg & gb
    m2 = rg & ~gb & rb
    m3 = rg & ~gb & ~rb
    m4 = ~rg & bg
    m5 = ~rg & ~bg & br
    m6 = ~rg & ~bg & ~br
    if m1.any():
        i = m1
        out[i] = ((1 - dr[i]) * c000[i] + (dr[i] - dg[i]) * c(nr[i], pg[i], pb[i])
                  + (dg[i] - db[i]) * c(nr[i], ng[i], pb[i]) + db[i] * c111[i])
    if m2.any():
        i = m2
        out[i] = ((1 - dr[i]) * c000[i] + (dr[i] - db[i]) * c(nr[i], pg[i], pb[i])
                  + (db[i] - dg[i]) * c(nr[i], pg[i], nb[i]) + dg[i] * c111[i])
    if m3.any():
        i = m3
        out[i] = ((1 - db[i]) * c000[i] + (db[i] - dr[i]) * c(pr[i], pg[i], nb[i])
                  + (dr[i] - dg[i]) * c(nr[i], pg[i], nb[i]) + dg[i] * c111[i])
    if m4.any():
        i = m4
        out[i] = ((1 - db[i]) * c000[i] + (db[i] - dg[i]) * c(pr[i], pg[i], nb[i])
                  + (dg[i] - dr[i]) * c(pr[i], ng[i], nb[i]) + dr[i] * c111[i])
    if m5.any():
        i = m5
        out[i] = ((1 - dg[i]) * c000[i] + (dg[i] - db[i]) * c(pr[i], ng[i], pb[i])
                  + (db[i] - dr[i]) * c(pr[i], ng[i], nb[i]) + dr[i] * c111[i])
    if m6.any():
        i = m6
        out[i] = ((1 - dg[i]) * c000[i] + (dg[i] - dr[i]) * c(pr[i], ng[i], pb[i])
                  + (dr[i] - db[i]) * c(nr[i], ng[i], pb[i]) + db[i] * c111[i])
    return out


def parse_cube(text: str) -> dict:
    """.cube (Adobe / Resolve) 3D LUT → {size, dmin, dmax, data (size³·3 floats, R fastest)}."""
    size = 0
    dmin = [0.0, 0.0, 0.0]
    dmax = [1.0, 1.0, 1.0]
    vals: list[float] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        head = line.split()[0].upper()
        if head == "TITLE":
            continue
        if head == "LUT_1D_SIZE":
            raise ValueError("1D LUTs are not supported — export a 3D .cube")
        if head == "LUT_3D_SIZE":
            size = int(line.split()[1])
            continue
        if head == "DOMAIN_MIN":
            dmin = [float(v) for v in line.split()[1:4]]
            continue
        if head == "DOMAIN_MAX":
            dmax = [float(v) for v in line.split()[1:4]]
            continue
        if head.startswith("LUT_") or head.isalpha():
            continue
        parts = line.split()
        if len(parts) < 3:
            raise ValueError("Bad LUT row")
        vals.extend(float(v) for v in parts[:3])
    if size < 2 or size > LUT_MAX_SIZE:
        raise ValueError(f"LUT size must be 2..{LUT_MAX_SIZE}")
    if len(vals) != size ** 3 * 3:
        raise ValueError("LUT has the wrong number of rows")
    if any(not math.isfinite(v) for v in vals):
        raise ValueError("LUT has a non-numeric value")
    if any(dmax[i] <= dmin[i] for i in range(3)):
        raise ValueError("Bad LUT domain")
    return {"size": size, "dmin": dmin, "dmax": dmax, "data": vals}


def lut_apply(lut: dict, x: np.ndarray) -> np.ndarray:
    size = int(lut["size"])
    grid = np.asarray(lut["data"], dtype=np.float64).reshape(-1, 3)
    dmin = np.asarray(lut["dmin"], dtype=np.float64)
    dmax = np.asarray(lut["dmax"], dtype=np.float64)
    s = (x - dmin) / (dmax - dmin) * (size - 1)
    return np.clip(tetra(grid, size, s), 0.0, 1.0)


def hsl_weights(h: np.ndarray) -> np.ndarray:
    """(N,) hue degrees → (N, 8) triangular partition-of-unity weights over HSL_CENTERS."""
    n = len(HSL_CENTERS)
    w = np.zeros((h.shape[0], n))
    for k in range(n):
        a = HSL_CENTERS[k]
        b = HSL_CENTERS[(k + 1) % n] + (360.0 if k == n - 1 else 0.0)
        hh = np.where(h < a, h + 360.0, h)
        inside = (hh >= a) & (hh < b)
        t = (hh - a) / (b - a)
        w[:, k] += np.where(inside, 1 - t, 0.0)
        w[:, (k + 1) % n] += np.where(inside, t, 0.0)
    return w


def hsl_apply(hsl: dict, x: np.ndarray) -> np.ndarray:
    adj = np.array([[_num((hsl.get(k) or {}).get(q)) / 100 for q in ("h", "s", "l")] for k in HSL_RANGES])
    r, g, b = x[:, 0], x[:, 1], x[:, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    c = mx - mn
    safe = np.where(c > 1e-9, c, 1.0)
    hr = np.mod((g - b) / safe, 6.0)
    hg = (b - r) / safe + 2.0
    hb = (r - g) / safe + 4.0
    hue = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60.0
    hue = np.mod(hue, 360.0)
    w = hsl_weights(hue)
    dh = (w @ adj[:, 0]) * 30.0
    ds = w @ adj[:, 1]
    dl = w @ adj[:, 2]
    L = (mx + mn) / 2
    den = 1 - np.abs(2 * L - 1)
    S = np.where(den > 1e-9, c / np.where(den > 1e-9, den, 1.0), 0.0)
    H2 = np.mod(hue + dh, 360.0)
    S2 = np.clip(S * (1 + ds), 0.0, 1.0)
    L2 = np.clip(L + 0.25 * dl * c, 0.0, 1.0)
    C2 = (1 - np.abs(2 * L2 - 1)) * S2
    hp = H2 / 60.0
    X = C2 * (1 - np.abs(np.mod(hp, 2.0) - 1))
    m = L2 - C2 / 2
    seg = np.minimum(5, np.floor(hp)).astype(np.int64)
    z = np.zeros_like(C2)
    rr = np.choose(seg, [C2, X, z, z, X, C2])
    gg = np.choose(seg, [X, C2, C2, X, z, z])
    bb = np.choose(seg, [z, z, X, C2, C2, X])
    out = np.stack([rr + m, gg + m, bb + m], axis=1)
    out = np.clip(out, 0.0, 1.0)
    return np.where((c > 1e-9)[:, None], out, x)


def stage3d(spec, x: np.ndarray, lut: dict | None) -> np.ndarray:
    if spec.get("lut") and lut is not None:
        it = _num(spec["lut"].get("intensity", 100), 100) / 100
        y = lut_apply(lut, x)
        x = x + (y - x) * it
    if spec.get("hsl"):
        x = hsl_apply(spec["hsl"], x)
    return x


# ── whole pointwise grade ───────────────────────────────────────────────────

def grade_parts(spec) -> dict:
    from clips_worker.color import look_for_spec

    look = look_for_spec(spec)
    return {"m": look["m"], "o": look["o"], "pre": pre_table(spec), "post": post_tables(spec, look["curve"])}


def grade(spec, rgb, lut: dict | None = None, parts: dict | None = None) -> np.ndarray:
    """Pointwise G4a grade of (N, 3) sRGB values in 0..1."""
    x = np.asarray(rgb, dtype=np.float64).reshape(-1, 3)
    parts = parts or grade_parts(spec)
    if needs_3d(spec):
        x = stage3d(spec, x, lut)
    if parts["pre"] is not None:
        x = np.stack([table_apply(parts["pre"], x[:, c]) for c in range(3)], axis=1)
    m = np.asarray(parts["m"], dtype=np.float64).reshape(3, 3)
    x = np.clip(x @ m.T + np.asarray(parts["o"], dtype=np.float64), 0.0, 1.0)
    if parts["post"] is not None:
        x = np.stack([table_apply(parts["post"][c], x[:, c]) for c in range(3)], axis=1)
    return x


def bake_grid(spec, size: int = GRID, lut: dict | None = None) -> np.ndarray:
    """(size³, 3) grid in .cube order (R fastest)."""
    v = np.arange(size, dtype=np.float64) / (size - 1)
    b, g, r = np.meshgrid(v, v, v, indexing="ij")
    pts = np.stack([r.ravel(), g.ravel(), b.ravel()], axis=1)
    return grade(spec, pts, lut)


def write_grade_cube(spec, path: Path, lut: dict | None = None, size: int = GRID, title: str = "g4a") -> Path:
    grid = bake_grid(spec, size, lut)
    head = f'TITLE "{title}"\nLUT_3D_SIZE {size}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n'
    body = "\n".join(f"{r:.6f} {g:.6f} {b:.6f}" for r, g, b in grid.tolist())
    Path(path).write_text(head + body + "\n", encoding="ascii")
    return Path(path)


# ── spatial effects (frame space) ───────────────────────────────────────────

def sharpen_q(amount: int) -> int:
    return _ri((_clamp(amount, 0, 100) * 1.5))


def sharpen_kernel(amount: int) -> list[int]:
    q = sharpen_q(amount)
    k = [-q] * 25
    k[12] = 2500 + 24 * q
    return k


SHARPEN_DIVISOR = 2500


def vignette_mask_value(amount: int, u, v):
    a = _clamp(amount, 0, 100) / 100 * 0.85
    d = np.sqrt(((u - 0.5) * 2) ** 2 + ((v - 0.5) * 2) ** 2) / math.sqrt(2)
    t = np.clip((d - 0.35) / (1.05 - 0.35), 0.0, 1.0)
    s = t * t * (3 - 2 * t)
    return 1 - a * s


def vignette_mask(amount: int, w: int, h: int) -> np.ndarray:
    """uint8 (h, w) multiply mask; pixel centres."""
    u = (np.arange(w) + 0.5) / w
    v = (np.arange(h) + 0.5) / h
    m = vignette_mask_value(amount, u[None, :], v[:, None])
    return np.floor(m * 255 + 0.5).astype(np.uint8)


def grain_hash(x, y, k):
    """32-bit integer hash → 0..255 (vectorized over numpy ints)."""
    x = np.asarray(x, dtype=np.uint64)
    y = np.asarray(y, dtype=np.uint64)
    h = (x * np.uint64(374761393) + y * np.uint64(668265263) + np.uint64(k) * np.uint64(2246822519)) & np.uint64(0xFFFFFFFF)
    h = ((h ^ (h >> np.uint64(13))) * np.uint64(1274126177)) & np.uint64(0xFFFFFFFF)
    h = h ^ (h >> np.uint64(16))
    return (h & np.uint64(255)).astype(np.int64)


def grain_cell(play_h: int) -> int:
    return max(1, _ri((play_h / 720)))


def grain_offset(frame: int) -> tuple[int, int]:
    k = frame % GRAIN_FRAMES
    return (k * 13) % GRAIN_PAD, (k * 29) % GRAIN_PAD


def grain_cells(amount: int, gw: int, gh: int) -> np.ndarray:
    """uint8 (gh + PAD, gw + PAD) grain-merge cells: 128 ± amp."""
    amp = _clamp(amount, 0, 100) / 100 * 40
    yy, xx = np.mgrid[0: gh + GRAIN_PAD, 0: gw + GRAIN_PAD]
    n = grain_hash(xx, yy, 7)
    v = 128 + amp * (n - 127.5) / 127.5
    return np.floor(v + 0.5).astype(np.uint8)


# ── keyframed color (existing keyframe system: props c* on video / broll:<id> / adjust:<id>) ──

COLOR_KEY_PROPS = {
    "cExposure": "exposure",
    "cBrightness": "brightness",
    "cContrast": "contrast",
    "cSaturation": "saturation",
    "cTemperature": "temperature",
    "cTint": "tint",
    "cHighlights": "highlights",
    "cShadows": "shadows",
    "cVibrance": "vibrance",
}


def color_tracks(edits: dict, target: str) -> list[dict]:
    from clips_worker.motion import normalize_keyframes

    return [k for k in normalize_keyframes(edits.get("keyframes")) if k["target"] == target and k["prop"] in COLOR_KEY_PROPS]


def step_of(local_ms: float) -> int:
    return int(math.floor(local_ms / COLOR_STEP_MS))


def spec_with_overrides(spec, tracks: list[dict], local_ms: float) -> dict | None:
    """Spec with keyframed Adjust values at the quantized step containing local_ms."""
    from clips_worker.motion import track_value_at

    if not tracks:
        return spec
    t = step_of(local_ms) * COLOR_STEP_MS
    base = dict(spec) if isinstance(spec, dict) else {}
    adj = dict(base.get("adjust") or {})
    for tr in tracks:
        v = _ri((track_value_at(tr, tr["prop"], t)))
        key = COLOR_KEY_PROPS[tr["prop"]]
        if v:
            adj[key] = v
        else:
            adj.pop(key, None)
    if adj:
        base["adjust"] = adj
    else:
        base.pop("adjust", None)
    return base


def tracks_span_ms(tracks: list[dict]) -> tuple[float, float] | None:
    pts = [p["tMs"] for tr in tracks for p in tr.get("points") or []]
    if not pts:
        return None
    return min(pts), max(pts)


def stepped_windows(spec, tracks: list[dict], lo: float, hi: float, origin: float = 0.0) -> list[tuple[float, float, dict]]:
    """[(a, b, spec)] covering output ms [lo, hi) where the keyframed spec is constant (local ms =
    out − origin, quantized to COLOR_STEP_MS like the preview). Identity windows are dropped."""
    from clips_worker.color import is_identity_spec, look_key

    if hi <= lo:
        return []
    cuts = {lo, hi}
    span = tracks_span_ms(tracks) if tracks else None
    if span:
        for k in range(step_of(span[0]), step_of(span[1]) + 2):
            t = origin + k * COLOR_STEP_MS
            if lo < t < hi:
                cuts.add(t)
    pts = sorted(cuts)
    out: list[list] = []
    for a, b in zip(pts, pts[1:]):
        s = spec_with_overrides(spec, tracks, a - origin) if tracks else spec
        key = "id" if (not s or is_identity_spec(s)) else look_key(s)
        if out and out[-1][3] == key and out[-1][1] == a:
            out[-1][1] = b
        else:
            out.append([a, b, s, key])
    return [(a, b, s) for a, b, s, key in out if key != "id"]
