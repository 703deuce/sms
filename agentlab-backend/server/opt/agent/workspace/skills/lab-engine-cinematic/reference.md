# Cinematic Skill: reference (tested on this lab, Nov 26 2026, 854x480)

Upstream docs: `$CS/SKILL.md`, `$CS/references/film.md` (items, camera, looks), `story.md`, `voice.md`,
`sound.md`, `archive.md`, `performance.md`. Worked example: `python3 new_project.py demo --example` (Wright Flyer).
Unattended runs: the upstream **Gate** steps (beats, look test, draft) are self-reviewed, not sent for approval.

## Footage RETURN (real clips in the Cinematic world)
The engine cannot play video itself; footage enters by RETURN:
1. A `Print` holds the clip's first frame (`ffmpeg -ss <in> -i clip.mp4 -frames:v 1 assets/photos/<id>_first.jpg`).
2. The camera pushes in on that print until it fills the frame; cut to the clip, full-frame.
3. At the clip's end, cut back to a print holding its last frame and pull out into the world.
4. Check on stills on both sides of each cut (the print frame and the clip's first/last frame must match).
A hard cut straight to the clip is fine when the story wants it. Frames from news clips also work as plain prints:
`ffmpeg -ss 12 -i clip.mp4 -frames:v 1 assets/photos/c1.jpg`.

## Documentary board scene (tested: renders 9 s at 854x480 in 16 s, 1.2 MB at --crf 26)
```python
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
```
Rules shown: one hero per beat, camera lands ~0.3 s after the item, push-in on the hit word, pull-back to end on
the whole board as one composition, spotlight on the hero, string/route to travel between clusters (no empty
whips: keep clusters ~one print width apart and move while something draws on).

## Item quick table (all take t_out, z, sfx=False)
| Item | Use |
|---|---|
| `Print(key, x, y, w, rot, t_in, label=, label_t=, paper=True, pin=False)` | photo/clipping/doc (key from photos.json) |
| `FilmFrame(print, t_in)` | film-strip bands: a still that came from footage |
| `PaperDoc(x, y, w, h, header=, sentence=)` | typeset document recreation (label it as one) |
| `Card(x, y, w, h, t_in, title=, lines=, accent=)` | clean panel for explainers |
| `BigText(text, x, y, size, t_in, bar=, bar_h=, type_on=, hit=)` | titles, years, names |
| `Counter(x, y, size, value, t_in, dur=, prefix=, suffix=, caption=, rgb=)` | numbers rolling up |
| `Stamp(text, x, y, size, rot, t_in)` | verdict/turn word, shakes camera |
| `PenMark(kind, x, y, w, h, t_in, dur=)` | ellipse, underline, strike, arrow, highlight |
| `StringLine(a, b, t_in, dur=, persist=)` | links; `doc.on(print, fx, fy)` gives pin points |
| `GeoMap(doc.map(name), K)`, `MapPin`, `XMarker`, `Route(a, b, t_in, bend=)`, `RegionFill` | maps and travel |
| `DotField(points, t0, t1)`, `Chalk(x, y, times)`, `Holes`, `Ledger`, `OpenLedger` | counts, tallies, records |
`film.look["grain"|"glow"|"vignette"|"grade"|"dim"]` adjusts the finish; `film.room_tone=[[t0,t1]]` adds a bed.

## Mixed film with Remotion: one clock, segments on it
1. Voice once here -> `audio/timing.json`, `audio/narration.m4a`.
2. Scene plan assigns each line range to an engine. Build ONE scene.py for the whole timeline (the board can
   stay sparse where Remotion takes over) and render only Cinematic ranges: `--t0 a --t1 b --out out/segNN.mp4`.
3. Remotion compositions use the same `t0/t1` (lab-engine-remotion). Boundaries on line starts.
4. Cues for the whole film: `render.py --cues` writes `sfx_cues.json` = `{"duration", "cues":[{"type","t","gain",
   "dur"?}], "room_tone"}`. Drop cues that fall inside Remotion ranges, append the Remotion hits, then
   `build_sfx.py` (snippet in lab-video-edit/reference.md).
5. `mix_soundtrack.py --project $P --music <bed> --lufs -14` -> `audio/mix.m4a`; the editor concats and muxes.

## Voice notes
- ElevenLabs via `tts` (`tts --help` lists voices; pick a calm, low documentary voice; one call per take keeps delivery even). Spoken text
  spells out numbers. `build_narration.py --target 30` fits length (0.90-1.15x tempo only).
- Flagged line splits: listen, then `audio/overrides.json` `{"cut_before": {"4": 7.8}}` and rerun split.

## Sources
- Cinematic Skill repository and docs (MIT): /opt/engines/repos/cinematic-skill (README, skills/cinematic-film)
- Camera language and parallax principles: see lab-video-motion/reference.md
