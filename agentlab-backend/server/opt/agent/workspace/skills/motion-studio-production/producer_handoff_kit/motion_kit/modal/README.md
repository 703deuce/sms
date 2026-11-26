# motion_kit/modal: render on Modal, submit and stop (Rick, Nov 19 2026)

The producer bot builds one composed film page + the editable package, packs `render_bundle_v1.zip`, submits it to the
Modal renderer ONCE and stops. Modal fans the capture out over CPU containers, joins, runs QA (frame count, duration,
audio, black gaps, loudness), uploads master + share copy, approves the master (the job stays open), publishes the
editable version and calls `/complete {delivery:"live"}` by itself. Renderer code: public repo `703deuce/sms`
(`worker/modal_motion/`, `new-app/scripts/motion-studio/modal_submit.mjs`; `setup.sh` sparse-clones current `master`).
Installed on a producer box at `/workspace/motion_kit/modal/` by `producer_handoff_kit/setup/bootstrap_producer_box.sh`.

| Script | Use |
|---|---|
| `make_bundle.py --job-dir J [--check-page]` | `J/film` + `J/editable/live` -> `J/deliver_modal/render_bundle_v1.zip`, then validates it exactly like Modal does. `--check-page` also loads the page headless and seeks first/middle/last frame. `--validate-only ZIP`. `--no-editable` is for smoke tests only |
| `submit.sh J [cpu\|gpu]` | validates, sets segment size + cost estimate, runs `modal_submit.mjs` once, writes `J/deliver_modal/submit.json`, exits. `DRY_RUN=1` prints the plan and sends nothing |
| `status.sh J` | prints the redacted `/render-status` once (no polling) |
| `setup.sh` | idempotent: Modal venv + sparse checkout of the public renderer code (submit.sh calls it) |
| `check_page.mjs` | the headless page check used by `--check-page` |
| `reuse.sh J SOURCE_JOB_ID` | retry only: borrow the earlier job's ready bundle zip + rendered segments (`POST /assets` receipts + reuse) before `submit.sh` |
| `patches/publish_editable_remap_live_project.patch` | historical: the publish remap fix, now merged on master as 877867c |

Credentials: Modal keys from `MODAL_ENV_FILE` (default `/workspace/render_bench/.modal_env`, mode 600, exports
`MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`); job creds from `J/secrets/{job_url,token}` (fallback `J/state/job_token`).
They only live in the environment of the submit process. Nothing prints them.

## Job folder layout
```
J/film/            composed page + everything it loads (fonts, footage, images, audio.wav) + film.json
J/editable/live/   publish-live.mjs --dry-run output (+ repack-live.mjs -> payload/live.packed.json)
J/deliver_modal/   render_bundle_v1.zip, submit.json (callId, mode, segments, estimate)
```
`film.json`: `{"title","width","height","fps","frameCount"}` (integers). Native size only (never upscale), fps 30 normally.

## Bundle contract (what the composed page must expose)
- Entry page (`index.html` or `--entry`) is the WHOLE film: every scene, text, transition and effect at the right time. Modal never assembles scenes.
- `window.__scene = {fps, duration, frameCount, seek}` and `window.__ready = true`, **assigned only after** fonts, data, images and a first seek have finished. Modal loads the page (`networkidle0`) and then immediately requires `__scene.seek`.
- `await window.__scene.seek(tSeconds)` is deterministic: all state comes from `t` (no wall clock, no unseeded random, grain keyed by frame index). Modal calls it with `frame/fps` and screenshots the viewport.
- Viewport is exactly `width x height`, device scale 1, no scrollbars. Software GL only; 2D canvas/DOM are the proven path. `<video>` elements are untested on Modal's Chromium: draw footage from JPEG sequences or frame packs.
- No external requests (all non-local requests are blocked): self-host fonts and libraries. Captions are never burned in. Audio is NOT played in the page.
- `audio.wav` (or `--audio`) is the final mix, exactly the film's length (QA tolerance 0.2 s), about -14 LUFS (Modal normalizes to -14, QA accepts -16.5..-13.5).
- Limits: <=10000 files in the ZIP (page files + editable blobs), <=2 GB. Every segment container downloads the whole ZIP, so keep media lean and as few files as possible (video or frame packs, not thousands of loose JPEGs).
- `project.json` at the ZIP root (written by make_bundle): width, height, fps, frameCount, durationMs, `composition.entryFile`, `mixedAudioFile`, sha256 asset list. `durationMs` equals the editable package's `durationMs` (Transovo's `/complete` compares them) and must be within 100 ms of `frameCount*1000/fps`. No symlinks.

## What the editable package must contain (Modal's `publish_editable`)
`make_bundle.py` writes these at the ZIP root from `live.packed.json` (preferred) or `live.json`:
`package.json` (`schema: "transovo.motion-package/1"`, `projectId`, `durationMs`, `document`, `assets{id:{sha256,bytes,mime,kind,filename}}`),
`bundles.json` (scene bundle metadata), `live-project.json` (the `transovo.live-project/1` timeline; required for live jobs),
and `blobs/<sha256>` for every asset (verified size + digest). Modal uploads each blob through the job asset API, publishes the
native document with `{id, storageId, kind, sha256}` records, then completes. `portable.json` is not used (storage ids are unknown before upload).

## Segment size and cost
`submit.sh` picks frames per segment = `ceil(frameCount/96)` rounded up to a multiple of 30, clamped to 150..450 (5..15 s), so a
film never needs more than ~96 containers at once (stays under typical concurrency limits) and a segment is never shorter than
5 s (container start + bundle download is a fixed cost per segment). 1 min -> 12 x 150; 5 min -> 60 x 150; 10 min -> 86 x 210;
20 min -> 93 x 390. Override with `MOTION_SEGMENT_FRAMES` (1..600; Modal's capture accepts <=1000 per segment). Estimate sent to the
budget guard = `0.10 + 0.285 x minutes` USD (measured CPU cost ~$0.19 per rendered minute, 1.5x margin), capped at $4.95 so it stays
under the ~$5 job cap (films over ~17 min hit the cap; the real cost is ~$0.19/min). GPU (T4) measured slower and ~3.7x pricier on 2D
canvas: use it only for real 3D/WebGL scenes after it measurably helps. The join/encode/QA step is one container, so it is the serial tail on long films.

## Server-side fixes already on `703deuce/sms` master and deployed (Nov 19, 2026)
Nothing to patch on a new box. These live in `worker/modal_motion/` (Modal app `transovo-motion-render`, deployed by Chief of Staff):
- `877867c` publish remaps live-project asset refs to registered storage ids before `/portable` (the old "known blocker").
- `aee25c1a` bundle downloads retry 503/429/5xx with backoff; segment containers capped at 24 (a 20-min film runs in ~4 waves).
- `c6f11a31` every job-API call from Modal retries 429/5xx and connection errors (rides out website redeploys).
- `ca749125` QA uses `ffprobe -count_packets` with long timeouts (1800-5400 s); `join_qa` has 8 vCPU / 16 GB; `/render-asset` serves reused artifacts.
- `8dbc8e9f` `master_cpu.mp4` uploads right after QA passes; films over 5 min get one 720p CRF 30 share copy (no 24 MB cap).

`submit.sh` therefore submits by default. Kill switch: `touch /workspace/motion_kit/modal/.modal_disabled` (or `MODAL_DISABLED=1`)
makes it exit 4 so the box fallback applies. (The old `.publish_remap_deployed` marker is no longer used.)

**Open issue (Nov 19, 8:16 PM ET):** the 20-minute reuse job got through join, QA and the master upload, then Modal's
`publish_editable` got HTTP 400 from `POST /portable`. Chief of Staff owns the server side. If a job ends `qa_fail` with
`Job API failed: 400`, report it to Rick and Chief of Staff; do not resubmit on your own.

## Retrying a failed Modal job (only with Rick's explicit OK)
The server decides retries; Chief of Staff creates a fresh job for the same project and it arrives by webhook like any job.
Never rebuild the film for a pure infrastructure retry:
1. New job folder `J2` (the routine creates it). Link the finished bundle: `mkdir -p J2/deliver_modal && ln -s J1/deliver_modal/render_bundle_v1.zip J2/deliver_modal/`.
2. `bash /workspace/motion_kit/modal/reuse.sh J2 <J1 jobId>` (receipts + reuse of the zip and every ready `modal_seg_v1_cpu_*.mp4`; prints counts only).
3. `MOTION_SEGMENT_FRAMES=<J1's segmentFrames from J1/deliver_modal/submit.json> bash /workspace/motion_kit/modal/submit.sh J2 cpu`. Same segment size, so Modal finds the reused segments ready and goes straight to join, QA, upload, publish, complete.
4. `status.sh J2` once; report. Without reusable segments (`reuse.sh ... --no-segments`) Modal re-renders but still skips the bundle upload.

## Fallback
If Modal submit fails twice, render on the box (rcap.mjs-style resumable segments, SKILL.md section 8 fallback) and deliver with
`motion_kit/bg_delivery/launch.sh`. Never run both paths for one job.
