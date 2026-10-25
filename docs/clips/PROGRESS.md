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
