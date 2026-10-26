# Clips build progress

**Production:** https://transovo.ai  
**Branch:** `master` · **Rollback tag:** `pre-clips-cleanup`

## Milestones

| ID | Status | Notes |
|----|--------|--------|
| M0–M2 | ✅ deployed | Shell, upload UI, project settings |
| M3 | ✅ deployed (code) | Supabase storage, TUS uploads, worker queue + transcribe |
| M4+ | ⏸️ | Waiting on manager browser test |

## Storage

- **Supabase** project `sms2`, private bucket `clips` (`STORAGE_DRIVER=supabase`).
- Browser: TUS resumable (6 MB chunks) or signed PUT ≤50 MB.
- Worker: `SUPABASE_URL` + service role, `DATABASE_URL`, `WORKER_SHARED_SECRET`, `APP_URL`.

## Manager testing (not automated by agent)

- https://transovo.ai/app/clips  
- https://transovo.ai/app/clips/new  
- Fixture: two-person `test_interview_60s.mp4` (not color-bar smoke clips).

**Upload limit:** Supabase bucket created with plan default max (5 GB target failed at create — check bucket `file_size_limit` in Supabase dashboard if large uploads fail).

**No shared-password gate** — `DEV_BYPASS_AUTH` unchanged; UI opens without clips login.

## Deploy rules

### Agent protocol (Rick)

1. **Before any `git push`:** stop and end the run with a message that starts with **`READY TO PUSH`**. Include: local `HEAD` SHA, commits since `origin/master`, one-line summary per changed file, `cd new-app && pnpm prisma generate && pnpm tsc --noEmit 2>&1 | grep -E 'clips'` (must be empty; clips paths only), plus `pytest` when worker code changed. **Do not push** until the manager replies **`PUSH`**.
2. **After `PUSH`:** push once; cancel every older queued or running deploy for app `ds8s3hjin60qs6g7s0iqkixs`; confirm **exactly one** deploy remains; **stay in the run** and watch it on `coolify-server` until done.
3. **Server-only work** (worker image rebuild, `/opt/clips-worker/worker.env`, `docker run`) is **not** gated on `PUSH` — do it immediately and report exact commands run.

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
