# Clips build progress

**Production URL:** https://transovo.ai (`/app/clips`, `/app/clips/new`)  
**Branch:** `master`  
**Rollback tag:** `pre-clips-cleanup`  
**Commits:** `pre-clips-cleanup` (tag), cleanup commit, `feat(clips): M0–M3…` (`84e7239e8`)

## Milestones

| ID | Status | Verified |
|----|--------|----------|
| Cleanup | ✅ | `pnpm` production build with `SKIP_VOICE_V3_SYNC=1`; routes list includes `/app/clips/*` only (phone routes gone) |
| M0 | ✅ | Clips nav, test-mode badge, `CLIP_JOB_STATE`, `formatWhen` uses `Date.now()`, `/app` → `/app/clips` |
| M1 | ✅ (code) | Prisma migration `20261025190000_clips_tables`, multipart upload API, `lib/storage/s3.ts` |
| M2 | ✅ (code) | `project-settings-form` (mode, genre, length, range, layout, aspect, captions, `?preset=`) |
| M3 | ✅ (code) | Worker `worker/clips_worker`, HMAC progress API, `JobStatus` polling, cancel + reaper routes |

## Production deploy / E2E

| Step | Status |
|------|--------|
| `git push origin master` | ✅ |
| Coolify rebuild | ⏳ Redeploy from Coolify UI or compose pull (image may lag webhook) |
| `prisma migrate deploy` on prod DB | ⏳ Run after new container is live |
| `S3_*` + `WORKER_SHARED_SECRET` on prod app | ⏳ **Blocked:** MinIO image pull failed on server; set R2/MinIO manually in Coolify |
| Worker container | ⏳ Deploy `worker/Dockerfile` with same env as app |
| Upload `test_interview_60s.mp4` → transcript in DB | ⏳ Needs S3 + migration + worker |

## Missing keys (optional / later)

- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `KIE_*`, `ELEVENLABS_API_KEY`, `PIXABAY_API_KEY` — not required for M3 transcribe path.

## Known issues

- Production E2E blocked until object storage env is configured on the Coolify app.
- M4 blocked until M3 E2E passes on production (word-level `transcriptWords` + `words.json` in S3).
