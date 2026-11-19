# motion_kit/modal: render on Modal, submit and stop (Rick, Nov 19 2026)

The producer bot builds one composed film page + the editable package, packs `render_bundle_v1.zip`, submits it to the
Modal renderer ONCE and stops. Modal fans the capture out over CPU containers, joins, runs QA (frame count, duration,
audio, black gaps, loudness), uploads master + share copy, approves the master (the job stays open), publishes the
editable version and calls `/complete {delivery:"live"}` by itself. Renderer code: public repo `703deuce/sms`
(`worker/modal_motion/`, `new-app/scripts/motion-studio/modal_submit.mjs`, master 53733e84).

| Script | Use |
|---|---|
| `make_bundle.py --job-dir J [--check-page]` | `J/film` + `J/editable/live` -> `J/deliver_modal/render_bundle_v1.zip`, then validates it exactly like Modal does. `--check-page` also loads the page headless and seeks first/middle/last frame. `--validate-only ZIP`. `--no-editable` is for smoke tests only |
| `submit.sh J [cpu\|gpu]` | validates, sets segment size + cost estimate, runs `modal_submit.mjs` once, writes `J/deliver_modal/submit.json`, exits. `DRY_RUN=1` prints the plan and sends nothing |
| `status.sh J` | prints the redacted `/render-status` once (no polling) |
| `setup.sh` | idempotent: Modal venv + sparse checkout of the public renderer code (submit.sh calls it) |
| `check_page.mjs` | the headless page check used by `--check-page` |
| `patches/publish_editable_remap_live_project.patch` | one fix the Modal app needs (see Known blocker) |

Credentials: Modal keys from `MODAL_ENV_FILE` (default `/workspace/secrets/modal.env`, mode 600, exports
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

## Known blocker (needs a Modal app redeploy, not a skill change)
`pipeline.publish_editable` sends `live-project.json` to `/portable` with NATIVE asset ids (`ast_`, `fnt_`...), but the server only accepts
registered STORAGE ids (random upload ids; `portable-contract.ts` "Timeline media must reference a registered asset ID"). Modal would
approve the master, then fail the publish and mark the job failed. `patches/publish_editable_remap_live_project.patch` remaps them the same
way `bg_delivery/manifest.mjs` does (verified offline against a real live package: 12 native refs -> 0). After the patched app is deployed,
create `motion_kit/modal/.publish_remap_deployed`; until then `submit.sh` refuses production submits (exit 4) and the box fallback applies.

## Fallback
If Modal submit fails twice, render on the box (rcap.mjs-style resumable segments, SKILL.md section 8 fallback) and deliver with
`motion_kit/bg_delivery/launch.sh`. Never run both paths for one job.
