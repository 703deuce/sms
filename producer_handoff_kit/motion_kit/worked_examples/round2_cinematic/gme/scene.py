"""I LIKE THE STOCK: the GameStop squeeze, Jan 2021 (~52 s). Built on cinematic-film + ext.py.

The world is one giant GME candlestick chart (real daily OHLC, pre-split) on a dark trading-terminal grid.
The camera travels the timeline left to right and climbs the spike; story beats arrive as glass app
windows, UI and big type placed at the dates they belong to. All times come from the ElevenLabs word
timings (audio/words.json): every hit is keyed to its spoken word.
"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from ext import (Ambient, AMBER, GREEN, GREY, RED, WHITE, CandleChart, Flash, GemHold, Hero, OrganicFilm, Panel, Particles,
                 PriceTag, Roll, ShortArrow, buy_content, headline_content, per_frame_grain, reddit_content)

LOOK = dict(board="term_grid.png", bg=(6, 8, 12), grade=(0.98, 1.0, 1.03), grain=0.02, glow=0.34, vignette=0.72,
            curve=0.22, dim=(3, 4, 8))
DX, SY = 1400, 26


def words_W(doc):
    words = {int(k): v for k, v in json.loads((doc.dir / "audio" / "words.json").read_text()).items()}
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())

    def W(i, word, nth=0, end=False):
        hits = [w for w in words[i] if norm(w["w"]).startswith(norm(word))]
        if len(hits) <= nth:
            raise ValueError(f"{word!r} not in line {i}: {[w['w'] for w in words[i]]}")
        return hits[nth]["t1" if end else "t0"]
    return W


def build_film(doc):
    per_frame_grain()
    L, E = doc.L, doc.E
    W = words_W(doc)
    film = OrganicFilm(doc.duration, fps=30, look=LOOK)
    film.board.tile = 2400
    shot, cam, foc, cue = film.shot, film.cam, film.focus, film.cue

    data = json.loads((doc.dir / "assets" / "gme_ohlc.json").read_text())
    data = [d for d in data if "2021-01-04" <= d["date"] <= "2021-02-04"]
    idx = {d["date"]: i for i, d in enumerate(data)}
    J = lambda day: idx[f"2021-01-{day:02d}"]
    n = len(data)
    rv = [None] * n
    for i in range(5):                                         # Jan 4-8: flat, drawn under the opening
        rv[i] = L(1) + 0.25 + 0.32 * i
    rv[J(11)], rv[J(12)] = W(5, "Reddit"), W(5, "forum")
    rv[J(13)] = W(6, "loudest")
    for k, d in enumerate((14, 15, 19, 20, 21)):                # they buy... and they hold
        rv[J(d)] = W(7, "buy") + 0.12 + 0.2 * k
    ride = [22, 25, 26, 27]
    t0r, t1r = W(8, "becomes"), W(8, "four")
    for k, d in enumerate(ride):
        rv[J(d)] = t0r + (t1r - t0r) * k / (len(ride) - 1)
    t483 = W(8, "eighty")
    rv[J(28)] = t483 - 0.35
    for k, i in enumerate(range(J(28) + 1, n)):                 # the aftermath, while Congress gathers
        rv[i] = W(10, "button") + 0.5 + 0.28 * k
    crash = W(10, "off")
    d28 = data[J(28)]
    chart = film.add(CandleChart(data, DX, SY, rv, t_in=0.0,
                                 special={J(28): (crash + 0.1, d28["close"], d28["low"], d28["high"])},
                                 labels=((100, W(4, "hundred")), (200, W(8, "becomes")), (300, W(8, "becomes") + 0.2), (400, W(8, "becomes") + 0.4)),
                                 dates=((J(4), "JAN 4", L(1) + 0.3), (J(13), "JAN 13", W(6, "loudest")), (J(22), "JAN 22", W(8, "becomes")),
                                        (J(28), "JAN 28", W(10, "January")), (idx["2021-02-04"], "FEB 4", W(11, "Congress")))))
    X, Y = chart.x, chart.y
    chart.labels_out = [(W(9, "Melvin") - 0.3, W(10, "January")), (W(11, "Congress"), None)]
    film.add(PriceTag(chart, L(1) + 0.6, t_out=W(9, "hedge")))

    # 1 January, 2021.
    film.add(Hero("JANUARY 2021", X(2), -3000, 760, W(1, "January") + 0.05, t_out=W(2, "chain"), hit=0.7))
    film.add(Hero("NYSE: GME", X(2), -2250, 300, W(1, "2021"), font="mono", rgb=AMBER, glow=0.3, hit=None, t_out=W(2, "chain")))
    # 2 struggling mall chain
    film.add(Ambient([(X(3), -1500, 9000, (40, 90, 140), 0.16, 0), (X(6), 0, 7000, (255, 60, 60), 0.10, W(3, "betting")),
                      (X(14), -6000, 12000, (40, 120, 200), 0.12, 0), (X(17), Y(450), 11000, (38, 224, 122), 0.13, W(8, "becomes")),
                      (X(17), Y(200), 9000, (255, 60, 60), 0.12, W(10, "off")), (X(23), -6000, 10000, (80, 120, 255), 0.12, W(11, "Congress"))]))
    store = film.add(Panel(X(2), -6200, 3000, 1890, W(2, "GameStop") - 0.1, title="gamestop.jpg", content="STORE",
                           label="JAN 4: CLOSE $17.25  -8.4%", label_t=W(2, "struggling"), label_rgb=RED, t_out=L(4) + 0.6))
    # 3 betting it fails
    film.add(ShortArrow((X(4) + 500, Y(17.7)), (X(7.2), Y(0) - 60), W(3, "betting"), dur=0.9, label="$0", size=420, t_out=W(5, "Reddit")))
    # 4 140% sold short
    film.add(Roll(X(6.8), -4300, 1500, 0, 140, W(4, "hundred") - 0.05, W(4, "percent") - W(4, "hundred") + 0.25, suffix="%",
                  rgb=RED, caption="SHORT INTEREST, % OF FLOAT", cap_rgb=(255, 150, 150), t_out=W(5, "Reddit") + 0.3, hit=0.9))
    # 5 WallStreetBets sees the trap
    rx, ry = X(10.6), -5600
    film.add(Panel(rx, ry, 3900, 2500, W(5, "Reddit") - 0.05, title="reddit.com", accent=(255, 110, 40),
                   content=reddit_content("GME YOLO update — Jan 13 2021", "u/DeepFuckingValue", W(5, "WallStreetBets"), W(5, "trap") + 0.4,
                                          88400, W(5, "trap")), t_out=L(7) + 0.4))
    # 6 Roaring Kitty
    kx, ky = X(14.2), -6000
    film.add(Panel(kx, ky, 3600, 2025, W(6, "YouTuber") - 0.1, title="youtube.com/roaringkitty", content="KITTY", accent=(255, 60, 60),
                   label="u/DEEPF***INGVALUE", label_t=W(6, "Roaring"), t_out=W(7, "They")))
    # 7 they buy, and they hold
    bx, by = X(11.2), -3900
    film.add(Panel(bx, by, 2700, 1500, W(7, "They") - 0.25, title="robinhood", accent=GREEN, content=buy_content(W(7, "buy")), t_out=L(8) + 0.2))
    cue("click", W(7, "buy") - 0.02, 0.9)
    film.add(Particles((bx, by + 400), (X(12), Y(40)), W(7, "buy"), W(7, "hold") + 0.4, n=90, spread=700))
    film.add(GemHold(X(11.2), -1800, 760, W(7, "hold") - 0.04, t_out=L(8) + 0.2))
    # 8 seventeen dollars becomes four hundred and eighty-three
    film.add(Hero("$17", X(2.2), -1700, 1100, W(8, "Seventeen") - 0.02, rgb=WHITE, t_out=W(8, "four") + 0.3, hit=0.8))
    film.add(Hero("$483", X(J(28)) - 1500, Y(483) - 350, 1400, t483 - 0.02, rgb=GREEN, align="right", glow=0.8, hit=0.75, cue="boom",
                  t_out=W(9, "Capital")))
    film.add(Hero("$483", X(J(28)) - 1500, Y(483) - 350, 1400, W(12, "stock") - 0.6, rgb=GREEN, align="right", glow=0.8, hit=None))   # back for the end card
    film.add(Flash(X(J(28)), Y(483), t483 - 0.05, r=3200))
    # 9 Melvin Capital rescue
    mx, my = X(J(28)) + 4600, Y(483) + 1200
    film.add(Panel(mx, my - 2200, 4200, 1350, W(9, "Melvin") - 0.1, title="terminal  NEWS", accent=AMBER,
                   content=headline_content((("MELVIN CAPITAL", 330, "anton", WHITE), ("POSITION: SHORT GME", 300, "mono", RED))), t_out=L(10) + 0.4))
    film.add(Roll(mx, my + 600, 1000, 0, 2.75, W(9, "two") - 0.05, 1.5, fmt="{:.2f}", prefix="$", suffix="B", rgb=RED,
                  caption="RESCUE FROM CITADEL + POINT72 · JAN 25", cap_rgb=(255, 150, 150), t_out=L(10) + 0.4, hit=1.0))
    # 10 Jan 28: Robinhood turns off the buy button
    film.add(Hero("JAN 28", X(J(28)) + 560, Y(355), 620, W(10, "twenty") - 0.02, font="anton", rgb=AMBER, align="left", glow=0.4, hit=0.6,
                  t_out=W(11, "Congress")))
    film.add(Panel(X(J(28)) + 4400, Y(250), 3400, 1900, W(10, "Robinhood") - 0.15, title="robinhood", accent=(150, 160, 170),
                   content=buy_content(W(10, "Robinhood") + 0.3, t_off=crash, price="$483.00"), t_out=W(11, "Congress") - 0.2))
    cue("stamp", crash - 0.02, 1.0)
    cue("drop", crash + 0.1, 0.8)
    film.add(Flash(X(J(28)), Y(190), crash + 0.15, r=2600, rgb=RED))
    # 11 Congress calls a hearing
    cx_, cy_ = X(21.5), -6800
    film.add(Panel(cx_, cy_, 3800, 2510, W(11, "Congress") - 0.1, title="financialservices.house.gov", content="CAPITOL", accent=(120, 170, 255),
                   label="FEB 18, 2021 · HOUSE HEARING", label_t=W(11, "hearing"), t_out=W(12, "Keith") - 0.2))
    # 12 Keith Gill: I like the stock
    gx, gy = X(25.6), -6600
    film.add(Panel(gx, gy, 2600, 2925, W(12, "Keith") - 0.15, title="hearing feed", content="GILL", accent=(120, 170, 255),
                   label="KEITH GILL", label_t=W(12, "Gill"), t_out=W(12, "I") - 0.1))
    qx, qy = X(7.2), -8600
    film.add(Hero("I LIKE THE STOCK.", qx, qy, 1900, W(12, "I"), words=[("I", W(12, "I")), ("LIKE", W(12, "like")), ("THE", W(12, "the")),
                  ("STOCK.", W(12, "stock"))], colors={3: GREEN}, glow=0.6, hit=0.45))
    cue("boom", W(12, "stock") - 0.03, 0.6)
    # risers into the three big moments (custom additions; the engine's riser peaks at t + dur)
    cue("riser", W(8, "four") - 1.6, 0.55, dur=1.5)
    cue("riser", crash - 1.3, 0.5, dur=1.25)
    cue("riser", W(12, "stock") - 1.1, 0.45, dur=1.05)

    # ================================================= camera (keys in story order; the spline carries momentum through them)
    shot(0.0, X(2) + 400, -2300, 0.62, -1.2, strength=0.35)
    shot(W(1, "2021") + 0.2, X(2), -2800, 0.66, -0.4, strength=0.4, radius=3200)
    shot(W(2, "GameStop") + 0.35, X(2) - 200, -5750, 0.55, 0.3, radius=3600)
    shot(W(2, "chain") + 0.2, X(2) + 200, -5600, 0.52, 0.6, radius=3800)
    shot(W(3, "betting") + 0.4, X(5.4), -700, 0.6, 0.2, radius=5000, strength=0.35)
    shot(W(3, "fails") + 0.3, X(6.0), -550, 0.64, -0.3, radius=5000, strength=0.35)
    shot(W(4, "hundred") + 0.2, X(6.8), -3500, 0.42, -0.5, radius=5200)
    shot(W(4, "short") + 0.1, X(7.3), -3700, 0.45, -0.2, radius=5000)
    shot(W(5, "Reddit") + 0.35, rx - 300, ry - 50, 0.58, 0.4, radius=4000)
    shot(W(5, "trap") + 0.1, rx, ry - 100, 0.68, 0.7, radius=3800)
    shot(W(6, "YouTuber") + 0.3, kx - 200, ky + 400, 0.56, 0.2, radius=4000)
    shot(W(6, "Kitty") + 0.3, kx + 100, ky + 500, 0.6, -0.3, radius=3800)
    shot(W(7, "buy") + 0.1, bx + 200, by + 600, 0.5, -0.6, radius=4200)
    shot(W(7, "hold") + 0.2, bx + 600, -2900, 0.48, -0.2, radius=4500)
    shot(W(8, "Seventeen") + 0.15, X(3.5), -1900, 0.42, 0.3, radius=5000)
    shot(W(8, "becomes") + 0.1, X(9), Y(150), 0.24, 0.0, radius=12000, strength=0.25)       # the climb
    shot(W(8, "four") + 0.3, X(14), Y(330), 0.22, -0.6, radius=12000, strength=0.25)
    shot(t483 + 0.25, X(J(28)) - 2000, Y(483) + 300, 0.36, -1.0, radius=6000, strength=0.35)
    shot(W(9, "fund") + 0.2, X(J(28)) - 900, Y(470) + 400, 0.36, -0.4, radius=6500, strength=0.35)
    shot(W(9, "Capital") + 0.2, mx - 400, my - 900, 0.42, 0.3, radius=5200)
    shot(W(9, "rescue") + 0.2, mx, my - 900, 0.42, 0.6, radius=5000)
    shot(W(10, "January") + 0.1, X(J(28)) + 400, Y(430), 0.34, 0.2, radius=7000, strength=0.35)
    shot(W(10, "Robinhood") + 0.3, X(J(28)) + 2600, Y(270), 0.45, -0.3, radius=5500, strength=0.45)
    shot(crash + 0.5, X(J(28)) + 2000, Y(240), 0.43, -0.6, radius=6000, strength=0.45)
    shot(W(11, "Congress") + 0.35, cx_ - 200, cy_ + 700, 0.5, -0.2, radius=4500)
    shot(W(11, "hearing") + 0.2, cx_ + 400, cy_ + 800, 0.52, 0.2, radius=4500)
    shot(W(12, "Keith") + 0.25, gx - 300, gy + 600, 0.5, 0.5, radius=4500)
    shot(W(12, "tells") + 0.1, gx - 200, gy + 700, 0.53, 0.3, radius=4500)
    shot(W(12, "I") + 0.15, X(14), -7400, 0.15, 0.0, radius=20000, strength=0.15)       # pull back to the whole story
    shot(W(12, "stock", end=True) + 0.5, X(11.2), -6900, 0.122, 0.0, radius=26000, strength=0.1)
    shot(film.duration, X(11.0), -6850, 0.118, 0.0, radius=26000, strength=0.1)
    film.drift_end = W(12, "stock", end=True)
    film.fade_in, film.fade_out = 0.5, 1.2
    return film
