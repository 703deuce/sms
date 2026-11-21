# Change spec: render Motion Studio films on our own server instead of Modal

Repo: 703deuce/sms (master, currently at 07e5b02)
Owner: Rick (Tony). Written Nov 20, 2026. Revised the same day: jobs go through the existing transovo.ai app, not a new public address.

**Rules for this change**
- Plain changes only. No destructive database changes and no new tables. No schema migration is needed for anything below.
- Never put a secret in the repo, a log, a command line or a status message.
- No money amounts anywhere in the product UI.
- Do not deploy the live web app, the SMS worker, or `app3` yourself. You may add the new start-render endpoint in the existing web app code (`new-app`); Rick deploys it.
- The render worker is a **new, separate** Coolify app with **no public hostname, no subdomain and no public DNS**.
- Modal stays in the code as an **optional backup that is off by default**. Do not delete `worker/modal_motion/` or the Modal app.

---

## 1. Why we are doing this

Today every Motion Studio film is rendered on Modal (app `transovo-motion-render`, code in `worker/modal_motion/`). Modal bills for every second of every machine it starts, so the cost grows with the length of every film.

- The 1-minute "viewbotting" film (job `msaj_5630bfc9-bb2d-4f00-8777-8920740dfa65`, 854x480, 30 fps, 1800 frames, 12 segments of 150 frames) cost about $0.22 on Modal. A 10-minute film is about $1.50 to $2.20 and a 20-minute film about $3 to $4.40, **every time**, for every customer job.
- A rented server is a flat monthly price no matter how much we render.

**Benchmark we ran on Nov 20 (on the current Hetzner server "sms"):**
- Same film, same bundle, same render software as Modal (details in section 2.1).
- Total time from bundle to finished MP4: **7 min 03 s**. Of that, 6 min 52 s was drawing frames (12 segments, 45 to 80 s each, 2 at a time) and about 20 s was join, loudness, QA and the share copy. A one-time 1 min 31 s software setup is not included because a long-running worker does it once.
- Output matched Modal exactly: 60 s, 854x480, passed the same QA checks.
- The live site stayed healthy the whole time (health checks kept answering 200 in under 1 s).
- Modal had the MP4 ready in about 3 minutes, so this 4-core box is about 2x slower than Modal but costs nothing extra per render. A dedicated 16-core server should beat Modal.

**Decision (Rick):** render on our own server now (the existing "sms" box), and later move rendering to a dedicated render server Rick will buy. The later move must be a config change, not a rewrite.

---

## 2. The new render worker

### 2.1 What it is
A long-running container ("the render worker") that runs on the render host. For now that host is **sms** (Hetzner, 4 vCPU AMD EPYC, 7.6 GB RAM, about 17 GB free disk at 89% used, runs Coolify plus the live Transovo web app). It has no public address.

**Contents of the image must match Modal's image** (see the image definition in `worker/modal_motion/app.py`):
- base `node:22-bookworm`
- `chromium`, `ffmpeg`, `fonts-dejavu-core`, `fontconfig`
- Python 3.11 with `requests`
- `puppeteer-core@24.31.0` and `hyperframes@0.9.52` installed in the same folder as the code
- env `CHROMIUM_BIN=/usr/bin/chromium`, `HYPERFRAMES_TELEMETRY=0`, `DO_NOT_TRACK=1`
- the **same** `worker/modal_motion/capture.mjs` and `worker/modal_motion/pipeline.py` files (use them from the repo, do not copy or fork them)

**Reference: the benchmark files** (on the agent box at `/workspace/render_bench/`, not in the repo):
- Its Dockerfile built exactly the image above from `node:22-bookworm` (using Debian's own Python 3.11 and `python3-requests`), installed the pinned puppeteer-core and hyperframes, set the same three env vars, and copied `capture.mjs`, `pipeline.py` and a small benchmark script into `/root/modal_motion`.
- Its `bench.py` unpacked `render_bundle_v1.zip` once, cut the film into 150-frame segments, rendered them with a pool of 2 workers by calling `capture.mjs` (up to 3 tries per segment, same as Modal), then did exactly what Modal's join-and-QA step does: concat, master encode (libx264 CRF 16, High@4.2, yuv420p, faststart, loudness to -14 LUFS / -1.5 dB TP, AAC 192k 48 kHz stereo), the pipeline QA checks, and the share copy (cap 1280x720, CRF 26 then 29/32/35 until under 24 MB). It had all networking removed (no job API, no uploads).
- It ran with: nice 10, Docker CPU shares 256, memory 5 GB, and no network during the render.

### 2.2 Where the code goes
- New folder `worker/motion_render_host/` for the long-running service (job intake, queue, runner, health). It **imports** the pipeline functions from `worker/modal_motion/pipeline.py`; it does not duplicate them.
- New root Dockerfile `Dockerfile.motion-render` (same naming style as `Dockerfile.sms-worker`) that builds the image in 2.1 and starts the service.
- A short `worker/motion_render_host/README.md` explaining deploy, env vars, how to check health on the internal network, and how to move to another server.

### 2.3 What it does for each job (the exact same steps Modal runs today)
Follow the current `render_film` path in `worker/modal_motion/app.py` step for step, minus the Modal-only parts:

1. Check the job is still valid (job API GET on the job URL). Start the background heartbeat (every 105 s) so the 5-minute job lease never expires.
2. Post `render-status` stage `queued` with the segment total, then progress "Rendering finished scenes" (same calls as today).
3. Download the bundle **once per job**, check `project.json`, and split it into segments of `segmentFrames` frames.
4. Render segments with a pool of `RENDER_SEGMENT_WORKERS` workers. For each segment: if a segment with that name is already registered for the job, skip it; otherwise capture it, up to 3 tries, then upload it through the job asset API. **Keep the same segment file names** (`modal_seg_v1_cpu_<start>_<end>.mp4`) so retries and the existing `reuse.sh` keep working across both backends. After each segment, post `render-status` stage `rendering` with completed/total.
5. Join, encode, loudness, QA and share copy exactly as today (it uploads `master_cpu.mp4` and `share_cpu.mp4` through the job asset API). Since the segments were just rendered on this machine, it is fine to use the local copies instead of downloading them again, but the steps and encode settings must stay exactly the same. Post `render-status` stage `qa_pass`.
6. If not benchmark mode: approve the master, progress "Video ready to watch; preparing editable version", `render-status` stage `uploaded`, then publish the editable version, then complete the job with live delivery, the portable version id and duration, then `render-status` stage `completed`. Same order as today.
7. On any failure: post `render-status` stage `qa_fail` with the readable reason (first 800 characters, URLs already stripped), and if not benchmark mode mark the job failed, exactly as today. The worker then moves on to the next job.

**Small refactor allowed in the pipeline:** let the capture and join-and-QA steps accept an already-unpacked bundle folder (optional), so the worker downloads the zip once per job instead of once per segment. The Modal path must keep working unchanged when that option is not passed. `/root/modal_motion` stays the code path inside both images.

**Modal-only parts to skip in the self-hosted path:**
- The Modal budget check, the cost-estimate requirement and the per-second Modal rate checks.
- Usage: do **not** post a Modal usage item (that feeds the Modal monthly budget guard). Either post nothing, or post one item with provider `self_hosted`, units = render seconds and usd 0. Never show cost in the UI.
- Keep using the existing `render-status` endpoint as is (it stores events with kind `modal_render`; leave that name alone so nothing in the database changes).

### 2.4 One job at a time, and protect the live site
- **One job renders at a time** on the host. Others wait in a queue in arrival order.
- Inside a job, `RENDER_SEGMENT_WORKERS` segments render in parallel (default **2** on sms, which is what the benchmark used).
- While a job waits in the queue, the worker **keeps its lease alive** with the same heartbeat, so it does not expire before its turn.
- Resource limits in the Coolify app (custom Docker options): CPU shares 256 (the web app keeps priority when the box is busy, but the render can use idle cores), memory limit **5 GB**, a sensible process limit, and the render processes run at nice 10.
- Per-job time limit (env `RENDER_JOB_TIMEOUT_MIN`, default 180). If it is exceeded, the job fails with a readable reason.
- If the job API says the job is cancelled or finished (409) or the token is no longer valid (401), stop that job quietly, clean up, and move on. Never retry a publish on a job that already finished.

### 2.5 Survives restarts
- The queue is saved to a small file on a Docker volume, so if the container restarts (deploy, crash, server reboot) it picks the queue back up and continues the job that was running. Because finished segments are already registered for the job, a resumed job only re-renders the segments that were in progress.
- Turn **off** Coolify auto-deploy-on-push for this app (redeploy it by hand when it is idle), so a push to master does not interrupt a render. The worker's health endpoint (below) shows whether it is idle.

### 2.6 Status and health
- The real job status keeps coming from the job API's `render-status`, same as with Modal, so `status.sh` and the app work unchanged.
- The worker also has a health endpoint (no job details): ok, idle or busy, queue length, segment workers, disk percent used, and whether it is accepting jobs. It is only reachable on the internal network.
- A job-status endpoint on the worker (needs the shared secret) returns that job's queue position or stage. Never returns tokens or links.

---

## 3. How jobs get to the worker

The producer runs off the server, so it should not talk to the render worker directly. The worker has **no public address**, and there is no new subdomain or DNS.

**The flow:**
1. The producer builds the bundle as today (`make_bundle.py`), then uploads it through the existing transovo.ai job API, same as it does now.
2. The producer then asks the existing transovo.ai web app (Coolify app 1) to start the render, through a **new admin-authenticated endpoint** on that app. This is the only new web app change. It replaces the Modal submit call.
3. The web app checks the request, then forwards the job to the render worker over the **internal Coolify/Docker network**, using the worker's internal service name and a shared secret. It passes the job id and whatever the worker needs to talk to the existing job API. If that job is already queued or running, it returns the existing entry instead of adding a duplicate.
4. The producer writes `submit.json` and stops. It does not watch the render.
5. The worker reports progress and completion back through the existing job API, same as today.

**Security:**
- The worker is not reachable from the public internet. Do not give it a public hostname.
- Shared secret between the web app and the worker, set as env vars (never in the repo, logs or command lines). Compare it in constant time. Wrong or missing secret = refused with no details.
- The new web app endpoint is admin-authenticated. The producer does not send job tokens to the worker, and does not call the worker itself.
- Any job credentials the worker needs come from the web app over the internal network. They stay only on the worker's private volume (file mode 600) while the job is queued or running, and are deleted when the job ends. They are never logged or echoed back.
- During capture, Chromium still blocks every non-local request (already done in the capture script). The worker itself only talks to `transovo.ai` (job API) and the storage links the job API hands out.

**Config (env vars on the worker):**

| Variable | Meaning | sms default |
|---|---|---|
| `RENDER_HOST_SECRET` | shared secret for requests from the web app | (set in Coolify, never in the repo) |
| `RENDER_SEGMENT_WORKERS` | segments rendered in parallel | 2 |
| `RENDER_MEMORY_LIMIT` | memory cap; also set on the container | 5g |
| `RENDER_NICE` | nice level for render processes | 10 |
| `RENDER_JOB_TIMEOUT_MIN` | per-job time limit | 180 |
| `RENDER_DISK_MAX_PERCENT` | do not start a job above this disk use | 90 |
| `RENDER_WORK_DIR` | temp folder for jobs (on the volume) | /work |
| `RENDER_ALLOWED_JOB_HOST` | only accept job URLs on this host | transovo.ai |

**Config (env vars on the existing web app, Coolify app 1):**

| Variable | Meaning | sms default |
|---|---|---|
| `RENDER_WORKER_URL` | internal address of the render worker (its Coolify/Docker service name, not a public URL) | the internal service name Rick sets |
| `RENDER_HOST_SECRET` | same shared secret as the worker | (set in Coolify, never in the repo) |

**Config (on the producer box):**

| Variable | Meaning | Default |
|---|---|---|
| `RENDER_BACKEND` | `self_hosted` or `modal` | `self_hosted` |
| `MOTION_MODAL_FALLBACK` | if `1`, and the web app cannot start the render after 2 tries, submit to Modal instead | `0` (off) |

The producer does **not** need a render-worker URL or the shared secret. Modal is used **only** if someone sets `RENDER_BACKEND=modal` on purpose, or sets `MOTION_MODAL_FALLBACK=1`. A refused or unreachable start-render call with fallback off is an error the producer reports to Rick; it never silently goes to Modal. The existing Modal kill switch (`.modal_disabled` / `MODAL_DISABLED=1`) keeps working.

---

## 4. Disk hygiene (sms is already at 89%)

- Every job works in its own temp folder under `RENDER_WORK_DIR` and that folder is **always** deleted when the job ends, whether it passed, failed or was cancelled. On startup the worker deletes leftover temp folders that do not belong to the job it is resuming.
- Before starting a job, check disk use of the host filesystem. If it is above `RENDER_DISK_MAX_PERCENT` (90), do **not** start; keep the job queued (heartbeat still running), show "not accepting" and the reason on the health endpoint, and check again every minute. If a job has waited more than 30 minutes for disk, fail it with the readable reason "render host disk full".
- Also check there is room for this job (about 4 times the bundle size plus 2 GB) before downloading.
- The worker never runs any Docker prune, and never touches other containers, volumes or images. Disk clean-up of the host stays a manual job (only unused images/build cache, never volumes, never `app3` or the SMS worker, never running containers).
- Logs: rotate them (Coolify/Docker log size limit), and never write tokens or presigned links.

---

## 5. Retries reuse, never rebuild

- A retry of a failed render is **never** a rebuild of the film. It reuses the saved bundle and every finished segment.
- Inside one job: each segment gets up to 3 tries (as Modal does). There is no automatic whole-job retry.
- On a new retry job for the same project (only with Rick's OK, as today): the producer runs `reuse.sh J2 <J1 jobId>` (borrows the earlier job's `render_bundle_v1.zip` and every ready segment), then `submit.sh J2` with the **same** segment frames as the source job's `submit.json`. The worker finds the segments already registered, skips them, and goes straight to join, QA, upload, publish and complete. This works because the worker keeps Modal's segment names and the skip check.
- Because names are shared, a job that half-finished on Modal can be finished on the render worker (and the other way round).

---

## 6. Producer skill and scripts

The current Modal handoff scripts are in the repo at `producer_handoff_kit/modal_render/` (branch `grokbot/modal-render-scripts-20261120` until it is merged to master). That folder is the starting point for this change: `make_bundle.py`, `submit.sh`, `status.sh`, `reuse.sh`, `reuse_assets.py`, `render_status.py`, `lib_env.sh`, `check_page.mjs`, `setup.sh` and the short README. In the repo's skill, `SKILL.md` section 8 may still describe rendering on the producer box plus `bg_delivery/launch.sh`; update that as part of this work.

The producer PR should:
1. Add the new render kit at `producer_handoff_kit/skills/motion-studio-production/scripts/render/`, starting from `producer_handoff_kit/modal_render/`.
2. `submit.sh`: by default uploads the bundle through the existing job API, then asks the transovo.ai web app's new start-render endpoint to begin the job (section 3). Keeps the "submit once" rule (refuses if `submit.json` already has a submission unless `FORCE_RESUBMIT=1`), the segment-size rule (150 frames for normal films; same frames as the source job for retries), and `DRY_RUN=1`. Writes `submit.json` with backend `self_hosted`, the render id, segments and segment frames (no cost estimate for self-hosted). Prints nothing secret. The Modal branch stays, used only when `RENDER_BACKEND=modal` or the fallback switch is on.
3. `status.sh`: unchanged job API `render-status` read (one read, no polling). If the job is still queued, it may also show the queue position the web app or worker reports.
4. `reuse.sh`: unchanged (it only talks to the job API).
5. Kit `README.md` and `SKILL.md` section 8 (live jobs): "After approval, `make_bundle.py --job-dir J --check-page`, then `scripts/render/submit.sh J` once and stop. The web app hands the job to the render worker, which renders, runs QA, uploads, publishes and completes. Check once with `status.sh`." Modal is described only as a backup that is off by default. The current on-box render plus `bg_delivery/launch.sh` stays as the fallback if the render worker is down (never both paths for one job).
6. `RULES_FROM_RICK.md`: add one dated rule: "Nov 20: Films render on our own render server, not Modal. Modal is backup only, off unless Rick turns it on."
7. Keep wording free of cost amounts.

---

## 7. Moving to the dedicated render server later

Nothing in the code should assume the worker is on sms. To move, change **one env var** on the existing web app: point `RENDER_WORKER_URL` at the new machine, and use the same shared secret there.

If the dedicated server is not on the same Docker network as the web app, that URL should be a private address (a private network or Tailscale), not a public hostname.

Also raise `RENDER_SEGMENT_WORKERS` and the memory cap to fit the new box (about 1 worker per 2 cores, for example 8 workers and more memory on a 16-core box). Render the test bundle (section 8), then stop the worker app on sms. That is a config change only. Rough speed guide from the benchmark: 4 shared cores on sms = about 8 minutes of video per hour; 16 dedicated cores should be about 30 or more.

---

## 8. How to test

**Offline (no server needed):**
- Existing pipeline unit tests in `worker/modal_motion` still pass.
- New unit tests in `worker/motion_render_host/`: wrong/missing secret is refused; bad job URL is refused; duplicate submit returns the same entry; only one job runs at a time; disk above the limit keeps the job queued; temp folder is deleted after pass, fail and cancel; a segment already registered is skipped; restart resumes the saved queue; no token or link ever appears in logs or responses.
- A dry run of the producer's `submit.sh` with `DRY_RUN=1` shows backend `self_hosted`.

**End to end on sms (a test job, not a customer job):**
1. Deploy the worker as its own Coolify app on sms, with no public hostname. From the internal network, check that the worker is idle and accepting.
2. Rick or the Chief of Staff creates a fresh test job (the old viewbotting job's token/lease is spent). Reuse the existing viewbotting bundle (from job `msaj_5630bfc9-bb2d-4f00-8777-8920740dfa65`, `deliver_modal/render_bundle_v1.zip`, about 99 MB). Optionally run `reuse.sh` first to also test segment reuse.
3. First run with benchmark mode on (does not approve, publish or complete), then a second run in production mode on the test job.
4. Watch the live site's health every 20 to 30 seconds during the render.

**Acceptance checks:**
- Master is 60 s, 1800 frames, 854x480, 30 fps; audio present; QA passes (loudness between -16.5 and -13.5 LUFS, no black gaps over 0.6 s); share copy is under 24 MB.
- Render time about 7 minutes on sms with 2 segment workers (a little more because of the upload).
- `render-status` goes queued, rendering n/12, qa_pass, uploaded, completed.
- The film plays in the app and the editable version opens in the editor (production run).
- The live site answered every health check (200, normal speed) during the render. The web app container never restarted.
- The temp folder is gone afterwards and disk use is back where it started (apart from the image itself).
- No Modal call was made and no Modal usage was recorded.
- Retry test: run it again on a fresh test job after `reuse.sh`; it skips all 12 segments and goes straight to join/QA/publish.

---

## 9. Ordered checklist for ChatGPT

1. Read `worker/modal_motion/app.py`, the pipeline and capture files, its README, `new-app/scripts/motion-studio/modal_submit.mjs`, and the current producer Modal scripts at `producer_handoff_kit/modal_render/` (on `grokbot/modal-render-scripts-20261120` until that branch is merged).
2. Small refactor in the pipeline: optional already-unpacked bundle folder for capture and join-and-QA; Modal behavior unchanged; existing tests pass.
3. Add `Dockerfile.motion-render` with the same contents as the Modal image (section 2.1).
4. Add `worker/motion_render_host/`: internal job intake (shared secret, no public address), saved queue, one job at a time, segment worker pool, heartbeat for queued and running jobs, the exact Modal pipeline steps, readable failures, disk checks, temp clean-up, health and job-status endpoints, resume after restart.
5. Add the new admin-authenticated start-render endpoint on the existing transovo.ai web app. It forwards the job to the worker over the internal network using `RENDER_WORKER_URL` and the shared secret. No new database tables.
6. Add unit tests (section 8) and a README with deploy steps, env vars and "move to another server" (change `RENDER_WORKER_URL` on the web app).
7. Update `worker/modal_motion/README.md`: say Modal is now a backup, off by default.
8. Producer PR: add `producer_handoff_kit/skills/motion-studio-production/scripts/render/` (submit talks to the web app, not the worker; Modal as an opt-in backup), update `SKILL.md` section 8, the kit README and `RULES_FROM_RICK.md`.
9. Open the PRs. Do not deploy, create Coolify apps or set secrets yourself. List for Rick what to set: new Coolify app from `Dockerfile.motion-render` with **no public hostname**, worker env vars (section 3), CPU shares 256, memory 5 GB, a volume for `/work` and the queue file, auto-deploy off; and on the existing web app, `RENDER_WORKER_URL` (internal service name) and the shared secret.
10. After Rick deploys it, run the section 8 test on a test job and report the numbers.
