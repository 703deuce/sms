# Motion Studio Modal film renderer (optional backup, off by default)

**Nov 20:** New production jobs use the dedicated private CPU render-host service
(`Dockerfile.motion-render`, `worker/motion_render_host/`).
This Modal application remains intact as an operator-enabled fallback only,
selected with `RENDER_BACKEND=modal` or `MOTION_MODAL_FALLBACK=1`
in the Producer environment. Neither is enabled by default. Do not
delete this app; it can resume registered CPU segment artifacts when needed.
Never submit the same active job simultaneously to Modal and the host.


This Modal app is isolated from `worker/modal_app`. It does not use the
clips worker, a production server shell, a database connection or public B2.
The backend verifies the job-scoped bearer token and issues **short-lived**
private asset reads. The monthly guard queries the same `ai_usage` table
as the clips worker. No customer-facing price is displayed.

## Producer bundle contract (required)

Upload a ZIP as a ready **job-owned** asset via `POST /jobs/:id/assets`
with `kind: "project"`, `mime: "application/zip"`,
`filename: "render_bundle_v1.zip"`, SHA-256 and size. The existing asset
API supplies the private B2 object path and handles resume; no direct bucket
credentials are required in the Modal container. Use a new versioned
filename for changed bundles, rather than replacing a committed object.

The ZIP must contain **a complete already-composited browser scene**, not
only separately rendered plates. `project.json` example:

```json
{
  "width": 854,
  "height": 480,
  "fps": 30,
  "frameCount": 150,
  "durationMs": 5000,
  "composition": {"entryFile": "composition/index.html"},
  "mixedAudioFile": "audio/mixed.wav"
}
```

The entrypoint must expose `window.__scene.seek(seconds)` and accurately
compose the plate videos, motion-graphics/layer-scene text, transitions and
effects at the requested frame. Supply all local files/fonts (including
Schibsted Grotesk Black and Martian Mono Medium for the 5s test) in the ZIP.
External fetches are blocked during capture. Captions are **not** burned in.

For final delivery, supply the **existing producer package**:
`package.json` with `schema: transovo.motion-package/1`, the native
`document` and content-addressed `assets` map; `blobs/<sha256>` files
for each referenced source; and `bundles.json` containing the original
scene-bundle metadata. Include `live-project.json` when the Producer
authored the shared timeline. Modal verifies hashes, uploads source files
through the authenticated job asset API, then publishes those same native
IDs. Optionally, `portable.json` may instead contain an already-registered
`{document,assets,bundles,liveProject}` payload. Missing composition,
hashed source, or editable metadata fails safely: the renderer never invents
a film-assembly recipe or flattens a missing editable scene.

## Image, modes and encoding

The isolated image pins Node 22, Chromium, FFmpeg, puppeteer-core and
`hyperframes@0.9.52`. CPU uses SwiftShader; GPU uses a T4 with ANGLE/GL
and GPU rasterization. Both encode segments with libx264 CRF 16 for
apples-to-apples benchmarking. Use `MOTION_MODE=cpu` or `gpu`.

Master: preserve native project dimensions, H.264 High@4.2,
`yuv420p`, CRF 16, `+faststart`. Mixed WAV is normalized to -14 LUFS,
true peak -1.5 dB, and encoded AAC 192 kbps, 48 kHz stereo.
Share copy: **never upscale** native media; cap dimensions at 1280×720;
AAC 128 kbps; CRF 26, then 29/32/35 if needed. If the copy cannot fit
under 24 MB without violating those quality bounds, QA stops rather than
silently returning an oversized share file. Revisit size targeting for
longer films after the 5-second smoke test.

Auto QA checks decoded frame count, expected duration, audio presence,
black gaps over 0.6 s and EBU R128 integrated loudness (-16.5 to -13.5 LUFS).
Static scene holds are permitted; a full duplicate/motion analysis is not yet
implemented. The benchmark reports measured runtime and **estimated**
usage, not the authoritative Modal invoice.

Offline contract checks (no paid calls): `python3 -m unittest test_pipeline`
from `worker/modal_motion` with `requests` installed.

## Deploy and no-charge smoke

The production operator has `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`
already configured. Never echo values or enable shell tracing:

```bash
set +x
cd worker/modal_motion
modal deploy -m app
modal run -m app::ping
cd ../..
```

## First *paid* 5s Gold vs Bitcoin benchmark (one CPU, one GPU)

Before either submission the producer must register the real 854×480,
30 fps, 150-frame full-composition ZIP through its existing authenticated job
API. Test with `MOTION_SEGMENT_FRAMES=30` (5 segments) or 60 (3 segments).
A 5-minute lease must be renewed by a job-token call every ~2 minutes
during rendering/QA/upload. The worker has a background 105s heartbeat.
Coordinator mode auto-renews; pull-queue renewal is enabled in the backend.

Set these in the trusted producer shell (not in command-line arguments):
`MOTION_JOB_ID`, `MOTION_JOB_URL` (the full HTTPS jobs/:id API address),
`MOTION_JOB_TOKEN`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`,
`MOTION_ESTIMATE_USD_MICROS` (positive approved estimate),
`MOTION_CPU_USD_PER_SECOND` and `MOTION_GPU_USD_PER_SECOND`
(approved current compute rates, not guessed). Optional:
`MODAL_MOTION_APP_NAME`, `MOTION_BUNDLE_FILENAME` (default
`render_bundle_v1.zip`), `MOTION_BUNDLE_PATH` (if the ZIP needs uploading).
The submitter checks the **95% shared monthly limit before paid work**.

```bash
set +x
export MOTION_BUNDLE_FILENAME=render_bundle_v1.zip
export MOTION_SEGMENT_FRAMES=30
export MOTION_BENCHMARK_ONLY=1

# CPU: exactly once, no whole-job automatic retry.
export MOTION_MODE=cpu
node new-app/scripts/motion-studio/modal_submit.mjs

# After CPU result/QA is inspected, GPU: exactly once.
export MOTION_MODE=gpu
node new-app/scripts/motion-studio/modal_submit.mjs
```

Benchmark mode is **on by default** and must not approveMaster, publish
the editable payload or complete/fail the customer job. CPU and GPU upload
different filenames for comparable private outputs. Inspect
`GET /jobs/:id/render-status` with job bearer authorization; never print
bearer credentials or the returned presigned URLs. Collect frame count,
segment count, retries, QA, sizes, wall time and actual billed costs from
Modal for the final comparison. A new job assignment may be needed if the
5-minute lease expires between benchmarks.

## Production (after independent benchmark and composition QA)

Set `MOTION_BENCHMARK_ONLY=0` for an approved production assignment. Modal
then uploads `master_<mode>.mp4` and `share_<mode>.mp4`, approves the
master while keeping the job open, publishes the exact `portable.json`
payload and calls `/complete`. **Do not use** production mode until the
5s bundle faithfully matches the intended plate/layer assembly.

The submitted job token is converted into a per-job Modal Secret; only a
job ID, call ID and authenticated status endpoint are printed. No queue
secret, app admin secret, B2 S3 key, DB URL, or SSH credentials go to Modal.
No whole-run paid retries; at most 3 attempts for each segment. Original
Producer runners and clips-worker Modal functions are not modified.

## Technical-only post-render validation

The shared `pipeline.py` does not run black-frame/design detection; a
deliberately dark title treatment is valid. It checks container/decode,
frame count, FPS, resolution, durations and audio presence. The join
uploads master/share before technical QA and keeps registered segments.
On a technical join failure Modal retries QA once using those segments,
then reports `attention_required`, never `complete failed`. Normal
render and budget guards remain unchanged. The host-specific persistent
recovery directory is configured by `worker/motion_render_host/server.py`.
