# Film pipeline (Path C: films made from scratch)

Use this only when the job needs a film built from research (no customer footage as the picture). Edits of customer footage and clip jobs skip all of it (SKILL.md sections 4–5). The judgment step and hard rules in SKILL.md apply throughout.

## 1. Research and story (progress `research`, 5→20)

Read first: `/workspace/motion_kit/code_motion_cinematic/repo/skills/cinematic-film/references/story.md` and the "Research" and "Script" parts of `reference-films.md`.

1. Name the film kind (documentary/history, true crime, data story, explainer, SaaS/product demo, launch/ad, social short, biography, music/culture, or a mix).
2. Research in parallel (searches, page reads, downloads at once). Build `research/facts.md`: narration line | verified fact | source URL. Keep source hedges ("a *reported* $6M deal"). Verify each fact once from a solid source; look for a second source only if the first is weak or sources disagree. Research ends when every on-screen and spoken fact is cited and every planned shot has media.
3. Collect real data (prices, dates, counts, coordinates, routes) into `assets/data/` with its source. Real data can be the world.
4. Script length = `durationSeconds × ~2.0–2.1 words/s` (~120–125 wpm). Short declarative sentences, one beat each; numbers spelled out in `spoken`, display form in `text`; every spoken date or number also on screen; one hero per line; a phrase is typed on screen or shown on a real document, never both; after the cold open, time only moves forward.
5. Save `script.json` in the Cinematic Skill format (`takes[].lines[] {id, text, spoken, hero, typed}`): the job's timing spine.
6. `research/treatment.md`: one-sentence angle, anchor motif, world concept, scene list with intended engine, music idea, which beats get real footage. Read `retention-psychology.md` and run its script-stage checklist when the script is locked.

## 2. Creative direction (`research`, 20→25)

This is where the creative decision (SKILL.md section 1, Rick, Nov 19) gets made for a film: the idea that makes this film the best version of itself, carried through design, type, motion, transitions, pacing and sound.

1. **Three concepts,** two or three lines each; pick the best fit for story, audience and request, and say why. On a remake, pick a different one than the previous version.
2. **Visual DNA** into `scenes/theme.json`, `treatment.md` and `project.json` → `visualDna`: typography (from the broad menu in `engine-library.md`, never serif-plus-gold by default), colour and grade, framing, graphic style, text placement, transition grammar, pacing, camera language, texture. Archetypes in `engine-library.md` are starting points, not templates.
3. **Customer style direction:** `creative.style` (+ `creative.customStyle`), or older `settings.styleDirection` / `workflow.styleDirection`, is the lane all three concepts sit in; `automatic` or missing means choose freely. Apply `brand-and-type.md`.
4. **Ledger check:** if the look matches a recent or same-customer entry on type, layout and colour, change it now (unless the customer asked for the same look, or strict branding requires it).
5. **Invent the world:** what is this story physically made of (a map, the data, an evidence wall, a machine, the product UI, a city)? Write geometry and scale, background/mid/foreground layers, palette (exact RGB), type roles, grade, grain and vignette, camera grammar and transitions.
6. **Engines per layer:** survey `engines.md` and `engine-library.md` and choose each layer for how it looks, considering at least one real alternative. Any engine can make a whole scene or one layer; no fixed pairings, no auto-mapping scene types to engines, no engine-count limit. Port the palette, fonts, grain and grade to each engine's theme.
7. **Plan** `scenes/plan.json`: per scene `id`, engine, start/end anchored to script line and word (never seconds), tracks, overlays, footage inserts, transitions, camera intent (a hold is a stated choice).

## 3. Media sourcing (`building`, 25→35)

1. Photos and documents: search broadly (image search, news and press photos, editorial pages, social posts, official sites, YouTube thumbnails `maxresdefault.jpg`, Wikimedia Commons via `python3 /workspace/motion_kit/code_motion_cinematic/repo/skills/cinematic-film/scripts/fetch_commons.py search "<query>"` then `get --project <dir>`). Use the best, most specific image.
2. Footage: `yt-dlp` (`~/.local/bin/yt-dlp`). Find the moment from captions (`--write-auto-subs --sub-langs en --skip-download`), download that section plus padding (`--download-sections "*START-END"`). Pick the moment the line is about, cut on clean phrase or musical boundaries, ~6–10 s; prefer sources without burned-in lower-thirds when an equally good one exists, otherwise frame or cover them on purpose. Conform: `ffmpeg -i in -vf "scale=W:H:force_original_aspect_ratio=increase,crop=W:H,fps=30" -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -ar 48000 out.mp4`.
3. Search for the specific person, place, date or object the line names; stock only for genuinely generic lines.
4. Never upscale a source past ~1.5× in the final frame; small sources go small in the world.
5. Code-drawn UI instead of screenshots for app interfaces; label recreations; quote only words really written.
6. AI stills or clips only for illustration, never as evidence; plan and price them first.
7. Add every item to `deliver/assets-manifest.json` as you fetch it (`delivery-contract.md` §5–6). Customer uploads get `source: "customer_upload"`.

## 4. Narration and timing (`building`, 35→45)

1. Scratch voice first (free): edge-tts with word boundaries (`/workspace/motion_kit/code_motion_cinematic/edge_take.py` with `tts_say.py --cmd`; demo scripts in `reference-films.md`).
2. Final voice: ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps`, voice and settings per SKILL.md "Voice". One paid call for the whole script (two at most). Convert character timings to `audio/words.json` (`{line_id: [{w, t0, t1}]}`).
3. Build `audio/narration.wav` and `audio/timing.json` (`split_takes.py`, `build_narration.py`, or directly from the ElevenLabs timings).
4. Word anchors raise, never guess (the GME `words_W()` pattern): a missing word is an error you fix.
5. Narration + ~0.9 s lead + ~2–3 s tail within ±10% of `durationSeconds`; rewrite rather than time-stretch (gentle `build_narration.py --target` within ±5% is OK).
6. QA: `faster-whisper small.en` on the narration; median word offset vs `words.json` within ±50 ms.

## 5. Design system and scene build (`building`, 45→70)

1. The lead designs this film's system: `design/system.md` + shared components in `design/components/` (type, colour and grade, grid, the components this concept needs, engine per layer, timing map from `audio/words.json`). Freshly designed for every film; reuse happens only inside a film.
2. Build each component once, check it by still, then build scenes from it with beat-specific custom touches.
3. **Helpers only when they truly save time** (many scenes, roughly films over ~60 s). Up to 4 Task executors, each owning a contiguous block. Brief: the system path and job folder; its lines, word anchors, assets and engines; the SKILL.md principles and hard rules; still review only, no rendering. The lead reviews every scene itself and both sides of every cut between blocks.
4. One folder per scene `scenes/<sceneId>/` with its code and a `README.md`. All times derive from word anchors.
5. Author at the scale you'll film: hero zoom ~0.5–1.0 in Cinematic Skill world units, wides not below ~0.3 for more than a beat, labels ≥40 px cap height at 1080p (`cap_px = size × cap_ratio × zoom × (1080/2160)`). Source/credit lines may stay small.
6. Camera is a journey: Cinematic Skill `film.shot()` keys on word anchors every 0.5–2 s with velocity through keys and whips between clusters; other engines use an equivalent camera or parallax move.
7. Fill the frame with meaning: a hero, supporting context and depth layers; old items dim instead of vanishing; photos live in the world and enter with a designed move.
8. Titles readable: big, high contrast, inside the platform safe area (9:16 at 1080x1920: x 120–888, y 288–1248, and left of x 780 below y 780; see `craft-standards.md`). Platform safe areas protect from app UI only; they don't make a spot safe over the person.
9. Footage integration: RETURN by default (push into the print holding the clip's first frame, play full-frame, pull back out on its last frame; `reference-films.md` §Return), a hard cut when the story wants it.
10. Overlays a customer may edit are separate layers with alpha (ProRes 4444 `.mov` or VP9 `yuva420p` `.webm`) or layer-scene layers. Baking is a last resort after real alpha attempts; mark `"baked": true` with the reason. The Transovo upload whitelist takes `video/mp4`, not `.mov`/`.webm`: package alpha overlays in the scene-source zip (`delivery-contract.md` §3).
11. Record every element's `engine` and `layers[]` (engine, commit, role, file) in `project.json`.

### Non-browser still recipes (review without rendering)

Render at the real output size, then view a 480p downscale (`ffmpeg -i t.png -vf scale=-2:480 t_480.png`).
- **Cinematic Skill:** `python3 $S/render.py --project <scene> --probe t1,t2 --size <WxH>` → `out/probe/t<time>.png`; `--strip t0:t1:n` for a sheet along a move. Never pass `--out` before approval.
- **Skia/CanvasKit:** build inside the browser scene. An existing Node Skia script renders one frame index (`MS_FRAME=<n>`) to PNG.
- **Manim (v0.22.1):** `manim render -s -qh -r <W>,<H> scene.py <Scene>`; drive motion from one `ValueTracker` clock and support `MS_FREEZE_T=<t>` to save an exact mid-move frame.
- **Natron:** single frame, e.g. `LD_LIBRARY_PATH=/workspace/motion_engines/natron/extra_lib /workspace/motion_engines/natron/Natron-2.5.0-Linux-x86_64-no-installer/NatronRenderer -w Write1 45-45 comp.ntp`; if it won't run headless, composite with FFmpeg/OpenCV and bring the result in as a layer.
- SAM 2, OpenCV, FFmpeg and Replicate are footage-prep tools; their outputs are reviewed inside the scene.

## 6. Sound (`building`, 70→75)

1. SFX: Cinematic `render.py --cues` + `build_sfx.py`, or engine SFX (Dolly `sfx.mjs`, Claude Remotion `npm run audio`), or synthesised cues on visual hits. Hits ~0–150 ms after the word, not on the stressed syllable, peaks at or below the voice median (`measure_mix.py`).
2. Music composed for this film (procedural score keyed to word anchors, the GME `music.py` pattern), a found or customer track (record its source), or a generated track (log the cost). A story film over ~15 s gets music unless the brief says otherwise.
3. Mix: `mix_soundtrack.py --project P --music audio/music.wav --stems` (sidechain duck, two-pass loudnorm, −1.5 dBTP; integrated target per `qa.md`). Stems: `narration`, `music`, `sfx`, `footage_audio` (if any), `dialog` (narration + SFX + footage sound), all master length, 48 kHz WAV.

## 7. Customer progress (examples)

| phase | progress | message |
|---|---|---|
| accepted | 2 | Production started. |
| research | 10–25 | Researching the story and checking facts. / Designing the visual world. |
| building | 25–70 | Sourcing photos and footage. / Recording narration. / Building scene 3 of 7. |
| rendering | 75–88 | Rendering the approved film. (every job, live included: render first) |
| qa | 88–95 | Watching the final cut and checking the sound mix. |
| uploading | 95–99 | Uploading the video and project files. |

## 8. First run on a new bot copy (once)

1. Read `/workspace/engines/PLAN.md`, `engines.md` and `reference-films.md`; look at contact sheets of `/workspace/motion_kit/films/film1.mp4` (GameStop) and `film2.mp4` (Keef) from `qa_report.py`. That is the bar.
2. Run `check_engines.sh` (and `--fix` for missing items). Create `/workspace/motion_prod_env` (`engines.md` §1) if missing. Check `ENGINE_STATUS.md`. No smoke tests: use engines straight in the real build, and log PASS/FAIL there if one breaks.
3. Check that needed keys are set without printing them (`engines.md` "API keys"). Key names: `ELEVENLABS_API_KEY` (required for live films); optional `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `YOUTUBE_DATA_API_KEY`, `KIE_API_KEY`, `REPLICATE_API_TOKEN`.
