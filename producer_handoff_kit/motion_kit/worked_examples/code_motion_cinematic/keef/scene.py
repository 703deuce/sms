"""LOVE SOSA: how drill took over. Chief Keef, 2011-2012, ~40 s. Built on cinematic-film (engine.py).

One continuous camera over one dark-teal world map: Chicago's cluster runs east across North America
(house arrest -> I Don't Like -> Kanye -> Interscope -> Love Sosa), DRILL lands over the Atlantic, the
camera whips back to the South Side, pulls wide as routes reach Brooklyn and London, then dives back
into the grandma's-house video still.

Timing: doc.L / doc.E from timing.json; doc.W is upgraded to real edge-tts word boundaries
(audio/words.json, written by word_times.py) and falls back to the engine's letter-share estimate.
"""
import json, math, re
import skia
from engine import (CREAM, WHITE, BigText, Counter, DotField, Film, FilmFrame, GeoMap, Item, PenMark, Print,
                    Route, Stamp, StringLine, draw_text, ease_out_back, ease_out_cubic, paint, ramp)

K = 10000
RED = (214, 38, 30)
INKW = (240, 232, 214)          # cream type
LOOK = dict(board="teal_board.png", bg=(9, 22, 24), grade=(0.97, 1.0, 1.0), grain=0.032, glow=0.30, vignette=0.85,
            curve=0.26, dim=(2, 9, 10))
MAPLOOK = dict(sheet=(13, 31, 34), water=(15, 36, 39), land=(36, 70, 72), border=(96, 138, 134), relief=0.18,
               neighbor=(36, 70, 72), neighbor_line=(96, 138, 134), dark=(36, 70, 72), dark_line=(96, 138, 134), frame=(13, 31, 34))


class GlowPin(Item):
    """Glowing red map pin with a pulse ring and a cream mono label that types on (reference look)."""
    z = 30

    def __init__(self, x, y, label=None, t_in=0.0, t_out=None, side="right", size=1.0, label_size=150, sfx=True):
        super().__init__(t_in, t_out, None, sfx)
        self.x, self.y, self.label, self.side, self.k, self.ls = x, y, label, side, size, label_size

    def bounds(self, res):
        L = len(self.label or "") * self.ls * 0.8 + 600 * self.k
        return skia.Rect.MakeLTRB(self.x - L, self.y - 600 * self.k, self.x + L, self.y + 600 * self.k)

    def cues(self):
        return [("pop", self.t_in, 0.5, {})]

    def draw(self, c, res, t):
        u = ramp(t, self.t_in, 0.35); a = u * self.fade(t)
        if a <= 0:
            return
        k = self.k; ph = (t - self.t_in) % 1.8 / 1.8
        c.drawCircle(self.x, self.y, 40 * k + 220 * k * ph, paint(RED, 0.5 * (1 - ph) * a, stroke=10 * k))
        c.drawCircle(self.x, self.y, 150 * k, paint(RED, 0.30 * a, blur=70 * k))
        c.drawCircle(self.x, self.y, 38 * k * ease_out_back(u), paint(RED, a))
        c.drawCircle(self.x, self.y, 15 * k, paint((255, 214, 200), a))
        if self.label:
            s = 1 if self.side == "right" else -1
            n = len(self.label) * ease_out_cubic(ramp(t, self.t_in + 0.15, 0.04 * len(self.label) + 0.15))
            la = ramp(t, self.t_in + 0.1, 0.3) * self.fade(t)
            x = self.x + s * 110 * k; y = self.y + self.ls * 0.36
            c.save(); c.translate(4, 8)
            draw_text(c, res, self.label, x, y, self.ls, "mono", (0, 0, 0), 0.6 * la, 0.12, "left" if s > 0 else "right", reveal=n + 0.999)
            c.restore()
            draw_text(c, res, self.label, x, y, self.ls, "mono", INKW, la, 0.12, "left" if s > 0 else "right", reveal=n + 0.999)


class SlamText(BigText):
    """BigText that lands on the beat: the engine's 0.5 s fade-in runs 3x faster (then normal time)."""
    def draw(self, c, res, t):
        d = t - self.t_in
        super().draw(c, res, self.t_in + (3 * d if d < 0.4 else d + 0.8))


def real_word_times(doc):
    """Replace doc.W's letter-share estimate with the voice's actual word boundaries."""
    p = doc.dir / "audio" / "words.json"
    if not p.exists():
        return
    words = {int(k): v for k, v in json.loads(p.read_text()).items()}
    est = doc.W
    norm = lambda s: re.sub(r"[^a-z]", "", s.lower())

    def W(i, word, nth=0):
        first = norm(word.split()[0])
        hits = [w for w in words.get(i, []) if norm(w["w"]) == first]
        if len(hits) > nth:
            return hits[nth]["t0"]
        return est(i, word, nth)
    doc.W = W


def build_film(doc):
    real_word_times(doc)
    L, E, W = doc.L, doc.E, doc.W
    film = Film(doc.duration, fps=30, look=LOOK)
    shot, cam, foc = film.shot, film.cam, film.focus

    world = film.add(GeoMap(doc.map("world"), K, look=MAPLOOK))
    cx, cy = world.place("Chicago")
    bk, ldn = world.place("Brooklyn"), world.place("London")
    P = lambda dx, dy: (cx + dx, cy + dy)

    # ================================================= 1. 2011. Chicago's South Side.
    film.add(SlamText("2011", *P(0, -1500), 1000, L(1) - 0.15, t_out=L(3) - 0.2, font="serif", rgb=INKW, type_on=0.0, grunge=False, hit=0.5))
    film.add(GlowPin(cx, cy, "SOUTH SIDE, CHICAGO", t_in=W(1, "Chicago's") - 0.05, label_size=210, size=1.8))

    # ================================================= 2. Keith Cozart, 16, house arrest
    kx, ky = P(-3400, 3000)
    keef = film.add(Print("P01", kx, ky, 2000, rot=-1.6, t_in=W(2, "sixteen") - 0.1, label="KEITH COZART, 16", label_t=W(2, "Keith")))
    film.add(Stamp("HOUSE ARREST", kx + 80, ky + 520, size=250, rot=-8, t_in=W(2, "arrest") - 0.06, rgb=(196, 30, 24)))

    # ================================================= 3. films music videos, right there
    vx, vy = P(300, 3300)
    vid = film.add(Print("P02", vx, vy, 2900, rot=1.0, t_in=W(3, "films") - 0.15))
    film.add(FilmFrame(vid, W(3, "videos") - 0.1))
    film.add(PenMark("ellipse", vx, vy, 3900, 2600, t_in=W(3, "there") - 0.15, dur=0.5, width=26, seed=3, rot=-2, rgb=RED, t_out=L(4) + 0.3))

    # ================================================= 4. 2012. I Don't Like hits YouTube
    film.add(BigText("“I DON'T LIKE”", vx, vy + 1950, 430, W(4, "I") - 0.05, font="serif", rgb=INKW, type_on=0.55, grunge=False))

    # ================================================= 5. Kanye hears it, and remixes it
    yx, yy = P(4400, 2900)
    film.add(Print("P03", yx, yy, 1700, rot=1.8, t_in=W(5, "Kanye") - 0.15, label="KANYE WEST", label_t=W(5, "Kanye") + 0.1))
    film.add(StringLine((vx + 1300, vy - 760), (yx - 30, yy - 960), t_in=W(5, "remixes") - 0.1, dur=0.6, sag=0.12, width=18, hold=3.0))

    # ================================================= 6. Interscope, reported $6M
    fx, fy = P(8100, 2600)
    film.add(Print("P04", fx, fy, 1800, rot=-1.2, t_in=W(6, "Interscope") - 0.1, label="INTERSCOPE", label_t=W(6, "signs")))
    film.add(Counter(fx, fy + 2250, 600, 6000000, W(6, "six") - 0.1, dur=1.0, prefix="$", caption="REPORTED · THREE ALBUMS", rgb=INKW))

    # ================================================= 7. Love Sosa goes everywhere
    sx, sy = P(11700, 2900)
    film.add(Print("P05", sx, sy, 1800, rot=1.4, t_in=W(7, "Love") - 0.15))
    film.add(PenMark("ellipse", sx, sy, 2500, 2500, t_in=W(7, "everywhere") - 0.15, dur=0.5, width=24, seed=7, rot=4, rgb=RED, t_out=L(8) + 0.5))

    # ================================================= 8-9. DRILL. Dark. Slow. Raw.
    dx_, dy_ = P(9300, -1900)
    film.add(SlamText("DRILL", dx_, dy_, 1200, W(8, "Drill") - 0.2, font="serif", rgb=INKW, grunge=False, hit=0.9, t_out=L(11) + 0.2, track=0.12))
    film.add(PenMark("ellipse", dx_, dy_ - 420, 5000, 1650, t_in=W(8, "Drill") + 0.15, dur=0.55, width=30, seed=11, rot=-2, rgb=RED, t_out=L(11) + 0.2))
    for j, (wd, off) in enumerate((("DARK.", -1650), ("SLOW.", 0), ("RAW.", 1650))):
        film.add(SlamText(wd, dx_ + off, dy_ + 1100, 420, W(9, wd.strip(".")) - 0.05, font="mono", rgb=INKW if j < 2 else RED,
                         grunge=False, hit=0.35, t_out=L(11) + 0.2))

    # ================================================= 10. Built on the streets of Chicago
    px, py = P(2900, -2700)
    film.add(Print("P06", px, py, 2700, rot=-1.0, t_in=W(10, "Built") - 0.1, label="PARKWAY GARDENS · SOUTH SIDE", label_t=W(10, "streets")))
    film.add(StringLine((cx + 60, cy - 40), (px - 1250, py + 700), t_in=W(10, "streets") - 0.1, dur=0.5, sag=0.05, width=16, persist=True))

    # ================================================= 11. it spreads. London. Brooklyn. world.
    film.add(Route((cx, cy), ldn, t_in=W(11, "spreads") - 0.05, dur=1.3, bend=-0.12, width=70, rgb=(236, 72, 58)))
    film.add(GlowPin(*ldn, "LONDON", t_in=W(11, "London") - 0.05, size=4.0, label_size=460))
    film.add(Route((cx, cy), bk, t_in=W(11, "London") + 0.1, dur=0.6, bend=-0.3, width=60, rgb=(236, 72, 58)))
    film.add(GlowPin(*bk, "BROOKLYN", t_in=W(11, "Brooklyn") - 0.05, size=4.0, label_size=460))
    cities = ["Toronto", "Atlanta", "Paris", "Amsterdam", "Dublin", "Berlin", "Los Angeles", "Houston", "Stockholm", "Madrid",
              "Lagos", "Accra", "Montreal"]
    film.add(DotField([world.place(n) for n in cities], W(11, "Around") - 0.05, E(11) + 0.2, rgb=RED, r=120, t_out=L(12) + 0.4))

    # ================================================= 12. a kid with a camera, at his grandma's house
    film.add(PenMark("ellipse", vx, vy, 3900, 2600, t_in=W(12, "camera") - 0.1, dur=0.55, width=30, seed=19, rot=2, rgb=RED))

    # ================================================= camera + spotlight
    shot(0.0, cx, cy - 2300, 0.95, -1.0, strength=0.5)
    shot(W(1, "Chicago's") - 0.3, cx + 100, cy - 1800, 0.80, -0.6, strength=0.45)
    shot(E(1) - 0.2, cx + 900, cy - 1000, 0.62, 0.0, radius=3400, strength=0.4)
    shot(L(2) + 0.25, cx + 700, cy - 800, 0.60, -0.2, radius=3400, strength=0.4)          # the year + the pin
    shot(L(2) + 1.0, kx - 50, ky + 120, 0.74, -0.8)
    shot(W(2, "arrest") + 0.25, kx + 30, ky + 280, 0.84, -0.5)
    shot(E(2) + 0.1, kx + 200, ky + 300, 0.86, -0.3)
    shot(W(3, "films") + 0.3, vx - 150, vy + 50, 0.86, 0.4)
    shot(W(3, "there") + 0.1, vx, vy + 100, 0.72, 0.6)
    shot(E(3) + 0.3, vx, vy + 400, 0.68, 0.4)
    shot(W(4, "I") + 0.3, vx + 50, vy + 900, 0.66, 0.0)
    shot(E(4) + 0.1, vx + 250, vy + 900, 0.64, -0.2)
    shot(W(5, "Kanye") + 0.2, yx - 1200, yy + 100, 0.55, -0.4, radius=3600)
    shot(W(5, "remixes") + 0.3, yx - 200, yy + 150, 0.74, 0.0)
    shot(E(5) + 0.1, yx + 100, yy + 200, 0.78, 0.3)
    shot(W(6, "Interscope") + 0.3, fx, fy + 500, 0.64, 0.6)
    shot(W(6, "six") + 0.2, fx, fy + 720, 0.50, 0.3, radius=3600)
    shot(E(6) + 0.1, fx + 150, fy + 760, 0.51, 0.0, radius=3600)
    shot(W(7, "Love") + 0.3, sx, sy + 100, 0.78, -0.5)
    shot(E(7) + 0.3, sx + 200, sy + 50, 0.72, -0.6)
    shot(W(8, "learns"), sx + 300, sy + 20, 0.70, -0.6)
    foc((W(8, "learns") + W(8, "Drill")) / 2 + 0.1, (sx + dx_) / 2, (sy + dy_) / 2, 9000, 0.2)
    shot(W(8, "Drill") + 0.05, dx_, dy_ - 200, 0.52, 0.0)
    shot(E(8) + 0.2, dx_ + 50, dy_ + 150, 0.51, 0.2)
    shot(W(9, "Slow"), dx_ + 50, dy_ + 350, 0.51, 0.3)
    shot(E(9) + 0.15, dx_ + 100, dy_ + 400, 0.50, 0.4)
    cam(L(10) - 0.05, (dx_ + px) / 2, (dy_ + py) / 2, 0.24, 0.2)                          # whip back west
    foc(L(10) - 0.05, (dx_ + px) / 2, (dy_ + py) / 2, 9000, 0.25)
    shot(W(10, "streets") + 0.2, px - 300, py + 200, 0.70, -0.4)
    shot(E(10) + 0.15, px - 600, py + 300, 0.62, -0.6, radius=3200)
    cam(W(11, "London") - 0.1, cx + 7800, cy - 900, 0.23, -0.2)                            # pull wide: the spread
    foc(W(11, "London") - 0.1, cx + 7800, cy - 900, 12000, 0.15)
    cam(W(11, "Around") + 0.2, cx + 8500, cy - 800, 0.205, 0.0)
    foc(W(11, "Around"), cx + 8500, cy - 800, 16000, 0.08)
    cam(E(11) + 0.15, cx + 8600, cy - 700, 0.2, 0.0)
    shot(W(12, "kid") + 0.1, vx + 200, vy - 100, 0.62, 0.4, radius=3000)                   # dive back to the house
    shot(W(12, "camera") + 0.3, vx + 50, vy + 50, 0.66, 0.6)
    shot(E(12) + 0.2, vx, vy + 50, 0.60, 0.5)
    shot(film.duration, vx - 100, vy + 350, 0.46, 0.2, radius=4200)

    film.cue("riser", W(8, "Drill") - 1.3, 0.45, dur=1.3)
    film.cue("boom", W(8, "Drill") - 0.05, 0.6)
    film.cue("riser", L(11) - 0.4, 0.3, dur=1.0)
    film.fade_in, film.fade_out = 0.6, 1.6
    return film
