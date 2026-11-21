# Modal Render & Server Operations Runbook (Nov 19, 2026)

## 1. Modal Film Renderer (`worker/modal_motion/`)

- **Modal app name:** `transovo-motion-render` (isolated from `worker/modal_app` `transovo-gpu`).
- **Engine:** Node 22 + Chromium + FFmpeg + `puppeteer-core` + `hyperframes@0.9.52`.
- **Mode decision (Nov 19 benchmark):** Use **CPU (`MOTION_MODE=cpu`)** for 2D films.
  - 5s 1080p30 JD hook benchmark: CPU `122s`, `$0.0159` (`~$0.19/rendered min`) vs GPU T4 `222s`, `$0.0586` (`~$0.70/rendered min`).
- **Container & timeout settings (as of `8dbc8e9f`):**
  - `capture_cpu`: `4 vCPU`, `8 GB RAM`, `max_containers=24`.
  - `join_qa`: `8 vCPU`, `16 GB RAM`, `timeout=21600` (6h).
  - `ffprobe` uses `-count_packets` (1800s timeout, vs slow `-count_frames`).
  - Long-film `qa_video()` / encode timeouts: `1800s–5400s`.
  - B2 bundle downloads retry 8x with jittered backoff; job API calls (`render-asset`, `assets`, `portable`, `complete`) retry on `429`/`5xx`/connection resets so Coolify container swaps don't kill running jobs.

### Delivery order (Render-First)
1. Stitch & run `qa_video()`.
2. Upload & approve `master_cpu.mp4` (`POST /assets` with `approveMaster: true`) **immediately after QA**, setting `resultKey` so the watch page plays right away.
3. Encode `share_cpu.mp4`: for films `>300s`, skip the 24 MB cap (single 720p CRF 30, `96k` AAC encode).
4. Upload editable package (`blobs/<sha256>`, `document`, `assets`, `bundles`, `live-project.json`) -> `POST /portable` -> `POST /complete`.

### Segment reuse across jobs on the same project
- `GET /api/motion-studio/agent/jobs/[id]/render-asset` permits `assetId` / `filename` belonging to `ws/<workspaceId>/motion-studio/agent/`, so a retry job can pass `reuse: {"bundle": <assetId>, "segments": {"0": <assetId>, ...}}` to `modal_submit.mjs` without re-rendering finished segments.
- **Never** invent or print signed B2 URLs. Always use `scripts/download_asset.py` or `scripts/redact_status.py`.

---

## 2. Helper scripts (`docs/handoffs/2026-11-19-chief-of-staff/scripts/`)

All scripts read `MOTION_JOB_URL` and `MOTION_JOB_TOKEN` from environment variables (never hardcoded, never logged):
- `submit_modal.sh [cpu|gpu]` — wraps `new-app/scripts/motion-studio/modal_submit.mjs`.
- `wait_call.py <call_id> [timeout_s]` — waits on `modal.FunctionCall.from_id` while polling redacted `/render-status`.
- `redact_status.py` — prints redacted `/render-status`.
- `download_asset.py --out <path> (--asset-id <id> | --filename <name>)` — downloads one job asset cleanly.
- `heartbeat.sh` — renews the job lease via `POST /checkpoint` every 60s.

---

## 3. Hetzner, Coolify & Database Ops (`128.140.102.51`)

### Verify live web deployment
```bash
curl -s https://transovo.ai/api/health
```
- Pushing to `master` triggers Coolify auto-deploy for web (`new-app`), normally ~6 minutes.
- If a deploy runs **>15 minutes**, investigate `coolify-db` / docker logs — never just wait it out.

### Disk management warning
- As of Nov 19, Hetzner `/` is at **~81%** (`~28G` free of `150G`), with ~55 GB in active Docker build cache.
- If disk hits >90%, safely prune only unused stopped containers/dangling images (`docker image prune -f`), never touch volumes or `app3` / SMS worker.

### Coordinator & `MotionStudioWorkerPlan`
- `new-app/lib/server/motion-studio/coordinator.ts` gates new AI dispatches using `MotionStudioWorkerPlan` (`grokbot-plan-john`):
  - Dispatch allowed only when `enabled = true` and `observedPercent < weeklyLimitPercent`.
  - Inspect read-only via `clips-worker`:
    ```bash
    ssh cursor-agent@128.140.102.51 'docker exec clips-worker python3 -c "import os,psycopg2;c=psycopg2.connect(os.environ[\"DATABASE_URL\"]);cur=c.cursor();cur.execute(\"select id,\\\"weeklyLimitPercent\\\",\\\"observedPercent\\\",\\\"resetsAt\\\",enabled from \\\"MotionStudioWorkerPlan\\\"\");print(cur.fetchall())"'
    ```
- **Manual coordinator kick:** `POST https://transovo.ai/api/motion-studio/agent/coordinator` with the admin key header from `MOTION_STUDIO_COORDINATOR_ADMIN_KEY`.
- **Stopping a stuck job cleanly:** Never delete rows casually; mark `status = 'failed'` only with John's intent or when halting a runaway job, and ensure no automatic requeue fires.
