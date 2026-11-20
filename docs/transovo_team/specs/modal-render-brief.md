# Build: Motion Studio final renders on Modal

Owner-approved (2026-11-19). Replaces the Nov 18 "CPU export" decision for **render jobs only**. ChatGPT: you have no browser/server access. Edit public repo `703deuce/sms` (app in `/new-app`) and push to `master`. Research snapshot: current `master` is `85d465a9`. Re-read the cited files; if they differ, follow the code. Never invent routes or env names.

**Context.** The Motion Studio Producer bot currently captures and encodes the finished film on its box, then uploads via the job API. That work burns bot usage and can take ~45 minutes for a 5-minute 1080p30 film (9,282 frames). Move final renders to Modal: the bot uploads a render bundle to private B2, submits, and stops. Modal fans out segment capture, joins+muxes+encodes, auto-QAs, uploads render-first (MP4 while the job stays open), then the editable portable, then `/complete`. First paid test is the short Gold vs Bitcoin film below — not the 5-minute film.

## 1. Facts already in master (do not regress)

- **Keep the MP4 after live `/complete`.** Commit `4424d70d` (2026-11-19) fixed `9b17f7ee`, which used to finish live jobs without attaching a master. `botFinish` in `new-app/lib/server/motion-studio/agent-bridge.ts` now re-reads the approved master inside the completion transaction (`kind=video`, `mime=video/mp4`, `filename!=='editor-base.mp4'`, `key===resultKey`) and writes `resultKey` / `exportInfo.masterKey` / Compact `clipUpload`. Legacy masterless live jobs stay valid; do not invent a render at complete time.
- **`productionInstructions` are already render-first** (same file, `botGetAssignment`). Quote (current text):
  - `editableTimeline`: render and approve the master MP4 first so the customer can watch while the job remains open; then deliver `transovo.live-project/1` with registered scene bundles, footage, editable text/captions, stems, effects.
  - `delivery`: after approval, upload and `approveMaster` the MP4 **without completing**. Upload the immutable editable project, publish the producer document + `transovo.live-project/1`, then complete with `{delivery:'live', portableVersionId, durationMs}`. Keep the already-approved MP4 as the original preview.
  - `heartbeat`: detached editable-delivery worker sends `/checkpoint` while uploading; resume unfinished uploads before the next job; after an expired producer lease, claim a new assignment.
- Commit `93896d3` is **not** the keep-MP4 path; it only preloads Compact player frames. Ignore it for this work.

## 2. Job API (Producer / Modal use this)

Base: `https://transovo.ai/api/motion-studio/agent`. Auth for job routes: header `Authorization: Bearer <jobToken>`. Token is SHA-256 hashed as `sha256(jobId + ':' + token)` into `MotionStudioAgentJob.tokenHash`. Issued at dispatch (`agent-bridge.ts` `dispatchAgentJob`) and on pull-queue claim (`producer-queue.ts`). **TTL is 36 hours** (`TOKEN_MS = 36 * 3600_000`), not 30 minutes. A staged `pendingTokenHash` is also accepted until `pendingTokenExpiresAt`.

**What is 5 minutes / 30 minutes:** producer **lease** is `LEASE_MS = 5 * 60_000`. If `MOTION_STUDIO_PULL_QUEUE=1` or the coordinator is on, `requireBotJob` rejects a still-valid job token once the lease expires (`Producer lease expired; claim this job again.`). Coordinator mode auto-renews the lease on any job-token call; **pull-queue mode does not** — lease renew is `POST /queue/lease` with the *queue* credential (`MOTION_STUDIO_PRODUCER_QUEUE_KEY`), action `heartbeat` or `renew` (`renew` also rotates `jobToken`). Assignment signed media URLs use 1800s; customer preview URLs use 3600s; SHA verify downloads use 900s.

| Method | Path | Handler | Body / notes |
|---|---|---|---|
| POST | `/queue/claim` | `claimProducerJob` | Queue Bearer + `{workerId}` → `{job: {jobId, jobUrl, jobToken, leaseId, leaseExpiresAt, tokenExpiresAt, ...}\|null}` |
| POST | `/queue/lease` | `updateProducerLease` | Queue Bearer + `{jobId, workerId, leaseId, action:'heartbeat'\|'renew'}` |
| GET | `/jobs/:id` | `botGetAssignment` | Full assignment + `productionInstructions` + short-lived signed input URLs |
| POST | `/jobs/:id/progress` | `botProgress` | `{stage\|phase, percent\|progress, message, sceneId?}`. Stage one of customer stages; progress capped at 99 until complete |
| GET/PUT | `/jobs/:id/checkpoint` | `botGetCheckpoint` / `botSaveCheckpoint` | PUT validated checkpoint `{revision, ...}`; optimistic concurrency |
| POST | `/jobs/:id/assets` | `botAssets` | See actions below. Object key: `ws/{workspaceId}/motion-studio/agent/{jobId}/{uploadId}/{filename}`. Max 2_000_000_000 bytes |
| GET/POST | `/jobs/:id/portable` | `portableAssetSession` / `publishPortableVersion` | POST `{document, assets, bundles, liveProject, expectedBaseVersionId?}` (sourceJobId injected). Idempotent per `sourceJobId` |
| POST | `/jobs/:id/complete` | `botFinish` | Success: `{delivery:'live', portableVersionId, durationMs}`. Fail: `{status:'failed'}` (customer message is a **generic** string; reason is ignored today) |
| POST | `/jobs/:id/usage` | `botRecordUsage` | `{items:[{provider, units, usd}]}` stored on `job.usage` only (does **not** currently write `AiUsage`) |

**`botAssets` actions:** `prepare` `{action, filename, kind, mime, bytes, sha256?, elementId?, trackId?, resume?}` → `{uploadId, objectKey, mode, signedPut, tus, s3Multipart}` (or `{exists:true}` on resume). `commit` `{action, uploadId, parts:[{partNumber,etag}]?}` verifies size and optional SHA-256, upserts `StudioAsset` (`status:'ready'`, `provenanceLog.verifiedSha256`). `approveMaster` `{action, uploadId, sourceJobId?}` sets `resultKey` while status is dispatched/dispatching/running; job stays **open**. `receipts` / `reuse` for resumable recovery. Kinds: `video|project|media|audio|source|font|image|bundle`.

There is **no** `/fail` route. Fail via `/complete` `{status:'failed'}`.

Prisma (additive only): `MotionStudioAgentJob` (token/lease/artifacts/resultKey/checkpoint/usage), `MotionStudioPortableVersion`, `MotionStudioProject.exportInfo`, `StudioAsset`, `StudioActivityEvent`. Related: `ClipProject` / `ClipUpload` attached at complete. `AiUsage` (`@@map("ai_usage")`: `provider`, `units`, `unitType`, `costUsdMicros`, `workspaceId`, …) is what the clips Modal budget reads.

## 3. Storage (private B2)

Env names only (never log values): `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (fallback `us-east-1` in `getS3Config`; B2 tests use `us-east-005`), `S3_FORCE_PATH_STYLE` (default on), `S3_MULTIPART_PART_BYTES` (default 32 MiB; B2 minimum 5 MiB). Docs/tests: bucket `transovo-clips`, endpoint `https://s3.us-east-005.backblazeb2.com`. **Confirm from env, do not hardcode if config exists.** Bucket stays private. Access via short-lived signed URLs only. Render bundle goes under a versioned job path in this same bucket (e.g. `ws/{workspaceId}/motion-studio/render/{jobId}/{bundleVersion}/…`). No Modal Volume as source of truth.

Editable upload chunk size used by current runners: **6 MiB** TUS PATCH chunks (`run-leased-render.mjs`, delivery `lib.mjs`). S3 multipart also supported. Resume via `prepare` `{resume:true, sha256}` + `receipts`.

## 4. Existing Modal pattern (follow; do not break)

Python Modal SDK. App: `worker/modal_app/app.py` — `modal.App(os.environ.get("MODAL_APP_NAME", "transovo-gpu"))`. Classes: `Transcriber`, `FaceTracker`, `Renderer` (clip filtergraph encode, L4, NVENC or libx264), `Matter`. Worker calls `modal.Cls.from_name(APP_NAME, "…")` then `.remote()` / `.map()` (`worker/clips_worker/gpu/modal_provider.py`). Tokens: `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` (env only). Deploy already documented as `cd /app && modal deploy -m modal_app.app` (clips worker). Budget: `MODAL_MONTHLY_BUDGET_USD` default `"30"`; clips worker `gpu/budget.py` allows until **95%** of month-to-date `ai_usage` where `provider='modal'` (needs `DATABASE_URL` on the **worker**, not inside a new film-render container).

**Put the new film renderer in a separate package and Modal app** (suggested: `worker/modal_motion/`, default app name `transovo-motion-render`, overridable by `MODAL_MOTION_APP_NAME`) so `modal deploy` cannot break clips functions. Do not edit `worker/modal_app/render.py` or other existing Modal classes.

## 5. Producer render facts (reference only — do not modify those runners)

Add new files; do not change existing Producer runners (`publish-live.mjs`, `publish-editable.mjs`, `run-leased-render.mjs`, box delivery scripts, `engines/browser.mjs`, `assemble.mjs`, `_capture/capture.mjs`). Branch `grokbot/motion-studio-producer-kit-20261117` is **read-only reference — do not merge**.

Capture (browser engine + `_capture/capture.mjs`): headless Chrome via `puppeteer-core`, per-frame `window.__scene.seek(t)`, PNG pipe to ffmpeg. Current box Chrome flags use software GL: `--no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --disable-background-timer-throttling --disable-renderer-backgrounding --hide-scrollbars --font-render-hinting=none`. MP4 encode of a scene/plate: `libx264 -profile:v high -level:v 4.2 -pix_fmt yuv420p -crf 16 -preset medium -movflags +faststart`. `assemble.mjs` master recipe: same High@4.2, two-pass bitrate **or** `-crf` default 18, AAC `128k` default (live-delivery contract in `publish-live.mjs` uses AAC `192k`, 48 kHz, stereo, `targetLufs: -14`, `truePeakDb: -1.5`, `captions.burnIn: false`).

HyperFrames packages in the engine tree are **0.9.52**. Pin that in the Modal image for scenes that use it. Telemetry off (`HYPERFRAMES_TELEMETRY=0`, `DO_NOT_TRACK=1`).

Render-first upload sequence already used on the box: (1) upload `master.mp4` via prepare/commit, (2) `approveMaster` (job stays open; `/progress` e.g. stage `delivering`, percent 90, “ready to watch”), (3) background editable upload with retries + `/checkpoint` heartbeat, (4) `POST /portable`, (5) `POST /complete` `{delivery:'live', portableVersionId, durationMs}`.

## 6. First test (short) — Gold vs Bitcoin

- Project `msp_29e20d22a10d4403886b441cd7b985df`, title “Gold vs Bitcoin in 2026…”.
- Native format: **854×480**, **30 fps**, **5.000 s**, **150 frames** (not 1080p). Scenes: S1 1700 ms, S2 2200 ms, S3 1100 ms.
- Fonts: Schibsted Grotesk Black, Martian Mono Medium.
- Audio mix: 5.000 s, 48 kHz, pcm_s24le WAV, plus narration/music/SFX stems.
- Engines: three.js r187 + D3 + GSAP (seek-driven plates) + `transovo.layer-scene/1` text. **This film does not use HyperFrames.** Existing plate MP4s are H.264 High 854×480 30 fps ~20.5 Mbps (CRF 16). No assembled final-master recipe was present in the job folder at research time.
- `segment_frames` must be **configurable** (default 300 for long films). For this test use **30–60** so several containers run at once (150 frames → 3–5 segments).

Resolution: first test encodes at the **project native size** (854×480). Also implement the general 1080p High master + 720p share-copy (<24 MB) path for later films. Do not invent 1080p pixels for this 480p project. The ~45 min box baseline is for the 5-minute 1080p film, **not** this 5s test — do not compare those clocks.

## 7. Architecture to build

Bot (or `modal_submit.mjs`) uploads the render bundle to the private versioned B2 path (scene HTML/JS, assets, fonts, mixed audio, `project.json` with width/height/fps/durationMs or frame count, plus job id). It then starts Modal and exits. Job-scoped token is a Modal **secret**, never in logs or CLI args.

Modal image: headless Chromium, Node, puppeteer, HyperFrames **0.9.52**, FFmpeg (libx264 + NVENC), the same two fonts (and a way to install bundle fonts). Benchmark **two** images/functions: (A) CPU-only, SwiftShader flags as on the box; (B) GPU T4 or L4 with `--use-gl=angle` or `egl` and `--enable-gpu-rasterization`. Use GPU only where it wins (3D/WebGL plates, NVENC). Report both.

Pipeline:

1. Split `[0, frameCount)` into `segment_frames` ranges. `.map()` across containers. Each range: seek-capture PNGs (or raw video) and encode a segment. **Resumable:** skip segments already in the versioned B2 prefix; retry each segment up to **3** times; generous protocol timeout. No further automatic paid retries after the run.
2. One join function: concat segments, mux the mixed audio (do not burn captions), encode (a) master H.264 High@4.2 yuv420p +faststart, bitrate/CRF matched to current plates (CRF 16) at the project’s size, (b) 720p share copy **under 24 MB** (choose settings; document them).
3. Auto QA in the same function: duration vs expected frame count/fps; `ffmpeg blackdetect`; dropped/duplicate frames (Producer QA uses `mpdecimate` during camera moves; static holds OK); A/V length match; loudness (encode target **−14 LUFS**, true peak **−1.5 dB**; fail if integrated loudness is outside **−15 ±1.5 LUFS** from the Producer QA skill). On failure: do **not** upload; mark the job failed and persist the real reason (see backend).
4. On pass: render-first upload to the job API (prepare/commit/approveMaster), then editable portable with 6 MiB chunks, retries, resume, then `/complete`. Status: `queued` → `rendering n/N` → `qa_pass`/`qa_fail` → `uploaded` → `completed` via `/progress` plus the new status endpoint.

## 8. Files to create (public repo — no secrets, no box/SSH paths)

- `worker/modal_motion/` — Modal app (`app.py`), CPU + GPU capture/encode functions, join+QA, README.
- `new-app/scripts/motion-studio/modal_submit.mjs` — next to existing scripts. Reads `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` from env (`set +x`). Uploads/points at the B2 bundle, checks budget, submits, prints only job id + Modal call id + status URL (never tokens or signed URLs).
- Short README with **exact** deploy and smoke-test commands (below). Keep operator usage low: no exploratory steps.

## 9. Additive backend changes

1. **Do not regress** keep-MP4 or render-first `productionInstructions`. Optionally tighten instructions to mention Modal submit, but keep the same sequence.
2. **Lease survival for a detached Modal run.** Job token is already 36h; the 5-minute lease is the gap. Add one of: (a) `requireBotJob` also renews a *pull-queue* lease on job-token calls (same as coordinator), and/or (b) a job-scoped **render token** valid for the render window, single job, upload/complete/progress/checkpoint scopes only. Modal must not receive `MOTION_STUDIO_PRODUCER_QUEUE_KEY`, SSH, Coolify, or DB credentials. Modal heartbeats with `/progress` or `/checkpoint` only.
3. **Render status** endpoint/webhook: `queued | rendering n/N | qa_pass | qa_fail | uploaded | completed` (and failure reason). Additive Prisma field or small table if needed; additive migration only. `/progress` can keep the customer-facing text.
4. **Failed QA reason:** today’s `/complete {status:'failed'}` overwrites the message with a generic customer string. Persist the real reason on the status record or checkpoint.
5. **Budget:** before any Modal start, enforce the same 95% `MODAL_MONTHLY_BUDGET_USD` guard. Implement it in `modal_submit.mjs` and/or a new-app endpoint — **not** by giving Modal `DATABASE_URL`. When Modal finishes, `POST /usage` and **also** write `AiUsage` (`provider='modal'`, `costUsdMicros`) so film renders and clips share one monthly cap. Never show `$` in the product UI (internal micros/usage records are fine).
6. Do not touch the SMS worker, Coolify app3, or existing clips Modal app classes.

## 10. Deploy + smoke (Grok Bot will run these)

Tokens already exist on the production worker as `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`. README must give copy-pasteable commands, tokens from env only, `set +x`, never printed:

```bash
set +x
cd worker/modal_motion
modal deploy -m app
# smoke (no paid fan-out): a ping/health function
modal run -m app::ping
# first paid test: 5s Gold vs Bitcoin bundle already on B2, segment_frames=30 or 60, once on CPU, once on GPU
# include the exact modal run / submit command and required env names (MODAL_TOKEN_ID, MODAL_TOKEN_SECRET,
# MODAL_MOTION_APP_NAME, job url/token env names). One run each; no automatic retry of the whole job.
```

## 11. Rules

- Never print keys, tokens, signed URLs, or query strings. Log lengths only if needed.
- Job-scoped tokens only inside Modal. No production SSH, Coolify admin, or direct DB from Modal.
- B2 bucket stays private. Production uploaded assets stay private.
- Never show `$` in product UI.
- Additive DB migrations only.
- No force-push, history rewrite, or reset. Do not merge `grokbot/motion-studio-producer-kit-20261117`.
- Do not modify existing Producer runner files; add new ones.
- Captions are never burned in.
- No automatic paid retries beyond 3 per-segment retries within one run.
- Repo is public: no secrets, no box paths, no hostnames/IPs, no real signed URL examples.
- T2V stays stopped; no other paid products.

## 12. Acceptance

Report wall time and **cost per rendered minute** for the 5-second film on **CPU vs GPU** (T4 or L4). Also report segment count, retries, QA pass/fail, master bytes, 720p share bytes, and whether `approveMaster` made the MP4 playable before `/complete`. A later 9,282-frame 1080p30 acceptance vs the box (~45 min) is out of scope until this 5s test passes.

## Verified / UNVERIFIED — ChatGPT confirm in code

- VERIFIED on production 2026-11-19: `MOTION_STUDIO_COORDINATOR=1` and `MOTION_STUDIO_PULL_QUEUE` is unset, so any job-token call renews the 5-minute lease. Modal must make a job-token call (e.g. `/checkpoint`) at least every ~2 minutes throughout render, QA and upload. Still support pull-queue mode defensively.
- VERIFIED on production: `S3_BUCKET=transovo-clips`, `S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com`, `S3_REGION=us-east-005`. Still read them from env in code.
- Film-level (muxed) master bitrate for 1080p — only 480p plate encodes (~20.5 Mbps, CRF 16) were inspected. 720p-under-24MB encode settings are not in repo; pick and document.
- How this 5s film is meant to be *composited* today (plates + layer-scene overlays + mix vs recapture of every HTML scene). Accept a bundle that includes whatever the Producer hands off; do not invent a missing assembly recipe.
- Whether `botRecordUsage` should stay as-is plus a new `AiUsage` write (no existing hook was found).
- Box wall time for *this* 5s film (unknown; do not use the 45-minute figure).
