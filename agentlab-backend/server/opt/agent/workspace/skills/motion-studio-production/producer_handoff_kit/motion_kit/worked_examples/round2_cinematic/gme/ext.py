"""Extensions to cinematic-film's engine for the GME film (custom code, logged as such).

  OrganicFilm   Film whose camera runs on a non-uniform Catmull-Rom spline (velocity carries through
                keys: arcs instead of straight segments, no dead stops), plus a slow organic drift and
                zoom breathing on top of the engine's handheld wobble. Ease-in/out only at the ends.
  legible()     every custom text fades out rather than render under 40 px cap height at 1080p.
  Panel         glass app window (title bar, glow border) holding a photo or custom UI; springs in.
  CandleChart   the world: GME daily candles (real OHLC), grid, price/date labels, timed reveals.
  PriceTag      live price pill riding the chart tip.
  Hero          slam-in display type (scale + spring, no blur fades), optional per-word timing.
  Roll          big rolling number.
  Reddit/Buy/Particles/ShortArrow/Gem/Flash: story-specific UI and effects.
"""
import bisect, math
import numpy as np
import skia
import engine
from engine import (Film, Item, clamp, draw_text, ease_in_out, ease_out_back, ease_out_cubic, paint, partial_path, ramp,
                    text_width, SAMPLING)

GREEN = (38, 224, 122)
RED = (255, 72, 72)
AMBER = (255, 176, 0)
WHITE = (240, 244, 248)
GREY = (120, 132, 146)
ORANGE = (255, 69, 0)
CAP = {"anton": 0.72, "cond": 0.72, "mono": 0.70, "monom": 0.70, "label": 0.72, "labelm": 0.72}
MIN_CAP_PX = 40.0          # at 1080p
import os
AUDIT_ON = [os.environ.get("GME_AUDIT") == "1"]


def zoom_of(res):
    return res.screen_scale / max(1e-6, res.scale)


def legible(res, size, font="mono"):
    """Alpha factor: 1 when the cap height is >= 40 px at 1080p, fading to 0 just below it."""
    px = size * CAP.get(font, 0.72) * zoom_of(res) * 0.5
    return clamp((px - MIN_CAP_PX * 0.92) / (MIN_CAP_PX * 0.08))


AUDIT = []      # (text, cap px at 1080p, cut by frame edge) for lit text, filled when AUDIT_ON


def edge_alpha(c, rect):
    """1 when the world rect sits inside the frame, ramping to 0 as it reaches the edge (30 px at 1080p)."""
    r = c.getTotalMatrix().mapRect(rect)
    Wd, Hd = c.imageInfo().width(), c.imageInfo().height()
    d = min(r.left(), r.top(), Wd - r.right(), Hd - r.bottom())
    return clamp(d / (30 * Hd / 1080))


def text(c, res, s, x, y, size, font, rgb, a, track=0.0, align="left", reveal=None, check=True, glow=0.0, edge=True):
    if check:
        lg = legible(res, size, font)
        if AUDIT_ON[0] and a > 0.25 and lg < 0.5:      # text the legibility rule is hiding: a layout bug
            m = c.getTotalMatrix().mapRect(skia.Rect.MakeXYWH(x, y, 1, 1))
            if 0 < m.left() < c.imageInfo().width() and 0 < m.top() < c.imageInfo().height():
                AUDIT.append(("[hidden] " + s, round(size * CAP.get(font, 0.72) * c.getTotalMatrix().getScaleX() * 1080 / c.imageInfo().height(), 1), False, round(a, 2)))
        a *= lg
    if a <= 0.003:
        return text_width(res, s, size, font, track)
    if edge:      # never show text cut by the frame: fade it out as it reaches the edge
        tw = text_width(res, s, size, font, track)
        x0 = x - tw / 2 if align == "center" else x - tw if align == "right" else x
        a *= edge_alpha(c, skia.Rect.MakeLTRB(x0, y - size * 0.8, x0 + tw, y + size * 0.15))
        if a <= 0.003:
            return tw
    if AUDIT_ON[0] and a > 0.25:
        tw = text_width(res, s, size, font, track)
        x0 = x - tw / 2 if align == "center" else x - tw if align == "right" else x
        r = c.getTotalMatrix().mapRect(skia.Rect.MakeLTRB(x0, y - size * CAP.get(font, 0.72), x0 + tw, y))
        Wd, Hd = c.imageInfo().width(), c.imageInfo().height()
        inside = r.left() >= 0 and r.top() >= 0 and r.right() <= Wd and r.bottom() <= Hd
        visible = r.right() > 0 and r.bottom() > 0 and r.left() < Wd and r.top() < Hd
        if visible:
            AUDIT.append((s, round(r.height() * 1080 / Hd, 1), not inside, round(a, 2)))
    if glow > 0:
        f = res.font(font, size)
        p = paint(rgb, a * glow, blur=size * 0.18)
        tw = text_width(res, s, size, font, track)
        x0 = x - tw / 2 if align == "center" else x - tw if align == "right" else x
        c.drawString(s if reveal is None else s[:int(reveal)], x0, y, f, p)
    return draw_text(c, res, s, x, y, size, font, rgb, a, track, align, reveal)


# ------------------------------------------------------------------ camera
class CR:
    """Non-uniform Catmull-Rom through (t, v) keys; zero velocity only at the first and last key."""
    def __init__(self, keys, limit=None):
        keys = sorted(keys)
        self.t = [k[0] for k in keys]; self.v = [k[1] for k in keys]
        n = len(keys); m = [0.0] * n
        for i in range(1, n - 1):
            m[i] = (self.v[i + 1] - self.v[i - 1]) / max(1e-6, self.t[i + 1] - self.t[i - 1])
            if limit is not None:     # tame overshoot (zoom): cap the tangent against both neighbour slopes
                d0 = (self.v[i] - self.v[i - 1]) / max(1e-6, self.t[i] - self.t[i - 1])
                d1 = (self.v[i + 1] - self.v[i]) / max(1e-6, self.t[i + 1] - self.t[i])
                cap = limit * max(abs(d0), abs(d1))
                m[i] = max(-cap, min(cap, m[i]))
        self.m = m

    def __call__(self, t):
        T = self.t
        if t <= T[0]:
            return self.v[0]
        if t >= T[-1]:
            return self.v[-1]
        i = bisect.bisect_right(T, t) - 1
        h = T[i + 1] - T[i]; u = (t - T[i]) / h
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1; h10 = u ** 3 - 2 * u ** 2 + u
        h01 = -2 * u ** 3 + 3 * u ** 2; h11 = u ** 3 - u ** 2
        return h00 * self.v[i] + h10 * h * self.m[i] + h01 * self.v[i + 1] + h11 * h * self.m[i + 1]


class OrganicFilm(Film):
    drift = 1.0

    def _build(self):
        k = sorted(self.cam_keys)
        self._cam = [CR([(a[0], a[1]) for a in k]), CR([(a[0], a[2]) for a in k]),
                     CR([(a[0], math.log(a[3])) for a in k], limit=1.6), CR([(a[0], a[4]) for a in k], limit=1.2)]
        f = sorted(self.focus_keys)
        self._foc = [CR([(a[0], a[i]) for a in f], limit=1.5) for i in (1, 2, 3, 4)] if f else None

    def camera(self, t):
        x, y, z, r = super().camera(t)
        d = self.drift
        # slow organic float (4K screen px), much lower frequency than the handheld wobble
        fx = d * (26 * math.sin(t * 0.23 + 0.7) + 14 * math.sin(t * 0.41 + 2.2))
        fy = d * (18 * math.sin(t * 0.19 + 1.9) + 10 * math.sin(t * 0.37 + 0.3))
        z *= 1 + d * 0.012 * math.sin(t * 0.29 + 0.5)
        r += d * 0.25 * math.sin(t * 0.17 + 1.0)
        return x + fx / z, y + fy / z, z, r


def per_frame_grain():
    """The engine refreshes grain every 2nd frame (reads as 15 fps flicker); refresh it every frame."""
    orig = engine.Renderer.post
    if getattr(orig, "_pf", False):
        return

    def post(self, img, n):
        if not hasattr(self, "_grain_all"):
            orig(self, img[:2, :2] if False else img, n)        # builds self._grain
            self._grain_all = list(self._grain)
        idx = ((n // 2) * 7) % len(self._grain_all)
        g = list(self._grain_all); g[idx] = self._grain_all[(n * 3) % len(self._grain_all)]
        self._grain = g
        return orig(self, img, n)
    post._pf = True
    engine.Renderer.post = post


# ------------------------------------------------------------------ helpers
def spring(t, t0, dur=0.55):
    return ease_out_back(ramp(t, t0, dur), 1.25)


def rrect(x, y, w, h, r):
    return skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), r, r)


# ------------------------------------------------------------------ chart
class CandleChart(Item):
    """GME daily candles. data: [{date, open, high, low, close}], x(i) = x0 + i*dx, y(p) = -p*sy.
    reveal[i] = time candle i draws in. special: {i: (t_phase2, close2, low2)} re-colours a candle later."""
    z = 5

    def __init__(self, data, dx, sy, reveal, x0=0.0, body=0.6, t_in=0.0, special=None, labels=(), dates=(), sfx=True):
        super().__init__(t_in, None, None, sfx)
        self.d, self.dx, self.sy, self.reveal, self.x0, self.body = data, dx, sy, reveal, x0, body
        self.special = special or {}
        self.labels, self.dates = labels, dates        # price grid levels; (index, text, t_in)
        self.labels_out = None                         # time the price-grid numbers fade (custom)

    def x(self, i):
        return self.x0 + i * self.dx

    def y(self, p):
        return -p * self.sy

    def bounds(self, res):
        return skia.Rect.MakeLTRB(self.x0 - 6000, self.y(520) - 2000, self.x(len(self.d)) + 6000, 3000)

    def cues(self):
        out = []
        for i, tt in enumerate(self.reveal):
            if tt is not None:
                out.append(("tick", tt, 0.35, {}))
        return out

    def ohlc(self, i, t):
        d = self.d[i]
        o, h, l, c = d["open"], d["high"], d["low"], d["close"]
        if i in self.special:
            t2, c2, l2, h_first = self.special[i]
            u = ease_in_out(ramp(t, t2, 0.7))
            # phase 1: a green surge to the high; phase 2: it collapses to the real close
            c = h_first + (c2 - h_first) * u
            l = min(o, c) if u < 1e-3 else min(o, c, l2 + (min(o, c) - l2) * (1 - u))
            h = d["high"]
        return o, h, l, c

    def tip(self, t):
        """(x, y, price) of the newest revealed close."""
        last = None
        for i, tt in enumerate(self.reveal):
            if tt is not None and t >= tt:
                last = i
        if last is None:
            return self.x(0), self.y(self.d[0]["open"]), self.d[0]["open"]
        u = ease_out_cubic(ramp(t, self.reveal[last], 0.45))
        o, h, l, c = self.ohlc(last, t)
        prev = self.d[last - 1]["close"] if last > 0 else o
        p = prev + (c - prev) * u
        return self.x(last), self.y(p), p

    def draw(self, c, res, t):
        a0 = self.fade(t) * ramp(t, self.t_in, 0.8)
        if a0 <= 0:
            return
        z = zoom_of(res)
        X1 = self.x(len(self.d) - 1) + self.dx
        # baseline + grid
        c.drawLine(self.x0 - self.dx, 0, X1, 0, paint((70, 86, 104), 0.9 * a0, stroke=max(6, 2.2 / z)))
        for lv, lt in self.labels:
            ga = a0 * ramp(t, lt, 0.6)
            if ga <= 0:
                continue
            yy = self.y(lv)
            p = paint((60, 76, 94), 0.55 * ga, stroke=max(4, 1.6 / z))
            p.setPathEffect(skia.DashPathEffect.Make([60, 50], 0))
            c.drawLine(self.x0 - self.dx, yy, X1, yy, p)
            for xx in (self.x0 - self.dx * 0.9, self.x(8.2), self.x(15.6), X1 - self.dx * 0.1):
                text(c, res, f"${lv}", xx, yy - 60, 330, "mono", (150, 168, 188), 0.9 * ga * self.label_fade(t))
        for i, txt, ti in self.dates:
            da = a0 * ramp(t, ti, 0.4)
            if da > 0:
                c.drawLine(self.x(i), 60, self.x(i), 240, paint((150, 168, 188), da * 0.8, stroke=12))
                text(c, res, txt, self.x(i), 640, 330, "mono", (170, 186, 204), da, 0.06, "center")
        bw = self.dx * self.body
        for i, tt in enumerate(self.reveal):
            if tt is None or t < tt - 0.01:
                continue
            u = ease_out_back(ramp(t, tt, 0.42), 1.3); ua = ramp(t, tt, 0.12)
            o, h, l, cl = self.ohlc(i, t)
            up = cl >= o
            col = GREEN if up else RED
            cx = self.x(i)
            yo = self.y(o); yc = yo + (self.y(cl) - yo) * u
            yh = yo + (self.y(h) - yo) * ease_out_cubic(ramp(t, tt + 0.08, 0.45)); yl = yo + (self.y(l) - yo) * ease_out_cubic(ramp(t, tt + 0.08, 0.45))
            ww = max(18, 0.08 * self.dx)
            top, bot = min(yo, yc), max(yo, yc)
            if bot - top < 30:
                top -= 15; bot += 15
            c.drawLine(cx, yh, cx, yl, paint(col, 0.9 * a0 * ua, stroke=ww))
            c.drawRect(skia.Rect.MakeLTRB(cx - bw / 2 - 40, top - 40, cx + bw / 2 + 40, bot + 40), paint(col, 0.22 * a0 * ua, blur=90))
            c.drawRect(skia.Rect.MakeLTRB(cx - bw / 2, top, cx + bw / 2, bot), paint(col, 0.95 * a0 * ua))


class PriceTag(Item):
    """Live price pill riding the chart tip (always legible-checked)."""
    z = 34

    def __init__(self, chart, t_in, t_out=None, size=300, sfx=False):
        super().__init__(t_in, t_out, None, sfx)
        self.ch, self.size = chart, size

    def bounds(self, res):
        return None

    def draw(self, c, res, t):
        a = ramp(t, self.t_in, 0.3) * self.fade(t)
        if a <= 0:
            return
        x, y, p = self.ch.tip(t)
        s = self.size
        lab = f"GME ${p:,.2f}"
        tw = text_width(res, lab, s, "mono", 0.02)
        lx = x + self.ch.dx * 0.55
        bx, by, bw, bh = lx, y - s * 0.85, tw + s * 0.9, s * 1.35
        la = a * legible(res, s, "mono")
        if la <= 0:
            return
        c.drawLine(x + self.ch.dx * 0.32, y, lx, y, paint(GREEN, 0.8 * la, stroke=14))
        c.drawRRect(rrect(bx, by, bw, bh, bh * 0.22), paint((8, 30, 18), 0.92 * la))
        c.drawRRect(rrect(bx, by, bw, bh, bh * 0.22), paint(GREEN, 0.95 * la, stroke=12))
        c.drawRRect(rrect(bx, by, bw, bh, bh * 0.22), paint(GREEN, 0.25 * la, blur=60))
        text(c, res, lab, bx + s * 0.45, by + bh * 0.71, s, "mono", GREEN, la, 0.02, check=False)


# ------------------------------------------------------------------ panels
class Panel(Item):
    """Glass app window. content: photo key (str) or callable(c, res, t, w, h, a). Springs up into place."""
    z = 20

    def __init__(self, x, y, w, h, t_in, title="", content=None, t_out=None, accent=(90, 200, 255), rot=0.0,
                 bar=230, label=None, label_t=None, label_rgb=AMBER, label_size=230, sfx=True, pop=0.7):
        super().__init__(t_in, t_out, None, sfx)
        self.x, self.y, self.w, self.h, self.title, self.content = x, y, w, h, title, content
        self.accent, self.rot, self.bar = accent, rot, bar
        self.label, self.label_t, self.label_rgb, self.label_size, self.pop = label, label_t, label_rgb, label_size, pop

    def bounds(self, res):
        r = max(self.w, self.h) * 0.9 + 900
        return skia.Rect.MakeLTRB(self.x - r, self.y - r, self.x + r, self.y + r)

    def cues(self):
        return [("pop", self.t_in, self.pop, {})]

    def draw(self, c, res, t):
        u = spring(t, self.t_in, 0.6); a = ramp(t, self.t_in, 0.18) * self.fade(t)
        if a <= 0:
            return
        W, H, B = self.w, self.h, self.bar
        out = ease_in_out(ramp(t, self.t_out, 0.6)) if self.t_out is not None else 0
        s = 0.9 + 0.1 * u - 0.04 * out
        c.save(); c.translate(self.x, self.y + (1 - u) * 320 + out * 200); c.rotate(self.rot + (1 - u) * 2.5); c.scale(s, s)
        R = 70
        c.drawRRect(rrect(-W / 2 + 40, -H / 2 - B + 90, W, H + B, R), paint((0, 0, 0), 0.6 * a, blur=110))
        c.drawRRect(rrect(-W / 2, -H / 2 - B, W, H + B, R), paint((16, 20, 27), 0.96 * a))
        # content
        c.save(); c.clipRRect(rrect(-W / 2, -H / 2, W, H, 0), True)
        if isinstance(self.content, str):
            ip = skia.Paint(AntiAlias=True); ip.setAlphaf(a)
            c.drawImageRect(res.image(self.content), skia.Rect.MakeXYWH(-W / 2, -H / 2, W, H), SAMPLING, ip)
        elif self.content:
            self.content(c, res, t, W, H, a)
        c.restore()
        # title bar
        for k, col in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
            c.drawCircle(-W / 2 + 120 + k * 120, -H / 2 - B / 2, 38, paint(col, 0.9 * a))
        if self.title:
            text(c, res, self.title, -W / 2 + 500, -H / 2 - B / 2 + 62, 170, "monom", (170, 182, 196), a)
        # glass sheen sweeping once on entry
        sw = ramp(t, self.t_in + 0.15, 0.9)
        if 0 < sw < 1:
            c.save(); c.clipRRect(rrect(-W / 2, -H / 2 - B, W, H + B, R), True)
            gx = -W / 2 - W * 0.4 + sw * W * 1.8
            g = skia.GradientShader.MakeLinear([skia.Point(gx - 500, 0), skia.Point(gx + 500, 0)],
                                               [skia.Color(255, 255, 255, 0), skia.Color(255, 255, 255, int(60 * a)), skia.Color(255, 255, 255, 0)],
                                               [0.0, 0.5, 1.0])
            p = skia.Paint(); p.setShader(g); c.drawRect(skia.Rect.MakeXYWH(-W, -H, 2 * W, 2 * H), p); c.restore()
        c.drawRRect(rrect(-W / 2, -H / 2 - B, W, H + B, R), paint(self.accent, 0.35 * a, blur=40, stroke=26))
        c.drawRRect(rrect(-W / 2, -H / 2 - B, W, H + B, R), paint(self.accent, 0.85 * a, stroke=8))
        c.restore()
        if self.label:
            lt = self.label_t if self.label_t is not None else self.t_in + 0.4
            la = ramp(t, lt, 0.2) * self.fade(t)
            if la > 0:
                n = len(self.label) * ease_out_cubic(ramp(t, lt, 0.03 * len(self.label) + 0.15))
                ls = self.label_size
                tw = text_width(res, self.label, ls, "mono", 0.04)
                y0 = self.y + (self.h / 2) * s + 140 + out * 200
                lg = legible(res, ls, "mono")
                la *= edge_alpha(c, skia.Rect.MakeXYWH(self.x - W / 2 * s, y0, tw + ls * 0.8, ls * 1.45))
                c.drawRect(skia.Rect.MakeXYWH(self.x - W / 2 * s, y0, (tw + ls * 0.8) * ease_out_cubic(ramp(t, lt, 0.3)), ls * 1.45),
                           paint(self.label_rgb, 0.95 * la * lg))
                text(c, res, self.label, self.x - W / 2 * s + ls * 0.4, y0 + ls * 1.05, ls, "mono", (12, 12, 14), la, 0.04, reveal=n + 0.999)


class Hero(Item):
    """Display type that slams in: spring scale 1.35 -> 1, 0.1 s alpha, glow. words=[(text, t)] reveals word by word."""
    z = 70

    def __init__(self, s, x, y, size, t_in, font="anton", rgb=WHITE, t_out=None, align="center", track=0.02, glow=0.5,
                 words=None, hit=0.9, cue="impact", colors=None, sfx=True):
        super().__init__(t_in, t_out, None, sfx)
        self.s, self.x, self.y, self.size, self.font, self.rgb = s, x, y, size, font, rgb
        self.align, self.track, self.glow, self.words, self.hit, self.cue_kind = align, track, glow, words, hit, cue
        self.colors = colors or {}

    def bounds(self, res):
        r = len(self.s) * self.size * 0.7 + self.size * 2
        return skia.Rect.MakeLTRB(self.x - r, self.y - self.size * 2, self.x + r, self.y + self.size)

    def cues(self):
        if not self.hit:
            return []
        if self.words:
            return [(self.cue_kind, tt - 0.03, self.hit * (1.0 if k == len(self.words) - 1 else 0.6), {}) for k, (_, tt) in enumerate(self.words)]
        return [(self.cue_kind, self.t_in - 0.03, self.hit, {})]

    def _draw_piece(self, c, res, s, x, y, t0, t, rgb):
        u = ramp(t, t0, 0.38); a = ramp(t, t0, 0.1) * self.fade(t)
        if a <= 0:
            return
        sc = 1.35 - 0.35 * ease_out_back(u, 1.6)
        c.save(); c.translate(x, y - self.size * 0.36); c.scale(sc, sc); c.translate(-x, -(y - self.size * 0.36))
        text(c, res, s, x, y, self.size, self.font, rgb, a, self.track, "left", glow=self.glow, edge=False)
        c.restore()

    def draw(self, c, res, t):
        if t < self.t_in - 0.01:
            return
        if not self.words:
            tw = text_width(res, self.s, self.size, self.font, self.track)
            x0 = self.x - tw / 2 if self.align == "center" else self.x - tw if self.align == "right" else self.x
            self._draw_piece(c, res, self.s, x0, self.y, self.t_in, t, self.rgb)
            return
        full = " ".join(w for w, _ in self.words)
        tw = text_width(res, full, self.size, self.font, self.track)
        x = self.x - tw / 2 if self.align == "center" else self.x
        for k, (w, tt) in enumerate(self.words):
            self._draw_piece(c, res, w, x, self.y, tt, t, self.colors.get(k, self.rgb))
            x += text_width(res, w + " ", self.size, self.font, self.track)


class Roll(Item):
    """A big rolling number (prefix/suffix, decimals), slammed in, with a caption."""
    z = 70

    def __init__(self, x, y, size, v0, v1, t_in, dur, fmt="{:,.0f}", prefix="", suffix="", rgb=WHITE, caption=None,
                 cap_rgb=GREY, t_out=None, font="anton", sfx=True, hit=0.8):
        super().__init__(t_in, t_out, None, sfx)
        self.x, self.y, self.size, self.v0, self.v1, self.dur, self.fmt = x, y, size, v0, v1, dur, fmt
        self.prefix, self.suffix, self.rgb, self.caption, self.cap_rgb, self.font, self.hit = prefix, suffix, rgb, caption, cap_rgb, font, hit

    def bounds(self, res):
        r = self.size * 7
        return skia.Rect.MakeLTRB(self.x - r, self.y - r, self.x + r, self.y + r)

    def cues(self):
        return [("ticks", self.t_in, 0.5, {}), ("impact", self.t_in + self.dur - 0.05, self.hit, {})]

    def draw(self, c, res, t):
        a = ramp(t, self.t_in, 0.1) * self.fade(t)
        if a <= 0:
            return
        u = ease_out_cubic(ramp(t, self.t_in, self.dur))
        v = self.v0 + (self.v1 - self.v0) * u
        s = self.prefix + self.fmt.format(v) + self.suffix
        land = ramp(t, self.t_in + self.dur - 0.05, 0.35)
        sc = 1 + 0.08 * math.sin(land * math.pi) if 0 < land < 1 else 1.0
        c.save(); c.translate(self.x, self.y); c.scale(sc, sc); c.translate(-self.x, -self.y)
        text(c, res, s, self.x, self.y, self.size, self.font, self.rgb, a, 0.01, "center", glow=0.55, edge=False)
        c.restore()
        if self.caption:
            ca = ramp(t, self.t_in + 0.25, 0.3) * self.fade(t)
            text(c, res, self.caption, self.x, self.y + self.size * 0.6, self.size * 0.3, "mono", self.cap_rgb, ca, 0.08, "center")


class Particles(Item):
    """Glowing orders streaming from a to b along arcs between t0 and t1."""
    z = 33

    def __init__(self, a, b, t0, t1, n=70, rgb=GREEN, r=40, spread=900, travel=0.9, seed=5, t_out=None, sfx=True):
        super().__init__(t0, t_out, None, sfx)
        rng = np.random.default_rng(seed)
        self.a, self.b, self.rgb, self.r, self.travel = a, b, rgb, r, travel
        self.ts = np.sort(rng.uniform(t0, t1, n)); self.off = rng.normal(0, spread, (n, 2)); self.bend = rng.uniform(-0.25, 0.25, n)

    def bounds(self, res):
        return None

    def cues(self):
        return [("shimmer", self.t_in, 0.5, {})]

    def draw(self, c, res, t):
        fa = self.fade(t)
        (x0, y0), (x1, y1) = self.a, self.b
        for k, ts in enumerate(self.ts):
            u = (t - ts) / self.travel
            if u <= 0 or u >= 1.15:
                continue
            e = ease_in_out(min(1, u))
            sx, sy = x0 + self.off[k][0] * 0.3, y0 + self.off[k][1] * 0.3
            ex, ey = x1 + self.off[k][0] * 0.15, y1 + self.off[k][1] * 0.15
            mx, my = (sx + ex) / 2 + (ey - sy) * self.bend[k], (sy + ey) / 2 - (ex - sx) * self.bend[k]
            px = (1 - e) ** 2 * sx + 2 * (1 - e) * e * mx + e * e * ex
            py = (1 - e) ** 2 * sy + 2 * (1 - e) * e * my + e * e * ey
            a = fa * (1 if u < 1 else max(0, 1 - (u - 1) / 0.15))
            c.drawCircle(px, py, self.r * 2.6, paint(self.rgb, 0.22 * a, blur=self.r))
            c.drawCircle(px, py, self.r, paint(self.rgb, 0.95 * a))


class ShortArrow(Item):
    """Red dashed projection drawing on from a to b with an arrowhead and a label."""
    z = 32

    def __init__(self, a, b, t_in, dur=0.7, label=None, size=300, t_out=None, sfx=True):
        super().__init__(t_in, t_out, None, sfx)
        self.a, self.b, self.dur, self.label, self.size = a, b, dur, label, size

    def bounds(self, res):
        (x0, y0), (x1, y1) = self.a, self.b
        return skia.Rect.MakeLTRB(min(x0, x1) - 3000, min(y0, y1) - 1500, max(x0, x1) + 3000, max(y0, y1) + 1500)

    def cues(self):
        return [("drop", self.t_in, 0.7, {})]

    def draw(self, c, res, t):
        u = ease_in_out(ramp(t, self.t_in, self.dur)); a = self.fade(t)
        if u <= 0 or a <= 0:
            return
        (x0, y0), (x1, y1) = self.a, self.b
        xe, ye = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
        p = paint(RED, 0.95 * a, stroke=36); p.setPathEffect(skia.DashPathEffect.Make([150, 90], 0))
        c.drawLine(x0, y0, xe, ye, paint(RED, 0.25 * a, stroke=90, blur=40)); c.drawLine(x0, y0, xe, ye, p)
        ang = math.atan2(y1 - y0, x1 - x0); L = 260
        path = skia.Path(); path.moveTo(xe, ye)
        path.lineTo(xe - L * math.cos(ang - 0.45), ye - L * math.sin(ang - 0.45))
        path.lineTo(xe - L * math.cos(ang + 0.45), ye - L * math.sin(ang + 0.45)); path.close()
        c.drawPath(path, paint(RED, a))
        if self.label:
            la = ramp(t, self.t_in + self.dur * 0.7, 0.25) * a
            text(c, res, self.label, x1 + 200, y1 + self.size * 0.35, self.size, "mono", RED, la, 0.08, glow=0.6)


class Flash(Item):
    """A radial bloom at a point (price spike, button press)."""
    z = 36

    def __init__(self, x, y, t_in, r=2500, rgb=GREEN, dur=0.7, sfx=False):
        super().__init__(t_in, t_in + dur, None, sfx)
        self.x, self.y, self.r, self.rgb, self.dur = x, y, r, rgb, dur

    def bounds(self, res):
        return skia.Rect.MakeLTRB(self.x - self.r * 2, self.y - self.r * 2, self.x + self.r * 2, self.y + self.r * 2)

    def draw(self, c, res, t):
        u = ramp(t, self.t_in, self.dur)
        if u <= 0 or u >= 1:
            return
        a = (1 - u) ** 2
        c.drawCircle(self.x, self.y, self.r * (0.3 + 0.9 * ease_out_cubic(u)), paint(self.rgb, 0.45 * a, blur=self.r * 0.35))
        c.drawCircle(self.x, self.y, self.r * (0.2 + 1.4 * ease_out_cubic(u)), paint(self.rgb, 0.8 * a, stroke=40))


def gem(c, x, y, s, a, rgb=(110, 230, 255)):
    """Diamond icon (vector, no emoji font needed)."""
    pts = [(-0.5, -0.15), (-0.28, -0.42), (0.28, -0.42), (0.5, -0.15), (0, 0.5)]
    p = skia.Path(); p.moveTo(x + pts[0][0] * s, y + pts[0][1] * s)
    for px, py in pts[1:]:
        p.lineTo(x + px * s, y + py * s)
    p.close()
    c.drawPath(p, paint(rgb, 0.3 * a, blur=s * 0.2))
    c.drawPath(p, paint(rgb, 0.9 * a))
    lp = paint((230, 250, 255), 0.85 * a, stroke=s * 0.035)
    c.drawLine(x - 0.5 * s, y - 0.15 * s, x + 0.5 * s, y - 0.15 * s, lp)
    for a0, a1 in (((-0.28, -0.42), (-0.12, -0.15)), ((0.28, -0.42), (0.12, -0.15)), ((-0.12, -0.15), (0, 0.5)), ((0.12, -0.15), (0, 0.5))):
        c.drawLine(x + a0[0] * s, y + a0[1] * s, x + a1[0] * s, y + a1[1] * s, lp)


class GemHold(Item):
    """'HOLD' flanked by two diamonds."""
    z = 72

    def __init__(self, x, y, size, t_in, t_out=None, sfx=True):
        super().__init__(t_in, t_out, None, sfx)
        self.x, self.y, self.size = x, y, size

    def bounds(self, res):
        return skia.Rect.MakeLTRB(self.x - self.size * 4, self.y - self.size * 2, self.x + self.size * 4, self.y + self.size)

    def cues(self):
        return [("impact", self.t_in - 0.03, 0.9, {})]

    def draw(self, c, res, t):
        u = ramp(t, self.t_in, 0.4); a = ramp(t, self.t_in, 0.1) * self.fade(t)
        if a <= 0:
            return
        sc = 1.35 - 0.35 * ease_out_back(u, 1.6)
        c.save(); c.translate(self.x, self.y - self.size * 0.36); c.scale(sc, sc); c.translate(-self.x, -(self.y - self.size * 0.36))
        tw = text(c, res, "HOLD", self.x, self.y, self.size, "anton", WHITE, a, 0.04, "center", glow=0.5, edge=False)
        for sgn in (-1, 1):
            g_u = ramp(t, self.t_in + 0.12, 0.4)
            gem(c, self.x + sgn * (tw / 2 + self.size * 0.6), self.y - self.size * 0.38 - (1 - ease_out_back(g_u)) * 200, self.size * 0.75, a * g_u)
        c.restore()


# ------------------------------------------------------------------ UI content painters
def reddit_content(post_title, user, t_up0, t_up1, up1, t_glow):
    def draw(c, res, t, W, H, a):
        c.drawRect(skia.Rect.MakeXYWH(-W / 2, -H / 2, W, H), paint((26, 26, 27), a))
        x0, y0 = -W / 2 + 160, -H / 2 + 150
        c.drawCircle(x0 + 120, y0 + 120, 150, paint(ORANGE, a))
        text(c, res, "r/", x0 + 120, y0 + 195, 230, "label", WHITE, a, 0, "center")
        text(c, res, "r/wallstreetbets", x0 + 330, y0 + 175, 210, "label", WHITE, a, 0.01)
        text(c, res, f"Posted by {user}", x0 + 10, y0 + 470, 200, "labelm", (129, 131, 132), a, 0.01)
        # title (real post title)
        text(c, res, post_title, x0 + 10, y0 + 770, 200, "label", (215, 218, 220), a, 0.0)
        # grey rows as body copy
        for k, L in enumerate((0.92, 0.84, 0.88, 0.6)):
            c.drawRoundRect(skia.Rect.MakeXYWH(x0 + 10, y0 + 930 + k * 150, (W - 420) * L, 62), 31, 31, paint((60, 62, 64), 0.9 * a))
        # vote column
        u = ease_out_cubic(ramp(t, t_up0, t_up1 - t_up0))
        n = int(up1 * u)
        gl = ramp(t, t_glow, 0.15) * (1 - ramp(t, t_glow + 0.6, 0.6))
        vx, vy = -W / 2 + 280, H / 2 - 280
        arrow = skia.Path(); arrow.moveTo(vx, vy - 130); arrow.lineTo(vx + 120, vy + 10); arrow.lineTo(vx + 50, vy + 10)
        arrow.lineTo(vx + 50, vy + 120); arrow.lineTo(vx - 50, vy + 120); arrow.lineTo(vx - 50, vy + 10); arrow.lineTo(vx - 120, vy + 10); arrow.close()
        c.drawPath(arrow, paint(ORANGE, (0.25 + 0.6 * gl) * a, blur=60))
        c.drawPath(arrow, paint(ORANGE, a))
        text(c, res, f"{n / 1000:.1f}k" if n < 100000 else f"{n // 1000}k", vx + 230, vy + 85, 240, "label", ORANGE, a, 0.01)
        text(c, res, "upvotes", vx + 230 + text_width(res, "88.8k ", 240, "label"), vy + 85, 190, "labelm", (129, 131, 132), a)
    return draw


def buy_content(t_press, t_off=None, ticker="GME", price="$40.69"):
    def draw(c, res, t, W, H, a):
        c.drawRect(skia.Rect.MakeXYWH(-W / 2, -H / 2, W, H), paint((10, 12, 14), a))
        text(c, res, ticker, -W / 2 + 170, -H / 2 + 330, 260, "label", WHITE, a)
        text(c, res, price, W / 2 - 170, -H / 2 + 330, 260, "mono", GREEN, a, 0, "right")
        off = ramp(t, t_off, 0.35) if t_off is not None else 0
        pr = ramp(t, t_press, 0.12) * (1 - ramp(t, t_press + 0.15, 0.35))
        bw, bh = W - 340, 420
        s = 1 - 0.06 * pr
        c.save(); c.translate(0, H / 2 - 360); c.scale(s, s)
        col = tuple(GREEN[i] * (1 - off) + (58, 62, 68)[i] * off for i in range(3))
        c.drawRRect(rrect(-bw / 2, -bh / 2, bw, bh, bh / 2), paint(col, 0.35 * a * (1 - off), blur=80))
        c.drawRRect(rrect(-bw / 2, -bh / 2, bw, bh, bh / 2), paint(col, a))
        text(c, res, "BUY", 0, 105, 300, "label", (6, 22, 12) if off < 0.5 else (120, 126, 134), a, 0.12, "center")
        if off > 0:       # padlock
            lx, ly = bw / 2 - 260, 0
            c.drawRoundRect(skia.Rect.MakeXYWH(lx - 90, ly - 30, 180, 150), 24, 24, paint((150, 156, 164), a * off))
            c.drawArc(skia.Rect.MakeXYWH(lx - 65, ly - 150, 130, 220), 180, 180, False, paint((150, 156, 164), a * off, stroke=30))
            c.drawLine(-bw / 2 + 100, 0, -bw / 2 + 100 + (bw - 200) * ease_out_cubic(off), 0, paint(RED, a * off, stroke=26))
        c.restore()
        if pr > 0:
            rr = ramp(t, t_press, 0.6)
            c.drawCircle(0, H / 2 - 360, 300 + 1400 * ease_out_cubic(rr), paint(GREEN, 0.6 * (1 - rr) * a, stroke=30))
    return draw


def headline_content(lines):
    def draw(c, res, t, W, H, a):
        c.drawRect(skia.Rect.MakeXYWH(-W / 2, -H / 2, W, H), paint((12, 14, 18), a))
        y = -H / 2 + 260
        for s, size, font, rgb in lines:
            text(c, res, s, -W / 2 + 160, y, size, font, rgb, a, 0.01)
            y += size * 1.5
    return draw


def _label_fade(self, t):
    v = 1.0                                        # labels_out: [(t_hide, t_show or None), ...]
    for a, b in (self.labels_out or ()):
        v *= 1.0 - ramp(t, a, 0.5) * (1.0 if b is None else 1.0 - ramp(t, b, 0.5))
    return v


CandleChart.label_fade = _label_fade


class Ambient(Item):
    """Big soft colour glows in the world (atmosphere behind the chart): [(x, y, r, rgb, alpha, t_in)]."""
    z = -50

    def __init__(self, blobs, sfx=False):
        super().__init__(-1, None, None, sfx)
        self.blobs = blobs

    def draw(self, c, res, t):
        for x, y, r, rgb, al, ti in self.blobs:
            a = al * ramp(t, ti, 1.5)
            if a > 0:
                g = skia.GradientShader.MakeRadial(skia.Point(x, y), r, [skia.Color(*rgb, int(255 * a)), skia.Color(*rgb, 0)])
                p = skia.Paint(); p.setShader(g); c.drawCircle(x, y, r, p)
