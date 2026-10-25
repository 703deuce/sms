# Clips build progress

**Production URL:** https://transovo.ai (`/app/clips`, `/app/clips/new`)  
**Branch:** `master`  
**Rollback tag:** `pre-clips-cleanup`

## Milestones

| ID | Status | Verified |
|----|--------|----------|
| Cleanup | ✅ | `pnpm` production build with `SKIP_VOICE_V3_SYNC=1`; routes include `/app/clips/*` |
| M0 | ✅ | Clips nav, test-mode badge, `CLIP_JOB_STATE`, `/app` → `/app/clips` |
| M1 | ✅ (code) | Upload API + storage abstraction (`STORAGE_DRIVER=supabase\|s3`, default supabase) |
| M2 | ✅ (code) | `project-settings-form` (mode, genre, layout, aspect, captions, `?preset=`) |
| M3 | ✅ (code) | Worker queue, HMAC progress, TUS/signed PUT uploads to Supabase Storage |
| M4 | ⏳ | Clip picks, speakercrop, captions, results UI |
| M5 | ⏳ | Export/download, signed preview URLs (1 h) |

## Storage (Supabase)

- **Project:** `sms2` (`ztccppxodhgdyejkuuax`, us-east-1). **No MinIO/SeaweedFS.**
- **Bucket:** private `clips` — create once: `node new-app/scripts/ensure-clips-storage-bucket.mjs` (uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from prod env).
- **App env:** `STORAGE_DRIVER=supabase`, `STORAGE_BUCKET=clips`, existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (and `DATABASE_URL`). Remove legacy `S3_*` unless `STORAGE_DRIVER=s3`.
- **Browser:** TUS resumable (`tus-js-client`, 6 MB chunks) to Supabase; token from `createSignedUploadUrl` on server. Files ≤50 MB may use signed PUT.
- **Worker env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_DRIVER=supabase`, `STORAGE_BUCKET=clips`, `DATABASE_URL`, `APP_URL`, `WORKER_SHARED_SECRET`, `ASR_MODEL=small.en`.

## Production deploy / E2E

| Step | Status |
|------|--------|
| `git push origin master` | ⏳ After Supabase storage commit |
| Coolify rebuild | ⏳ Prod health still `ab826f32…` (pre-clips); queue deploy from host |
| `clip_*` tables | ✅ Already on Supabase `sms2` (per Rick) |
| `clips` bucket | ⏳ Run ensure script on host with prod service role |
| Worker container | ⏳ `worker/Dockerfile` on `coolify` network |
| M3 E2E (`test_interview_60s.mp4`) | ⏳ Blocked on deploy + bucket + worker |

## Known issues

- Cloud agent SSH to `coolify-server` unavailable this session — operator must queue deploy (`scripts/coolify-queue-web-deploy.sh`) and set Coolify env.
- If Supabase plan caps per-object size below 5 GB, note actual `file_size_limit` from bucket list API in this file.
