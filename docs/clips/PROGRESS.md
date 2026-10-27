# Clips build progress

**Production:** https://transovo.ai  
**Branch:** `master` · **Rollback tag:** `pre-clips-cleanup`  
**Web live SHA (2026-10-27):** `305f73fae`+ (script editor); see deploy notes in roadmap milestone log  
**Build order:** script editor milestones → **STOP** → polish pass — **AI Studio on hold** (`docs/ROADMAP.md`)

## Recently shipped (regular clipper)

| Feature | SHA (approx.) | Notes |
|---------|---------------|--------|
| **Deepgram primary + local Whisper fallback** | `eeffb66c7` / `f4df628ce` | Worker `transcribe_provider`; `transcriptionEngine` on progress |
| **B2 source cache** | `2f9e01faf` | `/opt/clips-worker/cache` bind-mount; `storage.b2_get` `cache_hit=` logs; stable presigned URLs |
| **Upload ETA (stage-aware)** | `db41e7a6b` | Transcribe from duration×engine rate; picker/reframe tail; 50% poll clamp |
| **1080p export** | `3083d08d3` | Export dialog + worker render path |
| **Retry/resume** | `6b88d8255` | Skip ASR when `transcriptWords` persisted; soft-delete partial clips; B2 cache on re-download; picker pass1 not stored — re-runs on resume |
| **Script editor M1a–M1b** | `305f73fae` | Data plane, bootstrap API, Descript-style shell, seek sync |
| **Script editor M2** | `305f73fae`+ | Op log, delete-to-cut, export path in flight |
| **Script editor UX hotfix** | `5879ab151` (pending push) | Layout, undo/redo persistence, drag-select |
| **ETA calibration + parallel reframe** | `bcfbe3dd9` | Deepgram 0.05×+buffer; `CLIPS_RENDER_CONCURRENCY` pool |

**Fine-tuning / polish backlog** (after **script editor milestones** ship — **not** AI Studio; see `docs/ROADMAP.md` §fine-tuning): speaker-follow calmness, multi-person follow, face/speaker generalization, layout variety, ETA/render tuning, Streamer VOD resumable download.

## Milestones

| ID | Status | Notes |
|----|--------|--------|
| M0–M2 | ✅ deployed | Shell, upload UI, project settings |
| M3 | ✅ deployed (code) | Supabase storage, TUS uploads, worker queue + transcribe |
| M4+ | ⏸️ | Waiting on manager browser test |

### Streamer (spec: `docs/clips/STREAMER_BUILD_SPEC.md`)

| ID | Status | Notes |
|----|--------|--------|
| **S0** | ✅ deployed | `GPU_PROVIDER`, Modal `transovo-gpu`, job_types + heartbeat |
| **S1** | ✅ deployed | Paste Twitch/Kick + Streamer tab, `STREAM_IMPORT`, `stream_vods` |
| **S2** | 🟡 READY TO PUSH | Long-VOD audio → `STREAM_ANALYZE` → `STREAM_RENDER`, lanes, segment keys |
| **S3** | 🟡 READY TO PUSH | `stream_usage`, cap 402, `STREAM_CLEANUP`, usage meter API + UI |
| **S4** | 🟡 READY TO PUSH | Signals + fusion, reason chips, hype timeline, `/signals` API |
| S5–S12 | ⏳ | Chat signal, facecam, layout, montage, notifications, channels hub |
| **S13** | ⏳ | **Needs Twitch dev app** (OAuth + EventSub) — register before S13 |
| **S14** | ⏳ | **Needs Kick dev app** (OAuth 2.1 PKCE) — register before S14 |
| S15 | ⏳ | Modal render + face tracking |

## Storage

- **Production (live):** **Backblaze B2** via `STORAGE_DRIVER=s3` — bucket `transovo-clips`, SigV4 browser multipart (default 32 MB parts), `CLIPS_MAX_UPLOAD_BYTES=5368709120` (5 GB). CORS: `docs/clips/b2-cors.json`.
- **Legacy reads:** existing objects on Supabase bucket `clips` remain reachable (`storageDriver` fallback + worker Supabase download when S3 misses).
- **Supabase** project `sms2` still used for DB/auth; storage role is legacy + fallback only while objects migrate.
- Worker: `DATABASE_URL`, `WORKER_SHARED_SECRET`, `APP_URL`, `S3_*`, and `SUPABASE_URL` + service role for fallback.

## Manager testing (not automated by agent)

- https://transovo.ai/app/clips  
- https://transovo.ai/app/clips/new  
- Fixture: two-person `test_interview_60s.mp4` (not color-bar smoke clips).

**Upload limit (storage dependency):**

- Browser uploads go **direct to object storage** (Supabase TUS resumable for large files, signed PUT ≤50 MB, or **S3 multipart** when `STORAGE_DRIVER=s3`). Chunks never pass through the Next.js container.
- **Supabase Free** enforces a **global per-object upload cap (~50 MB)** on the project regardless of bucket `file_size_limit` (HTTP **413** from storage). **Supabase Pro** (or dedicated S3) is required for multi‑GB single-object uploads; Rick owns billing — do not change plan from code.
- **Effective UI limit** = `min(CLIPS_MAX_UPLOAD_BYTES | CLIPS_UPLOAD_MAX_BYTES, SUPABASE_OBJECT_MAX_BYTES)` when `STORAGE_DRIVER=supabase`. Set env on web after upgrade, e.g. `SUPABASE_OBJECT_MAX_BYTES=5368709120` and `CLIPS_MAX_UPLOAD_BYTES` to match product policy.
- Client preflight + `/api/clips/uploads/limits` must show the **effective** cap so the “up to X” hint never over-promises (e.g. not 150 MB / 20 GB while plan is still 50 MB).

**B2 env apply (one-time / rotation):** `scripts/apply-b2-env-coolify.sh` — Coolify API + `/opt/clips-worker/worker.env`, length-verify before shred. **Prod is already on B2** (Oct 2026).

**No shared-password gate** — `DEV_BYPASS_AUTH` unchanged; UI opens without clips login.

## Deploy rules

### Agent protocol (Rick)

1. **Before any `git push`:** stop and end the run with a message that starts with **`READY TO PUSH`**. Include: local `HEAD` SHA, commits since `origin/master`, one-line summary per changed file, `cd new-app && pnpm prisma generate && pnpm tsc --noEmit 2>&1 | grep -E 'clips'` (must be empty; clips paths only), plus `pytest` when worker code changed. **Do not push** until the manager replies **`PUSH`**.
2. **After `PUSH`:** push once; cancel every older queued or running deploy for app `ds8s3hjin60qs6g7s0iqkixs`; confirm **exactly one** deploy remains; **stay in the run** and watch it on `coolify-server` until done.
3. **Server-only work** (worker image rebuild, `/opt/clips-worker/worker.env`, `docker run`) is **not** gated on `PUSH` — do it immediately and report exact commands run.

### Coolify environment variables (never raw SQL)

**Do not** `INSERT` or `UPDATE` `environment_variables` in the Coolify Postgres DB. Plaintext values break Laravel `decrypt()` and deployments fail with `DecryptException: The payload is invalid`.

Use the Coolify API with `~/.coolify-api-token` on `coolify-server`:

```bash
TOKEN=$(cat ~/.coolify-api-token)
# Single var (Coolify encrypts value):
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"key":"VISION_MODEL","value":"gemini-flash-lite-latest","is_preview":false}' \
  "http://localhost:8000/api/v1/applications/ds8s3hjin60qs6g7s0iqkixs/envs"
# Bulk: PATCH .../envs/bulk with an array of {key, value, is_preview}
```

### Coolify watch (after manager `PUSH`)

- List/cancel via API (`application_id` `1`):
  ```bash
  curl -s -H "Authorization: Bearer $(cat ~/.coolify-api-token)" http://localhost:8000/api/v1/deployments
  curl -s -X POST -H "Authorization: Bearer $(cat ~/.coolify-api-token)" \
    "http://localhost:8000/api/v1/deployments/{deployment_uuid}/cancel"
  ```
- Poll every **60s** until finished:
  ```bash
  docker exec coolify-db psql -U coolify -d coolify -t -A -c \
    "select status from application_deployment_queues where id=<N>;"
  ```
- When status is **`finished`:** `curl -s https://transovo.ai/api/health` (`commitSha` must match pushed SHA); scan app container logs for new errors; `curl -s -o /dev/null -w '%{http_code}' https://transovo.ai/app/clips/exports` must be **200**.
- End the run with **`DEPLOYED:`** deploy id, SHA, health JSON, exports HTTP code, and any log errors — not before verification passes.
- If status is **`failed`:** pull deployment log errors, fix, **`READY TO PUSH`** again, wait for **`PUSH`**.

## Worker deploy

Persistent env file on the Coolify host: `/opt/clips-worker/worker.env` (root-owned, mode `600`). Recreate the worker with:

```bash
sudo docker rm -f clips-worker
sudo docker run -d \
  --name clips-worker \
  --restart unless-stopped \
  --network coolify \
  --env-file /opt/clips-worker/worker.env \
  clips-worker:latest
```

Image build (repo root, not `new-app/worker/clips_worker`):

```bash
cd /path/to/sms && sudo docker build -f worker/Dockerfile -t clips-worker:latest .
```

Required env names (values in `worker.env` only): `APP_URL`, `DATABASE_URL`, `WORKER_SHARED_SECRET`, `WORKER_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_DRIVER`, `STORAGE_BUCKET`, `OPENAI_API_KEY`, `CLIP_LLM_MODEL`, `ASR_MODEL`, `SPEAKERCROP_DIR`, `TRANSCRIBE_SCRIPT`, `PYTHONUNBUFFERED`, `HF_HOME`.
