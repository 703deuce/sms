"""Documentary board scene (any topic): two clusters, prints in frames, a number, a verdict stamp, a string,
camera push-ins and a final pull-back. Lines 1-6 come from script.json; words are looked up in spoken text."""
from engine import BigText, Counter, FilmFrame, Film, PenMark, Print, Stamp, StringLine

ACCENT, HILITE = (214, 58, 47), (240, 200, 60)
A = (0, 0)            # cluster 1: the event
B = (6200, 900)      # cluster 2: the outcome


def build_film(doc):
    L, E, W = doc.L, doc.E, doc.W
    film = Film(doc.duration, fps=30, look="slate")

    # 1 hook: a big line types on, the key word is underlined on its spoken word
    film.add(BigText("ONE DECISION", A[0], A[1] - 1500, 620, L(1), type_on=0.5, hit=0.6))
    film.add(PenMark("underline", A[0], A[1] - 1250, 4200, 60, t_in=W(1, "cherry") - 0.15, dur=0.4, width=30, rgb=ACCENT))

    # 2 the main photo lands as a framed print with a name bar; film-strip frame because it came from footage
    p1 = film.add(Print("P01", A[0] - 900, A[1] + 600, 3000, rot=-2.0, t_in=L(2) + 0.05))   # label= would sit under the film strip; credit goes in sources.md
    film.add(FilmFrame(p1, L(2) + 0.3))

    # 3 a number rolls up beside it, highlighted
    film.add(Counter(A[0] + 2300, A[1] + 300, 520, 200, W(4, "two") - 0.1, dur=1.0, suffix=" DAYS", caption="SOURCE: OFFICIAL RECORD", rgb=HILITE))

    # 4-5 string from the event to the outcome cluster, outcome print and a verdict stamp on the hit word
    p2 = film.add(Print("P01", B[0], B[1], 2800, rot=1.5, t_in=L(5) - 0.2, label="THE OUTCOME", label_t=L(5) + 0.4))
    film.add(StringLine(doc.on(p1, 0.9, 0.1), doc.on(p2, 0.1, 0.1), t_in=L(5) - 0.4, dur=0.8))
    film.add(Stamp("DECIDED", B[0] + 200, B[1] + 200, size=300, rot=-8, t_in=W(5, "poured") - 0.05))

    # camera: start close on the title, push in on each hero ~0.3 s after it lands, whip to B, pull back to end
    film.shot(0.0, A[0], A[1] - 1500, 0.75, rot=-0.5)
    film.shot(E(1), A[0], A[1] - 1300, 0.85)
    film.shot(L(2) + 0.35, A[0] - 900, A[1] + 500, 0.62, rot=0.6)
    film.shot(E(2), A[0] - 700, A[1] + 550, 0.72)
    film.shot(W(4, "two") + 0.3, A[0] + 2300, A[1] + 300, 0.8, rot=-0.4)   # land on the number
    film.shot(L(5) - 0.3, A[0] + 2600, A[1] + 500, 0.45)               # pull back as the string starts
    film.shot(L(5) + 0.5, B[0], B[1] + 100, 0.62)                 # follow it to the outcome
    film.shot(W(5, "poured") + 0.3, B[0] + 150, B[1] + 150, 0.95, rot=0.8)   # push in on the stamp
    film.shot(L(6) + 0.5, (A[0] + B[0]) / 2, 400, 0.3)
    film.shot(film.duration, (A[0] + B[0]) / 2, 400, 0.26, radius=20000, strength=0.1)
    film.focus(L(2) + 0.3, A[0] - 900, A[1] + 600, 2600, 0.5)
    return film
