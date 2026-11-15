"""Framework fallback scene (ST-SBX-005/006): safe, always-renderable scene code built only from Part 1
blocks (and stock maps). Chosen by the Director's world type so a map story
falls back to a map, a price story to a chart, not always the same grid. Runs through the same sandbox path as generated code, so there is one render path."""

FALLBACK_CODE = r'''
from motion_core import *
import math


def build_scene(ctx):
    film = ctx.film(drift=1.0, wobble=1.0)
    D = ctx.duration
    bg = ctx.rgb("bg", (12, 14, 20))
    ink = ctx.rgb("ink", (240, 240, 240))
    acc = ctx.rgb("accent", (255, 196, 0))
    acc2 = ctx.rgb("accent2", (90, 200, 255))
    muted = ctx.rgb("muted", (120, 130, 150))
    lift = tuple(min(255, int(c * 1.9 + 14)) for c in bg)
    film.add(GradientField([lift, bg, tuple(int(c * 0.5) for c in bg)], center=(0, 0), radius=14000))
    film.add(GridField(spacing=420, rgb=muted, alpha=0.07, major=5))
    film.add(ParticleDrift(area=(-9000, -6000, 18000, 12000), n=170, rgb=ink, alpha=0.18, seed=ctx.seed % 997 + 1))
    film.add(NoiseTexture(seed=ctx.seed % 13 + 1, alpha=0.05, rgb=ink))
    lines = ctx.lines or []
    data = ctx.data or []
    preferred = ((ctx.scene or {}) if getattr(ctx, "scene", None) else {}).get("assetId")
    photos = [k for k, v in (ctx.assets or {}).items() if v.get("kind") in ("photo", "image", "still")]
    if preferred and preferred in (ctx.assets or {}):
        photos = [preferred] + [k for k in photos if k != preferred]
    n = max(1, len(lines))
    pos = []
    for i in range(n):
        ang = i * 2.1 + 0.4
        pos.append((math.cos(ang) * 2600 * min(i, 1) + i * 2200, math.sin(ang) * 1300))
    film.cam(0.0, pos[0][0] - 500, pos[0][1] + 200, 0.42)
    di = 0
    for i, ln in enumerate(lines):
        x, y = pos[i]
        t0 = max(0.0, float(ln.get("start", 0.0)))
        t1 = min(D, float(ln.get("end", t0 + 2.0)))
        hero = (ln.get("hero") or "").strip()
        if not hero:
            words = [w for w in (ln.get("text") or "").split() if len(w) > 3]
            hero = " ".join(words[:3]) if words else (ln.get("text") or "")[:24]
        hero = hero.upper()[:28]
        film.shot(max(0.0, t0 - 0.35), x, y, 0.62, radius=1700, strength=0.35)
        film.cam(min(D, t1), x + 160, y - 60, 0.7)
        film.add(HeroSlam(hero, x, y, 300, t0 + 0.05, None, rgb=ink, glow=0.35))
        film.add(EmphasisMark("underline", x, y + 70, min(2600, len(hero) * 170), 40, t0 + 0.45, rgb=acc))
        if di < len(data) and data[di].get("value") is not None:
            d = data[di]
            di += 1
            try:
                v = float(d.get("value"))
                film.add(RollingNumber(x, y + 520, 260, 0, v, t0 + 0.3, min(t1, t0 + 1.4), fmt="{:,.0f}",
                                       suffix=str(d.get("unit") or ""), caption=str(d.get("label") or "")[:40], rgb=acc))
            except (TypeError, ValueError):
                pass
        elif photos:
            k = photos[i % len(photos)]
            film.add(PhotoFrame(k, x - 1700, y + 300, 1300, rot=-3 + 6 * (i % 2), t_in=t0 + 0.2, skin="print"))
        else:
            film.add(Callout((ln.get("text") or "")[:34], x + 900, y - 420, t0 + 0.5, None, accent=acc2, size=96))
        if i > 0:
            film.add(Connector((pos[i - 1][0], pos[i - 1][1] + 160), (x, y + 160), max(0.0, t0 - 0.4), dur=0.7, rgb=muted, dashed=True))
    if not lines:
        film.add(HeroSlam("", 0, 0, 300, 0.1))
    film.cam(D, pos[-1][0] + 400, pos[-1][1] - 100, 0.5)
    return film
'''


FALLBACK_MAP = r"""
from motion_core import *


def build_scene(ctx):
    film = ctx.film(drift=0.8, wobble=0.7)
    ink = ctx.rgb("ink", (240, 240, 240))
    acc = ctx.rgb("accent", (255, 196, 0))
    acc2 = ctx.rgb("accent2", (90, 200, 255))
    bg = ctx.rgb("bg", (12, 22, 24))
    look = dict(sheet=tuple(max(0, int(c * 0.55)) for c in bg),
                water=tuple(min(255, int(c * 1.3 + 8)) for c in bg),
                land=tuple(min(255, int(c * 2.2 + 20)) for c in bg),
                border=acc2, relief=0.18, neighbor=tuple(int(c * 0.8) for c in bg),
                neighbor_line=acc2, dark=tuple(int(c * 0.45) for c in bg),
                dark_line=acc, frame=acc2)
    world = film.add(ctx.geo("world", K=20000, look=look))
    lines = ctx.lines or []
    names = list((world.data.get("places") or {}).keys())
    # Prefer place names mentioned in the lines; otherwise a short world tour.
    picked = []
    blob = " ".join((ln.get("text") or "") + " " + (ln.get("hero") or "") for ln in lines).lower()
    for n in names:
        if n.lower() in blob and n not in picked:
            picked.append(n)
    if not picked:
        picked = [n for n in ("Chicago", "London", "Tokyo", "Paris", "Lagos", "Sydney") if n in (world.data.get("places") or {})]
    if not picked:
        picked = names[:4]
    pts = [ctx.place(world, n) for n in picked]
    if pts:
        film.cam(0.0, pts[0][0] - 400, pts[0][1] + 200, 0.28)
    for i, (n, (x, y)) in enumerate(zip(picked, pts)):
        t0 = 0.15 if not lines else max(0.0, float((lines[min(i, len(lines) - 1)]).get("start", 0.15)))
        film.add(MapPin(x, y, n, t0))
        if i:
            film.add(Route(pts[i - 1], (x, y), max(0.0, t0 - 0.35), dur=0.7, rgb=acc))
        film.shot(t0, x, y, 0.7, radius=2200, strength=0.35)
        hero = ""
        if i < len(lines):
            hero = (lines[i].get("hero") or "").strip() or (lines[i].get("text") or "")[:28]
        film.add(HeroSlam((hero or n).upper()[:28], x, y - 520, 280, t0 + 0.05, None, rgb=ink, glow=0.35))
    if pts:
        film.cam(ctx.duration, pts[-1][0] + 300, pts[-1][1] - 200, 0.35)
    return film
"""

FALLBACK_CHART = r"""
from motion_core import *


def build_scene(ctx):
    film = ctx.film(drift=0.9, wobble=0.8)
    bg = ctx.rgb("bg", (8, 10, 16))
    ink = ctx.rgb("ink", (240, 240, 240))
    acc = ctx.rgb("accent", (80, 220, 140))
    acc2 = ctx.rgb("accent2", (220, 70, 70))
    muted = ctx.rgb("muted", (90, 100, 120))
    lift = tuple(min(255, int(c * 1.8 + 10)) for c in bg)
    film.add(GradientField([lift, bg, tuple(int(c * 0.4) for c in bg)], center=(0, 0), radius=18000))
    film.add(GridField(spacing=360, rgb=muted, alpha=0.10, major=5))
    film.add(NoiseTexture(seed=ctx.seed % 11 + 1, alpha=0.05, rgb=ink))
    data = list(ctx.data or [])
    vals = []
    for d in data:
        try:
            vals.append(float(d.get("value")))
        except (TypeError, ValueError):
            pass
    if not vals:
        rng = ctx.rand
        vals = [40 + rng.random() * 20]
        for _ in range(7):
            vals.append(max(2.0, vals[-1] * (0.85 + rng.random() * 0.5)))
    xs = list(range(len(vals)))
    axis = LinearAxis(0, max(len(vals) - 1, 1), -3200, 3200)
    ymax = max(vals) * 1.15 or 1.0
    yx = LinearAxis(0, ymax, 1400, -1400)
    pts = [(axis(i), yx(v)) for i, v in enumerate(vals)]
    lines = ctx.lines or []
    t0 = float(lines[0]["start"]) if lines else 0.2
    t1 = float(lines[-1]["end"]) if lines else min(ctx.duration, 3.0)
    film.add(LineSeries(pts, t0, t1, acc, width=16, fill_to=yx(0)))
    film.cam(0.0, 0, 0, 0.4)
    for i, ln in enumerate(lines):
        ts, te = float(ln.get("start", t0)), float(ln.get("end", t1))
        hero = (ln.get("hero") or ln.get("text") or "")[:28].upper()
        x = pts[min(i, len(pts) - 1)][0]
        y = pts[min(i, len(pts) - 1)][1] - 400
        film.shot(ts, x, y + 200, 0.7, radius=2000, strength=0.3)
        film.add(HeroSlam(hero, x, y, 260, ts + 0.05, None, rgb=ink, glow=0.3))
        if i < len(vals):
            film.add(RollingNumber(x, y + 480, 200, 0, vals[min(i, len(vals) - 1)], ts + 0.2, min(te, ts + 1.2),
                                   fmt="{:,.0f}", rgb=acc if vals[min(i, len(vals) - 1)] >= vals[0] else acc2))
        film.cam(te, x + 120, y, 0.65)
    film.cam(ctx.duration, pts[-1][0], pts[-1][1] - 200, 0.45)
    return film
"""


def fallback_code(ctx: dict | None = None) -> str:
    """Pick a world-appropriate framework scene so the fallback is not always the same grid."""
    ctx = ctx or {}
    scene = ctx.get("scene") or {}
    world = str(scene.get("world") or ctx.get("world") or "").lower()
    vt = str(scene.get("visualType") or "").lower()
    # A photo beat must keep the still, even when the film world is a map or city grid.
    if vt == "photo" or scene.get("assetId"):
        return FALLBACK_CODE
    if world in {"map", "city_grid"} or vt == "map":
        return FALLBACK_MAP
    if world in {"price_chart", "timeline"} or vt in {"data", "timeline"}:
        return FALLBACK_CHART
    return FALLBACK_CODE
