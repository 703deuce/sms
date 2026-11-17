# QA gate: look at the real frames, measure, fix, re-render

Nothing ships until it passes this gate on **the actual rendered files**. Valid code, a schema that validates, or a render that exits 0 is *not* proof. The Motion Lab produced films that passed every contract check and still looked like slideshows.

Run the gate on every scene clip (as it's rendered), then on the assembled master. Save everything under `$J/qa/`, and put a summary in `project.json` → `qa`.

## 1. Automated technical report (every file)

```bash
Q=/home/box/agent-data/workflows/motion-studio-production/scripts/qa_report.py
python3 $Q $J/deliver/video.mp4 --out $J/qa/master --every 1 --expect-seconds $DURATION --expect-aspect $ASPECT --lufs -15
python3 $Q $J/scenes/S03/out/S03.mp4 --out $J/qa/S03 --every 0.5 --expect-aspect $ASPECT --no-audio-ok
```

It checks:
- codec h264, even dimensions, CFR
- aspect
- duration within ±10% of the request
- integrated loudness −15 ±1.5 LUFS
- true peak ≤ −1.0 dBTP
- no black stretch over 0.5 s mid-film
- frozen stretches (≥2 s is a warning)
- near-black tiles
- **static stretches** with no visible change for ≥4 s

It writes `sheet.jpg` (labelled tiles), `frames/` and `report.json`. Exit code 1 means a hard failure.

A WARN is not a pass. Open the frames it names and decide on purpose. For example, the GameStop reference has two near-black tiles mid-whip at 7 s and 9 s; that is fine there, because the next beat lands within a second.

Extra measurements:

| Check | Command | Pass |
|---|---|---|
| Frame-count parity | `ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 video.mp4` | equals the planned total (sum of elements); no one-frame mux loss |
| Duplicate consecutive frames (stutter) | `ffmpeg -i video.mp4 -vf mpdecimate=hi=64:lo=32:frac=0.33 -loglevel debug -f null - 2>&1 \| grep -c ' drop '` while the camera is moving | 0 during camera moves (static holds are fine) |
| Audio length = video length | ffprobe both streams | within 1 frame |
| SFX vs voice | adapt `/workspace/motion_kit/round2_cinematic/gme/measure_mix.py` | worst SFX hit ≤ +0 dB over the speech median (R1 masking was +1.5 to +7.3 dB) |
| Voice pace | words ÷ narration seconds × 60 | about 115–130 wpm |
| Word timing truth (optional) | faster-whisper `small.en` on the mix vs `words.json` | median offset ≤ ±50 ms |
| Stems | each stem's duration = the master's; sum of stems ≈ the mix (null test within about −30 dB) | yes |

## 2. Look at the frames (you, every job)

Open `sheet.jpg` for the master and for each scene, then the full-size frames at every hero moment. Also make **word-sync strips** around each visual hit: 0.1 s steps from −0.4 s to +0.8 s around the hit word.

```bash
for t in $(seq -f %.2f $(echo "$HIT-0.4"|bc) 0.1 $(echo "$HIT+0.8"|bc)); do ffmpeg -v error -y -ss $t -i video.mp4 -frames:v 1 -vf scale=480:-2 $J/qa/strip_$t.png; done
ffmpeg -v error -y -pattern_type glob -i "$J/qa/strip_*.png" -vf tile=7x2 $J/qa/strip_$HIT.jpg
```

For Cinematic scenes, render stills straight from the engine (`render.py --probe`, `--strip t0:t1:n`) *before* the full render. That is cheaper.

Also look at a **phone-size copy** (480 px wide), since many customers watch on phones.

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
8. **Spotlight follows the camera.** No dark frame where the camera moved on but the focus stayed behind.
9. **Edges and safe areas.** Nothing important is clipped by the frame edge. For 9:16, critical text stays inside the 9:16 safe box: text, logos and captions inside x 120–888, y 288–1248, and left of x 780 below y 780 at 1080x1920 (x 53–395, y 128–555 at 480x854); see `craft-standards.md`.
10. **Footage seams.**
    - The push ends on the clip's first frame and the pull starts on its last.
    - No fade-to-black dips inside segments.
    - No burned-in logos or lower-thirds that clash, or else log them as accepted.
    - Clip audio sits at the voice level.
11. **Sources look sharp.** No visibly soft upscales (more than about 1.5× source pixels); if one is soft, make it smaller in the world.
12. **Facts on screen.** Every number, date and name on screen matches `facts.md`, and every spoken date or number appears on screen.
13. **Honesty.** No AI image is presented as a real event or person. Code-drawn documents are labelled as recreations.
14. **Cross-engine consistency.** Scenes from different engines share the palette, type, grain and grade. A cut between engines looks like the same film.
15. **Overlay and layer integrity.**
    - Each overlay file shows its content on transparent pixels (check alpha with `ffprobe -show_entries stream=pix_fmt`: `yuva*`).
    - Each scene clip shows nothing that belongs to another element.
    - Overlays are positioned so that recombining them reproduces the master.
16. **Layered composites.** Cutout and alpha layers are blended in RGB with no dark or haloed edges (check one edge frame at 200%). Every layer has the scene's exact frame count, mattes don't flicker across the motion strip, and type placed behind a subject stays legible.
17. **Look-alike check (WARN; a fix item on a remake).** Compare this cut's contact sheet and `visualDna` with the last 5–8 entries of `/workspace/motion_jobs/STYLE_LEDGER.md`: header placement, box or portrait layouts, type families and treatments, palette, transitions and engine mix. If it reads as a recent film's look, note what repeats. On a remake, changing it is required. Cohesion *inside* the film still wins (check 14).

## 3. Duration and format

- Master duration within ±10% of `durationSeconds`, and preferably ±5%. If it is off, fix the script length, not the playback speed.
- Exact target resolution for the aspect (1920×1080, 1080×1920, 1080×1080, 1080×1350), 30 fps CFR, `+faststart`, phone-compatible H.264: `-profile:v high -level:v 4.2 -pix_fmt yuv420p` (≤1080p; never let x264 auto-pick a level above 5.1, iPhones refuse to save level 6.x to Photos), AAC audio. Check with ffprobe `level` ≤ 51.

## 4. Fix loop

1. List every failure as one line in `$J/qa/fixes.md`: element, symptom, cause found in the code, fix.
2. Fix the cause in that element's source.
3. Re-render only the affected elements, re-assemble, and re-run the gate.
4. Stop after **3 rounds**. If a hard check still fails, complete the job as `failed` with an honest message rather than shipping a broken film.
5. When a watch-model or vision review and the measurements disagree, **the frames and measurements decide**.

## Craft checklist
Also run the pre-delivery craft checklist for this video type from `craft-standards.md` (captions, safe box, speech edits, pacing, hook in the first 3 s). Log any Should you broke on purpose, with the reason.

## Retention checklist
Run the edit-stage checklist from `retention-psychology.md` (first frame works sound-off and matches the promise, open loop planted and paid off, re-hooks at drop-off points, no dead air, ends on the payoff with no goodbye). Note any deliberate exception in the QA report.
