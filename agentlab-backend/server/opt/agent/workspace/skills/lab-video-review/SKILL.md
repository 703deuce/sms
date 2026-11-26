---
name: lab-video-review
description: Review before rendering, every film: once the build is done, check stills and a contact sheet sampled at the moments that change, fix everything, then render once; after the render only technical checks.
when_to_use: Opened at the review stage (video-stage review), after the build and the mix and before any render; also for the technical check of the single final render.
page_line: Before any render, every film: stills at change points checked as a viewer, fix, then one render; post-render checks technical only.
attach_roles: stage
---

# Review (before render; after render only technical)

**Principle: review happens before rendering, never render-then-look-then-rerender.** A render that exits 0, valid
code or a passing tool is not proof; your eye on the frames is. If it doesn't look right, it isn't right.

## 1. Sample the moments that change (not every frame)
```bash
R=/workspace/skills/lab-video-review/review.py
python3 $R times <project>             # times= first frame, each entrance/middle/exit, both sides of cuts, elements, ending
python3 $CS/render.py --project <project> --probe <times> --size 854x480      # Cinematic stills at those times
node /workspace/skills/lab-engine-browser-fx/capture.mjs --dir scenes/S04 --still <times>   # browser layers
python3 $R sheet <project>/out/probe scenes/*/out --out <project>/qa/sheet.jpg   # labelled contact sheet
```
Look at the sheet and the key stills with `agent_view`, at 480p (full size only for a frame you can't judge).
For a move, add a few stills along it; for each graphic hit, stills just before and after the word.

## 2. Check each still as a viewer (fix in the scene code, never in post)
1. Readable: labels >= 4.5% of frame height; every key word and number readable on a phone; titles appear on their word.
2. Framing: faces well framed; what the viewer needs to see is visible; nothing covers a face or what is shown.
3. Frames full of meaning: a hero, context and depth; no empty or flat frame; photos live in the world.
4. The plan was built: each scene and layer in `scenes/plan.json` is on screen (environment, objects, moves, transitions).
5. Camera moves with intent; a hold is a written decision.
6. Edges and safe areas: nothing important clipped; 9:16 text inside the safe box.
7. Sync: a graphic lands 0 to +200 ms after its word; counters finish on the spoken number.
8. Footage: seams clean, sources sharp (no soft upscales), burned-in source logos framed or covered on purpose.
9. Facts on screen match `research/facts.md`; no AI image shown as real; recreations labelled.
10. One film: engines share palette, type, grain and grade; cut-out edges clean at 200%.
11. Premium, not templated, and different from the last films in the ledger (`lab-video-variety`).
12. Sound, on the mix before render: `python3 $R audio <mix> --voice <narration> --music <music>`
    (-14 LUFS +/-1, true peak <= -1 dBTP, music >= 18 dB under the voice).
13. The all-types craft checklist (C0, `reference.md`) and the type checklist on the type page in your first
    message (`lab-video-types-*`), on the same stills.
14. Timing on paper: plot scene and graphic durations from `scenes/plan.json` and `audio/timing.json` for waves of
    tension and release; flag long stretches with no change and runs of very short cuts. Re-`transcribe` the mix to
    catch clipped syllables or merged words at joins. Then re-check the opening and the turn as a cold viewer.
Batch every failure from one look into `qa/fixes.md`, fix the causes, re-check only those stills and both sides of
any touched cut. Then the hook, ending and checklist (`lab-video-brief`) once more.

## 3. One render, then technical checks only
Encode (Must): H.264 High, yuv420p, 30 fps CFR, tagged BT.709 limited range, AAC, `+faststart`, full canvas with no
bars or borders; house size 854x480 (480x854 vertical) unless asked (TikTok needs >= 540x960: deliver 720p when
the brief names it; 1080p uploads ~8 Mbps). Then
`python3 $R final out/final.mp4 --expect <seconds> --size 854x480`: decodes cleanly, duration, resolution, fps,
audio present. Look questions are settled before the render; never re-render to look. Detail: `reference.md`.
