"""Framework fallback scene (ST-SBX-005/006): safe, always-renderable scene code built only from Part 1
blocks. Runs through the same sandbox path as generated code, so there is one render path."""

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
    photos = [k for k, v in (ctx.assets or {}).items() if v.get("kind") in ("photo", "image", "still")]
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
