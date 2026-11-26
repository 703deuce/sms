# QA gate: look at browser stills while building, then watch and measure the one final master

No rendering until everything is approved (Rick, Nov 18). **Creative review (section 2) is done in the browser on still screenshots of each scene (480p review size; full size only for a frame that cannot be judged at 480p) while it is being built**, never on contact sheets or frames decoded from a rendered video. Valid code, a schema that validates, or a render that exits 0 is *not* proof. The Motion Lab produced films that passed every contract check and still looked like slideshows.

After every scene is approved, render the master once, watch it in full, and run the scripted technical report (section 1) on that single final render. Save everything under `$J/qa/`, and put a summary in `project.json` → `qa`.

## 1. Automated technical report (once, on the final master)

```bash
Q=scripts/qa_report.py
python3 $Q $J/deliver/video.mp4 --out $J/qa/master --every 1 --expect-seconds $DURATION --expect-aspect $ASPECT --lufs -15
```

It checks:

- codec h264, even dimensions, CFR

- aspect

- duration within ±10% of the request

- integrated loudness −15 ±1.5 LUFS (film and BYO masters; −14 vs −15 is still open for Rick)

- true peak ≤ −1.0 dBTP

- no black stretch over 0.5 s mid-film

- frozen stretches (≥2 s is a warning)

- near-black tiles

- **static stretches** with no visible change for ≥4 s

It writes `sheet.jpg` (labelled tiles), `frames/` and `report.json`. Exit code 1 means a hard failure. The sheet is for the scripted checks on the final master only; it does not replace the browser-still review.

A WARN is not a pass. Open the frames it names and decide on purpose. For example, the GameStop reference has two near-black tiles mid-whip at 7 s and 9 s; that is fine there, because the next beat lands within a second.

Extra measurements:

| Check | Command | Pass |
|---|---|---|
| Frame-count parity | `ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 video.mp4` | equals the planned total (sum of elements); no one-frame mux loss |
| Duplicate consecutive frames (stutter) | `ffmpeg -i video.mp4 -vf mpdecimate=hi=64:lo=32:frac=0.33 -loglevel debug -f null - 2>&1 \| grep -c ' drop '` while the camera is moving | 0 during camera moves (static holds are fine) |
| Audio length = video length | ffprobe both streams | within 1 frame |
| SFX vs voice | adapt `/workspace/motion_kit/round2_cinematic/gme/measure_mix.py` | worst SFX hit ≤ +0 dB over the speech median (R1 masking was +1.5 to +7.3 dB) |
| Voice pace | words ÷ narration seconds × 60 | about 115–130 wpm |
| Word timing truth (required) | faster-whisper `small.en` on the mix vs `words.json` | median offset ≤ ±50 ms |
| Stems | each stem's duration = the master's; sum of stems ≈ the mix (null test within about −30 dB) | yes |

## 2. Look at the frames (you, every job, in the browser before any render)

**Optional helpers (SKILL.md section 7):** `layout.mjs`, `face_frame.py`, `scene_lint.mjs` and `components/` may be used when they save time on this job. They are never required and never the verdict; your eye is.

**Parallel builds (when helpers are used; `film-pipeline.md`):** the lead reviews every scene itself to this standard, including scenes a helper built and self-checked, and checks both sides of every cut between helper blocks for consistent type, colour, motion and components.

Take still screenshots of each scene in the browser at exact times at 480p review size, with full size only for a frame that cannot be judged at 480p (SKILL.md section 7) (`stillBrowser`, `npx remotion still`, `npx hyperframes@0.9.52 snapshot`; non-browser engines use the exact recipes below), as sampled in SKILL.md section 7: first frame, busiest moment, last frame, every hero moment and wherever something changes. Never encode a video to look at frames. **Browser vs non-browser engines (Rick, Nov 18; mandatory).** The point is for the agent to SEE the exact frame so it can tell if something is wrong and fix it, without the time and usage of rendering (Rick). Every browser engine (Dolly/Remotion, HyperFrames, Open 3D Skills, Claude Remotion Skill, Motion Canvas, Revideo, PixiJS, Three.js + Theatre.js, GSAP + SVG, p5.js, D3.js, MapLibre + deck.gl, Rive, Lottie/dotLottie, and Skia/CanvasKit) runs in Chrome and is reviewed with browser stills at exact times (`stillBrowser`, `npx remotion still`, `npx hyperframes@0.9.52 snapshot`, or a screenshot after seeking the page). Only these run outside the browser, and each is checked with its exact still recipe (same frame selection as browser engines: first, busiest and last frame, stills along every move, at 480p review size; full size only for a frame that cannot be judged at 480p):
   1. **Cinematic Skill** (Python/skia): `python3 $S/render.py --project <scene dir> --probe t1,t2,t3 --size <output WxH>` writes one full-size PNG per time to `<scene dir>/out/probe/t<time>.png`. For a move, use `--strip t0:t1:n` (a sheet of n frames at half size in `out/probe/strip_*.jpg`) to find the moments, then `--probe` those times for full-size checks. Always pass the real output size (e.g. `1920x1080`, `1080x1920`), then view a 480p downscale (full size only if something cannot be judged at 480p). Never pass `--out` before approval (that encodes video).
   2. **Skia/CanvasKit:** build it inside the browser scene (CanvasKit is wasm and runs in Chrome) and review it by browser still like every other browser engine. Only if a scene is an existing Node Skia script: render a single frame index to PNG (the script takes the frame index, e.g. `MS_FRAME=<n>`, and writes `surf.makeImageSnapshot().encodeToBytes()` for that one frame); never pipe frames to ffmpeg before approval.
   3. **Manim** (native Python/cairo, v0.22.1): `manim render -s -qh -r <W>,<H> scene.py <SceneClass>` saves one PNG (`-s` = save last frame; `-r` takes width,height on this version; `-n <i>` starts from animation number i). Every Manim scene must include a freeze-at-time switch: drive all motion from one `ValueTracker` clock, and when env var `MS_FREEZE_T` is set, set the clock to that time and end the scene there, so `MS_FREEZE_T=<t> manim render -s …` saves the exact mid-move frame.
   4. **Natron** (native compositor): render a single frame only, e.g. `LD_LIBRARY_PATH=/workspace/motion_engines/natron/extra_lib /workspace/motion_engines/natron/Natron-2.5.0-Linux-x86_64-no-installer/NatronRenderer -w Write1 45-45 comp.ntp` (Write1 set to write a PNG). If Natron is not installed or won't run headless, do that compositing with FFmpeg/OpenCV on the source footage instead and bring the result in as a layer in the browser scene, reviewed there by browser still.
   Before approval, a render of more than the exact frame, or the few seconds being checked, is not allowed for any engine. Renders take long, especially as videos get longer; sitting and rendering is what we're getting away from. SAM 2, OpenCV, FFmpeg and Replicate are footage-prep tools, not scene engines: their outputs go into the browser scene as media layers and are reviewed there with browser stills. Also step **word-sync stills** around each visual hit: 0.1 s steps from −0.4 s to +0.8 s around the hit word, taken as browser stills.

Also look at a **phone-size copy** (480 px wide) of the key stills, since many customers watch on phones.

After every scene is approved and the master is rendered once, watch that master in full (pacing and sound across the whole cut).

### The checklist, with the failures it catches

Each item below happened in a real render (Motion Lab stage 1 runs in `/workspace/qa/motion_lab_stage1/`, the regression audit at `/workspace/qa/ms_spec_8_cinematic_regression.md`, and the Keef and GameStop rounds).

1. **Scale and legibility.**
   - Every label's cap height is ≥40 px at 1080p (scale for other sizes) and readable on the 480 px copy.
   - Strokes and lines are clearly visible.
   - *Lab failure:* the world was authored at 18,000 × 11,350 units, so the fitted camera zoom was **0.17** (`agent_396204f2.log` `framing.fit`), and lines and titles were faint or unreadable. Fix it at the source: author the world so heroes are filmed at zoom about 0.5–1.0. Never fix it by scaling the final video.

2. **Titles visible.**
   - Every planned title or typed line actually appears, on its word, fully on-frame, with contrast against what is behind it.
   - *Lab failure:* titles planned but missing (`MISSING_TARGET: 'world_title'`), or rendered too small to read at wide zoom.
   - Check each `typed` entry in `script.json` against the frames: present? readable? on time?

3. **The camera moves with intent.**
   - The camera travels between clusters, pushes in after hits, and drifts on holds.
   - *Lab failure:* a static camera (the compiler inserted two identical keys when no moves were planned; the stage-1 runs used `cameraIntent: "hold"`). A hold is valid only if it is a written decision in `plan.json`.
   - `qa_report.py`'s static-stretch check flags ≥4 s with no change. Look at every flag.

4. **Frames are full of meaning, not empty.**
   - Every tile has a hero, supporting context, and depth (background texture/grid, midground, foreground finish).
   - *Lab failure:* sparse or empty frames, a few lines on a flat field, "a photograph on a basic background".
   - Ask of each tile: if this were paused, would it read as a designed shot of this story?
   - Don't count objects; a deliberate minimal frame is fine when the story wants it.

5. **Photos live in the world.**
   - Photos enter as prints, windows or panels with a designed move (drop, slide, spring), are connected to other items (string, route, arrow), and receive camera emphasis.
   - *Regression failure:* photos just cut one after another with no world and no camera, the "slideshow" look.

6. **The planned design was actually built.** Compare `treatment.md`/`plan.json` with the frames, line by line:
   - the environment exists
   - the custom objects render
   - groups move together
   - animations run
   - transitions appear in the video
   - the planned foreground, midground and background are all there

   *Regression failure:* a compiler that emitted comments instead of objects (layout groups, custom components). If something planned is missing, that is a **design–implementation discrepancy**. Fix it, or change the plan and log why. Never accept it silently.

7. **Sync.** Captions start within ±2 frames of their word; lip-sync no more than 1 frame early or 3 late. A graphic visual hit lands 0 to +200 ms after its word; later than +300 ms is a fail (the R1 typed text was +300–800 ms late). Counters finish rolling on the spoken number, not after it.
7a. **Framing serves the content (Rick).** Frame for what the viewer needs to see: the face for pure talk, the board, screen, product or demo when that matters. A face that is badly cropped (chin or forehead cut, eyes in the wrong place, jammed against a border) fails; so does a face-led crop that hides what the person is showing. Judged by eye, not by a tool.
7b. **Key text readable (Rick).** Text behind a subject is fine, but no object fully hides a key word or number; every key word and number is readable on every still where it is on screen.
7c. **Real clip audio (Rick).** When it makes sense, real clips play with their own sound and then cut back to the edit; the film is not voiceover the whole time.

8. **Spotlight follows the camera.** No dark frame where the camera moved on but the focus stayed behind.

9. **Edges and safe areas.** Nothing important is clipped by the frame edge. For 9:16, critical text stays inside the 9:16 safe box: text, logos and captions inside x 120–888, y 288–1248, and left of x 780 below y 780 at 1080x1920 (x 53–395, y 128–555 at 480x854); see `craft-standards.md`.

10. **Footage seams.**
    - The push ends on the clip's first frame and the pull starts on its last.
    - No fade-to-black dips inside segments.
    - Source footage: any burned-in logos or lower-thirds from the source are framed, cropped or covered on purpose so they don't clash. Our own titles, captions and lower-thirds are never burned into footage; they are separate layers.
    - Clip audio sits at the voice level.

11. **Sources look sharp.** No visibly soft upscales (more than about 1.5× source pixels); if one is soft, make it smaller in the world.

12. **Facts on screen.** Every number, date and name on screen matches `facts.md`, and every spoken date or number appears on screen. Never drop cited information because you doubt it; checking here is that the screen matches the research, not re-verifying the research.

13. **Honesty.** No AI image is presented as a real event or person. Code-drawn documents are labelled as recreations.

14. **Cross-engine consistency.** Scenes from different engines share the palette, type, grain and grade. A cut between engines looks like the same film.

15. **Overlay and layer integrity.**
    - Each overlay file shows its content on transparent pixels (check alpha with `ffprobe -show_entries stream=pix_fmt`: `yuva*`).
    - Each scene clip shows nothing that belongs to another element.
    - Overlays are positioned so that recombining them reproduces the master.

16. **Layered composites.** Cutout and alpha layers are blended in RGB with no dark or haloed edges (check one edge frame at 200%). Every layer has the scene's exact frame count, mattes don't flicker across the motion strip, and type placed behind a subject stays legible.

17. **Look-alike check (WARN; a fix item on a remake).** Compare this cut's approved browser stills and `visualDna` with the last 5–8 entries of `/workspace/motion_jobs/STYLE_LEDGER.md`: header placement, box or portrait layouts, type families and treatments, palette, transitions and engine mix. If it reads as a recent film's look, note what repeats. On a remake, changing it is required. Cohesion *inside* the film still wins (check 14).

## 3. Duration and format

- Master duration within ±10% of `durationSeconds`, and preferably ±5%. If it is off, fix the script length, not the playback speed.

- Exact target resolution for the aspect (1920×1080, 1080×1920, 1080×1080, 1080×1350), 30 fps CFR, `+faststart`, phone-compatible H.264: `-profile:v high -level:v 4.2 -pix_fmt yuv420p` (≤1080p; never let x264 auto-pick a level above 5.1, iPhones refuse to save level 6.x to Photos), AAC audio. Check with ffprobe `level` ≤ 51.

## 4. Fix loop

1. List every failure as one line in `$J/qa/fixes.md`: element, symptom, cause found in the code, fix.

2. Fix the cause in that element's source. Batch every fix from one look (optionally run `scene_lint.mjs` as a hint), then re-check stills once.

3. Before approval: re-check that scene's exposing stills and the frames around them in the browser, plus both sides of any touched cut; never frames or scenes the fix did not touch; no re-renders. After the final render: if the watch or the report finds a problem, fix the scene in the browser, re-check its stills, and render the master again.

4. No round cap. The final render should already be right because everything was fixed in the browser first. Never ship a known-broken film; if a problem truly cannot be fixed, complete the job as `failed` with an honest message.

5. When a watch-model or vision review and the measurements disagree, **the frames and measurements decide**.

## Craft checklist

Also run the pre-delivery craft checklist for this video type from `craft-standards.md` (captions, safe box, speech edits, pacing, hook in the first 3 s). Log any Should you broke on purpose, with the reason.

## Retention checklist

Run the edit-stage checklist from `retention-psychology.md` (first frame works sound-off and matches the promise, open loop planted and paid off, re-hooks at drop-off points, no dead air, ends on the payoff with no goodbye). Note any deliberate exception in the QA report.
