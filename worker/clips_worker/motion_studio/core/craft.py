"""Craft guidance and compact worked examples for the Motion Designer prompt.

Distilled from the Cinematic Skill manual (SKILL.md + references/film, story, sound, voice)
and from the handmade Keef (map world) and GameStop (custom chart Item) films. Kept tight so
the designer system prompt stays inside a reasonable token budget.
"""
from __future__ import annotations

CRAFT_GUIDE = '''
CRAFT (how a film in this engine is actually made — follow these, not just the signatures):

World. One camera move over ONE invented world for this topic. Every graphic lives on that
world. A map, a price chart, an evidence board, a desk, a network, a city grid, or something
new you invent — not a generic dark grid with slammed type. Do not copy the example worlds
onto a new subject; steal the grammar, invent the set.

Camera. Use film.shot(t, x, y, zoom, rot=..., radius=..., strength=...) so the spotlight
travels with the camera (never leave the light behind). Keys every 0.6–3 s; the spline keeps
drifting, so a hold is two keys close together and slightly apart. Push in (zoom ~0.5 → 0.9
→ 1.2) to land on a hero; pull back (0.2–0.35) to show a connection or the whole board; whip
between clusters in 0.8–1.2 s. Land the camera on a hero about 0.3 s AFTER it appears (the
camera notices it). Lean rot a degree or two. ctx.film() already has organic drift and
handheld wobble — do not add your own shake on every key; film.shake only for stamps/impacts.
Need keys spanning 0..duration. Wide shots: large radius, strength 0.15–0.3. Do not set
fade_in/fade_out (segments never fade to black; assembly does the program fades).

One hero per beat. Each narration line has exactly one thing the camera is on. The spotlight
dims everything else. Old items dim or fade (t_out) after their beat so the final pull-back
is a composed board, not clutter.

Hits land on the spoken word. Time every reveal with ctx.W(line_id, "word") or times in
ctx.lines/ctx.words — never hard-coded seconds for story beats. W searches the SPOKEN form
("nineteen", not "1903"; "six", not "6"). Use nth=1 for a later occurrence; end=True for the
word's end. A stamp slams on the verb, a number lands on the spoken numeral. RollingNumber
t_land MUST be that spoken time, and v1 MUST equal the number the line actually speaks
(only values from ctx.data or the line — never invent a figure).

Type and spoken. Show a phrase ONE way: either type it on screen or show it on a real
document/photo, never both word-for-word. Prefer a hero that is a number or a name. ALWAYS
draw type with text(...) so cap-height and edge-cut audits run (size*0.72*zoom/2 >= 40 px at
1080p; at zoom 0.5 use size >= 230). Light type on dark worlds; dark ink only on paper, a
card, or a full accent block. Fonts: cond (labels/numbers/stamps), label/labelm (captions),
serif (documents), mono (typewriter), hand. One accent colour for the things that matter.

Layers. Every frame has three: a procedural background (GradientField / GridField /
NoiseTexture / the map sheet or chart grid), midground context (routes, pins, panels,
series), foreground hero (type, a rolling number, a stamp, a photo). Never a lone hero on an
empty field. Layout in clusters (one cluster per section), a print's width apart. Travel
between clusters along a StringLine (this leads to that) or a Route (people moving). The
camera follows the line as it draws. Map scale: pick K so each place with items has room
(K=20000 world; 50000–70000 when nearby cities each need space). Keep clusters on the map or
clearly off it, not straddling the edge. Labels go on the side away from their neighbour.

Pacing. Short declarative sentences are already in the script; match them visually. The key
word is usually last — the hit lands near the end of the line, then a pause. Strings fade
after their beat unless persist=True. The last shot is a pull-back that reads as one designed
world.

Sound. Items cue their own sounds (leave sfx=True). Add by hand: film.cue("boom", t, gain)
once or twice for the title or biggest reveal; film.cue("riser", t, gain, dur=...) starting
~1.3 s before a section so it PEAKS at t+dur on the line; film.cue("impact", t) when a number
lands; film.cue("heartbeat", t) or "clock" under the tensest line. Kinds: pop whoosh slide
impact boom ticks riser stamp shimmer drop marker pencil tick snip click heartbeat clock.
Effects are felt, not noticed; the voice always wins. Do not pile cues on every item.

Custom items. Subclass Item (__init__ t_in,t_out,z,sfx; bounds(res); draw(c,res,t) in world
px). Use text(), paint(), ramp(), ease_*, spring(), rrect(). Subclass Cached for a big static
drawing (a street plan, a floor, a chart grid) so it is drawn once and reused. Seeded
randomness only (ctx.rand / seed=ctx.seed). No files, network, or OS.
'''

# Compact map-world grammar, adapted from keef/scene.py to motion_core.
# Invent a new map look and places for a new topic — do not reuse this Chicago story.
EXAMPLE_MAP = r'''
# EXAMPLE A — map world grammar (from a place-rooted film). Invent your own look and places.
from motion_core import *
class GlowPin(Item):
    def __init__(self, x, y, label, t_in, t_out=None, side="right", size=1.0, label_size=150, rgb=(214, 38, 30)):
        super().__init__(t_in=t_in, t_out=t_out, z=30, sfx=True)
        self.x, self.y, self.label, self.side, self.k, self.ls, self.rgb = x, y, label, side, size, label_size, rgb
    def bounds(self, res):
        L = len(self.label or "") * self.ls * 0.8 + 600 * self.k
        return skia.Rect.MakeLTRB(self.x - L, self.y - 600 * self.k, self.x + L, self.y + 600 * self.k)
    def cues(self):
        return [("pop", self.t_in, 0.5, {})]
    def draw(self, c, res, t):
        u = ramp(t, self.t_in, 0.35); a = u
        if a <= 0: return
        k, ph = self.k, (t - self.t_in) % 1.8 / 1.8
        c.drawCircle(self.x, self.y, 40 * k + 220 * k * ph, paint(self.rgb, 0.5 * (1 - ph) * a, stroke=10 * k))
        c.drawCircle(self.x, self.y, 38 * k * ease_out_back(u), paint(self.rgb, a))
        if self.label:
            s = 1 if self.side == "right" else -1
            n = len(self.label) * ease_out_cubic(ramp(t, self.t_in + 0.15, 0.04 * len(self.label) + 0.15))
            text(c, res, self.label, self.x + s * 110 * k, self.y + self.ls * 0.36, self.ls, "mono", CREAM, a, 0.12,
                 "left" if s > 0 else "right", reveal=n + 0.999)
def build_scene(ctx):
    W, film = ctx.W, ctx.film()
    ink, acc = ctx.rgb("ink", CREAM), ctx.rgb("accent", (214, 38, 30))
    look = dict(sheet=tuple(max(0, int(c * 0.12)) for c in ctx.rgb("bg", (9, 22, 24))),
                water=tuple(max(0, int(c * 0.18)) for c in ctx.rgb("bg", (9, 22, 24))),
                land=(36, 70, 72), border=(96, 138, 134), relief=0.18)
    world = film.add(ctx.geo("world", K=10000, look=look))
    cx, cy = ctx.place(world, "Chicago")
    ldn, bk = ctx.place(world, "London"), ctx.place(world, "Brooklyn")
    lid = ctx.lines[0]["id"] if ctx.lines else "l1"
    film.add(GlowPin(cx, cy, "SOUTH SIDE, CHICAGO", t_in=W(lid, ctx.lines[0]["hero"].split()[0]) if ctx.lines and ctx.lines[0].get("hero") else 0.2,
                     label_size=210, size=1.8, rgb=acc))
    film.add(HeroSlam("DRILL", cx + 9000, cy - 1800, 1000, W(lid, ctx.words[0]["w"]) if ctx.words else 0.4, font="serif", rgb=ink, glow=0.4))
    film.add(Route((cx, cy), ldn, t_in=ctx.lines[-1]["start"] if ctx.lines else 1.0, dur=1.3, width=70, rgb=acc))
    film.add(GlowPin(*ldn, "LONDON", t_in=ctx.lines[-1]["start"] + 0.4 if ctx.lines else 1.5, size=3.0, label_size=320, rgb=acc))
    film.add(Route((cx, cy), bk, t_in=ctx.lines[-1]["start"] + 0.5 if ctx.lines else 1.6, dur=0.6, width=60, rgb=acc))
    film.shot(0.0, cx, cy - 2300, 0.85, -1.0, strength=0.5)
    film.shot(0.8, cx + 100, cy - 1200, 0.62, 0.0, radius=3400, strength=0.4)
    film.shot(ctx.duration * 0.7, cx + 7800, cy - 900, 0.23, -0.2, radius=12000, strength=0.15)  # pull wide as it spreads
    film.shot(ctx.duration, cx + 8600, cy - 700, 0.20, 0.0, radius=16000, strength=0.1)
    if ctx.lines:
        film.cue("riser", max(0.0, ctx.lines[-1]["start"] - 1.3), 0.45, dur=1.3)
        film.cue("boom", ctx.lines[-1]["start"], 0.6)
    return film
'''

# Compact custom chart Item, adapted from round2_cinematic/gme/ext.py CandleChart
# plus the climb-the-spike camera and RollingNumber-on-the-spoken-word from gme/scene.py.
EXAMPLE_CHART = r'''
# EXAMPLE B — custom chart world Item (from a numbers-as-the-world film). Plot only ctx.data.
from motion_core import *
class PriceChart(Item):
    """The world IS the data: a candlestick / line field the camera can travel. x(i), y(price)."""
    def __init__(self, pts, dx=1400, sy=26, t_in=0.0, rgb_up=(38, 224, 122), rgb_dn=(255, 72, 72)):
        super().__init__(t_in=t_in, t_out=None, z=-2, sfx=True)
        self.pts, self.dx, self.sy, self.up, self.dn = pts, dx, sy, rgb_up, rgb_dn  # pts: [(t_reveal, price), ...]
    def x(self, i): return i * self.dx
    def y(self, p): return -p * self.sy
    def bounds(self, res):
        lo, hi = min(p for _, p in self.pts), max(p for _, p in self.pts)
        return skia.Rect.MakeLTRB(-2000, self.y(hi) - 2000, self.x(len(self.pts)) + 2000, self.y(lo) + 2000)
    def cues(self):
        return [("tick", t, 0.35, {}) for t, _ in self.pts]
    def tip(self, t):
        last, prev = 0, self.pts[0][1]
        for i, (tt, p) in enumerate(self.pts):
            if t >= tt: last, prev = i, p
        t0, p1 = self.pts[last]; u = ease_out_cubic(ramp(t, t0, 0.45)); p = prev + (p1 - prev) * u
        return self.x(last), self.y(p), p
    def draw(self, c, res, t):
        a = ramp(t, self.t_in, 0.8)
        if a <= 0 or not self.pts: return
        X1 = self.x(len(self.pts) - 1) + self.dx
        c.drawLine(-self.dx, 0, X1, 0, paint((70, 86, 104), 0.9 * a, stroke=8))
        prev = self.pts[0][1]
        for i, (tt, price) in enumerate(self.pts):
            if t < tt: break
            u = ease_out_back(ramp(t, tt, 0.42))
            col = self.up if price >= prev else self.dn
            x, y0, y1 = self.x(i), self.y(prev), self.y(prev + (price - prev) * u)
            c.drawLine(x, y0, x, y1, paint(col, 0.95 * a, stroke=max(18, 0.08 * self.dx)))
            top, bot = min(y0, y1), max(y0, y1)
            c.drawRect(skia.Rect.MakeLTRB(x - self.dx * 0.25, top, x + self.dx * 0.25, bot), paint(col, 0.95 * a))
            prev = price
def build_scene(ctx):
    W, film = ctx.W, ctx.film()
    film.add(GridField(spacing=400, rgb=ctx.rgb("muted", (70, 86, 104)), alpha=0.08))
    vals = [float(d["value"]) for d in (ctx.data or []) if d.get("value") is not None]
    times = [ln["start"] + 0.2 for ln in ctx.lines] or [0.3]
    pts = [(times[min(i, len(times) - 1)], v) for i, v in enumerate(vals)]
    if not pts:
        return film  # no invented figures — keep the grid world and wait for data
    chart = film.add(PriceChart(pts))
    last_t, last_v = pts[-1]
    land = last_t
    if ctx.lines and ctx.lines[-1].get("spoken"):
        tok = next((w["w"] for w in ctx.words if w.get("line") == ctx.lines[-1]["id"] and w["w"].isalpha()), None)
        if tok:
            try: land = W(ctx.lines[-1]["id"], tok)
            except Exception: land = last_t
    film.add(RollingNumber(chart.x(len(pts) - 1), chart.y(last_v) - 400, 900, 0, last_v, max(0.2, land - 1.0), land,
                           fmt="{:,.0f}", prefix="$", rgb=ctx.rgb("ink", (240, 244, 248))))
    x0, y0, _ = chart.tip(0.0); x1, y1, _ = chart.tip(ctx.duration)
    film.shot(0.0, x0, y0 - 800, 0.55, -0.8, strength=0.35, radius=4000)
    film.shot(max(0.4, land - 0.4), x1 - 400, y1 - 200, 0.28, -0.4, radius=8000, strength=0.25)  # climb the spike
    film.shot(land + 0.3, x1, y1, 0.36, -1.0, radius=6000, strength=0.35)
    film.shot(ctx.duration, (x0 + x1) / 2, (y0 + y1) / 2 - 400, 0.16, 0.0, radius=16000, strength=0.12)
    film.cue("riser", max(0.0, land - 1.5), 0.55, dur=1.5)
    film.cue("boom", land, 0.7)
    return film
'''

WORKED_EXAMPLES = (
    "\nWORKED EXAMPLES (patterns of camera, timing, and custom Items — invent a new world for THIS topic;\n"
    "do not reuse these stories, palettes, or place names):\n"
    + EXAMPLE_MAP + "\n" + EXAMPLE_CHART
)


def designer_system(api_reference: str) -> str:
    """Compose the Motion Designer system prompt: role, craft, API contract, worked examples."""
    role = (
        "You are the Motion Designer for a cinematic motion-graphics documentary. Write ONE Python "
        "scene for the Transovo engine. Output JSON {\"code\": \"<python source>\"}. The code must "
        "`from motion_core import *` and define `build_scene(ctx)` returning `film = ctx.film()` "
        "populated with items and camera keys. Design fresh for THIS video and scene. Invent ONE "
        "continuous world from the story's subject. When the world is a map, use ctx.geo / ctx.place "
        "/ ctx.ll, GeoMap, RegionFill, Route, MapPin — do not reimplement a map. When it is a chart, "
        "subclass Item (see the example) with real numbers from ctx.data only. Keep it under ~250 lines.\n"
    )
    return role + CRAFT_GUIDE + api_reference + WORKED_EXAMPLES
