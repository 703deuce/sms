# Self-hosted Motion Studio render worker

A private, long-running queue that renders the same bundle format as
`worker/modal_motion/`, using the **same** `pipeline.py` and `capture.mjs`.
Modal stays as a manually selected fallback. No schema migration, public DNS,
database credentials, B2 credentials, or separate public API.

## Coolify deployment (operator only)

- **Before building on sms**, check free disk on the host (already near the 90% safety threshold). A new Node/Chromium image and build cache may need several GB. If storage is tight, remove **only unused images/build cache** while nothing is rendering; never prune volumes or running containers, the live web app, app3, or SMS worker. Check again before build.
- Create a **new separate application**, Dockerfile path `Dockerfile.motion-render`. Its dedicated `Dockerfile.motion-render.dockerignore` limits the image build context without changing the shared web-app `.dockerignore`. This per-Dockerfile ignore behavior requires Docker BuildKit (enabled by default in Coolify); an older builder may fail the render image build without affecting the web application.
  Don't edit the existing web app, clips worker or app3. Disable automatic
  deployments; redeploy only while its internal health reports idle.
- Expose **no public domain, mapped host port, ingress or subdomain**. Bind the HTTP service
  only to a trusted internal Docker network; do not map port 8098 publicly.
  For a Coolify liveness check use `GET /livez` without a secret. The detailed `/health` endpoint **still requires** the shared secret.
  The web app's `RENDER_WORKER_URL` is the **stable Coolify network service name**, not the transient container name (and it must not start with a digit).
  (for example `http://<internal-service-name>:8098`).
- Add one **persistent** volume at `/work` (queue JSON contains short-lived
  job credentials and must be private). Store and rotate logs without tokens.
- Configure Coolify container limits: CPU shares 256, RAM 5 GiB,
  appropriate PIDs limit, default 2 segment workers.
- Provide **env-only** secrets: `RENDER_HOST_SECRET` (same random >=32-character
  secret to web app and worker). Never paste the value into source or logs.

Worker settings:

| Variable | Default |
| --- | --- |
| `RENDER_HOST_SECRET` | required |
| `RENDER_WORK_DIR` | `/work` |
| `RENDER_SEGMENT_WORKERS` | `2` |
| `RENDER_JOB_TIMEOUT_MIN` | `180` |
| `RENDER_NICE` | `10` |
| `RENDER_DISK_MAX_PERCENT` | `90` |
| `RENDER_ALLOWED_JOB_HOST` | `transovo.ai` |
| `PORT` | `8098` |

Existing web app requires `RENDER_WORKER_URL` and matching
`RENDER_HOST_SECRET`; Coolify deploy of the **existing** web app is done by
Rick. Web endpoint is
`POST /api/motion-studio/agent/jobs/:id/start-render` with the producer's
existing **job bearer** credential. It verifies the assignment and registered
bundle, then forwards a job-scoped credential through the private network.
The producer **never** talks to the render worker directly.

Only within the private network: `GET /health` and
`GET /jobs/:id` require header `X-Render-Host-Secret`. Health gives only
idle/busy, queue length, worker count and disk pressure, never a job token.

## Render and recovery

Each job downloads and validates the package once, then captures frame ranges
on CPU with up to three attempts per segment. Segments are registered under
`modal_seg_v1_cpu_...` so completed Modal/host frames can be reused.
The existing FFmpeg join/master/share/QA and portable publish are called
without rewriting their encoding rules. A heartbeat keeps queued assignments
alive; queue state is persisted atomically to the private volume and resumes
on restart. Only one film at a time is processed; segments within that film
may run concurrently. The worker removes the per-job scratch folder after
finishing or failing. It does not prune Docker or unrelated files.

When disk usage is above the threshold, rendering waits rather than risking
the web app's storage. The worker fails the job after thirty minutes of disk
pressure; operator cleanup is manual and limited to unused images/cache.

## Operator checks

1. Run offline tests in `worker/modal_motion/` and
   `worker/motion_render_host/`, typecheck the Next app.
2. Deploy *only this new worker* with no public address.
3. Check health from the internal network with the configured secret.
4. Deploy the existing web app yourself with worker URL and secret.
5. Submit a **fresh test assignment** using the 60-second 854×480, 1800-frame
   viewbotting bundle; start in benchmark mode, then test live publication.
6. Verify 12/12 framesets, QA, audible audio, live-site health, local temp
   cleanup, no Modal usage and successful editable reopen.

## Moving to a dedicated render server

Start the same image and volume on that machine. Connect it by private
Tailscale network (preferred, encrypted cross-host) and change **only** the existing web app's
`RENDER_WORKER_URL` to the new private address. Configure segment workers
to fit its core count, warm the image, verify a test render and shut down
the old worker cleanly. No new app URL or DNS needed.

## Technical QA and recovery (Nov 20)

The film's appearance is approved by the Producer before render. **The renderer
does not run blackdetect, mpdecimate, brightness, contrast, layout, or
creative-design checks.** Its QA validates full decode, exact frame count,
frame rate, resolution, durations, non-silent audio and container integrity.
Loudness is reported, not a customer-visible design warning.

The join stage uploads `master_cpu.mp4` and `share_cpu.mp4` before a
technical QA pass is required, and preserves the same files under
`/work/job_<jobId>/recovery/` until the job is delivered or explicitly
resolved. Existing registered frame ranges remain reusable; a technical
failure does **not** call `/complete {status:"failed"}`. The worker makes
one automatic whole-job retry using those frame receipts, reports
`retrying` through the authenticated render-status API, then records
`attention_required` (including category, attempt count and asset names)
and writes a safe owner-attention log. The customer receives a truthful
`fixing` progress update while the assignment stays open.

The authenticated `GET .../render-status` endpoint exposes repair details to
the Producer/owner; `GET .../render-asset?filename=master_cpu.mp4` (or
`share_cpu.mp4` / `qa_frame_cpu.png`) provides short-lived links if those
assets have been registered. When file creation fails before there is a
master/share, only completed segments can be preserved. Do not present a
partial file as a finished movie. An actual outbound owner push notification
has **not** been wired to an external notification destination; the durable
activity event and operator log are the alert surfaces for now.

Before a producer resubmits a **changed composition** on the same job, verify
that prior segment receipts match that composition. Segment filenames encode
frame ranges but not bundle hashes; reusing old segments after changing their
content is unsafe and must not be done without invalidation. Technical
retries of the **same** bundle reuse the same registered segments.

## Keith Murray delivery-speed improvements (Nov 20)

The master is independently watchable after the job API confirms
`approveMaster`, **before** the editable scene package is published. The
customer-facing job exposes a signed `videoUrl` and `masterReadyAt` while
`editableReady=false`. The worker records a separate `master_ready`
render-status event, continues preparing the editor package, and only sets
`completedAt` after full native publication. A temporary editable-publish
failure must not hide or roll back the approved master.

The shared `publish_editable` path still accepts `portable.json` as a
single-POST fast path. Without one, it SHA-verifies each original blob,
deduplicates identical content, reuses any separately registered, ready
receipt with matching sha256, bytes, kind and MIME, and uploads remaining
blobs in a bounded four-thread pool. **A blob merely inside the uploaded ZIP
is not separately registered** and cannot be marked ready by implication.

After a segment encode, B2 upload/commit retries use the **same encoded
segment file**, not a second Chromium capture. B2 size-read consistency
gets short bounded retries; retryCommit can safely confirm an already
committed object. The worker now uses `tini -g --` as PID 1 so orphaned
Chromium descendants are reaped without raising the process limit.

Operational stage logs contain only job ID, stage and allowlisted numbers
(duration, bytes, segment index, retry count); no URLs, credentials, paths
or headers. A private `/work/logs/job_<id>.jsonl` survives scratch cleanup.
No runtime restart or existing zombie cleanup is performed by these source
changes; the improved reaping takes effect only with a future approved deploy.

**Still to validate:** 60-second user-visible master-first test, customer
notification behavior, full native Compact Editor reopen, and timings on an
actual 84-asset package. Upload speed is an optimization, not a guaranteed
one-minute completion SLA.
