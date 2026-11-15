"""Part 1 / ST-BLK-04..06: world canvas, camera and spotlight. Infrastructure only (no look, no palette).

World units are 4K screen pixels at camera zoom 1 (Cinematic Skill convention). A per-video world
(map, chart, timeline...) is generated fresh per project in Part 2 and drawn on this canvas.
"""
from __future__ import annotations

import bisect
import math

from clips_worker.motion_studio.vendor.cinematic_skill import engine as E
from clips_worker.motion_studio.vendor.cinematic_skill.engine import Film, Item, clamp
from clips_worker.motion_studio.core import fonts as _fonts

_fonts.apply()   # licence-clean font roles (RE-1)

HOUSE = {
    # versioned house constants (ST-RW-011 lessons bump the version)
    "version": 1,
    "fps": 30,
    "min_cap_px": 40.0,          # ST-BLK-15 at 1080p
    "edge_ramp_px": 30.0,        # ST-RW-007
    "wobble_damp": 0.15,         # ST-RW-016
    "lufs": -15.0, "true_peak": -1.5, "lra": 11.0,   # ST-BLK-17 (D34 defaults)
    "max_motion_blur_subframes": 3,
}


# ------------------------------------------------------------------ data-to-space mapping
class LinearAxis:
    """Map a data value range onto a world coordinate range (time/price axes)."""

    def __init__(self, v0: float, v1: float, p0: float, p1: float, log: bool = False):
        self.v0, self.v1, self.p0, self.p1, self.log = float(v0), float(v1), float(p0), float(p1), log

    def __call__(self, v: float) -> float:
        if self.log:
            a, b, x = math.log(max(self.v0, 1e-9)), math.log(max(self.v1, 1e-9)), math.log(max(v, 1e-9))
        else:
            a, b, x = self.v0, self.v1, float(v)
        u = (x - a) / ((b - a) or 1e-9)
        return self.p0 + (self.p1 - self.p0) * u

    def ticks(self, n: int = 5) -> list[float]:
        span = self.v1 - self.v0
        if span == 0:
            return [self.v0]
        raw = span / max(1, n)
        mag = 10 ** math.floor(math.log10(abs(raw)))
        step = min((1, 2, 2.5, 5, 10), key=lambda m: abs(m * mag - raw)) * mag
        start = math.ceil(self.v0 / step) * step
        out, v = [], start
        while (v <= self.v1 + 1e-9) if step > 0 else (v >= self.v1 - 1e-9):
            out.append(round(v, 10))
            v += step
        return out


def mercator(lon: float, lat: float, scale: float = 20000.0, origin: tuple[float, float] = (0.0, 0.0)) -> tuple[float, float]:
    """Web-mercator projection into world units (x right, y down)."""
    lat = max(-85.0, min(85.0, lat))
    x = math.radians(lon) * scale / (2 * math.pi)
    y = -math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * scale / (2 * math.pi)
    return x + origin[0], y + origin[1]


def tile_positions(x0: float, y0: float, x1: float, y1: float, tile: float) -> list[tuple[float, float]]:
    out = []
    y = math.floor(y0 / tile) * tile
    while y < y1:
        x = math.floor(x0 / tile) * tile
        while x < x1:
            out.append((x, y))
            x += tile
        y += tile
    return out


# ------------------------------------------------------------------ camera
class CR:
    """Non-uniform Catmull-Rom through (t, v) keys; zero velocity only at the first and last key."""

    def __init__(self, keys, limit=None):
        keys = sorted(keys)
        self.t = [k[0] for k in keys]
        self.v = [k[1] for k in keys]
        n = len(keys)
        m = [0.0] * n
        for i in range(1, n - 1):
            m[i] = (self.v[i + 1] - self.v[i - 1]) / max(1e-6, self.t[i + 1] - self.t[i - 1])
            if limit is not None:
                d0 = (self.v[i] - self.v[i - 1]) / max(1e-6, self.t[i] - self.t[i - 1])
                d1 = (self.v[i + 1] - self.v[i]) / max(1e-6, self.t[i + 1] - self.t[i])
                cap = limit * max(abs(d0), abs(d1))
                m[i] = max(-cap, min(cap, m[i]))
        self.m = m

    def __call__(self, t):
        T = self.t
        if len(T) == 1 or t <= T[0]:
            return self.v[0]
        if t >= T[-1]:
            return self.v[-1]
        i = bisect.bisect_right(T, t) - 1
        h = T[i + 1] - T[i]
        u = (t - T[i]) / h
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1
        h10 = u ** 3 - 2 * u ** 2 + u
        h01 = -2 * u ** 3 + 3 * u ** 2
        h11 = u ** 3 - u ** 2
        return h00 * self.v[i] + h10 * h * self.m[i] + h01 * self.v[i + 1] + h11 * h * self.m[i + 1]


class _NoBoard(Item):
    def __init__(self):
        super().__init__(t_in=-1e9, t_out=1e9, z=-10_000, sfx=False)

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        return None


class StudioFilm(Film):
    """Film for Studio segments: no texture board (backgrounds are procedural items), organic
    Catmull-Rom camera with drift, damped handheld wobble windows, and film fades OFF by default
    (segment renders never fade to black; ST-RW-015). Program fades are applied at assembly."""

    def __init__(self, duration: float, fps: int = 30, look: dict | None = None, drift: float = 1.0, wobble: float = 1.0):
        base = dict(E.LOOKS["charcoal"])
        if look:
            base.update(look)
        base["board"] = None
        super().__init__(duration, fps=fps, look=base)
        self.board = _NoBoard()
        self.items = [self.board]
        self.fade_in, self.fade_out = 0.0, 0.0
        self.drift = drift
        self.wobble = wobble
        self.damp_windows: list[tuple[float, float, float]] = []   # (t0, t1, factor)

    def damp(self, t0: float, t1: float, factor: float = HOUSE["wobble_damp"]):
        """ST-RW-016: settle handheld wobble (e.g. as the camera arrives on a handoff surface)."""
        self.damp_windows.append((t0, t1, factor))

    def _wobble_gain(self, t: float) -> float:
        g = self.wobble
        for t0, t1, f in self.damp_windows:
            if t0 - 0.4 <= t <= t1 + 0.4:
                if t < t0:
                    u = (t0 - t) / 0.4
                elif t > t1:
                    u = (t - t1) / 0.4
                else:
                    u = 0.0
                g = min(g, f + (1 - f) * clamp(u))
        return g

    def _build(self):
        if not self.cam_keys:
            raise ValueError("the scene has no camera keys: call film.cam(t, x, y, zoom) or film.shot(...)")
        k = sorted(self.cam_keys)
        self._cam = [CR([(a[0], a[1]) for a in k]), CR([(a[0], a[2]) for a in k]),
                     CR([(a[0], math.log(a[3])) for a in k], limit=1.6), CR([(a[0], a[4]) for a in k], limit=1.2)]
        f = sorted(self.focus_keys)
        self._foc = [CR([(a[0], a[i]) for a in f], limit=1.5) for i in (1, 2, 3, 4)] if f else None

    def camera(self, t):
        if self._cam is None:
            self._build()
        x, y, lz, r = (s(t) for s in self._cam)
        z = math.exp(lz)
        g = self._wobble_gain(t)
        hx = g * (7 * math.sin(t * 0.83 + 1.3) + 4 * math.sin(t * 1.71 + 0.2) + 2.5 * math.sin(t * 3.3))
        hy = g * (6 * math.sin(t * 0.67 + 2.1) + 3.5 * math.sin(t * 1.93 + 1.1) + 2 * math.sin(t * 2.9 + 0.5))
        hr = g * (0.12 * math.sin(t * 0.51 + 0.4) + 0.05 * math.sin(t * 1.37))
        for (ts, amp, dur) in self.shakes:
            if ts <= t < ts + dur:
                u = (t - ts) / dur
                e = amp * (1 - u) ** 2
                hx += e * math.sin(u * 60)
                hy += e * math.cos(u * 47)
        d = self.drift * g
        fx = d * (26 * math.sin(t * 0.23 + 0.7) + 14 * math.sin(t * 0.41 + 2.2))
        fy = d * (18 * math.sin(t * 0.19 + 1.9) + 10 * math.sin(t * 0.37 + 0.3))
        z *= 1 + self.drift * 0.012 * math.sin(t * 0.29 + 0.5)
        r += d * 0.25 * math.sin(t * 0.17 + 1.0)
        return x + (hx + fx) / z, y + (hy + fy) / z, z, r + hr

    def spotlight_lint(self) -> list[str]:
        """ST-BLK-06: one spotlight target per beat; flags focus keys closer than 0.25 s."""
        ks = sorted(self.focus_keys)
        return [f"two spotlight keys within 0.25 s at t={b[0]:.2f}" for a, b in zip(ks, ks[1:])
                if b[0] - a[0] < 0.25 and (abs(a[1] - b[1]) > 1 or abs(a[2] - b[2]) > 1)]


def keys_on_words(film: Film, clock, keys: list[tuple]) -> None:
    """Camera keys anchored to spoken words: [(line_id, word, x, y, zoom[, nth][, radius])].
    Uses the word clock, so a missing word raises (ST-BLK-02)."""
    for k in keys:
        line, word, x, y, zoom = k[:5]
        nth = k[5] if len(k) > 5 else 0
        radius = k[6] if len(k) > 6 else None
        film.shot(clock.W(line, word, nth), x, y, zoom, radius=radius)
