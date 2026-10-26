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

- **Only the latest commit builds.** After every `git push` to `master`, over SSH on the Coolify host run:
  ```bash
  curl -s -H "Authorization: Bearer $(cat ~/.coolify-api-token)" http://localhost:8000/api/v1/deployments
  ```
- For web app `ds8s3hjin60qs6g7s0iqkixs` (`application_id` `1` in the API), **cancel every queued or in-progress deployment whose `commit` is not the commit you just pushed** — including an older build that is already running if a newer commit supersedes it:
  ```bash
  curl -s -X POST -H "Authorization: Bearer $(cat ~/.coolify-api-token)" \
    "http://localhost:8000/api/v1/deployments/{deployment_uuid}/cancel"
  ```
- Confirm with the same GET that **exactly one** deployment remains queued or running for that app (the newest commit).
- Do not stack pushes: one fix → one push → cancel duplicates → wait for that single deploy to finish (`GET /api/health` `commitSha` matches).
