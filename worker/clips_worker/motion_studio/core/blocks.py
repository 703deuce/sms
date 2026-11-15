"""Part 1 / ST-BLK-07..16: shared, named, parameterised blocks (called by name, never re-implemented per film).

Every text draw goes through `text()`: the 40 px cap-height gate (fades rather than renders smaller),
the 30 px edge fade, and the audit hook used by QA A5/A18 (ST-BLK-15, ST-RW-007).
Backgrounds here are generic procedural *systems* (grid, particles, noise, gradient); the subject-specific
world is composed from them per video in Part 2.
"""
from __future__ import annotations

import math
import random

import numpy as np
import skia

from clips_worker.motion_studio.vendor.cinematic_skill import engine as E
from clips_worker.motion_studio.vendor.cinematic_skill.engine import (  # noqa: F401  (re-exported to scene code)
    SAMPLING, Item, clamp, color, draw_text, ease_in_out, ease_out_back, ease_out_cubic, paint, partial_path, ramp,
    rot_point, text_width, BigText, Counter, MapPin, Route, StringLine, PenMark, Stamp, Card, PaperDoc, DotField,
    XMarker, FilmFrame,
)
from clips_worker.motion_studio.core.world import HOUSE

CAP = {"anton": 0.72, "cond": 0.72, "mono": 0.70, "label": 0.72, "labelm": 0.72, "serif": 0.66, "hand": 0.6}
AUDIT: list[dict] = []          # filled when AUDIT_ON[0]; read by the sandbox runner (QA A5 / A18)
AUDIT_ON = [False]


def zoom_of(res) -> float:
    return res.screen_scale / max(1e-6, res.scale)


def legible(res, size: float, font: str = "label") -> float:
    """1 when cap height >= 40 px at 1080p, fading to 0 just below it."""
    px = size * CAP.get(font, 0.72) * zoom_of(res) * 0.5
    m = HOUSE["min_cap_px"]
    return clamp((px - m * 0.92) / (m * 0.08))


def edge_alpha(c, rect) -> float:
    r = c.getTotalMatrix().mapRect(rect)
    Wd, Hd = c.imageInfo().width(), c.imageInfo().height()
    d = min(r.left(), r.top(), Wd - r.right(), Hd - r.bottom())
    return clamp(d / (HOUSE["edge_ramp_px"] * Hd / 1080))


def text(c, res, s: str, x: float, y: float, size: float, font: str = "label", rgb=(240, 240, 240), a: float = 1.0,
         track: float = 0.0, align: str = "left", reveal=None, check: bool = True, glow: float = 0.0, edge: bool = True):
    """Safe text: legibility gate + edge fade + audit. Returns the text width (world units)."""
    tw = text_width(res, s, size, font, track)
    x0 = x - tw / 2 if align == "center" else x - tw if align == "right" else x
    if check:
        lg = legible(res, size, font)
        if AUDIT_ON[0] and a > 0.25 and lg < 0.5:
            AUDIT.append({"text": s[:80], "capPx": round(size * CAP.get(font, 0.72) * zoom_of(res) * 0.5, 1), "cut": False,
                          "hidden": True, "a": round(a, 2)})
        a *= lg
    if a <= 0.003:
        return tw
    if edge:
        a *= edge_alpha(c, skia.Rect.MakeLTRB(x0, y - size * 0.8, x0 + tw, y + size * 0.15))
        if a <= 0.003:
            return tw
    if AUDIT_ON[0] and a > 0.25:
        r = c.getTotalMatrix().mapRect(skia.Rect.MakeLTRB(x0, y - size * CAP.get(font, 0.72), x0 + tw, y))
        Wd, Hd = c.imageInfo().width(), c.imageInfo().height()
        inside = r.left() >= 0 and r.top() >= 0 and r.right() <= Wd and r.bottom() <= Hd
        visible = r.right() > 0 and r.bottom() > 0 and r.left() < Wd and r.top() < Hd
        if visible:
            AUDIT.append({"text": s[:80], "capPx": round(r.height() * 1080 / Hd, 1), "cut": not inside, "a": round(a, 2)})
    if glow > 0:
        f = res.font(font, size)
        c.drawString(s if reveal is None else s[:int(reveal)], x0, y, f, paint(rgb, a * glow, blur=size * 0.18))
    draw_text(c, res, s, x, y, size, font, rgb, a, track, align, reveal)
    return tw


def spring(t: float, t0: float, dur: float = 0.55) -> float:
    return ease_out_back(ramp(t, t0, dur), 1.25)


def rrect(x, y, w, h, r):
    return skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), r, r)


def hexrgb(v, default=(240, 240, 240)):
    if isinstance(v, (list, tuple)) and len(v) >= 3:
        return tuple(int(x) for x in v[:3])
    if isinstance(v, str):
        s = v.strip().lstrip("#")
        if len(s) == 6:
            try:
                return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                return default
    return default


def _fade_window(t, t_in, t_out, fin=0.25, fout=0.35):
    a = ramp(t, t_in, fin)
    if t_out is not None:
        a *= 1 - ramp(t, t_out - fout, fout)
    return a


# ------------------------------------------------------------------ look.finish (ST-BLK-14)
def look_from_style(style: dict | None) -> dict:
    """LOOK dict for StudioFilm from the per-video style spec (palette + look fields)."""
    style = style or {}
    pal = style.get("palette") or {}
    look = style.get("look") or {}
    if isinstance(look, str):
        look = {"name": look}
    bg = hexrgb(pal.get("bg") or pal.get("background"), (10, 11, 14))
    out = {
        "bg": bg,
        "grade": tuple(look.get("grade") or (1.0, 1.0, 1.0)),
        "grain": float(look.get("grain", 0.022)),
        "glow": float(look.get("glow", 0.2)),
        "vignette": float(look.get("vignette", 0.65)),
        "curve": float(look.get("curve", 0.22)),
        "dim": hexrgb(pal.get("dim"), tuple(max(0, v // 3) for v in bg)),
    }
    return out


def per_frame_grain(renderer) -> None:
    """Refresh grain every frame (the engine refreshes every 2nd: reads as a 15 fps stutter, R1 fix)."""
    cls = type(renderer)
    if getattr(cls, "_studio_pf", False):
        return
    orig = cls.post

    def post(self, img, n):
        if not hasattr(self, "_grain_all"):
            orig(self, img, n)
            self._grain_all = list(self._grain)
        g = list(self._grain_all)
        g[((n // 2) * 7) % len(g)] = self._grain_all[(n * 3) % len(g)]
        self._grain = g
        return orig(self, img, n)

    cls.post = post
    cls._studio_pf = True


# ------------------------------------------------------------------ procedural background systems (ST-COMP-001)
class GradientField(Item):
    """Full-world radial/linear wash (background layer)."""

    def __init__(self, colors, center=(0, 0), radius=12000, z=-900, linear=False, angle=90.0):
        super().__init__(t_in=-1e9, t_out=1e9, z=z, sfx=False)
        self.colors = [hexrgb(c) for c in colors]
        self.center, self.radius, self.linear, self.angle = center, radius, linear, angle

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        cols = [skia.Color(*rgb) for rgb in self.colors]
        cx, cy = self.center
        if self.linear:
            a = math.radians(self.angle)
            dx, dy = math.cos(a) * self.radius, math.sin(a) * self.radius
            sh = skia.GradientShader.MakeLinear([skia.Point(cx - dx, cy - dy), skia.Point(cx + dx, cy + dy)], cols)
        else:
            sh = skia.GradientShader.MakeRadial(skia.Point(cx, cy), self.radius, cols)
        p = skia.Paint()
        p.setShader(sh)
        c.drawRect(res.view, p)


class GridField(Item):
    """Infinite grid (minor + major lines) that only draws what is in view."""

    def __init__(self, spacing=400, rgb=(255, 255, 255), alpha=0.06, major=5, width=2.0, z=-800, t_in=-1e9, t_out=None):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=False)
        self.spacing, self.rgb, self.alpha, self.major, self.width = spacing, hexrgb(rgb), alpha, major, width

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        v = res.view
        a = self.alpha * ramp(t, self.t_in, 0.6) if self.t_in > -1e8 else self.alpha
        sp = self.spacing
        k = max(1, int(math.ceil((v.width() / sp) / 160)))   # thin out when zoomed far out
        sp *= k
        x = math.floor(v.left() / sp) * sp
        while x < v.right():
            maj = round(x / sp) % self.major == 0
            c.drawLine(x, v.top(), x, v.bottom(), paint(self.rgb, a * (1.8 if maj else 1.0), stroke=self.width * (1.6 if maj else 1)))
            x += sp
        y = math.floor(v.top() / sp) * sp
        while y < v.bottom():
            maj = round(y / sp) % self.major == 0
            c.drawLine(v.left(), y, v.right(), y, paint(self.rgb, a * (1.8 if maj else 1.0), stroke=self.width * (1.6 if maj else 1)))
            y += sp


class ParticleDrift(Item):
    """Seeded slow-drifting particles over an area (deterministic: ST-SBX-005)."""

    def __init__(self, area=(-8000, -5000, 16000, 10000), n=160, rgb=(255, 255, 255), alpha=0.25, r=(6, 26), speed=40.0,
                 seed=3, z=-700, blur=0.0):
        super().__init__(t_in=-1e9, t_out=1e9, z=z, sfx=False)
        rng = random.Random(seed)
        x, y, w, h = area
        self.area = area
        self.pts = [(x + rng.random() * w, y + rng.random() * h, rng.uniform(*r), rng.uniform(0, 6.283), rng.uniform(0.4, 1.0))
                    for _ in range(n)]
        self.rgb, self.alpha, self.speed, self.blur = hexrgb(rgb), alpha, speed, blur

    def bounds(self, res):
        x, y, w, h = self.area
        return skia.Rect.MakeXYWH(x - 200, y - 200, w + 400, h + 400)

    def draw(self, c, res, t):
        x0, y0, w, h = self.area
        for (x, y, r, ph, sp) in self.pts:
            px = x0 + (x - x0 + math.sin(t * 0.21 * sp + ph) * self.speed * 3 + t * self.speed * sp) % w
            py = y0 + (y - y0 + math.cos(t * 0.17 * sp + ph) * self.speed * 2) % h
            a = self.alpha * (0.55 + 0.45 * math.sin(t * 0.9 * sp + ph))
            c.drawCircle(px, py, r, paint(self.rgb, a, blur=self.blur or None))


class NoiseTexture(Item):
    """Tiled seeded value-noise texture (paper, concrete, film base) at low alpha."""

    def __init__(self, seed=5, alpha=0.08, tile=2048, rgb=(255, 255, 255), z=-850, scale=6):
        super().__init__(t_in=-1e9, t_out=1e9, z=z, sfx=False)
        self.seed, self.alpha, self.tile, self.rgb, self.scale = seed, alpha, tile, hexrgb(rgb), scale
        self._img = None

    def bounds(self, res):
        return None

    def _image(self):
        if self._img is None:
            rng = np.random.default_rng(self.seed)
            n = 256
            base = rng.random((n // self.scale + 2, n // self.scale + 2)).astype(np.float32)
            from PIL import Image, ImageFilter
            im = Image.fromarray((base * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
            arr = np.asarray(im, np.float32) / 255.0
            fine = rng.random((n, n)).astype(np.float32)
            v = np.clip(arr * 0.75 + fine * 0.25, 0, 1)
            rgba = np.zeros((n, n, 4), np.uint8)
            rgba[..., 0], rgba[..., 1], rgba[..., 2] = self.rgb
            rgba[..., 3] = (v * 255).astype(np.uint8)
            self._img = skia.Image.fromarray(rgba, colorType=skia.ColorType.kRGBA_8888_ColorType)
        return self._img

    def draw(self, c, res, t):
        img = self._image()
        v = res.view
        p = skia.Paint(Alphaf=self.alpha)
        ts = self.tile
        x = math.floor(v.left() / ts) * ts
        n = 0
        while x < v.right() and n < 400:
            y = math.floor(v.top() / ts) * ts
            while y < v.bottom() and n < 400:
                c.drawImageRect(img, skia.Rect.MakeXYWH(x, y, ts, ts), SAMPLING, p)
                y += ts
                n += 1
            x += ts


# ------------------------------------------------------------------ type.hero_slam (ST-BLK-07)
class HeroSlam(Item):
    """Big display type that lands on the word: fast scale/alpha spring + impact cue. Optional per-word
    reveal: words=[(text, t), ...] (times from the word clock)."""

    def __init__(self, s, x, y, size, t_in, t_out=None, font="cond", rgb=(245, 245, 245), glow=0.4, track=0.02,
                 align="center", words=None, color_per_word=None, hit_gain=0.9, z=50, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.s, self.x, self.y, self.size, self.font = s, x, y, size, font
        self.rgb, self.glow, self.track, self.align = hexrgb(rgb), glow, track, align
        self.words, self.cpw, self.hit_gain = words, color_per_word, hit_gain

    def bounds(self, res):
        w = text_width(res, self.s, self.size, self.font, self.track)
        return skia.Rect.MakeXYWH(self.x - w, self.y - self.size * 1.5, w * 2, self.size * 2.2)

    def cues(self):
        if self.words:
            return [("impact", t, self.hit_gain * 0.8, {}) for _, t in self.words]
        return [("impact", self.t_in, self.hit_gain, {})]

    def draw(self, c, res, t):
        fade = 1.0 if self.t_out is None else 1 - ramp(t, self.t_out - 0.3, 0.3)
        if not self.words:
            k = spring(t, self.t_in, 0.4)
            a = ramp(t, self.t_in, 0.12) * fade
            sc = 1.35 - 0.35 * k
            c.save()
            c.translate(self.x, self.y)
            c.scale(sc, sc)
            text(c, res, self.s, 0, 0, self.size, self.font, self.rgb, a, self.track, self.align, glow=self.glow)
            c.restore()
            return
        total = sum(text_width(res, w + " ", self.size, self.font, self.track) for w, _ in self.words)
        x = self.x - total / 2 if self.align == "center" else self.x
        for i, (w, tw) in enumerate(self.words):
            k = spring(t, tw, 0.35)
            a = ramp(t, tw, 0.1) * fade
            wd = text_width(res, w + " ", self.size, self.font, self.track)
            rgb = hexrgb(self.cpw[i]) if self.cpw and i < len(self.cpw) else self.rgb
            c.save()
            c.translate(x + wd / 2, self.y)
            sc = 1.3 - 0.3 * k
            c.scale(sc, sc)
            text(c, res, w, 0, 0, self.size, self.font, rgb, a, self.track, "center", glow=self.glow)
            c.restore()
            x += wd


# ------------------------------------------------------------------ data.rolling_number (ST-BLK-08)
class RollingNumber(Item):
    """Counts v0 -> v1 and lands exactly on the spoken word (t_land); never shows a stray value after it."""

    def __init__(self, x, y, size, v0, v1, t_in, t_land, fmt="{:,.0f}", prefix="", suffix="", caption=None,
                 rgb=(245, 245, 245), font="cond", t_out=None, source=None, z=60, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.x, self.y, self.size, self.v0, self.v1, self.t_land = x, y, size, float(v0), float(v1), max(t_in + 0.05, t_land)
        self.fmt, self.prefix, self.suffix, self.caption, self.rgb, self.font = fmt, prefix, suffix, caption, hexrgb(rgb), font
        self.source = source            # provenance id (ST-RW-003)

    def bounds(self, res):
        return skia.Rect.MakeXYWH(self.x - self.size * 5, self.y - self.size * 1.4, self.size * 10, self.size * 2.6)

    def cues(self):
        return [("ticks", self.t_in, 0.5, {}), ("impact", self.t_land, 0.85, {})]

    def value(self, t):
        if t >= self.t_land:
            return self.v1
        u = ease_out_cubic(clamp((t - self.t_in) / (self.t_land - self.t_in)))
        return self.v0 + (self.v1 - self.v0) * u

    def draw(self, c, res, t):
        a = _fade_window(t, self.t_in, self.t_out, 0.15)
        s = self.prefix + self.fmt.format(self.value(t)) + self.suffix
        pop = 1 + 0.08 * (1 - ramp(t, self.t_land, 0.25)) * (t >= self.t_land)
        c.save()
        c.translate(self.x, self.y)
        c.scale(pop, pop)
        text(c, res, s, 0, 0, self.size, self.font, self.rgb, a, 0.01, "center", glow=0.35)
        c.restore()
        if self.caption:
            text(c, res, self.caption, self.x, self.y + self.size * 0.62, self.size * 0.28, "label", self.rgb, a * 0.85,
                 0.08, "center")


# ------------------------------------------------------------------ label.callout (ST-BLK-10)
class Callout(Item):
    """Short mono label that types on next to a point, with a leader line and a dot."""

    def __init__(self, s, x, y, t_in, t_out=None, side="right", size=96, rgb=(245, 245, 245), accent=(255, 196, 0),
                 font="mono", length=420, z=70, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.s, self.x, self.y, self.side, self.size = s, x, y, side, size
        self.rgb, self.accent, self.font, self.length = hexrgb(rgb), hexrgb(accent), font, length

    def bounds(self, res):
        w = text_width(res, self.s, self.size, self.font) + self.length + 200
        return skia.Rect.MakeXYWH(self.x - w, self.y - self.size * 2, w * 2, self.size * 4)

    def cues(self):
        return [("pop", self.t_in, 0.5, {})]

    def draw(self, c, res, t):
        a = _fade_window(t, self.t_in, self.t_out, 0.12)
        d = 1 if self.side == "right" else -1
        u = ease_out_cubic(ramp(t, self.t_in, 0.35))
        c.drawCircle(self.x, self.y, 14 + 6 * (1 - u), paint(self.accent, a))
        ex = self.x + d * self.length * u
        c.drawLine(self.x, self.y, ex, self.y - self.size * 0.35 * u, paint(self.accent, a, stroke=6))
        n = len(self.s) * ramp(t, self.t_in + 0.2, max(0.2, len(self.s) * 0.025))
        text(c, res, self.s, ex + d * 30, self.y - self.size * 0.35, self.size, self.font, self.rgb, a, 0.04,
             "left" if d > 0 else "right", reveal=n)


# ------------------------------------------------------------------ emphasis.mark (ST-BLK-11)
class EmphasisMark(Item):
    """One gesture of emphasis on the beat word: 'circle' | 'underline' | 'flash' | 'stamp'."""

    def __init__(self, kind, x, y, w, h, t, rgb=(255, 64, 64), dur=0.5, t_out=None, label="", z=80, sfx=True):
        super().__init__(t_in=t, t_out=t_out, z=z, sfx=sfx)
        self.kind, self.x, self.y, self.w, self.h, self.rgb, self.dur, self.label = kind, x, y, w, h, hexrgb(rgb), dur, label

    def bounds(self, res):
        return skia.Rect.MakeXYWH(self.x - self.w, self.y - self.h, self.w * 2, self.h * 2)

    def cues(self):
        return [({"circle": "pencil", "underline": "marker", "flash": "shimmer", "stamp": "stamp"}.get(self.kind, "pop"),
                 self.t_in, 0.6, {})]

    def draw(self, c, res, t):
        a = _fade_window(t, self.t_in, self.t_out, 0.05)
        u = ease_out_cubic(ramp(t, self.t_in, self.dur))
        if self.kind == "circle":
            path = skia.Path()
            path.addOval(skia.Rect.MakeXYWH(self.x - self.w / 2, self.y - self.h / 2, self.w, self.h))
            c.drawPath(partial_path(path, u), paint(self.rgb, a, stroke=max(8, self.h * 0.06)))
        elif self.kind == "underline":
            c.drawLine(self.x - self.w / 2, self.y, self.x - self.w / 2 + self.w * u, self.y, paint(self.rgb, a, stroke=max(8, self.h * 0.1)))
        elif self.kind == "flash":
            r = self.w * (0.4 + 0.9 * u)
            c.drawCircle(self.x, self.y, r, paint(self.rgb, a * (1 - u) * 0.9, stroke=max(6, self.w * 0.03)))
        else:
            sc = 1.6 - 0.6 * spring(t, self.t_in, 0.25)
            c.save()
            c.translate(self.x, self.y)
            c.rotate(-8)
            c.scale(sc, sc)
            c.drawRRect(rrect(-self.w / 2, -self.h / 2, self.w, self.h, 12), paint(self.rgb, a, stroke=10))
            if self.label:
                text(c, res, self.label, 0, self.h * 0.18, self.h * 0.5, "cond", self.rgb, a, 0.06, "center")
            c.restore()


# ------------------------------------------------------------------ connector (ST-BLK-12)
class Connector(Item):
    """Curved line between two world points that draws on; endpoints stay attached (world space)."""

    def __init__(self, a, b, t_in, dur=0.8, bend=0.18, width=8, rgb=(245, 245, 245), t_out=None, dashed=False, z=40, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.a, self.b, self.dur, self.bend, self.width, self.rgb, self.dashed = a, b, dur, bend, width, hexrgb(rgb), dashed

    def bounds(self, res):
        x0, y0 = self.a
        x1, y1 = self.b
        pad = abs(self.bend) * math.hypot(x1 - x0, y1 - y0) + 100
        return skia.Rect.MakeLTRB(min(x0, x1) - pad, min(y0, y1) - pad, max(x0, x1) + pad, max(y0, y1) + pad)

    def cues(self):
        return [("whoosh", self.t_in, 0.4, {})]

    def draw(self, c, res, t):
        x0, y0 = self.a
        x1, y1 = self.b
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        nx, ny = -(y1 - y0), (x1 - x0)
        p = skia.Path()
        p.moveTo(x0, y0)
        p.quadTo(mx + nx * self.bend, my + ny * self.bend, x1, y1)
        u = ease_in_out(ramp(t, self.t_in, self.dur))
        pt = paint(self.rgb, _fade_window(t, self.t_in, self.t_out, 0.05), stroke=self.width)
        if self.dashed:
            pt.setPathEffect(skia.DashPathEffect.Make([self.width * 4, self.width * 3], 0))
        c.drawPath(partial_path(p, u), pt)


# ------------------------------------------------------------------ field.spread (ST-BLK-13)
class FieldSpread(Item):
    """Many points appearing over [t0, t1] to show scale or spread (seeded, deterministic)."""

    def __init__(self, points, t0, t1, rgb=(255, 80, 60), r=18, seed=11, t_out=None, z=30, sfx=True):
        super().__init__(t_in=t0, t_out=t_out, z=z, sfx=sfx)
        rng = random.Random(seed)
        pts = list(points)
        self.order = [(x, y, t0 + (t1 - t0) * rng.random()) for x, y in pts]
        self.rgb, self.r = hexrgb(rgb), r
        xs = [p[0] for p in pts] or [0]
        ys = [p[1] for p in pts] or [0]
        self._b = skia.Rect.MakeLTRB(min(xs) - r * 4, min(ys) - r * 4, max(xs) + r * 4, max(ys) + r * 4)

    def bounds(self, res):
        return self._b

    def cues(self):
        return [("shimmer", self.t_in, 0.4, {})]

    def draw(self, c, res, t):
        fo = 1.0 if self.t_out is None else 1 - ramp(t, self.t_out - 0.3, 0.3)
        for x, y, ta in self.order:
            if t < ta:
                continue
            u = ramp(t, ta, 0.25)
            c.drawCircle(x, y, self.r * (0.4 + 0.6 * ease_out_back(u)), paint(self.rgb, u * fo))


# ------------------------------------------------------------------ surface.photo_frame (ST-BLK-09)
class PhotoFrame(Item):
    """A photo (or video still) placed in the world with a skin: 'print' | 'glass' | 'tv' | 'filmstrip' | 'plain'.
    Implements the handoff surface placement (the handoff module maps clip frames onto the same rect).
    Never upscales beyond the source resolution (A16): w is clamped to the image's pixel width x 2 (4K world)."""

    def __init__(self, key, x, y, w, rot=0.0, t_in=0.0, t_out=None, skin="print", title="", label="", label_t=None,
                 crop=None, z=20, sfx=True, accent=(255, 196, 0)):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.key, self.x, self.y, self.w, self.rot, self.skin = key, x, y, w, rot, skin
        self.title, self.label, self.label_t, self.crop, self.accent = title, label, label_t, crop, hexrgb(accent)
        self._size = None

    def size(self, res):
        if self._size is None:
            img = res.image(self.key)
            iw, ih = img.width(), img.height()
            meta = (res.meta or {}).get(self.key) if hasattr(res, "meta") else None
            src_w = (meta or {}).get("w", iw / max(res.scale, 0.35))
            w = min(self.w, float(src_w) * 2.0)
            if self.crop:
                cx0, cy0, cx1, cy1 = self.crop
                ar = (iw * (cx1 - cx0)) / max(1, ih * (cy1 - cy0))
            else:
                ar = iw / max(1, ih)
            self._size = (w, w / ar)
        return self._size

    def bounds(self, res):
        w, h = self.size(res)
        r = math.hypot(w, h) * 0.7 + 200
        return skia.Rect.MakeXYWH(self.x - r, self.y - r, 2 * r, 2 * r)

    def cues(self):
        return [("pop" if self.skin in ("print", "plain") else "slide", self.t_in, 0.6, {})]

    def draw(self, c, res, t):
        w, h = self.size(res)
        a = _fade_window(t, self.t_in, self.t_out, 0.2)
        k = spring(t, self.t_in, 0.5)
        drop = (1 - k) * 220
        img = res.image(self.key)
        c.save()
        c.translate(self.x, self.y - drop)
        c.rotate(self.rot)
        sc = 0.92 + 0.08 * k
        c.scale(sc, sc)
        dst = skia.Rect.MakeXYWH(-w / 2, -h / 2, w, h)
        if self.skin == "print":
            b = w * 0.035
            c.drawRect(skia.Rect.MakeXYWH(-w / 2 - b + 30, -h / 2 - b + 40, w + 2 * b, h + 2 * b), paint((0, 0, 0), a * 0.45, blur=60))
            c.drawRect(skia.Rect.MakeXYWH(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b * 1.8), paint((246, 243, 236), a))
        elif self.skin in ("tv", "glass"):
            b = w * (0.05 if self.skin == "tv" else 0.02)
            c.drawRRect(rrect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, b * 0.8), paint((0, 0, 0), a * 0.5, blur=70))
            c.drawRRect(rrect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, b * 0.8),
                        paint((18, 18, 20) if self.skin == "tv" else (255, 255, 255), a * (1.0 if self.skin == "tv" else 0.12)))
        elif self.skin == "filmstrip":
            b = h * 0.12
            c.drawRect(skia.Rect.MakeXYWH(-w / 2 - b * 0.4, -h / 2 - b, w + b * 0.8, h + 2 * b), paint((14, 12, 10), a))
            n = max(4, int(w / (b * 0.9)))
            for i in range(n):
                hx = -w / 2 + (i + 0.3) * w / n
                for yy in (-h / 2 - b * 0.7, h / 2 + b * 0.3):
                    c.drawRRect(rrect(hx, yy, b * 0.45, b * 0.4, 6), paint((235, 230, 220), a * 0.85))
        src = None
        if self.crop:
            iw, ih = img.width(), img.height()
            cx0, cy0, cx1, cy1 = self.crop
            src = skia.Rect.MakeLTRB(cx0 * iw, cy0 * ih, cx1 * iw, cy1 * ih)
        p = skia.Paint(Alphaf=a)
        if src is not None:
            c.drawImageRect(img, src, dst, SAMPLING, p)
        else:
            c.drawImageRect(img, dst, SAMPLING, p)
        if self.skin in ("tv", "glass"):
            g = skia.GradientShader.MakeLinear([skia.Point(-w / 2, -h / 2), skia.Point(w / 2, h / 2)],
                                               [skia.Color(255, 255, 255, int(40 * a)), skia.Color(255, 255, 255, 0)])
            gp = skia.Paint()
            gp.setShader(g)
            c.drawRect(dst, gp)
        if self.title:
            text(c, res, self.title, 0, h / 2 + w * 0.06, max(60, w * 0.045), "label", (30, 28, 26) if self.skin == "print" else (240, 240, 240), a, 0.04, "center")
        c.restore()
        if self.label:
            lt = self.label_t if self.label_t is not None else self.t_in + 0.4
            Callout(self.label, self.x + w * 0.45, self.y - h * 0.45, lt, self.t_out, accent=self.accent).draw(c, res, t)


class Panel(Item):
    """Glass window (title bar + glow border) that springs in; `content(c, res, t, w, h, a)` draws inside."""

    def __init__(self, x, y, w, h, t_in, title="", content=None, t_out=None, accent=(90, 200, 255), rot=0.0, z=25, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.x, self.y, self.w, self.h, self.title, self.content, self.accent, self.rot = x, y, w, h, title, content, hexrgb(accent), rot

    def bounds(self, res):
        r = math.hypot(self.w, self.h) * 0.6 + 200
        return skia.Rect.MakeXYWH(self.x - r, self.y - r, 2 * r, 2 * r)

    def cues(self):
        return [("pop", self.t_in, 0.55, {})]

    def draw(self, c, res, t):
        a = _fade_window(t, self.t_in, self.t_out, 0.18)
        k = spring(t, self.t_in, 0.5)
        c.save()
        c.translate(self.x, self.y)
        c.rotate(self.rot)
        c.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k)
        w, h = self.w, self.h
        c.drawRRect(rrect(-w / 2, -h / 2, w, h, 36), paint((0, 0, 0), a * 0.5, blur=80))
        c.drawRRect(rrect(-w / 2, -h / 2, w, h, 36), paint((16, 20, 28), a * 0.88))
        c.drawRRect(rrect(-w / 2, -h / 2, w, h, 36), paint(self.accent, a * 0.6, stroke=5))
        bar = min(140, h * 0.12)
        c.drawRect(skia.Rect.MakeXYWH(-w / 2 + 2, -h / 2 + 2, w - 4, bar), paint((255, 255, 255), a * 0.06))
        if self.title:
            text(c, res, self.title, -w / 2 + 50, -h / 2 + bar * 0.68, bar * 0.5, "label", (235, 238, 245), a, 0.03)
        if self.content:
            c.save()
            c.clipRect(skia.Rect.MakeXYWH(-w / 2, -h / 2 + bar, w, h - bar))
            c.translate(-w / 2, -h / 2 + bar)
            self.content(c, res, t, w, h - bar, a)
            c.restore()
        c.restore()


# ------------------------------------------------------------------ chart primitives (data on the world canvas)
class LineSeries(Item):
    """Polyline that reveals left-to-right between t0 and t1 (world points), with an optional glowing tip."""

    def __init__(self, pts, t0, t1, rgb=(60, 220, 130), width=14, t_out=None, tip=True, fill_to=None, z=35, sfx=True):
        super().__init__(t_in=t0, t_out=t_out, z=z, sfx=sfx)
        self.pts, self.t1, self.rgb, self.width, self.tip, self.fill_to = list(pts), t1, hexrgb(rgb), width, tip, fill_to
        xs = [p[0] for p in self.pts] or [0]
        ys = [p[1] for p in self.pts] or [0]
        self._b = skia.Rect.MakeLTRB(min(xs) - 300, min(ys) - 300, max(xs) + 300, max(ys) + 300)

    def bounds(self, res):
        return self._b

    def cues(self):
        return [("whoosh", self.t_in, 0.35, {})]

    def tip_at(self, t):
        u = ease_in_out(ramp(t, self.t_in, max(0.05, self.t1 - self.t_in)))
        n = len(self.pts)
        if n < 2:
            return self.pts[0] if self.pts else (0, 0)
        f = u * (n - 1)
        i = min(n - 2, int(f))
        r = f - i
        (x0, y0), (x1, y1) = self.pts[i], self.pts[i + 1]
        return x0 + (x1 - x0) * r, y0 + (y1 - y0) * r

    def draw(self, c, res, t):
        if len(self.pts) < 2:
            return
        a = _fade_window(t, self.t_in, self.t_out, 0.05)
        u = ease_in_out(ramp(t, self.t_in, max(0.05, self.t1 - self.t_in)))
        n = len(self.pts)
        f = u * (n - 1)
        k = int(f)
        path = skia.Path()
        path.moveTo(*self.pts[0])
        for p in self.pts[1:k + 1]:
            path.lineTo(*p)
        tx, ty = self.tip_at(t)
        path.lineTo(tx, ty)
        if self.fill_to is not None:
            fp = skia.Path(path)
            fp.lineTo(tx, self.fill_to)
            fp.lineTo(self.pts[0][0], self.fill_to)
            fp.close()
            c.drawPath(fp, paint(self.rgb, a * 0.12))
        c.drawPath(path, paint(self.rgb, a * 0.35, stroke=self.width * 2.5, blur=self.width))
        c.drawPath(path, paint(self.rgb, a, stroke=self.width))
        if self.tip:
            c.drawCircle(tx, ty, self.width * 1.6, paint(self.rgb, a))
            c.drawCircle(tx, ty, self.width * 4, paint(self.rgb, a * 0.25, blur=self.width * 2))


class BarSeries(Item):
    """Bars growing from a baseline, staggered; values are world heights already mapped by an axis."""

    def __init__(self, xs, heights, base_y, width, t0, stagger=0.08, rgb=(255, 196, 0), t_out=None, labels=None, z=35, sfx=True):
        super().__init__(t_in=t0, t_out=t_out, z=z, sfx=sfx)
        self.xs, self.hs, self.base, self.width, self.stagger, self.rgb, self.labels = xs, heights, base_y, width, stagger, hexrgb(rgb), labels

    def bounds(self, res):
        return skia.Rect.MakeLTRB(min(self.xs) - self.width, self.base - max(self.hs) - 300, max(self.xs) + self.width, self.base + 300)

    def cues(self):
        return [("pop", self.t_in + i * self.stagger, 0.3, {}) for i in range(min(6, len(self.xs)))]

    def draw(self, c, res, t):
        a = _fade_window(t, self.t_in, self.t_out, 0.05)
        for i, (x, h) in enumerate(zip(self.xs, self.hs)):
            u = ease_out_back(ramp(t, self.t_in + i * self.stagger, 0.45), 1.1)
            c.drawRect(skia.Rect.MakeLTRB(x - self.width / 2, self.base - h * u, x + self.width / 2, self.base), paint(self.rgb, a))
            if self.labels and i < len(self.labels) and u > 0.5:
                text(c, res, str(self.labels[i]), x, self.base + 110, 90, "label", (235, 235, 235), a * u, 0.02, "center")


# ------------------------------------------------------------------ screen-space blocks (lower thirds, chapter cards)
class ScreenItem(Item):
    """Drawn in output-pixel space (1080p-relative units), independent of the camera."""

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        c.save()
        c.resetMatrix()
        H = c.imageInfo().height()
        s = H / 1080.0
        c.scale(s, s)
        # text() measures zoom from res.screen_scale; temporarily set it so 1 unit == 1 px at 1080p
        prev = res.screen_scale
        res.screen_scale = res.scale * 2.0
        try:
            self.draw_screen(c, res, t, c.imageInfo().width() / s, 1080.0)
        finally:
            res.screen_scale = prev
            c.restore()

    def draw_screen(self, c, res, t, W, H):
        raise NotImplementedError


class LowerThird(ScreenItem):
    def __init__(self, name, role="", t_in=0.0, t_out=None, accent=(255, 196, 0), rgb=(245, 245, 245), z=200, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.name, self.role, self.accent, self.rgb = name, role, hexrgb(accent), hexrgb(rgb)

    def cues(self):
        return [("slide", self.t_in, 0.4, {})]

    def draw_screen(self, c, res, t, W, H):
        a = _fade_window(t, self.t_in, self.t_out, 0.3)
        u = ease_out_cubic(ramp(t, self.t_in, 0.45))
        x, y = 110 - 60 * (1 - u), H - 210
        c.drawRect(skia.Rect.MakeXYWH(x - 26, y - 64, 10, 120), paint(self.accent, a))
        text(c, res, self.name, x, y, 64, "label", self.rgb, a, 0.02)
        if self.role:
            text(c, res, self.role, x, y + 56, 42, "labelm", self.rgb, a * 0.8, 0.04)


class ChapterCard(ScreenItem):
    def __init__(self, number, title, t_in, t_out, accent=(255, 196, 0), rgb=(245, 245, 245), z=210, sfx=True):
        super().__init__(t_in=t_in, t_out=t_out, z=z, sfx=sfx)
        self.number, self.title, self.accent, self.rgb = number, title, hexrgb(accent), hexrgb(rgb)

    def cues(self):
        return [("impact", self.t_in, 0.6, {})]

    def draw_screen(self, c, res, t, W, H):
        a = _fade_window(t, self.t_in, self.t_out, 0.35, 0.5)
        text(c, res, f"CHAPTER {self.number}", W / 2, H / 2 - 70, 46, "labelm", self.accent, a, 0.3, "center")
        text(c, res, self.title.upper(), W / 2, H / 2 + 40, 110, "cond", self.rgb, a, 0.04, "center", glow=0.3)


BLOCK_NAMES = {
    "type.hero_slam": "HeroSlam", "data.rolling_number": "RollingNumber", "label.callout": "Callout",
    "emphasis.mark": "EmphasisMark", "connector": "Connector", "field.spread": "FieldSpread",
    "surface.photo_frame": "PhotoFrame", "look.finish": "look_from_style", "camera.path": "StudioFilm.cam/shot",
    "camera.spotlight": "StudioFilm.focus", "world.canvas": "LinearAxis/mercator", "qa.text_safety": "text",
    "bg.gradient": "GradientField", "bg.grid": "GridField", "bg.particles": "ParticleDrift", "bg.noise": "NoiseTexture",
    "panel": "Panel", "chart.line": "LineSeries", "chart.bars": "BarSeries", "overlay.lower_third": "LowerThird",
    "overlay.chapter_card": "ChapterCard",
}
