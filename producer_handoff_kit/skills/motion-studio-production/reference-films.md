# The quality bar: how the Keef and GameStop films were made

Two Cinematic Skill films are Rick's reference for what "good" means. Study them, then make something *different* that is just as good. Never copy their worlds.

| Film | Source | Watchable output on this box |
|---|---|---|
| **"Love Sosa: how drill took over"** (Chief Keef, ~40 s), one dark-teal **world map** fly-through | `/workspace/motion_kit/code_motion_cinematic/keef/` (`scene.py` 199 lines, `script.json`, `beats.md`, `photos.json`, `map.json`, `sfx_cues.json`, `credits.md`, `audio/words.json`) | `/workspace/motion_kit/films/film2.mp4` (50.6 s: the film **with the "I Don't Like" footage return**) |
| **"I Like the Stock"** (GameStop squeeze, ~52 s), one giant **candlestick-chart trading terminal** | `/workspace/motion_kit/round2_cinematic/gme/` (`scene.py`, `ext.py` 661 lines of custom components, `music.py`, `audit.py`, `measure_mix.py`, `audio/facts.md`, `audio/words.json`), plus `../NOTES.md`, `../credits.txt` | `/workspace/motion_kit/films/film1.mp4` (62.7 s: the film **with the CNBC "I like the stock" return**) |
| Footage insert / return tests | `/workspace/motion_kit/keef_insert_test/{assemble.py,render_transitions.py,credits.txt}`, `/workspace/motion_kit/gme_insert_test/{build.py,credits.txt}` | (as above) |
| Evidence record of the whole process | `/workspace/motion_kit/transovo_team/HANDOVER-motion-studio.md` §7 (stages S1–S16 and §3 "Cinematic Media Handoff") | — |

Make a contact sheet of each reference once per bot copy, and look at it:
`python3 scripts/qa_report.py /workspace/motion_kit/films/film1.mp4 --out /tmp/ref_gme --every 2`.

**Path note:** the kit scripts refer to `/workspace/code_motion_cinematic/…` and `/workspace/round2_cinematic/…`, the paths before the move. Both now live under `/workspace/motion_kit/`.

---

## What makes them good (the visible techniques)

1. **One world per film, invented from the story.** Keef's story *travels* (South Side → US labels → "Drill" over the Atlantic → London/Brooklyn), so the world is a map. GameStop's story *is* a price, so the world is the chart itself: the camera travels the timeline left to right and climbs the spike, and the human beats arrive as glass app windows placed at their dates. Three different engines independently chose the chart world for GME, which suggests a rule: **when the data is the story, the data is the world.**
2. **One anchor motif.** Keef: a glowing red pin plus red pen circles on black-and-white prints. GME: green/red candles plus glass panels on a dark terminal grid.
3. **Clusters with room.** Each story beat has its own place in the world (Keef: offsets like `P(-3400, 3000)`, `P(4400, 2900)` from Chicago, 4K world units, map scale `K = 10000`), so the camera always has somewhere to go and something to land on.
4. **The camera is always travelling.**
   - Keef keys a `shot()` (camera + spotlight) on almost every hit word: 40+ keys in 40 s. Zoom mostly runs 0.5–0.86 on heroes, with whips back west and deliberate pull-wides to about 0.2 *only* for the "spread around the world" beat, where a wide map *is* the meaning. Then it dives back in.
   - GME's `OrganicFilm` runs the camera on a Catmull-Rom spline (velocity carries through keys, so no dead stops), plus slow drift and zoom breathing.
5. **Every hit lands on the spoken word.** Stamp on "arrest", counter on "six", DRILL on "Drill". Times come from real TTS word timings (`doc.W(line, "word")`), never seconds. GME's `words_W()` **raises** if a word is missing instead of guessing.
6. **One hero per line, with a spotlight.** The focus spotlight dims everything else; old items dim and strings fade after their beat.
7. **Readable type.**
   - Big condensed caps, cream on teal, light on dark.
   - GME's `legible()` fades out any text that would render under **40 px cap height at 1080p**, and `edge_alpha()` fades text that touches the frame edge; `audit.py` checked 105 sample times.
   - Every spoken date and number is on screen.
8. **Real things.** Real photos as prints with credits, real OHLC data (×4 to undo the 2022 split so it matches the narration), real map geodata (Natural Earth), and app UIs redrawn in code (no screenshots, no logos).
9. **Custom code is first-class.** Keef added `GlowPin` and `SlamText`. GME added ~45% custom code: `CandleChart, PriceTag, Panel, Hero, Roll, Particles, ShortArrow, Flash, GemHold, Ambient` and the Reddit, buy-button and headline painters. The framework is a base, and you write the parts this story needs.
10. **Sound designed to picture.**
    - SFX are synthesised from item cues (Keef 37 cues, GME 58), plus hand-placed risers before big moments, a boom on the payoff, and a drop on the crash.
    - GME has a procedural score keyed to words: E-minor drone; 96 bpm hats enter on the Reddit beat; a kick builds into $483; **everything cuts at Robinhood "off"**; a sparse pad carries the hearing; it resolves on "I like the stock".
    - Mix at −15 LUFS, −1.5 dBTP.
11. **Real footage that comes out of the world and goes back in** (the RETURN move, below).

## The workflow, as steps you repeat

### Research
- One table: **narration line | verified fact | source** (see `/workspace/motion_kit/round2_cinematic/gme/audio/facts.md`).
- Add "other verified details for visuals" (the red gaming chair, the kitten poster) and data caveats.
- Keep hedges ("reported").
- Mark illustrative values as illustrative (the GME upvote counter).

### Script
- Short declarative lines, one beat each.
- Ellipses before payoffs ("tells them… I like the stock").
- Fragments for rhythm.
- Numbers spoken as words in `spoken`.
- About 120–125 wpm: Rick said 134–141 wpm felt rushed.
- `script.json` lines carry `text, spoken, hero, typed`.
- `make_beats.py` lints for anything typed and spoken word for word. Fix those.

### Narration and timing
- Scratch with edge-tts (`/workspace/motion_kit/code_motion_cinematic/edge_take.py`: retries, saves WordBoundary timings). `word_times.py` maps them onto the engine timeline (letter-count alignment per line, corrected for leading-silence trim and tempo).
- Final: ElevenLabs Brian, `eleven_flash_v2_5`, stability 0.55 / similarity 0.75 / style 0.15 / boost on, **speed 0.85**, `<break time="0.6s"/>` between sentences, with-timestamps endpoint → characters → words → `words.json`.
- One shared paid call.
- Verify with faster-whisper: the median offset was within ±50 ms.
- Example command lines are in `/workspace/motion_kit/code_motion_cinematic/demo2.sh` and `final.sh`. Fix the old paths when you reuse them.

### World invention
1. Read the whole script.
2. Name what the story is made of.
3. Pick the anchor motif.
4. Lay out a cluster per section with room between them.
5. Choose the look (board texture, palette, grade, grain, glow, vignette) as explicit values. See Keef's `LOOK`/`MAPLOOK` dicts and GME's `LOOK`: custom RGB values, not a named preset.

### Camera keys
- Key on words: `shot(W(line,"word") + δ, x, y, zoom, rot, radius=…)`.
- Push in a little after each hit, and drift during holds.
- Whip with a `cam()` + `focus()` midpoint between distant clusters.
- Pull wide only when width means something.
- End on a composed pull-back.
- Probe the tight poses before choosing them (GME `probe_tight_z080…z148`).

### Real-footage integration: the RETURN move (Rick's default)
1. Find the cut point in the word timings: after the line that names the clip, in a pause (Keef: after "YouTube" ends at 14.681 s, cut at frame 442 = 14.733 s, before "Kanye" at 15.118 s).
2. Pick the clip:
   - the moment the line is about
   - **its first frame matches the still already in the world** (Keef's in point is the exact frame of the P02 thumbnail)
   - avoid burned-in lower-thirds and logos
   - clean phrase or musical boundary (Keef: 9.000 s = 20 beats at about 133 BPM; GME: the caption-bounded sentence, located with the YouTube auto-captions)
   - about 9–10 s
   - conformed to 1920×1080 at 30 fps CFR
3. Re-render only the moves through the engine, with **`film.fade_in = film.fade_out = 0`**:
   - the world frozen at the cut
   - a **36-frame (1.2 s) push** into the print or window, `ease_in_out`
   - handheld wobble damped to about 15% as it arrives
   - in the last 0.4 s, **the print image crossfades from the still to the clip's first frame** ("the photo comes alive")
   - after the clip, the pull starts on the **clip's last frame** inside the print and crossfades back to the still as the camera pulls out (Keef 36 frames; GME 63 frames, out to the typography ending)
4. Assemble with ffmpeg, joining clip ↔ moves with an 8–12 frame `xfade`/`blend`.
   - Audio: the film audio fades out over 0.15 s at the push, and the clip audio fades in over 0.2 s.
   - Gain the clip to sit at the voice level (Keef −8.3 dB; GME +8 dB because that clip measured −24 LUFS).
   - Duck the music an extra −8 dB under the insert with 0.4 s ramps.
   - Two-pass loudnorm to −15 LUFS.
5. Hard-cut variant (allowed when it serves the story): concat film[0:cut] + clip + film[cut:], with short audio fades (0.08–0.12 s).
6. Known bugs, already fixed:
   - Segment renders inherit the film's fades (black dips), so zero them.
   - `ffmpeg -shortest` drops a frame, so pad or trim audio to the exact length instead.
   - A reader grabbed a half-written mp4, so always write `.tmp.mp4` and rename it.

### Music and mix
- `build_sfx.py` from `render.py --cues`.
- A score is written per film (`gme/music.py` is the pattern: numpy synthesis keyed to `words.json`).
- `mix_soundtrack.py` sidechain-ducks under the voice (threshold 0.025, ratio 4, attack 35 ms, release 550 ms) and runs two-pass loudnorm.
- `measure_mix.py` compares each SFX hit's momentary loudness with the speech median. The R1 lesson: stamps at +1.5 to +7.3 dB over the voice masked words, so pull them down about 6 dB or move them about 150 ms off the stressed word.

### Render
- `render.py` splits the frames into chunks over the workers (Keef 1194 frames on 7 workers in 286 s; GME 1582 frames in 334 s). Each worker pipes to x264 at CRF 16, the chunks are joined losslessly, then the audio is muxed.
- Masters are CRF 16 with AAC 192k. Chat/preview copies are about 6 Mb/s.

### Audits that were run (and still apply; see `qa.md`)
- Text size: ≥40 px cap height at 1080p.
- Edge clipping.
- Black and frozen frame scans.
- Duplicate frames: **0** consecutive duplicates (the R1 DRILL fade showed 15 fps grain stutter, fixed by `per_frame_grain()`).
- CFR timing.
- Loudness.
- SFX vs voice level.
- Word sync: visual onset 0 to +200 ms after the word is good; +300–800 ms is late.
- Voice pace.
- Whisper timing truth.
- When a watch-model review and the measurements disagree, **the frames and measurements decide**.

### Credits
Every film shipped a credits file listing:
- engine and commit
- voice provider, voice, model and settings
- every image (what, credit, URL, crop/grade)
- data source and adjustments
- fact sources
- fonts
- "sound synthesised, no samples"
- for inserts: clip source, in/out points, why that moment, output timecodes, what was re-rendered vs reused, and loudness

For Transovo this becomes `assets-manifest.json`.

## Rick's verdicts to respect
- Cinematic Skill was chosen as the base engine after round 2: "some custom touches look cool".
- RETURN (camera into and out of the footage) is the default for inserts.
- The read must not feel rushed (speed 0.85, 0.6 s breaks).
- Every spoken number and date goes on screen.
